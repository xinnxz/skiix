package logger_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"os"
	"strings"
	"testing"

	"github.com/skiix-backend/pkg/logger"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func captureOutput(fn func()) string {
	old := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	fn()

	w.Close()
	os.Stdout = old

	var buf bytes.Buffer
	buf.ReadFrom(r)
	return buf.String()
}

func TestInit_JSONHandler_InProduction(t *testing.T) {
	os.Setenv("APP_ENV", "production")
	os.Setenv("LOG_LEVEL", "INFO")
	defer func() {
		os.Unsetenv("APP_ENV")
		os.Unsetenv("LOG_LEVEL")
	}()

	output := captureOutput(func() {
		l := logger.Init()
		l.Info("test message", slog.String("key", "value"))
	})

	var entry map[string]interface{}
	require.NoError(t, json.Unmarshal([]byte(strings.TrimSpace(output)), &entry),
		"production log output must be valid JSON")

	assert.Equal(t, "INFO", entry["level"])
	assert.Equal(t, "test message", entry["msg"])
	assert.Equal(t, "value", entry["key"])
}

func TestInit_TextHandler_InDevelopment(t *testing.T) {
	os.Setenv("APP_ENV", "development")
	defer os.Unsetenv("APP_ENV")

	output := captureOutput(func() {
		l := logger.Init()
		l.Info("hello development")
	})

	assert.Contains(t, output, "hello development")
	assert.NotContains(t, output, "{")
}

func TestInit_LogLevelFiltering(t *testing.T) {
	os.Setenv("APP_ENV", "production")
	os.Setenv("LOG_LEVEL", "WARN")
	defer func() {
		os.Unsetenv("APP_ENV")
		os.Unsetenv("LOG_LEVEL")
	}()

	output := captureOutput(func() {
		l := logger.Init()
		l.Debug("this is debug")
		l.Info("this is info")
		l.Warn("this is a warning")
	})

	assert.NotContains(t, output, "this is debug")
	assert.NotContains(t, output, "this is info")
	assert.Contains(t, output, "this is a warning")
}
