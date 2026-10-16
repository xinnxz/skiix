-- Optional DM enhancements (run in Supabase SQL Editor after direct_messages_and_profiles.sql).
-- App currently uses direct_messages; extend for media / presence when you wire those features.

alter table public.direct_messages
  add column if not exists message_type text default 'text';

alter table public.direct_messages
  add column if not exists media_url text;

alter table public.direct_messages
  add column if not exists is_edited boolean default false;

alter table public.direct_messages
  add column if not exists is_deleted boolean default false;

create table if not exists public.user_presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  is_online boolean default false,
  last_seen_at timestamptz default now()
);

alter table public.user_presence enable row level security;

create policy "presence_select_authenticated"
  on public.user_presence for select to authenticated using (true);

create policy "presence_upsert_own"
  on public.user_presence for insert to authenticated
  with check (auth.uid() = user_id);

create policy "presence_update_own"
  on public.user_presence for update to authenticated
  using (auth.uid() = user_id);

alter table public.user_presence replica identity full;

-- Realtime (ignore errors if already added)
alter publication supabase_realtime add table public.user_presence;
