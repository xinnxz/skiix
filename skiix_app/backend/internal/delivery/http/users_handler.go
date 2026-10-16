package http

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/skiix-backend/internal/domain"
	"github.com/skiix-backend/internal/usernameutil"
)

// UsersHandler exposes profile / onboarding endpoints.
//
// Identity model: the React Native client authenticates with Supabase, not the
// Go JWT service. To stay consistent with the rest of the public-style routes
// (see follow_handler), these endpoints resolve identity from `user_id` or
// `email` (query string for GET, JSON body for PUT). A missing user row is
// auto-created so a brand-new Supabase user can complete onboarding without
// a separate registration call.
type UsersHandler struct {
	users domain.UserRepository
	db    *sql.DB
}

func NewUsersHandler(users domain.UserRepository, db *sql.DB) *UsersHandler {
	return &UsersHandler{users: users, db: db}
}

// ---------- helpers ----------

func (h *UsersHandler) resolveUser(c *gin.Context, idHint, emailHint string) (*domain.User, error) {
	id := strings.TrimSpace(idHint)
	email := strings.TrimSpace(strings.ToLower(emailHint))

	if id != "" {
		if u, err := h.users.FindByID(id); err == nil && u != nil {
			return u, nil
		}
	}
	if email == "" {
		return nil, errInvalidIdentity
	}
	if u, err := h.users.FindByEmail(email); err == nil && u != nil {
		return u, nil
	}
	// Auto-create when email is provided but user row is missing.
	now := time.Now().UTC()
	newID := id
	if newID == "" {
		newID = uuid.New().String()
	}
	u := &domain.User{
		ID:            newID,
		Email:         email,
		EmailVerified: true,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err := h.users.Create(u); err != nil {
		return nil, err
	}
	return h.users.FindByEmail(email)
}

var errInvalidIdentity = errors.New("user_id or email required")

// validateRoleTag returns canonical role_tag or ("", false) if invalid.
// Empty input is valid (caller may substitute default).
func validateRoleTag(s string) (string, bool) {
	t := strings.TrimSpace(strings.ToLower(s))
	if t == "" {
		return "", true
	}
	if t == "team_member" {
		t = "team"
	}
	switch t {
	case "founder", "investor", "team", "advisor":
		return t, true
	default:
		return "", false
	}
}

func publicDisplayHandle(u *domain.User) string {
	if u == nil {
		return ""
	}
	return usernameutil.DisplayHandle(u.Username, u.Email, u.ID)
}

func publicProfile(u *domain.User) gin.H {
	h := publicDisplayHandle(u)
	fullName := usernameutil.PublicFullName(u.DisplayName, u.Username, u.Email)
	return gin.H{
		"id":                   u.ID,
		"username":             h,
		"display_name":         fullName,
		"full_name":            fullName,
		"handle":               h,
		"avatar_url":           u.AvatarURL,
		"bio":                  u.Bio,
		"location":             u.Location,
		"website":              u.Website,
		"twitter":              u.Twitter,
		"linkedin":             u.LinkedIn,
		"github":               u.GitHub,
		"role_tag":             u.RoleTag,
		"interests":            u.Interests,
		"skills":               u.Skills,
		"is_verified":          u.IsVerified,
		"onboarding_completed": u.OnboardingCompleted,
		"created_at":           u.CreatedAt,
	}
}

func privateProfile(u *domain.User) gin.H {
	out := publicProfile(u)
	out["email"] = u.Email
	out["updated_at"] = u.UpdatedAt
	return out
}

// ---------- GET /api/v1/users/resolve-peer?email=... ----------

// ResolvePeerByEmail returns user id for DM threading (replaces Supabase RPC peer_id_by_email).
func (h *UsersHandler) ResolvePeerByEmail(c *gin.Context) {
	email := strings.TrimSpace(strings.ToLower(c.Query("email")))
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email query parameter required"})
		return
	}
	u, err := h.users.FindByEmail(email)
	if err != nil || u == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"user_id": u.ID}})
}

// ---------- GET /api/v1/users/me?email=... or ?user_id=... ----------

func (h *UsersHandler) GetMe(c *gin.Context) {
	u, err := h.resolveUser(c, c.Query("user_id"), c.Query("email"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, privateProfile(u))
}

// resolveByPathParam looks up a user by the `:user_id` path param. To keep
// the public profile URL clean (`/users/:username`), we accept the value as
// either a username or a UUID — username is tried first.
func (h *UsersHandler) resolveByPathParam(c *gin.Context) (*domain.User, bool) {
	v := strings.TrimSpace(c.Param("user_id"))
	if v == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username required"})
		return nil, false
	}

	// Supabase / app user IDs are UUIDs — support direct profile links by id.
	if parsed, err := uuid.Parse(v); err == nil && parsed != uuid.Nil {
		if u, err := h.users.FindByID(parsed.String()); err == nil && u != nil {
			return u, true
		}
	}

	if u, err := h.users.FindByUsername(v); err == nil && u != nil {
		return u, true
	}
	if u, err := h.users.FindByID(v); err == nil && u != nil {
		return u, true
	}

	el := strings.TrimSpace(strings.ToLower(v))
	if strings.Contains(el, "@") {
		if u, err := h.users.FindByEmail(el); err == nil && u != nil {
			return u, true
		}
	}

	if u, err := h.users.FindByEmailLocalPart(v); err == nil && u != nil {
		return u, true
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
	return nil, false
}

// ---------- GET /api/v1/users/:username ----------

func (h *UsersHandler) GetByUsername(c *gin.Context) {
	u, ok := h.resolveByPathParam(c)
	if !ok {
		return
	}
	c.JSON(http.StatusOK, publicProfile(u))
}

// ---------- GET /api/v1/users/:username/stats ----------

func (h *UsersHandler) GetStatsByUsername(c *gin.Context) {
	u, ok := h.resolveByPathParam(c)
	if !ok {
		return
	}
	s, _ := h.users.GetStats(u.ID)
	c.JSON(http.StatusOK, s)
}

// ---------- GET /api/v1/users/username/available?username=... ----------

func (h *UsersHandler) CheckUsernameAvailable(c *gin.Context) {
	name := strings.TrimSpace(c.Query("username"))
	exceptID := strings.TrimSpace(c.Query("except_user_id"))
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username required"})
		return
	}
	ok, err := h.users.IsUsernameAvailable(name, exceptID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "available": false})
		return
	}
	c.JSON(http.StatusOK, gin.H{"available": ok, "username": strings.ToLower(name)})
}

