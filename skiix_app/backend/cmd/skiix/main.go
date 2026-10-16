package main

// @title           Skiix API
// @version         1.0
// @description     Skiix authentication API with JWT and OAuth2 support
// @host            localhost:8080
// @basePath         /
// @schemes          http https
// @securityDefinitions.apikey Bearer
// @in               header
// @name             Authorization
// @description      Type "Bearer" followed by a space and JWT token
// @x-tokenName      Authorization

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/markbates/goth"
	"github.com/markbates/goth/providers/google"
	_ "github.com/skiix-backend/docs"
	httpHandler "github.com/skiix-backend/internal/delivery/http"
	"github.com/skiix-backend/internal/domain"
	"github.com/skiix-backend/internal/infrastructure"
	"github.com/skiix-backend/internal/repository"
	"github.com/skiix-backend/internal/usecase"
	"github.com/skiix-backend/pkg/config"
	"github.com/skiix-backend/pkg/logger"
	"github.com/skiix-backend/pkg/migration"
	"github.com/skiix-backend/pkg/telemetry"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func main() {
	logger.Init()

	if err := telemetry.InitSentry(); err != nil {
		slog.Error("sentry initialization failed", slog.String("error", err.Error()))
	}
	defer telemetry.FlushSentry()

	if err := telemetry.InitPostHog(); err != nil {
		slog.Error("posthog initialization failed", slog.String("error", err.Error()))
	}
	defer telemetry.ClosePostHog()

	if err := godotenv.Load(); err != nil {
		slog.Warn("no .env file found, using environment variables")
	}

	if err := config.ValidateAuthSecrets(); err != nil {
		slog.Error("invalid auth configuration", slog.String("error", err.Error()))
		os.Exit(1)
	}

	baseURL := os.Getenv("BASE_URL")

	dbConfig := infrastructure.DatabaseConfig{
		Host:     os.Getenv("DB_HOST"),
		Port:     os.Getenv("DB_PORT"),
		User:     os.Getenv("DB_USER"),
		Password: os.Getenv("DB_PASSWORD"),
		DBName:   os.Getenv("DB_NAME"),
		SSLMode:  os.Getenv("DB_SSLMODE"),
	}

	goth.UseProviders(
		google.New(
			os.Getenv("GOOGLE_CLIENT_ID"),
			os.Getenv("GOOGLE_CLIENT_SECRET"),
			fmt.Sprintf("%s/auth/google/callback", baseURL),
			"email", "profile",
		),
	)

	var db *sql.DB
	var err error
	if dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL")); dbURL != "" {
		slog.Info("database: using DATABASE_URL (DB_* fields ignored)")
		db, err = infrastructure.NewPostgresConnectionFromURL(dbURL)
	} else {
		db, err = infrastructure.NewPostgresConnection(dbConfig)
	}
	if err != nil {
		slog.Error("failed to connect to database", slog.String("error", err.Error()))
		os.Exit(1)
	}

	if err := migration.RunMigrations(db); err != nil {
		slog.Error("failed to run database migrations", slog.String("error", err.Error()))
		os.Exit(1)
	}

	redisClient := infrastructure.NewRedisClient()

	userRepo := repository.NewPostgresUserRepository(db)
	supabaseAuth, err := infrastructure.NewSupabaseJWTValidator(
		os.Getenv("SUPABASE_URL"),
		os.Getenv("SUPABASE_JWT_SECRET"),
	)
	if err != nil {
		slog.Error("failed to initialize Supabase JWT validator", slog.String("error", err.Error()))
		os.Exit(1)
	}
	if strings.TrimSpace(os.Getenv("RESEND_API_KEY")) == "" {
		slog.Warn("RESEND_API_KEY not set — POST /api/v1/auth/send-otp will fail")
	}
	if strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_ROLE_KEY")) == "" {
		slog.Warn("SUPABASE_SERVICE_ROLE_KEY not set — signup OTP will fail")
	}
	focusModeRepo := repository.NewPostgresFocusModeRepository(db)
	postRepo := repository.NewPostgresPostRepository(db)
	commentRepo := repository.NewPostgresCommentRepository(db)
	circleRepo := repository.NewPostgresCircleRepository(db)
	feedLimitRepo := repository.NewPostgresFeedLimitRepository(db)
	deviceRepo := repository.NewPostgresDeviceRepository(db)
	refreshTokenRepo := repository.NewPostgresRefreshTokenRepository(db)
	storyRepo := repository.NewPostgresStoryRepository(db)
	connectionRepo := repository.NewPostgresConnectionRepository(db)
	projectMemberRepo := repository.NewPostgresProjectMemberRepository(db)
	followerRepo := repository.NewPostgresFollowerRepository(db)
	jwtService := infrastructure.NewJWTService()
	passwordService := infrastructure.NewPasswordService()
	cloudinaryClient, cloudErr := infrastructure.NewCloudinary()
	if cloudErr != nil {
		slog.Warn("cloudinary not configured", slog.String("error", cloudErr.Error()))
	}

	firebaseService := infrastructure.NewFirebaseService()
	credentialsPath := os.Getenv("FIREBASE_CREDENTIALS_PATH")
	if credentialsPath != "" {
		if err := firebaseService.Init(credentialsPath); err != nil {
			slog.Error("failed to initialize Firebase Admin SDK", slog.String("error", err.Error()))
		}
	} else {
		slog.Warn("FIREBASE_CREDENTIALS_PATH not set, push notifications will be disabled")
	}

	plusChecker := infrastructure.NoopPlusChecker{}
	moodRepo := repository.NewPostgresMoodRepository(db)

	authUsecase := usecase.NewAuthUsecase(userRepo, jwtService, passwordService, refreshTokenRepo)
	focusModeUsecase := usecase.NewFocusModeUsecase(focusModeRepo)
	circleUsecase := usecase.NewCircleUsecase(circleRepo)
	postUsecase := usecase.NewPostUsecase(postRepo, commentRepo, circleRepo, deviceRepo, firebaseService, projectMemberRepo, plusChecker)
	feedLimitUsecase := usecase.NewFeedLimitUsecase(feedLimitRepo)
	deviceUsecase := usecase.NewDeviceUsecase(deviceRepo)
	moodUsecase := usecase.NewMoodUsecase(moodRepo, plusChecker)

	waitlistRepo := repository.NewPostgresWaitlistRepository(db)
	var audienceSyncer domain.AudienceSyncer = infrastructure.NoopAudienceSyncer{}
	if resendKey := strings.TrimSpace(os.Getenv("RESEND_API_KEY")); resendKey != "" {
		audienceSyncer = infrastructure.NewResendAudienceSyncer(resendKey, os.Getenv("RESEND_AUDIENCE_ID"))
	}
	waitlistUsecase := usecase.NewWaitlistUsecase(waitlistRepo, audienceSyncer)
	notifRepo := repository.NewPostgresNotificationRepository(db)
	notifUsecase := usecase.NewNotificationUsecase(notifRepo)
	searchRepo := repository.NewPostgresSearchRepository(db)
	searchUsecase := usecase.NewSearchUsecase(searchRepo)

	router := gin.New()
	router.Use(httpHandler.RequestIDMiddleware())
	router.Use(gin.Recovery())
	router.Use(httpHandler.NewSentryMiddleware())
	router.Use(httpHandler.NewCORSMiddleware())
	router.Use(httpHandler.NewSecurityHeadersMiddleware())
	router.Use(httpHandler.NewRequestLoggerMiddleware())

	globalRPM := 100
	if val := os.Getenv("RATE_LIMIT_GLOBAL_RPM"); val != "" {
		if parsed, err := strconv.Atoi(val); err == nil {
			globalRPM = parsed
		}
	}
	router.Use(httpHandler.NewRateLimitMiddleware(redisClient, httpHandler.RateLimiterConfig{
		RequestsPerMinute: globalRPM,
		KeyPrefix:         "global",
	}))

	healthHandler := httpHandler.NewHealthHandler(db)
	router.GET("/health", healthHandler.Check)

	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	router.GET("/docs", func(c *gin.Context) {
		c.Redirect(302, "/swagger/index.html")
	})

	httpHandler.RegisterAuthRoutes(router, authUsecase, jwtService, redisClient)
	httpHandler.RegisterFocusModeRoutes(router, focusModeUsecase, jwtService)
	httpHandler.RegisterPostRoutes(router, postUsecase, userRepo, jwtService, supabaseAuth, db)
	httpHandler.RegisterMoodRoutes(router, moodUsecase, jwtService, supabaseAuth, userRepo)
	httpHandler.RegisterCircleRoutes(router, circleUsecase, jwtService)
	httpHandler.RegisterFeedLimitRoutes(router, feedLimitUsecase, jwtService)
	httpHandler.RegisterDeviceRoutes(router, deviceUsecase, jwtService, supabaseAuth, userRepo)
	httpHandler.RegisterChatRoutes(router, firebaseService, jwtService, supabaseAuth, userRepo)
	httpHandler.RegisterUploadRoutes(router, jwtService, cloudinaryClient, supabaseAuth)
	httpHandler.RegisterSocialRoutes(router, storyRepo, connectionRepo, userRepo, supabaseAuth)
	httpHandler.RegisterFollowProjectRoutes(router, userRepo, followerRepo, projectMemberRepo, postRepo)
	httpHandler.RegisterUserProfileRoutes(router, userRepo, supabaseAuth, db)
	httpHandler.RegisterConversationRoutes(router, db, supabaseAuth)
	httpHandler.RegisterAIRoutes(router, supabaseAuth)
	httpHandler.RegisterFeedFeatureRoutes(router, db, jwtService, supabaseAuth, userRepo)
	httpHandler.RegisterExploreRoutes(router, db)
	httpHandler.RegisterReelsRoutes(router, db, jwtService, supabaseAuth, userRepo)
	httpHandler.RegisterWaitlistRoutes(router, waitlistUsecase, redisClient)
	httpHandler.RegisterNotificationRoutes(router, notifUsecase, jwtService, supabaseAuth, userRepo)
	httpHandler.RegisterSearchRoutes(router, searchUsecase, jwtService, supabaseAuth, userRepo)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		slog.Info("server started",
			slog.String("addr", srv.Addr),
			slog.String("env", os.Getenv("APP_ENV")),
			slog.Int("pid", os.Getpid()),
		)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server listen error", slog.String("error", err.Error()))
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	sig := <-quit

	slog.Info("shutdown signal received, draining connections...",
		slog.String("signal", sig.String()),
	)

	timeoutSec := 10
	if val := os.Getenv("SHUTDOWN_TIMEOUT_SECONDS"); val != "" {
		if parsed, err := strconv.Atoi(val); err == nil {
			timeoutSec = parsed
		}
	}

	shutdownCtx, cancel := context.WithTimeout(
		context.Background(),
		time.Duration(timeoutSec)*time.Second,
	)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("http server forced shutdown", slog.String("error", err.Error()))
	} else {
		slog.Info("http server stopped gracefully")
	}

	if err := redisClient.Close(); err != nil {
		slog.Error("redis close error", slog.String("error", err.Error()))
	} else {
		slog.Info("redis connection closed")
	}

	if err := infrastructure.CloseDatabase(db); err != nil {
		slog.Error("database close error", slog.String("error", err.Error()))
	} else {
		slog.Info("database connection closed")
	}

	slog.Info("server shutdown complete")
}
