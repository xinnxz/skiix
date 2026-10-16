package usecase

import (
	"github.com/skiix-backend/internal/domain"
)

type notificationUsecase struct {
	notifRepo domain.NotificationRepository
}

func NewNotificationUsecase(notifRepo domain.NotificationRepository) domain.NotificationUsecase {
	return &notificationUsecase{notifRepo: notifRepo}
}

func (u *notificationUsecase) GetNotifications(userID string, limit int, offset int) ([]domain.NotificationDTO, error) {
	return u.notifRepo.GetNotifications(userID, limit, offset)
}

func (u *notificationUsecase) MarkAllAsRead(userID string) error {
	return u.notifRepo.MarkAllAsRead(userID)
}

func (u *notificationUsecase) MarkAsRead(notificationID string, userID string) error {
	return u.notifRepo.MarkAsRead(notificationID, userID)
}

func (u *notificationUsecase) GetUnreadCount(userID string) (int, error) {
	return u.notifRepo.GetUnreadCount(userID)
}
