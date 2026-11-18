-- Recreate the restrictive MFA policies with scalar SELECT wrappers
-- so auth helper values can be evaluated once per statement.
drop policy if exists "Require MFA assurance for enrolled users" on public.stories;
create policy "Require MFA assurance for enrolled users"
on public.stories
as restrictive
for all
to authenticated
using (
  array[coalesce((select auth.jwt() ->> 'aal'), 'aal1')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
    from auth.mfa_factors
    where user_id = (select auth.uid()) and status = 'verified'
  )
)
with check (
  array[coalesce((select auth.jwt() ->> 'aal'), 'aal1')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
    from auth.mfa_factors
    where user_id = (select auth.uid()) and status = 'verified'
  )
);

drop policy if exists "Require MFA assurance for enrolled users" on public.legacy_entries;
create policy "Require MFA assurance for enrolled users"
on public.legacy_entries
as restrictive
for all
to authenticated
using (
  array[coalesce((select auth.jwt() ->> 'aal'), 'aal1')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
    from auth.mfa_factors
    where user_id = (select auth.uid()) and status = 'verified'
  )
)
with check (
  array[coalesce((select auth.jwt() ->> 'aal'), 'aal1')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
    from auth.mfa_factors
    where user_id = (select auth.uid()) and status = 'verified'
  )
);

drop policy if exists "Require MFA assurance for enrolled users" on public.safekeeping_records;
create policy "Require MFA assurance for enrolled users"
on public.safekeeping_records
as restrictive
for all
to authenticated
using (
  array[coalesce((select auth.jwt() ->> 'aal'), 'aal1')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
    from auth.mfa_factors
    where user_id = (select auth.uid()) and status = 'verified'
  )
)
with check (
  array[coalesce((select auth.jwt() ->> 'aal'), 'aal1')] <@ (
    select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
    from auth.mfa_factors
    where user_id = (select auth.uid()) and status = 'verified'
  )
);
