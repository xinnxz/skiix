package domain

import "time"

// WaitlistSignup represents a pre-launch email capture.
type WaitlistSignup struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	Name         *string   `json:"name,omitempty"`
	UTMSource    *string   `json:"utm_source,omitempty"`
	ConsentGiven bool      `json:"consent_given"`
	CreatedAt    time.Time `json:"created_at"`
}

// WaitlistRepository persists waitlist signups.
type WaitlistRepository interface {
	Create(signup *WaitlistSignup) error
	FindByEmail(email string) (*WaitlistSignup, error)
	List(limit, offset int) ([]WaitlistSignup, error)
	Count() (int, error)
}

// AudienceSyncer optionally syncs signups to an external email audience (e.g. Resend).
type AudienceSyncer interface {
	AddContact(email string, name *string) error
}
