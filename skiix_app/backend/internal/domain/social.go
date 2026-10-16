package domain

import "time"

// StoryRingStory is one slide in the stories carousel for the feed UI.
type StoryRingStory struct {
	ID        string  `json:"id"`
	MediaURL  string  `json:"media_url"`
	MediaType string  `json:"media_type"`
	Caption   *string `json:"caption,omitempty"`
	CreatedAt string  `json:"created_at"`
	ExpiresAt string  `json:"expires_at"`
}

// StoryRingBucket groups active stories under one creator for the horizontal ring UI.
type StoryRingBucket struct {
	UserID    string           `json:"user_id"`
	Username  string           `json:"username"`
	AvatarURL string           `json:"avatar_url"`
	HasUnseen bool             `json:"has_unseen"`
	Stories   []StoryRingStory `json:"stories"`
}

type Story struct {
	ID           string
	AuthorEmail  string
	MediaURL     string
	MediaType    string // image|video
	Caption      *string
	Location     *string
	Hashtags     *string
	Audience     string // everyone|followers|close_friends
	AllowReplies string // everyone|followers|none
	CreatedAt    time.Time
	ExpiresAt    time.Time
}

type Connection struct {
	ID        string
	FromEmail string
	ToEmail   string
	Status    string // pending|accepted|rejected
	CreatedAt time.Time
	UpdatedAt time.Time
}

type StoryRepository interface {
	Create(story *Story) error
	// Feed returns unexpired stories for the given user email:
	// includes self + accepted connections (either direction).
	Feed(forEmail string, limit int) ([]Story, error)
	// SeenStoryIDs returns story ids already viewed by the viewer (within expiry handled by FK delete).
	ListSeenStoryIDs(viewerEmail string) (map[string]bool, error)
	MarkStorySeen(viewerEmail, storyID string) error
}

type ConnectionRepository interface {
	CreateRequest(fromEmail, toEmail string) (*Connection, error)
	Accept(id string) error
	List(forEmail string, limit, offset int) ([]Connection, error)
	// Delete removes a connection row if the given email is from_email or to_email.
	Delete(id string, participantEmail string) error
}
