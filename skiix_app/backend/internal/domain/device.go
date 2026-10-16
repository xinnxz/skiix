package domain

import "time"

type UserDevice struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	FCMToken   string    `json:"fcm_token"`
	DeviceType string    `json:"device_type"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// QuietHoursSettings stores per-user push quiet hours (PRD-5).
type QuietHoursSettings struct {
	UserID    string `json:"user_id"`
	Enabled   bool   `json:"enabled"`
	StartHour int    `json:"start_hour"`
	EndHour   int    `json:"end_hour"`
	Timezone  string `json:"timezone"`
}

type DeviceRepository interface {
	SaveToken(device *UserDevice) error
	GetTokensByUserID(userID string) ([]string, error)
	RemoveToken(fcmToken string) error
	GetQuietHours(userID string) (*QuietHoursSettings, error)
	SaveQuietHours(settings *QuietHoursSettings) error
}

type DeviceUsecase interface {
	RegisterDeviceToken(userID, fcmToken, deviceType string) error
	UnregisterDeviceToken(fcmToken string) error
	SetQuietHours(userID string, enabled bool, startHour, endHour int, timezone string) (*QuietHoursSettings, error)
	GetQuietHours(userID string) (*QuietHoursSettings, error)
}

type FirebaseService interface {
	Init(credentialsFilePath string) error
	SendPushNotification(tokens []string, title string, body string, data map[string]string) error
	GenerateCustomToken(userID string) (string, error)
}
