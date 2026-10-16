package http

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/skiix-backend/internal/domain"
)

const UserContextKey = "user"

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
		c.Next()
	}
}
