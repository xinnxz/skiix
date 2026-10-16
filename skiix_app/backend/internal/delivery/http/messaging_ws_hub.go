package http

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var wsUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// MessagingHub broadcasts real-time chat events to connected clients.
type MessagingHub struct {
	mu      sync.RWMutex
	clients map[string]map[*websocket.Conn]struct{} // userID -> conns
}

var globalMessagingHub = &MessagingHub{clients: make(map[string]map[*websocket.Conn]struct{})}

func (h *MessagingHub) register(userID string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[userID] == nil {
		h.clients[userID] = make(map[*websocket.Conn]struct{})
	}
	h.clients[userID][conn] = struct{}{}
}

func (h *MessagingHub) unregister(userID string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if m := h.clients[userID]; m != nil {
		delete(m, conn)
		if len(m) == 0 {
			delete(h.clients, userID)
		}
	}
}

func (h *MessagingHub) sendToUser(userID string, payload map[string]interface{}) {
	h.mu.RLock()
	conns := h.clients[userID]
	h.mu.RUnlock()
	if len(conns) == 0 {
		return
	}
	raw, _ := json.Marshal(payload)
	for conn := range conns {
		_ = conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
		if err := conn.WriteMessage(websocket.TextMessage, raw); err != nil {
			log.Printf("[ws] write to %s: %v", userID, err)
		}
	}
}

func (h *MessagingHub) broadcastConversation(convID string, participantIDs []string, excludeUserID string, event string, data map[string]interface{}) {
	payload := map[string]interface{}{
		"event":           event,
		"conversation_id": convID,
		"data":            data,
		"ts":              time.Now().UTC().Format(time.RFC3339Nano),
	}
	for _, uid := range participantIDs {
		if uid == excludeUserID {
			continue
		}
		h.sendToUser(uid, payload)
	}
}

// BroadcastMessageSent notifies conversation participants of a new message.
func BroadcastMessageSent(convID, senderID string, participantIDs []string, msg map[string]interface{}) {
	globalMessagingHub.broadcastConversation(convID, participantIDs, senderID, "message_sent", msg)
	for _, uid := range participantIDs {
		if uid != senderID {
			globalMessagingHub.sendToUser(uid, map[string]interface{}{
				"event":           "message_received",
				"conversation_id": convID,
				"data":            msg,
			})
		}
	}
}

// BroadcastMessageRead notifies sender that messages were read.
func BroadcastMessageRead(convID, readerID string, participantIDs []string) {
	globalMessagingHub.broadcastConversation(convID, participantIDs, readerID, "message_read", map[string]interface{}{
		"reader_id": readerID,
		"read_at":   time.Now().UTC().Format(time.RFC3339Nano),
	})
}

// BroadcastTyping notifies peers of typing state.
func BroadcastTyping(convID, userID string, participantIDs []string, typing bool) {
	event := "typing_stop"
	if typing {
		event = "typing_start"
	}
	globalMessagingHub.broadcastConversation(convID, participantIDs, userID, event, map[string]interface{}{
		"user_id": userID,
	})
}

// MessagingWebSocket GET /api/v1/ws/messaging?token=...
func MessagingWebSocket(c *gin.Context) {
	userID := strings.TrimSpace(c.GetString(SupabaseUserIDContextKey))
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	conn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	globalMessagingHub.register(userID, conn)
	defer func() {
		globalMessagingHub.unregister(userID, conn)
		_ = conn.Close()
	}()

	_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}
