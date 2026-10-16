package http

import (
	"github.com/getsentry/sentry-go"
	sentrygin "github.com/getsentry/sentry-go/gin"
	"github.com/gin-gonic/gin"
)

// NewSentryMiddleware integrates Sentry error tracking with Gin.
func NewSentryMiddleware() gin.HandlerFunc {
	return sentrygin.New(sentrygin.Options{
		Repanic:         true,
		WaitForDelivery: false,
	})
}

// EnrichSentryScope attaches authenticated user context to the active Sentry scope.
func EnrichSentryScope() gin.HandlerFunc {
	return func(c *gin.Context) {
		if hub := sentrygin.GetHubFromContext(c); hub != nil {
			if userID, exists := c.Get("user_id"); exists {
				hub.Scope().SetUser(sentry.User{
					ID: userID.(string),
				})
			}
			hub.Scope().SetTag("path", c.Request.URL.Path)
			hub.Scope().SetTag("method", c.Request.Method)
		}
		c.Next()
	}
}
