package usecase

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/skiix-backend/internal/domain"
	"github.com/skiix-backend/internal/infrastructure"
)

const (
	maxMoodSchedulesPerUser = 10
	maxMoodSessionHistory   = 200
)

var timeHHMM = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)

// MoodUsecase handles mood catalog, Plus scheduling, and Plus history.
type MoodUsecase interface {
	ListOptions(userID string) ([]domain.MoodOption, bool, error)
	LogSession(userID, mood string) (*domain.MoodSession, error)
	GetSessions(userID string, limit int) ([]domain.MoodSession, error)
	CreateSchedule(userID string, in domain.MoodScheduleInput) (*domain.MoodSchedule, error)
	UpdateSchedule(userID, scheduleID string, in domain.MoodScheduleInput) (*domain.MoodSchedule, error)
	DeleteSchedule(userID, scheduleID string) error
	ListSchedules(userID string) ([]domain.MoodSchedule, error)
}

type moodUsecase struct {
	repo        domain.MoodRepository
	plusChecker domain.PlusSubscriberChecker
}

// NewMoodUsecase constructs MoodUsecase.
func NewMoodUsecase(repo domain.MoodRepository, plusChecker domain.PlusSubscriberChecker) MoodUsecase {
	if plusChecker == nil {
		plusChecker = infrastructure.NoopPlusChecker{}
	}
	return &moodUsecase{repo: repo, plusChecker: plusChecker}
}

func (u *moodUsecase) ListOptions(userID string) ([]domain.MoodOption, bool, error) {
	isPlus, err := u.plusChecker.IsPlus(userID)
	if err != nil {
		return nil, false, fmt.Errorf("failed to check subscription: %w", err)
	}
	out := make([]domain.MoodOption, 0, len(domain.ValidPostMoods))
	for _, m := range domain.ValidPostMoods {
		tier := domain.MoodTier(string(m))
		out = append(out, domain.MoodOption{
			ID:        string(m),
			Label:     domain.MoodLabel(string(m)),
			Tier:      tier,
			Available: isPlus || tier == domain.MoodTierFree,
		})
	}
	return out, isPlus, nil
}

func (u *moodUsecase) LogSession(userID, mood string) (*domain.MoodSession, error) {
	if err := u.requirePlus(userID); err != nil {
		return nil, err
	}
	mood = domain.NormalizePostMood(mood)
	if !domain.IsValidPostMood(mood) {
		return nil, fmt.Errorf("invalid mood '%s'", mood)
	}
	if err := u.ensureMoodAccessForUser(userID, mood); err != nil {
		return nil, err
	}
	s := &domain.MoodSession{ID: uuid.New().String(), UserID: userID, Mood: mood}
	if err := u.repo.CreateSession(s); err != nil {
		return nil, err
	}
	return s, nil
}

func (u *moodUsecase) GetSessions(userID string, limit int) ([]domain.MoodSession, error) {
	if err := u.requirePlus(userID); err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 50
	}
	if limit > maxMoodSessionHistory {
		limit = maxMoodSessionHistory
	}
	return u.repo.GetSessions(userID, limit)
}

func (u *moodUsecase) CreateSchedule(userID string, in domain.MoodScheduleInput) (*domain.MoodSchedule, error) {
	if err := u.requirePlus(userID); err != nil {
		return nil, err
	}
	if err := validateScheduleInput(in); err != nil {
		return nil, err
	}
	existing, err := u.repo.GetSchedules(userID)
	if err != nil {
		return nil, err
	}
	if len(existing) >= maxMoodSchedulesPerUser {
		return nil, errors.New("maximum mood schedules reached (10)")
	}
	s := &domain.MoodSchedule{
		UserID:     userID,
		Mood:       domain.NormalizePostMood(in.Mood),
		StartTime:  in.StartTime,
		EndTime:    in.EndTime,
		DaysOfWeek: in.DaysOfWeek,
		Timezone:   strings.TrimSpace(in.Timezone),
		Enabled:    in.Enabled,
	}
	if err := u.ensureMoodAccessForUser(userID, s.Mood); err != nil {
		return nil, err
	}
	if err := u.repo.CreateSchedule(s); err != nil {
		return nil, err
	}
	return s, nil
}

