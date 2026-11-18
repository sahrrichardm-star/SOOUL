create table if not exists public.trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  relationship text not null default '' check (char_length(relationship) <= 80),
  email text not null default '' check (char_length(email) <= 254),
  phone text not null default '' check (phone = '' or phone ~ '^\+[1-9][0-9]{7,14}$'),
  notes text not null default '' check (char_length(notes) <= 2000),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trusted_contacts_user_created_idx on public.trusted_contacts (user_id, created_at desc);
alter table public.trusted_contacts enable row level security;
revoke all on table public.trusted_contacts from public, anon;
grant select, insert, update, delete on table public.trusted_contacts to authenticated;

drop policy if exists "Users manage own trusted contacts" on public.trusted_contacts;
create policy "Users manage own trusted contacts" on public.trusted_contacts
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Require MFA assurance for enrolled users" on public.trusted_contacts;
create policy "Require MFA assurance for enrolled users" on public.trusted_contacts
  as restrictive for all to authenticated
  using (not (select private.user_has_verified_mfa()) or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2')
  with check (not (select private.user_has_verified_mfa()) or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2');

drop trigger if exists set_trusted_contacts_updated_at on public.trusted_contacts;
create trigger set_trusted_contacts_updated_at before update on public.trusted_contacts
  for each row execute function public.set_updated_at();

comment on table public.trusted_contacts is 'Private contact records chosen by an individual SOOULL account. These records do not grant contacts access to the account or its data.';
