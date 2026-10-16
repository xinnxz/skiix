package http

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/skiix-backend/internal/usernameutil"
)

// ConversationsHandler manages DM threads in Supabase Postgres (conversations + conversation_participants).
type ConversationsHandler struct {
	db *sql.DB
}

func NewConversationsHandler(db *sql.DB) *ConversationsHandler {
	ensureConversationParticipantColumns(db)
	return &ConversationsHandler{db: db}
}

func ensureConversationParticipantColumns(db *sql.DB) {
	stmts := []string{
		`ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false`,
		`ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS is_muted boolean DEFAULT false`,
	}
	for _, q := range stmts {
		if _, err := db.Exec(q); err != nil {
			log.Printf("conversation_participants migration: %v", err)
		}
	}
}

type inboxConversationRow struct {
	ID              string `json:"id"`
	UpdatedAt       string `json:"updated_at"`
	OtherUserID     string `json:"other_user_id"`
	OtherUsername   string `json:"other_username"`
	OtherFullName   string `json:"other_full_name"`
	OtherAvatarURL  string `json:"other_avatar_url"`
	LastMessage     string `json:"last_message"`
	LastMessageType string `json:"last_message_type"`
	LastMessageAt   string `json:"last_message_at"`
	LastSenderID    string `json:"last_sender_id"`
	UnreadCount     int    `json:"unread_count"`
	IsPinned        bool   `json:"is_pinned"`
	IsMuted         bool   `json:"is_muted"`
	IsOnline        bool   `json:"is_online"`
}

type createConversationRequest struct {
	RecipientID string `json:"recipient_id" binding:"required"`
}

// CreateOrGetConversation POST /api/v1/conversations
// Finds an existing 1:1 thread or creates one. Auth: Supabase access token.
func (h *ConversationsHandler) CreateOrGetConversation(c *gin.Context) {
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

	var req createConversationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "recipient_id required"})
		return
	}
	recipientID := strings.TrimSpace(req.RecipientID)
	if recipientID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "recipient_id required"})
		return
	}
	if recipientID == meID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot message yourself"})
		return
	}

	convID, err := h.findDirectConversation(meID, recipientID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup conversation"})
		return
	}
	if convID == "" {
		contacts := NewMessagingContactsHandler(h.db)
		allowed, permErr := contacts.CanMessage(meID, recipientID)
		if permErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "permission check failed"})
			return
		}
		if !allowed {
			c.JSON(http.StatusForbidden, gin.H{"error": "you can only message followers, following, project members, or existing contacts"})
			return
		}
		convID, err = h.createDirectConversation(meID, recipientID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create conversation"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"id":               convID,
			"conversation_id": convID,
			"recipient_id":     recipientID,
			"is_group":         false,
		},
	})
}

// ListConversations GET /api/v1/conversations
func (h *ConversationsHandler) ListConversations(c *gin.Context) {
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

	rows, err := h.db.Query(listConversationsSQL(), meID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load conversations"})
		return
	}
	defer rows.Close()

	out := make([]inboxConversationRow, 0)
	for rows.Next() {
		var row inboxConversationRow
		var updatedAt, lastMsgAt sql.NullTime
		var lastMsg, lastMsgType, lastSender sql.NullString
		if err := rows.Scan(
			&row.ID,
			&updatedAt,
			&row.OtherUserID,
			&row.OtherUsername,
			&row.OtherFullName,
			&row.OtherAvatarURL,
			&lastMsg,
			&lastMsgType,
			&lastMsgAt,
			&lastSender,
			&row.UnreadCount,
			&row.IsPinned,
			&row.IsMuted,
			&row.IsOnline,
		); err != nil {
			continue
		}
		if updatedAt.Valid {
			row.UpdatedAt = updatedAt.Time.UTC().Format(time.RFC3339Nano)
		}
		row.LastMessage = lastMsg.String
		row.LastMessageType = lastMsgType.String
		if row.LastMessageType == "" {
			row.LastMessageType = "text"
		}
		if lastMsgAt.Valid {
			row.LastMessageAt = lastMsgAt.Time.UTC().Format(time.RFC3339Nano)
		} else if updatedAt.Valid {
			row.LastMessageAt = updatedAt.Time.UTC().Format(time.RFC3339Nano)
		}
		row.LastSenderID = lastSender.String
		out = append(out, row)
	}

	c.JSON(http.StatusOK, gin.H{"data": out})
}

