package telemetry

import (
	"fmt"
	"log/slog"
	"os"

	"github.com/posthog/posthog-go"
)

var phClient posthog.Client

// InitPostHog initializes the PostHog Go client for product analytics.
func InitPostHog() error {
	apiKey := os.Getenv("POSTHOG_API_KEY")
	if apiKey == "" {
		slog.Warn("posthog disabled: POSTHOG_API_KEY not set")
		return nil
	}

	host := getEnvOrDefault("POSTHOG_HOST", "https://app.posthog.com")

	client, err := posthog.NewWithConfig(apiKey, posthog.Config{
		Endpoint: host,
	})
	if err != nil {
		return fmt.Errorf("posthog init failed: %w", err)
	}

	phClient = client
	slog.Info("posthog initialized", slog.String("host", host))
	return nil
}

// ClosePostHog flushes queued events and closes the PostHog client.
func ClosePostHog() {
	if phClient != nil {
		if err := phClient.Close(); err != nil {
			slog.Error("posthog close error", slog.String("error", err.Error()))
		} else {
			slog.Info("posthog client closed")
		}
	}
}
