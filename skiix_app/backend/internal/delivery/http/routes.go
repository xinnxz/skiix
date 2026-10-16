package http

import (
	"database/sql"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/skiix-backend/internal/domain"
	"github.com/skiix-backend/internal/infrastructure"
	"github.com/skiix-backend/internal/usecase"
)

type ProfileResponse struct {
	ID            string  `json:"id" example:"550e8400-e29b-41d4-a716-446655440000"`
	Email         string  `json:"email" example:"user@example.com"`
	Provider      *string `json:"provider,omitempty" example:"local"`
	EmailVerified bool    `json:"email_verified"`
	CreatedAt     string  `json:"created_at" example:"2026-03-23T10:00:00Z"`
	UpdatedAt     string  `json:"updated_at" example:"2026-03-23T10:00:00Z"`
}

func RegisterAuthRoutes(
	router *gin.Engine,
	authUsecase usecase.AuthUsecase,
	jwtService domain.JWTService,
	redisClient *redis.Client,
) {
	authHandler := NewAuthHandler(authUsecase)
	oauthHandler := NewOAuthHandler(authUsecase)

	auth := router.Group("/auth")

	authRPM := getEnvInt("RATE_LIMIT_AUTH_RPM", 5)
	auth.Use(NewRateLimitMiddleware(redisClient, RateLimiterConfig{
		RequestsPerMinute: authRPM,
		KeyPrefix:         "auth",
	}))

	{
		auth.POST("/register", authHandler.Register)
		auth.POST("/login", authHandler.Login)
		auth.POST("/refresh", authHandler.RefreshToken)
		auth.POST("/logout", JWTMiddleware(jwtService), authHandler.Logout)
		auth.GET("/profile", JWTMiddleware(jwtService), authHandler.GetProfile)
		auth.GET("/google", oauthHandler.GoogleLogin)
		auth.GET("/google/callback", oauthHandler.GoogleCallback)
	}

	// Public endpoints (no auth required)
	api := router.Group("/api/v1")
	{
		api.GET("/categories", GetCategories)
		otpHandler := NewOTPHandler()
		api.POST("/auth/send-otp", otpHandler.SendOTP)
	}
}

// RegisterFocusModeRoutes sets up the Focus Mode API endpoints.
// All endpoints require JWT authentication because focus settings
// are user-specific and private.
func RegisterFocusModeRoutes(
	router *gin.Engine,
	focusModeUsecase usecase.FocusModeUsecase,
	jwtService domain.JWTService,
) {
	focusModeHandler := NewFocusModeHandler(focusModeUsecase)

	focusMode := router.Group("/api/v1/focus-mode")
	focusMode.Use(JWTMiddleware(jwtService))
	{
		focusMode.GET("", focusModeHandler.GetStatus)
		focusMode.PUT("", focusModeHandler.Toggle)
		focusMode.PUT("/categories", focusModeHandler.SetBlockedCategories)
	}
}

// RegisterPostRoutes sets up Posts, Feed, and Comments API endpoints.
// All endpoints require JWT authentication since all interactions are
// user-specific (ownership checks, like status computation, etc.).
func RegisterPostRoutes(
	router *gin.Engine,
	postUsecase usecase.PostUsecase,
	userRepo domain.UserRepository,
	jwtService domain.JWTService,
	supabaseAuth *infrastructure.SupabaseJWTValidator,
	db *sql.DB,
) {
	postHandler := NewPostHandler(postUsecase, userRepo)
	publicPostHandler := NewPublicPostsHandlerWithDB(userRepo, postUsecase, db)

	// Public feed (read-only) so the app can show real posts without requiring
	// the legacy backend JWT. Create/like/etc remain protected.
	public := router.Group("/api/v1")
	{
		public.GET("/feed", postHandler.GetFeed)
		public.POST("/public/posts", publicPostHandler.CreatePublicPost)
		// Reading comments is public so the app can load threads without a bearer
		// token (Expo public feed + optional sign-in). POST remains authenticated.
		public.GET("/posts/:post_id/comments", postHandler.GetComments)
		postDetail := NewPostDetailHandler(db)
		public.Use(OptionalBearerAuthMiddleware(jwtService, supabaseAuth, userRepo))
		public.GET("/posts/:post_id/detail", postDetail.GetPostDetail)
	}

	api := router.Group("/api/v1")
	api.Use(BearerAuthMiddleware(jwtService, supabaseAuth, userRepo))
	{
		// Post CRUD
		api.POST("/posts", postHandler.CreatePost)
		api.GET("/posts/:post_id", postHandler.GetPost)
		api.PUT("/posts/:post_id", postHandler.UpdatePost)
		api.DELETE("/posts/:post_id", postHandler.DeletePost)

		// Like toggle (idempotent)
		api.POST("/posts/:post_id/like", postHandler.ToggleLike)

		// Comments (GET is registered on public group above)
		api.POST("/posts/:post_id/comments", postHandler.AddComment)
		api.DELETE("/posts/:post_id/comments/:comment_id", postHandler.DeleteComment)

		// User's own posts
		api.GET("/users/:user_id/posts", postHandler.GetUserPosts)

		// Mood tags (creator only)
		api.GET("/posts/:post_id/moods", postHandler.GetPostMoods)
		api.PATCH("/posts/:post_id/moods", postHandler.UpdatePostMoods)

		// Circle feed
		api.GET("/circles/:id/posts", postHandler.GetCircleFeed)
	}
}

