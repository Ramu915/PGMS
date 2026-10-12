package mailer

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"html/template"
	"log"
	"net/smtp"
	"os"
	"path/filepath"
	"strings"
)

type SMTPConfig struct {
	Host        string
	Port        string
	Email       string
	Password    string
	FromEmail   string
	FrontendURL string
}

type ResetPasswordTemplateData struct {
	ToEmail   string
	ResetLink string
}

type StatusUpdateTemplateData struct {
	CitizenName    string
	GrievanceTitle string
	GrievanceID    string
	StatusText     string
	StatusClass    string
	OfficerNote    string
	GrievanceLink  string
}

type AssignmentTemplateData struct {
	OfficerName    string
	GrievanceTitle string
	GrievanceID    string
	Category       string
	CitizenName    string
	AssignerNote   string
	GrievanceLink  string
}

func GenerateCryptoToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func HashToken(token string) string {
	hash := sha256.Sum256([]byte(strings.TrimSpace(token)))
	return hex.EncodeToString(hash[:])
}

func loadTemplateContent(filenames []string) ([]byte, error) {
	for _, filename := range filenames {
		candidatePaths := []string{
			filepath.Join("templates/emails", filename),
			filepath.Join("backend/templates/emails", filename),
			filepath.Join("../templates/emails", filename),
			filepath.Join("../../templates/emails", filename),
			filepath.Join("../../backend/templates/emails", filename),
		}

		// Dynamically search upwards from current working directory to locate templates folder
		if cwd, err := os.Getwd(); err == nil {
			dir := cwd
			for i := 0; i < 5; i++ {
				candidatePaths = append(candidatePaths,
					filepath.Join(dir, "templates/emails", filename),
					filepath.Join(dir, "backend/templates/emails", filename),
				)
				parent := filepath.Dir(dir)
				if parent == dir {
					break
				}
				dir = parent
			}
		}

		for _, p := range candidatePaths {
			if content, err := os.ReadFile(p); err == nil && len(content) > 0 {
				return content, nil
			}
		}
	}
	return nil, fmt.Errorf("template file not found in search paths")
}

func renderResetPasswordHTML(toEmail, resetLink string) (string, error) {
	content, err := loadTemplateContent([]string{"reset_password.html"})
	if err != nil {
		return "", err
	}

	tmpl, err := template.New("reset_password").Parse(string(content))
	if err != nil {
		return "", fmt.Errorf("failed to parse reset password template: %w", err)
	}

	var buf bytes.Buffer
	data := ResetPasswordTemplateData{
		ToEmail:   toEmail,
		ResetLink: resetLink,
	}

	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute template: %w", err)
	}

	return buf.String(), nil
}

func renderStatusUpdateHTML(data StatusUpdateTemplateData) (string, error) {
	content, err := loadTemplateContent([]string{"grievance_status_update.html"})
	if err != nil {
		return "", err
	}

	tmpl, err := template.New("status_update").Parse(string(content))
	if err != nil {
		return "", fmt.Errorf("failed to parse status update template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute status update template: %w", err)
	}

	return buf.String(), nil
}

func renderAssignmentHTML(data AssignmentTemplateData) (string, error) {
	content, err := loadTemplateContent([]string{"grievance_assignment.html"})
	if err != nil {
		return "", err
	}

	tmpl, err := template.New("assignment").Parse(string(content))
	if err != nil {
		return "", fmt.Errorf("failed to parse assignment template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute assignment template: %w", err)
	}

	return buf.String(), nil
}

func sendMailRaw(cfg SMTPConfig, toEmail, subjectStr, htmlBody string) error {
	toEmail = strings.TrimSpace(strings.ToLower(toEmail))
	if toEmail == "" {
		return fmt.Errorf("recipient email is required")
	}

	from := cfg.FromEmail
	if from == "" {
		from = cfg.Email
	}

	subject := fmt.Sprintf("Subject: %s\n", subjectStr)
	mime := "MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n\n"
	msg := []byte(subject + mime + htmlBody)

	smtpPass := strings.ReplaceAll(cfg.Password, " ", "")
	smtpHost := cfg.Host
	if smtpHost == "" {
		smtpHost = "smtp.gmail.com"
	}
	smtpPort := cfg.Port
	if smtpPort == "" {
		smtpPort = "587"
	}

	auth := smtp.PlainAuth("", cfg.Email, smtpPass, smtpHost)
	addr := fmt.Sprintf("%s:%s", smtpHost, smtpPort)

	log.Printf("[SMTP Mailer] Sending email '%s' to %s (via %s)...\n", subjectStr, toEmail, addr)

	if err := smtp.SendMail(addr, auth, from, []string{toEmail}, msg); err != nil {
		log.Printf("[SMTP Mailer Error] Failed to send email to %s: %v\n", toEmail, err)
		return fmt.Errorf("failed to send email: %w", err)
	}

	log.Printf("[SMTP Mailer Success] Email '%s' delivered to %s\n", subjectStr, toEmail)
	return nil
}

