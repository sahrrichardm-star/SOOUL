create policy persona_chat_usage_deny_client_access
on private.persona_chat_usage
for all
to anon, authenticated
using (false)
with check (false);