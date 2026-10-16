package repository

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/skiix-backend/internal/domain"
)

// PostgresMoodRepository implements domain.MoodRepository.
type PostgresMoodRepository struct {
	db *sql.DB
}

// NewPostgresMoodRepository creates a mood repository.
func NewPostgresMoodRepository(db *sql.DB) domain.MoodRepository {
	return &PostgresMoodRepository{db: db}
}

func (r *PostgresMoodRepository) CreateSchedule(s *domain.MoodSchedule) error {
	daysJSON, err := json.Marshal(s.DaysOfWeek)
	if err != nil {
		return fmt.Errorf("marshal days_of_week: %w", err)
	}
	now := time.Now()
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	s.CreatedAt = now
	s.UpdatedAt = now

	_, err = r.db.Exec(`
		INSERT INTO mood_schedules (id, user_id, mood_name, start_time, end_time, days_of_week, timezone, enabled, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, s.ID, s.UserID, s.Mood, s.StartTime, nullIfEmpty(s.EndTime), daysJSON, s.Timezone, s.Enabled, s.CreatedAt, s.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create mood schedule: %w", err)
	}
	return nil
}

func (r *PostgresMoodRepository) UpdateSchedule(s *domain.MoodSchedule) error {
	daysJSON, err := json.Marshal(s.DaysOfWeek)
	if err != nil {
		return fmt.Errorf("marshal days_of_week: %w", err)
	}
	s.UpdatedAt = time.Now()
	res, err := r.db.Exec(`
		UPDATE mood_schedules
		SET mood_name = $1, start_time = $2, end_time = $3, days_of_week = $4, timezone = $5, enabled = $6, updated_at = $7
		WHERE id = $8 AND user_id = $9
	`, s.Mood, s.StartTime, nullIfEmpty(s.EndTime), daysJSON, s.Timezone, s.Enabled, s.UpdatedAt, s.ID, s.UserID)
	if err != nil {
		return fmt.Errorf("update mood schedule: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return errors.New("schedule not found")
	}
	return nil
}

func (r *PostgresMoodRepository) DeleteSchedule(userID, scheduleID string) error {
	res, err := r.db.Exec(`DELETE FROM mood_schedules WHERE id = $1 AND user_id = $2`, scheduleID, userID)
	if err != nil {
		return fmt.Errorf("delete mood schedule: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return errors.New("schedule not found")
	}
	return nil
}

func (r *PostgresMoodRepository) GetSchedules(userID string) ([]domain.MoodSchedule, error) {
	rows, err := r.db.Query(`
		SELECT id, user_id, mood_name, start_time, COALESCE(end_time, ''), days_of_week, timezone, enabled, created_at, updated_at
		FROM mood_schedules WHERE user_id = $1 ORDER BY start_time ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list mood schedules: %w", err)
	}
	defer rows.Close()

	var out []domain.MoodSchedule
	for rows.Next() {
		s, err := scanMoodSchedule(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *s)
	}
	return out, rows.Err()
}

func (r *PostgresMoodRepository) GetScheduleByID(userID, scheduleID string) (*domain.MoodSchedule, error) {
	row := r.db.QueryRow(`
		SELECT id, user_id, mood_name, start_time, COALESCE(end_time, ''), days_of_week, timezone, enabled, created_at, updated_at
		FROM mood_schedules WHERE id = $1 AND user_id = $2
	`, scheduleID, userID)
	s, err := scanMoodScheduleRow(row)
	if err == sql.ErrNoRows {
		return nil, errors.New("schedule not found")
	}
	if err != nil {
		return nil, fmt.Errorf("get mood schedule: %w", err)
	}
	return s, nil
}

func (r *PostgresMoodRepository) CreateSession(s *domain.MoodSession) error {
	now := time.Now()
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	s.CreatedAt = now
	_, err := r.db.Exec(`
		INSERT INTO mood_sessions (id, user_id, mood_name, created_at)
		VALUES ($1, $2, $3, $4)
	`, s.ID, s.UserID, s.Mood, s.CreatedAt)
	if err != nil {
		return fmt.Errorf("create mood session: %w", err)
	}
	return nil
}

func (r *PostgresMoodRepository) GetSessions(userID string, limit int) ([]domain.MoodSession, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	rows, err := r.db.Query(`
		SELECT id, user_id, mood_name, created_at
		FROM mood_sessions WHERE user_id = $1
		ORDER BY created_at DESC LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("list mood sessions: %w", err)
	}
	defer rows.Close()

	var out []domain.MoodSession
	for rows.Next() {
		var s domain.MoodSession
		if err := rows.Scan(&s.ID, &s.UserID, &s.Mood, &s.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan mood session: %w", err)
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func scanMoodSchedule(rows *sql.Rows) (*domain.MoodSchedule, error) {
	var s domain.MoodSchedule
	var daysJSON []byte
	var endTime sql.NullString
	if err := rows.Scan(&s.ID, &s.UserID, &s.Mood, &s.StartTime, &endTime, &daysJSON, &s.Timezone, &s.Enabled, &s.CreatedAt, &s.UpdatedAt); err != nil {
		return nil, fmt.Errorf("scan mood schedule: %w", err)
	}
	if endTime.Valid {
		s.EndTime = endTime.String
	}
	if len(daysJSON) > 0 {
		_ = json.Unmarshal(daysJSON, &s.DaysOfWeek)
	}
	return &s, nil
}

func scanMoodScheduleRow(row *sql.Row) (*domain.MoodSchedule, error) {
	var s domain.MoodSchedule
	var daysJSON []byte
	var endTime sql.NullString
	if err := row.Scan(&s.ID, &s.UserID, &s.Mood, &s.StartTime, &endTime, &daysJSON, &s.Timezone, &s.Enabled, &s.CreatedAt, &s.UpdatedAt); err != nil {
		return nil, err
	}
	if endTime.Valid {
		s.EndTime = endTime.String
	}
	if len(daysJSON) > 0 {
		_ = json.Unmarshal(daysJSON, &s.DaysOfWeek)
	}
	return &s, nil
}

func nullIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
