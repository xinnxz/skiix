package http

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func respondError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"error": message})
}

func mapUsecaseError(err error) (int, string) {
	if err == nil {
		return http.StatusOK, ""
	}
	msg := err.Error()
	switch {
	case msg == "403 Forbidden" || strings.HasPrefix(msg, "forbidden:"):
		return http.StatusForbidden, msg
	case strings.Contains(msg, "not found"):
		return http.StatusNotFound, msg
	case strings.Contains(msg, "already on waitlist"):
		return http.StatusConflict, msg
	case strings.Contains(msg, "consent is required"),
		strings.Contains(msg, "hour must be between"),
		strings.Contains(msg, "invalid timezone"):
		return http.StatusBadRequest, msg
	case strings.Contains(msg, "requires Skiix Plus subscription"),
		strings.Contains(msg, "mood scheduling and history require"):
		return http.StatusForbidden, msg
	case strings.Contains(msg, "invalid mood"),
		strings.Contains(msg, "mood tag"),
		strings.Contains(msg, "at least one mood"),
		strings.Contains(msg, "too many mood"),
		strings.Contains(msg, "maximum mood schedules"),
		strings.Contains(msg, "start_time must be"),
		strings.Contains(msg, "end_time must be"),
		strings.Contains(msg, "timezone is required"),
		strings.Contains(msg, "invalid timezone"),
		strings.Contains(msg, "days_of_week"):
		return http.StatusBadRequest, msg
	default:
		if strings.Contains(msg, "invalid") || strings.Contains(msg, "is required") {
			return http.StatusBadRequest, msg
		}
		return http.StatusInternalServerError, msg
	}
}

func respondUsecaseError(c *gin.Context, err error) {
	status, msg := mapUsecaseError(err)
	respondError(c, status, msg)
}
