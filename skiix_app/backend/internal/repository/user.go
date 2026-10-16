package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/lib/pq"
	"github.com/skiix-backend/internal/domain"
	"github.com/skiix-backend/internal/usernameutil"
)

type PostgresUserRepository struct {
	db *sql.DB
}

func NewPostgresUserRepository(db *sql.DB) domain.UserRepository {
	return &PostgresUserRepository{
		db: db,
	}
}

const userColumns = `id, email, password, provider, firebase_uid, email_verified,
	COALESCE(username, ''), COALESCE(display_name, ''), COALESCE(avatar_url, ''),
	COALESCE(bio, ''), COALESCE(location, ''), COALESCE(website, ''),
	COALESCE(twitter, ''), COALESCE(linkedin, ''), COALESCE(github, ''),
	COALESCE(role_tag, ''), COALESCE(interests, '{}'::text[]), COALESCE(skills, '{}'::text[]),
	is_verified, onboarding_completed, created_at, updated_at`

func (r *PostgresUserRepository) Create(user *domain.User) error {
	query := `
		INSERT INTO users (id, email, password, provider, firebase_uid, email_verified, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()

	_, err := r.db.Exec(query, user.ID, user.Email, user.Password, user.Provider, user.FirebaseUID, user.EmailVerified, user.CreatedAt, user.UpdatedAt)
	if err != nil {
		if err.Error() == "pq: duplicate key value violates unique constraint \"users_email_key\"" {
			return errors.New("user with this email already exists")
		}
		return fmt.Errorf("failed to create user: %w", err)
	}

	return nil
}

func scanUser(row *sql.Row) (*domain.User, error) {
	user := &domain.User{}
	var firebaseNull sql.NullString
	var interests, skills pq.StringArray
	err := row.Scan(
		&user.ID,
		&user.Email,
		&user.Password,
		&user.Provider,
		&firebaseNull,
		&user.EmailVerified,
		&user.Username,
		&user.DisplayName,
		&user.AvatarURL,
		&user.Bio,
		&user.Location,
		&user.Website,
		&user.Twitter,
		&user.LinkedIn,
		&user.GitHub,
		&user.RoleTag,
		&interests,
		&skills,
		&user.IsVerified,
		&user.OnboardingCompleted,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("user not found")
	}
	if err != nil {
		return nil, err
	}
	if firebaseNull.Valid {
		s := firebaseNull.String
		user.FirebaseUID = &s
	}
	user.Interests = []string(interests)
	user.Skills = []string(skills)
	if user.Interests == nil {
		user.Interests = []string{}
	}
	if user.Skills == nil {
		user.Skills = []string{}
	}
	return user, nil
}

func (r *PostgresUserRepository) findOne(where string, args ...any) (*domain.User, error) {
	q := fmt.Sprintf(`SELECT %s FROM users WHERE %s LIMIT 1`, userColumns, where)
	user, err := scanUser(r.db.QueryRow(q, args...))
	if err != nil && err.Error() == "user not found" {
		return nil, err
	}
	if err != nil {
		return nil, fmt.Errorf("failed to find user: %w", err)
	}
	return user, nil
}

func (r *PostgresUserRepository) FindByEmail(email string) (*domain.User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return nil, errors.New("user not found")
	}
	return r.findOne("LOWER(TRIM(email)) = $1", email)
}

func (r *PostgresUserRepository) FindByID(id string) (*domain.User, error) {
	return r.findOne("id = $1", id)
}

func (r *PostgresUserRepository) FindByFirebaseUID(uid string) (*domain.User, error) {
	return r.findOne("firebase_uid = $1", uid)
}

func (r *PostgresUserRepository) FindByUsername(username string) (*domain.User, error) {
	username = strings.TrimSpace(username)
	if username == "" {
		return nil, errors.New("user not found")
	}
	return r.findOne("LOWER(username) = LOWER($1)", username)
}

func (r *PostgresUserRepository) FindByEmailLocalPart(part string) (*domain.User, error) {
	part = strings.TrimSpace(strings.ToLower(part))
	if part == "" || strings.Contains(part, "@") {
		return nil, errors.New("user not found")
	}
	return r.findOne("LOWER(TRIM(split_part(trim(email),'@',1))) = $1", part)
}

func (r *PostgresUserRepository) UpdateUserFirebaseInfo(user *domain.User) error {
	now := time.Now()
	_, err := r.db.Exec(
		`UPDATE users SET firebase_uid = $1, email_verified = $2, updated_at = $3, provider = COALESCE($4, provider) WHERE id = $5`,
		user.FirebaseUID,
		user.EmailVerified,
		now,
		user.Provider,
		user.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update user firebase: %w", err)
	}
	return nil
}

// UpdateProfile applies a partial profile update. Nil fields are left unchanged.
func (r *PostgresUserRepository) UpdateProfile(userID string, p domain.UserProfileUpdate) (*domain.User, error) {
	sets := []string{}
	args := []any{}
	add := func(col string, val any) {
		args = append(args, val)
		sets = append(sets, fmt.Sprintf("%s = $%d", col, len(args)))
	}

	if p.Username != nil {
		add("username", strings.ToLower(strings.TrimSpace(*p.Username)))
	}
	if p.DisplayName != nil {
		add("display_name", *p.DisplayName)
	}
	if p.AvatarURL != nil {
		add("avatar_url", *p.AvatarURL)
	}
	if p.Bio != nil {
		add("bio", *p.Bio)
	}
	if p.Location != nil {
		add("location", *p.Location)
	}
	if p.Website != nil {
		add("website", *p.Website)
	}
	if p.Twitter != nil {
		add("twitter", strings.TrimPrefix(strings.TrimSpace(*p.Twitter), "@"))
	}
	if p.LinkedIn != nil {
		add("linkedin", *p.LinkedIn)
	}
	if p.GitHub != nil {
		add("github", strings.TrimPrefix(strings.TrimSpace(*p.GitHub), "@"))
	}
	if p.RoleTag != nil {
		add("role_tag", *p.RoleTag)
	}
	if p.Interests != nil {
		add("interests", pq.StringArray(*p.Interests))
	}
	if p.Skills != nil {
		add("skills", pq.StringArray(*p.Skills))
	}

	if len(sets) == 0 {
		return r.FindByID(userID)
	}

	add("updated_at", time.Now().UTC())
	args = append(args, userID)
	q := fmt.Sprintf(`UPDATE users SET %s WHERE id = $%d`, strings.Join(sets, ", "), len(args))
	if _, err := r.db.Exec(q, args...); err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			return nil, errors.New("username already taken")
		}
		return nil, fmt.Errorf("update profile: %w", err)
	}
	return r.FindByID(userID)
}

// UpdateOnboarding commits the final onboarding payload (role + interests + skills).
func (r *PostgresUserRepository) UpdateOnboarding(userID string, p domain.UserOnboardingPayload) (*domain.User, error) {
	now := time.Now().UTC()
	_, err := r.db.Exec(
		`UPDATE users SET role_tag = $1, interests = $2, skills = $3, onboarding_completed = $4, updated_at = $5 WHERE id = $6`,
		p.RoleTag,
		pq.StringArray(p.Interests),
		pq.StringArray(p.Skills),
		p.OnboardingCompleted,
		now,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("update onboarding: %w", err)
	}
	return r.FindByID(userID)
}

// IsUsernameAvailable returns true when no user (other than exceptUserID) owns the username.
func (r *PostgresUserRepository) IsUsernameAvailable(username string, exceptUserID string) (bool, error) {
	u := strings.ToLower(strings.TrimSpace(username))
	if u == "" {
		return false, errors.New("username is required")
	}
	var n int
	err := r.db.QueryRow(
		`SELECT COUNT(*) FROM users WHERE LOWER(username) = $1 AND id <> $2`,
		u, exceptUserID,
	).Scan(&n)
	if err != nil {
		return false, fmt.Errorf("username check: %w", err)
	}
	return n == 0, nil
}

// GetStats returns posts / followers / following / projects counts for a user.
// Falls back to 0 when an optional table is missing so this stays resilient.
func (r *PostgresUserRepository) GetStats(userID string) (domain.UserStats, error) {
	s := domain.UserStats{}
	// Posts: count of rows in posts owned by this user.
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM posts WHERE user_id = $1`, userID).Scan(&s.PostsCount); err != nil {
		s.PostsCount = 0
	}
	// Followers / Following
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM followers WHERE following_id = $1`, userID).Scan(&s.FollowersCount); err != nil {
		s.FollowersCount = 0
	}
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM followers WHERE follower_id = $1`, userID).Scan(&s.FollowingCount); err != nil {
		s.FollowingCount = 0
	}
	// Projects: owned (posts with is_project = true) OR joined via project_members.
	if err := r.db.QueryRow(`
		SELECT COUNT(*) FROM (
			SELECT id FROM posts WHERE user_id = $1 AND is_project = true
			UNION
			SELECT project_id AS id FROM project_members WHERE user_id = $1
		) p
	`, userID).Scan(&s.ProjectsCount); err != nil {
		s.ProjectsCount = 0
	}
	return s, nil
}

