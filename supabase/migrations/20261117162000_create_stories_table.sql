create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  content text not null default '',
  category text not null default 'life'
    check (category in ('life', 'family', 'milestones', 'lessons', 'other')),
  story_date date,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stories_user_created_idx
  on public.stories (user_id, created_at desc);
create index if not exists stories_user_favorites_idx
  on public.stories (user_id, is_favorite)
  where is_favorite = true;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_stories_updated_at on public.stories;
create trigger set_stories_updated_at
before update on public.stories
for each row execute function public.set_updated_at();

alter table public.stories enable row level security;

drop policy if exists "Users can read their own stories" on public.stories;
create policy "Users can read their own stories"
on public.stories for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own stories" on public.stories;
create policy "Users can create their own stories"
on public.stories for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own stories" on public.stories;
create policy "Users can update their own stories"
on public.stories for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own stories" on public.stories;
create policy "Users can delete their own stories"
on public.stories for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.stories to authenticated;
comment on table public.stories is 'Private life stories owned by individual SOOULL accounts. Access is restricted by row-level security.';