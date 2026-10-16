package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/skiix-backend/internal/domain"
)

func feedMoodFilterSQL(mood string) (clause string, arg *string) {
	if mood == "" {
		return "", nil
	}
	return ` AND EXISTS (SELECT 1 FROM post_moods pm WHERE pm.post_id = p.id AND pm.mood_name = $2)`, &mood
}

// PostgresPostRepository implements domain.PostRepository
// using raw SQL with parameterized queries.
type PostgresPostRepository struct {
	db *sql.DB
}

// NewPostgresPostRepository creates a new post repository.
func NewPostgresPostRepository(db *sql.DB) domain.PostRepository {
	return &PostgresPostRepository{db: db}
}

// Create inserts a new post into the database.
func (r *PostgresPostRepository) Create(post *domain.Post) error {
	query := `
		INSERT INTO posts (id, user_id, type, content, media_url, image_url, is_project, project_id, visibility, circle_id, like_count, comment_count, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`

	post.CreatedAt = time.Now()
	post.UpdatedAt = time.Now()

	_, err := r.db.Exec(query,
		post.ID, post.UserID, post.Type, post.Content,
		post.MediaURL, post.ImageURL,
		post.IsProject, post.ProjectID,
		post.Visibility, post.CircleID,
		post.LikeCount, post.CommentCount,
		post.CreatedAt, post.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create post: %w", err)
	}

	return nil
}

// GetByID retrieves a single post by its ID.
func (r *PostgresPostRepository) GetByID(postID string) (*domain.Post, error) {
	query := `
		SELECT id, user_id, type, content, media_url, image_url, is_project, project_id, visibility, circle_id, like_count, comment_count, created_at, updated_at
		FROM posts
		WHERE id = $1
	`

	post := &domain.Post{}
	err := r.db.QueryRow(query, postID).Scan(
		&post.ID, &post.UserID, &post.Type, &post.Content,
		&post.MediaURL, &post.ImageURL,
		&post.IsProject, &post.ProjectID,
		&post.Visibility, &post.CircleID,
		&post.LikeCount, &post.CommentCount,
		&post.CreatedAt, &post.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("post not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get post: %w", err)
	}

	return post, nil
}

func mergeFeedTags(categoryCSV string, postHashtags []string) []string {
	seen := make(map[string]struct{})
	out := make([]string, 0)
	add := func(raw string) {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			return
		}
		key := strings.ToLower(strings.TrimPrefix(raw, "#"))
		if _, ok := seen[key]; ok {
			return
		}
		seen[key] = struct{}{}
		out = append(out, strings.TrimPrefix(strings.TrimSpace(raw), "#"))
	}
	if categoryCSV != "" {
		for _, p := range strings.Split(categoryCSV, ",") {
			add(p)
		}
	}
	for _, h := range postHashtags {
		add(h)
	}
	return out
}

