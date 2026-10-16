package infrastructure

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsSupabaseSecretAPIKey(t *testing.T) {
	assert.True(t, isSupabaseSecretAPIKey("sb_secret_abc"))
	assert.True(t, isSupabaseSecretAPIKey("sbp_abc"))
	assert.False(t, isSupabaseSecretAPIKey("super-secret-jwt-key"))
	assert.False(t, isSupabaseSecretAPIKey(""))
}

func TestNewSupabaseJWTValidator_RejectsServiceRoleAsJWTSecret(t *testing.T) {
	v, err := NewSupabaseJWTValidator("", "sb_secret_dummy_test_secret_for_unit_testing")
	assert.NoError(t, err)
	assert.NotNil(t, v)
	assert.Empty(t, v.legacyHS256)
	assert.True(t, v.devUnverified)
}

func TestStripBearerToken(t *testing.T) {
	assert.Equal(t, "tok", stripBearerToken("Bearer tok"))
	assert.Equal(t, "tok", stripBearerToken("bearer tok"))
	assert.Equal(t, "tok", stripBearerToken("tok"))
}
