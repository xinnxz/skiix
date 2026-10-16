package migration

import (
	"database/sql"
	"fmt"
	"log"
)

// RunMigrations executes all database migrations
func RunMigrations(db *sql.DB) error {
	createUsersTable := `
	CREATE TABLE IF NOT EXISTS users (
		id VARCHAR(36) PRIMARY KEY,
		email VARCHAR(254) UNIQUE NOT NULL,
		password VARCHAR(255),
		provider VARCHAR(50),
		created_at TIMESTAMP NOT NULL,
		updated_at TIMESTAMP NOT NULL
	);
	`

	_, err := db.Exec(createUsersTable)
	if err != nil {
		return fmt.Errorf("failed to create users table: %w", err)
	}

	// Devices: stores user FCM tokens for push notifications
	createUserDevices := `
	CREATE TABLE IF NOT EXISTS user_devices (
		id VARCHAR(36) PRIMARY KEY,
		user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		fcm_token VARCHAR(255) UNIQUE NOT NULL,
		device_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
		created_at TIMESTAMP NOT NULL,
		updated_at TIMESTAMP NOT NULL,
		CONSTRAINT uq_user_fcm_token UNIQUE (user_id, fcm_token)
	);
	`
	if _, err = db.Exec(createUserDevices); err != nil {
		return fmt.Errorf("failed to create user_devices table: %w", err)
	}

	// Focus Mode: settings table (1:1 with users)
	createFocusModeSettings := `
	CREATE TABLE IF NOT EXISTS focus_mode_settings (
		id VARCHAR(36) PRIMARY KEY,
		user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
		created_at TIMESTAMP NOT NULL,
		updated_at TIMESTAMP NOT NULL,
		CONSTRAINT uq_focus_mode_user UNIQUE (user_id)
	);
	`

	_, err = db.Exec(createFocusModeSettings)
	if err != nil {
		return fmt.Errorf("failed to create focus_mode_settings table: %w", err)
	}

	// Focus Mode: blocked categories table (1:N with users)
	createFocusModeCategories := `
	CREATE TABLE IF NOT EXISTS focus_mode_blocked_categories (
		id VARCHAR(36) PRIMARY KEY,
		user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		category_name VARCHAR(100) NOT NULL,
		created_at TIMESTAMP NOT NULL,
		CONSTRAINT uq_user_category UNIQUE (user_id, category_name)
	);
	`

	_, err = db.Exec(createFocusModeCategories)
	if err != nil {
		return fmt.Errorf("failed to create focus_mode_blocked_categories table: %w", err)
	}

	// Create indexes for fast lookups
	indexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_focus_settings_user ON focus_mode_settings(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_focus_blocked_user ON focus_mode_blocked_categories(user_id)`,
	}

	for _, idx := range indexes {
		if _, err := db.Exec(idx); err != nil {
			return fmt.Errorf("failed to create index: %w", err)
		}
	}

	// ============================
	// Circles
	// ============================
	createCircles := `
	CREATE TABLE IF NOT EXISTS circles (
		id              VARCHAR(36) PRIMARY KEY,
		owner_id        VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		name            VARCHAR(50) NOT NULL,
		description     VARCHAR(255),
		avatar_url      TEXT,
		member_count    INTEGER NOT NULL DEFAULT 1,
		created_at      TIMESTAMP NOT NULL,
		updated_at      TIMESTAMP NOT NULL,
		CONSTRAINT chk_circle_name_not_empty CHECK (char_length(name) >= 1)
	);
	`
	if _, err = db.Exec(createCircles); err != nil {
		return fmt.Errorf("failed to create circles table: %w", err)
	}

	// ============================
	// Circle Members (Junction)
	// ============================
	createCircleMembers := `
	CREATE TABLE IF NOT EXISTS circle_members (
		id          VARCHAR(36) PRIMARY KEY,
		circle_id   VARCHAR(36) NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
		user_id     VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		role        VARCHAR(20) NOT NULL DEFAULT 'member',
		joined_at   TIMESTAMP NOT NULL,
		CONSTRAINT uq_circle_member UNIQUE (circle_id, user_id),
		CONSTRAINT chk_member_role CHECK (role IN ('owner', 'member'))
	);
	`
	if _, err = db.Exec(createCircleMembers); err != nil {
		return fmt.Errorf("failed to create circle_members table: %w", err)
	}

	// ============================
	// Posts: main posts table (updated with visibility and circle_id)
	// ============================
	createPosts := `
	CREATE TABLE IF NOT EXISTS posts (
		id            VARCHAR(36) PRIMARY KEY,
		user_id       VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		content       TEXT,
		image_url     TEXT,
		visibility    VARCHAR(10) NOT NULL DEFAULT 'public',
		circle_id     VARCHAR(36) REFERENCES circles(id) ON DELETE SET NULL,
		like_count    INT NOT NULL DEFAULT 0,
		comment_count INT NOT NULL DEFAULT 0,
		created_at    TIMESTAMP NOT NULL,
		updated_at    TIMESTAMP NOT NULL,
		CONSTRAINT chk_visibility CHECK (visibility IN ('public', 'circle')),
		CONSTRAINT chk_circle_visibility_integrity CHECK (
			(visibility = 'circle' AND circle_id IS NOT NULL) OR
			(visibility = 'public' AND circle_id IS NULL)
		)
	);
	`
	if _, err = db.Exec(createPosts); err != nil {
		return fmt.Errorf("failed to create posts table: %w", err)
	}

	// Posts: category tags (junction table — supports multi-category per post)
	createPostCategories := `
	CREATE TABLE IF NOT EXISTS post_categories (
		id            VARCHAR(36) PRIMARY KEY,
		post_id       VARCHAR(36) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
		category_name VARCHAR(100) NOT NULL,
		created_at    TIMESTAMP NOT NULL,
		CONSTRAINT uq_post_category UNIQUE (post_id, category_name)
	);
	`
	if _, err = db.Exec(createPostCategories); err != nil {
		return fmt.Errorf("failed to create post_categories table: %w", err)
	}

	// Posts: likes (each user can like a post once)
	createPostLikes := `
	CREATE TABLE IF NOT EXISTS post_likes (
		id         VARCHAR(36) PRIMARY KEY,
		user_id    VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		post_id    VARCHAR(36) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
		created_at TIMESTAMP NOT NULL,
		CONSTRAINT uq_user_post_like UNIQUE (user_id, post_id)
	);
	`
	if _, err = db.Exec(createPostLikes); err != nil {
		return fmt.Errorf("failed to create post_likes table: %w", err)
	}

	// Comments: per post
	createComments := `
	CREATE TABLE IF NOT EXISTS comments (
		id         VARCHAR(36) PRIMARY KEY,
		post_id    VARCHAR(36) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
		user_id    VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		content    TEXT NOT NULL,
		created_at TIMESTAMP NOT NULL,
		updated_at TIMESTAMP NOT NULL,
		CONSTRAINT chk_comment_not_empty CHECK (char_length(content) >= 1)
	);
	`
	if _, err = db.Exec(createComments); err != nil {
		return fmt.Errorf("failed to create comments table: %w", err)
	}

	// Indexes for posts module
	postIndexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_circles_owner ON circles(owner_id)`,
		`CREATE INDEX IF NOT EXISTS idx_circle_members_circle ON circle_members(circle_id)`,
		`CREATE INDEX IF NOT EXISTS idx_circle_members_user ON circle_members(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_posts_circle_id ON posts(circle_id)`,
		`CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts(visibility, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_post_categories_post_id ON post_categories(post_id)`,
		`CREATE INDEX IF NOT EXISTS idx_post_categories_name ON post_categories(category_name)`,
		`CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id)`,
		`CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id, created_at)`,
	}

	for _, idx := range postIndexes {
		if _, err := db.Exec(idx); err != nil {
			return fmt.Errorf("failed to create post index: %w", err)
		}
	}

	postAlters := []string{
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_project BOOLEAN NOT NULL DEFAULT FALSE`,
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS project_id VARCHAR(36)`,
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS type VARCHAR(16) NOT NULL DEFAULT 'text'`,
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_url TEXT`,
		// Explore screen support: category label, short uppercase title, and
		// aspect ratio so the masonry grid can size cards naturally without
		// downloading the image first.
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general'`,
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS explore_title TEXT`,
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS aspect_width DOUBLE PRECISION`,
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS aspect_height DOUBLE PRECISION`,
		// Reels: thumbnail (poster), Cloudinary asset id, duration in seconds, and
		// a hashtag array for tag search / filtering.
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS thumbnail_url TEXT`,
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT`,
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS video_duration DOUBLE PRECISION NOT NULL DEFAULT 0`,
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'`,
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS location TEXT`,
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS audience TEXT DEFAULT 'everyone'`,
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS listed_in_feed BOOLEAN NOT NULL DEFAULT TRUE`,
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS listed_on_profile BOOLEAN NOT NULL DEFAULT TRUE`,
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS extra_media_urls TEXT[] NOT NULL DEFAULT '{}'`,
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_new_project BOOLEAN NOT NULL DEFAULT FALSE`,
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS metrics TEXT`,
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS milestone_type TEXT`,
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS project_name TEXT`,
	}
	for _, q := range postAlters {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("failed to alter posts (is_project/project_id): %w", err)
		}
	}

	// Explore indexes — keep partial on media_url so they only cover rows the
	// explore grid can render. Created here (and not inline above) because the
	// columns must exist first when the migration runs on an existing DB.
	exploreIndexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_posts_category_created_at ON posts(category, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_posts_media_present_created_at ON posts(created_at DESC) WHERE media_url IS NOT NULL AND media_url <> ''`,
		// Reels-only partial index: the feed scans this exclusively, so a
		// targeted index avoids a full posts scan on every page.
		`CREATE INDEX IF NOT EXISTS idx_posts_type_reel ON posts(created_at DESC) WHERE type = 'reel'`,
	}
	for _, idx := range exploreIndexes {
		if _, err := db.Exec(idx); err != nil {
			return fmt.Errorf("failed to create explore index: %w", err)
		}
	}

	// =========================================
	// Saves (bookmarks) — used by reels + posts.
	// =========================================
	createSaves := `
	CREATE TABLE IF NOT EXISTS saves (
		id         VARCHAR(36) PRIMARY KEY,
		user_id    VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		post_id    VARCHAR(36) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
		created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
		CONSTRAINT uq_save_user_post UNIQUE (user_id, post_id)
	);
	`
	if _, err = db.Exec(createSaves); err != nil {
		return fmt.Errorf("failed to create saves table: %w", err)
	}
	savesIndexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_saves_user ON saves(user_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_saves_post ON saves(post_id)`,
	}
	for _, idx := range savesIndexes {
		if _, err := db.Exec(idx); err != nil {
			return fmt.Errorf("failed to create saves index: %w", err)
		}
	}

	// Backfill type/media_url for legacy rows (safe to run repeatedly).
	_, _ = db.Exec(`
		UPDATE posts
		SET
			type = CASE WHEN is_project THEN 'project' ELSE 'text' END
		WHERE type IS NULL OR type = '';
	`)
	_, _ = db.Exec(`
		UPDATE posts
		SET media_url = image_url
		WHERE media_url IS NULL AND image_url IS NOT NULL;
	`)

	// =========================================
	// Projects (lightweight): project_members + followers
	// =========================================
	createProjectMembers := `
	CREATE TABLE IF NOT EXISTS project_members (
		id          VARCHAR(36) PRIMARY KEY,
		user_id     VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		project_id  VARCHAR(36) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
		created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
		CONSTRAINT uq_project_member UNIQUE (user_id, project_id)
	);
	`
	if _, err = db.Exec(createProjectMembers); err != nil {
		return fmt.Errorf("failed to create project_members table: %w", err)
	}

	createFollowers := `
	CREATE TABLE IF NOT EXISTS followers (
		id            VARCHAR(36) PRIMARY KEY,
		follower_id   VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		following_id  VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
		CONSTRAINT uq_follower_pair UNIQUE (follower_id, following_id),
		CONSTRAINT chk_no_self_follow CHECK (follower_id <> following_id)
	);
	`
	if _, err = db.Exec(createFollowers); err != nil {
		return fmt.Errorf("failed to create followers table: %w", err)
	}

	projectFollowIndexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_followers_following ON followers(following_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_followers_follower ON followers(follower_id, created_at DESC)`,
	}
	for _, idx := range projectFollowIndexes {
		if _, err := db.Exec(idx); err != nil {
			return fmt.Errorf("failed to create project/follow index: %w", err)
		}
	}

	projectMemberRoleMigrations := []string{
		`ALTER TABLE project_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'`,
		`UPDATE project_members pm SET role = 'owner'
		 FROM posts p
		 WHERE pm.project_id = p.id AND pm.user_id = p.user_id
		   AND (p.type = 'project' OR COALESCE(p.is_project, FALSE) = TRUE)
		   AND COALESCE(p.project_id, p.id) = p.id`,
	}
	for _, q := range projectMemberRoleMigrations {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("failed to migrate project_members.role: %w", err)
		}
	}

	// =========================================
	// Daily Feed Limit Tables
	// =========================================

	// Table 1: feed_limit_settings — stores user's daily limit preferences (1:1 with users)
	createFeedLimitSettings := `
	CREATE TABLE IF NOT EXISTS feed_limit_settings (
		id                          VARCHAR(36) PRIMARY KEY,
		user_id                     VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		is_enabled                  BOOLEAN NOT NULL DEFAULT FALSE,
		max_posts_per_day           INTEGER,
		max_scroll_minutes          INTEGER,
		max_overrides_per_day       INTEGER NOT NULL DEFAULT 3,
		override_duration_minutes   INTEGER NOT NULL DEFAULT 15,
		created_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
		updated_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

		CONSTRAINT uq_feed_limit_user UNIQUE (user_id),
		CONSTRAINT chk_max_posts CHECK (max_posts_per_day IS NULL OR max_posts_per_day > 0),
		CONSTRAINT chk_max_scroll CHECK (max_scroll_minutes IS NULL OR max_scroll_minutes > 0),
		CONSTRAINT chk_max_overrides CHECK (max_overrides_per_day >= 0 AND max_overrides_per_day <= 10)
	);
	`
	if _, err = db.Exec(createFeedLimitSettings); err != nil {
		return fmt.Errorf("failed to create feed_limit_settings table: %w", err)
	}

	// Table 2: feed_usage_daily — tracks daily consumption per user (1:N with users, keyed by date)
	createFeedUsageDaily := `
	CREATE TABLE IF NOT EXISTS feed_usage_daily (
		id                  VARCHAR(36) PRIMARY KEY,
		user_id             VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		usage_date          DATE NOT NULL DEFAULT CURRENT_DATE,
		posts_viewed        INTEGER NOT NULL DEFAULT 0,
		scroll_minutes      INTEGER NOT NULL DEFAULT 0,
		limit_reached_at    TIMESTAMP WITH TIME ZONE,
		is_limit_reached    BOOLEAN NOT NULL DEFAULT FALSE,
		created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
		updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

		CONSTRAINT uq_user_usage_date UNIQUE (user_id, usage_date),
		CONSTRAINT chk_posts_viewed CHECK (posts_viewed >= 0),
		CONSTRAINT chk_scroll_minutes CHECK (scroll_minutes >= 0)
	);
	`
	if _, err = db.Exec(createFeedUsageDaily); err != nil {
		return fmt.Errorf("failed to create feed_usage_daily table: %w", err)
	}

	// Table 3: feed_limit_overrides — audit log of each snooze override (1:N with users)
	createFeedLimitOverrides := `
	CREATE TABLE IF NOT EXISTS feed_limit_overrides (
		id              VARCHAR(36) PRIMARY KEY,
		user_id         VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		override_date   DATE NOT NULL DEFAULT CURRENT_DATE,
		activated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
		expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
		created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
	);
	`
	if _, err = db.Exec(createFeedLimitOverrides); err != nil {
		return fmt.Errorf("failed to create feed_limit_overrides table: %w", err)
	}

	// Indexes for feed limit tables
	feedLimitIndexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_feed_limit_user ON feed_limit_settings(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_feed_usage_user_date ON feed_usage_daily(user_id, usage_date)`,
		`CREATE INDEX IF NOT EXISTS idx_feed_override_user_date ON feed_limit_overrides(user_id, override_date)`,
	}
	for _, idx := range feedLimitIndexes {
		if _, err := db.Exec(idx); err != nil {
			return fmt.Errorf("failed to create feed limit index: %w", err)
		}
	}

	// =========================================
	// Social: Connections + Stories (lightweight)
	// =========================================
	createConnections := `
	CREATE TABLE IF NOT EXISTS connections (
		id            VARCHAR(36) PRIMARY KEY,
		from_email    VARCHAR(254) NOT NULL,
		to_email      VARCHAR(254) NOT NULL,
		status        VARCHAR(20) NOT NULL DEFAULT 'pending',
		created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
		updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
		CONSTRAINT chk_connection_status CHECK (status IN ('pending', 'accepted', 'rejected')),
		CONSTRAINT uq_connection_pair UNIQUE (from_email, to_email)
	);
	`
	if _, err = db.Exec(createConnections); err != nil {
		return fmt.Errorf("failed to create connections table: %w", err)
	}

	createStories := `
	CREATE TABLE IF NOT EXISTS stories (
		id            VARCHAR(36) PRIMARY KEY,
		author_email  VARCHAR(254) NOT NULL,
		media_url     TEXT NOT NULL,
		media_type    VARCHAR(10) NOT NULL DEFAULT 'image',
		caption       TEXT,
		created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
		expires_at    TIMESTAMP WITH TIME ZONE NOT NULL,
		CONSTRAINT chk_story_media_type CHECK (media_type IN ('image', 'video'))
	);
	`
	if _, err = db.Exec(createStories); err != nil {
		return fmt.Errorf("failed to create stories table: %w", err)
	}

	createStorySeen := `
	CREATE TABLE IF NOT EXISTS story_seen (
		viewer_email VARCHAR(254) NOT NULL,
		story_id     VARCHAR(36) NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
		seen_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
		PRIMARY KEY (viewer_email, story_id)
	);
	`
	if _, err = db.Exec(createStorySeen); err != nil {
		return fmt.Errorf("failed to create story_seen table: %w", err)
	}

	socialIndexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_connections_from ON connections(from_email, status, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_connections_to ON connections(to_email, status, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_stories_author ON stories(author_email, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at)`,
		`CREATE INDEX IF NOT EXISTS idx_story_seen_viewer ON story_seen(viewer_email)`,
	}
	for _, idx := range socialIndexes {
		if _, err := db.Exec(idx); err != nil {
			return fmt.Errorf("failed to create social index: %w", err)
		}
	}

	alterStoriesMeta := []string{
		`ALTER TABLE stories ADD COLUMN IF NOT EXISTS location text`,
		`ALTER TABLE stories ADD COLUMN IF NOT EXISTS hashtags text`,
		`ALTER TABLE stories ADD COLUMN IF NOT EXISTS audience text DEFAULT 'everyone'`,
		`ALTER TABLE stories ADD COLUMN IF NOT EXISTS allow_replies text DEFAULT 'everyone'`,
	}
	for _, q := range alterStoriesMeta {
		if _, err := db.Exec(q); err != nil {
			return fmt.Errorf("failed to alter stories (meta): %w", err)
		}
	}

	// =========================================
	// Refresh Tokens (for JWT refresh flow)
	// =========================================
	createRefreshTokens := `
	CREATE TABLE IF NOT EXISTS refresh_tokens (
		id              VARCHAR(36) PRIMARY KEY,
		user_id         VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		token_hash      VARCHAR(64) UNIQUE NOT NULL,
		device_info     VARCHAR(255) NOT NULL DEFAULT 'unknown',
		expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
		created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
	);
	`
	if _, err = db.Exec(createRefreshTokens); err != nil {
		return fmt.Errorf("failed to create refresh_tokens table: %w", err)
	}

	refreshIndexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash)`,
		`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at)`,
	}
	for _, idx := range refreshIndexes {
		if _, err := db.Exec(idx); err != nil {
			return fmt.Errorf("failed to create refresh token index: %w", err)
		}
	}

	// Users: Firebase Auth linking + email verification flag
	alterUserFirebase := []string{
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS users_firebase_uid_key ON users(firebase_uid) WHERE firebase_uid IS NOT NULL`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true`,
	}
	for _, q := range alterUserFirebase {
		if _, err = db.Exec(q); err != nil {
			return fmt.Errorf("failed to alter users (firebase / email_verified): %w", err)
		}
	}

	// =========================================
	// Users: profile + interests + skills + onboarding
	// (Required for Profile / Onboarding flow.)
	// =========================================
	alterUserProfile := []string{
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS username           VARCHAR(32)`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name       VARCHAR(80) DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url          TEXT        DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio                 TEXT        DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS location            TEXT        DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS website             TEXT        DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS twitter             TEXT        DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin            TEXT        DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS github              TEXT        DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS role_tag            TEXT        DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS interests           TEXT[]      DEFAULT '{}'`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS skills              TEXT[]      DEFAULT '{}'`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified         BOOLEAN     NOT NULL DEFAULT FALSE`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN    NOT NULL DEFAULT FALSE`,
		`CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (LOWER(username)) WHERE username IS NOT NULL AND username <> ''`,
	}
	for _, q := range alterUserProfile {
		if _, err = db.Exec(q); err != nil {
			return fmt.Errorf("failed to alter users (profile/onboarding): %w", err)
		}
	}

	// ============================
	// MVP Features: Shuffle, Spark, Vibe, Bookmark actions
	// ============================
	mvpTables := []string{
		`CREATE TABLE IF NOT EXISTS shuffle_history (
			id         VARCHAR(36) PRIMARY KEY,
			user_id    VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			post_id    VARCHAR(36) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
			viewed_at  TIMESTAMP NOT NULL DEFAULT NOW(),
			CONSTRAINT uq_shuffle_user_post UNIQUE (user_id, post_id)
		)`,
		`CREATE TABLE IF NOT EXISTS spark_sessions (
			id               VARCHAR(36) PRIMARY KEY,
			user_id          VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			category         VARCHAR(32) NOT NULL,
			selected_post_id VARCHAR(36) REFERENCES posts(id) ON DELETE SET NULL,
			created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
			CONSTRAINT chk_spark_category CHECK (category IN ('learn', 'startup', 'wildcard'))
		)`,
		`CREATE TABLE IF NOT EXISTS post_vibes (
			id         VARCHAR(36) PRIMARY KEY,
			user_id    VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			post_id    VARCHAR(36) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
			vibe_score INTEGER NOT NULL,
			created_at TIMESTAMP NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
			CONSTRAINT uq_post_vibe_user_post UNIQUE (user_id, post_id),
			CONSTRAINT chk_vibe_score CHECK (vibe_score >= -100 AND vibe_score <= 100)
		)`,
		`CREATE TABLE IF NOT EXISTS bookmark_reminders (
			id         VARCHAR(36) PRIMARY KEY,
			user_id    VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			post_id    VARCHAR(36) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
			remind_at  TIMESTAMP NOT NULL,
			created_at TIMESTAMP NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS notes (
			id           VARCHAR(36) PRIMARY KEY,
			user_id      VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			post_id      VARCHAR(36) REFERENCES posts(id) ON DELETE SET NULL,
			title        TEXT NOT NULL DEFAULT '',
			content      TEXT NOT NULL DEFAULT '',
			creator_name TEXT NOT NULL DEFAULT '',
			created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
			updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS workspace_items (
			id         VARCHAR(36) PRIMARY KEY,
			user_id    VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			post_id    VARCHAR(36) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
			category   VARCHAR(32) NOT NULL DEFAULT 'research',
			created_at TIMESTAMP NOT NULL DEFAULT NOW(),
			CONSTRAINT uq_workspace_user_post_cat UNIQUE (user_id, post_id, category),
			CONSTRAINT chk_workspace_category CHECK (
				category IN ('startup_ideas', 'research', 'projects', 'learning')
			)
		)`,
		`CREATE TABLE IF NOT EXISTS analytics_events (
			id         VARCHAR(36) PRIMARY KEY,
			user_id    VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
			event_type VARCHAR(64) NOT NULL,
			payload    JSONB NOT NULL DEFAULT '{}',
			created_at TIMESTAMP NOT NULL DEFAULT NOW()
		)`,
	}
	for _, q := range mvpTables {
		if _, err = db.Exec(q); err != nil {
			return fmt.Errorf("failed to create MVP feature table: %w", err)
		}
	}
	mvpIndexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_shuffle_history_user ON shuffle_history(user_id, viewed_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_spark_sessions_user ON spark_sessions(user_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_post_vibes_post ON post_vibes(post_id)`,
		`CREATE INDEX IF NOT EXISTS idx_post_vibes_user ON post_vibes(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_bookmark_reminders_user ON bookmark_reminders(user_id, remind_at)`,
		`CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id, updated_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_workspace_user ON workspace_items(user_id, category)`,
		`CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type, created_at DESC)`,
	}
	for _, idx := range mvpIndexes {
		if _, err = db.Exec(idx); err != nil {
			return fmt.Errorf("failed to create MVP feature index: %w", err)
		}
	}

	// Messaging: attachments + read receipts
	messagingTables := []string{
		`CREATE TABLE IF NOT EXISTS message_attachments (
			id         VARCHAR(36) PRIMARY KEY,
			message_id VARCHAR(36) NOT NULL,
			media_url  TEXT NOT NULL,
			media_type VARCHAR(32) NOT NULL DEFAULT 'file',
			public_id  TEXT,
			file_name  TEXT,
			file_size  BIGINT,
			created_at TIMESTAMP NOT NULL DEFAULT NOW()
		)`,
	}
	for _, q := range messagingTables {
		if _, err = db.Exec(q); err != nil {
			return fmt.Errorf("failed to create messaging table: %w", err)
		}
	}
	messagingAlters := []string{
		`ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP`,
		`ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP`,
		`CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON message_attachments(message_id)`,
	}
	for _, q := range messagingAlters {
		if _, err = db.Exec(q); err != nil {
			log.Printf("messaging alter (non-fatal): %v", err)
		}
	}

	log.Println("Migrations completed successfully")

	// DM messages: optional media metadata (safe on existing Supabase DBs)
	msgAlters := []string{
		`ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_thumbnail TEXT`,
		`ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_name TEXT`,
	}
	for _, q := range msgAlters {
		if _, err := db.Exec(q); err != nil {
			log.Printf("messages column alter (non-fatal): %v", err)
		}
	}

	// Mood Feed (PRD-12)
	createPostMoods := `
	CREATE TABLE IF NOT EXISTS post_moods (
		id         VARCHAR(36) PRIMARY KEY,
		post_id    VARCHAR(36) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
		mood_name  VARCHAR(20) NOT NULL,
		created_at TIMESTAMP NOT NULL,
		CONSTRAINT uq_post_mood UNIQUE (post_id, mood_name),
		CONSTRAINT chk_mood_name CHECK (mood_name IN ('chill', 'creative', 'motivated', 'sad', 'hype', 'curious', 'nostalgic', 'grateful', 'focused', 'peaceful', 'restless', 'inspired'))
	);
	`
	if _, err = db.Exec(createPostMoods); err != nil {
		return fmt.Errorf("failed to create post_moods table: %w", err)
	}
	moodIndexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_post_moods_post_id ON post_moods(post_id)`,
		`CREATE INDEX IF NOT EXISTS idx_post_moods_mood_name ON post_moods(mood_name)`,
		`CREATE INDEX IF NOT EXISTS idx_post_moods_mood_post ON post_moods(mood_name, post_id)`,
	}
	for _, idx := range moodIndexes {
		if _, err := db.Exec(idx); err != nil {
			return fmt.Errorf("failed to create mood index: %w", err)
		}
	}

	createMoodSchedules := `
	CREATE TABLE IF NOT EXISTS mood_schedules (
		id           VARCHAR(36) PRIMARY KEY,
		user_id      VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		mood_name    VARCHAR(20) NOT NULL,
		start_time   VARCHAR(5) NOT NULL,
		end_time     VARCHAR(5),
		days_of_week JSONB NOT NULL DEFAULT '[]',
		timezone     VARCHAR(64) NOT NULL,
		enabled      BOOLEAN NOT NULL DEFAULT TRUE,
		created_at   TIMESTAMP NOT NULL,
		updated_at   TIMESTAMP NOT NULL
	);
	`
	if _, err = db.Exec(createMoodSchedules); err != nil {
		return fmt.Errorf("failed to create mood_schedules table: %w", err)
	}
	moodScheduleIndexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_mood_schedules_user ON mood_schedules(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_mood_schedules_user_enabled ON mood_schedules(user_id, enabled)`,
	}
	for _, idx := range moodScheduleIndexes {
		if _, err := db.Exec(idx); err != nil {
			return fmt.Errorf("failed to create mood schedule index: %w", err)
		}
	}

	createMoodSessions := `
	CREATE TABLE IF NOT EXISTS mood_sessions (
		id         VARCHAR(36) PRIMARY KEY,
		user_id    VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		mood_name  VARCHAR(20) NOT NULL,
		created_at TIMESTAMP NOT NULL
	);
	`
	if _, err = db.Exec(createMoodSessions); err != nil {
		return fmt.Errorf("failed to create mood_sessions table: %w", err)
	}
	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_mood_sessions_user_created ON mood_sessions(user_id, created_at DESC)`); err != nil {
		return fmt.Errorf("failed to create mood session index: %w", err)
	}

	// Push quiet hours (PRD-5)
	createUserQuietHours := `
	CREATE TABLE IF NOT EXISTS user_quiet_hours (
		user_id     VARCHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
		enabled     BOOLEAN NOT NULL DEFAULT FALSE,
		start_hour  INTEGER NOT NULL DEFAULT 22,
		end_hour    INTEGER NOT NULL DEFAULT 7,
		timezone    VARCHAR(64) NOT NULL DEFAULT 'UTC',
		updated_at  TIMESTAMP NOT NULL,
		CONSTRAINT chk_quiet_start_hour CHECK (start_hour >= 0 AND start_hour <= 23),
		CONSTRAINT chk_quiet_end_hour CHECK (end_hour >= 0 AND end_hour <= 23)
	);
	`
	if _, err = db.Exec(createUserQuietHours); err != nil {
		return fmt.Errorf("failed to create user_quiet_hours table: %w", err)
	}

	// In-app notifications
	createNotifications := `
	CREATE TABLE IF NOT EXISTS notifications (
		id          VARCHAR(36) PRIMARY KEY,
		user_id     VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		actor_id    VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
		type        VARCHAR(50) NOT NULL,
		entity_id   VARCHAR(36),
		is_read     BOOLEAN NOT NULL DEFAULT FALSE,
		created_at  TIMESTAMP NOT NULL
	);
	`
	if _, err = db.Exec(createNotifications); err != nil {
		return fmt.Errorf("failed to create notifications table: %w", err)
	}
	notifIndexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE is_read = false`,
	}
	for _, idx := range notifIndexes {
		if _, err := db.Exec(idx); err != nil {
			return fmt.Errorf("failed to create notifications index: %w", err)
		}
	}

	// Pre-launch waitlist
	createWaitlistSignups := `
	CREATE TABLE IF NOT EXISTS waitlist_signups (
		id             VARCHAR(36) PRIMARY KEY,
		email          VARCHAR(254) NOT NULL UNIQUE,
		name           VARCHAR(100),
		utm_source     VARCHAR(100),
		consent_given  BOOLEAN NOT NULL DEFAULT FALSE,
		created_at     TIMESTAMP NOT NULL,
		CONSTRAINT chk_waitlist_consent CHECK (consent_given = TRUE)
	);
	`
	if _, err = db.Exec(createWaitlistSignups); err != nil {
		return fmt.Errorf("failed to create waitlist_signups table: %w", err)
	}
	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_waitlist_created ON waitlist_signups(created_at DESC)`); err != nil {
		return fmt.Errorf("failed to create waitlist index: %w", err)
	}

	return nil
}
