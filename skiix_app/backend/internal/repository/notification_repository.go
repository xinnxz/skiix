package repository

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/skiix-backend/internal/domain"
)

type PostgresNotificationRepository struct {
	db *sql.DB
}

func NewPostgresNotificationRepository(db *sql.DB) domain.NotificationRepository {
	return &PostgresNotificationRepository{db: db}
}

func (r *PostgresNotificationRepository) GetNotifications(userID string, limit int, offset int) ([]domain.NotificationDTO, error) {
	query := `
		SELECT n.id, n.user_id, n.actor_id, n.type, n.entity_id, n.is_read, n.created_at,
		       u.username, u.email
		FROM notifications n
		LEFT JOIN users u ON u.id = n.actor_id
		WHERE n.user_id = $1
		ORDER BY n.created_at DESC LIMIT $2 OFFSET $3
	`
	rows, err := r.db.Query(query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.NotificationDTO
	for rows.Next() {
		var n domain.NotificationDTO
		var actorUsername, actorEmail sql.NullString
		if err := rows.Scan(
			&n.ID, &n.UserID, &n.ActorID, &n.Type, &n.EntityID, &n.IsRead, &n.CreatedAt,
			&actorUsername, &actorEmail,
		); err != nil {
			return nil, err
		}
		if n.ActorID != nil && actorUsername.Valid {
			n.Actor = &domain.User{
				ID:       *n.ActorID,
				Username: actorUsername.String,
				Email:    actorEmail.String,
			}
		}
		result = append(result, n)
	}
	return result, nil
}

func (r *PostgresNotificationRepository) MarkAllAsRead(userID string) error {
	_, err := r.db.Exec(`UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`, userID)
	return err
}

func (r *PostgresNotificationRepository) MarkAsRead(notificationID string, userID string) error {
	_, err := r.db.Exec(`UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`, notificationID, userID)
	return err
}

func (r *PostgresNotificationRepository) GetUnreadCount(userID string) (int, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`, userID).Scan(&count)
	return count, err
}

func (r *PostgresNotificationRepository) CreateNotification(n *domain.Notification) error {
	n.ID = uuid.New().String()
	n.CreatedAt = time.Now()
	_, err := r.db.Exec(`
		INSERT INTO notifications (id, user_id, actor_id, type, entity_id, is_read, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, n.ID, n.UserID, n.ActorID, n.Type, n.EntityID, false, n.CreatedAt)
	return err
}