// GetFeed retrieves a paginated list of posts for the main feed,
// enriched with author email and like status for the requesting user.
func (r *PostgresPostRepository) GetFeed(query domain.FeedQuery) ([]domain.PostFeedItem, error) {
	moodFilter, moodArg := feedMoodFilterSQL(query.Mood)
	limitParam := "$2"
	offsetParam := "$3"
	if moodArg != nil {
		limitParam = "$3"
		offsetParam = "$4"
	}

	sqlQuery := `
		SELECT
			p.id, p.user_id, p.type, p.content, p.media_url, p.image_url, p.is_project,
			CASE
				WHEN p.type = 'project' OR p.is_project THEN COALESCE(p.project_id, p.id)
				WHEN p.type = 'project_update' AND p.project_id IS NOT NULL THEN p.project_id
				ELSE NULL
			END AS resolved_project_id,
			p.like_count, p.comment_count,
			p.created_at, p.updated_at,
			u.email AS author_email,
			COALESCE(NULLIF(TRIM(u.username), ''), split_part(u.email, '@', 1)) AS author_username,
			COALESCE(u.is_verified, false) AS is_verified,
			(p.user_id::text <> '' AND p.user_id = $1::text) AS is_own_post,
			COALESCE((
				SELECT string_agg(pc.category_name, ',' ORDER BY pc.created_at)
				FROM post_categories pc
				WHERE pc.post_id = p.id
			), '') AS tags_csv,
			EXISTS(
				SELECT 1 FROM post_likes pl
				WHERE pl.post_id = p.id AND pl.user_id = $1
			) AS is_liked,
			EXISTS(
				SELECT 1 FROM saves s
				WHERE s.post_id = p.id AND s.user_id = $1
			) AS is_saved,
			COALESCE((SELECT COUNT(*)::int FROM saves s2 WHERE s2.post_id = p.id), 0) AS saves_count,
			COALESCE((SELECT pv.vibe_score FROM post_vibes pv WHERE pv.post_id = p.id AND pv.user_id = $1), 0) AS viewer_vibe_score,
			COALESCE((SELECT ROUND(AVG(pv2.vibe_score)::numeric, 1) FROM post_vibes pv2 WHERE pv2.post_id = p.id), 0) AS avg_vibe_score,
			COALESCE((SELECT COUNT(*)::int FROM post_vibes pv3 WHERE pv3.post_id = p.id), 0) AS vibe_count,
			COALESCE((
				SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE pv4.vibe_score >= 50) / NULLIF(COUNT(*), 0), 1)
				FROM post_vibes pv4 WHERE pv4.post_id = p.id
			), 0) AS vibe_love_pct,
			COALESCE((
				SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE pv4.vibe_score > -50 AND pv4.vibe_score < 50) / NULLIF(COUNT(*), 0), 1)
				FROM post_vibes pv4 WHERE pv4.post_id = p.id
			), 0) AS vibe_neutral_pct,
			COALESCE((
				SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE pv4.vibe_score <= -50) / NULLIF(COUNT(*), 0), 1)
				FROM post_vibes pv4 WHERE pv4.post_id = p.id
			), 0) AS vibe_disagree_pct
			,
			CASE WHEN p.type IS NOT NULL AND p.type <> '' THEN p.type
			     WHEN p.is_project THEN 'project' ELSE 'text' END AS type,
			EXISTS(
				SELECT 1 FROM project_members pm
				WHERE pm.user_id = $1
				AND pm.project_id = (
					CASE
						WHEN p.type = 'project' OR p.is_project THEN COALESCE(p.project_id, p.id)
						WHEN p.type = 'project_update' AND p.project_id IS NOT NULL THEN p.project_id
						ELSE NULL
					END
				)
			) AS is_joined,
			EXISTS(
				SELECT 1 FROM followers f
				WHERE f.follower_id = $1 AND f.following_id = p.user_id
			) AS is_following,
			COALESCE(p.extra_media_urls, '{}') AS extra_media_urls,
			COALESCE(p.tags, '{}') AS post_hashtags,
			p.is_new_project,
			p.metrics,
			p.milestone_type,
			COALESCE(NULLIF(TRIM(p.project_name),''), pr_root.content) AS project_display_name
		FROM posts p
		INNER JOIN users u ON u.id = p.user_id
		LEFT JOIN posts pr_root ON pr_root.id = p.project_id AND pr_root.type = 'project'
		WHERE COALESCE(p.listed_in_feed, TRUE) IS TRUE
		AND NOT (
			COALESCE((SELECT is_enabled FROM focus_mode_settings WHERE user_id = $1), FALSE)
			AND p.id IN (
				SELECT pc.post_id
				FROM post_categories pc
				INNER JOIN focus_mode_blocked_categories fmbc
					ON pc.category_name = fmbc.category_name
				WHERE fmbc.user_id = $1
			)
		)` + moodFilter + `
		ORDER BY p.created_at DESC
		LIMIT ` + limitParam + ` OFFSET ` + offsetParam

	args := []interface{}{query.UserID}
	if moodArg != nil {
		args = append(args, *moodArg)
	}
	args = append(args, query.Limit, query.Offset)

	rows, err := r.db.Query(sqlQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get feed: %w", err)
	}
	defer rows.Close()

	items := make([]domain.PostFeedItem, 0)
	for rows.Next() {
		var item domain.PostFeedItem
		var tagsCSV string
		var extraURLs pq.StringArray
		var hashtagArr pq.StringArray
		var metrics sql.NullString
		var milestone sql.NullString
		var projectDisplay sql.NullString
		if err := rows.Scan(
			&item.ID, &item.UserID, &item.Post.Type, &item.Content, &item.MediaURL, &item.ImageURL,
			&item.IsProject, &item.ProjectID,
			&item.LikeCount, &item.CommentCount,
			&item.CreatedAt, &item.UpdatedAt,
			&item.AuthorEmail, &item.AuthorUsername, &item.IsVerified, &item.IsOwnPost, &tagsCSV,
			&item.IsLiked, &item.IsSaved, &item.SavesCount,
			&item.ViewerVibeScore, &item.AvgVibeScore, &item.VibeCount,
			&item.VibeLovePct, &item.VibeNeutralPct, &item.VibeDisagreePct,
			&item.Type, &item.IsJoined, &item.IsFollowing,
			&extraURLs, &hashtagArr,
			&item.IsNewProject, &metrics, &milestone, &projectDisplay,
		); err != nil {
			return nil, fmt.Errorf("failed to scan feed item: %w", err)
		}
		item.Tags = mergeFeedTags(tagsCSV, []string(hashtagArr))
		item.Post.ExtraMediaURLs = []string(extraURLs)
		if metrics.Valid && strings.TrimSpace(metrics.String) != "" {
			ms := metrics.String
			item.Metrics = &ms
		}
		if milestone.Valid && strings.TrimSpace(milestone.String) != "" {
			mt := milestone.String
			item.MilestoneType = &mt
		}
		if projectDisplay.Valid && strings.TrimSpace(projectDisplay.String) != "" {
			pn := strings.TrimSpace(projectDisplay.String)
			item.ProjectName = &pn
		}
		// Keep embedded struct consistent for JSON.
		item.Post.Type = item.Type
		inferFeedMediaType(&item)
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating feed: %w", err)
	}

	return items, nil
}

