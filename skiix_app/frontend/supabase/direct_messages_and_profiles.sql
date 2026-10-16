-- Run in Supabase SQL Editor (Dashboard → SQL) after backups.
-- DMs persisted in Postgres + Supabase Realtime; RLS scoped to sender/receiver.

-- ---------------------------------------------------------------------------
-- Profiles: searchable email → user id for DM threading (normalized at upsert).
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists email_normalized text;

create unique index if not exists profiles_email_normalized_unique
  on public.profiles (email_normalized)
  where email_normalized is not null;

-- Read profile rows for DM headers/inbox lookups (authenticated clients only).
-- Tighten later with a SECURITY DEFINER helper if needed.
drop policy if exists "Profiles: read own" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_signed_in_cross_read" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;

create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Direct messages
-- ---------------------------------------------------------------------------
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  receiver_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint dm_no_self_sent check (sender_id <> receiver_id)
);

create index if not exists direct_messages_sender_receiver_created_idx
  on public.direct_messages (sender_id, receiver_id, created_at desc);

create index if not exists direct_messages_receiver_sender_created_idx
  on public.direct_messages (receiver_id, sender_id, created_at desc);

alter table public.direct_messages enable row level security;

grant select, insert on public.direct_messages to authenticated;

create policy "dm_select_participant"
  on public.direct_messages for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "dm_insert_as_sender"
  on public.direct_messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and sender_id <> receiver_id
  );

-- Realtime: ignore error if already added to publication.
alter publication supabase_realtime add table public.direct_messages;

-- ---------------------------------------------------------------------------
-- Optional RPC (app uses profiles.email_normalized + GET /api/v1/users/resolve-peer).
-- ---------------------------------------------------------------------------
create or replace function public.peer_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id::uuid
  from public.profiles p
  where p.email_normalized = lower(trim(p_email))
  limit 1;
$$;

grant execute on function public.peer_id_by_email(text) to authenticated;
revoke all on function public.peer_id_by_email(text) from public;
