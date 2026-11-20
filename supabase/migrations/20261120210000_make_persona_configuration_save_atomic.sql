create or replace function public.save_persona_configuration(
  p_display_name text,
  p_biography text,
  p_response_style text,
  p_sources jsonb,
  p_consent boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_source_count integer := 0;
  v_enabled boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;
  if char_length(btrim(coalesce(p_display_name, ''))) < 1
     or char_length(p_display_name) > 100 then
    raise exception 'Enter a persona name of 1 to 100 characters.';
  end if;
  if char_length(coalesce(p_biography, '')) > 4000 then
    raise exception 'The persona biography must be 4,000 characters or fewer.';
  end if;
  if coalesce(p_response_style, '') not in (
    'warm and thoughtful','direct and practical',
    'gentle and encouraging','formal and reflective'
  ) then
    raise exception 'Choose a supported response style.';
  end if;
  if p_sources is null or jsonb_typeof(p_sources) <> 'array' then
    raise exception 'Approved sources must be supplied as a list.';
  end if;
  if jsonb_array_length(p_sources) > 20 then
    raise exception 'Select no more than 20 approved source entries.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_sources) as item(value)
    where jsonb_typeof(item.value) <> 'object'
       or item.value->>'source_type' not in ('story','legacy_entry')
       or coalesce(item.value->>'source_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    raise exception 'One or more approved source entries are invalid.';
  end if;

  select count(*) into v_source_count
  from jsonb_to_recordset(p_sources) as source_item(source_type text, source_id uuid);

  if v_source_count <> (
    select count(distinct source_item.source_type || ':' || source_item.source_id::text)
    from jsonb_to_recordset(p_sources) as source_item(source_type text, source_id uuid)
  ) then
    raise exception 'The approved source list contains duplicates.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_sources) as source_item(source_type text, source_id uuid)
    where not (
      (source_item.source_type = 'story' and exists (
        select 1 from public.stories as story
        where story.id = source_item.source_id and story.user_id = v_user_id
      ))
      or
      (source_item.source_type = 'legacy_entry' and exists (
        select 1 from public.legacy_entries as entry
        where entry.id = source_item.source_id and entry.user_id = v_user_id
      ))
    )
  ) then
    raise exception 'An approved source does not belong to this account.';
  end if;

  v_enabled := coalesce(p_consent, false) and v_source_count > 0;

  insert into public.persona_profiles (
    user_id, display_name, biography, response_style, is_enabled, updated_at
  ) values (
    v_user_id, btrim(p_display_name), coalesce(p_biography, ''),
    p_response_style, v_enabled, now()
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    biography = excluded.biography,
    response_style = excluded.response_style,
    is_enabled = excluded.is_enabled,
    updated_at = now();

  delete from public.persona_sources where user_id = v_user_id;

  insert into public.persona_sources (user_id, source_type, source_id, is_enabled)
  select v_user_id, source_item.source_type, source_item.source_id, true
  from jsonb_to_recordset(p_sources) as source_item(source_type text, source_id uuid);

  if v_enabled then
    insert into public.persona_consents (user_id, consent_type, policy_version)
    select v_user_id, 'text_persona', '2026-11-20'
    where not exists (
      select 1 from public.persona_consents as consent
      where consent.user_id = v_user_id
        and consent.consent_type = 'text_persona'
        and consent.revoked_at is null
    );
  else
    update public.persona_consents
    set revoked_at = now()
    where user_id = v_user_id
      and consent_type = 'text_persona'
      and revoked_at is null;
  end if;

  return jsonb_build_object(
    'enabled', v_enabled,
    'sources_saved', v_source_count,
    'profile_saved', true
  );
end;
$$;

revoke all on function public.save_persona_configuration(text,text,text,jsonb,boolean) from public, anon;
grant execute on function public.save_persona_configuration(text,text,text,jsonb,boolean) to authenticated;
comment on function public.save_persona_configuration(text,text,text,jsonb,boolean) is
  'Atomically saves a user-owned AI Legacy persona profile, selected owned source entries and text-processing consent under the caller''s RLS and MFA policies.';
