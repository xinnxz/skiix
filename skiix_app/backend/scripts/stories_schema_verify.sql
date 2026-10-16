-- Optional: run in Supabase SQL Editor if story columns are missing.
ALTER TABLE stories ADD COLUMN IF NOT EXISTS media_type text DEFAULT 'image';
ALTER TABLE stories ADD COLUMN IF NOT EXISTS caption text;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS hashtags text;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS audience text DEFAULT 'everyone';
ALTER TABLE stories ADD COLUMN IF NOT EXISTS allow_replies text DEFAULT 'everyone';
ALTER TABLE stories ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '24 hours');

CREATE INDEX IF NOT EXISTS idx_stories_user_expires
  ON stories(author_email, expires_at DESC);
