alter table private.persona_chat_usage enable row level security;

drop function if exists public.consume_persona_chat_quota();

create or replace function public.consume_persona_chat_quota(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_usage private.persona_chat_usage%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service authorization required' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'User identifier required' using errcode = '22004';
  end if;

  insert into private.persona_chat_usage (
    user_id, window_started_at, window_count, day_started_at, day_count
  ) values (p_user_id, v_now, 0, (v_now at time zone 'UTC')::date, 0)
  on conflict (user_id) do nothing;

  select * into v_usage
  from private.persona_chat_usage
  where user_id = p_user_id
  for update;

  if v_usage.window_started_at > v_now - interval '5 minutes'
     and v_usage.window_count >= 10 then
    return false;
  end if;

  if v_usage.day_started_at = (v_now at time zone 'UTC')::date
     and v_usage.day_count >= 100 then
    return false;
  end if;

  update private.persona_chat_usage
  set
    window_started_at = case
      when v_usage.window_started_at <= v_now - interval '5 minutes' then v_now
      else v_usage.window_started_at
    end,
    window_count = case
      when v_usage.window_started_at <= v_now - interval '5 minutes' then 1
      else v_usage.window_count + 1
    end,
    day_started_at = (v_now at time zone 'UTC')::date,
    day_count = case
      when v_usage.day_started_at <> (v_now at time zone 'UTC')::date then 1
      else v_usage.day_count + 1
    end
  where user_id = p_user_id;

  return true;
end;
$$;

revoke all on function public.consume_persona_chat_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_persona_chat_quota(uuid) to service_role;
