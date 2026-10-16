package infrastructure

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// SupabaseAdmin talks to GoTrue admin APIs (service role). No Supabase emails are sent.
type SupabaseAdmin struct {
	BaseURL     string
	ServiceKey  string
	HTTPClient  *http.Client
}

func NewSupabaseAdmin(baseURL, serviceKey string) *SupabaseAdmin {
	return &SupabaseAdmin{
		BaseURL:    strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		ServiceKey: strings.TrimSpace(serviceKey),
		HTTPClient: &http.Client{Timeout: 20 * time.Second},
	}
}

type supabaseErrorBody struct {
	Msg          string `json:"msg"`
	Message      string `json:"message"`
	Error        string `json:"error"`
	ErrorCode    string `json:"error_code"`
	Code         int    `json:"code"`
	ErrorMessage string `json:"error_description"`
}

func (e supabaseErrorBody) text() string {
	for _, s := range []string{e.Msg, e.Message, e.Error, e.ErrorMessage} {
		if strings.TrimSpace(s) != "" {
			return s
		}
	}
	return "supabase request failed"
}

type adminUserRequest struct {
	Email        string                 `json:"email"`
	Password     string                 `json:"password"`
	EmailConfirm bool                   `json:"email_confirm"`
	UserMetadata map[string]interface{} `json:"user_metadata"`
}

type generateLinkRequest struct {
	Type     string `json:"type"`
	Email    string `json:"email"`
	Password string `json:"password,omitempty"`
}

type generateLinkResponse struct {
	EmailOTP string `json:"email_otp"`
}

// EnsureUser creates an unconfirmed auth user (no Supabase email).
func (s *SupabaseAdmin) EnsureUser(email, password, fullName, username string) error {
	if s.BaseURL == "" || s.ServiceKey == "" {
		return fmt.Errorf("supabase admin not configured")
	}
	body, _ := json.Marshal(adminUserRequest{
		Email:        email,
		Password:     password,
		EmailConfirm: false,
		UserMetadata: map[string]interface{}{
			"full_name": fullName,
			"username":  username,
		},
	})
	req, err := http.NewRequest(http.MethodPost, s.BaseURL+"/auth/v1/admin/users", bytes.NewReader(body))
	if err != nil {
		return err
	}
	s.setAdminHeaders(req)
	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	var errBody supabaseErrorBody
	_ = json.Unmarshal(raw, &errBody)
	msg := strings.ToLower(errBody.text())
	// User already exists — OK for resend / retry OTP.
	if resp.StatusCode == 422 || strings.Contains(msg, "already") || strings.Contains(msg, "registered") {
		return nil
	}
	return fmt.Errorf("%s", errBody.text())
}

// GenerateOTP returns a 6-digit code without triggering Supabase email.
// linkType: signup (new user) or magiclink (resend for existing unconfirmed user).
func (s *SupabaseAdmin) GenerateOTP(email, password, linkType string) (string, error) {
	if s.BaseURL == "" || s.ServiceKey == "" {
		return "", fmt.Errorf("supabase admin not configured")
	}
	if linkType == "" {
		linkType = "signup"
	}
	body, _ := json.Marshal(generateLinkRequest{
		Type:     linkType,
		Email:    email,
		Password: password,
	})
	req, err := http.NewRequest(http.MethodPost, s.BaseURL+"/auth/v1/admin/generate_link", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	s.setAdminHeaders(req)
	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errBody supabaseErrorBody
		_ = json.Unmarshal(raw, &errBody)
		return "", fmt.Errorf("%s", errBody.text())
	}
	var out generateLinkResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", err
	}
	otp := strings.TrimSpace(out.EmailOTP)
	if otp == "" {
		return "", fmt.Errorf("supabase did not return email_otp")
	}
	return otp, nil
}

func (s *SupabaseAdmin) setAdminHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", s.ServiceKey)
	req.Header.Set("Authorization", "Bearer "+s.ServiceKey)
}
