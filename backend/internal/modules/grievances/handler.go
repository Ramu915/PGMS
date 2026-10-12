package grievances

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"backend/internal/middleware"
	"backend/pkg/response"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler, optionalAuthMiddleware ...func(http.Handler) http.Handler) {
	r.Route("/grievances", func(sub chi.Router) {
		if len(optionalAuthMiddleware) > 0 && optionalAuthMiddleware[0] != nil {
			sub.Use(optionalAuthMiddleware[0])
		}
		// Public & Authenticated Listing / Reading
		sub.Get("/", h.ListGrievances)
		sub.Get("/nearby", h.GetNearbyGrievances)
		sub.Get("/{id}", h.GetGrievanceByID)
		sub.Get("/{id}/updates", h.GetGrievanceUpdates)
		sub.Get("/{id}/comments", h.GetComments)
		sub.Get("/{id}/remarks", h.GetComments)

		// Authenticated Routes
		sub.Group(func(protected chi.Router) {
			protected.Use(authMiddleware)
			protected.Post("/", h.CreateGrievance)
			protected.Post("/{id}/upvote", h.UpvoteGrievance)
			protected.Post("/{id}/updates", h.UpdateGrievanceStatus)
			protected.Put("/{id}", h.UpdateGrievanceStatus)
			protected.Post("/{id}/assign", h.AssignOfficer)
			protected.Post("/{id}/comments", h.AddComment)
			protected.Post("/{id}/remarks", h.AddComment)
		})
	})
}

func (h *Handler) CreateGrievance(w http.ResponseWriter, r *http.Request) {
	userIDVal := r.Context().Value(middleware.UserIDKey)
	if userIDVal == nil {
		response.Error(w, http.StatusUnauthorized, "Unauthorized. Please log in to file a grievance.")
		return
	}
	citizenID, _ := userIDVal.(string)

	var req CreateGrievanceRequest
	var imagePaths []string

	contentType := r.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := r.ParseMultipartForm(20 << 20); err != nil {
			response.Error(w, http.StatusBadRequest, "Failed to parse multipart form upload")
			return
		}

		req.Title = r.FormValue("title")
		req.Description = r.FormValue("description")
		req.Category = r.FormValue("category")
		req.DepartmentID = r.FormValue("departmentId")
		req.DistrictID = r.FormValue("districtId")
		req.TalukID = r.FormValue("talukId")
		req.Address = r.FormValue("address")
		req.Landmark = r.FormValue("landmark")

		if latStr := r.FormValue("latitude"); latStr != "" {
			if latVal, err := strconv.ParseFloat(latStr, 64); err == nil {
				req.Latitude = &latVal
			}
		}
		if lngStr := r.FormValue("longitude"); lngStr != "" {
			if lngVal, err := strconv.ParseFloat(lngStr, 64); err == nil {
				req.Longitude = &lngVal
			}
		}

		if r.MultipartForm != nil && r.MultipartForm.File != nil {
			files := r.MultipartForm.File["images"]
			if len(files) == 0 {
				files = r.MultipartForm.File["image"]
			}
			if len(files) == 0 {
				files = r.MultipartForm.File["file"]
			}

			_ = os.MkdirAll("./uploads", 0755)

			for _, fileHeader := range files {
				file, err := fileHeader.Open()
				if err != nil {
					continue
				}

				ext := filepath.Ext(fileHeader.Filename)
				if ext == "" {
					ext = ".jpg"
				}
				newFilename := fmt.Sprintf("g_%d_%s", time.Now().UnixNano(), filepath.Base(fileHeader.Filename))
				dstPath := filepath.Join("./uploads", newFilename)

				dst, err := os.Create(dstPath)
				if err != nil {
					file.Close()
					continue
				}

				_, _ = io.Copy(dst, file)
				file.Close()
				dst.Close()

				imagePaths = append(imagePaths, newFilename)
			}
		}
	} else {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			response.Error(w, http.StatusBadRequest, "Invalid JSON request payload")
			return
		}
	}

	res, err := h.service.CreateGrievance(r.Context(), req, citizenID, imagePaths)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, res)
}

func (h *Handler) GetGrievanceByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userRoleStr := "citizen"
	if roleVal := r.Context().Value(middleware.UserRoleKey); roleVal != nil {
		userRoleStr, _ = roleVal.(string)
	}

	res, err := h.service.GetGrievanceByID(r.Context(), id, userRoleStr)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, res)
}

func (h *Handler) ListGrievances(w http.ResponseWriter, r *http.Request) {
	params := FilterParams{
		Category:     r.URL.Query().Get("category"),
		Status:       r.URL.Query().Get("status"),
		Search:       r.URL.Query().Get("q"),
		Sort:         r.URL.Query().Get("sort"),
		MineOnly:     r.URL.Query().Get("mine") == "true" || r.URL.Query().Get("my") == "true",
		DepartmentID: r.URL.Query().Get("departmentId"),
		DistrictID:   r.URL.Query().Get("districtId"),
		TalukID:      r.URL.Query().Get("talukId"),
	}

	if params.Search == "" {
		params.Search = r.URL.Query().Get("search")
	}

	var userIDStr, userRoleStr, deptIDStr string
	if userIDVal := r.Context().Value(middleware.UserIDKey); userIDVal != nil {
		userIDStr, _ = userIDVal.(string)
	}
	if userRoleVal := r.Context().Value(middleware.UserRoleKey); userRoleVal != nil {
		userRoleStr, _ = userRoleVal.(string)
	}
	if deptIDVal := r.Context().Value(middleware.DepartmentIDKey); deptIDVal != nil {
		deptIDStr, _ = deptIDVal.(string)
	}

	list, err := h.service.ListGrievances(r.Context(), params, userIDStr, userRoleStr, deptIDStr)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, list)
}

