package usecase

import (
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/skiix-backend/internal/domain"
	"github.com/skiix-backend/internal/infrastructure"
	"github.com/skiix-backend/pkg/quiethours"
)

// postUsecase implements the business logic for posts and comments.
type postUsecase struct {
	postRepo       domain.PostRepository
	commentRepo    domain.CommentRepository
	circleRepo     domain.CircleRepository
	deviceRepo     domain.DeviceRepository
	firebaseSvc    domain.FirebaseService
	projectMembers domain.ProjectMemberRepository
	plusChecker    domain.PlusSubscriberChecker
}

// PostUsecase defines the operations available for the posts feature.
type PostUsecase interface {
	// CreatePost validates input and creates a new post.
	CreatePost(userID string, req domain.CreatePostRequest) (*domain.Post, error)

	// GetFeed returns a paginated feed of posts for the given user.
	// mood filters by creator mood tag when non-empty (Mood Feed).
	GetFeed(userID string, limit, offset int, mood string) ([]domain.PostFeedItem, error)

	// UpdatePostMoods lets the creator edit mood tags within 24 hours of publish.
	UpdatePostMoods(userID, postID string, moods []string) error

	// GetCreatorPostMoods returns mood tags for a post (creator only).
	GetCreatorPostMoods(userID, postID string) ([]string, error)

	// GetUserPosts returns all posts by a specific user.
	GetUserPosts(userID string, limit, offset int) ([]domain.PostFeedItem, error)

	// GetPost returns a single post by ID.
	GetPost(postID string) (*domain.Post, error)

	// UpdatePost validates and updates a post. Only the owner may update.
	UpdatePost(userID, postID, content string, imageURL *string) (*domain.Post, error)

	// DeletePost removes a post. Only the owner may delete.
	DeletePost(userID, postID string) error

	// ToggleLike adds or removes a like on a post.
	ToggleLike(userID, postID string) (bool, error)

	// AddComment validates and creates a comment on a post.
	AddComment(userID, postID, content string) (*domain.Comment, error)

	// GetComments returns paginated comments for a post.
	GetComments(postID string, limit, offset int) ([]domain.Comment, error)

	// DeleteComment removes a comment. Only the owner may delete.
	DeleteComment(userID, commentID string) error

	// GetCircleFeed returns a paginated list of posts for a specific circle.
	GetCircleFeed(circleID string, userID string, limit, offset int) ([]domain.PostFeedItem, error)
}

// NewPostUsecase constructs a PostUsecase with injected repositories.
func NewPostUsecase(postRepo domain.PostRepository, commentRepo domain.CommentRepository, circleRepo domain.CircleRepository, deviceRepo domain.DeviceRepository, firebaseSvc domain.FirebaseService, projectMembers domain.ProjectMemberRepository, plusChecker domain.PlusSubscriberChecker) PostUsecase {
	if plusChecker == nil {
		plusChecker = infrastructure.NoopPlusChecker{}
	}
	return &postUsecase{
		postRepo:       postRepo,
		commentRepo:    commentRepo,
		circleRepo:     circleRepo,
		deviceRepo:     deviceRepo,
		firebaseSvc:    firebaseSvc,
		projectMembers: projectMembers,
		plusChecker:    plusChecker,
	}
}

// --- Validation constants ---
const (
	maxPostContentLength      = 5000
	maxCommentContentLength   = 500
	maxPostCategoryNameLength = 100
	maxCategoriesPerPost      = 10
	defaultFeedLimit          = 20
	maxFeedLimit              = 50
	minMoodsPerPost           = 1
	maxMoodsPerPost           = 2
	moodEditWindow            = 24 * time.Hour
)

