package usecase

import (
	"errors"
	"fmt"
	"time"

	"github.com/skiix-backend/internal/domain"
)

type deviceUsecase struct {
	deviceRepo domain.DeviceRepository
}

func NewDeviceUsecase(repo domain.DeviceRepository) domain.DeviceUsecase {
	return &deviceUsecase{deviceRepo: repo}
}

func (u *deviceUsecase) RegisterDeviceToken(userID, fcmToken, deviceType string) error {
	device := &domain.UserDevice{
		UserID:     userID,
		FCMToken:   fcmToken,
		DeviceType: deviceType,
	}
	return u.deviceRepo.SaveToken(device)
}

func (u *deviceUsecase) UnregisterDeviceToken(fcmToken string) error {
	return u.deviceRepo.RemoveToken(fcmToken)
}

func (u *deviceUsecase) SetQuietHours(userID string, enabled bool, startHour, endHour int, timezone string) (*domain.QuietHoursSettings, error) {
	if startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23 {
		return nil, errors.New("hour must be between 0 and 23")
	}
	if _, err := time.LoadLocation(timezone); err != nil {
		return nil, fmt.Errorf("invalid timezone: %w", err)
	}

	settings := &domain.QuietHoursSettings{
		UserID:    userID,
		Enabled:   enabled,
		StartHour: startHour,
		EndHour:   endHour,
		Timezone:  timezone,
	}
	if err := u.deviceRepo.SaveQuietHours(settings); err != nil {
		return nil, err
	}
	return settings, nil
}

func (u *deviceUsecase) GetQuietHours(userID string) (*domain.QuietHoursSettings, error) {
	return u.deviceRepo.GetQuietHours(userID)
}
