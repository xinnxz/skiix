package http

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
	"github.com/skiix-backend/internal/usernameutil"
)

// PostDetailHandler serves enriched single-post payloads for Explore detail screens.
type PostDetailHandler struct {
	db *sql.DB
}

func NewPostDetailHandler(db *sql.DB) *PostDetailHandler {
	return &PostDetailHandler{db: db}
}

type postDetailDTO struct {
	ID            string   `json:"id"`
	Type          string   `json:"type"`
	Content       string   `json:"content"`
	MediaURL      string   `json:"media_url"`
	MediaType     string   `json:"media_type"`
	ThumbnailURL  string   `json:"thumbnail_url"`
	Tags          []string `json:"tags"`
	Location      string   `json:"location"`
	CreatedAt     string   `json:"created_at"`
	LikesCount    int      `json:"likes_count"`
	CommentsCount int      `json:"comments_count"`
	IsLiked       bool     `json:"is_liked"`
	IsSaved       bool     `json:"is_saved"`
	IsFollowing   bool     `json:"is_following"`
	IsOwnPost     bool     `json:"is_own_post"`
	ProjectID     *string  `json:"project_id"`
	ProjectName   string   `json:"project_name"`
	IsNewProject  bool     `json:"is_new_project"`
	Metrics       string   `json:"metrics"`
	UserID        string   `json:"user_id"`
	Username      string   `json:"username"`
	FullName      string   `json:"full_name"`
	AvatarURL     string   `json:"avatar_url"`
	RoleTag       string   `json:"role_tag"`
	IsVerified    bool     `json:"is_verified"`
	IsJoined         bool     `json:"is_joined"`
	ExtraMediaURLs   []string `json:"extra_media_urls"`
	ViewerVibeScore  int      `json:"viewer_vibe_score"`
	VibeLovePct      float64  `json:"vibe_love_pct"`
	VibeNeutralPct   float64  `json:"vibe_neutral_pct"`
	VibeDisagreePct  float64  `json:"vibe_disagree_pct"`
	AvgVibeScore     float64  `json:"avg_vibe_score"`
	VibeCount        int      `json:"vibe_count"`
	SavesCount       int      `json:"saves_count"`
}

