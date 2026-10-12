package departments

import (
	"encoding/json"
	"net/http"

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

func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler) {
	r.Route("/departments", func(r chi.Router) {
		r.Get("/", h.GetDepartments)
		r.Get("/{id}", h.GetDepartmentByID)

		// Protected Admin Routes
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware)
			r.Use(middleware.RequireRole("admin"))
			r.Post("/", h.CreateDepartment)
			r.Delete("/{id}", h.DeleteDepartment)
		})
	})
}

func (h *Handler) GetDepartments(w http.ResponseWriter, r *http.Request) {
	depts, err := h.service.GetDepartments(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, depts)
}

func (h *Handler) GetDepartmentByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	dept, err := h.service.GetDepartmentByID(r.Context(), id)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, dept)
}

func (h *Handler) CreateDepartment(w http.ResponseWriter, r *http.Request) {
	var req CreateDepartmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	dept, err := h.service.CreateDepartment(r.Context(), req)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, dept)
}

func (h *Handler) DeleteDepartment(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.service.DeleteDepartment(r.Context(), id); err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "Department deleted successfully"})
}
