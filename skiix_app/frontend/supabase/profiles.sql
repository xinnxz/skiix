-- Run in Supabase SQL Editor (Dashboard → SQL)
-- Enables profile row per auth user; RLS lets users read/update only their row.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles: insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

-- Optional: enable realtime
-- alter publication supabase_realtime add table public.profiles;

-- Direct messaging (messages table + profile email_normalized + realtime):
-- Run direct_messages_and_profiles.sql in the same SQL editor afterward.
