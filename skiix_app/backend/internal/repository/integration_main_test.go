//go:build integration

package repository

import (
	"database/sql"
	"os"
	"testing"

	_ "github.com/lib/pq"
	"github.com/skiix-backend/internal/domain"
	"github.com/skiix-backend/pkg/migration"
)

var intTestDB *sql.DB

func TestMain(m *testing.M) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://skiix:skiix@localhost:5432/skiix_test?sslmode=disable"
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		os.Exit(1)
	}
	if err := db.Ping(); err != nil {
		// No database available — skip integration suite (local dev without Postgres).
		os.Exit(0)
	}
	if err := migration.RunMigrations(db); err != nil {
		_ = db.Close()
		os.Exit(1)
	}

	intTestDB = db
	code := m.Run()
	_ = db.Close()
	os.Exit(code)
}

func truncateIntegrationTables(t *testing.T) {
	t.Helper()
	_, err := intTestDB.Exec(`
		TRUNCATE
			waitlist_signups,
			notifications,
			mood_sessions,
			mood_schedules,
			post_moods,
			post_likes,
			comments,
			post_categories,
			saves,
			posts,
			circle_members,
			circles,
			followers,
			connections,
			user_quiet_hours,
			user_devices,
			users
		RESTART IDENTITY CASCADE
	`)
	if err != nil {
		t.Fatalf("truncate failed: %v", err)
	}
}

func seedPostWithMoods(t *testing.T, postRepo domain.PostRepository, post *domain.Post, moods []string) {
	t.Helper()
	if len(moods) == 0 {
		moods = []string{"chill"}
	}
	if err := postRepo.Create(post); err != nil {
		t.Fatalf("seed post: %v", err)
	}
	if err := postRepo.SetMoods(post.ID, moods); err != nil {
		t.Fatalf("seed post moods: %v", err)
	}
}

func seedUser(t *testing.T, id, username, email string) {
	t.Helper()
	_, err := intTestDB.Exec(`
		INSERT INTO users (id, username, email, password, provider, created_at, updated_at)
		VALUES ($1, $2, $3, 'hash', 'email', NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, id, username, email)
	if err != nil {
		t.Fatalf("seed user: %v", err)
	}
}
