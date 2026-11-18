-- Read MFA enrollment state through a tightly scoped helper.
-- auth.mfa_factors has RLS enabled and intentionally grants no direct table access.
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.user_has_verified_mfa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from auth.mfa_factors as factor
    where factor.user_id = (select auth.uid())
      and factor.status = 'verified'::auth.factor_status
  );
$function$;

revoke all on function private.user_has_verified_mfa() from public, anon, authenticated;
grant execute on function private.user_has_verified_mfa() to authenticated;

-- Require AAL2 only for users who have a verified MFA factor.
-- The helper checks only the caller's own auth.uid() and exposes no factor data.
drop policy if exists "Require MFA assurance for enrolled users" on public.assets;
create policy "Require MFA assurance for enrolled users" on public.assets
  as restrictive for all to authenticated
  using (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  )
  with check (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  );

drop policy if exists "Require MFA assurance for enrolled users" on public.legacy_entries;
create policy "Require MFA assurance for enrolled users" on public.legacy_entries
  as restrictive for all to authenticated
  using (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  )
  with check (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  );

drop policy if exists "Require MFA assurance for enrolled users" on public.persona_consents;
create policy "Require MFA assurance for enrolled users" on public.persona_consents
  as restrictive for all to authenticated
  using (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  )
  with check (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  );

drop policy if exists "Require MFA assurance for enrolled users" on public.persona_conversations;
create policy "Require MFA assurance for enrolled users" on public.persona_conversations
  as restrictive for all to authenticated
  using (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  )
  with check (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  );

drop policy if exists "Require MFA assurance for enrolled users" on public.persona_messages;
create policy "Require MFA assurance for enrolled users" on public.persona_messages
  as restrictive for all to authenticated
  using (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  )
  with check (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  );

drop policy if exists "Require MFA assurance for enrolled users" on public.persona_profiles;
create policy "Require MFA assurance for enrolled users" on public.persona_profiles
  as restrictive for all to authenticated
  using (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  )
  with check (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  );

drop policy if exists "Require MFA assurance for enrolled users" on public.persona_sources;
create policy "Require MFA assurance for enrolled users" on public.persona_sources
  as restrictive for all to authenticated
  using (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  )
  with check (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  );

drop policy if exists "Require MFA assurance for enrolled users" on public.profiles;
create policy "Require MFA assurance for enrolled users" on public.profiles
  as restrictive for all to authenticated
  using (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  )
  with check (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  );

drop policy if exists "Require MFA assurance for enrolled users" on public.safekeeping_records;
create policy "Require MFA assurance for enrolled users" on public.safekeeping_records
  as restrictive for all to authenticated
  using (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  )
  with check (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  );

drop policy if exists "Require MFA assurance for enrolled users" on public.stories;
create policy "Require MFA assurance for enrolled users" on public.stories
  as restrictive for all to authenticated
  using (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  )
  with check (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  );

drop policy if exists "Require MFA assurance for enrolled users" on public.wallet_records;
create policy "Require MFA assurance for enrolled users" on public.wallet_records
  as restrictive for all to authenticated
  using (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  )
  with check (
    not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
  );
