alter table public.legacy_access_recipients
  add column if not exists recipient_email text not null default ''
  check (char_length(recipient_email) <= 254);

drop policy if exists "Owners manage selected legacy grants" on public.legacy_access_grants;
create policy "Owners manage selected legacy grants"
on public.legacy_access_grants for all to authenticated
using (owner_id = (select auth.uid()))
with check (
  owner_id = (select auth.uid())
  and (
    (content_type = 'story' and exists (
      select 1 from public.stories s
      where s.id = content_id and s.user_id = (select auth.uid())
    ))
    or
    (content_type = 'legacy_entry' and exists (
      select 1 from public.legacy_entries e
      where e.id = content_id and e.user_id = (select auth.uid())
    ))
    or
    (content_type = 'safekeeping_record' and exists (
      select 1 from public.safekeeping_records r
      where r.id = content_id and r.user_id = (select auth.uid())
    ))
    or
    (content_type = 'asset' and exists (
      select 1 from public.assets a
      where a.id = content_id and a.user_id = (select auth.uid())
    ))
  )
);

drop policy if exists "Accepted recipients can read their own legacy invitation" on public.legacy_access_recipients;
create policy "Accepted recipients can read their own legacy invitation"
on public.legacy_access_recipients
for select to authenticated
using (
  recipient_user_id = (select auth.uid())
  and invitation_status = 'accepted'
);