// RegisterMoodRoutes sets up Mood Feed catalog and Plus scheduling/history.
func RegisterMoodRoutes(
	router *gin.Engine,
	moodUsecase usecase.MoodUsecase,
	jwtService domain.JWTService,
	supabaseAuth *infrastructure.SupabaseJWTValidator,
	userRepo domain.UserRepository,
) {
	h := NewMoodHandler(moodUsecase)

	public := router.Group("/api/v1")
	public.Use(OptionalBearerAuthMiddleware(jwtService, supabaseAuth, userRepo))
	{
		public.GET("/moods", h.GetMoodOptions)
	}

	authed := router.Group("/api/v1")
	authed.Use(BearerAuthMiddleware(jwtService, supabaseAuth, userRepo))
	{
		authed.POST("/moods/sessions", h.LogMoodSession)
		authed.GET("/moods/sessions", h.GetMoodSessions)
		authed.GET("/moods/schedules", h.ListMoodSchedules)
		authed.POST("/moods/schedules", h.CreateMoodSchedule)
		authed.PUT("/moods/schedules/:id", h.UpdateMoodSchedule)
		authed.DELETE("/moods/schedules/:id", h.DeleteMoodSchedule)
	}
}

// RegisterUploadRoutes sets up media upload endpoints.
// When supabaseAuth requires verification, uploads need a valid Supabase access token.
func RegisterUploadRoutes(router *gin.Engine, jwtService domain.JWTService, cld *cloudinary.Cloudinary, supabaseAuth *infrastructure.SupabaseJWTValidator) {
	uploadHandler := NewUploadHandler(cld)

	reg := func(g *gin.RouterGroup) {
		g.POST("/upload", uploadHandler.UploadMedia)
		g.POST("/media/upload", uploadHandler.UploadMedia)
	}

	api := router.Group("/api/v1")
	if supabaseAuth != nil && supabaseAuth.RequiresVerification() {
		api.Use(SupabaseJWTMiddleware(supabaseAuth))
	}
	reg(api)

	legacy := router.Group("/api")
	if supabaseAuth != nil && supabaseAuth.RequiresVerification() {
		legacy.Use(SupabaseJWTMiddleware(supabaseAuth))
	}
	legacy.POST("/upload", uploadHandler.UploadMedia)
}

// RegisterSocialRoutes sets up lightweight social endpoints for:
// - Stories (24h media + caption)
// - Connections (connect requests)
//
// Note: These endpoints are currently email-based and unauthenticated to unblock
// the mobile UI quickly. Next step is to switch them to Supabase JWT identity.
func RegisterSocialRoutes(
	router *gin.Engine,
	stories domain.StoryRepository,
	conns domain.ConnectionRepository,
	users domain.UserRepository,
	supabaseAuth *infrastructure.SupabaseJWTValidator,
) {
	h := NewSocialHandler(stories, conns, users)

	api := router.Group("/api/v1")
	{
		// Stories (read + seen are public-style; create requires Supabase session)
		api.GET("/stories/feed", h.GetStoryFeed)
		api.POST("/stories/:id/seen", h.MarkStorySeen)

		// Connections
		api.POST("/connections/request", h.RequestConnection)
		api.POST("/connections/accept", h.AcceptConnection)
		api.POST("/connections/remove", h.RemoveConnection)
		api.GET("/connections", h.ListConnections)
	}

	if supabaseAuth != nil && supabaseAuth.RequiresVerification() {
		authed := router.Group("/api/v1")
		authed.Use(SupabaseJWTMiddleware(supabaseAuth))
		{
			authed.POST("/stories", h.CreateStory)
		}
	} else {
		api.POST("/stories", h.CreateStory)
	}
}