// GetUnreadTotal GET /api/v1/conversations/unread-count
func (h *ConversationsHandler) GetUnreadTotal(c *gin.Context) {
	meID := strings.TrimSpace(c.GetString(SupabaseUserIDContextKey))
	if meID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	var total int
	err := h.db.QueryRow(`
		SELECT COALESCE(SUM(cnt), 0)::int FROM (
			SELECT COUNT(m.id)::int AS cnt
			FROM conversation_participants cp
			JOIN messages m ON m.conversation_id = cp.conversation_id
			WHERE cp.user_id = $1
			  AND m.sender_id <> $1
			  AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamptz)
			  AND COALESCE(m.is_deleted, false) = false
			GROUP BY cp.conversation_id
		) t`, meID,
	).Scan(&total)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "count failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"unread_count": total}})
}

// MarkConversationRead POST /api/v1/conversations/:id/read
func (h *ConversationsHandler) MarkConversationRead(c *gin.Context) {
	meID := strings.TrimSpace(c.GetString(SupabaseUserIDContextKey))
	convID := strings.TrimSpace(c.Param("id"))
	if meID == "" || convID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if !h.isConversationParticipant(convID, meID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	now := time.Now().UTC()
	_, _ = h.db.Exec(
		`UPDATE conversation_participants SET last_read_at = $1 WHERE conversation_id = $2 AND user_id = $3`,
		now, convID, meID,
	)
	participants, _ := h.getConversationParticipantIDs(convID)
	BroadcastMessageRead(convID, meID, participants)
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"read_at": now.Format(time.RFC3339Nano)}})
}

type typingBody struct {
	Typing bool `json:"typing"`
}

// SetTyping POST /api/v1/conversations/:id/typing
func (h *ConversationsHandler) SetTyping(c *gin.Context) {
	meID := strings.TrimSpace(c.GetString(SupabaseUserIDContextKey))
	convID := strings.TrimSpace(c.Param("id"))
	if meID == "" || convID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	var body typingBody
	_ = c.ShouldBindJSON(&body)
	participants, _ := h.getConversationParticipantIDs(convID)
	BroadcastTyping(convID, meID, participants, body.Typing)
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"ok": true}})
}

func (h *ConversationsHandler) getConversationParticipantIDs(convID string) ([]string, error) {
	rows, err := h.db.Query(
		`SELECT user_id::text FROM conversation_participants WHERE conversation_id = $1`, convID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := make([]string, 0, 2)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil && id != "" {
			ids = append(ids, id)
		}
	}
	return ids, nil
}

func listConversationsSQL() string {
	un := usernameutil.UsernameSQLExpr("u")
	dn := usernameutil.DisplayNameSQLExpr("u")
	return fmt.Sprintf(`
SELECT
    conv.id::text,
    conv.updated_at,
    cp2.user_id,
    %s,
    %s,
    COALESCE(NULLIF(TRIM(u.avatar_url), ''), ''),
    COALESCE(m.content, ''),
    COALESCE(m.message_type, 'text'),
    COALESCE(m.created_at, conv.created_at),
    COALESCE(m.sender_id, ''),
    COUNT(unread.id)::int,
    COALESCE(cp.is_pinned, false),
    COALESCE(cp.is_muted, false),
    COALESCE(up.is_online, false)
FROM conversations conv
JOIN conversation_participants cp
  ON cp.conversation_id = conv.id AND cp.user_id = $1
JOIN conversation_participants cp2
  ON cp2.conversation_id = conv.id AND cp2.user_id <> $1
JOIN users u ON u.id = cp2.user_id
LEFT JOIN LATERAL (
    SELECT content, message_type, created_at, sender_id
    FROM messages
    WHERE conversation_id = conv.id
      AND COALESCE(is_deleted, false) = false
    ORDER BY created_at DESC
    LIMIT 1
) m ON true
LEFT JOIN messages unread
  ON unread.conversation_id = conv.id
 AND unread.sender_id <> $1
 AND unread.created_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamptz)
 AND COALESCE(unread.is_deleted, false) = false
LEFT JOIN user_presence up ON up.user_id = cp2.user_id
GROUP BY conv.id, conv.updated_at, cp2.user_id,
         u.id, u.username, u.display_name, u.email, u.avatar_url,
         m.content, m.message_type, m.created_at, m.sender_id,
         cp.is_pinned, cp.is_muted, up.is_online
ORDER BY COALESCE(cp.is_pinned, false) DESC, conv.updated_at DESC
`, un, dn)
}

