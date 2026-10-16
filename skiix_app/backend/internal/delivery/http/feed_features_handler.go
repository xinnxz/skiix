package http

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/skiix-backend/internal/domain"
)

// FeedFeaturesHandler powers Discovery Shuffle, Spark, and Vibe MVP endpoints.
type FeedFeaturesHandler struct {
	db    *sql.DB
	users domain.UserRepository
}

func NewFeedFeaturesHandler(db *sql.DB, users domain.UserRepository) *FeedFeaturesHandler {
	return &FeedFeaturesHandler{db: db, users: users}
}

type shufflePostDTO struct {
	ID             string   `json:"id"`
	Type           string   `json:"type"`
	Content        string   `json:"content"`
	MediaURL       *string  `json:"media_url,omitempty"`
	ImageURL       *string  `json:"image_url,omitempty"`
	ThumbnailURL   *string  `json:"thumbnail_url,omitempty"`
	MediaType      string   `json:"media_type,omitempty"`
	LikeCount      int      `json:"like_count"`
	CommentCount   int      `json:"comment_count"`
	CreatedAt      string   `json:"created_at"`
	AuthorEmail    string   `json:"author_email"`
	AuthorUsername string   `json:"author_username"`
	IsProject      bool     `json:"is_project"`
	ProjectID      *string  `json:"project_id,omitempty"`
	Tags           []string `json:"tags,omitempty"`
	ExploreTitle   *string  `json:"explore_title,omitempty"`
}

type sparkCardDTO struct {
	PostID         string  `json:"post_id"`
	Category       string  `json:"category"`
	Thumbnail      string  `json:"thumbnail"`
	Title          string  `json:"title"`
	Creator        string  `json:"creator"`
	MediaType      string  `json:"media_type,omitempty"`
	ContentPreview string  `json:"content_preview,omitempty"`
}

func (h *FeedFeaturesHandler) resolveViewerID(c *gin.Context) string {
	if id := strings.TrimSpace(c.GetString("user_id")); id != "" {
		return id
	}
	email := strings.TrimSpace(strings.ToLower(c.Query("viewer_email")))
	if email == "" {
		email = strings.TrimSpace(strings.ToLower(c.GetString("supabase_user_email")))
	}
	if email == "" || h.users == nil {
		return ""
	}
	u, err := h.users.FindByEmail(email)
	if err != nil || u == nil {
		return ""
	}
	return u.ID
}

func (h *FeedFeaturesHandler) trackEvent(userID, eventType string, payload map[string]interface{}) {
	if h.db == nil {
		return
	}
	raw, _ := json.Marshal(payload)
	_, _ = h.db.Exec(
		`INSERT INTO analytics_events (id, user_id, event_type, payload) VALUES ($1, NULLIF($2,''), $3, $4::jsonb)`,
		uuid.New().String(),
		userID,
		eventType,
		string(raw),
	)
}

// GetShuffle returns one quality post the viewer has not shuffled recently.
// GET /api/v1/feed/shuffle
func (h *FeedFeaturesHandler) GetShuffle(c *gin.Context) {
	viewerID := h.resolveViewerID(c)

	const q = `
		SELECT
			p.id, COALESCE(NULLIF(TRIM(p.type),''), CASE WHEN p.is_project THEN 'project' ELSE 'text' END),
			p.content, p.media_url, p.image_url, p.thumbnail_url,
			p.like_count, p.comment_count, p.created_at,
			u.email,
			COALESCE(NULLIF(TRIM(u.username), ''), split_part(u.email, '@', 1)),
			p.is_project,
			CASE
				WHEN p.type = 'project' OR p.is_project THEN COALESCE(p.project_id, p.id)
				WHEN p.type = 'project_update' AND p.project_id IS NOT NULL THEN p.project_id
				ELSE NULL
			END,
			COALESCE(p.tags, '{}'),
			p.explore_title,
			CASE WHEN COALESCE(p.video_duration, 0) > 0 OR p.type = 'reel' THEN 'video' ELSE 'image' END
		FROM posts p
		INNER JOIN users u ON u.id = p.user_id
		WHERE COALESCE(p.listed_in_feed, TRUE) IS TRUE
		AND COALESCE(p.type, '') NOT IN ('story')
		AND ($1 = '' OR p.id NOT IN (
			SELECT sh.post_id FROM shuffle_history sh WHERE sh.user_id = $1
		))
		AND ($1 = '' OR p.user_id <> $1)
		ORDER BY (
			RANDOM() * (
				1.0
				+ LEAST(p.like_count + p.comment_count, 200)::float / 200.0
				+ CASE WHEN p.type IN ('project', 'project_update') OR p.is_project THEN 0.6 ELSE 0 END
				+ CASE WHEN p.created_at > NOW() - INTERVAL '7 days' THEN 0.35 ELSE 0 END
				+ CASE WHEN u.created_at > NOW() - INTERVAL '45 days' THEN 0.45 ELSE 0 END
				+ CASE WHEN p.like_count < 15 AND p.created_at > NOW() - INTERVAL '21 days' THEN 0.3 ELSE 0 END
				+ CASE WHEN NULLIF(TRIM(p.location), '') IS NOT NULL THEN 0.15 ELSE 0 END
			)
		) DESC
		LIMIT 1
	`

	var item shufflePostDTO
	var tags pq.StringArray
	var exploreTitle sql.NullString
	var created time.Time
	err := h.db.QueryRow(q, viewerID).Scan(
		&item.ID, &item.Type, &item.Content, &item.MediaURL, &item.ImageURL, &item.ThumbnailURL,
		&item.LikeCount, &item.CommentCount, &created,
		&item.AuthorEmail, &item.AuthorUsername, &item.IsProject, &item.ProjectID,
		&tags, &exploreTitle, &item.MediaType,
	)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusOK, gin.H{"data": nil, "message": "No more shuffle content — check back later"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "shuffle failed"})
		return
	}
	item.CreatedAt = created.UTC().Format(time.RFC3339)
	item.Tags = []string(tags)
	if exploreTitle.Valid {
		t := exploreTitle.String
		item.ExploreTitle = &t
	}

	if viewerID != "" {
		_, _ = h.db.Exec(
			`INSERT INTO shuffle_history (id, user_id, post_id, viewed_at)
			 VALUES ($1, $2, $3, NOW())
			 ON CONFLICT (user_id, post_id) DO UPDATE SET viewed_at = NOW()`,
			uuid.New().String(), viewerID, item.ID,
		)
		h.trackEvent(viewerID, "shuffle_view", map[string]interface{}{"post_id": item.ID})
	}

	c.JSON(http.StatusOK, gin.H{"data": item})
}

