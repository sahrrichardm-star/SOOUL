-- Consolidate administrator RBAC in the primary SOOULL backend.
create table if not exists private.admin_roles (
  role_key text primary key,
  display_name text not null,
  description text not null default '',
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  constraint admin_roles_key_format check (role_key ~ '^[a-z][a-z0-9_]{1,63}$')
);
create table if not exists private.admin_permissions (
  permission_key text primary key,
  description text not null,
  created_at timestamptz not null default now(),
  constraint admin_permissions_key_format check (permission_key ~ '^[a-z][a-z0-9_.]{1,95}$')
);
create table if not exists private.admin_role_permissions (
  role_key text not null references private.admin_roles(role_key) on delete cascade,
  permission_key text not null references private.admin_permissions(permission_key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);
alter table private.admin_roles enable row level security;
alter table private.admin_permissions enable row level security;
alter table private.admin_role_permissions enable row level security;
revoke all on private.admin_roles, private.admin_permissions, private.admin_role_permissions from anon, authenticated;

insert into private.admin_roles(role_key,display_name,description) values
 ('super_admin','Super Administrator','Full platform administration with audited privileged access.'),
 ('security_admin','Security Administrator','Security monitoring and security controls.'),
 ('support_admin','Support Administrator','Customer account metadata and support audit access.'),
 ('operations_admin','Operations Administrator','Legacy review, storage oversight and platform operations.'),
 ('analytics_admin','Analytics Administrator','Aggregate platform analytics only.')
on conflict (role_key) do update set display_name=excluded.display_name,description=excluded.description;

insert into private.admin_permissions(permission_key,description) values
 ('dashboard.view','View the administration dashboard and aggregate metrics.'),
 ('users.view','View customer account metadata.'),
 ('users.manage','Manage permitted customer account metadata and support workflows.'),
 ('users.suspend','Suspend or restore customer accounts through approved workflows.'),
 ('security.view','View security status and security events.'),
 ('security.manage','Manage approved security controls.'),
 ('legacy.view','View legacy access requests and status metadata.'),
 ('legacy.review','Review submitted legacy access evidence.'),
 ('legacy.release','Release only individually authorised content after approved verification.'),
 ('storage.view','View storage usage and service status, not private file contents.'),
 ('wallet.view','View wallet feature aggregate status, not private financial records.'),
 ('audit.view','View immutable administrator audit records.'),
 ('analytics.view','View aggregate product analytics.'),
 ('system.view','View platform health and operational status.'),
 ('roles.manage','Assign administrator roles and manage administrator memberships.'),
 ('settings.manage','Manage approved platform settings.')
on conflict (permission_key) do update set description=excluded.description;

insert into private.admin_role_permissions(role_key,permission_key)
select 'super_admin',permission_key from private.admin_permissions on conflict do nothing;
insert into private.admin_role_permissions(role_key,permission_key) values
 ('security_admin','dashboard.view'),('security_admin','security.view'),('security_admin','security.manage'),('security_admin','audit.view'),
 ('support_admin','dashboard.view'),('support_admin','users.view'),('support_admin','audit.view'),
 ('operations_admin','dashboard.view'),('operations_admin','legacy.view'),('operations_admin','legacy.review'),('operations_admin','storage.view'),('operations_admin','system.view'),('operations_admin','audit.view'),
 ('analytics_admin','dashboard.view'),('analytics_admin','analytics.view'),('analytics_admin','system.view')
on conflict do nothing;

create or replace function public.admin_has_permission(p_permission text)
returns boolean language sql stable security definer set search_path=''
as $function$
 select exists (
  select 1 from private.admin_memberships m
  join private.admin_role_permissions rp on rp.role_key=m.role
  where m.user_id=(select auth.uid()) and m.is_active=true and rp.permission_key=p_permission
 );
$function$;
revoke all on function public.admin_has_permission(text) from public,anon;
grant execute on function public.admin_has_permission(text) to authenticated;

drop policy if exists "MFA administrators can read audit logs" on private.admin_audit_logs;
create policy "MFA administrators can read audit logs" on private.admin_audit_logs
for select to authenticated using (
 (select auth.uid()) is not null
 and ((select auth.jwt())->>'aal')='aal2'
 and public.admin_has_permission('audit.view')
);

create or replace function public.admin_assign_role(p_user_id uuid,p_role text,p_reason text default null)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null or coalesce((select auth.jwt())->>'aal','')<>'aal2'
 or not exists(select 1 from private.admin_memberships where user_id=v_actor and role='super_admin' and is_active=true)
 then raise exception 'An active super administrator with MFA is required.'; end if;
 if not exists(select 1 from private.admin_roles where role_key=p_role) then raise exception 'Unknown administrator role.'; end if;
 if p_user_id is null or not exists(select 1 from auth.users where id=p_user_id) then raise exception 'The target account does not exist in SOOULL authentication.'; end if;
 insert into private.admin_memberships(user_id,role,is_active,created_by) values(p_user_id,p_role,true,v_actor)
 on conflict(user_id) do update set role=excluded.role,is_active=true,updated_at=now();
 insert into private.admin_audit_logs(actor_id,action,target_user_id,details)
 values(v_actor,'admin.role.assigned',p_user_id,jsonb_build_object('role',p_role,'reason',left(coalesce(p_reason,''),1000)));
end;
$function$;

create or replace function public.admin_set_membership_active(p_user_id uuid,p_is_active boolean,p_reason text default null)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_actor uuid:=auth.uid(); v_role text; v_active_super_count integer;
begin
 if v_actor is null or coalesce((select auth.jwt())->>'aal','')<>'aal2'
 or not exists(select 1 from private.admin_memberships where user_id=v_actor and role='super_admin' and is_active=true)
 then raise exception 'An active super administrator with MFA is required.'; end if;
 select role into v_role from private.admin_memberships where user_id=p_user_id for update;
 if not found then raise exception 'Administrator membership not found.'; end if;
 if v_role='super_admin' and p_is_active=false then
  select count(*) into v_active_super_count from private.admin_memberships where role='super_admin' and is_active=true;
  if v_active_super_count<=1 then raise exception 'The last active super administrator cannot be deactivated.'; end if;
 end if;
 update private.admin_memberships set is_active=p_is_active,updated_at=now() where user_id=p_user_id;
 insert into private.admin_audit_logs(actor_id,action,target_user_id,details)
 values(v_actor,case when p_is_active then 'admin.membership.activated' else 'admin.membership.deactivated' end,
 p_user_id,jsonb_build_object('reason',left(coalesce(p_reason,''),1000)));
end;
$function$;
revoke all on function public.admin_assign_role(uuid,text,text) from public,anon;
revoke all on function public.admin_set_membership_active(uuid,boolean,text) from public,anon;
grant execute on function public.admin_assign_role(uuid,text,text) to authenticated;
grant execute on function public.admin_set_membership_active(uuid,boolean,text) to authenticated;
