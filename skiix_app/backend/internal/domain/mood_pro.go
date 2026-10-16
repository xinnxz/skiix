package domain

import "time"

// MoodOption is a catalog entry returned by GET /moods.
type MoodOption struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	Tier      string `json:"tier"`
	Available bool   `json:"available"`
}

// MoodScheduleInput is the payload for creating/updating a mood schedule.
type MoodScheduleInput struct {
	Mood       string `json:"mood"`
	StartTime  string `json:"start_time"`
	EndTime    string `json:"end_time"`
	DaysOfWeek []int  `json:"days_of_week"`
	Timezone   string `json:"timezone"`
	Enabled    bool   `json:"enabled"`
}

// MoodSchedule lets Plus users auto-apply a feed mood during a time window.
type MoodSchedule struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	Mood       string    `json:"mood"`
	StartTime  string    `json:"start_time"`           // HH:MM (24h)
	EndTime    string    `json:"end_time"`             // HH:MM; empty = until midnight
	DaysOfWeek []int     `json:"days_of_week"`         // 0=Sun..6=Sat; empty = every day
	Timezone   string    `json:"timezone"`             // IANA, e.g. Asia/Jakarta
	Enabled    bool      `json:"enabled"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// MoodSession records an intentional mood selection for Plus history insights.
// Free users never have server-side mood history (PRD-12 §07).
type MoodSession struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Mood      string    `json:"mood"`
	CreatedAt time.Time `json:"created_at"`
}

// MoodRepository persists Plus mood scheduling and history.
type MoodRepository interface {
	CreateSchedule(s *MoodSchedule) error
	UpdateSchedule(s *MoodSchedule) error
	DeleteSchedule(userID, scheduleID string) error
	GetSchedules(userID string) ([]MoodSchedule, error)
	GetScheduleByID(userID, scheduleID string) (*MoodSchedule, error)

	CreateSession(s *MoodSession) error
	GetSessions(userID string, limit int) ([]MoodSession, error)
}
