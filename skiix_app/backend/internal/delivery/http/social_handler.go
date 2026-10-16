package http

import (
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/skiix-backend/internal/domain"
	"github.com/skiix-backend/internal/usernameutil"
)

type SocialHandler struct {
	stories domain.StoryRepository
	conns   domain.ConnectionRepository
	users   domain.UserRepository
}

func NewSocialHandler(stories domain.StoryRepository, conns domain.ConnectionRepository, users domain.UserRepository) *SocialHandler {
	return &SocialHandler{stories: stories, conns: conns, users: users}
}

type createStoryRequest struct {
	AuthorEmail  string  `json:"author_email"`
	MediaURL     string  `json:"media_url"`
	MediaType    string  `json:"media_type"` // image|video
	Caption      string  `json:"caption"`
	Location     string  `json:"location"`
	Hashtags     string  `json:"hashtags"`
	Audience     string  `json:"audience"`      // everyone|followers|close_friends
	AllowReplies string  `json:"allow_replies"` // everyone|followers|none
	ExpiresAt    *string `json:"expires_at"`    // RFC3339; optional — defaults +24h
}

type storyResponse struct {
	ID          string  `json:"id"`
	AuthorEmail string  `json:"author_email"`
	MediaURL    string  `json:"media_url"`
	MediaType   string  `json:"media_type"`
	Caption     *string `json:"caption"`
	CreatedAt   string  `json:"created_at"`
	ExpiresAt   string  `json:"expires_at"`
}

func (h *SocialHandler) CreateStory(c *gin.Context) {
	var req createStoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	req.AuthorEmail = strings.TrimSpace(strings.ToLower(req.AuthorEmail))
	if claimEmail, ok := c.Get(SupabaseUserEmailContextKey); ok {
		if em, ok2 := claimEmail.(string); ok2 && strings.TrimSpace(em) != "" {
			req.AuthorEmail = strings.TrimSpace(strings.ToLower(em))
		}
	}
	req.MediaURL = strings.TrimSpace(req.MediaURL)
	req.MediaType = strings.TrimSpace(strings.ToLower(req.MediaType))
	req.Audience = strings.TrimSpace(strings.ToLower(req.Audience))
	req.AllowReplies = strings.TrimSpace(strings.ToLower(req.AllowReplies))

	if req.AuthorEmail == "" || req.MediaURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "author_email and media_url required"})
		return
	}
	if req.MediaType != "image" && req.MediaType != "video" {
		req.MediaType = "image"
	}
	if req.Audience != "everyone" && req.Audience != "followers" && req.Audience != "close_friends" {
		req.Audience = "everyone"
	}
	if req.AllowReplies != "everyone" && req.AllowReplies != "followers" && req.AllowReplies != "none" {
		req.AllowReplies = "everyone"
	}

	now := time.Now().UTC()
	exp := now.Add(24 * time.Hour)
	if req.ExpiresAt != nil {
		t, err := time.Parse(time.RFC3339, strings.TrimSpace(*req.ExpiresAt))
		if err == nil && t.After(now) && t.Before(now.Add(48*time.Hour)) {
			exp = t.UTC()
		}
	}
	var captionPtr *string
	if strings.TrimSpace(req.Caption) != "" {
		s := strings.TrimSpace(req.Caption)
		captionPtr = &s
	}
	var locPtr *string
	if strings.TrimSpace(req.Location) != "" {
		s := strings.TrimSpace(req.Location)
		locPtr = &s
	}
	var tagsPtr *string
	if strings.TrimSpace(req.Hashtags) != "" {
		s := strings.TrimSpace(req.Hashtags)
		tagsPtr = &s
	}

	story := &domain.Story{
		ID:           uuid.New().String(),
		AuthorEmail:  req.AuthorEmail,
		MediaURL:     req.MediaURL,
		MediaType:    req.MediaType,
		Caption:      captionPtr,
		Location:     locPtr,
		Hashtags:     tagsPtr,
		Audience:     req.Audience,
		AllowReplies: req.AllowReplies,
		CreatedAt:    now,
		ExpiresAt:    exp,
	}
	if err := h.stories.Create(story); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create story"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"data": storyResponse{
			ID:          story.ID,
			AuthorEmail: story.AuthorEmail,
			MediaURL:    story.MediaURL,
			MediaType:   story.MediaType,
			Caption:     story.Caption,
			CreatedAt:   story.CreatedAt.Format(time.RFC3339),
			ExpiresAt:   story.ExpiresAt.Format(time.RFC3339),
		},
		"error": nil,
	})
}

