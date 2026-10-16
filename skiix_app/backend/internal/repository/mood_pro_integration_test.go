//go:build integration

package repository

import (
	"testing"

	"github.com/google/uuid"
	"github.com/skiix-backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMoodRepository_ScheduleAndSession(t *testing.T) {
	truncateIntegrationTables(t)

	userID := uuid.New().String()
	seedUser(t, userID, "plususer", "plus@skiix.io")

	repo := NewPostgresMoodRepository(intTestDB)

	schedule := &domain.MoodSchedule{
		UserID: userID, Mood: "focused", StartTime: "08:00", EndTime: "12:00",
		DaysOfWeek: []int{1, 2, 3, 4, 5}, Timezone: "Asia/Jakarta", Enabled: true,
	}
	require.NoError(t, repo.CreateSchedule(schedule))

	schedules, err := repo.GetSchedules(userID)
	require.NoError(t, err)
	require.Len(t, schedules, 1)
	assert.Equal(t, "focused", schedules[0].Mood)

	session := &domain.MoodSession{UserID: userID, Mood: "chill"}
	require.NoError(t, repo.CreateSession(session))

	sessions, err := repo.GetSessions(userID, 10)
	require.NoError(t, err)
	require.Len(t, sessions, 1)
	assert.Equal(t, "chill", sessions[0].Mood)
}
