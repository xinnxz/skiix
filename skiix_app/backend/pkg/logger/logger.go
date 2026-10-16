package logger

import (
	"log"
	"log/slog"
	"os"
	"strings"
)

// Init configures the global slog logger based on environment.
// Call this once at application startup before any other logging occurs.
//
// Environment Variables:
//   - APP_ENV: "production" → JSON output; anything else → human-readable text
//   - LOG_LEVEL: "DEBUG", "INFO" (default), "WARN", "ERROR"
func Init() *slog.Logger {
	env := os.Getenv("APP_ENV")
	levelStr := os.Getenv("LOG_LEVEL")

	var level slog.Level
	switch strings.ToUpper(levelStr) {
	case "DEBUG":
		level = slog.LevelDebug
	case "WARN":
		level = slog.LevelWarn
	case "ERROR":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	opts := &slog.HandlerOptions{
		Level:     level,
		AddSource: env != "production",
	}

	var handler slog.Handler
	if env == "production" {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		handler = slog.NewTextHandler(os.Stdout, opts)
	}

	logger := slog.New(handler)
	slog.SetDefault(logger)

	log.SetOutput(&slogWriter{logger: logger})
	log.SetFlags(0)

	return logger
}

type slogWriter struct {
	logger *slog.Logger
}

func (w *slogWriter) Write(p []byte) (n int, err error) {
	msg := strings.TrimSpace(string(p))
	w.logger.Info(msg, slog.String("source", "stdlib"))
	return len(p), nil
}
