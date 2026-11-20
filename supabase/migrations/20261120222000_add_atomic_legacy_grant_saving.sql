create or replace function public.save_legacy_access_grants(
  p_recipient_id uuid,
  p_grants jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_count integer := 0;
begin
  if v_owner_id is null then
    raise exception 'Authentication is required.';
  end if;
  if p_grants is null or jsonb_typeof(p_grants) <> 'array' then
    raise exception 'Selected content must be supplied as a list.';
  end if;
  if jsonb_array_length(p_grants) > 100 then
    raise exception 'Select no more than 100 individual items per trusted person.';
  end if;
  if not exists (
    select 1 from public.legacy_access_recipients r
    where r.id = p_recipient_id and r.owner_id = v_owner_id
  ) then
    raise exception 'This trusted person is not linked to your account.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_grants) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or item.value->>'content_type' not in ('story','legacy_entry','safekeeping_record','asset')
      or coalesce(item.value->>'content_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    raise exception 'One or more selected content items are invalid.';
  end if;

  select count(*) into v_count
  from jsonb_to_recordset(p_grants) as grant_item(content_type text, content_id uuid);

  if v_count <> (
    select count(distinct grant_item.content_type || ':' || grant_item.content_id::text)
    from jsonb_to_recordset(p_grants) as grant_item(content_type text, content_id uuid)
  ) then
    raise exception 'The selected content list contains duplicates.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_grants) as grant_item(content_type text, content_id uuid)
    where not (
      (grant_item.content_type = 'story' and exists (
        select 1 from public.stories s where s.id = grant_item.content_id and s.user_id = v_owner_id
      ))
      or (grant_item.content_type = 'legacy_entry' and exists (
        select 1 from public.legacy_entries e where e.id = grant_item.content_id and e.user_id = v_owner_id
      ))
      or (grant_item.content_type = 'safekeeping_record' and exists (
        select 1 from public.safekeeping_records r where r.id = grant_item.content_id and r.user_id = v_owner_id
      ))
      or (grant_item.content_type = 'asset' and exists (
        select 1 from public.assets a where a.id = grant_item.content_id and a.user_id = v_owner_id
      ))
    )
  ) then
    raise exception 'You can only grant access to content owned by your account.';
  end if;

  delete from public.legacy_access_grants
  where owner_id = v_owner_id and recipient_id = p_recipient_id;

  insert into public.legacy_access_grants(owner_id, recipient_id, content_type, content_id)
  select v_owner_id, p_recipient_id, grant_item.content_type, grant_item.content_id
  from jsonb_to_recordset(p_grants) as grant_item(content_type text, content_id uuid);

  return v_count;
end;
$$;
revoke all on function public.save_legacy_access_grants(uuid,jsonb) from public, anon;
grant execute on function public.save_legacy_access_grants(uuid,jsonb) to authenticated;
comment on function public.save_legacy_access_grants(uuid,jsonb) is
  'Atomically replaces a trusted person''s selected item grants after verifying every item belongs to the calling account.';
