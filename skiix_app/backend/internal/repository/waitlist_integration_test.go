//go:build integration

package repository

import (
	"testing"

	"github.com/skiix-backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWaitlistRepository_CreateAndDuplicate(t *testing.T) {
	truncateIntegrationTables(t)
	repo := NewPostgresWaitlistRepository(intTestDB)

	signup := &domain.WaitlistSignup{
		Email:        "wait@skiix.io",
		ConsentGiven: true,
	}
	require.NoError(t, repo.Create(signup))
	assert.NotEmpty(t, signup.ID)

	err := repo.Create(&domain.WaitlistSignup{
		Email:        "wait@skiix.io",
		ConsentGiven: true,
	})
	assert.EqualError(t, err, "email already on waitlist")
}

func TestWaitlistRepository_ListAndCount(t *testing.T) {
	truncateIntegrationTables(t)
	repo := NewPostgresWaitlistRepository(intTestDB)

	for _, email := range []string{"a@skiix.io", "b@skiix.io"} {
		require.NoError(t, repo.Create(&domain.WaitlistSignup{
			Email: email, ConsentGiven: true,
		}))
	}

	items, err := repo.List(10, 0)
	require.NoError(t, err)
	assert.Len(t, items, 2)

	count, err := repo.Count()
	require.NoError(t, err)
	assert.Equal(t, 2, count)
}
