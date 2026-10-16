//go:build integration

package repository

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/skiix-backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPostRepository_GetFeed_ExcludesCirclePosts(t *testing.T) {
	truncateIntegrationTables(t)

	ownerID := uuid.New().String()
	outsiderID := uuid.New().String()
	circleID := uuid.New().String()

	seedUser(t, ownerID, "owner", "owner@skiix.io")
	seedUser(t, outsiderID, "outsider", "outsider@skiix.io")

	_, err := intTestDB.Exec(`
		INSERT INTO circles (id, owner_id, name, member_count, created_at, updated_at)
		VALUES ($1, $2, 'Inner Circle', 1, NOW(), NOW())
	`, circleID, ownerID)
	require.NoError(t, err)

	_, err = intTestDB.Exec(`
		INSERT INTO circle_members (id, circle_id, user_id, role, joined_at)
		VALUES ($1, $2, $3, 'owner', NOW())
	`, uuid.New().String(), circleID, ownerID)
	require.NoError(t, err)

	postRepo := NewPostgresPostRepository(intTestDB)

	publicPost := &domain.Post{
		ID:         uuid.New().String(),
		UserID:     ownerID,
		Content:    "Public hello",
		Visibility: domain.VisibilityPublic,
	}
	require.NoError(t, postRepo.Create(publicPost))

	circlePost := &domain.Post{
		ID:         uuid.New().String(),
		UserID:     ownerID,
		Content:    "Secret circle post",
		Visibility: domain.VisibilityCircle,
		CircleID:   &circleID,
	}
	require.NoError(t, postRepo.Create(circlePost))

	items, err := postRepo.GetFeed(domain.FeedQuery{
		Limit:  20,
		UserID: outsiderID,
		Cursor: nil,
	})
	require.NoError(t, err)

	ids := make([]string, 0, len(items))
	for _, item := range items {
		ids = append(ids, item.ID)
	}
	assert.Contains(t, ids, publicPost.ID)
	assert.NotContains(t, ids, circlePost.ID)
}

func TestPostRepository_GetByCircle_ReturnsCirclePostsOnly(t *testing.T) {
	truncateIntegrationTables(t)

	ownerID := uuid.New().String()
	memberID := uuid.New().String()
	circleID := uuid.New().String()

	seedUser(t, ownerID, "owner2", "owner2@skiix.io")
	seedUser(t, memberID, "member", "member@skiix.io")

	_, err := intTestDB.Exec(`
		INSERT INTO circles (id, owner_id, name, member_count, created_at, updated_at)
		VALUES ($1, $2, 'Team', 2, NOW(), NOW())
	`, circleID, ownerID)
	require.NoError(t, err)

	for _, uid := range []string{ownerID, memberID} {
		_, err = intTestDB.Exec(`
			INSERT INTO circle_members (id, circle_id, user_id, role, joined_at)
			VALUES ($1, $2, $3, 'member', NOW())
		`, uuid.New().String(), circleID, uid)
		require.NoError(t, err)
	}

	postRepo := NewPostgresPostRepository(intTestDB)

	circlePost := &domain.Post{
		ID:         uuid.New().String(),
		UserID:     ownerID,
		Content:    "Circle only",
		Visibility: domain.VisibilityCircle,
		CircleID:   &circleID,
	}
	require.NoError(t, postRepo.Create(circlePost))

	publicPost := &domain.Post{
		ID:         uuid.New().String(),
		UserID:     ownerID,
		Content:    "Still public",
		Visibility: domain.VisibilityPublic,
	}
	require.NoError(t, postRepo.Create(publicPost))

	items, err := postRepo.GetByCircle(circleID, memberID, 20, nil)
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, circlePost.ID, items[0].ID)
	assert.True(t, items[0].CreatedAt.Before(time.Now().Add(time.Minute)))
}
