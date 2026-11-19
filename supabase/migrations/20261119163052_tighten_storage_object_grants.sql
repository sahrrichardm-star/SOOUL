-- Keep authenticated Storage clients limited to the DML operations used by
-- the private-assets bucket. Storage-owned grants are managed by Supabase.
REVOKE ALL PRIVILEGES ON TABLE storage.objects FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE storage.objects TO authenticated;
