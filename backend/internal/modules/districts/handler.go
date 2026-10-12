package districts

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
	r.Route("/districts", func(sub chi.Router) {
		sub.Get("/", h.GetDistricts)
		sub.Get("/{id}/taluks", h.GetTaluksByDistrict)
	})

	r.Route("/admin", func(sub chi.Router) {
		sub.Group(func(protected chi.Router) {
			protected.Use(authMiddleware)
			protected.Post("/officers", h.ProvisionOfficer)
		})
	})
}

func (h *Handler) GetDistricts(w http.ResponseWriter, r *http.Request) {
	districts, err := h.service.GetDistricts(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, districts)
}

func (h *Handler) GetTaluksByDistrict(w http.ResponseWriter, r *http.Request) {
	districtID := chi.URLParam(r, "id")
	taluks, err := h.service.GetTaluksByDistrict(r.Context(), districtID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, taluks)
}

func (h *Handler) ProvisionOfficer(w http.ResponseWriter, r *http.Request) {
	adminRole := "citizen"
	if roleVal := r.Context().Value(middleware.UserRoleKey); roleVal != nil {
		adminRole, _ = roleVal.(string)
	}

	var req ProvisionOfficerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	res, err := h.service.ProvisionOfficer(r.Context(), req, adminRole)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, res)
}
