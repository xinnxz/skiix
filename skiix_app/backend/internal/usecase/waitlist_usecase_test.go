package usecase

import (
	"testing"

	"github.com/skiix-backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockWaitlistRepository struct{ mock.Mock }

func (m *MockWaitlistRepository) Create(signup *domain.WaitlistSignup) error {
	return m.Called(signup).Error(0)
}
func (m *MockWaitlistRepository) FindByEmail(email string) (*domain.WaitlistSignup, error) {
	args := m.Called(email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.WaitlistSignup), args.Error(1)
}
func (m *MockWaitlistRepository) List(limit, offset int) ([]domain.WaitlistSignup, error) {
	args := m.Called(limit, offset)
	return args.Get(0).([]domain.WaitlistSignup), args.Error(1)
}
func (m *MockWaitlistRepository) Count() (int, error) {
	args := m.Called()
	return args.Int(0), args.Error(1)
}

type MockAudienceSyncer struct{ mock.Mock }

func (m *MockAudienceSyncer) AddContact(email string, name *string) error {
	return m.Called(email, name).Error(0)
}

func TestWaitlistSignUp_Success(t *testing.T) {
	repo := new(MockWaitlistRepository)
	syncer := new(MockAudienceSyncer)
	uc := NewWaitlistUsecase(repo, syncer)

	repo.On("FindByEmail", "user@example.com").Return(nil, nil)
	repo.On("Create", mock.AnythingOfType("*domain.WaitlistSignup")).Return(nil)
	syncer.On("AddContact", "user@example.com", mock.Anything).Return(nil)

	signup, err := uc.SignUp(WaitlistSignupInput{
		Email:        "user@example.com",
		ConsentGiven: true,
	})
	assert.NoError(t, err)
	assert.Equal(t, "user@example.com", signup.Email)
}

func TestWaitlistSignUp_ConsentRequired(t *testing.T) {
	uc := NewWaitlistUsecase(new(MockWaitlistRepository), nil)
	_, err := uc.SignUp(WaitlistSignupInput{Email: "user@example.com", ConsentGiven: false})
	assert.EqualError(t, err, "consent is required")
}

func TestWaitlistSignUp_DuplicateEmail(t *testing.T) {
	repo := new(MockWaitlistRepository)
	uc := NewWaitlistUsecase(repo, nil)

	existing := &domain.WaitlistSignup{Email: "user@example.com"}
	repo.On("FindByEmail", "user@example.com").Return(existing, nil)

	_, err := uc.SignUp(WaitlistSignupInput{Email: "user@example.com", ConsentGiven: true})
	assert.EqualError(t, err, "email already on waitlist")
}
