package domain

import "time"

type User struct {
	ID                   string    `json:"id"`
	Email                string    `json:"email"`
	Password             *string   `json:"-"`
	Provider             *string   `json:"provider,omitempty"`
	FirebaseUID          *string   `json:"-"`
	EmailVerified        bool      `json:"email_verified"`
	Username             string    `json:"username"`
	DisplayName          string    `json:"display_name"`
	AvatarURL            string    `json:"avatar_url"`
	Bio                  string    `json:"bio"`
	Location             string    `json:"location"`
	Website              string    `json:"website"`
	Twitter              string    `json:"twitter"`
	LinkedIn             string    `json:"linkedin"`
	GitHub               string    `json:"github"`
	RoleTag              string    `json:"role_tag"`
	Interests            []string  `json:"interests"`
	Skills               []string  `json:"skills"`
	IsVerified           bool      `json:"is_verified"`
	OnboardingCompleted  bool      `json:"onboarding_completed"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

// UserProfileUpdate is a partial update payload — nil means "don't touch".
type UserProfileUpdate struct {
	Username    *string
	DisplayName *string
	AvatarURL   *string
	Bio         *string
	Location    *string
	Website     *string
	Twitter     *string
	LinkedIn    *string
	GitHub      *string
	RoleTag     *string
	Interests   *[]string
	Skills      *[]string
}

// UserOnboardingPayload is committed at the end of the onboarding flow.
type UserOnboardingPayload struct {
	RoleTag             string
	Interests           []string
	Skills              []string
	OnboardingCompleted bool
}

// UserStats is the aggregate count panel shown on the profile screen.
type UserStats struct {
	PostsCount     int `json:"posts_count"`
	FollowersCount int `json:"followers_count"`
	FollowingCount int `json:"following_count"`
	ProjectsCount  int `json:"projects_count"`
}

type UserRepository interface {
	Create(user *User) error
	FindByEmail(email string) (*User, error)
	FindByID(id string) (*User, error)
	FindByFirebaseUID(uid string) (*User, error)
	FindByUsername(username string) (*User, error)
	// FindByEmailLocalPart matches LOWER(split_part(email,'@',1)) when no username slug exists.
	FindByEmailLocalPart(local string) (*User, error)
	UpdateUserFirebaseInfo(user *User) error
	UpdateProfile(userID string, patch UserProfileUpdate) (*User, error)
	UpdateOnboarding(userID string, p UserOnboardingPayload) (*User, error)
	IsUsernameAvailable(username string, exceptUserID string) (bool, error)
	GetStats(userID string) (UserStats, error)
	// UpsertSignupProfile creates or updates the app user row after Supabase email OTP verification.
	UpsertSignupProfile(userID, email, displayName, username, accountRole string, onboardingCompleted bool) (*User, error)
}