// RegisterUserProfileRoutes sets up the profile / onboarding endpoints used by
// the React Native app. These are public-style (resolve identity from
// user_id/email in the body / query) because the mobile client carries Supabase
// JWTs, not Go-backend JWTs.
func RegisterUserProfileRoutes(router *gin.Engine, users domain.UserRepository, supabaseAuth *infrastructure.SupabaseJWTValidator, db *sql.DB) {
	h := NewUsersHandler(users, db)
	api := router.Group("/api/v1")
	{
		api.GET("/users/me", h.GetMe)
		api.GET("/users/resolve-peer", h.ResolvePeerByEmail)
		api.PUT("/users/me", h.UpdateMe)
		api.PUT("/users/me/onboarding", h.UpdateOnboarding)
		api.DELETE("/users/me", SupabaseJWTMiddleware(supabaseAuth), h.DeleteMe)
		api.GET("/users/username/available", h.CheckUsernameAvailable)
		api.GET("/users/check-username", h.CheckUsernameAvailable)
		api.POST("/users/create-profile", SupabaseJWTMiddleware(supabaseAuth), h.CreateProfile)
		// Param name must match the one used by `/users/:user_id/posts` registered
		// in RegisterPostRoutes — gin panics if wildcards at the same depth use
		// different names. We still treat the value as a username, lookup is by it.
		api.GET("/users/:user_id", h.GetByUsername)
		api.GET("/users/:user_id/stats", h.GetStatsByUsername)
	}
}

// RegisterFollowProjectRoutes sets up join-project and follow actions.
// These endpoints are currently email-based and unauthenticated to match the mobile app's public feed flow.
func RegisterFollowProjectRoutes(
	router *gin.Engine,
	users domain.UserRepository,
	follows domain.FollowerRepository,
	members domain.ProjectMemberRepository,
	posts domain.PostRepository,
) {
	h := NewFollowHandler(users, follows, members, posts)
	api := router.Group("/api/v1")
	{
		api.POST("/projects", h.CreateProject)
		api.POST("/projects/join", h.JoinProject)
		api.GET("/projects", h.ListProjects)
		api.POST("/follow", h.FollowUser)
	}
}

// RegisterCircleRoutes sets up Circle API endpoints.
func RegisterCircleRoutes(
	router *gin.Engine,
	circleUsecase *usecase.CircleUsecase,
	jwtService domain.JWTService,
) {
	circleHandler := NewCircleHandler(circleUsecase)

	circles := router.Group("/api/v1/circles")
	circles.Use(JWTMiddleware(jwtService))
	{
		circles.POST("", circleHandler.CreateCircle)
		circles.GET("", circleHandler.GetCircles)
		circles.PUT("/:id", circleHandler.UpdateCircle)
		circles.DELETE("/:id", circleHandler.DeleteCircle)

		circles.POST("/:id/members", circleHandler.AddMembers)
		circles.GET("/:id/members", circleHandler.GetMembers)
		circles.DELETE("/:id/members/:user_id", circleHandler.RemoveMember)
	}
}

// RegisterFeedLimitRoutes sets up the Daily Feed Limit API endpoints.
// All endpoints require JWT authentication since limits are user-specific.
func RegisterFeedLimitRoutes(
	router *gin.Engine,
	feedLimitUsecase usecase.FeedLimitUsecase,
	jwtService domain.JWTService,
) {
	h := NewFeedLimitHandler(feedLimitUsecase)

	feedLimit := router.Group("/api/v1/feed-limit")
	feedLimit.Use(JWTMiddleware(jwtService))
	{
		// Settings CRUD
		feedLimit.GET("", h.GetSettings)
		feedLimit.PUT("", h.UpdateSettings)
		feedLimit.DELETE("", h.DisableLimit)

		// Usage tracking
		feedLimit.GET("/usage", h.GetTodayUsage)
		feedLimit.POST("/track", h.TrackConsumption)
		feedLimit.POST("/override", h.ActivateOverride)
		feedLimit.GET("/history", h.GetUsageHistory)
	}
}

