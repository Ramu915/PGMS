package departments

import "time"

type CreateDepartmentRequest struct {
	Name        string `json:"name"`
	Code        string `json:"code,omitempty"`
	Description string `json:"description,omitempty"`
}

type DepartmentDTO struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Code        string    `json:"code,omitempty"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}
