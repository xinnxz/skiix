//go:build integration

package repository

import (
	"testing"

	"github.com/google/uuid"
	"github.com/skiix-backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCircleRepository_CreateAddMembersAndIsMember(t *testing.T) {
	truncateIntegrationTables(t)

	ownerID := uuid.New().String()
	memberID := uuid.New().String()
	outsiderID := uuid.New().String()
	seedUser(t, ownerID, "circleowner", "circleowner@skiix.io")
	seedUser(t, memberID, "circlemember", "circlemember@skiix.io")
	seedUser(t, outsiderID, "outsider3", "outsider3@skiix.io")

	repo := NewPostgresCircleRepository(intTestDB)
	circle := &domain.Circle{
		ID:          uuid.New().String(),
		OwnerID:     ownerID,
		Name:        "Founders",
		MemberCount: 1,
	}
	require.NoError(t, repo.Create(circle))

	require.NoError(t, repo.AddMembers(circle.ID, []string{memberID}))

	updated, err := repo.GetByID(circle.ID)
	require.NoError(t, err)
	assert.Equal(t, 2, updated.MemberCount)

	isMember, err := repo.IsMember(circle.ID, memberID)
	require.NoError(t, err)
	assert.True(t, isMember)

	isOutsider, err := repo.IsMember(circle.ID, outsiderID)
	require.NoError(t, err)
	assert.False(t, isOutsider)

	members, err := repo.GetMembers(circle.ID, 10, 0)
	require.NoError(t, err)
	assert.Len(t, members, 2)

	byUser, err := repo.GetByUser(ownerID)
	require.NoError(t, err)
	require.Len(t, byUser, 1)
	assert.Equal(t, circle.ID, byUser[0].ID)
}
