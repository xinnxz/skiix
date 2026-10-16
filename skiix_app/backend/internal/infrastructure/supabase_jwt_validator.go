package infrastructure

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

// SupabaseAuthLog captures fields requested for auth troubleshooting.
type SupabaseAuthLog struct {
	Algorithm      string
	Issuer         string
	Kid            string
	SupabaseUserID string
	Email          string
	FailureReason  string
	Method         string // jwks-es256 | jwks-rs256 | legacy-hs256 | dev-unverified
	Success        bool
}

// SupabaseJWTValidator verifies Supabase Auth access tokens.
// Modern projects sign user access tokens with ES256; keys are fetched from JWKS.
// Legacy HS256 (symmetric JWT secret) is supported only when explicitly configured
// and must NOT be a service-role / secret API key (sb_secret_*).
type SupabaseJWTValidator struct {
	supabaseURL   string
	issuer        string
	jwksURL       string
	legacyHS256   string
	jwks          keyfunc.Keyfunc
	devUnverified bool
}

// NewSupabaseJWTValidator builds a validator from SUPABASE_URL (JWKS / ES256)
// and optional SUPABASE_JWT_SECRET (legacy HS256 only).
func NewSupabaseJWTValidator(supabaseURL, legacyJWTSecret string) (*SupabaseJWTValidator, error) {
	v := &SupabaseJWTValidator{}

	base := strings.TrimRight(strings.TrimSpace(supabaseURL), "/")
	if base == "" {
		base = strings.TrimRight(strings.TrimSpace(os.Getenv("EXPO_PUBLIC_SUPABASE_URL")), "/")
	}

	legacy := strings.TrimSpace(legacyJWTSecret)
	if isSupabaseSecretAPIKey(legacy) {
		log.Printf(
			"[SupabaseAuth] WARNING: SUPABASE_JWT_SECRET looks like a Supabase secret/service API key (sb_secret_*), not a JWT signing secret — ignoring it for token verification",
		)
		legacy = ""
	}
	v.legacyHS256 = legacy

	if base != "" {
		v.supabaseURL = base
		v.issuer = base + "/auth/v1"
		v.jwksURL = base + "/auth/v1/.well-known/jwks.json"

		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		jwks, err := keyfunc.NewDefaultCtx(ctx, []string{v.jwksURL})
		if err != nil {
			return nil, fmt.Errorf("fetch JWKS from %s: %w", v.jwksURL, err)
		}
		v.jwks = jwks
		log.Printf("[SupabaseAuth] JWKS validator ready url=%s expected_issuer=%s", v.jwksURL, v.issuer)
		return v, nil
	}

	if legacy != "" {
		log.Printf("[SupabaseAuth] legacy HS256 validation enabled (SUPABASE_URL unset); ES256 tokens will fail until SUPABASE_URL is set")
		return v, nil
	}

	v.devUnverified = true
	log.Println("[SupabaseAuth] WARNING: dev mode — Supabase tokens parsed without signature verification (set SUPABASE_URL for JWKS)")
	return v, nil
}

// RequiresVerification is true when tokens must pass cryptographic validation.
func (v *SupabaseJWTValidator) RequiresVerification() bool {
	return v != nil && !v.devUnverified
}

// DevUnverified reports whether signature verification is disabled.
func (v *SupabaseJWTValidator) DevUnverified() bool {
	return v != nil && v.devUnverified
}

