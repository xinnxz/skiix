package http

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// ReelsHandler exposes the short-form video feed (`type='reel'` posts).
// It re-uses the existing post infrastructure (likes, comments) but adds
// per-viewer flags (is_liked / is_saved / is_following) computed in one go so
// the mobile UI can render the sidebar without N+1 follow-up requests.
type ReelsHandler struct {
	db *sql.DB
}

// NewReelsHandler returns a handler ready to be registered.
func NewReelsHandler(db *sql.DB) *ReelsHandler {
	return &ReelsHandler{db: db}
}

// ReelItem mirrors the wire shape consumed by `services/reelsService.ts`.
type ReelItem struct {
	ID            string   `json:"id"`
	VideoURL      string   `json:"video_url"`
	ThumbnailURL  string   `json:"thumbnail_url"`
	Title         string   `json:"title"`
	Description   string   `json:"description"`
	Tags          []string `json:"tags"`
	Category      string   `json:"category"`
	UserID        string   `json:"user_id"`
	Username      string   `json:"username"`
	FullName      string   `json:"full_name"`
	AvatarURL     string   `json:"avatar_url"`
	RoleTag       string   `json:"role_tag"`
	IsVerified    bool     `json:"is_verified"`
	LikesCount    int      `json:"likes_count"`
	CommentsCount int      `json:"comments_count"`
	SavesCount    int      `json:"saves_count"`
	IsLiked       bool     `json:"is_liked"`
	IsSaved       bool     `json:"is_saved"`
	IsFollowing   bool     `json:"is_following"`
	IsOwnPost     bool     `json:"is_own_post"`
	ProjectID     *string  `json:"project_id"`
	VideoDuration float64  `json:"video_duration"`
	CreatedAt     string   `json:"created_at"`
}

// ReelsResponse is the paginated wire format returned by GET /api/v1/reels.
type ReelsResponse struct {
	Data    []ReelItem `json:"data"`
	Cursor  *string    `json:"cursor"`
	HasMore bool       `json:"has_more"`
}

