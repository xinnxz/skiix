//go:build integration

package repository

import (
	"testing"

	"github.com/google/uuid"
	"github.com/skiix-backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSearchRepository_SearchPosts_ExcludesCirclePosts(t *testing.T) {
	truncateIntegrationTables(t)

	ownerID := uuid.New().String()
	circleID := uuid.New().String()
	seedUser(t, ownerID, "searchowner", "searchowner@skiix.io")

	_, err := intTestDB.Exec(`
		INSERT INTO circles (id, owner_id, name, member_count, created_at, updated_at)
		VALUES ($1, $2, 'Private', 1, NOW(), NOW())
	`, circleID, ownerID)
	require.NoError(t, err)

	postRepo := NewPostgresPostRepository(intTestDB)
	unique := "ultrasecretmarker"
	require.NoError(t, postRepo.Create(&domain.Post{
		ID:         uuid.New().String(),
		UserID:     ownerID,
		Content:    unique + " circle only",
		Visibility: domain.VisibilityCircle,
		CircleID:   &circleID,
	}))
	require.NoError(t, postRepo.Create(&domain.Post{
		ID:         uuid.New().String(),
		UserID:     ownerID,
		Content:    unique + " public post",
		Visibility: domain.VisibilityPublic,
	}))

	searchRepo := NewPostgresSearchRepository(intTestDB)
	posts, err := searchRepo.SearchPosts(unique, 10)
	require.NoError(t, err)
	require.Len(t, posts, 1)
	assert.Equal(t, domain.VisibilityPublic, posts[0].Visibility)
}
