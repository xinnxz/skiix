-- Inbox enhancements (run in Supabase SQL Editor)
ALTER TABLE conversation_participants
  ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;

ALTER TABLE conversation_participants
  ADD COLUMN IF NOT EXISTS is_muted boolean DEFAULT false;