type togglePinRequest struct {
	Pinned bool `json:"pinned"`
}

type toggleMuteRequest struct {
	Muted bool `json:"muted"`
}

// TogglePin POST /api/v1/conversations/:id/pin
func (h *ConversationsHandler) TogglePin(c *gin.Context) {
	h.toggleParticipantFlag(c, "is_pinned", "pinned")
}

// ToggleMute POST /api/v1/conversations/:id/mute
func (h *ConversationsHandler) ToggleMute(c *gin.Context) {
	h.toggleParticipantFlag(c, "is_muted", "muted")
}

func (h *ConversationsHandler) toggleParticipantFlag(c *gin.Context, column, jsonKey string) {
	meRaw, ok := c.Get(SupabaseUserIDContextKey)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	meID := strings.TrimSpace(meRaw.(string))
	convID := strings.TrimSpace(c.Param("id"))
	if convID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "conversation id required"})
		return
	}

	var pinned bool
	var muted bool
	if column == "is_pinned" {
		var req togglePinRequest
		_ = c.ShouldBindJSON(&req)
		pinned = req.Pinned
	} else {
		var req toggleMuteRequest
		_ = c.ShouldBindJSON(&req)
		muted = req.Muted
	}

	val := pinned
	if column == "is_muted" {
		val = muted
	}

	q := `UPDATE conversation_participants SET ` + column + ` = $1 WHERE conversation_id = $2 AND user_id = $3`
	res, err := h.db.Exec(q, val, convID, meID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "conversation not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{jsonKey: val}})
}

// LeaveConversation DELETE /api/v1/conversations/:id
func (h *ConversationsHandler) LeaveConversation(c *gin.Context) {
	meRaw, ok := c.Get(SupabaseUserIDContextKey)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	meID := strings.TrimSpace(meRaw.(string))
	convID := strings.TrimSpace(c.Param("id"))
	if convID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "conversation id required"})
		return
	}
	_, err := h.db.Exec(
		`DELETE FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
		convID, meID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"deleted": true}})
}

func (h *ConversationsHandler) isConversationParticipant(convID, userID string) bool {
	if convID == "" || userID == "" {
		return false
	}
	var ok bool
	err := h.db.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2)`,
		convID, userID,
	).Scan(&ok)
	return err == nil && ok
}

