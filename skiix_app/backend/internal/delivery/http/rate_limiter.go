package http

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type RateLimiterConfig struct {
	RequestsPerMinute int
	KeyPrefix         string
}

func NewRateLimitMiddleware(redisClient *redis.Client, config RateLimiterConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		if redisClient == nil {
			c.Next()
			return
		}

		clientIP := c.ClientIP()
		key := fmt.Sprintf("ratelimit:%s:%s", config.KeyPrefix, clientIP)
		ctx := context.Background()
		now := time.Now()
		windowKey := fmt.Sprintf("%s:%d", key, now.Minute())

		pipe := redisClient.Pipeline()
		incr := pipe.Incr(ctx, windowKey)
		pipe.Expire(ctx, windowKey, 2*time.Minute)
		_, err := pipe.Exec(ctx)

		if err != nil {
			log.Printf("Warning: rate limiter unavailable, allowing request: %v", err)
			c.Next()
			return
		}

		current := incr.Val()
		remaining := int64(config.RequestsPerMinute) - current
		if remaining < 0 {
			remaining = 0
		}
		resetTime := now.Truncate(time.Minute).Add(time.Minute).Unix()

		c.Header("X-RateLimit-Limit", strconv.Itoa(config.RequestsPerMinute))
		c.Header("X-RateLimit-Remaining", strconv.FormatInt(remaining, 10))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(resetTime, 10))

		if current > int64(config.RequestsPerMinute) {
			retryAfter := resetTime - now.Unix()
			c.Header("Retry-After", strconv.FormatInt(retryAfter, 10))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, struct {
				Error      string `json:"error"`
				RetryAfter int64  `json:"retry_after"`
			}{
				Error:      "rate limit exceeded",
				RetryAfter: retryAfter,
			})
			return
		}

		c.Next()
	}
}

// NewHourlyRateLimitMiddleware limits requests per client IP per hour.
func NewHourlyRateLimitMiddleware(redisClient *redis.Client, requestsPerHour int, keyPrefix string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if redisClient == nil {
			c.Next()
			return
		}

		clientIP := c.ClientIP()
		hourBucket := time.Now().Unix() / 3600
		windowKey := fmt.Sprintf("ratelimit:%s:%s:%d", keyPrefix, clientIP, hourBucket)
		ctx := context.Background()

		pipe := redisClient.Pipeline()
		incr := pipe.Incr(ctx, windowKey)
		pipe.Expire(ctx, windowKey, 2*time.Hour)
		if _, err := pipe.Exec(ctx); err != nil {
			log.Printf("Warning: hourly rate limiter unavailable, allowing request: %v", err)
			c.Next()
			return
		}

		if incr.Val() > int64(requestsPerHour) {
			respondError(c, http.StatusTooManyRequests, "rate limit exceeded")
			c.Abort()
			return
		}

		c.Next()
	}
}

func getEnvInt(key string, defaultVal int) int {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}
	parsed, err := strconv.Atoi(val)
	if err != nil {
		return defaultVal
	}
	return parsed
}
