-- Add indexes for all remaining legacy-access foreign keys and remove overlapping
-- permissive SELECT policies without changing the owner/accepted-recipient access model.

create index if not exists legacy_access_grants_recipient_owner_fk_idx
  on public.legacy_access_grants (recipient_id, owner_id);

create index if not exists legacy_access_notifications_recipient_fk_idx
  on public.legacy_access_notifications (recipient_id);

create index if not exists legacy_access_recipients_trusted_owner_fk_idx
  on public.legacy_access_recipients (trusted_contact_id, owner_id);

create index if not exists legacy_access_requests_recipient_owner_fk_idx
  on public.legacy_access_requests (recipient_id, owner_id);

create index if not exists legacy_access_requests_requested_by_fk_idx
  on public.legacy_access_requests (requested_by);

create index if not exists legacy_access_requests_reviewed_by_fk_idx
  on public.legacy_access_requests (reviewed_by);

drop policy if exists "Owners manage their legacy access recipients"
  on public.legacy_access_recipients;

drop policy if exists "Accepted recipients can read their own legacy invitation"
  on public.legacy_access_recipients;

create policy "Owners and accepted recipients can read legacy invitations"
  on public.legacy_access_recipients
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (
      recipient_user_id = (select auth.uid())
      and invitation_status = 'accepted'
    )
  );

create policy "Owners insert their legacy access recipients"
  on public.legacy_access_recipients
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Owners update their legacy access recipients"
  on public.legacy_access_recipients
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners delete their legacy access recipients"
  on public.legacy_access_recipients
  for delete to authenticated
  using (owner_id = (select auth.uid()));
