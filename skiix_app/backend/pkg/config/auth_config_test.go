package config

import "testing"

func TestValidateAuthSecrets_EmptySecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "")
	t.Setenv("APP_ENV", "development")

	if err := ValidateAuthSecrets(); err == nil {
		t.Fatal("expected error for empty JWT_SECRET")
	}
}

func TestValidateAuthSecrets_DevelopmentShortSecretAllowed(t *testing.T) {
	t.Setenv("JWT_SECRET", "short-dev-secret")
	t.Setenv("APP_ENV", "development")

	if err := ValidateAuthSecrets(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateAuthSecrets_ProductionRequiresLongSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "too-short")
	t.Setenv("APP_ENV", "production")

	if err := ValidateAuthSecrets(); err == nil {
		t.Fatal("expected error for short JWT_SECRET in production")
	}
}

func TestValidateAuthSecrets_ProductionValidSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "01234567890123456789012345678901")
	t.Setenv("JWT_REFRESH_SECRET", "abcdefghijklmnopqrstuvwxyzabcdef")
	t.Setenv("APP_ENV", "production")

	if err := ValidateAuthSecrets(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
