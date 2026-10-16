package http

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/skiix-backend/internal/usernameutil"
)

// ExploreHandler exposes the Explore tab grid and global search.
// Backed directly by *sql.DB because the queries fan across posts/users and
// don't need the abstractions in the post repository.
type ExploreHandler struct {
	db *sql.DB
}

// NewExploreHandler returns a handler ready to be registered.
func NewExploreHandler(db *sql.DB) *ExploreHandler {
	return &ExploreHandler{db: db}
}

// ExploreItem matches the frontend `ExploreCard` shape — image-first cards
// rendered in a 2-column masonry grid.
type ExploreItem struct {
	ID        string  `json:"id"`
	Title     string  `json:"title"`              // short uppercase label
	ImageURL  string  `json:"image_url"`          // Cloudinary URL (or any HTTPS image)
	Category  string  `json:"category"`           // ai-tech | design | web3 | …
	Type      string  `json:"type"`               // post | project | project_post | project_update
	LinkedID  string  `json:"linked_id"`          // navigate target on tap
	PostID    string  `json:"post_id,omitempty"`  // underlying post id (empty for project roots)
	AspectW   float64 `json:"aspect_w,omitempty"` // original media width (0 if unknown)
	AspectH   float64 `json:"aspect_h,omitempty"` // original media height (0 if unknown)
	Height    int     `json:"height"`             // computed card height for the column
	CreatedAt string  `json:"created_at"`         // RFC3339 — used as the next cursor
}

// ExploreResponse is the paginated wire format expected by the mobile app.
type ExploreResponse struct {
	Data   []ExploreItem `json:"data"`
	Cursor *string       `json:"cursor"`
}

