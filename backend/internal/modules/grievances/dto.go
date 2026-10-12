package grievances

import "time"

type GrievanceDTO struct {
	ID                  string               `json:"id"`
	Title               string               `json:"title"`
	Description         string               `json:"description"`
	Category            string               `json:"category"`
	Status              string               `json:"status"`
	Latitude            *float64             `json:"latitude,omitempty"`
	Longitude           *float64             `json:"longitude,omitempty"`
	Images              []string             `json:"images"`
	CitizenID           string               `json:"citizenId"`
	DepartmentID        *string              `json:"departmentId,omitempty"`
	DistrictID          *string              `json:"districtId,omitempty"`
	TalukID             *string              `json:"talukId,omitempty"`
	CitizenName         string               `json:"citizenName,omitempty"`
	DeptName            string               `json:"departmentName,omitempty"`
	DistrictName        string               `json:"districtName,omitempty"`
	TalukName           string               `json:"talukName,omitempty"`
	Address             string               `json:"address,omitempty"`
	Landmark            string               `json:"landmark,omitempty"`
	AssignedOfficerID   *string              `json:"assignedOfficerId,omitempty"`
	AssignedOfficerName string               `json:"assignedOfficerName,omitempty"`
	Upvotes             int                  `json:"upvotes"`
	CreatedAt           time.Time            `json:"createdAt"`
	UpdatedAt           time.Time            `json:"updatedAt"`
	Updates             []GrievanceUpdateDTO `json:"updates,omitempty"`
	Comments            []CommentDTO         `json:"comments,omitempty"`
}

type GrievanceUpdateDTO struct {
	ID          string    `json:"id"`
	GrievanceID string    `json:"grievanceId"`
	Status      string    `json:"status"`
	Note        string    `json:"note"`
	Images      []string  `json:"images,omitempty"`
	AdminID     *string   `json:"adminId,omitempty"`
	UserID      *string   `json:"userId,omitempty"`
	AuthorName  string    `json:"authorName,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}

type CommentDTO struct {
	ID          string    `json:"id"`
	GrievanceID string    `json:"grievanceId"`
	UserID      string    `json:"userId"`
	AuthorName  string    `json:"authorName"`
	AuthorRole  string    `json:"authorRole"`
	Text        string    `json:"text"`
	IsInternal  bool      `json:"isInternal"`
	CreatedAt   time.Time `json:"createdAt"`
}

type CreateGrievanceRequest struct {
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	Category     string   `json:"category"`
	DepartmentID string   `json:"departmentId,omitempty"`
	DistrictID   string   `json:"districtId,omitempty"`
	TalukID      string   `json:"talukId,omitempty"`
	Address      string   `json:"address,omitempty"`
	Landmark     string   `json:"landmark,omitempty"`
	Latitude     *float64 `json:"latitude,omitempty"`
	Longitude    *float64 `json:"longitude,omitempty"`
}

type CreateUpdateRequest struct {
	Status string   `json:"status"`
	Note   string   `json:"note"`
	Images []string `json:"images,omitempty"`
}

type AssignGrievanceRequest struct {
	OfficerID string `json:"officerId"`
	Note      string `json:"note,omitempty"`
}

type CreateCommentRequest struct {
	Text       string `json:"text"`
	IsInternal bool   `json:"isInternal"`
}

type FilterParams struct {
	Category     string
	Status       string
	Search       string
	Sort         string
	MineOnly     bool
	DepartmentID string
	DistrictID   string
	TalukID      string
}
