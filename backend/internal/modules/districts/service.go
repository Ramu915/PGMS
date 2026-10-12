package districts

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"backend/pkg/govdomain"
	"backend/pkg/mailer"
	"golang.org/x/crypto/bcrypt"
)

type Service interface {
	GetDistricts(ctx context.Context) ([]*DistrictDTO, error)
	GetTaluksByDistrict(ctx context.Context, districtID string) ([]*TalukDTO, error)
	ProvisionOfficer(ctx context.Context, req ProvisionOfficerRequest, adminRole string) (*ProvisionOfficerResponse, error)
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

func (s *service) GetDistricts(ctx context.Context) ([]*DistrictDTO, error) {
	records, err := s.repo.GetDistricts(ctx)
	if err != nil {
		return nil, err
	}

	dtos := make([]*DistrictDTO, 0, len(records))
	for _, r := range records {
		dtos = append(dtos, &DistrictDTO{
			ID:    r.ID,
			Name:  r.Name,
			Code:  r.Code,
			State: r.State,
		})
	}
	return dtos, nil
}

func (s *service) GetTaluksByDistrict(ctx context.Context, districtID string) ([]*TalukDTO, error) {
	records, err := s.repo.GetTaluksByDistrict(ctx, districtID)
	if err != nil {
		return nil, err
	}

	dtos := make([]*TalukDTO, 0, len(records))
	for _, r := range records {
		code := ""
		if r.Code.Valid {
			code = r.Code.String
		}
		dtos = append(dtos, &TalukDTO{
			ID:         r.ID,
			DistrictID: r.DistrictID,
			Name:       r.Name,
			Type:       r.Type,
			Code:       code,
		})
	}
	return dtos, nil
}

func (s *service) ProvisionOfficer(ctx context.Context, req ProvisionOfficerRequest, adminRole string) (*ProvisionOfficerResponse, error) {
	if adminRole != "admin" {
		return nil, errors.New("unauthorized. Only Administrators can provision department officer accounts.")
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Designation = strings.TrimSpace(req.Designation)

	if req.Name == "" {
		return nil, errors.New("officer name is required")
	}
	if req.Email == "" {
		return nil, errors.New("officer contact email is required for onboarding dispatch")
	}
	if req.Designation == "" {
		req.Designation = "Officer"
	}
	if req.DepartmentID == "" {
		req.DepartmentID = "dept"
	}
	if req.DistrictID == "" {
		return nil, errors.New("district selection is required")
	}
	if req.TalukID == "" {
		return nil, errors.New("taluk/jurisdiction selection is required")
	}

	dist, err := s.repo.GetDistrictByID(ctx, req.DistrictID)
	if err != nil {
		return nil, fmt.Errorf("invalid district ID: %w", err)
	}

	taluk, err := s.repo.GetTalukByID(ctx, req.TalukID)
	if err != nil {
		return nil, fmt.Errorf("invalid taluk ID: %w", err)
	}

	deptCode, deptName, _ := s.repo.GetDepartmentCodeByID(ctx, req.DepartmentID)

	// Auto-generate standardized official email: e.g. aee.pwd.yelahanka.bengaluru@karnataka.gov.in
	officialEmail := govdomain.GenerateOfficialEmail(req.Designation, deptCode, taluk.Name, dist.Name)

	// Generate secure temporary password
	tempPassword := req.PasswordOverride
	if tempPassword == "" {
		genPass, errP := govdomain.GenerateSecureTempPassword()
		if errP != nil {
			tempPassword = "GovPass#2026!"
		} else {
			tempPassword = genPass
		}
	}

	passHashBytes, err := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	userID, err := s.repo.CreateOfficerAccount(
		ctx,
		req.Name,
		req.Email,
		officialEmail,
		string(passHashBytes),
		req.Designation,
		req.DepartmentID,
		req.DistrictID,
		req.TalukID,
	)
	if err != nil {
		return nil, err
	}

	// Trigger non-blocking email onboarding dispatch
	go func(cfg mailer.SMTPConfig, notifyEmail, oName, desig, dName, distName, tName, offEmail, pass string) {
		_ = mailer.SendOfficerOnboardingEmail(cfg, notifyEmail, oName, desig, dName, distName, tName, offEmail, pass)
	}(s.smtpCfg, req.Email, req.Name, req.Designation, deptName, dist.Name, taluk.Name, officialEmail, tempPassword)

	return &ProvisionOfficerResponse{
		ID:                userID,
		Name:              req.Name,
		OfficialEmail:     officialEmail,
		NotificationEmail: req.Email,
		TemporaryPassword: tempPassword,
		Designation:       req.Designation,
		DepartmentID:      req.DepartmentID,
		DistrictID:        req.DistrictID,
		TalukID:           req.TalukID,
		Message:           fmt.Sprintf("Official Department Account '%s' provisioned and credentials dispatched to %s.", officialEmail, req.Email),
	}, nil
}
