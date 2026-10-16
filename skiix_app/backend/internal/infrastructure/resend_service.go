package infrastructure

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// ResendAudienceSyncer syncs contacts to a Resend audience.
type ResendAudienceSyncer struct {
	apiKey     string
	audienceID string
	client     *http.Client
}

func NewResendAudienceSyncer(apiKey, audienceID string) *ResendAudienceSyncer {
	return &ResendAudienceSyncer{
		apiKey:     apiKey,
		audienceID: audienceID,
		client:     &http.Client{Timeout: 10 * time.Second},
	}
}

func (r *ResendAudienceSyncer) AddContact(email string, name *string) error {
	if r.apiKey == "" || r.audienceID == "" {
		return nil
	}

	body := map[string]any{
		"email": email,
	}
	if name != nil && *name != "" {
		body["first_name"] = *name
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("https://api.resend.com/audiences/%s/contacts", r.audienceID)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+r.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := r.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	return fmt.Errorf("resend API returned %d: %s", resp.StatusCode, string(respBody))
}

// NoopAudienceSyncer skips external audience sync.
type NoopAudienceSyncer struct{}

func (NoopAudienceSyncer) AddContact(string, *string) error { return nil }
