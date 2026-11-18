-- Trigger-only timestamp helper; prevent direct invocation through the Data API.
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- Keep the signup trigger function non-callable through PostgREST.
revoke all on function public.handle_new_user_profile() from public, anon, authenticated;
