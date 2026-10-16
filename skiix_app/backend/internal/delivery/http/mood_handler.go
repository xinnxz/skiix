package http

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/skiix-backend/internal/domain"
	"github.com/skiix-backend/internal/usecase"
)

type moodListResponse struct {
	Moods  []domain.MoodOption `json:"moods"`
	IsPlus bool                `json:"is_plus"`
}

type logMoodSessionRequest struct {
	Mood string `json:"mood" binding:"required"`
}

type moodScheduleRequest struct {
	Mood       string `json:"mood" binding:"required"`
	StartTime  string `json:"start_time" binding:"required"`
	EndTime    string `json:"end_time"`
	DaysOfWeek []int  `json:"days_of_week"`
	Timezone   string `json:"timezone" binding:"required"`
	Enabled    bool   `json:"enabled"`
}

// MoodHandler exposes Mood Feed catalog and Plus features.
type MoodHandler struct {
	moodUsecase usecase.MoodUsecase
}

// NewMoodHandler creates a MoodHandler.
func NewMoodHandler(moodUsecase usecase.MoodUsecase) *MoodHandler {
	return &MoodHandler{moodUsecase: moodUsecase}
}

// GetMoodOptions returns base (free) and expanded (Plus) mood catalog.
func (h *MoodHandler) GetMoodOptions(c *gin.Context) {
	userID := getUserIDFromContext(c)
	moods, isPlus, err := h.moodUsecase.ListOptions(userID)
	if err != nil {
		respondUsecaseError(c, err)
		return
	}
	c.JSON(http.StatusOK, moodListResponse{Moods: moods, IsPlus: isPlus})
}

func (h *MoodHandler) LogMoodSession(c *gin.Context) {
	userID, ok := requireUserID(c)
	if !ok {
		return
	}
	var req logMoodSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid request body")
		return
	}
	session, err := h.moodUsecase.LogSession(userID, req.Mood)
	if err != nil {
		respondUsecaseError(c, err)
		return
	}
	c.JSON(http.StatusCreated, session)
}

func (h *MoodHandler) GetMoodSessions(c *gin.Context) {
	userID, ok := requireUserID(c)
	if !ok {
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	sessions, err := h.moodUsecase.GetSessions(userID, limit)
	if err != nil {
		respondUsecaseError(c, err)
		return
	}
	if sessions == nil {
		sessions = []domain.MoodSession{}
	}
	c.JSON(http.StatusOK, sessions)
}

func (h *MoodHandler) ListMoodSchedules(c *gin.Context) {
	userID, ok := requireUserID(c)
	if !ok {
		return
	}
	schedules, err := h.moodUsecase.ListSchedules(userID)
	if err != nil {
		respondUsecaseError(c, err)
		return
	}
	if schedules == nil {
		schedules = []domain.MoodSchedule{}
	}
	c.JSON(http.StatusOK, schedules)
}

func (h *MoodHandler) CreateMoodSchedule(c *gin.Context) {
	userID, ok := requireUserID(c)
	if !ok {
		return
	}
	var req moodScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid request body")
		return
	}
	schedule, err := h.moodUsecase.CreateSchedule(userID, toScheduleInput(req))
	if err != nil {
		respondUsecaseError(c, err)
		return
	}
	c.JSON(http.StatusCreated, schedule)
}

func (h *MoodHandler) UpdateMoodSchedule(c *gin.Context) {
	userID, ok := requireUserID(c)
	if !ok {
		return
	}
	var req moodScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "invalid request body")
		return
	}
	schedule, err := h.moodUsecase.UpdateSchedule(userID, c.Param("id"), toScheduleInput(req))
	if err != nil {
		respondUsecaseError(c, err)
		return
	}
	c.JSON(http.StatusOK, schedule)
}

func (h *MoodHandler) DeleteMoodSchedule(c *gin.Context) {
	userID, ok := requireUserID(c)
	if !ok {
		return
	}
	if err := h.moodUsecase.DeleteSchedule(userID, c.Param("id")); err != nil {
		respondUsecaseError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func requireUserID(c *gin.Context) (string, bool) {
	userID := getUserIDFromContext(c)
	if userID == "" {
		respondError(c, http.StatusUnauthorized, "unauthorized")
		return "", false
	}
	return userID, true
}

func toScheduleInput(req moodScheduleRequest) domain.MoodScheduleInput {
	return domain.MoodScheduleInput{
		Mood:       req.Mood,
		StartTime:  req.StartTime,
		EndTime:    req.EndTime,
		DaysOfWeek: req.DaysOfWeek,
		Timezone:   req.Timezone,
		Enabled:    req.Enabled,
	}
}
