-- Keep Storage MFA enforcement on the same private helper as public tables.
-- This avoids granting authenticated clients direct access to auth.mfa_factors.
DROP POLICY IF EXISTS "Require MFA assurance for enrolled users" ON storage.objects;

CREATE POLICY "Require MFA assurance for enrolled users"
ON storage.objects
AS RESTRICTIVE
FOR ALL
TO authenticated
USING ((SELECT private.user_meets_mfa_policy()))
WITH CHECK ((SELECT private.user_meets_mfa_policy()));
