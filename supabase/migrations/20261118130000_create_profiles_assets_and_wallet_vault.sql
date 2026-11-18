-- SOOULL private profile, asset library and wallet records.
-- The private-assets bucket is private and every object is scoped to its owner's UUID folder.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  middle_name text not null default '',
  last_name text not null default '',
  residential_address text not null default '',
  date_of_birth date,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create or replace function public.handle_new_user_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, middle_name, last_name, residential_address, date_of_birth)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'first_name', ''), coalesce(new.raw_user_meta_data ->> 'middle_name', ''), coalesce(new.raw_user_meta_data ->> 'last_name', ''), coalesce(new.raw_user_meta_data ->> 'residential_address', ''), nullif(new.raw_user_meta_data ->> 'date_of_birth', '')::date)
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute procedure public.handle_new_user_profile();

insert into public.profiles (id, first_name, middle_name, last_name, residential_address, date_of_birth)
select u.id, coalesce(u.raw_user_meta_data ->> 'first_name', ''), coalesce(u.raw_user_meta_data ->> 'middle_name', ''), coalesce(u.raw_user_meta_data ->> 'last_name', ''), coalesce(u.raw_user_meta_data ->> 'residential_address', ''), nullif(u.raw_user_meta_data ->> 'date_of_birth', '')::date
from auth.users u on conflict (id) do nothing;

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  asset_type text not null check (asset_type in ('photo','document','audio','video','other')),
  storage_path text not null unique,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  created_at timestamptz not null default now()
);
create index if not exists assets_user_created_idx on public.assets (user_id, created_at desc);
alter table public.assets enable row level security;
drop policy if exists "Users manage own assets" on public.assets;
create policy "Users manage own assets" on public.assets for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.wallet_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  record_type text not null check (record_type in ('bank_account_reference','payment_method_reference','bank_statement','investment','loan','tax','other')),
  institution text not null default '',
  account_label text not null default '',
  account_last_four text not null default '',
  notes text not null default '',
  asset_id uuid references public.assets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_last_four_digits check (account_last_four = '' or account_last_four ~ '^[0-9]{4}$')
);
create index if not exists wallet_records_user_created_idx on public.wallet_records (user_id, created_at desc);
alter table public.wallet_records enable row level security;
drop policy if exists "Users manage own wallet records" on public.wallet_records;
create policy "Users manage own wallet records" on public.wallet_records for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-assets','private-assets',false,104857600,array['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','audio/mpeg','audio/mp4','audio/wav','audio/webm','audio/ogg','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public=false, file_size_limit=104857600, allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Users upload own private assets" on storage.objects;
create policy "Users upload own private assets" on storage.objects for insert to authenticated with check (bucket_id='private-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Users read own private assets" on storage.objects;
create policy "Users read own private assets" on storage.objects for select to authenticated using (bucket_id='private-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Users update own private assets" on storage.objects;
create policy "Users update own private assets" on storage.objects for update to authenticated using (bucket_id='private-assets' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='private-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Users delete own private assets" on storage.objects;
create policy "Users delete own private assets" on storage.objects for delete to authenticated using (bucket_id='private-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
