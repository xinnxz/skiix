package quiethours

import (
	"testing"
	"time"
)

func TestIsInQuietWindow_Overnight(t *testing.T) {
	jakarta, _ := time.LoadLocation("Asia/Jakarta")
	now := time.Date(2026, 6, 5, 23, 0, 0, 0, jakarta)

	inQuiet, err := IsInQuietWindow(now, 22, 7, "Asia/Jakarta")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !inQuiet {
		t.Fatal("expected quiet at 23:00 for 22-7 window")
	}
}

func TestIsInQuietWindow_DaytimeOutside(t *testing.T) {
	jakarta, _ := time.LoadLocation("Asia/Jakarta")
	now := time.Date(2026, 6, 5, 12, 0, 0, 0, jakarta)

	inQuiet, err := IsInQuietWindow(now, 22, 7, "Asia/Jakarta")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if inQuiet {
		t.Fatal("expected not quiet at noon for 22-7 window")
	}
}

func TestIsInQuietWindow_SameDayWindow(t *testing.T) {
	utc := time.Date(2026, 6, 5, 10, 0, 0, 0, time.UTC)
	inQuiet, err := IsInQuietWindow(utc, 9, 17, "UTC")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !inQuiet {
		t.Fatal("expected quiet at 10:00 for 9-17 window")
	}
}

func TestIsInQuietWindow_InvalidTimezone(t *testing.T) {
	_, err := IsInQuietWindow(time.Now(), 22, 7, "Not/AZone")
	if err == nil {
		t.Fatal("expected timezone error")
	}
}
