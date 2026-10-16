-- Run in Supabase SQL Editor: repair usernames that were saved as emails.
-- Safe to run multiple times.

UPDATE users
SET username = CONCAT(
    REGEXP_REPLACE(
        LOWER(SPLIT_PART(username, '@', 1)),
        '[^a-z0-9_]', '', 'g'
    ),
    SUBSTRING(id::text, 1, 4)
)
WHERE username LIKE '%@%'
   OR username ~* '\.(com|org|net|edu)$'
   OR LENGTH(username) > 30;

UPDATE users
SET username = CONCAT(
    REGEXP_REPLACE(
        LOWER(SPLIT_PART(email, '@', 1)),
        '[^a-z0-9_]', '', 'g'
    ),
    SUBSTRING(id::text, 1, 4)
)
WHERE username IS NULL
   OR TRIM(username) = '';

-- SELECT id, email, username, display_name FROM users ORDER BY created_at DESC LIMIT 20;
