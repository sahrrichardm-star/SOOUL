-- Server-only aggregate metrics for the SOOULL administrator dashboard.
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
    'trusted_people_records', (select count(*) from public.trusted_contacts)
  );
$$;

revoke all on function public.admin_metrics() from public, anon, authenticated;
grant execute on function public.admin_metrics() to service_role;
comment on function public.admin_metrics() is
  'Returns aggregate SOOULL platform metrics. Callable only by the server service role; no customer content is returned.';
