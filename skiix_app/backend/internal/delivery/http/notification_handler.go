package http

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/skiix-backend/internal/domain"
)

type NotificationHandler struct {
	notifUsecase domain.NotificationUsecase
}

func NewNotificationHandler(uc domain.NotificationUsecase) *NotificationHandler {
	return &NotificationHandler{notifUsecase: uc}
}

// GetNotifications returns a paginated list of notifications.
func (h *NotificationHandler) GetNotifications(c *gin.Context) {
	userID := getUserIDFromContext(c)
	if userID == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	limit := 30
	if l := c.Query("limit"); l != "" {
		if v, _ := strconv.Atoi(l); v > 0 {
			limit = v
		}
	}
	offset := 0
	if o := c.Query("offset"); o != "" {
		if v, _ := strconv.Atoi(o); v >= 0 {
			offset = v
		}
	}

	notifs, err := h.notifUsecase.GetNotifications(userID, limit, offset)
	if err != nil {
		respondUsecaseError(c, err)
		return
	}
	if notifs == nil {
		notifs = []domain.NotificationDTO{}
	}
	c.JSON(http.StatusOK, gin.H{"items": notifs, "next_cursor": nil})
}

// MarkAllAsRead marks all user notifications as read.
func (h *NotificationHandler) MarkAllAsRead(c *gin.Context) {
	userID := getUserIDFromContext(c)
	if userID == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	if err := h.notifUsecase.MarkAllAsRead(userID); err != nil {
		respondUsecaseError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success"})
}

// MarkAsRead marks a specific notification as read.
func (h *NotificationHandler) MarkAsRead(c *gin.Context) {
	userID := getUserIDFromContext(c)
	if userID == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	if err := h.notifUsecase.MarkAsRead(c.Param("id"), userID); err != nil {
		respondUsecaseError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success"})
}

// GetUnreadCount gets the count of unread notifications.
func (h *NotificationHandler) GetUnreadCount(c *gin.Context) {
	userID := getUserIDFromContext(c)
	if userID == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	count, err := h.notifUsecase.GetUnreadCount(userID)
	if err != nil {
		respondUsecaseError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}