// RegisterDeviceRoutes sets up the Device / FCM Token API endpoints.
func RegisterDeviceRoutes(
	r *gin.Engine,
	uc domain.DeviceUsecase,
	jwtService domain.JWTService,
	supabaseAuth *infrastructure.SupabaseJWTValidator,
	userRepo domain.UserRepository,
) {
	handler := NewDeviceHandler(uc)
	api := r.Group("/api/v1")
	api.Use(BearerAuthMiddleware(jwtService, supabaseAuth, userRepo))
	{
		devices := api.Group("/devices")
		{
			devices.POST("/register", handler.RegisterToken)
			devices.DELETE("/unregister", handler.UnregisterToken)
			devices.PUT("/quiet-hours", handler.SetQuietHours)
			devices.GET("/quiet-hours", handler.GetQuietHours)
		}
	}
}

func RegisterNotificationRoutes(
	r *gin.Engine,
	notifUc domain.NotificationUsecase,
	jwtService domain.JWTService,
	supabaseAuth *infrastructure.SupabaseJWTValidator,
	userRepo domain.UserRepository,
) {
	handler := NewNotificationHandler(notifUc)
	api := r.Group("/api/v1")
	api.Use(BearerAuthMiddleware(jwtService, supabaseAuth, userRepo))
	{
		notifications := api.Group("/notifications")
		{
			notifications.GET("", handler.GetNotifications)
			notifications.POST("/read-all", handler.MarkAllAsRead)
			notifications.POST("/:id/read", handler.MarkAsRead)
			notifications.GET("/unread-count", handler.GetUnreadCount)
		}
	}
}

func RegisterSearchRoutes(
	r *gin.Engine,
	searchUc domain.SearchUsecase,
	jwtService domain.JWTService,
	supabaseAuth *infrastructure.SupabaseJWTValidator,
	userRepo domain.UserRepository,
) {
	handler := NewSearchHandler(searchUc)
	api := r.Group("/api/v1")
	api.Use(BearerAuthMiddleware(jwtService, supabaseAuth, userRepo))
	{
		search := api.Group("/search")
		{
			search.GET("", handler.Search)
			search.GET("/trending/hashtags", handler.TrendingHashtags)
			search.GET("/trending/posts", handler.TrendingPosts)
		}
	}
}

func RegisterWaitlistRoutes(
	router *gin.Engine,
	waitlistUsecase *usecase.WaitlistUsecase,
	redisClient *redis.Client,
) {
	handler := NewWaitlistHandler(waitlistUsecase)

	api := router.Group("/api/v1")
	api.Use(NewHourlyRateLimitMiddleware(redisClient, 5, "waitlist"))
	{
		api.POST("/waitlist", handler.SignUp)
	}

	admin := router.Group("/admin")
	{
		admin.GET("/waitlist", handler.AdminList)
	}
}

// RegisterFeedFeatureRoutes wires Discovery Shuffle, Spark, Vibe, and bookmark actions.
func RegisterFeedFeatureRoutes(
	router *gin.Engine,
	db *sql.DB,
	jwtService domain.JWTService,
	supabaseAuth *infrastructure.SupabaseJWTValidator,
	userRepo domain.UserRepository,
) {
	feed := NewFeedFeaturesHandler(db, userRepo)
	bookmark := NewBookmarkActionsHandler(db)

	public := router.Group("/api/v1")
	public.Use(OptionalBearerAuthMiddleware(jwtService, supabaseAuth, userRepo))
	{
		public.GET("/feed/shuffle", feed.GetShuffle)
		public.GET("/feed/spark", feed.GetSpark)
		public.GET("/posts/:post_id/vibes", feed.GetPostVibeStats)
	}

	authed := router.Group("/api/v1")
	authed.Use(BearerAuthMiddleware(jwtService, supabaseAuth, userRepo))
	{
		authed.POST("/posts/vibe", feed.SetVibe)
		authed.POST("/feed/spark/select", feed.SelectSpark)
		authed.POST("/bookmarks/reminder", bookmark.CreateReminder)
		authed.POST("/bookmarks/note", bookmark.CreateNote)
		authed.POST("/bookmarks/workspace", bookmark.SaveToWorkspace)
		authed.GET("/bookmarks/calendar/:post_id", bookmark.GetCalendarICS)
	}
}

