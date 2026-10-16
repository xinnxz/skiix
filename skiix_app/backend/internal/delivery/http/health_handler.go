package http

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
)

// HealthHandler exposes liveness/readiness probes for orchestrators.
type HealthHandler struct {
	db *sql.DB
}

// NewHealthHandler creates a health handler. db may be nil (skips DB check).
func NewHealthHandler(db *sql.DB) *HealthHandler {
	return &HealthHandler{db: db}
}

type healthResponse struct {
	Status string `json:"status"`
	DB     string `json:"db,omitempty"`
}

// Check godoc
// @Summary      Health check
// @Description  Returns service health. Includes database ping when configured.
// @Tags         system
// @Produce      json
// @Success      200  {object}  healthResponse
// @Failure      503  {object}  healthResponse
// @Router       /health [get]
func (h *HealthHandler) Check(c *gin.Context) {
	resp := healthResponse{Status: "ok"}

	if h.db != nil {
		if err := h.db.PingContext(c.Request.Context()); err != nil {
			c.JSON(http.StatusServiceUnavailable, healthResponse{
				Status: "degraded",
				DB:     "unreachable",
			})
			return
		}
		resp.DB = "ok"
	}

	c.JSON(http.StatusOK, resp)
}
