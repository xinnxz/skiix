package http

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/skiix-backend/internal/infrastructure"
)

// OTPHandler sends signup verification codes via Resend (Supabase does not send email).
type OTPHandler struct {
	supabase *infrastructure.SupabaseAdmin
	resend   *infrastructure.ResendMailer
}

func NewOTPHandler() *OTPHandler {
	base := strings.TrimSpace(os.Getenv("SUPABASE_URL"))
	if base == "" {
		base = strings.TrimSpace(os.Getenv("EXPO_PUBLIC_SUPABASE_URL"))
	}
	return &OTPHandler{
		supabase: infrastructure.NewSupabaseAdmin(base, os.Getenv("SUPABASE_SERVICE_ROLE_KEY")),
		resend:   infrastructure.NewResendMailerFromEnv(),
	}
}

type sendOTPRequest struct {
	Email    string `json:"email" binding:"required,email"`
	FullName string `json:"full_name" binding:"required"`
	Username string `json:"username" binding:"required"`
	Password string `json:"password"`
	Resend   bool   `json:"resend"`
}

// SendOTP POST /api/v1/auth/send-otp
func (h *OTPHandler) SendOTP(c *gin.Context) {
	serviceKey := strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_ROLE_KEY"))
	if serviceKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server missing SUPABASE_SERVICE_ROLE_KEY"})
		return
	}
	h.supabase = infrastructure.NewSupabaseAdmin(
		strings.TrimSpace(os.Getenv("SUPABASE_URL")),
		serviceKey,
	)
	if strings.TrimSpace(os.Getenv("RESEND_API_KEY")) == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Server missing RESEND_API_KEY"})
		return
	}

	var req sendOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	fullName := strings.TrimSpace(req.FullName)
	username := strings.TrimSpace(strings.ToLower(req.Username))
	password := req.Password

	if !req.Resend {
		if len(password) < 8 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "password must be at least 8 characters"})
			return
		}
		if err := h.supabase.EnsureUser(email, password, fullName, username); err != nil {
			msg := err.Error()
			if strings.Contains(strings.ToLower(msg), "already") && strings.Contains(strings.ToLower(msg), "confirmed") {
				c.JSON(http.StatusConflict, gin.H{"error": "This email is already registered. Sign in instead."})
				return
			}
			// Unconfirmed duplicate — continue to generate OTP.
			if !strings.Contains(strings.ToLower(msg), "already") {
				c.JSON(http.StatusBadRequest, gin.H{"error": msg})
				return
			}
		}
	}

	linkType := "signup"
	if req.Resend {
		linkType = "magiclink"
		password = ""
	}

	otp, err := h.supabase.GenerateOTP(email, password, linkType)
	if err != nil {
		msg := err.Error()
		if strings.Contains(strings.ToLower(msg), "already") && strings.Contains(strings.ToLower(msg), "registered") {
			c.JSON(http.StatusConflict, gin.H{"error": "This email is already registered. Sign in instead."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate OTP: " + msg})
		return
	}

	if err := h.resend.SendSignupOTP(email, fullName, otp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send email: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"message": "OTP sent to " + email,
		},
	})
}
