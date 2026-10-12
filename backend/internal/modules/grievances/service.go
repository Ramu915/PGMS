package grievances

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"backend/pkg/mailer"
)

type Service interface {
	CreateGrievance(ctx context.Context, req CreateGrievanceRequest, citizenID string, imagePaths []string) (*GrievanceDTO, error)
	GetGrievanceByID(ctx context.Context, id string, userRole string) (*GrievanceDTO, error)
	ListGrievances(ctx context.Context, params FilterParams, currentUserID string, userRole string, userDeptID string) ([]*GrievanceDTO, error)
	UpdateGrievanceStatus(ctx context.Context, id string, req CreateUpdateRequest, authorID string, authorRole string) (*GrievanceUpdateDTO, error)
	GetGrievanceUpdates(ctx context.Context, id string) ([]*GrievanceUpdateDTO, error)
	AssignOfficer(ctx context.Context, id string, req AssignGrievanceRequest, assignerID string, assignerRole string) error
	AddComment(ctx context.Context, id string, req CreateCommentRequest, userID string, userRole string) (*CommentDTO, error)
	GetComments(ctx context.Context, id string, userRole string) ([]*CommentDTO, error)
	GetNearbyGrievances(ctx context.Context, lat float64, lng float64) ([]*GrievanceDTO, error)
	UpvoteGrievance(ctx context.Context, id string) (int, error)
}

type service struct {
	repo    Repository
	smtpCfg mailer.SMTPConfig
}

func NewService(repo Repository, smtpCfg mailer.SMTPConfig) Service {
	return &service{
		repo:    repo,
		smtpCfg: smtpCfg,
	}
}

func (s *service) CreateGrievance(ctx context.Context, req CreateGrievanceRequest, citizenID string, imagePaths []string) (*GrievanceDTO, error) {
	req.Title = strings.TrimSpace(req.Title)
	req.Description = strings.TrimSpace(req.Description)
	req.Category = strings.TrimSpace(req.Category)

	if req.Title == "" {
		return nil, errors.New("grievance title is required")
	}
	if req.Description == "" {
		return nil, errors.New("grievance description is required")
	}
	if req.Category == "" {
		req.Category = "General"
	}
	if citizenID == "" {
		return nil, errors.New("citizen identification is required")
	}

	record := &GrievanceRecord{
		Title:       req.Title,
		Description: req.Description,
		Category:    req.Category,
		Status:      "pending",
		Images:      imagePaths,
		CitizenID:   citizenID,
	}

	if req.Latitude != nil {
		record.Latitude = sql.NullFloat64{Float64: *req.Latitude, Valid: true}
	}
	if req.Longitude != nil {
		record.Longitude = sql.NullFloat64{Float64: *req.Longitude, Valid: true}
	}
	if req.DepartmentID != "" {
		record.DepartmentID = sql.NullString{String: req.DepartmentID, Valid: true}
	}
	if req.DistrictID != "" {
		record.DistrictID = sql.NullString{String: req.DistrictID, Valid: true}
	}
	if req.TalukID != "" {
		record.TalukID = sql.NullString{String: req.TalukID, Valid: true}
	}
	if req.Address != "" {
		record.Address = sql.NullString{String: req.Address, Valid: true}
	}
	if req.Landmark != "" {
		record.Landmark = sql.NullString{String: req.Landmark, Valid: true}
	}

	if err := s.repo.Create(ctx, record); err != nil {
		return nil, err
	}

	return s.mapToDTO(record), nil
}

func (s *service) GetGrievanceByID(ctx context.Context, id string, userRole string) (*GrievanceDTO, error) {
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("invalid grievance id")
	}

	record, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	dto := s.mapToDTO(record)

	updates, _ := s.GetGrievanceUpdates(ctx, id)
	if updates != nil {
		dto.Updates = make([]GrievanceUpdateDTO, len(updates))
		for i, u := range updates {
			dto.Updates[i] = *u
		}
	}

	comments, _ := s.GetComments(ctx, id, userRole)
	if comments != nil {
		dto.Comments = make([]CommentDTO, len(comments))
		for i, c := range comments {
			dto.Comments[i] = *c
		}
	}

	return dto, nil
}

func (s *service) ListGrievances(ctx context.Context, params FilterParams, currentUserID string, userRole string, userDeptID string) ([]*GrievanceDTO, error) {
	records, err := s.repo.List(ctx, params, currentUserID, userRole, userDeptID)
	if err != nil {
		return nil, err
	}

	dtos := make([]*GrievanceDTO, 0, len(records))
	for _, r := range records {
		dtos = append(dtos, s.mapToDTO(r))
	}
	return dtos, nil
}