func (h *SocialHandler) GetStoryFeed(c *gin.Context) {
	email := strings.TrimSpace(strings.ToLower(c.Query("email")))
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": "email is required"})
		return
	}

	items, err := h.stories.Feed(email, 80)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": "failed to load stories"})
		return
	}

	seen, _ := h.stories.ListSeenStoryIDs(email)

	ordered := make([]string, 0)
	byAuthor := map[string][]domain.Story{}

	for _, s := range items {
		a := strings.ToLower(strings.TrimSpace(s.AuthorEmail))
		if a == "" {
			continue
		}
		if _, ok := byAuthor[a]; !ok {
			ordered = append(ordered, a)
			byAuthor[a] = []domain.Story{}
		}
		if len(byAuthor[a]) < 12 {
			byAuthor[a] = append(byAuthor[a], s)
		}
	}

	out := make([]domain.StoryRingBucket, 0, len(ordered))
	for _, authorEmail := range ordered {
		list := byAuthor[authorEmail]
		if len(list) == 0 {
			continue
		}
		u, _ := h.users.FindByEmail(authorEmail)
		uid := ""
		if u != nil {
			uid = u.ID
		}
		handle := authorEmail
		if u != nil {
			handle = usernameutil.DisplayHandle(u.Username, u.Email, u.ID)
		} else if i := strings.Index(handle, "@"); i > 0 {
			handle = handle[:i]
		}
		if handle == "" {
			handle = "user"
		}
		avatar := "https://ui-avatars.com/api/?name=" + url.QueryEscape(handle) + "&background=0A0F12&color=70DAFF&size=128"
		if u != nil && strings.TrimSpace(u.AvatarURL) != "" {
			avatar = strings.TrimSpace(u.AvatarURL)
		}
		ring := make([]domain.StoryRingStory, 0, len(list))
		hasUnseen := false
		for _, s2 := range list {
			if !seen[s2.ID] {
				hasUnseen = true
			}
			ring = append(ring, domain.StoryRingStory{
				ID:        s2.ID,
				MediaURL:  s2.MediaURL,
				MediaType: s2.MediaType,
				Caption:   s2.Caption,
				CreatedAt: s2.CreatedAt.Format(time.RFC3339),
				ExpiresAt: s2.ExpiresAt.Format(time.RFC3339),
			})
		}

		out = append(out, domain.StoryRingBucket{
			UserID:    uid,
			Username:  handle,
			AvatarURL: avatar,
			HasUnseen: hasUnseen,
			Stories:   ring,
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": out, "error": nil})
}

type markStorySeenBody struct {
	ViewerEmail string `json:"viewer_email"`
}

func (h *SocialHandler) MarkStorySeen(c *gin.Context) {
	storyID := strings.TrimSpace(c.Param("id"))
	var req markStorySeenBody
	_ = c.ShouldBindJSON(&req)
	viewer := strings.TrimSpace(strings.ToLower(req.ViewerEmail))
	if viewer == "" {
		viewer = strings.TrimSpace(strings.ToLower(c.Query("viewer_email")))
	}
	if storyID == "" || viewer == "" {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": "viewer_email and story id required"})
		return
	}
	if err := h.stories.MarkStorySeen(viewer, storyID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"ok": true}, "error": nil})
}

type requestConnectionBody struct {
	FromEmail string `json:"from_email"`
	ToEmail   string `json:"to_email"`
}

type connectionResponse struct {
	ID        string `json:"id"`
	FromEmail string `json:"from_email"`
	ToEmail   string `json:"to_email"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

func (h *SocialHandler) RequestConnection(c *gin.Context) {
	var req requestConnectionBody
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	conn, err := h.conns.CreateRequest(req.FromEmail, req.ToEmail)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": connectionResponse{
		ID:        conn.ID,
		FromEmail: conn.FromEmail,
		ToEmail:   conn.ToEmail,
		Status:    conn.Status,
		CreatedAt: conn.CreatedAt.Format(time.RFC3339),
		UpdatedAt: conn.UpdatedAt.Format(time.RFC3339),
	}})
}

type acceptConnectionBody struct {
	ID string `json:"id"`
}

func (h *SocialHandler) AcceptConnection(c *gin.Context) {
	var req acceptConnectionBody
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	if err := h.conns.Accept(req.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to accept"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *SocialHandler) ListConnections(c *gin.Context) {
	email := strings.TrimSpace(strings.ToLower(c.Query("email")))
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email is required"})
		return
	}
	items, err := h.conns.List(email, 50, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load connections"})
		return
	}
	out := make([]connectionResponse, 0, len(items))
	for _, it := range items {
		c2 := it
		out = append(out, connectionResponse{
			ID:        c2.ID,
			FromEmail: c2.FromEmail,
			ToEmail:   c2.ToEmail,
			Status:    c2.Status,
			CreatedAt: c2.CreatedAt.Format(time.RFC3339),
			UpdatedAt: c2.UpdatedAt.Format(time.RFC3339),
		})
	}
	c.JSON(http.StatusOK, gin.H{"data": out})
}

type removeConnectionBody struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

func (h *SocialHandler) RemoveConnection(c *gin.Context) {
	var req removeConnectionBody
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.ID = strings.TrimSpace(req.ID)
	if req.Email == "" || req.ID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and id required"})
		return
	}
	if err := h.conns.Delete(req.ID, req.Email); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