func (h *FeedFeaturesHandler) pickSparkCard(viewerID, category string) (*sparkCardDTO, error) {
	var where string
	switch category {
	case "learn":
		where = `(
			LOWER(COALESCE(p.category,'')) LIKE '%learn%'
			OR LOWER(COALESCE(p.category,'')) LIKE '%education%'
			OR LOWER(COALESCE(p.category,'')) LIKE '%tutorial%'
			OR EXISTS (SELECT 1 FROM unnest(COALESCE(p.tags,'{}')) t WHERE LOWER(t) IN ('learn','learning','education','tutorial','howto'))
		)`
	case "startup":
		where = `(p.type = 'project' OR p.is_project OR p.type = 'project_update')`
	default:
		where = `TRUE`
	}

	q := fmt.Sprintf(`
		SELECT p.id, p.content, p.thumbnail_url, p.media_url, p.image_url, p.explore_title,
			COALESCE(NULLIF(TRIM(u.username), ''), split_part(u.email, '@', 1)),
			CASE WHEN COALESCE(p.video_duration, 0) > 0 OR p.type = 'reel' THEN 'video' ELSE 'image' END
		FROM posts p
		INNER JOIN users u ON u.id = p.user_id
		WHERE COALESCE(p.listed_in_feed, TRUE) IS TRUE
		AND COALESCE(p.type, '') NOT IN ('story')
		AND %s
		AND ($1 = '' OR p.user_id <> $1)
		ORDER BY (
			RANDOM() * (
				1.0 + LEAST(p.like_count + p.comment_count, 150)::float / 150.0
				+ CASE WHEN p.created_at > NOW() - INTERVAL '14 days' THEN 0.25 ELSE 0 END
			)
		) DESC
		LIMIT 1
	`, where)

	var postID, content, thumb, media, image, exploreTitle, creator, mediaType sql.NullString
	if err := h.db.QueryRow(q, viewerID).Scan(
		&postID, &content, &thumb, &media, &image, &exploreTitle, &creator, &mediaType,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	title := strings.TrimSpace(exploreTitle.String)
	if title == "" {
		title = strings.TrimSpace(content.String)
		if len(title) > 80 {
			title = title[:77] + "..."
		}
	}
	if title == "" {
		title = "Discover on Skiix"
	}

	thumbnail := strings.TrimSpace(thumb.String)
	if thumbnail == "" {
		thumbnail = strings.TrimSpace(media.String)
	}
	if thumbnail == "" {
		thumbnail = strings.TrimSpace(image.String)
	}
	if thumbnail == "" {
		thumbnail = fmt.Sprintf(
			"https://ui-avatars.com/api/?name=%s&background=0A0F12&color=70DAFF",
			creator.String,
		)
	}

	preview := strings.TrimSpace(content.String)
	if len(preview) > 120 {
		preview = preview[:117] + "..."
	}

	return &sparkCardDTO{
		PostID:         postID.String,
		Category:       category,
		Thumbnail:      thumbnail,
		Title:          title,
		Creator:        creator.String,
		MediaType:      mediaType.String,
		ContentPreview: preview,
	}, nil
}

// GetSpark returns three intentional content choices.
// GET /api/v1/feed/spark
func (h *FeedFeaturesHandler) GetSpark(c *gin.Context) {
	viewerID := h.resolveViewerID(c)
	out := gin.H{}
	for _, cat := range []string{"learn", "startup", "wildcard"} {
		card, err := h.pickSparkCard(viewerID, cat)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "spark failed"})
			return
		}
		out[cat] = card
	}
	if viewerID != "" {
		h.trackEvent(viewerID, "spark_open", map[string]interface{}{})
	}
	c.JSON(http.StatusOK, gin.H{"data": out})
}