func (h *Handler) UpdateGrievanceStatus(w http.ResponseWriter, r *http.Request) {
	userIDVal := r.Context().Value(middleware.UserIDKey)
	if userIDVal == nil {
		response.Error(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	authorID, _ := userIDVal.(string)

	authorRole := "citizen"
	if roleVal := r.Context().Value(middleware.UserRoleKey); roleVal != nil {
		authorRole, _ = roleVal.(string)
	}

	id := chi.URLParam(r, "id")

	var req CreateUpdateRequest
	var imagePaths []string

	contentType := strings.ToLower(r.Header.Get("Content-Type"))
	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := r.ParseMultipartForm(10 << 20); err != nil && err != http.ErrNotMultipart {
			response.Error(w, http.StatusBadRequest, fmt.Sprintf("Failed to parse multipart form payload: %v", err))
			return
		}

		req.Status = strings.TrimSpace(r.FormValue("status"))
		req.Note = strings.TrimSpace(r.FormValue("note"))

		if r.MultipartForm != nil && r.MultipartForm.File != nil {
			files := r.MultipartForm.File["image"]
			if len(files) == 0 {
				files = r.MultipartForm.File["images"]
			}
			if len(files) == 0 {
				files = r.MultipartForm.File["file"]
			}

			_ = os.MkdirAll("./uploads", 0755)

			for _, fileHeader := range files {
				file, err := fileHeader.Open()
				if err != nil {
					continue
				}

				ext := filepath.Ext(fileHeader.Filename)
				if ext == "" {
					ext = ".jpg"
				}
				newFilename := fmt.Sprintf("proof_%d_%s", time.Now().UnixNano(), filepath.Base(fileHeader.Filename))
				dstPath := filepath.Join("./uploads", newFilename)

				dst, err := os.Create(dstPath)
				if err != nil {
					file.Close()
					continue
				}

				_, _ = io.Copy(dst, file)
				file.Close()
				dst.Close()

				imagePaths = append(imagePaths, newFilename)
			}
		}
		req.Images = imagePaths
	} else {
		bodyBytes, _ := io.ReadAll(r.Body)
		if len(bodyBytes) > 0 {
			if err := json.Unmarshal(bodyBytes, &req); err != nil {
				req.Status = strings.TrimSpace(r.FormValue("status"))
				req.Note = strings.TrimSpace(r.FormValue("note"))
				if req.Status == "" {
					response.Error(w, http.StatusBadRequest, "Invalid request payload format")
					return
				}
			}
		} else {
			req.Status = strings.TrimSpace(r.FormValue("status"))
			req.Note = strings.TrimSpace(r.FormValue("note"))
		}
	}

	if req.Status == "" {
		req.Status = strings.TrimSpace(r.FormValue("status"))
	}
	if req.Note == "" {
		req.Note = strings.TrimSpace(r.FormValue("note"))
	}

	res, err := h.service.UpdateGrievanceStatus(r.Context(), id, req, authorID, authorRole)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, res)
}

func (h *Handler) GetGrievanceUpdates(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	updates, err := h.service.GetGrievanceUpdates(r.Context(), id)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, updates)
}

func (h *Handler) AssignOfficer(w http.ResponseWriter, r *http.Request) {
	userIDVal := r.Context().Value(middleware.UserIDKey)
	if userIDVal == nil {
		response.Error(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	assignerID, _ := userIDVal.(string)

	assignerRole := "citizen"
	if roleVal := r.Context().Value(middleware.UserRoleKey); roleVal != nil {
		assignerRole, _ = roleVal.(string)
	}

	id := chi.URLParam(r, "id")

	var req AssignGrievanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	if err := h.service.AssignOfficer(r.Context(), id, req, assignerID, assignerRole); err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "Grievance successfully assigned to officer."})
}

func (h *Handler) AddComment(w http.ResponseWriter, r *http.Request) {
	userIDVal := r.Context().Value(middleware.UserIDKey)
	if userIDVal == nil {
		response.Error(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	userID, _ := userIDVal.(string)

	userRole := "citizen"
	if roleVal := r.Context().Value(middleware.UserRoleKey); roleVal != nil {
		userRole, _ = roleVal.(string)
	}

	id := chi.URLParam(r, "id")

	var req CreateCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	comment, err := h.service.AddComment(r.Context(), id, req, userID, userRole)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, comment)
}

func (h *Handler) GetComments(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userRoleStr := "citizen"
	if roleVal := r.Context().Value(middleware.UserRoleKey); roleVal != nil {
		userRoleStr, _ = roleVal.(string)
	}

	comments, err := h.service.GetComments(r.Context(), id, userRoleStr)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, comments)
}

func (h *Handler) GetNearbyGrievances(w http.ResponseWriter, r *http.Request) {
	latStr := r.URL.Query().Get("lat")
	lngStr := r.URL.Query().Get("lng")

	lat, err1 := strconv.ParseFloat(latStr, 64)
	lng, err2 := strconv.ParseFloat(lngStr, 64)

	if err1 != nil || err2 != nil {
		response.JSON(w, http.StatusOK, []interface{}{})
		return
	}

	items, err := h.service.GetNearbyGrievances(r.Context(), lat, lng)
	if err != nil {
		response.JSON(w, http.StatusOK, []interface{}{})
		return
	}

	response.JSON(w, http.StatusOK, items)
}

func (h *Handler) UpvoteGrievance(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	newCount, err := h.service.UpvoteGrievance(r.Context(), id)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{"upvotes": newCount, "message": "Grievance upvoted successfully"})
}
