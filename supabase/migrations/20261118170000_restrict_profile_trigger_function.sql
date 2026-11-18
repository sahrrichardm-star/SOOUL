-- The profile creation function is invoked by the auth.users trigger only.
-- It must not be callable through the exposed PostgREST RPC surface.
revoke all on function public.handle_new_user_profile() from public, anon, authenticated;