// GetByUserID retrieves all posts by a specific user.
func (r *PostgresPostRepository) GetByUserID(userID string, limit, offset int) ([]domain.PostFeedItem, error) {
	query := `
		SELECT
			p.id, p.user_id, p.type, p.content, p.media_url, p.image_url, p.is_project,
			CASE WHEN p.type = 'project' OR p.is_project THEN COALESCE(p.project_id, p.id) ELSE NULL END AS project_id,
			p.like_count, p.comment_count,
			p.created_at, p.updated_at,
			u.email AS author_email,
			COALESCE((
				SELECT string_agg(pc.category_name, ',' ORDER BY pc.created_at)
				FROM post_categories pc
				WHERE pc.post_id = p.id
			), '') AS tags_csv,
			FALSE AS is_liked,
			CASE WHEN p.type IS NOT NULL AND p.type <> '' THEN p.type
			     WHEN p.is_project THEN 'project' ELSE 'text' END AS type,
			FALSE AS is_joined,
			FALSE AS is_following,
			COALESCE(p.extra_media_urls, '{}') AS extra_media_urls,
			COALESCE(p.tags, '{}') AS post_hashtags
		FROM posts p
		INNER JOIN users u ON u.id = p.user_id
		WHERE p.user_id = $1
		AND COALESCE(p.listed_on_profile, TRUE) IS TRUE
		ORDER BY p.created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get user posts: %w", err)
	}
	defer rows.Close()

	items := make([]domain.PostFeedItem, 0)
	for rows.Next() {
		var item domain.PostFeedItem
		var tagsCSV string
		var extraURLs pq.StringArray
		var hashtagArr pq.StringArray
		if err := rows.Scan(
			&item.ID, &item.UserID, &item.Post.Type, &item.Content, &item.MediaURL, &item.ImageURL,
			&item.IsProject, &item.ProjectID,
			&item.LikeCount, &item.CommentCount,
			&item.CreatedAt, &item.UpdatedAt,
			&item.AuthorEmail, &tagsCSV,
			&item.IsLiked,
			&item.Type, &item.IsJoined, &item.IsFollowing,
			&extraURLs, &hashtagArr,
		); err != nil {
			return nil, fmt.Errorf("failed to scan user post: %w", err)
		}
		item.Tags = mergeFeedTags(tagsCSV, []string(hashtagArr))
		item.Post.ExtraMediaURLs = []string(extraURLs)
		item.Post.Type = item.Type
		inferFeedMediaType(&item)
		items = append(items, item)
	}

	return items, nil
}

// GetByCircle retrieves paginated posts within a specific circle.
func (r *PostgresPostRepository) GetByCircle(circleID string, userID string, limit, offset int) ([]domain.PostFeedItem, error) {
	query := `
		SELECT
			p.id, p.user_id, p.type, p.content, p.media_url, p.image_url, p.is_project,
			CASE WHEN p.type = 'project' OR p.is_project THEN COALESCE(p.project_id, p.id) ELSE NULL END AS project_id,
			p.like_count, p.comment_count,
			p.created_at, p.updated_at,
			u.email AS author_email,
			EXISTS(
				SELECT 1 FROM post_likes pl
				WHERE pl.post_id = p.id AND pl.user_id = $2
			) AS is_liked
			,
			CASE WHEN p.type IS NOT NULL AND p.type <> '' THEN p.type
			     WHEN p.is_project THEN 'project' ELSE 'text' END AS type,
			EXISTS(
				SELECT 1 FROM project_members pm
				WHERE pm.project_id = COALESCE(p.project_id, p.id) AND pm.user_id = $2
			) AS is_joined,
			EXISTS(
				SELECT 1 FROM followers f
				WHERE f.follower_id = $2 AND f.following_id = p.user_id
			) AS is_following
		FROM posts p
		INNER JOIN users u ON u.id = p.user_id
		WHERE p.circle_id = $1
		ORDER BY p.created_at DESC
		LIMIT $3 OFFSET $4
	`

	rows, err := r.db.Query(query, circleID, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get circle posts: %w", err)
	}
	defer rows.Close()

	items := make([]domain.PostFeedItem, 0)
	for rows.Next() {
		var item domain.PostFeedItem
		if err := rows.Scan(
			&item.ID, &item.UserID, &item.Post.Type, &item.Content, &item.MediaURL, &item.ImageURL,
			&item.IsProject, &item.ProjectID,
			&item.LikeCount, &item.CommentCount,
			&item.CreatedAt, &item.UpdatedAt,
			&item.AuthorEmail, &item.IsLiked,
			&item.Type, &item.IsJoined, &item.IsFollowing,
		); err != nil {
			return nil, fmt.Errorf("failed to scan circle post: %w", err)
		}
		item.Post.Type = item.Type
		items = append(items, item)
	}

	return items, nil
}

func (r *PostgresPostRepository) GetProjectRoots(userID string, limit int) ([]domain.ProjectSummary, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	rows, err := r.db.Query(
		`SELECT p.id, p.content, p.created_at, COALESCE(pm.cnt, 0)::int AS member_count
		 FROM posts p
		 LEFT JOIN (
		   SELECT project_id, COUNT(*)::int AS cnt
		   FROM project_members
		   GROUP BY project_id
		 ) pm ON pm.project_id = p.id
		 WHERE p.user_id = $1
		   AND (p.type = 'project' OR p.is_project = TRUE)
		   AND COALESCE(p.project_id, p.id) = p.id
		 ORDER BY p.created_at DESC
		 LIMIT $2`,
		userID,
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list projects: %w", err)
	}
	defer rows.Close()

	out := make([]domain.ProjectSummary, 0)
	for rows.Next() {
		var p domain.ProjectSummary
		if err := rows.Scan(&p.ID, &p.Content, &p.CreatedAt, &p.MemberCount); err != nil {
			return nil, fmt.Errorf("failed to scan project: %w", err)
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// Update modifies an existing post's content and image_url.
func (r *PostgresPostRepository) Update(post *domain.Post) error {
	query := `
		UPDATE posts
		SET content = $1, image_url = $2, updated_at = $3
		WHERE id = $4
	`

	post.UpdatedAt = time.Now()
	result, err := r.db.Exec(query, post.Content, post.ImageURL, post.UpdatedAt, post.ID)
	if err != nil {
		return fmt.Errorf("failed to update post: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return errors.New("post not found")
	}

	return nil
}

// Delete removes a post by ID.
func (r *PostgresPostRepository) Delete(postID string) error {
	query := `DELETE FROM posts WHERE id = $1`

	result, err := r.db.Exec(query, postID)
	if err != nil {
		return fmt.Errorf("failed to delete post: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return errors.New("post not found")
	}

	return nil
}

// SetCategories replaces all categories for a post atomically
// using a database transaction (DELETE all + INSERT new).
func (r *PostgresPostRepository) SetCategories(postID string, categories []string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Delete existing categories
	if _, err := tx.Exec(`DELETE FROM post_categories WHERE post_id = $1`, postID); err != nil {
		return fmt.Errorf("failed to delete categories: %w", err)
	}

	// Insert new categories
	if len(categories) > 0 {
		insertQuery := `INSERT INTO post_categories (id, post_id, category_name, created_at) VALUES ($1, $2, $3, $4)`
		now := time.Now()
		for _, cat := range categories {
			if _, err := tx.Exec(insertQuery, uuid.New().String(), postID, cat, now); err != nil {
				return fmt.Errorf("failed to insert category '%s': %w", cat, err)
			}
		}
	}

	return tx.Commit()
}

// GetCategories returns all category names for a post.
func (r *PostgresPostRepository) GetCategories(postID string) ([]string, error) {
	query := `SELECT category_name FROM post_categories WHERE post_id = $1 ORDER BY created_at ASC`

	rows, err := r.db.Query(query, postID)
	if err != nil {
		return nil, fmt.Errorf("failed to get categories: %w", err)
	}
	defer rows.Close()

	categories := make([]string, 0)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("failed to scan category: %w", err)
		}
		categories = append(categories, name)
	}

	return categories, nil
}

// ToggleLike adds a like if not exists, removes if exists.
// Returns true if liked after toggle, false if unliked.
// Atomically updates the like_count on the post using a transaction.
func (r *PostgresPostRepository) ToggleLike(userID, postID string) (bool, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return false, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Check if like already exists
	var existingID string
	checkQuery := `SELECT id FROM post_likes WHERE user_id = $1 AND post_id = $2`
	err = tx.QueryRow(checkQuery, userID, postID).Scan(&existingID)

	if err == sql.ErrNoRows {
		// Like does not exist — add it
		insertQuery := `INSERT INTO post_likes (id, user_id, post_id, created_at) VALUES ($1, $2, $3, $4)`
		if _, err := tx.Exec(insertQuery, uuid.New().String(), userID, postID, time.Now()); err != nil {
			return false, fmt.Errorf("failed to insert like: %w", err)
		}

		// Increment like_count
		if _, err := tx.Exec(`UPDATE posts SET like_count = like_count + 1 WHERE id = $1`, postID); err != nil {
			return false, fmt.Errorf("failed to increment like count: %w", err)
		}

		if err := tx.Commit(); err != nil {
			return false, fmt.Errorf("failed to commit: %w", err)
		}
		return true, nil
	}

	if err != nil {
		return false, fmt.Errorf("failed to check like: %w", err)
	}

	// Like exists — remove it
	if _, err := tx.Exec(`DELETE FROM post_likes WHERE id = $1`, existingID); err != nil {
		return false, fmt.Errorf("failed to delete like: %w", err)
	}

	// Decrement like_count (minimum 0)
	if _, err := tx.Exec(`UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1`, postID); err != nil {
		return false, fmt.Errorf("failed to decrement like count: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return false, fmt.Errorf("failed to commit: %w", err)
	}
	return false, nil
}

// IncrementCommentCount atomically increments comment_count.
func (r *PostgresPostRepository) IncrementCommentCount(postID string) error {
	_, err := r.db.Exec(`UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1`, postID)
	if err != nil {
		return fmt.Errorf("failed to increment comment count: %w", err)
	}
	return nil
}

// DecrementCommentCount atomically decrements comment_count (minimum 0).
func (r *PostgresPostRepository) DecrementCommentCount(postID string) error {
	_, err := r.db.Exec(`UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = $1`, postID)
	if err != nil {
		return fmt.Errorf("failed to decrement comment count: %w", err)
	}
	return nil
}

// ApplyReelPublishFields merges optional reel / explore metadata onto an existing post row.
func (r *PostgresPostRepository) ApplyReelPublishFields(postID string, req domain.CreatePostRequest) error {
	if strings.TrimSpace(postID) == "" {
		return nil
	}
	sets := make([]string, 0, 12)
	args := make([]interface{}, 0, 12)
	idx := 1

	appendSet := func(column string, value interface{}) {
		sets = append(sets, fmt.Sprintf("%s = $%d", column, idx))
		args = append(args, value)
		idx++
	}

	if req.ThumbnailURL != nil && strings.TrimSpace(*req.ThumbnailURL) != "" {
		appendSet("thumbnail_url", strings.TrimSpace(*req.ThumbnailURL))
	}
	if req.CloudinaryPublicID != nil && strings.TrimSpace(*req.CloudinaryPublicID) != "" {
		appendSet("cloudinary_public_id", strings.TrimSpace(*req.CloudinaryPublicID))
	}
	if req.VideoDuration != nil && *req.VideoDuration >= 0 {
		appendSet("video_duration", *req.VideoDuration)
	}
	if req.AspectWidth != nil && *req.AspectWidth > 0 {
		appendSet("aspect_width", *req.AspectWidth)
	}
	if req.AspectHeight != nil && *req.AspectHeight > 0 {
		appendSet("aspect_height", *req.AspectHeight)
	}
	if req.Category != nil && strings.TrimSpace(*req.Category) != "" {
		appendSet("category", strings.ToLower(strings.TrimSpace(*req.Category)))
	}
	if req.ExploreTitle != nil && strings.TrimSpace(*req.ExploreTitle) != "" {
		appendSet("explore_title", strings.TrimSpace(*req.ExploreTitle))
	}
	if len(req.Tags) > 0 {
		clean := make([]string, 0, len(req.Tags))
		for _, t := range req.Tags {
			t = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(t), "#"))
			if t == "" {
				continue
			}
			clean = append(clean, strings.ToLower(t))
		}
		if len(clean) > 0 {
			appendSet("tags", pq.Array(clean))
		}
	}
	if req.Location != nil && strings.TrimSpace(*req.Location) != "" {
		appendSet("location", strings.TrimSpace(*req.Location))
	}
	if req.Audience != nil && strings.TrimSpace(*req.Audience) != "" {
		appendSet("audience", strings.ToLower(strings.TrimSpace(*req.Audience)))
	}
	if req.ShareToFeed != nil {
		appendSet("listed_in_feed", *req.ShareToFeed)
	}
	if req.ShareToProfile != nil {
		appendSet("listed_on_profile", *req.ShareToProfile)
	}
	if len(req.ExtraMediaURLs) > 0 {
		urls := make([]string, 0, len(req.ExtraMediaURLs))
		for _, u := range req.ExtraMediaURLs {
			u = strings.TrimSpace(u)
			if u != "" {
				urls = append(urls, u)
			}
		}
		if len(urls) > 0 {
			appendSet("extra_media_urls", pq.Array(urls))
		}
	}
	appendSet("is_new_project", req.IsNewProject)
	if strings.TrimSpace(req.Metrics) != "" {
		appendSet("metrics", strings.TrimSpace(req.Metrics))
	}
	if strings.TrimSpace(req.MilestoneType) != "" {
		appendSet("milestone_type", strings.TrimSpace(req.MilestoneType))
	}
	if strings.TrimSpace(req.ProjectName) != "" {
		appendSet("project_name", strings.TrimSpace(req.ProjectName))
	}

	if len(sets) == 0 {
		return nil
	}
	args = append(args, postID)
	q := "UPDATE posts SET " + strings.Join(sets, ", ") + " WHERE id = $" + fmt.Sprintf("%d", idx)
	_, err := r.db.Exec(q, args...)
	if err != nil {
		return fmt.Errorf("apply reel fields: %w", err)
	}
	return nil
}

func inferFeedMediaType(item *domain.PostFeedItem) {
	raw := ""
	if item.MediaURL != nil && strings.TrimSpace(*item.MediaURL) != "" {
		raw = strings.TrimSpace(*item.MediaURL)
	} else if item.ImageURL != nil && strings.TrimSpace(*item.ImageURL) != "" {
		raw = strings.TrimSpace(*item.ImageURL)
	}
	if raw == "" {
		return
	}
	base := strings.Split(raw, "?")[0]
	ext := strings.ToLower(filepath.Ext(base))
	switch ext {
	case ".mp4", ".mov", ".webm", ".m4v", ".mkv":
		item.FeedMediaType = "video"
		return
	}
	if strings.EqualFold(strings.TrimSpace(item.Post.Type), "reel") {
		item.FeedMediaType = "video"
		return
	}
	item.FeedMediaType = "image"
}

// SetMoods replaces creator mood tags for a post atomically.
func (r *PostgresPostRepository) SetMoods(postID string, moods []string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM post_moods WHERE post_id = $1`, postID); err != nil {
		return fmt.Errorf("failed to delete moods: %w", err)
	}

	if len(moods) > 0 {
		insertQuery := `INSERT INTO post_moods (id, post_id, mood_name, created_at) VALUES ($1, $2, $3, $4)`
		now := time.Now()
		for _, mood := range moods {
			if _, err := tx.Exec(insertQuery, uuid.New().String(), postID, mood, now); err != nil {
				return fmt.Errorf("failed to insert mood '%s': %w", mood, err)
			}
		}
	}

	return tx.Commit()
}

// GetMoods returns mood tag names for a post.
func (r *PostgresPostRepository) GetMoods(postID string) ([]string, error) {
	rows, err := r.db.Query(`SELECT mood_name FROM post_moods WHERE post_id = $1 ORDER BY created_at ASC`, postID)
	if err != nil {
		return nil, fmt.Errorf("failed to get moods: %w", err)
	}
	defer rows.Close()

	moods := make([]string, 0)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("failed to scan mood: %w", err)
		}
		moods = append(moods, name)
	}
	return moods, nil
}
