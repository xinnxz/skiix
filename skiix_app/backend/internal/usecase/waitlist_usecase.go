package usecase

import (
	"errors"
	"log/slog"
	"strings"

	"github.com/skiix-backend/internal/domain"
	"github.com/skiix-backend/internal/infrastructure"
)

type WaitlistUsecase struct {
	repo   domain.WaitlistRepository
	syncer domain.AudienceSyncer
}

func NewWaitlistUsecase(repo domain.WaitlistRepository, syncer domain.AudienceSyncer) *WaitlistUsecase {
	if syncer == nil {
		syncer = infrastructure.NoopAudienceSyncer{}
	}
	return &WaitlistUsecase{repo: repo, syncer: syncer}
}

type WaitlistSignupInput struct {
	Email        string
	Name         *string
	UTMSource    *string
	ConsentGiven bool
}

func (u *WaitlistUsecase) SignUp(input WaitlistSignupInput) (*domain.WaitlistSignup, error) {
	email := strings.ToLower(strings.TrimSpace(input.Email))
	if email == "" {
		return nil, errors.New("email is required")
	}
	if len(email) > 254 {
		return nil, errors.New("email is too long")
	}
	if !input.ConsentGiven {
		return nil, errors.New("consent is required")
	}

	existing, err := u.repo.FindByEmail(email)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, errors.New("email already on waitlist")
	}

	var name, utm *string
	if input.Name != nil {
		trimmed := strings.TrimSpace(*input.Name)
		if trimmed != "" {
			name = &trimmed
		}
	}
	if input.UTMSource != nil {
		trimmed := strings.TrimSpace(*input.UTMSource)
		if trimmed != "" {
			utm = &trimmed
		}
	}

	signup := &domain.WaitlistSignup{
		Email:        email,
		Name:         name,
		UTMSource:    utm,
		ConsentGiven: true,
	}
	if err := u.repo.Create(signup); err != nil {
		if err.Error() == "email already on waitlist" {
			return nil, err
		}
		return nil, errors.New("failed to save waitlist signup")
	}

	if err := u.syncer.AddContact(email, name); err != nil {
		slog.Warn("waitlist resend sync failed", "email", email, "error", err)
	}

	return signup, nil
}

func (u *WaitlistUsecase) ListSignups(limit, offset int) ([]domain.WaitlistSignup, int, error) {
	items, err := u.repo.List(limit, offset)
	if err != nil {
		return nil, 0, err
	}
	total, err := u.repo.Count()
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}
