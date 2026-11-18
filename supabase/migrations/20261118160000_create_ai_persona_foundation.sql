create table if not exists public.persona_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null default '',
  biography text not null default '',
  response_style text not null default 'warm and thoughtful' check (char_length(response_style) <= 120),
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.persona_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in ('text_persona','voice_processing','voice_replication','likeness_generation')),
  policy_version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.persona_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('story','legacy_entry')),
  source_id uuid not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, source_type, source_id)
);
create table if not exists public.persona_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.persona_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.persona_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) between 1 and 12000),
  source_refs jsonb not null default '[]'::jsonb,
  model_id text,
  created_at timestamptz not null default now()
);
create index if not exists persona_sources_user_enabled_idx on public.persona_sources(user_id, is_enabled);
create index if not exists persona_conversations_user_updated_idx on public.persona_conversations(user_id, updated_at desc);
create index if not exists persona_messages_conversation_created_idx on public.persona_messages(conversation_id, created_at);
alter table public.persona_profiles enable row level security;
alter table public.persona_consents enable row level security;
alter table public.persona_sources enable row level security;
alter table public.persona_conversations enable row level security;
alter table public.persona_messages enable row level security;
drop policy if exists "Users manage own persona profile" on public.persona_profiles;
create policy "Users manage own persona profile" on public.persona_profiles for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "Users manage own persona consents" on public.persona_consents;
create policy "Users manage own persona consents" on public.persona_consents for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "Users manage own persona sources" on public.persona_sources;
create policy "Users manage own persona sources" on public.persona_sources for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "Users manage own persona conversations" on public.persona_conversations;
create policy "Users manage own persona conversations" on public.persona_conversations for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "Users manage own persona messages" on public.persona_messages;
create policy "Users manage own persona messages" on public.persona_messages for all to authenticated using (
  user_id = (select auth.uid()) and exists (select 1 from public.persona_conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))
) with check (
  user_id = (select auth.uid()) and exists (select 1 from public.persona_conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))
);
