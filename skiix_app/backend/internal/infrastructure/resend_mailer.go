package infrastructure

import (
	"fmt"
	"os"
	"strings"

	"github.com/resend/resend-go/v2"
)

type ResendMailer struct {
	client *resend.Client
	from   string
}

func NewResendMailer(apiKey, from string) *ResendMailer {
	from = strings.TrimSpace(from)
	if from == "" {
		from = "Skiix <onboarding@resend.dev>"
	}
	return &ResendMailer{
		client: resend.NewClient(strings.TrimSpace(apiKey)),
		from:   from,
	}
}

func NewResendMailerFromEnv() *ResendMailer {
	return NewResendMailer(
		os.Getenv("RESEND_API_KEY"),
		os.Getenv("RESEND_FROM"),
	)
}

func (m *ResendMailer) SendSignupOTP(toEmail, fullName, otp string) error {
	if m.client == nil || strings.TrimSpace(os.Getenv("RESEND_API_KEY")) == "" {
		return fmt.Errorf("RESEND_API_KEY is not configured")
	}
	_, err := m.client.Emails.Send(&resend.SendEmailRequest{
		From:    m.from,
		To:      []string{strings.TrimSpace(strings.ToLower(toEmail))},
		Subject: "Your Skiix verification code",
		Html:    buildOTPEmailHTML(fullName, otp),
	})
	return err
}

func buildOTPEmailHTML(fullName, otp string) string {
	name := strings.TrimSpace(fullName)
	if name == "" {
		name = "there"
	}
	html := strings.Builder{}
	html.WriteString(`<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0A0A0A;color:#fff;border-radius:16px;">`)
	html.WriteString(`<motion.div style="padding:32px;text-align:center;background:#0D2A35;">`)
	html.WriteString(`<p style="font-size:32px;font-weight:900;color:#00E5FF;margin:0;">S</p>`)
	html.WriteString(`<p style="font-size:20px;font-weight:800;margin:8px 0 0;">Skiix</p>`)
	html.WriteString(`</motion.div>`)
	html.WriteString(`<motion.div style="padding:32px;">`)
	html.WriteString(fmt.Sprintf(`<h2 style="margin:0 0 12px;">Hi %s, verify your account</h2>`, name))
	html.WriteString(`<p style="color:#888;">Enter this code in the Skiix app. Expires in 10 minutes.</p>`)
	html.WriteString(fmt.Sprintf(`<p style="font-size:32px;font-weight:800;letter-spacing:6px;color:#00E5FF;text-align:center;margin:24px 0;">%s</p>`, otp))
	html.WriteString(`<p style="color:#666;font-size:12px;">Never share this code.</p>`)
	html.WriteString(`</motion.div></motion.div>`)
	return strings.ReplaceAll(strings.ReplaceAll(html.String(), "<motion.div", "<div"), "</motion.div>", "</div>")
}
