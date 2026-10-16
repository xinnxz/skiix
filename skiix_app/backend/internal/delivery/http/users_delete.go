package http

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// DeleteMe removes the authenticated user's data from Postgres.
// DELETE /api/v1/users/me — requires Supabase JWT (see routes).
func (h *UsersHandler) DeleteMe(c *gin.Context) {
	if h.db == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete not configured"})
		return
	}

	userID := ""
	if raw, ok := c.Get(SupabaseUserIDContextKey); ok {
		if s, ok2 := raw.(string); ok2 {
			userID = strings.TrimSpace(s)
		}
	}
	if userID == "" {
		u, err := h.resolveUser(c, c.Query("user_id"), c.Query("email"))
		if err != nil || u == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		userID = u.ID
	}

	if err := h.deleteUserCascade(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete account"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"deleted": true}})
}

func (h *UsersHandler) deleteUserCascade(ctx context.Context, userID string) error {
	tx, err := h.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var email string
	_ = tx.QueryRowContext(ctx, `SELECT COALESCE(email,'') FROM users WHERE id = $1`, userID).Scan(&email)
	email = strings.TrimSpace(strings.ToLower(email))

	stmts := []struct {
		q    string
		args []interface{}
	}{
		{`DELETE FROM post_likes WHERE user_id = $1`, []interface{}{userID}},
		{`DELETE FROM comments WHERE user_id = $1`, []interface{}{userID}},
		{`DELETE FROM saves WHERE user_id = $1`, []interface{}{userID}},
		{`DELETE FROM followers WHERE follower_id = $1 OR following_id = $1`, []interface{}{userID}},
		{`DELETE FROM project_members WHERE user_id = $1`, []interface{}{userID}},
		{`DELETE FROM conversation_participants WHERE user_id = $1`, []interface{}{userID}},
		{`DELETE FROM messages WHERE sender_id = $1`, []interface{}{userID}},
		{`DELETE FROM connections WHERE LOWER(from_email) = $1 OR LOWER(to_email) = $1`, []interface{}{email}},
		{`DELETE FROM stories WHERE LOWER(author_email) = $1`, []interface{}{email}},
		{`DELETE FROM posts WHERE user_id = $1`, []interface{}{userID}},
		{`DELETE FROM users WHERE id = $1`, []interface{}{userID}},
	}

	for _, s := range stmts {
		if _, err := tx.ExecContext(ctx, s.q, s.args...); err != nil {
			return err
		}
	}

	return tx.Commit()
}