// Validate verifies a bearer token and returns claims plus a structured auth log.
func (v *SupabaseJWTValidator) Validate(bearer string) (*SupabaseAccessClaims, SupabaseAuthLog) {
	authLog := SupabaseAuthLog{}

	if v == nil {
		authLog.FailureReason = "supabase JWT validator not initialized"
		logSupabaseAuth(authLog)
		return nil, authLog
	}

	raw := stripBearerToken(bearer)
	if raw == "" {
		authLog.FailureReason = "missing token"
		logSupabaseAuth(authLog)
		return nil, authLog
	}

	headerAlg, headerKid, headerErr := peekTokenHeader(raw)
	authLog.Algorithm = headerAlg
	authLog.Kid = headerKid
	if headerErr != nil {
		authLog.FailureReason = "malformed token header: " + headerErr.Error()
		logSupabaseAuth(authLog)
		return nil, authLog
	}

	if peekIss, _ := peekTokenIssuer(raw); peekIss != "" {
		authLog.Issuer = peekIss
	}

	if v.devUnverified {
		authLog.Method = "dev-unverified"
		claims, err := ParseSupabaseAccessTokenUnverified(raw)
		if err != nil {
			authLog.FailureReason = err.Error()
			logSupabaseAuth(authLog)
			return nil, authLog
		}
		authLog.SupabaseUserID = claims.Sub
		authLog.Email = claims.Email
		authLog.Success = true
		logSupabaseAuth(authLog)
		return claims, authLog
	}

	var (
		claims *SupabaseAccessClaims
		err    error
	)

	switch strings.ToUpper(headerAlg) {
	case "ES256", "RS256":
		if v.jwks == nil {
			authLog.FailureReason = fmt.Sprintf(
				"token uses %s but JWKS is unavailable — set SUPABASE_URL (do not use SUPABASE_SERVICE_ROLE_KEY for JWT verification)",
				headerAlg,
			)
			logSupabaseAuth(authLog)
			return nil, authLog
		}
		authLog.Method = "jwks-" + strings.ToLower(headerAlg)
		claims, err = v.validateWithJWKS(raw, headerAlg)
	case "HS256":
		if v.legacyHS256 == "" {
			authLog.FailureReason = "token uses HS256 but no legacy JWT secret is configured; set SUPABASE_URL for ES256 JWKS validation"
			logSupabaseAuth(authLog)
			return nil, authLog
		}
		authLog.Method = "legacy-hs256"
		claims, err = parseSupabaseHS256(raw, v.legacyHS256)
	default:
		authLog.FailureReason = fmt.Sprintf("unsupported signing algorithm %q", headerAlg)
		logSupabaseAuth(authLog)
		return nil, authLog
	}

	if err != nil {
		authLog.FailureReason = err.Error()
		logSupabaseAuth(authLog)
		return nil, authLog
	}

	authLog.Issuer = claims.Issuer
	if v.issuer != "" && !strings.EqualFold(strings.TrimSpace(claims.Issuer), v.issuer) {
		authLog.FailureReason = fmt.Sprintf("issuer mismatch: got %q expected %q", claims.Issuer, v.issuer)
		logSupabaseAuth(authLog)
		return nil, authLog
	}

	if strings.TrimSpace(claims.Sub) == "" {
		authLog.FailureReason = "missing sub claim"
		logSupabaseAuth(authLog)
		return nil, authLog
	}

	authLog.SupabaseUserID = claims.Sub
	authLog.Email = claims.Email
	authLog.Success = true
	logSupabaseAuth(authLog)
	return claims, authLog
}

func (v *SupabaseJWTValidator) validateWithJWKS(raw, alg string) (*SupabaseAccessClaims, error) {
	claims := &SupabaseAccessClaims{}
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{alg}),
		jwt.WithExpirationRequired(),
	)
	token, err := parser.ParseWithClaims(raw, claims, v.jwks.Keyfunc)
	if err != nil {
		return nil, fmt.Errorf("jwks validation failed: %w", err)
	}
	if !token.Valid {
		return nil, fmt.Errorf("jwks validation failed: token not valid")
	}
	return claims, nil
}

func parseSupabaseHS256(raw, secret string) (*SupabaseAccessClaims, error) {
	claims := &SupabaseAccessClaims{}
	token, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method %v", t.Header["alg"])
		}
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithExpirationRequired())
	if err != nil {
		return nil, fmt.Errorf("hs256 validation failed: %w", err)
	}
	if !token.Valid {
		return nil, fmt.Errorf("hs256 validation failed: token not valid")
	}
	if strings.TrimSpace(claims.Sub) == "" {
		return nil, fmt.Errorf("invalid token: missing sub")
	}
	return claims, nil
}

func stripBearerToken(bearer string) string {
	raw := strings.TrimSpace(bearer)
	if strings.HasPrefix(strings.ToLower(raw), "bearer ") {
		raw = strings.TrimSpace(raw[7:])
	}
	return raw
}

func peekTokenHeader(raw string) (alg, kid string, err error) {
	token, _, err := jwt.NewParser().ParseUnverified(raw, jwt.MapClaims{})
	if err != nil {
		return "", "", err
	}
	if token.Method != nil {
		alg = token.Method.Alg()
	}
	if v, ok := token.Header["kid"].(string); ok {
		kid = v
	}
	return alg, kid, nil
}

func peekTokenIssuer(raw string) (string, error) {
	token, _, err := jwt.NewParser().ParseUnverified(raw, &SupabaseAccessClaims{})
	if err != nil {
		return "", err
	}
	if claims, ok := token.Claims.(*SupabaseAccessClaims); ok {
		return claims.Issuer, nil
	}
	return "", nil
}

func isSupabaseSecretAPIKey(s string) bool {
	s = strings.TrimSpace(s)
	return strings.HasPrefix(s, "sb_secret_") || strings.HasPrefix(s, "sbp_")
}

func logSupabaseAuth(l SupabaseAuthLog) {
	if l.Success {
		log.Printf(
			"[SupabaseAuth] OK alg=%s iss=%s kid=%s sub=%s email=%s method=%s",
			l.Algorithm, l.Issuer, l.Kid, l.SupabaseUserID, l.Email, l.Method,
		)
		return
	}
	log.Printf(
		"[SupabaseAuth] FAIL alg=%s iss=%s kid=%s reason=%q method=%s",
		l.Algorithm, l.Issuer, l.Kid, l.FailureReason, l.Method,
	)
}
