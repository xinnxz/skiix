package repository

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/skiix-backend/internal/domain"
)

type PostgresWaitlistRepository struct {
	db *sql.DB
}

func NewPostgresWaitlistRepository(db *sql.DB) domain.WaitlistRepository {
	return &PostgresWaitlistRepository{db: db}
}

func (r *PostgresWaitlistRepository) Create(signup *domain.WaitlistSignup) error {
	if signup.ID == "" {
		signup.ID = uuid.New().String()
	}
	signup.Email = strings.ToLower(strings.TrimSpace(signup.Email))
	signup.CreatedAt = time.Now()

	query := `
		INSERT INTO waitlist_signups (id, email, name, utm_source, consent_given, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err := r.db.Exec(query,
		signup.ID, signup.Email, signup.Name, signup.UTMSource,
		signup.ConsentGiven, signup.CreatedAt,
	)
	if err != nil && strings.Contains(err.Error(), "waitlist_signups_email_key") {
		return errors.New("email already on waitlist")
	}
	return err
}

func (r *PostgresWaitlistRepository) FindByEmail(email string) (*domain.WaitlistSignup, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	query := `
		SELECT id, email, name, utm_source, consent_given, created_at
		FROM waitlist_signups WHERE email = $1
	`
	s := &domain.WaitlistSignup{}
	err := r.db.QueryRow(query, email).Scan(
		&s.ID, &s.Email, &s.Name, &s.UTMSource, &s.ConsentGiven, &s.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *PostgresWaitlistRepository) List(limit, offset int) ([]domain.WaitlistSignup, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	query := `
		SELECT id, email, name, utm_source, consent_given, created_at
		FROM waitlist_signups
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`
	rows, err := r.db.Query(query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]domain.WaitlistSignup, 0)
	for rows.Next() {
		var s domain.WaitlistSignup
		if err := rows.Scan(
			&s.ID, &s.Email, &s.Name, &s.UTMSource, &s.ConsentGiven, &s.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, s)
	}
	return items, nil
}

func (r *PostgresWaitlistRepository) Count() (int, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM waitlist_signups`).Scan(&count)
	return count, err
}