// CreatePost validates the request and creates a new post.
// Business rules:
//   - Content is required (min 1 char after trimming)
//   - Content max 5000 characters
//   - Max 10 categories per post
//   - Each category max 100 characters, auto-trimmed
//   - Duplicate categories are auto-deduplicated
func (u *postUsecase) CreatePost(userID string, req domain.CreatePostRequest) (*domain.Post, error) {
	// Trim input
	req.Content = strings.TrimSpace(req.Content)
	if strings.TrimSpace(req.Visibility) == "" {
		req.Visibility = "public"
	}
	if req.MediaURL != nil {
		trim := strings.TrimSpace(*req.MediaURL)
		req.MediaURL = &trim
	}
	if req.ImageURL != nil {
		trim := strings.TrimSpace(*req.ImageURL)
		req.ImageURL = &trim
	}

	// Validate and deduplicate categories
	categories, err := validateAndDeduplicateCategories(req.Categories)
	if err != nil {
		return nil, err
	}

	if req.Visibility == "circle" {
		if req.CircleID == nil || *req.CircleID == "" {
			return nil, errors.New("circle_id is required for circle posts")
		}
		isMember, err := u.circleRepo.IsMember(*req.CircleID, userID)
		if err != nil {
			return nil, fmt.Errorf("failed to verify circle membership: %w", err)
		}
		if !isMember {
			return nil, errors.New("you are not a member of this circle")
		}
	} else if req.Visibility != "public" {
		return nil, errors.New("invalid visibility")
	}

	req.Type = strings.TrimSpace(strings.ToLower(req.Type))
	if req.Type == "" {
		// Back-compat: infer from old is_project flag.
		if req.IsProject {
			req.Type = "project"
		} else {
			req.Type = "text"
		}
	}

	// Keep old boolean in sync (project_update is a text-style post linked to a project).
	req.IsProject = (req.Type == "project" || req.IsProject) && req.Type != "project_update"

	// Validate payload by type.
	switch req.Type {
	case "reel", "story":
		if req.MediaURL == nil || strings.TrimSpace(*req.MediaURL) == "" {
			// Allow legacy image_url as media_url
			if req.ImageURL != nil && strings.TrimSpace(*req.ImageURL) != "" {
				req.MediaURL = req.ImageURL
			} else {
				return nil, errors.New("media_url is required")
			}
		}
		// Caption is optional.
		if utf8.RuneCountInString(req.Content) > maxPostContentLength {
			return nil, errors.New("content is too long (max 5000 characters)")
		}
	case "text":
		hasExtra := len(req.ExtraMediaURLs) > 0
		hasPrimary := req.MediaURL != nil && strings.TrimSpace(*req.MediaURL) != ""
		hasImage := req.ImageURL != nil && strings.TrimSpace(*req.ImageURL) != ""
		if req.Content == "" && !hasPrimary && !hasImage && !hasExtra {
			return nil, errors.New("content cannot be empty")
		}
		if utf8.RuneCountInString(req.Content) > maxPostContentLength {
			return nil, errors.New("content is too long (max 5000 characters)")
		}
	case "project":
		if req.Content == "" {
			return nil, errors.New("content cannot be empty")
		}
		if utf8.RuneCountInString(req.Content) > maxPostContentLength {
			return nil, errors.New("content is too long (max 5000 characters)")
		}
	case "project_update":
		if req.ProjectID == nil || strings.TrimSpace(*req.ProjectID) == "" {
			return nil, errors.New("project_id is required")
		}
		projectID := strings.TrimSpace(*req.ProjectID)
		root, rootErr := u.postRepo.GetByID(projectID)
		if rootErr != nil || root == nil {
			return nil, errors.New("project not found")
		}
		if root.Type != "project" && !root.IsProject {
			return nil, errors.New("invalid project_id")
		}
		if u.projectMembers != nil {
			isOwner := root.UserID == userID
			if !isOwner {
				member, memErr := u.projectMembers.IsMember(userID, projectID)
				if memErr != nil {
					return nil, fmt.Errorf("failed to verify project membership: %w", memErr)
				}
				if !member {
					return nil, errors.New("you are not a member of this project")
				}
			}
		}
		hasExtra := len(req.ExtraMediaURLs) > 0
		hasPrimary := req.MediaURL != nil && strings.TrimSpace(*req.MediaURL) != ""
		hasImage := req.ImageURL != nil && strings.TrimSpace(*req.ImageURL) != ""
		if req.Content == "" && !hasPrimary && !hasImage && !hasExtra {
			return nil, errors.New("content cannot be empty")
		}
		if utf8.RuneCountInString(req.Content) > maxPostContentLength {
			return nil, errors.New("content is too long (max 5000 characters)")
		}
	default:
		return nil, errors.New("invalid type")
	}

	post := &domain.Post{
		ID:         uuid.New().String(),
		UserID:     userID,
		Type:       req.Type,
		Content:    req.Content,
		MediaURL:   req.MediaURL,
		IsProject:  req.IsProject,
		ProjectID:  req.ProjectID,
		Visibility: req.Visibility,
		CircleID:   req.CircleID,
	}

	// For "project" posts, default project_id to the post id so the post itself can be joined.
	if post.Type == "project" || post.IsProject {
		if post.ProjectID == nil || strings.TrimSpace(*post.ProjectID) == "" {
			post.ProjectID = &post.ID
		}
	}

	if req.MediaURL != nil {
		trimmed := strings.TrimSpace(*req.MediaURL)
		post.MediaURL = &trimmed
	}
	// Legacy image_url alias.
	if post.MediaURL == nil && req.ImageURL != nil {
		trimmed := strings.TrimSpace(*req.ImageURL)
		post.MediaURL = &trimmed
		post.ImageURL = &trimmed
	}
	if post.MediaURL != nil && post.ImageURL == nil {
		post.ImageURL = post.MediaURL
	}

	if err := u.postRepo.Create(post); err != nil {
		return nil, err
	}

	// Attach categories if provided
	if len(categories) > 0 {
		if err := u.postRepo.SetCategories(post.ID, categories); err != nil {
			return nil, err
		}
	}

	// Optional metadata/tags/extra-media — applied for all types when the client sends fields.
	if err := u.postRepo.ApplyReelPublishFields(post.ID, req); err != nil {
		return nil, err
	}

	if len(req.Moods) > 0 {
		moods, moodErr := validateAndDeduplicateMoods(req.Moods)
		if moodErr != nil {
			return nil, moodErr
		}
		if err := u.ensureMoodAccess(userID, moods); err != nil {
			return nil, err
		}
		if err := u.postRepo.SetMoods(post.ID, moods); err != nil {
			return nil, err
		}
	}

	return post, nil
}

