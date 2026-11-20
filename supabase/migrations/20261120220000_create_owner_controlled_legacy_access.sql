-- SOOULL owner-controlled future access. Inactivity is a trigger for verification, never an automatic release.
create unique index if not exists trusted_contacts_id_user_id_uidx
  on public.trusted_contacts(id, user_id);

create table if not exists public.legacy_access_plans (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  life_event_enabled boolean not null default false,
  inactivity_enabled boolean not null default false,
  inactivity_days smallint not null default 7 check (inactivity_days between 1 and 7),
  last_confirmed_at timestamptz not null default now(),
  warning_sent_at timestamptz,
  inactivity_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.legacy_access_plans is
  'Owner-configured life-event and 1-to-7-day inactivity triggers. Inactivity never releases content without independent verification.';

create table if not exists public.legacy_access_recipients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  trusted_contact_id uuid not null,
  recipient_user_id uuid references auth.users(id) on delete set null,
  invitation_status text not null default 'pending'
    check (invitation_status in ('pending','accepted','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (owner_id, trusted_contact_id),
  foreign key (trusted_contact_id, owner_id)
    references public.trusted_contacts(id, user_id) on delete cascade
);
comment on table public.legacy_access_recipients is
  'A trusted contact linked to a separate SOOULL account for a future, owner-authorized selected-content release.';

create table if not exists public.legacy_access_grants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null,
  content_type text not null check (content_type in ('story','legacy_entry','safekeeping_record','asset')),
  content_id uuid not null,
  created_at timestamptz not null default now(),
  unique (recipient_id, content_type, content_id),
  foreign key (recipient_id, owner_id)
    references public.legacy_access_recipients(id, owner_id) on delete cascade
);
comment on table public.legacy_access_grants is
  'Explicit item-by-item grants only. No full-account or password access is supported.';

create table if not exists public.legacy_access_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  trigger_type text not null check (trigger_type in ('death','incapacity','inactivity')),
  status text not null default 'submitted'
    check (status in ('submitted','verification_pending','approved','rejected','cancelled','expired')),
  evidence_submitted boolean not null default false,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewer_note text not null default '' check (char_length(reviewer_note) <= 2000),
  foreign key (recipient_id, owner_id)
    references public.legacy_access_recipients(id, owner_id) on delete cascade
);
comment on table public.legacy_access_requests is
  'Requests for future legacy access. Approval is reserved for a separately verified server-side process.';

create index if not exists legacy_access_recipients_owner_idx on public.legacy_access_recipients(owner_id);
create index if not exists legacy_access_recipients_user_idx on public.legacy_access_recipients(recipient_user_id);
create index if not exists legacy_access_grants_owner_idx on public.legacy_access_grants(owner_id);
create index if not exists legacy_access_grants_content_idx on public.legacy_access_grants(content_type, content_id);
create index if not exists legacy_access_requests_owner_status_idx on public.legacy_access_requests(owner_id, status, submitted_at desc);
create index if not exists legacy_access_requests_recipient_idx on public.legacy_access_requests(recipient_id, status);

alter table public.legacy_access_plans enable row level security;
alter table public.legacy_access_recipients enable row level security;
alter table public.legacy_access_grants enable row level security;
alter table public.legacy_access_requests enable row level security;

revoke all on table public.legacy_access_plans, public.legacy_access_recipients,
  public.legacy_access_grants, public.legacy_access_requests from public, anon;
grant select, insert, update, delete on table public.legacy_access_plans,
  public.legacy_access_recipients, public.legacy_access_grants to authenticated;
grant select, insert on table public.legacy_access_requests to authenticated;

create policy "Owners manage their legacy access plans"
on public.legacy_access_plans for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Owners manage their legacy access recipients"
on public.legacy_access_recipients for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Owners manage selected legacy grants"
on public.legacy_access_grants for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Owners and invited recipients can read legacy access requests"
on public.legacy_access_requests for select to authenticated
using (
  owner_id = (select auth.uid())
  or exists (
    select 1 from public.legacy_access_recipients as recipient
    where recipient.id = legacy_access_requests.recipient_id
      and recipient.owner_id = legacy_access_requests.owner_id
      and recipient.recipient_user_id = (select auth.uid())
      and recipient.invitation_status = 'accepted'
  )
);

create policy "Accepted recipients can submit their own access request"
on public.legacy_access_requests for insert to authenticated
with check (
  requested_by = (select auth.uid())
  and status = 'submitted'
  and reviewed_at is null
  and reviewed_by is null
  and exists (
    select 1 from public.legacy_access_recipients as recipient
    where recipient.id = legacy_access_requests.recipient_id
      and recipient.owner_id = legacy_access_requests.owner_id
      and recipient.recipient_user_id = (select auth.uid())
      and recipient.invitation_status = 'accepted'
  )
);

create policy "Require MFA assurance for enrolled users"
on public.legacy_access_plans as restrictive for all to authenticated
using ((select private.user_meets_mfa_policy()))
with check ((select private.user_meets_mfa_policy()));
create policy "Require MFA assurance for enrolled users"
on public.legacy_access_recipients as restrictive for all to authenticated
using ((select private.user_meets_mfa_policy()))
with check ((select private.user_meets_mfa_policy()));
create policy "Require MFA assurance for enrolled users"
on public.legacy_access_grants as restrictive for all to authenticated
using ((select private.user_meets_mfa_policy()))
with check ((select private.user_meets_mfa_policy()));
create policy "Require MFA assurance for enrolled users"
on public.legacy_access_requests as restrictive for all to authenticated
using ((select private.user_meets_mfa_policy()))
with check ((select private.user_meets_mfa_policy()));

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
  return v_confirmed_at;
end;
$$;
revoke all on function public.confirm_legacy_activity() from public, anon;
grant execute on function public.confirm_legacy_activity() to authenticated;

create or replace function public.admin_metrics()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'registered_users', (select count(*) from auth.users),
    'new_users_7d', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'active_users_30d', (select count(*) from auth.users where last_sign_in_at >= now() - interval '30 days'),
    'stories', (select count(*) from public.stories),
    'legacy_entries', (select count(*) from public.legacy_entries),
    'safekeeping_records', (select count(*) from public.safekeeping_records),
    'assets', (select count(*) from public.assets),
    'storage_bytes', (select coalesce(sum(file_size_bytes), 0) from public.assets),
    'wallet_records', (select count(*) from public.wallet_records),
    'enabled_personas', (select count(*) from public.persona_profiles where is_enabled = true),
    'trusted_people_records', (select count(*) from public.trusted_contacts),
    'legacy_access_requests_pending', (select count(*) from public.legacy_access_requests where status in ('submitted','verification_pending'))
  );
$$;
revoke all on function public.admin_metrics() from public, anon, authenticated;
grant execute on function public.admin_metrics() to service_role;
