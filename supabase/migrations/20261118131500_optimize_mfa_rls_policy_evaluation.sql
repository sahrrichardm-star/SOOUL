create or replace function private.user_meets_mfa_policy()
returns boolean language sql stable security definer set search_path = ''
as $function$
  select not private.user_has_verified_mfa()
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2';
$function$;

revoke all on function private.user_meets_mfa_policy() from public, anon, authenticated;
grant execute on function private.user_meets_mfa_policy() to authenticated;

drop policy if exists "Require MFA assurance for enrolled users" on public.assets;
create policy "Require MFA assurance for enrolled users" on public.assets as restrictive for all to authenticated using ((select private.user_meets_mfa_policy())) with check ((select private.user_meets_mfa_policy()));
drop policy if exists "Require MFA assurance for enrolled users" on public.legacy_entries;
create policy "Require MFA assurance for enrolled users" on public.legacy_entries as restrictive for all to authenticated using ((select private.user_meets_mfa_policy())) with check ((select private.user_meets_mfa_policy()));
drop policy if exists "Require MFA assurance for enrolled users" on public.persona_consents;
create policy "Require MFA assurance for enrolled users" on public.persona_consents as restrictive for all to authenticated using ((select private.user_meets_mfa_policy())) with check ((select private.user_meets_mfa_policy()));
drop policy if exists "Require MFA assurance for enrolled users" on public.persona_conversations;
create policy "Require MFA assurance for enrolled users" on public.persona_conversations as restrictive for all to authenticated using ((select private.user_meets_mfa_policy())) with check ((select private.user_meets_mfa_policy()));
drop policy if exists "Require MFA assurance for enrolled users" on public.persona_messages;
create policy "Require MFA assurance for enrolled users" on public.persona_messages as restrictive for all to authenticated using ((select private.user_meets_mfa_policy())) with check ((select private.user_meets_mfa_policy()));
drop policy if exists "Require MFA assurance for enrolled users" on public.persona_profiles;
create policy "Require MFA assurance for enrolled users" on public.persona_profiles as restrictive for all to authenticated using ((select private.user_meets_mfa_policy())) with check ((select private.user_meets_mfa_policy()));
drop policy if exists "Require MFA assurance for enrolled users" on public.persona_sources;
create policy "Require MFA assurance for enrolled users" on public.persona_sources as restrictive for all to authenticated using ((select private.user_meets_mfa_policy())) with check ((select private.user_meets_mfa_policy()));
drop policy if exists "Require MFA assurance for enrolled users" on public.profiles;
create policy "Require MFA assurance for enrolled users" on public.profiles as restrictive for all to authenticated using ((select private.user_meets_mfa_policy())) with check ((select private.user_meets_mfa_policy()));
drop policy if exists "Require MFA assurance for enrolled users" on public.safekeeping_records;
create policy "Require MFA assurance for enrolled users" on public.safekeeping_records as restrictive for all to authenticated using ((select private.user_meets_mfa_policy())) with check ((select private.user_meets_mfa_policy()));
drop policy if exists "Require MFA assurance for enrolled users" on public.stories;
create policy "Require MFA assurance for enrolled users" on public.stories as restrictive for all to authenticated using ((select private.user_meets_mfa_policy())) with check ((select private.user_meets_mfa_policy()));
drop policy if exists "Require MFA assurance for enrolled users" on public.wallet_records;
create policy "Require MFA assurance for enrolled users" on public.wallet_records as restrictive for all to authenticated using ((select private.user_meets_mfa_policy())) with check ((select private.user_meets_mfa_policy()));
drop policy if exists "Require MFA assurance for enrolled users" on public.trusted_contacts;
create policy "Require MFA assurance for enrolled users" on public.trusted_contacts as restrictive for all to authenticated using ((select private.user_meets_mfa_policy())) with check ((select private.user_meets_mfa_policy()));
