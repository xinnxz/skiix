//go:build integration

package repository

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMigrations_ExpectedIndexesExist(t *testing.T) {
	expected := []string{
		"idx_posts_visibility",
		"idx_posts_user_id",
		"idx_post_moods_mood_name",
		"idx_followers_following",
		"idx_notifications_user",
		"idx_waitlist_created",
		"idx_focus_settings_user",
	}

	rows, err := intTestDB.Query(`
		SELECT indexname
		FROM pg_indexes
		WHERE schemaname = 'public'
		  AND indexname = ANY($1)
	`, expected)
	require.NoError(t, err)
	defer rows.Close()

	found := make(map[string]bool, len(expected))
	for rows.Next() {
		var name string
		require.NoError(t, rows.Scan(&name))
		found[name] = true
	}
	require.NoError(t, rows.Err())

	for _, name := range expected {
		assert.True(t, found[name], "missing index %s", name)
	}
}
