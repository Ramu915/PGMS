package districts

import "time"

type DistrictDTO struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	Code      string     `json:"code"`
	State     string     `json:"state"`
	CreatedAt time.Time  `json:"createdAt"`
	Taluks    []TalukDTO `json:"taluks,omitempty"`
}

type TalukDTO struct {
	ID         string    `json:"id"`
	DistrictID string    `json:"districtId"`
	Name       string    `json:"name"`
	Type       string    `json:"type"`
	Code       string    `json:"code"`
	CreatedAt  time.Time `json:"createdAt"`
}

type ProvisionOfficerRequest struct {
	Name            string `json:"name"`
	Email           string `json:"email"` // Notification recipient email (e.g. personal/official contact)
	Designation     string `json:"designation"`
	DepartmentID    string `json:"departmentId"`
	DistrictID      string `json:"districtId"`
	TalukID         string `json:"talukId"`
	PasswordOverride string `json:"password,omitempty"`
}

type ProvisionOfficerResponse struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	OfficialEmail     string `json:"officialEmail"`
	NotificationEmail string `json:"notificationEmail"`
	TemporaryPassword string `json:"temporaryPassword"`
	Designation       string `json:"designation"`
	DepartmentID      string `json:"departmentId"`
	DistrictID        string `json:"districtId"`
	TalukID           string `json:"talukId"`
	Message           string `json:"message"`
}
