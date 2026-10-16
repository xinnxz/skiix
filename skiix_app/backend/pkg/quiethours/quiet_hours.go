package quiethours

import (
	"fmt"
	"time"
)

// IsInQuietWindow reports whether local time falls inside [startHour, endHour).
// Supports overnight windows (e.g. 22→7). When startHour == endHour the window is empty.
func IsInQuietWindow(now time.Time, startHour, endHour int, timezone string) (bool, error) {
	if startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23 {
		return false, fmt.Errorf("hour must be between 0 and 23")
	}

	loc, err := time.LoadLocation(timezone)
	if err != nil {
		return false, fmt.Errorf("invalid timezone: %w", err)
	}

	hour := now.In(loc).Hour()
	if startHour == endHour {
		return false, nil
	}
	if startHour < endHour {
		return hour >= startHour && hour < endHour, nil
	}
	return hour >= startHour || hour < endHour, nil
}
