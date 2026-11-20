create or replace function public.admin_record_audit(
  p_actor_id uuid,
  p_action text,
  p_target_user_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_actor_id is null or not exists (
    select 1 from private.admin_memberships m
    where m.user_id = p_actor_id and m.is_active = true
  ) then
    raise exception 'An active administrator identity is required.';
  end if;
  if p_action is null or char_length(p_action) < 1 or char_length(p_action) > 120 then
    raise exception 'Invalid administrator audit action.';
  end if;
  insert into private.admin_audit_logs(actor_id, action, target_user_id, details)
  values (p_actor_id, p_action, p_target_user_id, coalesce(p_details, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.admin_record_audit(uuid,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.admin_record_audit(uuid,text,uuid,jsonb) to service_role;
comment on function public.admin_record_audit(uuid,text,uuid,jsonb) is
  'Server-only append operation for administrator audit history. Requires an active admin membership.';
