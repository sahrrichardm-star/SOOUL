do $$
declare tbl text;
begin
  foreach tbl in array array['persona_profiles','persona_consents','persona_sources','persona_conversations','persona_messages'] loop
    execute format('drop policy if exists "Require MFA assurance for enrolled users" on public.%I', tbl);
    execute format(
      'create policy "Require MFA assurance for enrolled users" on public.%I as restrictive for all to authenticated using (array[coalesce((select auth.jwt() ->> ''aal''), ''aal1'')] <@ (select case when count(id) > 0 then array[''aal2''] else array[''aal1'', ''aal2''] end from auth.mfa_factors where user_id = (select auth.uid()) and status = ''verified'')) with check (array[coalesce((select auth.jwt() ->> ''aal''), ''aal1'')] <@ (select case when count(id) > 0 then array[''aal2''] else array[''aal1'', ''aal2''] end from auth.mfa_factors where user_id = (select auth.uid()) and status = ''verified''))',
      tbl
    );
  end loop;
end $$;