// GetExplore godoc
// @Summary      Get explore grid
// @Description  Paginated masonry feed of posts (and project posts) that have media.
// @Tags         explore
// @Produce      json
// @Param        category  query  string  false  "all | ai-tech | design | web3 | saas | fintech | growth | devtools | ventures | mobile | crypto | hardware"
// @Param        cursor    query  string  false  "RFC3339 created_at of the last item from the previous page"
// @Param        limit     query  int     false  "Page size (default 20, max 50)"
// @Success      200       {object}  ExploreResponse
// @Router       /api/v1/explore [get]
func (h *ExploreHandler) GetExplore(c *gin.Context) {
	category := strings.ToLower(strings.TrimSpace(c.DefaultQuery("category", "all")))
	cursor := strings.TrimSpace(c.Query("cursor"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	args := []interface{}{limit}
	postWhere := []string{
		"p.type NOT IN ('reel', 'story')",
		"COALESCE(NULLIF(TRIM(p.media_url), ''), NULLIF(TRIM(p.image_url), '')) <> ''",
		"COALESCE(p.listed_in_feed, TRUE) IS TRUE",
		`NOT (p.type = 'project' OR (COALESCE(p.is_project, FALSE) AND COALESCE(p.project_id, p.id) = p.id))`,
	}
	projectWhere := []string{
		`(p.type = 'project' OR (COALESCE(p.is_project, FALSE) AND COALESCE(p.project_id, p.id) = p.id))`,
		`COALESCE(NULLIF(TRIM(p.media_url), ''), NULLIF(TRIM(p.image_url), '')) <> ''`,
		"COALESCE(p.listed_in_feed, TRUE) IS TRUE",
	}

	if category != "" && category != "all" {
		args = append(args, category)
		catParam := "$" + strconv.Itoa(len(args))
		postWhere = append(postWhere, "COALESCE(NULLIF(TRIM(p.category), ''), 'general') = "+catParam)
		projectWhere = append(projectWhere, "COALESCE(NULLIF(TRIM(p.category), ''), 'general') = "+catParam)
	}

	if cursor != "" {
		if t, err := time.Parse(time.RFC3339Nano, cursor); err == nil {
			args = append(args, t)
			curParam := "$" + strconv.Itoa(len(args))
			postWhere = append(postWhere, "p.created_at < "+curParam)
			projectWhere = append(projectWhere, "p.created_at < "+curParam)
		}
	}

	query := `
		SELECT id, title, image_url, category, type, linked_id, post_id, aspect_w, aspect_h, created_at
		FROM (
			SELECT
				p.id::text AS id,
				COALESCE(NULLIF(TRIM(UPPER(p.explore_title)), ''),
				         NULLIF(TRIM(UPPER(LEFT(p.content, 24))), ''),
				         'POST') AS title,
				COALESCE(NULLIF(TRIM(p.media_url), ''), NULLIF(TRIM(p.image_url), ''), '') AS image_url,
				COALESCE(NULLIF(TRIM(p.category), ''), 'general') AS category,
				CASE
					WHEN p.type = 'project_update' THEN 'project_update'
					WHEN p.project_id IS NOT NULL THEN 'project_post'
					ELSE 'post'
				END AS type,
				COALESCE(p.project_id, p.id)::text AS linked_id,
				p.id::text AS post_id,
				COALESCE(p.aspect_width, 1.0)::float8 AS aspect_w,
				COALESCE(p.aspect_height, 1.0)::float8 AS aspect_h,
				p.created_at
			FROM posts p
			WHERE ` + strings.Join(postWhere, " AND ") + `

			UNION ALL

			SELECT
				p.id::text AS id,
				COALESCE(NULLIF(TRIM(UPPER(p.explore_title)), ''),
				         NULLIF(TRIM(UPPER(LEFT(p.content, 24))), ''),
				         'PROJECT') AS title,
				COALESCE(NULLIF(TRIM(p.media_url), ''), NULLIF(TRIM(p.image_url), ''), '') AS image_url,
				COALESCE(NULLIF(TRIM(p.category), ''), 'general') AS category,
				'project' AS type,
				p.id::text AS linked_id,
				'' AS post_id,
				COALESCE(p.aspect_width, 1.6)::float8 AS aspect_w,
				COALESCE(p.aspect_height, 1.0)::float8 AS aspect_h,
				p.created_at
			FROM posts p
			WHERE ` + strings.Join(projectWhere, " AND ") + `
		) explore_feed
		ORDER BY created_at DESC
		LIMIT $1
	`

	rows, err := h.db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load explore"})
		return
	}
	defer rows.Close()

	items := make([]ExploreItem, 0, limit)
	for rows.Next() {
		var it ExploreItem
		var createdAt time.Time
		if err := rows.Scan(
			&it.ID, &it.Title, &it.ImageURL, &it.Category,
			&it.Type, &it.LinkedID, &it.PostID, &it.AspectW, &it.AspectH, &createdAt,
		); err != nil {
			continue
		}
		if strings.TrimSpace(it.ImageURL) == "" {
			continue
		}
		it.CreatedAt = createdAt.UTC().Format(time.RFC3339Nano)
		it.Height = computeCardHeight(it.AspectW, it.AspectH, it.ID)
		items = append(items, it)
	}

	var next *string
	if len(items) == limit && len(items) > 0 {
		c := items[len(items)-1].CreatedAt
		next = &c
	}

	c.JSON(http.StatusOK, ExploreResponse{Data: items, Cursor: next})
}

// computeCardHeight produces a deterministic, masonry-friendly height for a
// card. When we have real aspect metadata we use it; otherwise we hash the id
// into a small bucket so the grid still looks varied.
func computeCardHeight(w, h float64, id string) int {
	const colW = 180.0 // approximate per-column width on a typical phone
	if w > 0 && h > 0 {
		ratio := h / w
		switch {
		case ratio > 1.2: // portrait
			cap := 380.0
			if v := colW * ratio; v < cap {
				return int(v)
			}
			return int(cap)
		case ratio < 0.7: // wide → short banner
			return 180
		default:
			return int(colW * 1.1) // near-square
		}
	}
	// Deterministic shuffle when aspect metadata is missing.
	buckets := []int{260, 200, 320, 180, 280, 220, 240, 300}
	var sum int
	for _, b := range id {
		sum += int(b)
	}
	return buckets[sum%len(buckets)]
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

// SearchProject mirrors the projects[] entry consumed by the mobile app.
type SearchProject struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	LogoURL     string `json:"logo_url"`
	Category    string `json:"category"`
	Members     int    `json:"members"`
}

// SearchUser mirrors the users[] entry consumed by the mobile app.
type SearchUser struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	FullName  string `json:"full_name"`
	AvatarURL string `json:"avatar_url"`
	RoleTag   string `json:"role_tag"`
	Followers int    `json:"followers"`
}

// SearchPost mirrors the posts[] entry consumed by the mobile app.
type SearchPost struct {
	ID         string `json:"id"`
	Content    string `json:"content"`
	MediaURL   string `json:"media_url"`
	Type       string `json:"type"`
	AuthorName string `json:"author_name"`
	CreatedAt  string `json:"created_at"`
}

// SearchPayload is wrapped in `{ data: ... }` to match the existing client.
type SearchPayload struct {
	Projects []SearchProject `json:"projects"`
	Users    []SearchUser    `json:"users"`
	Posts    []SearchPost    `json:"posts"`
}

