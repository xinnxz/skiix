package repository

import (
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/skiix-backend/internal/domain"
)

type PostgresDeviceRepository struct {
	db *sql.DB
}

func NewPostgresDeviceRepository(db *sql.DB) domain.DeviceRepository {
	return &PostgresDeviceRepository{db: db}
}

func (r *PostgresDeviceRepository) SaveToken(device *domain.UserDevice) error {
	if device.ID == "" {
		device.ID = uuid.New().String()
	}
	device.CreatedAt = time.Now()
	device.UpdatedAt = time.Now()

	// ON CONFLICT DO UPDATE so that if a token exists for this user, we just update the timestamp
	query := `
		INSERT INTO user_devices (id, user_id, fcm_token, device_type, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id, fcm_token) 
		DO UPDATE SET updated_at = $6, device_type = $4
	`
	_, err := r.db.Exec(query, device.ID, device.UserID, device.FCMToken, device.DeviceType, device.CreatedAt, device.UpdatedAt)
	return err
}

func (r *PostgresDeviceRepository) GetTokensByUserID(userID string) ([]string, error) {
	query := `SELECT fcm_token FROM user_devices WHERE user_id = $1`
	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tokens []string
	for rows.Next() {
		var token string
		if err := rows.Scan(&token); err != nil {
			return nil, err
		}
		tokens = append(tokens, token)
	}
	return tokens, nil
}

func (r *PostgresDeviceRepository) RemoveToken(fcmToken string) error {
	query := `DELETE FROM user_devices WHERE fcm_token = $1`
	_, err := r.db.Exec(query, fcmToken)
	return err
}

func (r *PostgresDeviceRepository) GetQuietHours(userID string) (*domain.QuietHoursSettings, error) {
	query := `
		SELECT user_id, enabled, start_hour, end_hour, timezone
		FROM user_quiet_hours
		WHERE user_id = $1
	`
	settings := &domain.QuietHoursSettings{}
	err := r.db.QueryRow(query, userID).Scan(
		&settings.UserID, &settings.Enabled, &settings.StartHour,
		&settings.EndHour, &settings.Timezone,
	)
	if err == sql.ErrNoRows {
		return &domain.QuietHoursSettings{
			UserID:    userID,
			Enabled:   false,
			StartHour: 22,
			EndHour:   7,
			Timezone:  "UTC",
		}, nil
	}
	if err != nil {
		return nil, err
	}
	return settings, nil
}

func (r *PostgresDeviceRepository) SaveQuietHours(settings *domain.QuietHoursSettings) error {
	query := `
		INSERT INTO user_quiet_hours (user_id, enabled, start_hour, end_hour, timezone, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id) DO UPDATE SET
			enabled = EXCLUDED.enabled,
			start_hour = EXCLUDED.start_hour,
			end_hour = EXCLUDED.end_hour,
			timezone = EXCLUDED.timezone,
			updated_at = EXCLUDED.updated_at
	`
	_, err := r.db.Exec(query,
		settings.UserID, settings.Enabled, settings.StartHour,
		settings.EndHour, settings.Timezone, time.Now(),
	)
	if err != nil {
		return errors.New("failed to save quiet hours")
	}
	return nil
}
