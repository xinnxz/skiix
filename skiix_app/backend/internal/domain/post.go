package domain

import "time"

// Post represents a user's post in the feed.
// Each post belongs to one user and can have multiple categories,
// likes, and comments.
type Post struct {
	ID             string    `json:"id" example:"550e8400-e29b-41d4-a716-446655440000"`
	UserID         string    `json:"user_id" example:"550e8400-e29b-41d4-a716-446655440001"`
	Type           string    `json:"type" example:"text"` // text | reel | story | project
	Content        string    `json:"content" example:"Hello world"`
	ImageURL       *string   `json:"image_url,omitempty" example:"https://cdn.skiix.com/image.jpg"` // legacy alias
	MediaURL       *string   `json:"media_url,omitempty" example:"https://cdn.skiix.com/media.mp4"`
	ExtraMediaURLs []string  `json:"extra_media_urls,omitempty"`  // additional gallery images (text posts)
	IsNewProject   bool      `json:"is_new_project"`
	Metrics        *string   `json:"metrics,omitempty"`
	MilestoneType  *string   `json:"milestone_type,omitempty"`
	ProjectName    *string   `json:"project_name,omitempty"`
	IsProject      bool      `json:"is_project"` // true → "Join Project" CTA vs "Follow"
	ProjectID      *string   `json:"project_id,omitempty"`        // when is_project=true, defaults to post id
	Visibility     string    `json:"visibility" example:"public"` // public, circle
	CircleID       *string   `json:"circle_id,omitempty" example:"550e8400-e29b-..."`
	LikeCount      int       `json:"like_count" example:"5"`
	CommentCount   int       `json:"comment_count" example:"2"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// PostCategory represents a category tag assigned to a post.
// Uses a junction table pattern to support multi-category tagging
// (e.g., a post can be "news" + "sports" simultaneously).
type PostCategory struct {
	ID           string    `json:"id"`
	PostID       string    `json:"post_id"`
	CategoryName string    `json:"category_name"`
	CreatedAt    time.Time `json:"created_at"`
}

// PostLike records that a specific user liked a specific post.
// The UNIQUE(user_id, post_id) constraint prevents duplicate likes.
type PostLike struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	PostID    string    `json:"post_id"`
	CreatedAt time.Time `json:"created_at"`
}

// Comment represents a user's comment on a post.
type Comment struct {
	ID                string    `json:"id"`
	PostID            string    `json:"post_id"`
	UserID            string    `json:"user_id"`
	Content           string    `json:"content"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
	AuthorUsername    string    `json:"author_username,omitempty"`
	AuthorDisplayName string    `json:"author_display_name,omitempty"`
	AuthorAvatarURL   string    `json:"author_avatar_url,omitempty"`
	// Username / AvatarURL are aliases for mobile clients (same values as Author*).
	Username  string `json:"username,omitempty"`
	AvatarURL string `json:"avatar_url,omitempty"`
}

// PostFeedItem is a DTO enriching a Post with the author's email
// and the current user's like status for use in feed responses.
type PostFeedItem struct {
	Post
	AuthorEmail    string   `json:"author_email"`
	AuthorUsername string   `json:"author_username"`
	IsVerified     bool     `json:"is_verified"`
	IsOwnPost      bool     `json:"is_own_post"`
	FeedMediaType  string   `json:"media_type,omitempty"` // image | video — main attachment
	Tags           []string `json:"tags"`
	IsLiked        bool     `json:"is_liked"`
	// Type is duplicated at top-level for backwards compatibility with old clients.
	// It matches Post.Type.
	Type        string `json:"type"` // "project" | "text" | "reel" | "story"
	IsJoined    bool   `json:"is_joined"`
	IsFollowing bool   `json:"is_following"`
	IsSaved     bool   `json:"is_saved"`
	SavesCount  int    `json:"saves_count"`
	// Viewer vibe (-100..100); 0 when not set.
	ViewerVibeScore int `json:"viewer_vibe_score,omitempty"`
	// Aggregated sentiment for the post.
	VibeLovePct     float64 `json:"vibe_love_pct,omitempty"`
	VibeNeutralPct  float64 `json:"vibe_neutral_pct,omitempty"`
	VibeDisagreePct float64 `json:"vibe_disagree_pct,omitempty"`
	AvgVibeScore    float64 `json:"avg_vibe_score,omitempty"`
	VibeCount       int     `json:"vibe_count,omitempty"`
}

// ProjectSummary represents a selectable project root in the Project Update flow.
type ProjectSummary struct {
	ID          string    `json:"id"`
	Content     string    `json:"content"`
	CreatedAt   time.Time `json:"created_at"`
	MemberCount int       `json:"member_count"`
}

