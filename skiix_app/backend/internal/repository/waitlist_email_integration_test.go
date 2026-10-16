//go:build integration

package repository

import (
	"testing"

	"github.com/skiix-backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWaitlistRepository_EmailNormalizationAndFind(t *testing.T) {
	truncateIntegrationTables(t)
	repo := NewPostgresWaitlistRepository(intTestDB)

	require.NoError(t, repo.Create(&domain.WaitlistSignup{
		Email:        "  JOIN@SKIIX.IO ",
		ConsentGiven: true,
	}))

	found, err := repo.FindByEmail("join@skiix.io")
	require.NoError(t, err)
	require.NotNil(t, found)
	assert.Equal(t, "join@skiix.io", found.Email)

	err = repo.Create(&domain.WaitlistSignup{
		Email:        "JOIN@skiix.IO",
		ConsentGiven: true,
	})
	assert.EqualError(t, err, "email already on waitlist")
}
