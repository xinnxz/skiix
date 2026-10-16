package http

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/skiix-backend/internal/domain"
	"github.com/skiix-backend/internal/infrastructure"
)

const UserContextKey = "user"

// resolveUserFromSupabaseToken maps a verified Supabase access token to an app user row.
// Missing users are auto-created so first-time Supabase sign-ins can post immediately.
func resolveUserFromSupabaseToken(tokenString string, validator *infrastructure.SupabaseJWTValidator, users domain.UserRepository) (*domain.User, error) {
	if users == nil {
		return nil, nil
	}
	claims, authLog := validator.Validate(tokenString)
	if !authLog.Success || claims == nil {
		if authLog.FailureReason != "" {
			return nil, fmt.Errorf("%s", authLog.FailureReason)
		}
		return nil, fmt.Errorf("invalid token")
	}
	email := strings.TrimSpace(strings.ToLower(claims.Email))
	if email == "" {
		return nil, nil
	}
	u, err := users.FindByEmail(email)
	if err == nil && u != nil && u.ID != "" {
		return u, nil
	}
	provider := "supabase"
	u = &domain.User{
		ID:            uuid.New().String(),
		Email:         email,
		Password:      nil,
		Provider:      &provider,
		EmailVerified: true,
	}
	if createErr := users.Create(u); createErr != nil {
		if retry, findErr := users.FindByEmail(email); findErr == nil && retry != nil && retry.ID != "" {
			return retry, nil
		}
		return nil, createErr
	}
	if validator != nil && validator.DevUnverified() {
		log.Printf("[SupabaseAuth] auto-created app user email=%s supabase_sub=%s (dev mode)", email, claims.Sub)
	} else {
		log.Printf("[SupabaseAuth] authenticated app user_id=%s email=%s supabase_sub=%s", u.ID, email, claims.Sub)
	}
	return u, nil
}

func JWTMiddleware(jwtService domain.JWTService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "missing authorization header"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "invalid authorization header format"})
			c.Abort()
			return
		}

		tokenString := parts[1]

		payload, err := jwtService.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "invalid token"})
			c.Abort()
			return
		}

		c.Set(UserContextKey, payload)
		c.Set("user_id", payload.UserID)
		c.Next()
	}
}

// BearerAuthMiddleware accepts either a legacy Skiix JWT (JWT_SECRET) or a
// Supabase access token (verified via JWKS / ES256) and resolves the app user row
// by email for Supabase tokens.
func BearerAuthMiddleware(jwtService domain.JWTService, supabaseAuth *infrastructure.SupabaseJWTValidator, users domain.UserRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "missing authorization header"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "invalid authorization header format"})
			c.Abort()
			return
		}

		tokenString := parts[1]

		if payload, err := jwtService.ValidateToken(tokenString); err == nil && payload != nil && payload.UserID != "" {
			c.Set(UserContextKey, payload)
			c.Set("user_id", payload.UserID)
			c.Next()
			return
		}

		if supabaseAuth != nil {
			if u, err := resolveUserFromSupabaseToken(tokenString, supabaseAuth, users); err == nil && u != nil && u.ID != "" {
				payload := &domain.TokenPayload{UserID: u.ID, Email: u.Email}
				c.Set(UserContextKey, payload)
				c.Set("user_id", u.ID)
				c.Next()
				return
			}
		}

		c.JSON(http.StatusUnauthorized, ErrorResponse{Error: "invalid token"})
		c.Abort()
	}
}

// OptionalBearerAuthMiddleware tries to resolve the viewer from an
// `Authorization: Bearer …` header but never aborts. Use this on public
// endpoints whose response shape depends on viewer identity (e.g. is_liked,
// is_following) so that:
//   - anonymous requests still go through with a zero `user_id`
//   - signed-in requests get personalized fields
//
// Accepts both legacy Skiix JWTs and Supabase access tokens.
func OptionalBearerAuthMiddleware(jwtService domain.JWTService, supabaseAuth *infrastructure.SupabaseJWTValidator, users domain.UserRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.Next()
			return
		}
		tokenString := parts[1]

		if payload, err := jwtService.ValidateToken(tokenString); err == nil && payload != nil && payload.UserID != "" {
			c.Set(UserContextKey, payload)
			c.Set("user_id", payload.UserID)
			c.Next()
			return
		}

		if supabaseAuth != nil {
			if u, err := resolveUserFromSupabaseToken(tokenString, supabaseAuth, users); err == nil && u != nil && u.ID != "" {
				payload := &domain.TokenPayload{UserID: u.ID, Email: u.Email}
				c.Set(UserContextKey, payload)
				c.Set("user_id", u.ID)
			}
		}
		c.Next()
	}
}