// RegisterExploreRoutes wires the Explore tab grid and global search.
// Both endpoints are public — the Explore screen renders before sign-in is
// completed and we want the grid to populate as soon as the app launches.
func RegisterExploreRoutes(router *gin.Engine, db *sql.DB) {
	h := NewExploreHandler(db)
	api := router.Group("/api/v1")
	{
		api.GET("/explore", h.GetExplore)
		api.GET("/search", h.Search)
	}
}

// RegisterReelsRoutes wires the Reels tab feed and bookmark toggle.
//
// `GET /reels` uses OptionalBearerAuthMiddleware so the For You feed renders
// for anonymous viewers (with is_liked / is_saved / is_following = false) and
// the Following tab works automatically once the viewer signs in.
//
// `POST /posts/:post_id/save` is strictly authenticated because it mutates
// per-user state.
func RegisterReelsRoutes(
	router *gin.Engine,
	db *sql.DB,
	jwtService domain.JWTService,
	supabaseAuth *infrastructure.SupabaseJWTValidator,
	userRepo domain.UserRepository,
) {
	h := NewReelsHandler(db)

	public := router.Group("/api/v1")
	public.Use(OptionalBearerAuthMiddleware(jwtService, supabaseAuth, userRepo))
	{
		public.GET("/reels", h.GetReels)
	}

	authed := router.Group("/api/v1")
	authed.Use(BearerAuthMiddleware(jwtService, supabaseAuth, userRepo))
	{
		authed.POST("/posts/:post_id/save", h.ToggleSave)
	}
}

// RegisterAIRoutes sets up AI writing assist (WaveSpeed).
// When supabaseAuth requires verification, the endpoint is protected by Supabase JWT.
// Otherwise it's temporarily open so local/dev environments still work.
func RegisterAIRoutes(router *gin.Engine, supabaseAuth *infrastructure.SupabaseJWTValidator) {
	h := NewAIHandler()
	api := router.Group("/api/v1")
	if supabaseAuth != nil && supabaseAuth.RequiresVerification() {
		api.Use(SupabaseJWTMiddleware(supabaseAuth))
	}
	api.POST("/ai/assist-post", h.AssistPost)
}

// RegisterConversationRoutes sets up DM conversation endpoints (Supabase Postgres).
func RegisterConversationRoutes(router *gin.Engine, db *sql.DB, supabaseAuth *infrastructure.SupabaseJWTValidator) {
	h := NewConversationsHandler(db)
	contacts := NewMessagingContactsHandler(db)
	netProjects := NewNetworkProjectsHandler(db)
	api := router.Group("/api/v1")
	api.Use(SupabaseJWTMiddleware(supabaseAuth))
	{
		api.GET("/projects/my", netProjects.GetMyProjects)
		api.GET("/projects/:id/detail", netProjects.GetProjectDetail)
		api.GET("/projects/:id/members", netProjects.GetProjectMembers)

		api.GET("/messaging/contacts", contacts.GetEligibleContacts)
		api.GET("/conversations/unread-count", h.GetUnreadTotal)
		api.GET("/conversations", h.ListConversations)
		api.POST("/conversations", h.CreateOrGetConversation)
		api.GET("/conversations/:id/messages", h.ListMessages)
		api.POST("/conversations/:id/messages", h.CreateMessage)
		api.POST("/conversations/:id/read", h.MarkConversationRead)
		api.POST("/conversations/:id/typing", h.SetTyping)
		api.POST("/conversations/:id/pin", h.TogglePin)
		api.POST("/conversations/:id/mute", h.ToggleMute)
		api.DELETE("/conversations/:id", h.LeaveConversation)
	}

	ws := router.Group("/api/v1")
	ws.Use(SupabaseJWTQueryOrHeaderMiddleware(supabaseAuth))
	ws.GET("/ws/messaging", MessagingWebSocket)
}

// RegisterChatRoutes sets up Firebase chat token (Supabase + legacy JWT).
func RegisterChatRoutes(
	r *gin.Engine,
	fs domain.FirebaseService,
	jwtService domain.JWTService,
	supabaseAuth *infrastructure.SupabaseJWTValidator,
	userRepo domain.UserRepository,
) {
	handler := NewChatHandler(fs)
	api := r.Group("/api/v1")
	api.Use(BearerAuthMiddleware(jwtService, supabaseAuth, userRepo))
	{
		chat := api.Group("/chat")
		{
			chat.GET("/auth-token", handler.GetAuthToken)
		}
	}
}
