package http

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const RequestIDKey = "request_id"

// RequestIDMiddleware generates a unique ID for every request and sets it in the header and context.
func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		reqID := c.GetHeader("X-Request-ID")
		if reqID == "" {
			reqID = uuid.New().String()
		}

		c.Set(RequestIDKey, reqID)
		c.Header("X-Request-ID", reqID)

		c.Next()
	}
}

// GetRequestID safely extracts the request ID from the Gin context.
func GetRequestID(c *gin.Context) string {
	if reqID, exists := c.Get(RequestIDKey); exists {
		if idStr, ok := reqID.(string); ok {
			return idStr
		}
	}
	return ""
}
