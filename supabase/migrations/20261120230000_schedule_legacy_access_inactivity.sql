create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create table if not exists public.legacy_access_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references public.legacy_access_recipients(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  kind text not null check (kind in ('inactivity_warning','verification_required','request_update')),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists legacy_access_notifications_owner_idx
  on public.legacy_access_notifications(owner_id, created_at desc);
create index if not exists legacy_access_notifications_recipient_idx
  on public.legacy_access_notifications(recipient_user_id, created_at desc);

alter table public.legacy_access_notifications enable row level security;
revoke all on table public.legacy_access_notifications from public, anon, authenticated;
grant select on table public.legacy_access_notifications to authenticated;
grant update(read_at) on table public.legacy_access_notifications to authenticated;

create policy "Owners and recipients can read legacy access notifications"
on public.legacy_access_notifications for select to authenticated
using (owner_id = (select auth.uid()) or recipient_user_id = (select auth.uid()));

create policy "Owners and recipients can mark their notifications read"
on public.legacy_access_notifications for update to authenticated
using (owner_id = (select auth.uid()) or recipient_user_id = (select auth.uid()))
with check (owner_id = (select auth.uid()) or recipient_user_id = (select auth.uid()));

create policy "Require MFA assurance for enrolled users"
on public.legacy_access_notifications as restrictive for all to authenticated
using ((select private.user_meets_mfa_policy()))
with check ((select private.user_meets_mfa_policy()));

grant update(status) on table public.legacy_access_requests to authenticated;
create policy "Owners can cancel pending inactivity requests"
on public.legacy_access_requests for update to authenticated
using (
  owner_id = (select auth.uid())
  and trigger_type = 'inactivity'
  and status in ('submitted','verification_pending')
)
with check (
  owner_id = (select auth.uid())
  and trigger_type = 'inactivity'
  and status = 'cancelled'
);

create or replace function public.confirm_legacy_activity()
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_confirmed_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;
  update public.legacy_access_plans
  set last_confirmed_at = v_confirmed_at,
      warning_sent_at = null,
      inactivity_triggered_at = null,
      updated_at = v_confirmed_at
  where owner_id = (select auth.uid())
    and inactivity_enabled = true;
  if not found then
    raise exception 'Inactivity monitoring is not enabled for this account.';
  end if;

  update public.legacy_access_requests
  set status = 'cancelled'
  where owner_id = (select auth.uid())
    and trigger_type = 'inactivity'
    and status in ('submitted','verification_pending');

  update public.legacy_access_notifications
  set read_at = coalesce(read_at, v_confirmed_at)
  where owner_id = (select auth.uid())
    and kind = 'inactivity_warning'
    and read_at is null;

  return v_confirmed_at;
end;
$$;
revoke all on function public.confirm_legacy_activity() from public, anon;
grant execute on function public.confirm_legacy_activity() to authenticated;

create or replace function public.mark_legacy_access_notification_read(p_notification_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.legacy_access_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and (owner_id = (select auth.uid()) or recipient_user_id = (select auth.uid()));
  if not found then
    raise exception 'Notification not found for this account.';
  end if;
end;
$$;
revoke all on function public.mark_legacy_access_notification_read(uuid) from public, anon;
grant execute on function public.mark_legacy_access_notification_read(uuid) to authenticated;

create or replace function private.process_legacy_access_inactivity()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan record;
  v_recipient record;
  v_created boolean;
begin
  for v_plan in
    select p.owner_id, p.inactivity_days
    from public.legacy_access_plans p
    where p.inactivity_enabled = true
      and p.inactivity_triggered_at is null
      and now() >= p.last_confirmed_at + make_interval(days => p.inactivity_days)
    for update skip locked
  loop
    update public.legacy_access_plans
    set warning_sent_at = now(),
        inactivity_triggered_at = now(),
        updated_at = now()
    where owner_id = v_plan.owner_id;

    insert into public.legacy_access_notifications(owner_id, kind, title, body)
    values (
      v_plan.owner_id,
      'inactivity_warning',
      'Please confirm your SOOULL activity',
      'Your configured inactivity period of ' || v_plan.inactivity_days || ' day(s) has elapsed. If you are safe and still managing your account, open SOOULL and confirm that you are active. No legacy content will be released automatically.'
    );
  end loop;

  for v_plan in
    select p.owner_id, p.inactivity_triggered_at
    from public.legacy_access_plans p
    where p.inactivity_enabled = true
      and p.inactivity_triggered_at is not null
      and p.inactivity_triggered_at <= now() - interval '24 hours'
  loop
    for v_recipient in
      select r.id, r.recipient_user_id, r.recipient_email
      from public.legacy_access_recipients r
      where r.owner_id = v_plan.owner_id
        and r.invitation_status = 'accepted'
        and r.recipient_user_id is not null
    loop
      v_created := false;
      if not exists (
        select 1 from public.legacy_access_requests request
        where request.owner_id = v_plan.owner_id
          and request.recipient_id = v_recipient.id
          and request.trigger_type = 'inactivity'
          and request.status in ('submitted','verification_pending','approved')
      ) then
        insert into public.legacy_access_requests(
          owner_id, recipient_id, requested_by, trigger_type, status
        ) values (
          v_plan.owner_id, v_recipient.id, v_plan.owner_id, 'inactivity', 'verification_pending'
        );
        v_created := true;
      end if;

      if v_created then
        insert into public.legacy_access_notifications(owner_id, recipient_id, kind, title, body)
        values (
          v_plan.owner_id, v_recipient.id, 'verification_required',
          'A future-access request requires review',
          'The inactivity warning period elapsed. An independent verification process is required before any selected legacy content can be released.'
        );
        insert into public.legacy_access_notifications(owner_id, recipient_id, recipient_user_id, kind, title, body)
        values (
          v_plan.owner_id, v_recipient.id, v_recipient.recipient_user_id, 'verification_required',
          'A SOOULL legacy request is awaiting verification',
          'You have been nominated for selected legacy access. This is not an approval or permission to access content. SOOULL must complete independent verification first.'
        );
      end if;
    end loop;

    if not exists (
      select 1 from public.legacy_access_recipients r
      where r.owner_id = v_plan.owner_id
        and r.invitation_status = 'accepted'
        and r.recipient_user_id is not null
    ) and not exists (
      select 1 from public.legacy_access_notifications n
      where n.owner_id = v_plan.owner_id
        and n.kind = 'verification_required'
        and n.created_at >= v_plan.inactivity_triggered_at
    ) then
      insert into public.legacy_access_notifications(owner_id, kind, title, body)
      values (
        v_plan.owner_id, 'verification_required',
        'Future access needs your attention',
        'Your inactivity warning period elapsed, but no trusted person has completed account linking. No access request was released. Review your trusted people and future-access settings.'
      );
    end if;
  end loop;
end;
$$;
revoke all on function private.process_legacy_access_inactivity() from public, anon, authenticated;
grant execute on function private.process_legacy_access_inactivity() to postgres;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'sooull-legacy-access-inactivity') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'sooull-legacy-access-inactivity';
  end if;
  perform cron.schedule(
    'sooull-legacy-access-inactivity',
    '0 * * * *',
    'select private.process_legacy_access_inactivity();'
  );
end;
$$;
