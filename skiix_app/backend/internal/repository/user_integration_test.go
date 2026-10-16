//go:build integration

package repository

import (
	"testing"

	"github.com/google/uuid"
	"github.com/skiix-backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUserRepository_CreateAndDuplicateEmail(t *testing.T) {
	truncateIntegrationTables(t)
	repo := NewPostgresUserRepository(intTestDB)

	password := "hashed-secret"
	provider := "email"
	user := &domain.User{
		ID:       uuid.New().String(),
		Username: "newuser",
		Email:    "newuser@skiix.io",
		Password: &password,
		Provider: &provider,
	}
	require.NoError(t, repo.Create(user))

	found, err := repo.FindByEmail("newuser@skiix.io")
	require.NoError(t, err)
	assert.Equal(t, user.ID, found.ID)

	err = repo.Create(&domain.User{
		ID:       uuid.New().String(),
		Username: "otheruser",
		Email:    "newuser@skiix.io",
		Password: &password,
		Provider: &provider,
	})
	assert.EqualError(t, err, "user with this email already exists")
}
