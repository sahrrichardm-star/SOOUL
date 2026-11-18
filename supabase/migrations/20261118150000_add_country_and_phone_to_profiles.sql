-- Extend private profiles with country of residence and an international phone number.
alter table public.profiles
  add column if not exists country text not null default '',
  add column if not exists phone text not null default '';

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id, first_name, middle_name, last_name, residential_address,
    country, phone, date_of_birth
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'middle_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.raw_user_meta_data ->> 'residential_address', ''),
    coalesce(new.raw_user_meta_data ->> 'country', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'date_of_birth', '')::date
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

update public.profiles p
set
  country = case when p.country = '' then coalesce(u.raw_user_meta_data ->> 'country', '') else p.country end,
  phone = case when p.phone = '' then coalesce(regexp_replace(u.raw_user_meta_data ->> 'phone', '[^0-9+]', '', 'g'), '') else p.phone end,
  updated_at = now()
from auth.users u
where u.id = p.id
  and (p.country = '' or p.phone = '');
