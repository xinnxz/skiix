package http

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// BookmarkActionsHandler handles extended bookmark workflows beyond simple save.
type BookmarkActionsHandler struct {
	db *sql.DB
}

func NewBookmarkActionsHandler(db *sql.DB) *BookmarkActionsHandler {
	return &BookmarkActionsHandler{db: db}
}

type reminderBody struct {
	PostID   string `json:"post_id"`
	RemindAt string `json:"remind_at"` // RFC3339
}

// CreateReminder stores a future reminder for a bookmarked post.
// POST /api/v1/bookmarks/reminder
func (h *BookmarkActionsHandler) CreateReminder(c *gin.Context) {
	userID := strings.TrimSpace(c.GetString("user_id"))
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}
	var body reminderBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	postID := strings.TrimSpace(body.PostID)
	if postID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "post_id required"})
		return
	}
	remindAt, err := time.Parse(time.RFC3339, strings.TrimSpace(body.RemindAt))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "remind_at must be RFC3339"})
		return
	}
	id := uuid.New().String()
	if _, err := h.db.Exec(
		`INSERT INTO bookmark_reminders (id, user_id, post_id, remind_at) VALUES ($1,$2,$3,$4)`,
		id, userID, postID, remindAt.UTC(),
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "reminder failed"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"id": id, "post_id": postID, "remind_at": remindAt.UTC().Format(time.RFC3339)}})
}

type noteBody struct {
	PostID      string `json:"post_id"`
	Title       string `json:"title"`
	Content     string `json:"content"`
	CreatorName string `json:"creator_name"`
}

// CreateNote converts a post into an editable note.
// POST /api/v1/bookmarks/note
func (h *BookmarkActionsHandler) CreateNote(c *gin.Context) {
	userID := strings.TrimSpace(c.GetString("user_id"))
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}
	var body noteBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	postID := strings.TrimSpace(body.PostID)
	id := uuid.New().String()
	title := strings.TrimSpace(body.Title)
	content := strings.TrimSpace(body.Content)
	creator := strings.TrimSpace(body.CreatorName)
	if title == "" {
		title = "Saved from Skiix"
	}
	_, err := h.db.Exec(
		`INSERT INTO notes (id, user_id, post_id, title, content, creator_name) VALUES ($1,$2,NULLIF($3,''),$4,$5,$6)`,
		id, userID, postID, title, content, creator,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "note failed"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"id": id, "title": title}})
}

type workspaceBody struct {
	PostID   string `json:"post_id"`
	Category string `json:"category"`
}

var workspaceCategories = map[string]bool{
	"startup_ideas": true,
	"research":      true,
	"projects":      true,
	"learning":      true,
}

// SaveToWorkspace stores a post in the user's personal workspace.
// POST /api/v1/bookmarks/workspace
func (h *BookmarkActionsHandler) SaveToWorkspace(c *gin.Context) {
	userID := strings.TrimSpace(c.GetString("user_id"))
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
		return
	}
	var body workspaceBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	postID := strings.TrimSpace(body.PostID)
	cat := strings.ToLower(strings.TrimSpace(body.Category))
	if postID == "" || !workspaceCategories[cat] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "post_id and valid category required"})
		return
	}
	id := uuid.New().String()
	_, err := h.db.Exec(
		`INSERT INTO workspace_items (id, user_id, post_id, category) VALUES ($1,$2,$3,$4)
		 ON CONFLICT (user_id, post_id, category) DO NOTHING`,
		id, userID, postID, cat,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "workspace save failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"ok": true, "category": cat}})
}

// GetCalendarICS returns an ICS file for adding a post to the device calendar.
// GET /api/v1/bookmarks/calendar/:post_id
func (h *BookmarkActionsHandler) GetCalendarICS(c *gin.Context) {
	postID := strings.TrimSpace(c.Param("post_id"))
	if postID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "post_id required"})
		return
	}
	var title, content, creator sql.NullString
	var created time.Time
	err := h.db.QueryRow(`
		SELECT COALESCE(NULLIF(TRIM(p.explore_title),''), LEFT(p.content, 120)),
			p.content,
			COALESCE(NULLIF(TRIM(u.username), ''), split_part(u.email, '@', 1)),
			p.created_at
		FROM posts p
		INNER JOIN users u ON u.id = p.user_id
		WHERE p.id = $1`, postID,
	).Scan(&title, &content, &creator, &created)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "post not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "lookup failed"})
		return
	}

	start := time.Now().UTC().Add(24 * time.Hour).Truncate(time.Minute)
	end := start.Add(30 * time.Minute)
	uid := fmt.Sprintf("%s@skiix.app", postID)
	summary := strings.TrimSpace(title.String)
	if summary == "" {
		summary = "Skiix saved post"
	}
	desc := fmt.Sprintf("Creator: %s\n\n%s\n\nhttps://skiix.app/posts/%s",
		creator.String, strings.TrimSpace(content.String), postID)

	ics := fmt.Sprintf(`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Skiix//EN
BEGIN:VEVENT
UID:%s
DTSTAMP:%s
DTSTART:%s
DTEND:%s
SUMMARY:%s
DESCRIPTION:%s
END:VEVENT
END:VCALENDAR`,
		uid,
		time.Now().UTC().Format("20060102T150405Z"),
		start.Format("20060102T150405Z"),
		end.Format("20060102T150405Z"),
		escapeICS(summary),
		escapeICS(desc),
	)

	c.Header("Content-Type", "text/calendar; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="skiix-%s.ics"`, postID))
	c.String(http.StatusOK, ics)
}

func escapeICS(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "\n", "\\n")
	s = strings.ReplaceAll(s, ",", "\\,")
	s = strings.ReplaceAll(s, ";", "\\;")
	return s
}
