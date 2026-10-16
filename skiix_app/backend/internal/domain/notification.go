package domain

import "time"

type Notification struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	ActorID   *string   `json:"actor_id,omitempty"`
	Type      string    `json:"type"`
	EntityID  *string   `json:"entity_id,omitempty"`
	IsRead    bool      `json:"is_read"`
	CreatedAt time.Time `json:"created_at"`
}

type NotificationDTO struct {
	Notification
	Actor *User `json:"actor,omitempty"`
}

type NotificationRepository interface {
	GetNotifications(userID string, limit int, offset int) ([]NotificationDTO, error)
	MarkAllAsRead(userID string) error
	MarkAsRead(notificationID string, userID string) error
	GetUnreadCount(userID string) (int, error)
	CreateNotification(n *Notification) error
}

type NotificationUsecase interface {
	GetNotifications(userID string, limit int, offset int) ([]NotificationDTO, error)
	MarkAllAsRead(userID string) error
	MarkAsRead(notificationID string, userID string) error
	GetUnreadCount(userID string) (int, error)
}