func (s *service) UpdateGrievanceStatus(ctx context.Context, id string, req CreateUpdateRequest, authorID string, authorRole string) (*GrievanceUpdateDTO, error) {
	req.Status = strings.TrimSpace(strings.ToLower(req.Status))
	req.Note = strings.TrimSpace(req.Note)

	if req.Status == "" {
		return nil, errors.New("new status is required")
	}
	validStatuses := map[string]bool{"pending": true, "in_progress": true, "resolved": true, "rejected": true}
	if !validStatuses[req.Status] {
		return nil, fmt.Errorf("invalid status '%s'. Must be one of: pending, in_progress, resolved, rejected", req.Status)
	}

	if req.Note == "" {
		req.Note = fmt.Sprintf("Status updated to %s.", req.Status)
	}

	updateRec, err := s.repo.UpdateStatus(ctx, id, req.Status, authorID, authorRole, req.Note, req.Images)
	if err != nil {
		return nil, err
	}

	// Trigger non-blocking email notification to citizen
	gRec, errG := s.repo.GetByID(ctx, id)
	if errG == nil && gRec != nil {
		cEmail, cName, errU := s.repo.GetUserContactDetails(ctx, gRec.CitizenID)
		if errU == nil && cEmail != "" {
			go func(cfg mailer.SMTPConfig, email, name, title, status, note, gID string) {
				_ = mailer.SendGrievanceStatusEmail(cfg, email, name, title, status, note, gID)
			}(s.smtpCfg, cEmail, cName, gRec.Title, req.Status, req.Note, id)
		}
	}

	authorName := "Official"
	if updateRec.AuthorName.Valid {
		authorName = updateRec.AuthorName.String
	}

	var adminID *string
	if updateRec.AdminID.Valid {
		adminID = &updateRec.AdminID.String
	}

	var userID *string
	if updateRec.UserID.Valid {
		userID = &updateRec.UserID.String
	}

	images := updateRec.Images
	if images == nil {
		images = []string{}
	}

	return &GrievanceUpdateDTO{
		ID:          updateRec.ID,
		GrievanceID: updateRec.GrievanceID,
		Status:      updateRec.Status,
		Note:        updateRec.Note,
		Images:      images,
		AdminID:     adminID,
		UserID:      userID,
		AuthorName:  authorName,
		CreatedAt:   updateRec.CreatedAt,
	}, nil
}

func (s *service) GetGrievanceUpdates(ctx context.Context, id string) ([]*GrievanceUpdateDTO, error) {
	records, err := s.repo.GetUpdates(ctx, id)
	if err != nil {
		return nil, err
	}

	dtos := make([]*GrievanceUpdateDTO, 0, len(records))
	for _, r := range records {
		var adminID *string
		if r.AdminID.Valid {
			adminID = &r.AdminID.String
		}
		var userID *string
		if r.UserID.Valid {
			userID = &r.UserID.String
		}
		authorName := "System"
		if r.AuthorName.Valid {
			authorName = r.AuthorName.String
		}

		images := r.Images
		if images == nil {
			images = []string{}
		}

		dtos = append(dtos, &GrievanceUpdateDTO{
			ID:          r.ID,
			GrievanceID: r.GrievanceID,
			Status:      r.Status,
			Note:        r.Note,
			Images:      images,
			AdminID:     adminID,
			UserID:      userID,
			AuthorName:  authorName,
			CreatedAt:   r.CreatedAt,
		})
	}
	return dtos, nil
}

func (s *service) AssignOfficer(ctx context.Context, id string, req AssignGrievanceRequest, assignerID string, assignerRole string) error {
	if assignerRole != "admin" && assignerRole != "department" {
		return errors.New("unauthorized. Only administrators and department officers can reassign grievances.")
	}

	if err := s.repo.AssignOfficer(ctx, id, req.OfficerID); err != nil {
		return err
	}

	// Create automatic status update note
	note := "Grievance assigned to officer."
	if req.Note != "" {
		note = fmt.Sprintf("Grievance assigned to officer: %s", req.Note)
	}
	_, _ = s.repo.UpdateStatus(ctx, id, "in_progress", assignerID, assignerRole, note, nil)

	// Trigger non-blocking email notification to assigned officer
	oEmail, oName, errO := s.repo.GetUserContactDetails(ctx, req.OfficerID)
	gRec, errG := s.repo.GetByID(ctx, id)
	if errO == nil && oEmail != "" && errG == nil && gRec != nil {
		go func(cfg mailer.SMTPConfig, email, name, title, cat, citizenName, note, gID string) {
			_ = mailer.SendGrievanceAssignmentEmail(cfg, email, name, title, cat, citizenName, note, gID)
		}(s.smtpCfg, oEmail, oName, gRec.Title, gRec.Category, gRec.CitizenName.String, req.Note, id)
	}

	return nil
}

