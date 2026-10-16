package http

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/skiix-backend/internal/infrastructure"
)

const (
	SupabaseUserIDContextKey    = "supabase_user_id"
	SupabaseUserEmailContextKey = "supabase_user_email"
)

// SupabaseJWTMiddleware validates `Authorization: Bearer <supabase access_token>`
// using Supabase JWKS (ES256) when SUPABASE_URL is configured.
func SupabaseJWTMiddleware(validator *infrastructure.SupabaseJWTValidator) gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		if h == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			c.Abort()
			return
		}
		parts := strings.SplitN(h, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || strings.TrimSpace(parts[1]) == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header"})
			c.Abort()
			return
		}

		if validator == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "auth validator not configured"})
			c.Abort()
			return
		}

		claims, authLog := validator.Validate(parts[1])
		if !authLog.Success || claims == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			c.Abort()
			return
		}

		c.Set(SupabaseUserIDContextKey, claims.Sub)
		c.Set(SupabaseUserEmailContextKey, strings.TrimSpace(strings.ToLower(claims.Email)))
		c.Next()
	}
}

// SupabaseJWTQueryOrHeaderMiddleware accepts Bearer token from header or ?token= for WebSocket upgrades.
func SupabaseJWTQueryOrHeaderMiddleware(validator *infrastructure.SupabaseJWTValidator) gin.HandlerFunc {
	core := SupabaseJWTMiddleware(validator)

	return func(c *gin.Context) {
		if strings.TrimSpace(c.GetHeader("Authorization")) != "" {
			core(c)
			return
		}
		qToken := strings.TrimSpace(c.Query("token"))
		if qToken == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
			c.Abort()
			return
		}
		c.Request.Header.Set("Authorization", "Bearer "+qToken)
		core(c)
	}
}