func SendPasswordResetEmail(cfg SMTPConfig, toEmail string, resetToken string) error {
	appURL := strings.TrimRight(cfg.FrontendURL, "/")
	if appURL == "" {
		appURL = "http://localhost:3000"
	}

	resetLink := fmt.Sprintf("%s/reset-password?token=%s", appURL, resetToken)

	htmlBody, err := renderResetPasswordHTML(toEmail, resetLink)
	if err != nil {
		log.Printf("[Mailer Notice] Template fallback triggered: %v\n", err)
		htmlBody = fmt.Sprintf(`<p>Reset password link for %s: <a href="%s">%s</a></p>`, toEmail, resetLink, resetLink)
	}

	return sendMailRaw(cfg, toEmail, "Reset Your PGMS Account Password", htmlBody)
}

func SendGrievanceStatusEmail(cfg SMTPConfig, toEmail, citizenName, title, newStatus, note, grievanceID string) error {
	appURL := strings.TrimRight(cfg.FrontendURL, "/")
	if appURL == "" {
		appURL = "http://localhost:3000"
	}

	statusText := strings.ReplaceAll(newStatus, "_", " ")
	statusText = strings.ToUpper(statusText[:1]) + statusText[1:]

	data := StatusUpdateTemplateData{
		CitizenName:    citizenName,
		GrievanceTitle: title,
		GrievanceID:    grievanceID,
		StatusText:     statusText,
		StatusClass:    strings.ToLower(newStatus),
		OfficerNote:    note,
		GrievanceLink:  fmt.Sprintf("%s/grievances/%s", appURL, grievanceID),
	}

	htmlBody, err := renderStatusUpdateHTML(data)
	if err != nil {
		log.Printf("[Mailer Notice] Status update template fallback triggered: %v\n", err)
		htmlBody = fmt.Sprintf(`<p>Your grievance status was updated to <strong>%s</strong>. Note: %s</p>`, statusText, note)
	}

	subject := fmt.Sprintf("Grievance Status Update: %s [%s]", statusText, title)
	return sendMailRaw(cfg, toEmail, subject, htmlBody)
}

type OfficerOnboardingTemplateData struct {
	OfficerName       string
	Designation       string
	DepartmentName    string
	DistrictName      string
	TalukName         string
	OfficialEmail     string
	TemporaryPassword string
	PortalLink        string
}

func renderOfficerOnboardingHTML(data OfficerOnboardingTemplateData) (string, error) {
	content, err := loadTemplateContent([]string{"officer_onboarding.html"})
	if err != nil {
		return "", err
	}

	tmpl, err := template.New("officer_onboarding").Parse(string(content))
	if err != nil {
		return "", fmt.Errorf("failed to parse officer onboarding template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute officer onboarding template: %w", err)
	}

	return buf.String(), nil
}

func SendGrievanceAssignmentEmail(cfg SMTPConfig, toEmail, officerName, title, category, citizenName, assignerNote, grievanceID string) error {
	appURL := strings.TrimRight(cfg.FrontendURL, "/")
	if appURL == "" {
		appURL = "http://localhost:3000"
	}

	data := AssignmentTemplateData{
		OfficerName:    officerName,
		GrievanceTitle: title,
		GrievanceID:    grievanceID,
		Category:       category,
		CitizenName:    citizenName,
		AssignerNote:   assignerNote,
		GrievanceLink:  fmt.Sprintf("%s/grievances/%s", appURL, grievanceID),
	}

	htmlBody, err := renderAssignmentHTML(data)
	if err != nil {
		log.Printf("[Mailer Notice] Assignment template fallback triggered: %v\n", err)
		htmlBody = fmt.Sprintf(`<p>Grievance "%s" has been assigned to you.</p>`, title)
	}

	subject := fmt.Sprintf("New Grievance Assignment: %s", title)
	return sendMailRaw(cfg, toEmail, subject, htmlBody)
}

func SendOfficerOnboardingEmail(cfg SMTPConfig, recipientEmail, officerName, designation, deptName, districtName, talukName, officialEmail, tempPassword string) error {
	appURL := strings.TrimRight(cfg.FrontendURL, "/")
	if appURL == "" {
		appURL = "http://localhost:3000"
	}

	data := OfficerOnboardingTemplateData{
		OfficerName:       officerName,
		Designation:       designation,
		DepartmentName:    deptName,
		DistrictName:      districtName,
		TalukName:         talukName,
		OfficialEmail:     officialEmail,
		TemporaryPassword: tempPassword,
		PortalLink:        fmt.Sprintf("%s/login", appURL),
	}

	htmlBody, err := renderOfficerOnboardingHTML(data)
	if err != nil {
		log.Printf("[Mailer Notice] Onboarding template fallback triggered: %v\n", err)
		htmlBody = fmt.Sprintf(`<p>Official Email: %s | Temp Password: %s</p>`, officialEmail, tempPassword)
	}

	subject := fmt.Sprintf("PGMS-KA Official Department Account Appointment: %s", officialEmail)
	return sendMailRaw(cfg, recipientEmail, subject, htmlBody)
}

