package http

import (
	"context"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
)

const (
	maxImageUploadBytes = 15 << 20  // 15MB
	maxVideoUploadBytes = 100 << 20 // 100MB
	maxUploadBytes      = maxVideoUploadBytes
)

type UploadHandler struct {
	cld *cloudinary.Cloudinary
}

func NewUploadHandler(cld *cloudinary.Cloudinary) *UploadHandler {
	return &UploadHandler{cld: cld}
}

// @Summary      Upload image/video to Cloudinary
// @Description  Upload a multipart file (image/video) to Cloudinary and returns secure URL
// @Tags         media
// @Accept       multipart/form-data
// @Produce      json
// @Security     Bearer
// @Param        file  formData  file  true  "media file (image/video)"
// @Success      200   {object}  map[string]interface{}
// @Failure      400   {object}  map[string]string
// @Failure      413   {object}  map[string]string
// @Failure      500   {object}  map[string]string
// @Router       /api/v1/upload [post]
func (h *UploadHandler) UploadMedia(c *gin.Context) {
	// Enforce size limit at HTTP layer (prevents large uploads from consuming memory).
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadBytes)

	fh, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing file field"})
		return
	}
	if fh.Size <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "empty file"})
		return
	}
	ext := strings.ToLower(filepath.Ext(fh.Filename))
	videoExt := map[string]bool{".mp4": true, ".mov": true, ".m4v": true, ".webm": true}
	maxAllowed := maxImageUploadBytes
	if videoExt[ext] {
		maxAllowed = maxVideoUploadBytes
	}
	if fh.Size > int64(maxAllowed) {
		limitMB := maxAllowed >> 20
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": fmt.Sprintf("file too large (max %dMB)", limitMB)})
		return
	}

	// Basic allow-list. Cloudinary also validates; fast fail for unknown types.
	imgVideo := map[string]bool{
		".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true,
		".mp4": true, ".mov": true, ".m4v": true, ".webm": true,
	}
	rawDoc := map[string]bool{
		".pdf": true, ".doc": true, ".docx": true, ".txt": true, ".csv": true,
		".zip": true, ".heic": true,
	}
	resourceType := "auto"
	uploadFolder := "skiix"
	if rawDoc[ext] {
		resourceType = "raw"
		uploadFolder = "skiix/files"
	} else if !imgVideo[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid file type"})
		return
	}

	f, err := fh.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not open uploaded file"})
		return
	}
	defer f.Close()

	uploadTimeout := 30 * time.Second
	if videoExt[ext] {
		uploadTimeout = 3 * time.Minute
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), uploadTimeout)
	defer cancel()

	up := uploader.UploadParams{
		ResourceType: resourceType,
		Folder:       uploadFolder,
	}
	if resourceType != "raw" {
		up.Transformation = "f_auto,q_auto"
	}
	res, err := h.cld.Upload.Upload(ctx, f, up)
	if err != nil {
		msg := err.Error()
		// If MaxBytesReader triggered
		if strings.Contains(strings.ToLower(msg), "request body too large") {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "file too large"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cloudinary upload failed: " + msg})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url":           res.SecureURL,
		"secure_url":    res.SecureURL,
		"resource_type": res.ResourceType,
		"public_id":     res.PublicID,
		"bytes":         res.Bytes,
		"data": gin.H{
			"secure_url":    res.SecureURL,
			"url":           res.SecureURL,
			"resource_type": res.ResourceType,
			"public_id":     res.PublicID,
			"bytes":         res.Bytes,
		},
	})
}
