package http

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/skiix-backend/internal/domain"
	"github.com/skiix-backend/internal/usecase"
)

type PublicPostsHandler struct {
	users domain.UserRepository
	posts usecase.PostUsecase
	// db is used to persist reel-only fields (thumbnail/duration/category/
	// explore_title/tags) that aren't on domain.Post. Optional — when nil the
	// handler falls back to the legacy create-only path.
	db *sql.DB
}

func NewPublicPostsHandler(users domain.UserRepository, posts usecase.PostUsecase) *PublicPostsHandler {
	return &PublicPostsHandler{users: users, posts: posts}
}

// NewPublicPostsHandlerWithDB returns a handler that can also persist the
// extra reel/explore columns directly on `posts` after Create.
func NewPublicPostsHandlerWithDB(users domain.UserRepository, posts usecase.PostUsecase, db *sql.DB) *PublicPostsHandler {
	return &PublicPostsHandler{users: users, posts: posts, db: db}
}

type createPublicPostRequest struct {
	AuthorEmail        string   `json:"author_email"`
	Type               string   `json:"type"`
	Content            string   `json:"content"`
	ImageURL           *string  `json:"image_url"`
	MediaURL           *string  `json:"media_url"`
	IsProject          bool     `json:"is_project"`
	ProjectID          *string  `json:"project_id"`
	Tags               []string `json:"tags"`
	Location           *string  `json:"location"`
	ThumbnailURL       *string  `json:"thumbnail_url"`
	CloudinaryPublicID *string  `json:"cloudinary_public_id"`
	VideoDuration      *float64 `json:"video_duration"`
	AspectWidth        *float64 `json:"aspect_width"`
	AspectHeight       *float64 `json:"aspect_height"`
	Category           *string  `json:"category"`
	ExploreTitle       *string  `json:"explore_title"`
	ExtraMediaURLs     []string `json:"extra_media_urls"`
	IsNewProject       bool     `json:"is_new_project"`
	Metrics            string   `json:"metrics"`
	MilestoneType      string   `json:"milestone_type"`
	ProjectName        string   `json:"project_name"`
}

// CreatePublicPost creates a post for a given email.
// It auto-creates a matching row in the backend `users` table if missing.
func (h *PublicPostsHandler) CreatePublicPost(c *gin.Context) {
	var req createPublicPostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	email := strings.TrimSpace(strings.ToLower(req.AuthorEmail))
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "author_email required"})
		return
	}

	u, err := h.users.FindByEmail(email)
	if err != nil {
		// Auto-create a minimal user row
		provider := "supabase"
		u = &domain.User{
			ID:            uuid.New().String(),
			Email:         email,
			Password:      nil,
			Provider:      &provider,
			EmailVerified: true,
		}
		if err2 := h.users.Create(u); err2 != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
			return
		}
	}

	content := strings.TrimSpace(req.Content)
	if req.Location != nil && strings.TrimSpace(*req.Location) != "" {
		content = content + "\n\n📍 " + strings.TrimSpace(*req.Location)
	}
	if len(req.Tags) > 0 {
		tagParts := make([]string, 0, len(req.Tags))
		for _, raw := range req.Tags {
			t := strings.TrimSpace(raw)
			if t == "" {
				continue
			}
			if !strings.HasPrefix(t, "#") {
				t = "#" + t
			}
			tagParts = append(tagParts, t)
		}
		if len(tagParts) > 0 {
			content = content + "\n\n" + strings.Join(tagParts, " ")
		}
	}

	pType := strings.TrimSpace(strings.ToLower(req.Type))
	if pType == "" {
		if req.IsProject {
			pType = "project"
		} else {
			pType = "text"
		}
	}

	dp := domain.CreatePostRequest{
		Type:           pType,
		Content:        content,
		ImageURL:       req.ImageURL,
		MediaURL:       req.MediaURL,
		IsProject:      req.IsProject && pType != "project_update",
		ProjectID:      req.ProjectID,
		Visibility:     "public",
		CircleID:       nil,
		Categories:     nil,
		Tags:           req.Tags,
		ThumbnailURL:   req.ThumbnailURL,
		CloudinaryPublicID: req.CloudinaryPublicID,
		VideoDuration:  req.VideoDuration,
		AspectWidth:    req.AspectWidth,
		AspectHeight:   req.AspectHeight,
		Category:       req.Category,
		ExploreTitle:   req.ExploreTitle,
		Location:       req.Location,
		ExtraMediaURLs: req.ExtraMediaURLs,
		IsNewProject:   req.IsNewProject,
		Metrics:        strings.TrimSpace(req.Metrics),
		MilestoneType:  strings.TrimSpace(req.MilestoneType),
		ProjectName:    strings.TrimSpace(req.ProjectName),
	}

	p, err := h.posts.CreatePost(u.ID, dp)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Backfill the extra reel/explore columns directly. We do this after Create
	// because they live on the posts table but aren't part of the usecase's
	// CreatePostRequest contract (kept stable for older callers).
	h.applyExtraColumns(p.ID, req)

	c.JSON(http.StatusOK, gin.H{"data": p})
}

// applyExtraColumns persists optional metadata fields (thumbnail, duration,
// tags, category, explore_title) that the mobile reel-publishing flow sends
// alongside the core post body. Missing/empty fields are left untouched.
func (h *PublicPostsHandler) applyExtraColumns(postID string, req createPublicPostRequest) {
	if h.db == nil || strings.TrimSpace(postID) == "" {
		return
	}
	sets := make([]string, 0, 8)
	args := make([]interface{}, 0, 8)
	idx := 1
	appendSet := func(column string, value interface{}) {
		sets = append(sets, column+" = $"+itoa(idx))
		args = append(args, value)
		idx++
	}
	if req.ThumbnailURL != nil && strings.TrimSpace(*req.ThumbnailURL) != "" {
		appendSet("thumbnail_url", strings.TrimSpace(*req.ThumbnailURL))
	}
	if req.CloudinaryPublicID != nil && strings.TrimSpace(*req.CloudinaryPublicID) != "" {
		appendSet("cloudinary_public_id", strings.TrimSpace(*req.CloudinaryPublicID))
	}
	if req.VideoDuration != nil && *req.VideoDuration > 0 {
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
			t = strings.TrimSpace(t)
			if t == "" {
				continue
			}
			clean = append(clean, t)
		}
		if len(clean) > 0 {
			appendSet("tags", pq.Array(clean))
		}
	}
	if len(sets) == 0 {
		return
	}
	args = append(args, postID)
	q := "UPDATE posts SET " + strings.Join(sets, ", ") + " WHERE id = $" + itoa(idx)
	_, _ = h.db.Exec(q, args...)
}

// itoa is a tiny strconv-free integer formatter for query placeholder indices.
// Used to keep this file's imports minimal.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	const digits = "0123456789"
	var buf [12]byte
	pos := len(buf)
	for n > 0 {
		pos--
		buf[pos] = digits[n%10]
		n /= 10
	}
	return string(buf[pos:])
}
