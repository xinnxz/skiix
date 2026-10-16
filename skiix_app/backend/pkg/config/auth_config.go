package config

import (
	"errors"
	"fmt"
	"os"
	"strings"
)

const minJWTSecretLength = 32

// ValidateAuthSecrets ensures JWT signing keys are present before the server starts.
// In production (APP_ENV=production), secrets must be at least 32 characters.
func ValidateAuthSecrets() error {
	accessSecret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if accessSecret == "" {
		return errors.New("JWT_SECRET environment variable is required")
	}

	env := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	if env == "production" && len(accessSecret) < minJWTSecretLength {
		return fmt.Errorf("JWT_SECRET must be at least %d characters in production", minJWTSecretLength)
	}

	refreshSecret := strings.TrimSpace(os.Getenv("JWT_REFRESH_SECRET"))
	if refreshSecret != "" && env == "production" && len(refreshSecret) < minJWTSecretLength {
		return fmt.Errorf("JWT_REFRESH_SECRET must be at least %d characters in production", minJWTSecretLength)
	}

	return nil
}
