package http

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/skiix-backend/internal/usernameutil"
)

// NetworkProjectsHandler lists joined projects for the authenticated Supabase user.
type NetworkProjectsHandler struct {
	db *sql.DB
}

func NewNetworkProjectsHandler(db *sql.DB) *NetworkProjectsHandler {
	return &NetworkProjectsHandler{db: db}
}

type networkProjectDTO struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	LogoURL     string `json:"logo_url"`
	BannerURL   string `json:"banner_url"`
	Category    string `json:"category"`
	OwnerID     string `json:"owner_id"`
	CreatedAt   string `json:"created_at"`
	MyRole      string `json:"my_role"`
	MemberCount int    `json:"member_count"`
}

type networkProjectMemberDTO struct {
	ID          string `json:"id"`
	FullName    string `json:"full_name"`
	Username    string `json:"username"`
	AvatarURL   string `json:"avatar_url"`
	RoleTag     string `json:"role_tag"`
	ProjectRole string `json:"project_role"`
	JoinedAt    string `json:"joined_at"`
}

// GET /api/v1/projects/my — projects the user owns or has joined (via project_members).
func (h *NetworkProjectsHandler) GetMyProjects(c *gin.Context) {
	meRaw, ok := c.Get(SupabaseUserIDContextKey)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	meID := strings.TrimSpace(meRaw.(string))
	if meID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	const q = `
SELECT
	p.id::text,
	TRIM(COALESCE(p.content, '')),
	COALESCE(NULLIF(TRIM(COALESCE(p.media_url, '')), ''), NULLIF(TRIM(COALESCE(p.image_url, '')), ''), ''),
	COALESCE(
		(SELECT pc.category_name FROM post_categories pc WHERE pc.post_id = p.id ORDER BY pc.created_at ASC LIMIT 1),
		'general'
	),
	p.user_id::text,
	p.created_at,
	COALESCE(NULLIF(TRIM(pm.role), ''), 'member'),
	(SELECT COUNT(*)::int FROM project_members pm2 WHERE pm2.project_id = p.id)
FROM posts p
INNER JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
WHERE (p.type = 'project' OR COALESCE(p.is_project, FALSE) = TRUE)
  AND COALESCE(p.project_id, p.id) = p.id
ORDER BY p.created_at DESC
LIMIT $2`

	rows, err := h.db.Query(q, meID, 80)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load projects"})
		return
	}
	defer rows.Close()

	out := make([]networkProjectDTO, 0)
	for rows.Next() {
		var (
			title, logoURL, category, ownerID, myRole string
			createdAt                                time.Time
			memberCount                              int
			id                                       string
		)
		if err := rows.Scan(&id, &title, &logoURL, &category, &ownerID, &createdAt, &myRole, &memberCount); err != nil {
			continue
		}
		out = append(out, networkProjectDTO{
			ID:          id,
			Title:       title,
			Description: "",
			LogoURL:     logoURL,
			BannerURL:   "",
			Category:    category,
			OwnerID:     ownerID,
			CreatedAt:   createdAt.UTC().Format(time.RFC3339Nano),
			MyRole:      myRole,
			MemberCount: memberCount,
		})
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load projects"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": out})
}

type projectDetailDTO struct {
	ID              string `json:"id"`
	Title           string `json:"title"`
	Description     string `json:"description"`
	LogoURL         string `json:"logo_url"`
	BannerURL       string `json:"banner_url"`
	Category        string `json:"category"`
	OwnerID         string `json:"owner_id"`
	CreatedAt       string `json:"created_at"`
	MemberCount     int    `json:"member_count"`
	PostsCount      int    `json:"posts_count"`
	IsJoined        bool   `json:"is_joined"`
	IsOwner         bool   `json:"is_owner"`
	OwnerUsername   string `json:"owner_username"`
	OwnerFullName   string `json:"owner_full_name"`
	OwnerAvatarURL  string `json:"owner_avatar_url"`
}

