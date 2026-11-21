-- Keep the single owner-only SELECT policy already present on admin memberships.
drop policy if exists "Administrator can read own membership" on private.admin_memberships;
