-- Keep only the existing owner-only SELECT policy on administrator memberships.
drop policy if exists "Administrator can read own membership" on private.admin_memberships;