// CreatePostRequest is the payload for creating a new post.
type CreatePostRequest struct {
	Type       string   `json:"type"`
	Content    string   `json:"content"`
	ImageURL   *string  `json:"image_url"`
	MediaURL   *string  `json:"media_url"`
	IsProject  bool     `json:"is_project"`
	ProjectID  *string  `json:"project_id"`
	Visibility string   `json:"visibility"`
	CircleID   *string  `json:"circle_id"`
	Categories []string `json:"categories"`
	// --- Reels / Explore (optional; persisted after base insert) ---
	ThumbnailURL       *string  `json:"thumbnail_url,omitempty"`
	CloudinaryPublicID *string  `json:"cloudinary_public_id,omitempty"`
	VideoDuration      *float64 `json:"video_duration,omitempty"`
	AspectWidth        *float64 `json:"aspect_width,omitempty"`
	AspectHeight       *float64 `json:"aspect_height,omitempty"`
	Category           *string  `json:"category,omitempty"`      // explore grid label bucket
	ExploreTitle       *string  `json:"explore_title,omitempty"` // uppercase title pill
	Tags               []string `json:"tags,omitempty"`          // hashtags → posts.tags[]
	Location           *string  `json:"location,omitempty"`      // free-text place name
	Audience           *string  `json:"audience,omitempty"`      // everyone | followers
	ShareToFeed        *bool    `json:"share_to_feed,omitempty"`
	ShareToProfile     *bool    `json:"share_to_profile,omitempty"`
	// Extra URLs for multi-image composer (persisted into posts.extra_media_urls)
	ExtraMediaURLs []string `json:"extra_media_urls,omitempty"`
	IsNewProject   bool     `json:"is_new_project"`
	Metrics        string   `json:"metrics"`
	MilestoneType  string   `json:"milestone_type"`
	ProjectName    string   `json:"project_name"`
	// Moods — optional for backward compatibility; 1–2 tags when provided (PRD-12).
	Moods []string `json:"moods,omitempty"`
}

// UpdatePostRequest is the payload for editing an existing post.
type UpdatePostRequest struct {
	Content  string  `json:"content" binding:"required"`
	ImageURL *string `json:"image_url"`
}

// FeedQuery contains pagination and filtering parameters for feed requests.
type FeedQuery struct {
	Limit  int
	Offset int
	UserID string // The requesting user (for is_liked computation)
	Mood   string // optional Mood Feed filter (empty = all moods)
}

// PostRepository defines the data access contract for posts.
type PostRepository interface {
	// Create inserts a new post into the database.
	Create(post *Post) error

	// GetByID retrieves a single post by its ID.
	GetByID(postID string) (*Post, error)

	// GetFeed retrieves a paginated list of posts for the feed.
	// Returns PostFeedItems enriched with author info and like status.
	GetFeed(query FeedQuery) ([]PostFeedItem, error)

	// GetByUserID retrieves all posts by a specific user.
	GetByUserID(userID string, limit, offset int) ([]PostFeedItem, error)

	// GetByCircle retrieves all posts in a specific circle.
	GetByCircle(circleID string, userID string, limit, offset int) ([]PostFeedItem, error)

	// GetProjectRoots returns "project" posts that represent project roots for a user.
	// A project root is a project-type post with project_id = id (or legacy is_project=true and project_id=id).
	GetProjectRoots(userID string, limit int) ([]ProjectSummary, error)

	// Update modifies an existing post's content.
	Update(post *Post) error

	// Delete removes a post by ID. Only the owner can delete.
	Delete(postID string) error

	// SetCategories replaces all categories for a post atomically.
	SetCategories(postID string, categories []string) error

	// ApplyReelPublishFields updates reel/explore columns on posts (thumbnail, tags, etc.).
	ApplyReelPublishFields(postID string, req CreatePostRequest) error

	// GetCategories returns all category names for a post.
	GetCategories(postID string) ([]string, error)

	// ToggleLike adds a like if not exists, removes if exists (idempotent toggle).
	// Returns the new like status (true = liked, false = unliked).
	ToggleLike(userID, postID string) (bool, error)

	// IncrementCommentCount atomically increments the comment_count on a post.
	IncrementCommentCount(postID string) error

	// DecrementCommentCount atomically decrements the comment_count on a post.
	DecrementCommentCount(postID string) error

	// SetMoods replaces creator mood tags for a post (max 2, PRD-12).
	SetMoods(postID string, moods []string) error

	// GetMoods returns mood tag names for a post.
	GetMoods(postID string) ([]string, error)
}

// CommentRepository defines the data access contract for comments.
type CommentRepository interface {
	// Create inserts a new comment.
	Create(comment *Comment) error

	// GetByPostID retrieves all comments for a post, paginated.
	GetByPostID(postID string, limit, offset int) ([]Comment, error)

	// Delete removes a comment by ID.
	Delete(commentID string) error

	// GetByID retrieves a single comment by ID.
	GetByID(commentID string) (*Comment, error)
}