// GetFeed returns a paginated feed of posts.
// Applies safe pagination: default 20 items, max 50.
func (u *postUsecase) GetFeed(userID string, limit, offset int, mood string) ([]domain.PostFeedItem, error) {
	limit = clampLimit(limit)
	if offset < 0 {
		offset = 0
	}

	mood = domain.NormalizePostMood(mood)
	if mood != "" && !domain.IsValidPostMood(mood) {
		return nil, fmt.Errorf("invalid mood '%s'", mood)
	}
	if mood != "" {
		if err := u.ensureMoodAccess(userID, []string{mood}); err != nil {
			return nil, err
		}
	}

	return u.postRepo.GetFeed(domain.FeedQuery{
		Limit:  limit,
		Offset: offset,
		UserID: userID,
		Mood:   mood,
	})
}

func (u *postUsecase) UpdatePostMoods(userID, postID string, moods []string) error {
	post, err := u.postRepo.GetByID(postID)
	if err != nil {
		return err
	}
	if post.UserID != userID {
		return errors.New("forbidden: only the post owner can edit mood tags")
	}
	if time.Since(post.CreatedAt) > moodEditWindow {
		return errors.New("mood tags can only be edited within 24 hours of posting")
	}
	moods, err = validateAndDeduplicateMoods(moods)
	if err != nil {
		return err
	}
	if err := u.ensureMoodAccess(userID, moods); err != nil {
		return err
	}
	return u.postRepo.SetMoods(postID, moods)
}

func (u *postUsecase) GetCreatorPostMoods(userID, postID string) ([]string, error) {
	post, err := u.postRepo.GetByID(postID)
	if err != nil {
		return nil, err
	}
	if post.UserID != userID {
		return nil, errors.New("forbidden: mood tags are only visible to the post creator")
	}
	return u.postRepo.GetMoods(postID)
}