// ---------- PUT /api/v1/users/me/onboarding ----------

type onboardingBody struct {
	UserID              string   `json:"user_id"`
	Email               string   `json:"email"`
	RoleTag             string   `json:"role_tag"`
	Interests           []string `json:"interests"`
	Skills              []string `json:"skills"`
	OnboardingCompleted *bool    `json:"onboarding_completed"`
}

func (h *UsersHandler) UpdateOnboarding(c *gin.Context) {
	var req onboardingBody
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	u, err := h.resolveUser(c, req.UserID, req.Email)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	completed := true
	if req.OnboardingCompleted != nil {
		completed = *req.OnboardingCompleted
	}
	if req.Interests == nil {
		req.Interests = []string{}
	}
	if req.Skills == nil {
		req.Skills = []string{}
	}
	updated, err := h.users.UpdateOnboarding(u.ID, domain.UserOnboardingPayload{
		RoleTag:             strings.TrimSpace(req.RoleTag),
		Interests:           req.Interests,
		Skills:              req.Skills,
		OnboardingCompleted: completed,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, privateProfile(updated))
}

// ---------- PUT /api/v1/users/me ----------

type updateMeBody struct {
	UserID      string    `json:"user_id"`
	Email       string    `json:"email"`
	Username    *string   `json:"username,omitempty"`
	DisplayName *string   `json:"display_name,omitempty"`
	AvatarURL   *string   `json:"avatar_url,omitempty"`
	Bio         *string   `json:"bio,omitempty"`
	Location    *string   `json:"location,omitempty"`
	Website     *string   `json:"website,omitempty"`
	Twitter     *string   `json:"twitter,omitempty"`
	LinkedIn    *string   `json:"linkedin,omitempty"`
	GitHub      *string   `json:"github,omitempty"`
	RoleTag     *string   `json:"role_tag,omitempty"`
	Interests   *[]string `json:"interests,omitempty"`
	Skills      *[]string `json:"skills,omitempty"`
}

func (h *UsersHandler) UpdateMe(c *gin.Context) {
	var req updateMeBody
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	u, err := h.resolveUser(c, req.UserID, req.Email)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.RoleTag != nil {
		rt, ok := validateRoleTag(*req.RoleTag)
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role_tag"})
			return
		}
		req.RoleTag = &rt
	}
	updated, err := h.users.UpdateProfile(u.ID, domain.UserProfileUpdate{
		Username:    req.Username,
		DisplayName: req.DisplayName,
		AvatarURL:   req.AvatarURL,
		Bio:         req.Bio,
		Location:    req.Location,
		Website:     req.Website,
		Twitter:     req.Twitter,
		LinkedIn:    req.LinkedIn,
		GitHub:      req.GitHub,
		RoleTag:     req.RoleTag,
		Interests:   req.Interests,
		Skills:      req.Skills,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, privateProfile(updated))
}

// ---------- POST /api/v1/users/create-profile (Bearer: Supabase access_token) ----------

type createProfileBody struct {
	ID                  string `json:"id"`
	Email               string `json:"email"`
	FullName            string `json:"full_name"`
	Username            string `json:"username"`
	Role                string `json:"role"`
	RoleTag             string `json:"role_tag"`
	OnboardingCompleted bool   `json:"onboarding_completed"`
}

func (h *UsersHandler) CreateProfile(c *gin.Context) {
	sub, ok := c.Get(SupabaseUserIDContextKey)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	userID := strings.TrimSpace(sub.(string))
	emailClaim, _ := c.Get(SupabaseUserEmailContextKey)
	claimEmail := ""
	if v, ok := emailClaim.(string); ok {
		claimEmail = strings.TrimSpace(strings.ToLower(v))
	}

	var req createProfileBody
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.ID != "" && req.ID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "id must match authenticated user"})
		return
	}
	email := req.Email
	if email == "" {
		email = claimEmail
	}
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email required"})
		return
	}
	if claimEmail != "" && email != claimEmail {
		c.JSON(http.StatusForbidden, gin.H{"error": "email must match authenticated user"})
		return
	}

	rt := strings.TrimSpace(req.RoleTag)
	if rt == "" {
		rt = strings.TrimSpace(req.Role)
	}
	canonical, ok := validateRoleTag(rt)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role_tag"})
		return
	}
	if canonical == "" {
		canonical = "founder"
	}

	idSuffix := userID
	if len(idSuffix) > 4 {
		idSuffix = idSuffix[:4]
	}
	username := usernameutil.SanitizeUsername(req.Username, email, idSuffix)
	u, err := h.users.UpsertSignupProfile(userID, email, req.FullName, username, canonical, req.OnboardingCompleted)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": privateProfile(u)})
}
