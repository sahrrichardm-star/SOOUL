-- Let authenticated users read only their own role row, without SECURITY DEFINER.
grant usage on schema private to authenticated;
grant select on table private.admin_memberships to authenticated;
revoke insert, update, delete, truncate, references, trigger on table private.admin_memberships from authenticated;

drop policy if exists "Users can read own administrator membership" on private.admin_memberships;
create policy "Users can read own administrator membership"
on private.admin_memberships
for select
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.current_admin_role()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select membership.role
  from private.admin_memberships as membership
  where membership.user_id = (select auth.uid())
    and membership.is_active = true
  limit 1;
$$;
revoke all on function public.current_admin_role() from public, anon;
grant execute on function public.current_admin_role() to authenticated;

create index if not exists admin_audit_logs_actor_id_idx on private.admin_audit_logs(actor_id);
create index if not exists admin_audit_logs_target_user_id_idx on private.admin_audit_logs(target_user_id);
create index if not exists admin_memberships_created_by_idx on private.admin_memberships(created_by);
