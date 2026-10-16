package infrastructure

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

// NewRedisClient creates and returns a new Redis client.
func NewRedisClient() *redis.Client {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379"
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("Failed to parse REDIS_URL: %v", err)
	}

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("Warning: Redis connection failed: %v. Rate limiting will be disabled.", err)
	} else {
		log.Println("Connected to Redis successfully.")
	}

	return client
}
