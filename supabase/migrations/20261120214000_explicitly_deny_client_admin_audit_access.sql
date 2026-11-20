drop policy if exists "No direct client access to administrator audit logs" on private.admin_audit_logs;
create policy "No direct client access to administrator audit logs"
on private.admin_audit_logs
for all
to anon, authenticated
using (false)
with check (false);