func (u *moodUsecase) UpdateSchedule(userID, scheduleID string, in domain.MoodScheduleInput) (*domain.MoodSchedule, error) {
	if err := u.requirePlus(userID); err != nil {
		return nil, err
	}
	existing, err := u.repo.GetScheduleByID(userID, scheduleID)
	if err != nil {
		return nil, err
	}
	if err := validateScheduleInput(in); err != nil {
		return nil, err
	}
	existing.Mood = domain.NormalizePostMood(in.Mood)
	existing.StartTime = in.StartTime
	existing.EndTime = in.EndTime
	existing.DaysOfWeek = in.DaysOfWeek
	existing.Timezone = strings.TrimSpace(in.Timezone)
	existing.Enabled = in.Enabled
	if err := u.ensureMoodAccessForUser(userID, existing.Mood); err != nil {
		return nil, err
	}
	if err := u.repo.UpdateSchedule(existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (u *moodUsecase) DeleteSchedule(userID, scheduleID string) error {
	if err := u.requirePlus(userID); err != nil {
		return err
	}
	return u.repo.DeleteSchedule(userID, scheduleID)
}

func (u *moodUsecase) ListSchedules(userID string) ([]domain.MoodSchedule, error) {
	if err := u.requirePlus(userID); err != nil {
		return nil, err
	}
	return u.repo.GetSchedules(userID)
}

func (u *moodUsecase) requirePlus(userID string) error {
	isPlus, err := u.plusChecker.IsPlus(userID)
	if err != nil {
		return fmt.Errorf("failed to check subscription: %w", err)
	}
	if !isPlus {
		return errors.New("mood scheduling and history require Skiix Plus subscription")
	}
	return nil
}

func (u *moodUsecase) ensureMoodAccessForUser(userID, mood string) error {
	if domain.IsBasePostMood(mood) {
		return nil
	}
	isPlus, err := u.plusChecker.IsPlus(userID)
	if err != nil {
		return fmt.Errorf("failed to check subscription: %w", err)
	}
	if !isPlus && domain.IsExpandedPostMood(mood) {
		return fmt.Errorf("mood '%s' requires Skiix Plus subscription", mood)
	}
	return nil
}

func validateScheduleInput(in domain.MoodScheduleInput) error {
	mood := domain.NormalizePostMood(in.Mood)
	if !domain.IsValidPostMood(mood) {
		return fmt.Errorf("invalid mood '%s'", in.Mood)
	}
	if !timeHHMM.MatchString(in.StartTime) {
		return errors.New("start_time must be HH:MM (24-hour)")
	}
	if in.EndTime != "" && !timeHHMM.MatchString(in.EndTime) {
		return errors.New("end_time must be HH:MM (24-hour)")
	}
	if strings.TrimSpace(in.Timezone) == "" {
		return errors.New("timezone is required")
	}
	if _, err := time.LoadLocation(strings.TrimSpace(in.Timezone)); err != nil {
		return errors.New("invalid timezone")
	}
	for _, d := range in.DaysOfWeek {
		if d < 0 || d > 6 {
			return errors.New("days_of_week values must be 0-6 (Sun-Sat)")
		}
	}
	return nil
}

// EnsureMoodAccess validates mood ids for post tagging and feed filtering.
func EnsureMoodAccess(plusChecker domain.PlusSubscriberChecker, userID string, moods []string) error {
	if len(moods) == 0 {
		return nil
	}
	isPlus, err := plusChecker.IsPlus(userID)
	if err != nil {
		return fmt.Errorf("failed to check subscription: %w", err)
	}
	for _, mood := range moods {
		mood = domain.NormalizePostMood(mood)
		if domain.IsExpandedPostMood(mood) && !isPlus {
			return fmt.Errorf("mood '%s' requires Skiix Plus subscription", mood)
		}
	}
	return nil
}
