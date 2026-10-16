package repository

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/skiix-backend/internal/domain"
)

type PostgresStoryRepository struct {
	db *sql.DB
}

func NewPostgresStoryRepository(db *sql.DB) domain.StoryRepository {
	return &PostgresStoryRepository{db: db}
}

func (r *PostgresStoryRepository) Create(story *domain.Story) error {
	aud := strings.TrimSpace(strings.ToLower(story.Audience))
	if aud == "" {
		aud = "everyone"
	}
	ar := strings.TrimSpace(strings.ToLower(story.AllowReplies))
	if ar == "" {
		ar = "everyone"
	}
	_, err := r.db.Exec(
		`INSERT INTO stories (
			id, author_email, media_url, media_type, caption,
			location, hashtags, audience, allow_replies,
			created_at, expires_at
		 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		story.ID,
		story.AuthorEmail,
		story.MediaURL,
		story.MediaType,
		story.Caption,
		story.Location,
		story.Hashtags,
		aud,
		ar,
		story.CreatedAt,
		story.ExpiresAt,
	)
	return err
}

func (r *PostgresStoryRepository) Feed(forEmail string, limit int) ([]domain.Story, error) {
	if limit <= 0 {
		limit = 30
	}
	if limit > 60 {
		limit = 60
	}
	forEmail = strings.TrimSpace(strings.ToLower(forEmail))
	now := time.Now().UTC()

	// Visible stories: your own, public (everyone), or from accepted connections.
	q := `
	SELECT s.id, s.author_email, s.media_url, s.media_type, s.caption, s.created_at, s.expires_at
	FROM stories s
	WHERE s.expires_at > $2
	  AND (
	    LOWER(TRIM(s.author_email)) = $1
	    OR COALESCE(LOWER(TRIM(s.audience)), 'everyone') = 'everyone'
	    OR EXISTS (
	      SELECT 1 FROM connections c
	      WHERE c.status = 'accepted'
	        AND (
	          (LOWER(TRIM(c.from_email)) = $1 AND LOWER(TRIM(c.to_email)) = LOWER(TRIM(s.author_email)))
	          OR (LOWER(TRIM(c.to_email)) = $1 AND LOWER(TRIM(c.from_email)) = LOWER(TRIM(s.author_email)))
	        )
	    )
	  )
	ORDER BY s.created_at DESC
	LIMIT $3;
	`

	rows, err := r.db.Query(q, forEmail, now, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.Story
	for rows.Next() {
		var s domain.Story
		var caption sql.NullString
		if err := rows.Scan(&s.ID, &s.AuthorEmail, &s.MediaURL, &s.MediaType, &caption, &s.CreatedAt, &s.ExpiresAt); err != nil {
			return nil, err
		}
		if caption.Valid {
			s.Caption = &caption.String
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *PostgresStoryRepository) ListSeenStoryIDs(viewerEmail string) (map[string]bool, error) {
	viewerEmail = strings.TrimSpace(strings.ToLower(viewerEmail))
	if viewerEmail == "" {
		return map[string]bool{}, nil
	}
	rows, err := r.db.Query(`SELECT story_id FROM story_seen WHERE viewer_email = $1`, viewerEmail)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[string]bool)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out[id] = true
	}
	return out, rows.Err()
}

func (r *PostgresStoryRepository) MarkStorySeen(viewerEmail, storyID string) error {
	viewerEmail = strings.TrimSpace(strings.ToLower(viewerEmail))
	storyID = strings.TrimSpace(storyID)
	if viewerEmail == "" || storyID == "" {
		return fmt.Errorf("viewer_email and story_id required")
	}
	_, err := r.db.Exec(
		`INSERT INTO story_seen (viewer_email, story_id)
		 SELECT $1, $2 FROM stories WHERE id = $2 AND expires_at > NOW()
		 ON CONFLICT (viewer_email, story_id) DO NOTHING`,
		viewerEmail, storyID,
	)
	return err
}

type PostgresConnectionRepository struct {
	db *sql.DB
}

func NewPostgresConnectionRepository(db *sql.DB) domain.ConnectionRepository {
	return &PostgresConnectionRepository{db: db}
}

func (r *PostgresConnectionRepository) CreateRequest(fromEmail, toEmail string) (*domain.Connection, error) {
	fromEmail = strings.TrimSpace(strings.ToLower(fromEmail))
	toEmail = strings.TrimSpace(strings.ToLower(toEmail))
	if fromEmail == "" || toEmail == "" {
		return nil, fmt.Errorf("missing email")
	}
	if fromEmail == toEmail {
		return nil, fmt.Errorf("cannot connect to yourself")
	}

	id := uuid.New().String()
	now := time.Now().UTC()
	_, err := r.db.Exec(
		`INSERT INTO connections (id, from_email, to_email, status, created_at, updated_at)
		 VALUES ($1,$2,$3,'pending',$4,$4)
		 ON CONFLICT (from_email, to_email) DO UPDATE SET updated_at = EXCLUDED.updated_at
		`,
		id, fromEmail, toEmail, now,
	)
	if err != nil {
		return nil, err
	}
	return &domain.Connection{
		ID:        id,
		FromEmail: fromEmail,
		ToEmail:   toEmail,
		Status:    "pending",
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

func (r *PostgresConnectionRepository) Accept(id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("missing id")
	}
	_, err := r.db.Exec(`UPDATE connections SET status='accepted', updated_at=NOW() WHERE id=$1`, id)
	return err
}

func (r *PostgresConnectionRepository) List(forEmail string, limit, offset int) ([]domain.Connection, error) {
	forEmail = strings.TrimSpace(strings.ToLower(forEmail))
	if limit <= 0 {
		limit = 30
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	rows, err := r.db.Query(
		`SELECT id, from_email, to_email, status, created_at, updated_at
		 FROM connections
		 WHERE from_email = $1 OR to_email = $1
		 ORDER BY created_at DESC
		 LIMIT $2 OFFSET $3`,
		forEmail, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.Connection
	for rows.Next() {
		var c domain.Connection
		if err := rows.Scan(&c.ID, &c.FromEmail, &c.ToEmail, &c.Status, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *PostgresConnectionRepository) Delete(id string, participantEmail string) error {
	id = strings.TrimSpace(id)
	participantEmail = strings.TrimSpace(strings.ToLower(participantEmail))
	if id == "" || participantEmail == "" {
		return fmt.Errorf("missing id or email")
	}
	res, err := r.db.Exec(
		`DELETE FROM connections WHERE id = $1 AND (LOWER(from_email) = $2 OR LOWER(to_email) = $2)`,
		id,
		participantEmail,
	)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("connection not found")
	}
	return nil
}
