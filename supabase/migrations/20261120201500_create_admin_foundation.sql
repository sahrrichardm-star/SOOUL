-- SOOULL administrator foundation: roles and append-only audit history.
create table if not exists private.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin','security_admin','support_admin','operations_admin','analytics_admin')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table private.admin_memberships is 'Server-managed SOOULL administrator roles. Never writable by browser clients.';
alter table private.admin_memberships enable row level security;
revoke all on table private.admin_memberships from public, anon, authenticated;
grant all on table private.admin_memberships to service_role;

create table if not exists private.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 120),
  target_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table private.admin_audit_logs is 'Restricted audit trail for SOOULL privileged actions. Never stores story or file contents.';
alter table private.admin_audit_logs enable row level security;
revoke all on table private.admin_audit_logs from public, anon, authenticated;
grant all on table private.admin_audit_logs to service_role;

create or replace function private.prevent_admin_audit_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'SOOULL administrator audit records are append-only';
end;
$$;
revoke all on function private.prevent_admin_audit_mutation() from public, anon, authenticated;
grant execute on function private.prevent_admin_audit_mutation() to service_role;
drop trigger if exists admin_audit_logs_append_only on private.admin_audit_logs;
create trigger admin_audit_logs_append_only
before update or delete on private.admin_audit_logs
for each row execute function private.prevent_admin_audit_mutation();

create or replace function public.current_admin_role()
returns text language sql stable security definer set search_path = '' as $$
  select membership.role
  from private.admin_memberships as membership
  where membership.user_id = (select auth.uid())
    and membership.is_active = true
  limit 1;
$$;
revoke all on function public.current_admin_role() from public, anon;
grant execute on function public.current_admin_role() to authenticated;
comment on function public.current_admin_role() is 'Returns only the calling authenticated user''s active SOOULL administrator role.';