// ListMessages GET /api/v1/conversations/:id/messages
func (h *ConversationsHandler) ListMessages(c *gin.Context) {
	meRaw, ok := c.Get(SupabaseUserIDContextKey)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	meID := strings.TrimSpace(meRaw.(string))
	convID := strings.TrimSpace(c.Param("id"))
	if convID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "conversation id required"})
		return
	}
	if !h.isConversationParticipant(convID, meID) {
		_, _ = h.db.Exec(`
			INSERT INTO conversation_participants (id, conversation_id, user_id, joined_at)
			VALUES ($1, $2, $3, NOW()) ON CONFLICT DO NOTHING`,
			uuid.New().String(), convID, meID,
		)
		if !h.isConversationParticipant(convID, meID) {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
	}
	_, _ = h.db.Exec(`
		UPDATE conversation_participants
		SET last_read_at = NOW()
		WHERE conversation_id = $1 AND user_id = $2`,
		convID, meID,
	)
	limit := 50
	if l := strings.TrimSpace(c.Query("limit")); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}
	var peerLastRead sql.NullTime
	_ = h.db.QueryRow(`
		SELECT cp.last_read_at FROM conversation_participants cp
		WHERE cp.conversation_id = $1 AND cp.user_id <> $2
		LIMIT 1`, convID, meID,
	).Scan(&peerLastRead)

	unSQL := usernameutil.UsernameSQLExpr("u")
	dnSQL := usernameutil.DisplayNameSQLExpr("u")
	rows, err := h.db.Query(fmt.Sprintf(`
		SELECT m.id::text, m.conversation_id::text, m.sender_id::text, COALESCE(m.content,''),
			COALESCE(m.message_type,'text'), m.media_url, m.media_thumbnail, m.media_name,
			COALESCE(m.is_deleted,false), COALESCE(m.is_edited,false), m.created_at,
			%s, %s, COALESCE(NULLIF(TRIM(u.avatar_url), ''), ''),
			m.read_at
		FROM messages m
		JOIN users u ON u.id = m.sender_id
		WHERE m.conversation_id = $1 AND COALESCE(m.is_deleted,false) = false
		ORDER BY m.created_at DESC
		LIMIT $2`, unSQL, dnSQL),
		convID, limit,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load messages"})
		return
	}
	defer rows.Close()

	out := make([]gin.H, 0)
	for rows.Next() {
		var id, convIDOut, senderID, content, msgType string
		var senderUsername, senderFullName, senderAvatar string
		var mediaURL, thumb, mediaName sql.NullString
		var isDeleted, isEdited bool
		var createdAt time.Time
		var readAt sql.NullTime
		if err := rows.Scan(
			&id, &convIDOut, &senderID, &content, &msgType,
			&mediaURL, &thumb, &mediaName, &isDeleted, &isEdited, &createdAt,
			&senderUsername, &senderFullName, &senderAvatar,
			&readAt,
		); err != nil {
			continue
		}
		status := "delivered"
		if senderID == meID {
			if readAt.Valid || (peerLastRead.Valid && !createdAt.After(peerLastRead.Time)) {
				status = "read"
			} else {
				status = "delivered"
			}
		}
		row := gin.H{
			"id":              id,
			"conversation_id": convIDOut,
			"sender_id":       senderID,
			"content":         content,
			"message_type":    msgType,
			"is_deleted":      isDeleted,
			"is_edited":       isEdited,
			"created_at":      createdAt.UTC().Format(time.RFC3339Nano),
			"sender_username": senderUsername,
			"sender_full_name": senderFullName,
			"sender_avatar":   senderAvatar,
			"status":          status,
		}
		if readAt.Valid {
			row["read_at"] = readAt.Time.UTC().Format(time.RFC3339Nano)
		}
		if mediaURL.Valid {
			row["media_url"] = mediaURL.String
		}
		if thumb.Valid {
			row["media_thumbnail"] = thumb.String
		}
		if mediaName.Valid {
			row["media_name"] = mediaName.String
		}
		out = append(out, row)
	}
	c.JSON(http.StatusOK, gin.H{"data": out})
}

type createMessageRequest struct {
	Content        string  `json:"content"`
	MessageType    string  `json:"message_type"`
	MediaURL       *string `json:"media_url"`
	MediaThumbnail *string `json:"media_thumbnail"`
	MediaName      *string `json:"media_name"`
}