// GetPostDetail godoc
// @Summary      Post detail for Explore
// @Tags         posts
// @Produce      json
// @Param        post_id  path  string  true  "Post ID"
// @Success      200  {object}  map[string]postDetailDTO
// @Router       /api/v1/posts/{post_id}/detail [get]
func (h *PostDetailHandler) GetPostDetail(c *gin.Context) {
	postID := strings.TrimSpace(c.Param("post_id"))
	if postID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "post_id required"})
		return
	}

	viewerID := getUserIDFromContext(c)
	if viewerID == "" {
		if raw, ok := c.Get(SupabaseUserIDContextKey); ok {
			if s, ok2 := raw.(string); ok2 {
				viewerID = strings.TrimSpace(s)
			}
		}
	}

	unSQL := usernameutil.UsernameSQLExpr("u")
	dnSQL := usernameutil.DisplayNameSQLExpr("u")

	q := `
		SELECT
			p.id::text,
			COALESCE(NULLIF(TRIM(p.type), ''), 'text'),
			COALESCE(p.content, ''),
			COALESCE(NULLIF(TRIM(p.media_url), ''), NULLIF(TRIM(p.image_url), ''), ''),
			CASE
				WHEN COALESCE(p.type, '') = 'reel' OR COALESCE(p.thumbnail_url, '') <> '' THEN 'video'
				ELSE 'image'
			END,
			COALESCE(p.thumbnail_url, ''),
			COALESCE(p.tags, '{}'),
			COALESCE(p.location, ''),
			p.created_at::text,
			p.like_count,
			p.comment_count,
			EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = NULLIF($2::text, '')),
			EXISTS(SELECT 1 FROM saves s WHERE s.post_id = p.id AND s.user_id = NULLIF($2::text, '')),
			EXISTS(SELECT 1 FROM followers f WHERE f.follower_id = NULLIF($2::text, '') AND f.following_id = p.user_id),
			(p.user_id::text = NULLIF($2::text, '')),
			CASE
				WHEN p.type = 'project' OR p.is_project THEN COALESCE(p.project_id, p.id)::text
				WHEN p.type = 'project_update' AND p.project_id IS NOT NULL THEN p.project_id::text
				ELSE NULL
			END,
			COALESCE(NULLIF(TRIM(p.project_name), ''), NULLIF(TRIM(pr.content), ''), ''),
			COALESCE(p.is_new_project, false),
			COALESCE(p.metrics, ''),
			u.id::text,
			` + unSQL + `,
			` + dnSQL + `,
			COALESCE(NULLIF(TRIM(u.avatar_url), ''), ''),
			COALESCE(NULLIF(TRIM(u.role_tag), ''), ''),
			COALESCE(u.is_verified, false),
			EXISTS(
				SELECT 1 FROM project_members pm
				WHERE pm.user_id = NULLIF($2::text, '')
				  AND pm.project_id = CASE
					WHEN p.type = 'project' OR p.is_project THEN COALESCE(p.project_id, p.id)
					WHEN p.type = 'project_update' AND p.project_id IS NOT NULL THEN p.project_id
					ELSE NULL
				  END
			),
			COALESCE(p.extra_media_urls, '{}'),
			COALESCE((SELECT pv.vibe_score FROM post_vibes pv WHERE pv.post_id = p.id AND pv.user_id = NULLIF($2::text, '')), 0),
			COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE pv2.vibe_score >= 50) / NULLIF(COUNT(*), 0), 1) FROM post_vibes pv2 WHERE pv2.post_id = p.id), 0),
			COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE pv2.vibe_score > -50 AND pv2.vibe_score < 50) / NULLIF(COUNT(*), 0), 1) FROM post_vibes pv2 WHERE pv2.post_id = p.id), 0),
			COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE pv2.vibe_score <= -50) / NULLIF(COUNT(*), 0), 1) FROM post_vibes pv2 WHERE pv2.post_id = p.id), 0),
			COALESCE((SELECT ROUND(AVG(pv3.vibe_score)::numeric, 1) FROM post_vibes pv3 WHERE pv3.post_id = p.id), 0),
			COALESCE((SELECT COUNT(*)::int FROM post_vibes pv4 WHERE pv4.post_id = p.id), 0),
			COALESCE((SELECT COUNT(*)::int FROM saves s2 WHERE s2.post_id = p.id), 0)
		FROM posts p
		INNER JOIN users u ON u.id = p.user_id
		LEFT JOIN posts pr ON pr.id = p.project_id
		WHERE p.id = $1
	`

	var dto postDetailDTO
	var tags pq.StringArray
	var extraURLs pq.StringArray
	var projectID sql.NullString
	err := h.db.QueryRow(q, postID, viewerID).Scan(
		&dto.ID, &dto.Type, &dto.Content, &dto.MediaURL, &dto.MediaType,
		&dto.ThumbnailURL, &tags, &dto.Location, &dto.CreatedAt,
		&dto.LikesCount, &dto.CommentsCount,
		&dto.IsLiked, &dto.IsSaved, &dto.IsFollowing, &dto.IsOwnPost,
		&projectID, &dto.ProjectName, &dto.IsNewProject, &dto.Metrics,
		&dto.UserID, &dto.Username, &dto.FullName, &dto.AvatarURL,
		&dto.RoleTag, &dto.IsVerified, &dto.IsJoined,
		&extraURLs, &dto.ViewerVibeScore, &dto.VibeLovePct, &dto.VibeNeutralPct,
		&dto.VibeDisagreePct, &dto.AvgVibeScore, &dto.VibeCount, &dto.SavesCount,
	)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load post"})
		return
	}

	dto.Tags = []string(tags)
	dto.ExtraMediaURLs = []string(extraURLs)
	if projectID.Valid && strings.TrimSpace(projectID.String) != "" {
		s := projectID.String
		dto.ProjectID = &s
	}
	c.JSON(http.StatusOK, gin.H{"data": dto})
}