// GetUserPosts returns all posts by a specific user.
func (u *postUsecase) GetUserPosts(userID string, limit, offset int) ([]domain.PostFeedItem, error) {
	limit = clampLimit(limit)
	if offset < 0 {
		offset = 0
	}
	return u.postRepo.GetByUserID(userID, limit, offset)
}

// GetPost returns a single post by ID.
func (u *postUsecase) GetPost(postID string) (*domain.Post, error) {
	if postID == "" {
		return nil, errors.New("post ID is required")
	}
	return u.postRepo.GetByID(postID)
}

// UpdatePost validates and updates a post.
// Only the owner (userID matches post.UserID) may update.
func (u *postUsecase) UpdatePost(userID, postID, content string, imageURL *string) (*domain.Post, error) {
	post, err := u.postRepo.GetByID(postID)
	if err != nil {
		return nil, err
	}

	// Authorization check: only owner can update
	if post.UserID != userID {
		return nil, errors.New("forbidden: you can only edit your own posts")
	}

	// Validate new content
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, errors.New("content cannot be empty")
	}
	if utf8.RuneCountInString(content) > maxPostContentLength {
		return nil, errors.New("content is too long (max 5000 characters)")
	}

	post.Content = content
	if imageURL != nil {
		trimmed := strings.TrimSpace(*imageURL)
		post.ImageURL = &trimmed
	}

	if err := u.postRepo.Update(post); err != nil {
		return nil, err
	}

	return post, nil
}

// DeletePost removes a post. Only the owner may delete.
func (u *postUsecase) DeletePost(userID, postID string) error {
	post, err := u.postRepo.GetByID(postID)
	if err != nil {
		return err
	}

	// Authorization check: only owner can delete
	if post.UserID != userID {
		return errors.New("forbidden: you can only delete your own posts")
	}

	return u.postRepo.Delete(postID)
}

// ToggleLike toggles a like on a post.
// Returns true if post is now liked, false if unliked.
func (u *postUsecase) ToggleLike(userID, postID string) (bool, error) {
	// Verify post exists before toggling
	if _, err := u.postRepo.GetByID(postID); err != nil {
		return false, err
	}
	isLiked, err := u.postRepo.ToggleLike(userID, postID)
	if err != nil {
		return false, err
	}

	// Post exists because we checked above
	post, _ := u.postRepo.GetByID(postID)
	if isLiked && post.UserID != userID {
		go u.sendNotificationToPostOwner(post.UserID, "New Like", "Someone liked your post!")
	}

	return isLiked, nil
}

// AddComment validates and creates a comment on a post.
// Business rules:
//   - Content is required (min 1 char after trimming)
//   - Content max 500 characters
func (u *postUsecase) AddComment(userID, postID, content string) (*domain.Comment, error) {
	// Verify post exists
	if _, err := u.postRepo.GetByID(postID); err != nil {
		return nil, errors.New("post not found")
	}

	content = strings.TrimSpace(content)
	if content == "" {
		return nil, errors.New("comment content cannot be empty")
	}
	if utf8.RuneCountInString(content) > maxCommentContentLength {
		return nil, errors.New("comment is too long (max 500 characters)")
	}

	comment := &domain.Comment{
		ID:      uuid.New().String(),
		PostID:  postID,
		UserID:  userID,
		Content: content,
	}

	if err := u.commentRepo.Create(comment); err != nil {
		return nil, err
	}

	// Atomically increment the comment counter on the post
	_ = u.postRepo.IncrementCommentCount(postID)

	post, _ := u.postRepo.GetByID(postID)
	if post != nil && post.UserID != userID {
		go u.sendNotificationToPostOwner(post.UserID, "New Comment", "Someone commented on your post!")
	}

	out, err := u.commentRepo.GetByID(comment.ID)
	if err != nil {
		return comment, nil
	}
	return out, nil
}

// GetComments returns paginated comments for a post.
func (u *postUsecase) GetComments(postID string, limit, offset int) ([]domain.Comment, error) {
	// Verify post exists
	if _, err := u.postRepo.GetByID(postID); err != nil {
		return nil, errors.New("post not found")
	}

	limit = clampLimit(limit)
	if offset < 0 {
		offset = 0
	}

	return u.commentRepo.GetByPostID(postID, limit, offset)
}

