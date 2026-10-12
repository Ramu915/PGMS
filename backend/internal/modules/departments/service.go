package departments

import (
	"context"
	"database/sql"
	"errors"
	"strings"
)

type Service interface {
	GetDepartments(ctx context.Context) ([]DepartmentDTO, error)
	GetDepartmentByID(ctx context.Context, id string) (*DepartmentDTO, error)
	CreateDepartment(ctx context.Context, req CreateDepartmentRequest) (*DepartmentDTO, error)
	DeleteDepartment(ctx context.Context, id string) error
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) GetDepartments(ctx context.Context) ([]DepartmentDTO, error) {
	records, err := s.repo.GetAll(ctx)
	if err != nil {
		return nil, err
	}

	var dtos []DepartmentDTO
	for _, r := range records {
		dtos = append(dtos, mapToDTO(r))
	}
	return dtos, nil
}

func (s *service) GetDepartmentByID(ctx context.Context, id string) (*DepartmentDTO, error) {
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("department ID is required")
	}

	rec, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	dto := mapToDTO(rec)
	return &dto, nil
}

func (s *service) CreateDepartment(ctx context.Context, req CreateDepartmentRequest) (*DepartmentDTO, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, errors.New("department name is required")
	}

	rec := &DepartmentRecord{
		Name:        name,
		Code:        sql.NullString{String: strings.TrimSpace(req.Code), Valid: req.Code != ""},
		Description: sql.NullString{String: strings.TrimSpace(req.Description), Valid: req.Description != ""},
	}

	if err := s.repo.Create(ctx, rec); err != nil {
		return nil, err
	}

	dto := mapToDTO(rec)
	return &dto, nil
}

func (s *service) DeleteDepartment(ctx context.Context, id string) error {
	if strings.TrimSpace(id) == "" {
		return errors.New("department ID is required")
	}
	return s.repo.Delete(ctx, id)
}

func mapToDTO(r *DepartmentRecord) DepartmentDTO {
	var codeStr string
	if r.Code.Valid {
		codeStr = r.Code.String
	}
	var descStr string
	if r.Description.Valid {
		descStr = r.Description.String
	}

	return DepartmentDTO{
		ID:          r.ID,
		Name:        r.Name,
		Code:        codeStr,
		Description: descStr,
		CreatedAt:   r.CreatedAt,
	}
}