func (r *PostgresUserRepository) ensureUniqueUsername(username, exceptUserID string) (string, error) {
	base := strings.ToLower(strings.TrimSpace(username))
	if base == "" {
		return "", errors.New("username is required")
	}
	candidate := base
	for i := 0; i < 25; i++ {
		ok, err := r.IsUsernameAvailable(candidate, exceptUserID)
		if err != nil {
			return "", err
		}
		if ok {
			return candidate, nil
		}
		candidate = fmt.Sprintf("%s%d", base, 100+randIntn(9900))
	}
	return "", errors.New("could not allocate username")
}

func randIntn(n int) int {
	if n <= 0 {
		return 0
	}
	return int(time.Now().UnixNano() % int64(n))
}

// UpsertSignupProfile inserts or updates a row keyed by Supabase Auth user id.
func (r *PostgresUserRepository) UpsertSignupProfile(
	userID, email, displayName, requestedUsername, accountRole string,
	onboardingCompleted bool,
) (*domain.User, error) {
	id := strings.TrimSpace(userID)
	email = strings.ToLower(strings.TrimSpace(email))
	if id == "" || email == "" {
		return nil, errors.New("id and email are required")
	}
	suffix := id
	if len(suffix) > 4 {
		suffix = suffix[:4]
	}
	username := usernameutil.SanitizeUsername(requestedUsername, email, suffix)
	username, err := r.ensureUniqueUsername(username, id)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	dn := strings.TrimSpace(displayName)
	rt := strings.TrimSpace(accountRole)
	_, err = r.db.Exec(`
		INSERT INTO users (
			id, email, password, provider, firebase_uid, email_verified,
			username, display_name, avatar_url, bio, location, website, twitter, linkedin, github,
			role_tag, interests, skills, is_verified, onboarding_completed, created_at, updated_at
		) VALUES (
			$1, $2, NULL, NULL, NULL, true,
			$3, $4, '', '', '', '', '', '', '',
			NULLIF($5, ''), '{}'::text[], '{}'::text[], false, $6, $7, $8
		)
		ON CONFLICT (id) DO UPDATE SET
			email = EXCLUDED.email,
			display_name = CASE WHEN NULLIF(trim(EXCLUDED.display_name), '') IS NOT NULL THEN EXCLUDED.display_name ELSE users.display_name END,
			username = CASE
				WHEN users.username IS NULL OR trim(users.username) = '' OR users.username LIKE '%@%'
				THEN EXCLUDED.username
				ELSE users.username
			END,
			role_tag = CASE WHEN NULLIF(trim(EXCLUDED.role_tag), '') IS NOT NULL THEN EXCLUDED.role_tag ELSE users.role_tag END,
			onboarding_completed = EXCLUDED.onboarding_completed,
			updated_at = EXCLUDED.updated_at
	`, id, email, username, dn, rt, onboardingCompleted, now, now)
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			return nil, errors.New("email already registered")
		}
		return nil, fmt.Errorf("upsert signup profile: %w", err)
	}
	return r.FindByID(id)
}