// GetReels godoc
// @Summary      Get reels feed
// @Description  Returns a paginated list of `type='reel'` posts with per-viewer flags. Authentication is optional — anonymous viewers get is_liked/is_saved/is_following=false. The `following` tab requires a viewer; anonymous requests fall back to for-you.
// @Tags         reels
// @Produce      json
// @Param        tab     query  string  false  "for-you (default) | following"
// @Param        cursor  query  string  false  "RFC3339 created_at of the last item from the previous page"
// @Param        limit   query  int     false  "Page size (default 10, max 30)"
// @Success      200     {object}  ReelsResponse
// @Router       /api/v1/reels [get]
func (h *ReelsHandler) GetReels(c *gin.Context) {
	viewerID := strings.TrimSpace(c.GetString("user_id"))
	tab := strings.ToLower(strings.TrimSpace(c.DefaultQuery("tab", "for-you")))
	cursor := strings.TrimSpace(c.Query("cursor"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	if limit <= 0 || limit > 30 {
		limit = 10
	}

	// The query references $1 = viewer id. Sub-queries that depend on a viewer
	// short-circuit to false when viewerID is empty, so we always pass *some*
	// value to keep the parameter list aligned regardless of auth state.
	args := []interface{}{viewerID, limit}
	whereClauses := []string{
		"p.type = 'reel'",
		"p.media_url IS NOT NULL",
		"p.media_url <> ''",
		"COALESCE(p.listed_in_feed, TRUE) IS TRUE",
	}

	if tab == "following" && viewerID != "" {
		whereClauses = append(whereClauses,
			`p.user_id IN (SELECT following_id FROM followers WHERE follower_id = $1)`,
		)
	}

	if cursor != "" {
		if t, err := time.Parse(time.RFC3339Nano, cursor); err == nil {
			args = append(args, t)
			whereClauses = append(whereClauses, "p.created_at < $"+strconv.Itoa(len(args)))
		}
	}

	query := `
		SELECT
			p.id,
			COALESCE(p.media_url, '')                                 AS video_url,
			COALESCE(p.thumbnail_url, '')                             AS thumbnail_url,
			COALESCE(NULLIF(TRIM(p.explore_title), ''), '')           AS title,
			COALESCE(p.content, '')                                   AS description,
			COALESCE(p.tags, '{}')                                    AS tags,
			COALESCE(NULLIF(TRIM(p.category), ''), 'general')         AS category,
			u.id                                                      AS user_id,
			COALESCE(NULLIF(TRIM(u.username), ''),
			         split_part(u.email, '@', 1))                     AS username,
			COALESCE(NULLIF(TRIM(u.display_name), ''),
			         NULLIF(TRIM(u.username), ''),
			         split_part(u.email, '@', 1))                     AS full_name,
			COALESCE(NULLIF(TRIM(u.avatar_url), ''), '')              AS avatar_url,
			COALESCE(NULLIF(TRIM(u.role_tag), ''), '')                AS role_tag,
			COALESCE(u.is_verified, FALSE)                            AS is_verified,
			COALESCE(p.like_count, 0)                                 AS likes_count,
			COALESCE(p.comment_count, 0)                              AS comments_count,
			(SELECT COUNT(*) FROM saves s WHERE s.post_id = p.id)     AS saves_count,
			CASE
				WHEN $1 = '' THEN FALSE
				ELSE EXISTS (
					SELECT 1 FROM post_likes pl
					WHERE pl.post_id = p.id AND pl.user_id = $1
				)
			END                                                       AS is_liked,
			CASE
				WHEN $1 = '' THEN FALSE
				ELSE EXISTS (
					SELECT 1 FROM saves s
					WHERE s.post_id = p.id AND s.user_id = $1
				)
			END                                                       AS is_saved,
			CASE
				WHEN $1 = '' THEN FALSE
				ELSE EXISTS (
					SELECT 1 FROM followers f
					WHERE f.follower_id = $1 AND f.following_id = u.id
				)
			END                                                       AS is_following,
			(p.user_id = $1)                                          AS is_own_post,
			p.project_id,
			COALESCE(p.video_duration, 0)                             AS video_duration,
			p.created_at
		FROM posts p
		INNER JOIN users u ON u.id = p.user_id
		WHERE ` + strings.Join(whereClauses, " AND ") + `
		ORDER BY p.created_at DESC
		LIMIT $2
	`

	rows, err := h.db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load reels"})
		return
	}
	defer rows.Close()

	items := make([]ReelItem, 0, limit)
	for rows.Next() {
		var r ReelItem
		var tagsArr pq.StringArray
		var projectID sql.NullString
		var createdAt time.Time
		if err := rows.Scan(
			&r.ID, &r.VideoURL, &r.ThumbnailURL, &r.Title, &r.Description,
			&tagsArr, &r.Category,
			&r.UserID, &r.Username, &r.FullName, &r.AvatarURL, &r.RoleTag, &r.IsVerified,
			&r.LikesCount, &r.CommentsCount, &r.SavesCount,
			&r.IsLiked, &r.IsSaved, &r.IsFollowing, &r.IsOwnPost,
			&projectID, &r.VideoDuration, &createdAt,
		); err != nil {
			continue
		}
		r.Tags = []string(tagsArr)
		if r.Tags == nil {
			r.Tags = []string{}
		}
		if projectID.Valid && strings.TrimSpace(projectID.String) != "" {
			s := projectID.String
			r.ProjectID = &s
		}
		r.CreatedAt = createdAt.UTC().Format(time.RFC3339Nano)
		items = append(items, r)
	}

	hasMore := len(items) == limit
	var next *string
	if hasMore && len(items) > 0 {
		c := items[len(items)-1].CreatedAt
		next = &c
	}

	c.JSON(http.StatusOK, ReelsResponse{Data: items, Cursor: next, HasMore: hasMore})
}

// ToggleSave flips the bookmark state for the current viewer + post pair.
// Idempotent in the sense that the response always reflects the post-toggle
// state, so the client can rely on `saved` instead of tracking the previous
// value itself.
//
// @Summary      Toggle bookmark (save) on a post
// @Tags         reels
// @Produce      json
// @Param        post_id  path  string  true  "Post ID"
// @Security     Bearer
// @Success      200      {object}  map[string]map[string]interface{}
// @Router       /api/v1/posts/{post_id}/save [post]
func (h *ReelsHandler) ToggleSave(c *gin.Context) {
	viewerID := strings.TrimSpace(c.GetString("user_id"))
	if viewerID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}
	postID := strings.TrimSpace(c.Param("post_id"))
	if postID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "post_id required"})
		return
	}

	var exists bool
	if err := h.db.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM saves WHERE user_id=$1 AND post_id=$2)`,
		viewerID, postID,
	).Scan(&exists); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "lookup failed"})
		return
	}

	if exists {
		if _, err := h.db.Exec(`DELETE FROM saves WHERE user_id=$1 AND post_id=$2`, viewerID, postID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "unsave failed"})
			return
		}
	} else {
		if _, err := h.db.Exec(
			`INSERT INTO saves (id, user_id, post_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
			uuid.New().String(), viewerID, postID,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "save failed"})
			return
		}
	}

	var saveCount int
	_ = h.db.QueryRow(`SELECT COUNT(*) FROM saves WHERE post_id=$1`, postID).Scan(&saveCount)

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"saved":       !exists,
		"saves_count": saveCount,
	}})
}
