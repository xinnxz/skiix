package telemetry

import (
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/getsentry/sentry-go"
)

// InitSentry initializes the Sentry SDK for error tracking.
func InitSentry() error {
	dsn := os.Getenv("SENTRY_DSN")
	if dsn == "" {
		slog.Warn("sentry disabled: SENTRY_DSN not set")
		return nil
	}

	err := sentry.Init(sentry.ClientOptions{
		Dsn:              dsn,
		Environment:      getEnvOrDefault("APP_ENV", "development"),
		Release:          getEnvOrDefault("APP_VERSION", "dev"),
		TracesSampleRate: 0.2,
		EnableTracing:    true,
		AttachStacktrace: true,
	})
	if err != nil {
		return fmt.Errorf("sentry init failed: %w", err)
	}

	slog.Info("sentry initialized",
		slog.String("environment", getEnvOrDefault("APP_ENV", "development")),
		slog.String("release", getEnvOrDefault("APP_VERSION", "dev")),
	)
	return nil
}

// FlushSentry waits for buffered Sentry events before process exit.
func FlushSentry() {
	sentry.Flush(2 * time.Second)
}

func getEnvOrDefault(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
