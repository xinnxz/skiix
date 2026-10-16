package infrastructure

import (
	"fmt"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// SupabaseAccessClaims is the subset of claims we need from a Supabase Auth access_token.
// Modern projects use ES256 (JWKS); legacy projects may use HS256 (symmetric JWT secret).
type SupabaseAccessClaims struct {
	Sub   string `json:"sub"`
	Email string `json:"email"`
	jwt.RegisteredClaims
}

// ParseSupabaseAccessToken validates a token using the shared SupabaseJWTValidator.
// Deprecated: prefer SupabaseJWTValidator.Validate directly.
func ParseSupabaseAccessToken(validator *SupabaseJWTValidator, bearer string) (*SupabaseAccessClaims, error) {
	if validator == nil {
		return nil, fmt.Errorf("supabase JWT validator is not configured")
	}
	claims, log := validator.Validate(bearer)
	if !log.Success {
		if log.FailureReason != "" {
			return nil, fmt.Errorf("%s", log.FailureReason)
		}
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}

// ParseSupabaseAccessTokenUnverified extracts claims without signature verification.
// Dev-only fallback when SUPABASE_JWT_SECRET is not configured locally.
func ParseSupabaseAccessTokenUnverified(bearer string) (*SupabaseAccessClaims, error) {
	raw := stripBearerToken(bearer)
	if raw == "" {
		return nil, fmt.Errorf("missing token")
	}
	token, _, err := jwt.NewParser().ParseUnverified(raw, &SupabaseAccessClaims{})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*SupabaseAccessClaims)
	if !ok || claims == nil {
		return nil, fmt.Errorf("invalid token claims")
	}
	if strings.TrimSpace(claims.Sub) == "" {
		return nil, fmt.Errorf("invalid token: missing sub")
	}
	return claims, nil
}