// GET /api/v1/projects/:id/detail — public project root (post-backed).
func (h *NetworkProjectsHandler) GetProjectDetail(c *gin.Context) {
	projectID := strings.TrimSpace(c.Param("id"))
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project id required"})
		return
	}

	meID := ""
	if raw, ok := c.Get(SupabaseUserIDContextKey); ok {
		if s, ok2 := raw.(string); ok2 {
			meID = strings.TrimSpace(s)
		}
	}

	unSQL := usernameutil.UsernameSQLExpr("u")
	dnSQL := usernameutil.DisplayNameSQLExpr("u")

	q := fmt.Sprintf(`
SELECT
	p.id::text,
	TRIM(COALESCE(p.content, '')),
	TRIM(COALESCE(p.content, '')),
	COALESCE(NULLIF(TRIM(p.media_url), ''), NULLIF(TRIM(p.image_url), ''), ''),
	'',
	COALESCE(NULLIF(TRIM(p.category), ''), 'general'),
	p.user_id::text,
	p.created_at,
	(SELECT COUNT(*)::int FROM project_members pm WHERE pm.project_id = p.id),
	(SELECT COUNT(*)::int FROM posts pu WHERE pu.project_id = p.id AND pu.type = 'project_update'),
	EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = NULLIF($2::text, '')),
	(p.user_id::text = NULLIF($2::text, '')),
	%s,
	%s,
	COALESCE(NULLIF(TRIM(u.avatar_url), ''), '')
FROM posts p
LEFT JOIN users u ON u.id = p.user_id
WHERE p.id = $1
  AND (p.type = 'project' OR (COALESCE(p.is_project, FALSE) AND COALESCE(p.project_id, p.id) = p.id))
`, unSQL, dnSQL)

	var dto projectDetailDTO
	var createdAt time.Time
	err := h.db.QueryRow(q, projectID, meID).Scan(
		&dto.ID, &dto.Title, &dto.Description, &dto.LogoURL, &dto.BannerURL,
		&dto.Category, &dto.OwnerID, &createdAt, &dto.MemberCount, &dto.PostsCount,
		&dto.IsJoined, &dto.IsOwner,
		&dto.OwnerUsername, &dto.OwnerFullName, &dto.OwnerAvatarURL,
	)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load project"})
		return
	}
	dto.CreatedAt = createdAt.UTC().Format(time.RFC3339Nano)
	c.JSON(http.StatusOK, gin.H{"data": dto})
}

// GET /api/v1/projects/:id/members — members of a project (must be a member).
func (h *NetworkProjectsHandler) GetProjectMembers(c *gin.Context) {
	meRaw, ok := c.Get(SupabaseUserIDContextKey)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	meID := strings.TrimSpace(meRaw.(string))
	projectID := strings.TrimSpace(c.Param("id"))
	if projectID == "" || meID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project id required"})
		return
	}

	unSQL := usernameutil.UsernameSQLExpr("u")
	dnSQL := usernameutil.DisplayNameSQLExpr("u")
	q := fmt.Sprintf(`
SELECT
	u.id::text,
	%s,
	%s,
	COALESCE(NULLIF(TRIM(u.avatar_url), ''), ''),
	COALESCE(NULLIF(TRIM(u.role_tag), ''), 'member'),
	COALESCE(NULLIF(TRIM(pm.role), ''), 'member'),
	pm.created_at
FROM project_members pm
JOIN users u ON u.id = pm.user_id
WHERE pm.project_id = $1
ORDER BY pm.created_at ASC`, dnSQL, unSQL)

	rows, err := h.db.Query(q, projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load members"})
		return
	}
	defer rows.Close()

	out := make([]networkProjectMemberDTO, 0)
	for rows.Next() {
		var (
			id, fullName, username, avatarURL, roleTag, projectRole string
			joinedAt                                              time.Time
		)
		if err := rows.Scan(&id, &fullName, &username, &avatarURL, &roleTag, &projectRole, &joinedAt); err != nil {
			continue
		}
		out = append(out, networkProjectMemberDTO{
			ID:          id,
			FullName:    fullName,
			Username:    username,
			AvatarURL:   avatarURL,
			RoleTag:     roleTag,
			ProjectRole: projectRole,
			JoinedAt:    joinedAt.UTC().Format(time.RFC3339Nano),
		})
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load members"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": out})
}
