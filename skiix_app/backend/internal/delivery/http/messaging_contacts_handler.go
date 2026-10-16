package http

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/skiix-backend/internal/usernameutil"
)

// MessagingContactsHandler returns users the viewer is allowed to message (not entire DB).
type MessagingContactsHandler struct {
	db *sql.DB
}

func NewMessagingContactsHandler(db *sql.DB) *MessagingContactsHandler {
	return &MessagingContactsHandler{db: db}
}

type eligibleContactRow struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	FullName  string `json:"full_name"`
	AvatarURL string `json:"avatar_url"`
	RoleTag   string `json:"role_tag"`
	Source    string `json:"source"`
	IsOnline  bool   `json:"is_online"`
}

func eligibleContactsSQL(search string, limit int) string {
	un := usernameutil.UsernameSQLExpr("u")
	dn := usernameutil.DisplayNameSQLExpr("u")
	searchClause := ""
	if search != "" {
		searchClause = fmt.Sprintf(`
			AND (
				LOWER(%s) LIKE $2
				OR LOWER(%s) LIKE $2
				OR LOWER(u.email) LIKE $2
			)`, un, dn)
	}
	return fmt.Sprintf(`
WITH eligible AS (
	SELECT f.following_id AS user_id, 'following' AS source
	FROM followers f WHERE f.follower_id = $1
	UNION
	SELECT f.follower_id, 'follower' FROM followers f WHERE f.following_id = $1
	UNION
	SELECT pm2.user_id, 'project_member'
	FROM project_members pm1
	JOIN project_members pm2 ON pm2.project_id = pm1.project_id AND pm2.user_id <> $1
	WHERE pm1.user_id = $1
	UNION
	SELECT p.user_id, 'project_owner'
	FROM project_members pm
	JOIN posts p ON p.id = pm.project_id AND (p.type = 'project' OR p.is_project = true)
	WHERE pm.user_id = $1 AND p.user_id <> $1
	UNION
	SELECT cp2.user_id, 'conversation'
	FROM conversation_participants cp1
	JOIN conversation_participants cp2
	  ON cp2.conversation_id = cp1.conversation_id AND cp2.user_id <> $1
	WHERE cp1.user_id = $1
	UNION
	SELECT u2.id, 'connection'
	FROM connections c
	JOIN users me ON me.id = $1
	JOIN users u2 ON u2.id <> $1
	  AND (
	    (LOWER(c.from_email) = LOWER(me.email) AND LOWER(u2.email) = LOWER(c.to_email))
	    OR (LOWER(c.to_email) = LOWER(me.email) AND LOWER(u2.email) = LOWER(c.from_email))
	  )
	WHERE c.status = 'accepted'
)
SELECT DISTINCT ON (u.id)
	u.id::text,
	%s,
	%s,
	COALESCE(NULLIF(TRIM(u.avatar_url), ''), ''),
	COALESCE(NULLIF(TRIM(u.role_tag), ''), ''),
	e.source,
	COALESCE(up.is_online, false)
FROM eligible e
JOIN users u ON u.id = e.user_id
LEFT JOIN user_presence up ON up.user_id = u.id
WHERE u.id <> $1
%s
ORDER BY u.id, e.source
LIMIT %d
`, un, dn, searchClause, limit)
}

// GetEligibleContacts GET /api/v1/messaging/contacts
func (h *MessagingContactsHandler) GetEligibleContacts(c *gin.Context) {
	meID := strings.TrimSpace(c.GetString(SupabaseUserIDContextKey))
	if meID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	q := strings.TrimSpace(strings.ToLower(c.Query("q")))
	limit := 50
	if l, err := strconv.Atoi(c.DefaultQuery("limit", "50")); err == nil && l > 0 && l <= 100 {
		limit = l
	}

	var rows *sql.Rows
	var err error
	if q != "" {
		pattern := "%" + q + "%"
		rows, err = h.db.Query(eligibleContactsSQL(q, limit), meID, pattern)
	} else {
		rows, err = h.db.Query(eligibleContactsSQL("", limit), meID)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load contacts"})
		return
	}
	defer rows.Close()

	out := make([]eligibleContactRow, 0)
	for rows.Next() {
		var row eligibleContactRow
		if err := rows.Scan(
			&row.ID, &row.Username, &row.FullName, &row.AvatarURL, &row.RoleTag, &row.Source, &row.IsOnline,
		); err != nil {
			continue
		}
		out = append(out, row)
	}
	c.JSON(http.StatusOK, gin.H{"data": out})
}

// CanMessage checks whether viewer may start a DM with recipient.
func (h *MessagingContactsHandler) CanMessage(viewerID, recipientID string) (bool, error) {
	if viewerID == "" || recipientID == "" || viewerID == recipientID {
		return false, nil
	}
	var ok bool
	err := h.db.QueryRow(`
		WITH eligible AS (
			SELECT f.following_id AS user_id FROM followers f WHERE f.follower_id = $1
			UNION SELECT f.follower_id FROM followers f WHERE f.following_id = $1
			UNION
			SELECT pm2.user_id FROM project_members pm1
			JOIN project_members pm2 ON pm2.project_id = pm1.project_id
			WHERE pm1.user_id = $1
			UNION
			SELECT p.user_id FROM project_members pm
			JOIN posts p ON p.id = pm.project_id
			WHERE pm.user_id = $1
			UNION
			SELECT cp2.user_id FROM conversation_participants cp1
			JOIN conversation_participants cp2 ON cp2.conversation_id = cp1.conversation_id
			WHERE cp1.user_id = $1
			UNION
			SELECT u2.id FROM connections c
			JOIN users me ON me.id = $1
			JOIN users u2 ON (
				(LOWER(c.from_email) = LOWER(me.email) AND LOWER(u2.email) = LOWER(c.to_email))
				OR (LOWER(c.to_email) = LOWER(me.email) AND LOWER(u2.email) = LOWER(c.from_email))
			) WHERE c.status = 'accepted'
		)
		SELECT EXISTS(SELECT 1 FROM eligible WHERE user_id = $2)`,
		viewerID, recipientID,
	).Scan(&ok)
	return ok, err
}
