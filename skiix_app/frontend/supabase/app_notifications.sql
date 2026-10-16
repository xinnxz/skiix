-- In-app notifications (collaboration / connection invites). Run in Supabase SQL Editor.
-- Works with the Go API connection flow: client inserts after a successful /connections/request.

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'connection_request',
  connection_id text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists app_notifications_user_connection_uidx
  on public.app_notifications (user_id, connection_id);

create index if not exists app_notifications_user_created_idx
  on public.app_notifications (user_id, created_at desc);

alter table public.app_notifications enable row level security;

grant select, insert, update, delete on public.app_notifications to authenticated;

create policy "app_notifications_select_own"
  on public.app_notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "app_notifications_update_own"
  on public.app_notifications for update
  to authenticated
  using (auth.uid() = user_id);

create policy "app_notifications_delete_own"
  on public.app_notifications for delete
  to authenticated
  using (auth.uid() = user_id);

-- Sender creates a row for the recipient (anti-spoof: actor must be current user).
create policy "app_notifications_insert_as_actor"
  on public.app_notifications for insert
  to authenticated
  with check (
    auth.uid() = actor_user_id
    and user_id <> auth.uid()
  );

-- Realtime (ignore error if already added).
alter publication supabase_realtime add table public.app_notifications;