type setVibeBody struct {
	PostID    string `json:"post_id"`
	VibeScore int    `json:"vibe_score"`
}

// SetVibe upserts emotional feedback for a post.
// POST /api/v1/posts/vibe
func (h *FeedFeaturesHandler) SetVibe(c *gin.Context) {
	viewerID := strings.TrimSpace(c.GetString("user_id"))
	if viewerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}
	var body setVibeBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	postID := strings.TrimSpace(body.PostID)
	if postID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "post_id required"})
		return
	}
	if body.VibeScore < -100 || body.VibeScore > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "vibe_score must be between -100 and 100"})
		return
	}

	_, err := h.db.Exec(`
		INSERT INTO post_vibes (id, user_id, post_id, vibe_score, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
		ON CONFLICT (user_id, post_id) DO UPDATE SET vibe_score = $4, updated_at = NOW()`,
		uuid.New().String(), viewerID, postID, body.VibeScore,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "vibe save failed"})
		return
	}

	var love, neutral, disagree float64
	var avg float64
	var count int
	_ = h.db.QueryRow(`
		SELECT
			COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE vibe_score >= 50) / NULLIF(COUNT(*), 0), 1), 0),
			COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE vibe_score > -50 AND vibe_score < 50) / NULLIF(COUNT(*), 0), 1), 0),
			COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE vibe_score <= -50) / NULLIF(COUNT(*), 0), 1), 0),
			COALESCE(ROUND(AVG(vibe_score)::numeric, 1), 0),
			COUNT(*)::int
		FROM post_vibes WHERE post_id = $1`, postID,
	).Scan(&love, &neutral, &disagree, &avg, &count)

	h.trackEvent(viewerID, "vibe_set", map[string]interface{}{"post_id": postID})

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"post_id":          postID,
		"vibe_score":       body.VibeScore,
		"vibe_love_pct":    love,
		"vibe_neutral_pct": neutral,
		"vibe_disagree_pct": disagree,
		"avg_vibe_score":   avg,
		"vibe_count":       count,
	}})
}

type selectSparkBody struct {
	Category string `json:"category"`
	PostID   string `json:"post_id"`
}

// SelectSpark records which Spark card the user chose.
// POST /api/v1/feed/spark/select
func (h *FeedFeaturesHandler) SelectSpark(c *gin.Context) {
	viewerID := strings.TrimSpace(c.GetString("user_id"))
	if viewerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}
	var body selectSparkBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	cat := strings.ToLower(strings.TrimSpace(body.Category))
	if cat != "learn" && cat != "startup" && cat != "wildcard" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid category"})
		return
	}
	postID := strings.TrimSpace(body.PostID)
	_, err := h.db.Exec(
		`INSERT INTO spark_sessions (id, user_id, category, selected_post_id, created_at) VALUES ($1,$2,$3,NULLIF($4,''),NOW())`,
		uuid.New().String(), viewerID, cat, postID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "spark session failed"})
		return
	}
	h.trackEvent(viewerID, "spark_select", map[string]interface{}{"post_id": postID, "category": cat})
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"ok": true}})
}

// GetPostVibeStats returns aggregated vibe analytics for creators.
// GET /api/v1/posts/:post_id/vibes
func (h *FeedFeaturesHandler) GetPostVibeStats(c *gin.Context) {
	postID := strings.TrimSpace(c.Param("post_id"))
	if postID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "post_id required"})
		return
	}
	var love, neutral, disagree, avg float64
	var count int
	err := h.db.QueryRow(`
		SELECT
			COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE vibe_score >= 50) / NULLIF(COUNT(*), 0), 1), 0),
			COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE vibe_score > -50 AND vibe_score < 50) / NULLIF(COUNT(*), 0), 1), 0),
			COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE vibe_score <= -50) / NULLIF(COUNT(*), 0), 1), 0),
			COALESCE(ROUND(AVG(vibe_score)::numeric, 1), 0),
			COUNT(*)::int
		FROM post_vibes WHERE post_id = $1`, postID,
	).Scan(&love, &neutral, &disagree, &avg, &count)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "stats failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"post_id":           postID,
		"vibe_love_pct":     love,
		"vibe_neutral_pct":  neutral,
		"vibe_disagree_pct": disagree,
		"avg_vibe_score":    avg,
		"vibe_count":        count,
	}})
}
