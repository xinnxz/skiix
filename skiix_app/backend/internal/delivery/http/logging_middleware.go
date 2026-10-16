package http

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

// NewRequestLoggerMiddleware logs every HTTP request as structured slog after the response is written.
func NewRequestLoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := GetRequestID(c)
		start := time.Now()

		path := c.Request.URL.Path
		if query := c.Request.URL.RawQuery; query != "" {
			path = path + "?" + query
		}

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		attrs := []any{
			slog.String("method", c.Request.Method),
			slog.String("path", path),
			slog.Int("status", status),
			slog.Duration("latency", latency),
			slog.Float64("latency_ms", float64(latency.Microseconds())/1000.0),
			slog.String("client_ip", c.ClientIP()),
			slog.String("request_id", requestID),
			slog.String("user_agent", c.Request.UserAgent()),
			slog.Int("body_size", c.Writer.Size()),
		}

		if userID, exists := c.Get("user_id"); exists {
			attrs = append(attrs, slog.String("user_id", userID.(string)))
		}

		switch {
		case status >= 500:
			slog.Error("request completed", attrs...)
		case status >= 400:
			slog.Warn("request completed", attrs...)
		default:
			slog.Info("request completed", attrs...)
		}
	}
}
