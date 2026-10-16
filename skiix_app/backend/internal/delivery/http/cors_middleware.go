package http

import (
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func NewCORSMiddleware() gin.HandlerFunc {
	allowedOrigins := []string{"http://localhost:3000", "http://localhost:8080"}

	envOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if envOrigins != "" {
		allowedOrigins = strings.Split(envOrigins, ",")
		for i := range allowedOrigins {
			allowedOrigins[i] = strings.TrimSpace(allowedOrigins[i])
		}
	}

	config := cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type", "X-Request-ID"},
		ExposeHeaders:    []string{"X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}

	return cors.New(config)
}
