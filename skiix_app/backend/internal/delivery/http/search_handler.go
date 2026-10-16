package http

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/skiix-backend/internal/domain"
)

type SearchHandler struct {
	searchUsecase domain.SearchUsecase
}

func NewSearchHandler(uc domain.SearchUsecase) *SearchHandler {
	return &SearchHandler{searchUsecase: uc}
}

// Search performs a general search across users and posts.
func (h *SearchHandler) Search(c *gin.Context) {
	query := c.Query("query")
	searchType := c.Query("type")

	limit := 30
	if l := c.Query("limit"); l != "" {
		if v, _ := strconv.Atoi(l); v > 0 {
			limit = v
		}
	}

	res, err := h.searchUsecase.Search(query, searchType, limit)
	if err != nil {
		respondUsecaseError(c, err)
		return
	}
	c.JSON(http.StatusOK, res)
}

// TrendingHashtags fetches current trending hashtags.
func (h *SearchHandler) TrendingHashtags(c *gin.Context) {
	hashtags, err := h.searchUsecase.GetTrendingHashtags(10)
	if err != nil {
		respondUsecaseError(c, err)
		return
	}
	if hashtags == nil {
		hashtags = []domain.HashtagTrendDTO{}
	}
	c.JSON(http.StatusOK, gin.H{"items": hashtags, "next_cursor": nil})
}

// TrendingPosts fetches popular posts.
func (h *SearchHandler) TrendingPosts(c *gin.Context) {
	posts, err := h.searchUsecase.GetTrendingPosts(10)
	if err != nil {
		respondUsecaseError(c, err)
		return
	}
	if posts == nil {
		posts = []domain.Post{}
	}
	c.JSON(http.StatusOK, gin.H{"items": posts, "next_cursor": nil})
}
