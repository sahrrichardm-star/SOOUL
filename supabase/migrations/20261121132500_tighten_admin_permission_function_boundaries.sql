-- Move role mutation routines out of the public Data API and make permission checks invoker-safe.
create index if not exists admin_role_permissions_permission_key_fk_idx on private.admin_role_permissions(permission_key);
grant usage on schema private to authenticated;
grant select on private.admin_memberships, private.admin_role_permissions to authenticated;
drop policy if exists "Administrator can read own membership" on private.admin_memberships;
create policy "Administrator can read own membership" on private.admin_memberships for select to authenticated using (user_id=(select auth.uid()));
create policy "Administrators can read their assigned permissions" on private.admin_role_permissions for select to authenticated using (
 exists(select 1 from private.admin_memberships m where m.user_id=(select auth.uid()) and m.is_active=true and m.role=admin_role_permissions.role_key)
);
create policy "No direct client access to administrator roles" on private.admin_roles for all to anon,authenticated using(false) with check(false);
create policy "No direct client access to administrator permissions" on private.admin_permissions for all to anon,authenticated using(false) with check(false);
grant select on private.admin_audit_logs to authenticated;
drop policy if exists "No direct client access to administrator audit logs" on private.admin_audit_logs;
create or replace function public.admin_has_permission(p_permission text) returns boolean language sql stable security invoker set search_path=''
as $function$
 select exists(select 1 from private.admin_memberships m join private.admin_role_permissions rp on rp.role_key=m.role
 where m.user_id=(select auth.uid()) and m.is_active=true and rp.permission_key=p_permission);
$function$;
revoke all on function public.admin_has_permission(text) from public,anon;
grant execute on function public.admin_has_permission(text) to authenticated;
revoke all on function public.admin_assign_role(uuid,text,text) from public,anon,authenticated;
revoke all on function public.admin_set_membership_active(uuid,boolean,text) from public,anon,authenticated;
drop function public.admin_assign_role(uuid,text,text);
drop function public.admin_set_membership_active(uuid,boolean,text);
create or replace function private.admin_assign_role(p_actor_id uuid,p_user_id uuid,p_role text,p_reason text default null)
returns void language plpgsql security definer set search_path=''
as $function$
begin
 if p_actor_id is null or not exists(select 1 from private.admin_memberships where user_id=p_actor_id and role='super_admin' and is_active=true) then raise exception 'An active super administrator is required.'; end if;
 if not exists(select 1 from private.admin_roles where role_key=p_role) then raise exception 'Unknown administrator role.'; end if;
 if p_user_id is null or not exists(select 1 from auth.users where id=p_user_id) then raise exception 'The target account does not exist in SOOULL authentication.'; end if;
 insert into private.admin_memberships(user_id,role,is_active,created_by) values(p_user_id,p_role,true,p_actor_id)
 on conflict(user_id) do update set role=excluded.role,is_active=true,updated_at=now();
 insert into private.admin_audit_logs(actor_id,action,target_user_id,details) values(p_actor_id,'admin.role.assigned',p_user_id,jsonb_build_object('role',p_role,'reason',left(coalesce(p_reason,''),1000)));
end;
$function$;
create or replace function private.admin_set_membership_active(p_actor_id uuid,p_user_id uuid,p_is_active boolean,p_reason text default null)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_role text; v_active_super_count integer;
begin
 if p_actor_id is null or not exists(select 1 from private.admin_memberships where user_id=p_actor_id and role='super_admin' and is_active=true) then raise exception 'An active super administrator is required.'; end if;
 select role into v_role from private.admin_memberships where user_id=p_user_id for update;
 if not found then raise exception 'Administrator membership not found.'; end if;
 if v_role='super_admin' and p_is_active=false then
  select count(*) into v_active_super_count from private.admin_memberships where role='super_admin' and is_active=true;
  if v_active_super_count<=1 then raise exception 'The last active super administrator cannot be deactivated.'; end if;
 end if;
 update private.admin_memberships set is_active=p_is_active,updated_at=now() where user_id=p_user_id;
 insert into private.admin_audit_logs(actor_id,action,target_user_id,details) values(p_actor_id,case when p_is_active then 'admin.membership.activated' else 'admin.membership.deactivated' end,p_user_id,jsonb_build_object('reason',left(coalesce(p_reason,''),1000)));
end;
$function$;
revoke all on function private.admin_assign_role(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function private.admin_set_membership_active(uuid,uuid,boolean,text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.admin_assign_role(uuid,uuid,text,text) to service_role;
grant execute on function private.admin_set_membership_active(uuid,uuid,boolean,text) to service_role;
