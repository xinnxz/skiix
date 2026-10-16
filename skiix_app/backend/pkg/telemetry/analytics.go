package telemetry

import (
	"log/slog"

	"github.com/posthog/posthog-go"
)

// Analytics is a business-logic-friendly interface for product event tracking.
type Analytics interface {
	Track(userID string, event string, properties map[string]interface{})
	Identify(userID string, properties map[string]interface{})
}

type postHogAnalytics struct{}

// NewAnalytics returns an Analytics implementation (no-op when PostHog is disabled).
func NewAnalytics() Analytics {
	return &postHogAnalytics{}
}

func (a *postHogAnalytics) Track(userID string, event string, properties map[string]interface{}) {
	if phClient == nil {
		return
	}

	props := posthog.NewProperties().Set("$lib", "skiix-backend")
	for k, v := range properties {
		props.Set(k, v)
	}

	if err := phClient.Enqueue(posthog.Capture{
		DistinctId: userID,
		Event:      event,
		Properties: props,
	}); err != nil {
		slog.Error("posthog track error",
			slog.String("event", event),
			slog.String("user_id", userID),
			slog.String("error", err.Error()),
		)
	}
}

func (a *postHogAnalytics) Identify(userID string, properties map[string]interface{}) {
	if phClient == nil {
		return
	}

	props := posthog.NewProperties()
	for k, v := range properties {
		props.Set(k, v)
	}

	if err := phClient.Enqueue(posthog.Identify{
		DistinctId: userID,
		Properties: props,
	}); err != nil {
		slog.Error("posthog identify error",
			slog.String("user_id", userID),
			slog.String("error", err.Error()),
		)
	}
}

// NoopAnalytics satisfies Analytics without network calls (tests).
type NoopAnalytics struct{}

func (n *NoopAnalytics) Track(_ string, _ string, _ map[string]interface{}) {}
func (n *NoopAnalytics) Identify(_ string, _ map[string]interface{})        {}
