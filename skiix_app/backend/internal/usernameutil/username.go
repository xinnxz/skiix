package usernameutil

import (
	"fmt"
	"math/rand"
	"regexp"
	"strings"
	"time"
)

var nonHandleChars = regexp.MustCompile(`[^a-z0-9_]`)

// LooksLikeEmail returns true when s appears to be an email address.
func LooksLikeEmail(s string) bool {
	s = strings.TrimSpace(strings.ToLower(s))
	return strings.Contains(s, "@") && strings.Contains(s, ".")
}

// SanitizeUsername normalizes a requested handle; never returns a full email.
func SanitizeUsername(requested, email, idSuffix string) string {
	u := strings.ToLower(strings.TrimSpace(requested))
	u = nonHandleChars.ReplaceAllString(u, "")
	if LooksLikeEmail(requested) || strings.EqualFold(u, strings.ToLower(strings.TrimSpace(email))) {
		u = ""
	}
	if len(u) >= 3 && len(u) <= 32 {
		return u
	}

	local := strings.ToLower(strings.TrimSpace(email))
	if i := strings.Index(local, "@"); i > 0 {
		local = local[:i]
	}
	local = nonHandleChars.ReplaceAllString(local, "")
	if len(local) > 15 {
		local = local[:15]
	}
	if local == "" {
		local = "user"
	}
	suffix := strings.TrimSpace(idSuffix)
	if len(suffix) > 4 {
		suffix = suffix[:4]
	}
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	return fmt.Sprintf("%s%d", local, rng.Intn(999))
}

// DisplayHandle returns a clean @handle for API responses (never a full email).
func DisplayHandle(storedUsername, email, userID string) string {
	u := strings.TrimSpace(storedUsername)
	if u != "" && !LooksLikeEmail(u) && len(u) <= 32 {
		return strings.ToLower(u)
	}
	idSuffix := userID
	if len(idSuffix) > 4 {
		idSuffix = idSuffix[:4]
	}
	return SanitizeUsername("", email, idSuffix)
}

// PublicFullName picks a human-readable name (not an email).
func PublicFullName(displayName, storedUsername, email string) string {
	dn := strings.TrimSpace(displayName)
	if dn != "" && !LooksLikeEmail(dn) {
		return dn
	}
	h := DisplayHandle(storedUsername, email, "")
	if h != "" {
		return h
	}
	return ""
}

// UsernameSQLExpr returns a SQL expression for a clean username column (table alias e.g. "u").
func UsernameSQLExpr(tableAlias string) string {
	t := tableAlias
	return fmt.Sprintf(`CASE
  WHEN COALESCE(NULLIF(TRIM(%[1]s.username), ''), '') = ''
    OR TRIM(%[1]s.username) LIKE '%%@%%'
    OR TRIM(%[1]s.username) ~* '\.(com|org|net|edu)$'
    OR LENGTH(TRIM(%[1]s.username)) > 30
  THEN CONCAT(
    REGEXP_REPLACE(LOWER(SPLIT_PART(COALESCE(%[1]s.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g'),
    SUBSTRING(%[1]s.id::text, 1, 4)
  )
  ELSE LOWER(TRIM(%[1]s.username))
END`, t)
}

// DisplayNameSQLExpr returns SQL for full_name / display label (table alias e.g. "u").
func DisplayNameSQLExpr(tableAlias string) string {
	t := tableAlias
	return fmt.Sprintf(`COALESCE(
  CASE
    WHEN NULLIF(TRIM(%[1]s.display_name), '') IS NOT NULL
      AND TRIM(%[1]s.display_name) NOT LIKE '%%@%%'
    THEN TRIM(%[1]s.display_name)
    ELSE NULL
  END,
  %s
)`, t, UsernameSQLExpr(t))
}