// GetCircleFeed returns a paginated list of posts for a specific circle.
func (u *postUsecase) GetCircleFeed(circleID string, userID string, limit, offset int) ([]domain.PostFeedItem, error) {
	isMember, err := u.circleRepo.IsMember(circleID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to verify membership: %w", err)
	}
	if !isMember {
		return nil, errors.New("403 Forbidden")
	}

	if limit <= 0 || limit > 50 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	return u.postRepo.GetByCircle(circleID, userID, limit, offset)
}

// DeleteComment removes a comment. Only the owner may delete.
func (u *postUsecase) DeleteComment(userID, commentID string) error {
	comment, err := u.commentRepo.GetByID(commentID)
	if err != nil {
		return err
	}

	// Authorization check: only comment owner can delete
	if comment.UserID != userID {
		return errors.New("forbidden: you can only delete your own comments")
	}

	if err := u.commentRepo.Delete(commentID); err != nil {
		return err
	}

	// Atomically decrement the comment counter on the post
	_ = u.postRepo.DecrementCommentCount(comment.PostID)

	return nil
}

// --- Helpers ---

// validateAndDeduplicateCategories trims, deduplicates, and validates
// the category list. Returns an error if limits are exceeded.
func validateAndDeduplicateCategories(raw []string) ([]string, error) {
	seen := make(map[string]struct{})
	result := make([]string, 0, len(raw))

	for _, cat := range raw {
		cat = strings.TrimSpace(cat)
		cat = strings.ToLower(cat)
		if cat == "" {
			continue
		}
		if utf8.RuneCountInString(cat) > maxPostCategoryNameLength {
			return nil, errors.New("category name is too long (max 100 characters)")
		}
		if !domain.IsValidCategory(cat) {
			return nil, fmt.Errorf("invalid category '%s', valid categories are: %v", cat, domain.ValidCategories)
		}
		if _, exists := seen[cat]; !exists {
			seen[cat] = struct{}{}
			result = append(result, cat)
		}
	}

	if len(result) > maxCategoriesPerPost {
		return nil, errors.New("too many categories (max 10 per post)")
	}

	return result, nil
}

// clampLimit enforces min/max bounds on pagination limit.
func clampLimit(limit int) int {
	if limit <= 0 {
		return defaultFeedLimit
	}
	if limit > maxFeedLimit {
		return maxFeedLimit
	}
	return limit
}

func (u *postUsecase) sendNotificationToPostOwner(ownerID, title, body string) {
	if u.firebaseSvc == nil || u.deviceRepo == nil {
		return
	}
	if settings, err := u.deviceRepo.GetQuietHours(ownerID); err == nil && settings.Enabled {
		if inQuiet, qerr := quiethours.IsInQuietWindow(time.Now(), settings.StartHour, settings.EndHour, settings.Timezone); qerr == nil && inQuiet {
			slog.Debug("push suppressed by quiet hours", "user_id", ownerID, "title", title)
			return
		}
	}
	tokens, err := u.deviceRepo.GetTokensByUserID(ownerID)
	if err != nil || len(tokens) == 0 {
		return
	}
	_ = u.firebaseSvc.SendPushNotification(tokens, title, body, nil)
}

func (u *postUsecase) ensureMoodAccess(userID string, moods []string) error {
	return EnsureMoodAccess(u.plusChecker, userID, moods)
}

func validateAndDeduplicateMoods(raw []string) ([]string, error) {
	seen := make(map[string]struct{})
	result := make([]string, 0, len(raw))
	for _, mood := range raw {
		mood = domain.NormalizePostMood(mood)
		if mood == "" {
			continue
		}
		if !domain.IsValidPostMood(mood) {
			return nil, fmt.Errorf("invalid mood '%s'", mood)
		}
		if _, exists := seen[mood]; !exists {
			seen[mood] = struct{}{}
			result = append(result, mood)
		}
	}
	if len(result) < minMoodsPerPost {
		return nil, errors.New("at least one mood tag is required")
	}
	if len(result) > maxMoodsPerPost {
		return nil, errors.New("too many mood tags (max 2 per post)")
	}
	return result, nil
}
