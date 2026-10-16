package usecase

import (
	"testing"

	"github.com/skiix-backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockMoodRepository struct{ mock.Mock }

func (m *MockMoodRepository) CreateSchedule(s *domain.MoodSchedule) error {
	return m.Called(s).Error(0)
}
func (m *MockMoodRepository) UpdateSchedule(s *domain.MoodSchedule) error {
	return m.Called(s).Error(0)
}
func (m *MockMoodRepository) DeleteSchedule(userID, scheduleID string) error {
	return m.Called(userID, scheduleID).Error(0)
}
func (m *MockMoodRepository) GetSchedules(userID string) ([]domain.MoodSchedule, error) {
	args := m.Called(userID)
	return args.Get(0).([]domain.MoodSchedule), args.Error(1)
}
func (m *MockMoodRepository) GetScheduleByID(userID, scheduleID string) (*domain.MoodSchedule, error) {
	args := m.Called(userID, scheduleID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.MoodSchedule), args.Error(1)
}
func (m *MockMoodRepository) CreateSession(s *domain.MoodSession) error {
	return m.Called(s).Error(0)
}
func (m *MockMoodRepository) GetSessions(userID string, limit int) ([]domain.MoodSession, error) {
	args := m.Called(userID, limit)
	return args.Get(0).([]domain.MoodSession), args.Error(1)
}

type stubPlusChecker struct{ isPlus bool }

func (s stubPlusChecker) IsPlus(_ string) (bool, error) { return s.isPlus, nil }

func TestMoodUsecase_ListOptions_BaseMoodsFree(t *testing.T) {
	uc := NewMoodUsecase(new(MockMoodRepository), stubPlusChecker{isPlus: false})
	opts, isPlus, err := uc.ListOptions("user-1")
	assert.NoError(t, err)
	assert.False(t, isPlus)
	assert.Len(t, opts, 12)

	freeAvailable, plusLocked := 0, 0
	for _, o := range opts {
		if o.Tier == domain.MoodTierFree {
			assert.True(t, o.Available, "free mood %s should be available", o.ID)
			freeAvailable++
		} else {
			assert.False(t, o.Available, "pro mood %s should be locked", o.ID)
			plusLocked++
		}
	}
	assert.Equal(t, 3, freeAvailable)
	assert.Equal(t, 9, plusLocked)
}

func TestEnsureMoodAccess_FreeUserProMoodBlocked(t *testing.T) {
	err := EnsureMoodAccess(stubPlusChecker{isPlus: false}, "user-1", []string{"creative"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "requires Skiix Plus")
}

func TestEnsureMoodAccess_FreeUserFreeMoodsAllowed(t *testing.T) {
	err := EnsureMoodAccess(stubPlusChecker{isPlus: false}, "user-1", []string{"sad", "hype"})
	assert.NoError(t, err)
}

func TestMoodUsecase_LogSession_RequiresPlus(t *testing.T) {
	uc := NewMoodUsecase(new(MockMoodRepository), stubPlusChecker{isPlus: false})
	_, err := uc.LogSession("user-1", "chill")
	assert.EqualError(t, err, "mood scheduling and history require Skiix Plus subscription")
}

func TestMoodUsecase_CreateSchedule_Success(t *testing.T) {
	repo := new(MockMoodRepository)
	uc := NewMoodUsecase(repo, stubPlusChecker{isPlus: true})
	repo.On("GetSchedules", "user-1").Return([]domain.MoodSchedule{}, nil)
	repo.On("CreateSchedule", mock.AnythingOfType("*domain.MoodSchedule")).Return(nil)

	s, err := uc.CreateSchedule("user-1", domain.MoodScheduleInput{
		Mood: "chill", StartTime: "09:00", Timezone: "Asia/Jakarta", Enabled: true,
	})
	assert.NoError(t, err)
	assert.Equal(t, "chill", s.Mood)
}
