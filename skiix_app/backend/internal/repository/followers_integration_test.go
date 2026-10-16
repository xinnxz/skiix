//go:build integration

package repository

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFollowerRepository_FollowIdempotent(t *testing.T) {
	truncateIntegrationTables(t)

	followerID := uuid.New().String()
	followingID := uuid.New().String()
	seedUser(t, followerID, "follower", "follower@skiix.io")
	seedUser(t, followingID, "celebrity", "celebrity@skiix.io")

	repo := NewPostgresFollowerRepository(intTestDB)

	already, err := repo.Follow(followerID, followingID)
	require.NoError(t, err)
	assert.False(t, already)

	alreadyAgain, err := repo.Follow(followerID, followingID)
	require.NoError(t, err)
	assert.True(t, alreadyAgain)

	var count int
	err = intTestDB.QueryRow(
		`SELECT COUNT(*) FROM followers WHERE follower_id = $1 AND following_id = $2`,
		followerID, followingID,
	).Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 1, count)
}