// Search godoc
// @Summary      Global search
// @Description  Search across projects (project-type posts), users, and posts.
// @Tags         explore
// @Produce      json
// @Param        q     query  string  true   "Search query"
// @Param        type  query  string  false  "Reserved — currently always returns all sections"
// @Param        limit query  int     false  "Per-section page size (default 8, max 20)"
// @Success      200   {object}  map[string]SearchPayload
// @Router       /api/v1/search [get]
func (h *ExploreHandler) Search(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "8"))
	if limit <= 0 || limit > 20 {
		limit = 8
	}

	payload := SearchPayload{
		Projects: []SearchProject{},
		Users:    []SearchUser{},
		Posts:    []SearchPost{},
	}

	if q == "" {
		unSQL := usernameutil.UsernameSQLExpr("u")
		dnSQL := usernameutil.DisplayNameSQLExpr("u")
		usersQuery := fmt.Sprintf(`
			SELECT
				u.id,
				%s AS username,
				%s AS full_name,
				COALESCE(NULLIF(TRIM(u.avatar_url), ''), '') AS avatar_url,
				COALESCE(NULLIF(TRIM(u.role_tag), ''), '') AS role_tag,
				(
					SELECT COUNT(*)
					FROM followers f
					WHERE f.following_id = u.id
				) AS follower_count
			FROM users u
			ORDER BY u.created_at DESC
			LIMIT $1
		`, unSQL, dnSQL)
		if rows, err := h.db.Query(usersQuery, limit); err == nil {
			for rows.Next() {
				var u SearchUser
				if err := rows.Scan(&u.ID, &u.Username, &u.FullName, &u.AvatarURL, &u.RoleTag, &u.Followers); err == nil {
					payload.Users = append(payload.Users, u)
				}
			}
			_ = rows.Close()
		}
		c.JSON(http.StatusOK, gin.H{"data": payload})
		return
	}

	pattern := "%" + strings.ToLower(q) + "%"

	// ----- Projects (project-type posts) -----
	projectsQuery := `
		SELECT
			p.id,
			COALESCE(NULLIF(TRIM(p.explore_title), ''),
			         NULLIF(TRIM(LEFT(p.content, 64)), ''),
			         'Project') AS title,
			COALESCE(NULLIF(TRIM(p.content), ''), '') AS description,
			COALESCE(NULLIF(TRIM(p.media_url), ''),
			         NULLIF(TRIM(p.image_url), ''), '') AS logo_url,
			COALESCE(NULLIF(TRIM(p.category), ''), 'general') AS category,
			(
				SELECT COUNT(*)
				FROM project_members pm
				WHERE pm.project_id = COALESCE(p.project_id, p.id)
			) AS member_count
		FROM posts p
		WHERE p.is_project = TRUE
			AND (LOWER(COALESCE(p.explore_title, '')) LIKE $1
			     OR LOWER(COALESCE(p.content, '')) LIKE $1)
		ORDER BY p.created_at DESC
		LIMIT $2
	`
	if rows, err := h.db.Query(projectsQuery, pattern, limit); err == nil {
		for rows.Next() {
			var p SearchProject
			if err := rows.Scan(&p.ID, &p.Title, &p.Description, &p.LogoURL, &p.Category, &p.Members); err == nil {
				payload.Projects = append(payload.Projects, p)
			}
		}
		_ = rows.Close()
	}

	// ----- Users -----
	unSQL := usernameutil.UsernameSQLExpr("u")
	dnSQL := usernameutil.DisplayNameSQLExpr("u")
	usersQuery := fmt.Sprintf(`
		SELECT
			u.id,
			%s AS username,
			%s AS full_name,
			COALESCE(NULLIF(TRIM(u.avatar_url), ''), '') AS avatar_url,
			COALESCE(NULLIF(TRIM(u.role_tag), ''), '') AS role_tag,
			(
				SELECT COUNT(*)
				FROM followers f
				WHERE f.following_id = u.id
			) AS follower_count
		FROM users u
		WHERE LOWER(%s) LIKE $1
		   OR LOWER(%s) LIKE $1
		   OR LOWER(u.email) LIKE $1
		ORDER BY u.created_at DESC
		LIMIT $2
	`, unSQL, dnSQL, unSQL, dnSQL)
	if rows, err := h.db.Query(usersQuery, pattern, limit); err == nil {
		for rows.Next() {
			var u SearchUser
			if err := rows.Scan(&u.ID, &u.Username, &u.FullName, &u.AvatarURL, &u.RoleTag, &u.Followers); err == nil {
				payload.Users = append(payload.Users, u)
			}
		}
		_ = rows.Close()
	}

	// ----- Posts (excluding project posts so they don't dominate results) -----
	postsQuery := `
		SELECT
			p.id,
			LEFT(COALESCE(p.content, ''), 120) AS content,
			COALESCE(NULLIF(TRIM(p.media_url), ''), '') AS media_url,
			COALESCE(NULLIF(TRIM(p.type), ''), 'text') AS type,
			COALESCE(NULLIF(TRIM(u.username), ''), split_part(u.email, '@', 1)) AS author_name,
			p.created_at
		FROM posts p
		INNER JOIN users u ON u.id = p.user_id
		WHERE p.is_project = FALSE
		  AND COALESCE(p.listed_in_feed, TRUE) IS TRUE
		  AND LOWER(COALESCE(p.content, '')) LIKE $1
		ORDER BY p.created_at DESC
		LIMIT $2
	`
	if rows, err := h.db.Query(postsQuery, pattern, limit); err == nil {
		for rows.Next() {
			var p SearchPost
			var t time.Time
			if err := rows.Scan(&p.ID, &p.Content, &p.MediaURL, &p.Type, &p.AuthorName, &t); err == nil {
				p.CreatedAt = t.UTC().Format(time.RFC3339Nano)
				payload.Posts = append(payload.Posts, p)
			}
		}
		_ = rows.Close()
	}

	c.JSON(http.StatusOK, gin.H{"data": payload})
}
