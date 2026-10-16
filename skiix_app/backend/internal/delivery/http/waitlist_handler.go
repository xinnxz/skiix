package http

import (
	"net/http"
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/skiix-backend/internal/domain"
	"github.com/skiix-backend/internal/usecase"
)

type WaitlistHandler struct {
	uc *usecase.WaitlistUsecase
}

func NewWaitlistHandler(uc *usecase.WaitlistUsecase) *WaitlistHandler {
	return &WaitlistHandler{uc: uc}
}

type WaitlistSignupRequest struct {
	Email        string  `json:"email" binding:"required,email"`
	Name         *string `json:"name"`
	UTMSource    *string `json:"utm_source"`
	ConsentGiven bool    `json:"consent_given"`
}

type WaitlistSignupResponse struct {
	Message string `json:"message"`
	Email   string `json:"email"`
}

type WaitlistAdminResponse struct {
	Total int                    `json:"total"`
	Items []domain.WaitlistSignup `json:"items"`
}

// SignUp godoc
// @Summary      Join the waitlist
// @Description  Capture email for pre-launch marketing. Requires explicit consent.
// @Tags         waitlist
// @Accept       json
// @Produce      json
// @Param        request  body  WaitlistSignupRequest  true  "Signup payload"
// @Success      201  {object}  WaitlistSignupResponse
// @Failure      400  {object}  map[string]string
// @Failure      409  {object}  map[string]string
// @Router       /api/v1/waitlist [post]
func (h *WaitlistHandler) SignUp(c *gin.Context) {
	var req WaitlistSignupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	signup, err := h.uc.SignUp(usecase.WaitlistSignupInput{
		Email:        req.Email,
		Name:         req.Name,
		UTMSource:    req.UTMSource,
		ConsentGiven: req.ConsentGiven,
	})
	if err != nil {
		respondUsecaseError(c, err)
		return
	}

	c.JSON(http.StatusCreated, WaitlistSignupResponse{
		Message: "you're on the waitlist",
		Email:   signup.Email,
	})
}

// AdminList godoc
// @Summary      Export waitlist signups
// @Description  Admin-only export of waitlist emails
// @Tags         waitlist
// @Produce      json
// @Param        X-Admin-Key  header  string  true  "Admin API key"
// @Success      200  {object}  WaitlistAdminResponse
// @Failure      401  {object}  map[string]string
// @Router       /admin/waitlist [get]
func (h *WaitlistHandler) AdminList(c *gin.Context) {
	adminKey := os.Getenv("ADMIN_API_KEY")
	if adminKey == "" || c.GetHeader("X-Admin-Key") != adminKey {
		respondError(c, http.StatusUnauthorized, "unauthorized")
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	items, total, err := h.uc.ListSignups(limit, offset)
	if err != nil {
		respondUsecaseError(c, err)
		return
	}
	if items == nil {
		items = []domain.WaitlistSignup{}
	}

	c.JSON(http.StatusOK, WaitlistAdminResponse{Total: total, Items: items})
}