// CreateMessage POST /api/v1/conversations/:id/messages
func (h *ConversationsHandler) CreateMessage(c *gin.Context) {
	meRaw, ok := c.Get(SupabaseUserIDContextKey)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	meID := strings.TrimSpace(meRaw.(string))
	convID := strings.TrimSpace(c.Param("id"))
	if convID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "conversation id required"})
		return
	}
	if !h.isConversationParticipant(convID, meID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	var req createMessageRequest
	_ = c.ShouldBindJSON(&req)
	mt := strings.TrimSpace(req.MessageType)
	if mt == "" {
		mt = "text"
	}
	content := strings.TrimSpace(req.Content)
	mediaStr := ""
	if req.MediaURL != nil {
		mediaStr = strings.TrimSpace(*req.MediaURL)
	}
	if mediaStr == "" && content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "empty message"})
		return
	}
	msgID := uuid.New().String()
	now := time.Now().UTC()
	_, err := h.db.Exec(`
		INSERT INTO messages (id, conversation_id, sender_id, content, message_type, media_url, media_thumbnail, media_name, created_at, is_deleted, is_edited)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, false)`,
		msgID,
		convID,
		meID,
		content,
		mt,
		nullStringPtr(req.MediaURL),
		nullStringPtr(req.MediaThumbnail),
		nullStringPtr(req.MediaName),
		now,
	)
	if err != nil {
		log.Printf("CreateMessage insert: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send message"})
		return
	}
	if _, err := h.db.Exec(`UPDATE conversations SET updated_at = $1 WHERE id = $2`, now, convID); err != nil {
		log.Printf("CreateMessage bump conversation: %v", err)
	}
	participants, _ := h.getConversationParticipantIDs(convID)
	payload := gin.H{
		"id":            msgID,
		"sender_id":     meID,
		"content":       content,
		"message_type":  mt,
		"is_deleted":    false,
		"is_edited":     false,
		"created_at":    now.UTC().Format(time.RFC3339Nano),
	}
	if mediaStr != "" {
		payload["media_url"] = mediaStr
	}
	if req.MediaThumbnail != nil && strings.TrimSpace(*req.MediaThumbnail) != "" {
		payload["media_thumbnail"] = strings.TrimSpace(*req.MediaThumbnail)
	}
	if req.MediaName != nil && strings.TrimSpace(*req.MediaName) != "" {
		payload["media_name"] = strings.TrimSpace(*req.MediaName)
	}
	if mediaStr != "" {
		_, _ = h.db.Exec(
			`INSERT INTO message_attachments (id, message_id, media_url, media_type, public_id, file_name, created_at)
			 VALUES ($1, $2, $3, $4, NULL, $5, $6) ON CONFLICT DO NOTHING`,
			uuid.New().String(), msgID, mediaStr, mt, nullStringPtr(req.MediaName), now,
		)
	}
	payload["conversation_id"] = convID
	BroadcastMessageSent(convID, meID, participants, payload)
	c.JSON(http.StatusCreated, gin.H{"data": payload})
}

func nullStringPtr(p *string) interface{} {
	if p == nil {
		return nil
	}
	s := strings.TrimSpace(*p)
	if s == "" {
		return nil
	}
	return s
}

func (h *ConversationsHandler) findDirectConversation(userA, userB string) (string, error) {
	const q = `
		SELECT c.id::text
		FROM conversations c
		WHERE EXISTS (
			SELECT 1 FROM conversation_participants cp
			WHERE cp.conversation_id = c.id AND cp.user_id = $1
		)
		AND EXISTS (
			SELECT 1 FROM conversation_participants cp
			WHERE cp.conversation_id = c.id AND cp.user_id = $2
		)
		AND (
			SELECT COUNT(*)::int FROM conversation_participants cp
			WHERE cp.conversation_id = c.id
		) = 2
		ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC
		LIMIT 1
	`
	var id string
	err := h.db.QueryRow(q, userA, userB).Scan(&id)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return id, nil
}

func (h *ConversationsHandler) createDirectConversation(userA, userB string) (string, error) {
	tx, err := h.db.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	now := time.Now().UTC()
	var convID string
	err = tx.QueryRow(
		`INSERT INTO conversations (created_at, updated_at) VALUES ($1, $2) RETURNING id::text`,
		now, now,
	).Scan(&convID)
	if err != nil {
		return "", err
	}

	insertParticipant := `
		INSERT INTO conversation_participants (id, conversation_id, user_id, joined_at)
		VALUES ($1, $2, $3, $4)
	`
	for _, uid := range []string{userA, userB} {
		if _, err := tx.Exec(insertParticipant, uuid.New().String(), convID, uid, now); err != nil {
			return "", err
		}
	}

	if err := tx.Commit(); err != nil {
		return "", err
	}
	return convID, nil
}
