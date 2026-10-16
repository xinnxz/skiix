//go:build integration

package repository

import (
	"testing"

	"github.com/google/uuid"
	"github.com/skiix-backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPostRepository_MoodFeed_FiltersByMoodChronologically(t *testing.T) {
	truncateIntegrationTables(t)

	ownerID := uuid.New().String()
	seedUser(t, ownerID, "moodowner", "moodowner@skiix.io")

	postRepo := NewPostgresPostRepository(intTestDB)

	chillPost := &domain.Post{
		ID: uuid.New().String(), UserID: ownerID, Content: "Chill vibes only",
		Visibility: domain.VisibilityPublic,
	}
	hypePost := &domain.Post{
		ID: uuid.New().String(), UserID: ownerID, Content: "Hype energy",
		Visibility: domain.VisibilityPublic,
	}
	seedPostWithMoods(t, postRepo, chillPost, []string{"chill"})
	seedPostWithMoods(t, postRepo, hypePost, []string{"hype"})

	chillFeed, err := postRepo.GetFeed(domain.FeedQuery{
		Limit: 10, UserID: ownerID, Mood: "chill",
	})
	require.NoError(t, err)
	require.Len(t, chillFeed, 1)
	assert.Equal(t, chillPost.ID, chillFeed[0].ID)

	hypeFeed, err := postRepo.GetFeed(domain.FeedQuery{
		Limit: 10, UserID: ownerID, Mood: "hype",
	})
	require.NoError(t, err)
	require.Len(t, hypeFeed, 1)
	assert.Equal(t, hypePost.ID, hypeFeed[0].ID)

	allFeed, err := postRepo.GetFeed(domain.FeedQuery{
		Limit: 10, UserID: ownerID,
	})
	require.NoError(t, err)
	assert.Len(t, allFeed, 2)
}

func TestPostRepository_SetMoods_MaxTwoPerPost(t *testing.T) {
	truncateIntegrationTables(t)

	ownerID := uuid.New().String()
	seedUser(t, ownerID, "tagger", "tagger@skiix.io")
	postRepo := NewPostgresPostRepository(intTestDB)

	post := &domain.Post{
		ID: uuid.New().String(), UserID: ownerID, Content: "Tagged",
		Visibility: domain.VisibilityPublic,
	}
	require.NoError(t, postRepo.Create(post))
	require.NoError(t, postRepo.SetMoods(post.ID, []string{"chill", "curious"}))

	moods, err := postRepo.GetMoods(post.ID)
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"chill", "curious"}, moods)
}