func (s *service) AddComment(ctx context.Context, id string, req CreateCommentRequest, userID string, userRole string) (*CommentDTO, error) {
	req.Text = strings.TrimSpace(req.Text)
	if req.Text == "" {
		return nil, errors.New("comment text cannot be empty")
	}

	// Only officers or admins can post internal remarks
	if req.IsInternal && userRole != "admin" && userRole != "department" {
		return nil, errors.New("unauthorized. Citizens cannot post internal remarks.")
	}

	rec, err := s.repo.AddComment(ctx, id, userID, req.Text, req.IsInternal)
	if err != nil {
		return nil, err
	}

	authorName := "User"
	if rec.AuthorName.Valid {
		authorName = rec.AuthorName.String
	}
	authorRole := "citizen"
	if rec.AuthorRole.Valid {
		authorRole = rec.AuthorRole.String
	}

	return &CommentDTO{
		ID:          rec.ID,
		GrievanceID: rec.GrievanceID,
		UserID:      rec.UserID,
		AuthorName:  authorName,
		AuthorRole:  authorRole,
		Text:        rec.Text,
		IsInternal:  rec.IsInternal,
		CreatedAt:   rec.CreatedAt,
	}, nil
}

func (s *service) GetComments(ctx context.Context, id string, userRole string) ([]*CommentDTO, error) {
	includeInternal := (userRole == "admin" || userRole == "department")
	records, err := s.repo.GetComments(ctx, id, includeInternal)
	if err != nil {
		return nil, err
	}

	dtos := make([]*CommentDTO, 0, len(records))
	for _, r := range records {
		authorName := "User"
		if r.AuthorName.Valid {
			authorName = r.AuthorName.String
		}
		authorRole := "citizen"
		if r.AuthorRole.Valid {
			authorRole = r.AuthorRole.String
		}

		dtos = append(dtos, &CommentDTO{
			ID:          r.ID,
			GrievanceID: r.GrievanceID,
			UserID:      r.UserID,
			AuthorName:  authorName,
			AuthorRole:  authorRole,
			Text:        r.Text,
			IsInternal:  r.IsInternal,
			CreatedAt:   r.CreatedAt,
		})
	}

	return dtos, nil
}

func (s *service) mapToDTO(r *GrievanceRecord) *GrievanceDTO {
	var lat *float64
	if r.Latitude.Valid {
		lat = &r.Latitude.Float64
	}

	var lng *float64
	if r.Longitude.Valid {
		lng = &r.Longitude.Float64
	}

	var deptID *string
	if r.DepartmentID.Valid {
		deptID = &r.DepartmentID.String
	}

	var distID *string
	if r.DistrictID.Valid {
		distID = &r.DistrictID.String
	}

	var talukID *string
	if r.TalukID.Valid {
		talukID = &r.TalukID.String
	}

	var assignedOfficerID *string
	if r.AssignedOfficerID.Valid {
		assignedOfficerID = &r.AssignedOfficerID.String
	}

	citizenName := ""
	if r.CitizenName.Valid {
		citizenName = r.CitizenName.String
	}

	deptName := ""
	if r.DeptName.Valid {
		deptName = r.DeptName.String
	}

	distName := ""
	if r.DistrictName.Valid {
		distName = r.DistrictName.String
	}

	talukName := ""
	if r.TalukName.Valid {
		talukName = r.TalukName.String
	}

	address := ""
	if r.Address.Valid {
		address = r.Address.String
	}

	landmark := ""
	if r.Landmark.Valid {
		landmark = r.Landmark.String
	}

	assignedOfficerName := ""
	if r.AssignedOfficerName.Valid {
		assignedOfficerName = r.AssignedOfficerName.String
	}

	images := r.Images
	if images == nil {
		images = []string{}
	}

	return &GrievanceDTO{
		ID:                  r.ID,
		Title:               r.Title,
		Description:         r.Description,
		Category:            r.Category,
		Status:              r.Status,
		Latitude:            lat,
		Longitude:           lng,
		Images:              images,
		CitizenID:           r.CitizenID,
		DepartmentID:        deptID,
		DistrictID:          distID,
		TalukID:             talukID,
		CitizenName:         citizenName,
		DeptName:            deptName,
		DistrictName:        distName,
		TalukName:           talukName,
		Address:             address,
		Landmark:            landmark,
		AssignedOfficerID:   assignedOfficerID,
		AssignedOfficerName: assignedOfficerName,
		Upvotes:             r.UpvoteCount,
		CreatedAt:           r.CreatedAt,
		UpdatedAt:           r.UpdatedAt,
	}
}

func (s *service) GetNearbyGrievances(ctx context.Context, lat float64, lng float64) ([]*GrievanceDTO, error) {
	records, err := s.repo.GetNearby(ctx, lat, lng)
	if err != nil {
		return nil, err
	}
	dtos := make([]*GrievanceDTO, 0, len(records))
	for _, r := range records {
		dtos = append(dtos, s.mapToDTO(r))
	}
	return dtos, nil
}

func (s *service) UpvoteGrievance(ctx context.Context, id string) (int, error) {
	if strings.TrimSpace(id) == "" {
		return 0, errors.New("invalid grievance id")
	}
	return s.repo.Upvote(ctx, id)
}
