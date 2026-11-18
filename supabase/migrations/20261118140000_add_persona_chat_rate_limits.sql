create table if not exists private.persona_chat_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  window_count integer not null default 0 check (window_count >= 0),
  day_started_at date not null default current_date,
  day_count integer not null default 0 check (day_count >= 0)
);

revoke all on table private.persona_chat_usage from public, anon, authenticated;

create or replace function public.consume_persona_chat_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_usage private.persona_chat_usage%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  insert into private.persona_chat_usage (
    user_id, window_started_at, window_count, day_started_at, day_count
  ) values (v_uid, v_now, 0, (v_now at time zone 'UTC')::date, 0)
  on conflict (user_id) do nothing;

  select * into v_usage
  from private.persona_chat_usage
  where user_id = v_uid
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
  where user_id = v_uid;

  return true;
end;
$$;

revoke all on function public.consume_persona_chat_quota() from public, anon;
grant execute on function public.consume_persona_chat_quota() to authenticated;

comment on table private.persona_chat_usage is
  'Private server-enforced per-user AI Legacy request counters; inaccessible through the client Data API.';
