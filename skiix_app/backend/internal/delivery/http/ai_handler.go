package http

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// AIHandler proxies writing assist requests to WaveSpeed (OpenAI-compatible chat API).
type AIHandler struct{}

func NewAIHandler() *AIHandler {
	return &AIHandler{}
}

type aiAssistRequest struct {
	Text   string `json:"text" binding:"required"`
	Action string `json:"action"`
}

func (h *AIHandler) AssistPost(c *gin.Context) {
	var req aiAssistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Text is required"})
		return
	}

	text := strings.TrimSpace(req.Text)
	if len(text) < 3 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please write at least a few words first"})
		return
	}

	action := strings.TrimSpace(strings.ToLower(req.Action))
	if action == "" {
		action = "improve"
	}

	systemPrompt, userPrompt := buildAIPrompts(action, text)
	if systemPrompt == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unknown action"})
		return
	}

	apiKey := strings.TrimSpace(os.Getenv("WAVESPEED_API_KEY"))
	if apiKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service not configured"})
		return
	}

	baseURL := strings.TrimSpace(os.Getenv("WAVESPEED_BASE_URL"))
	if baseURL == "" {
		baseURL = "https://llm.wavespeed.ai/v1"
	}
	baseURL = strings.TrimRight(baseURL, "/")

	model := strings.TrimSpace(os.Getenv("WAVESPEED_MODEL"))
	if model == "" {
		model = "bytedance-seed/seed-1.6-flash"
	}
	fallback := strings.TrimSpace(os.Getenv("WAVESPEED_FALLBACK_MODEL"))
	if fallback == "" {
		fallback = model
	}

	result, err := callWaveSpeedChat(baseURL, apiKey, model, systemPrompt, userPrompt)
	if err != nil && fallback != model {
		result, err = callWaveSpeedChat(baseURL, apiKey, fallback, systemPrompt, userPrompt)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": friendlyAIError(err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"result": result,
			"action": action,
		},
	})
}

func buildAIPrompts(action, text string) (systemPrompt, userPrompt string) {
	switch action {
	case "expand":
		systemPrompt = `You are a professional content writer for a startup social platform called Skiix.
Help users write engaging, concise posts about startups, tech, and entrepreneurship.
Write in first person, casual but professional tone. Max 300 words.
Return ONLY the improved post text, no explanations or quotes.`
		userPrompt = fmt.Sprintf(`Expand this post idea into a full engaging post for a startup community:

"%s"

Write it as a complete post. Be inspiring, authentic, and concise.`, text)
	case "improve":
		systemPrompt = `You are a professional content writer for Skiix, a startup social platform.
Improve the given text to be more engaging, clear, and compelling.
Keep the same meaning but make it better. Max 300 words.
Return ONLY the improved text, no explanations.`
		userPrompt = fmt.Sprintf(`Improve this post for a startup community audience:

"%s"

Make it more engaging and professional while keeping the author's voice.`, text)
	case "hashtags":
		systemPrompt = `You are a social media expert for a startup platform.
Generate relevant hashtags for startup and tech content.
Return ONLY hashtags separated by spaces, nothing else.
Maximum 8 hashtags. Start each with #.`
		userPrompt = fmt.Sprintf(`Generate relevant hashtags for this startup post:

"%s"`, text)
	case "shorten":
		systemPrompt = `You are a content editor. Shorten the given text while keeping the key message.
Target: under 150 characters. Return ONLY the shortened text, no explanations.`
		userPrompt = fmt.Sprintf(`Shorten this post to under 150 characters:

"%s"`, text)
	default:
		return "", ""
	}
	return systemPrompt, userPrompt
}

func callWaveSpeedChat(baseURL, apiKey, model, systemPrompt, userPrompt string) (string, error) {
	requestBody := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
		},
		"max_tokens":  500,
		"temperature": 0.7,
		"stream":      false,
	}

	bodyBytes, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	client := &http.Client{Timeout: 45 * time.Second}
	apiReq, err := http.NewRequest(http.MethodPost, baseURL+"/chat/completions", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", err
	}
	apiReq.Header.Set("Content-Type", "application/json")
	apiReq.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(apiReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("status %d: %s", resp.StatusCode, truncateForError(string(respBody), 200))
	}

	var apiResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return "", fmt.Errorf("parse response: %w", err)
	}
	if apiResp.Error != nil && apiResp.Error.Message != "" {
		return "", fmt.Errorf("%s", apiResp.Error.Message)
	}
	if len(apiResp.Choices) == 0 {
		return "", fmt.Errorf("no response from AI")
	}

	result := strings.TrimSpace(apiResp.Choices[0].Message.Content)
	result = strings.Trim(result, `"`)
	return strings.TrimSpace(result), nil
}

func friendlyAIError(err error) string {
	if err == nil {
		return "AI service unavailable. Try again."
	}
	msg := err.Error()
	if strings.Contains(msg, "timeout") || strings.Contains(msg, "deadline") {
		return "AI took too long. Try again."
	}
	if strings.Contains(msg, "status 401") || strings.Contains(msg, "status 403") {
		return "AI service authentication failed."
	}
	if len(msg) > 120 {
		return "AI service unavailable. Try again."
	}
	return msg
}

func truncateForError(s string, max int) string {
	s = strings.TrimSpace(s)
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}
