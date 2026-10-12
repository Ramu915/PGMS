package auth

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"backend/pkg/jwt"
	"backend/pkg/mailer"
	"golang.org/x/crypto/bcrypt"
)

type Service interface {
	Register(ctx context.Context, req RegisterRequest) (*AuthResponse, error)
	Login(ctx context.Context, req LoginRequest) (*AuthResponse, error)
	GoogleLogin(ctx context.Context, req GoogleAuthRequest) (*AuthResponse, error)
	RefreshToken(ctx context.Context, rawRefreshToken string) (*TokenRefreshResponse, error)
	Logout(ctx context.Context, rawRefreshToken string) error
	GetMe(ctx context.Context, userID string) (*UserDTO, error)
	ForgotPassword(ctx context.Context, req ForgotPasswordRequest) (*ForgotPasswordResponse, error)
	ResetPassword(ctx context.Context, req ResetPasswordRequest) error
}

type service struct {
	repo           Repository
	jwtSecret      string
	googleClientID string
	smtpCfg        mailer.SMTPConfig
}

func NewService(repo Repository, jwtSecret string, googleClientID string, smtpCfg mailer.SMTPConfig) Service {
	return &service{
		repo:           repo,
		jwtSecret:      jwtSecret,
		googleClientID: googleClientID,
		smtpCfg:        smtpCfg,
	}
}

type googleTokenInfo struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified string `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	Aud           string `json:"aud"`
	Iss           string `json:"iss"`
	Exp           string `json:"exp"`
}

func verifyGoogleIDToken(ctx context.Context, idToken, expectedClientID string) (*googleTokenInfo, error) {
	if idToken == "" {
		return nil, errors.New("empty google id token")
	}

	client := &http.Client{Timeout: 10 * time.Second}
	reqURL := fmt.Sprintf("https://oauth2.googleapis.com/tokeninfo?id_token=%s", url.QueryEscape(idToken))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create google verification request: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to contact google token verification server: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("invalid or expired Google ID Token")
	}

	var info googleTokenInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, fmt.Errorf("failed to parse google token response: %w", err)
	}

	if expectedClientID != "" && info.Aud != expectedClientID {
		return nil, fmt.Errorf("google ID token audience mismatch: token intended for client %s", info.Aud)
	}

	if info.Email == "" {
		return nil, errors.New("google ID token does not contain a valid email address")
	}

	return &info, nil
}

func (s *service) Register(ctx context.Context, req RegisterRequest) (*AuthResponse, error) {
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		return nil, errors.New("email and password are required")
	}

	if len(req.Password) < 8 {
		return nil, errors.New("password must be at least 8 characters long")
	}

	existing, _ := s.repo.GetUserByEmail(ctx, req.Email)
	if existing != nil {
		return nil, errors.New("user with this email already exists")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	role := "citizen"
	if req.Role == "department" || req.Role == "admin" {
		role = req.Role
	}

	userRecord := &UserRecord{
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Name:         sql.NullString{String: strings.TrimSpace(req.Name), Valid: req.Name != ""},
		Phone:        sql.NullString{String: strings.TrimSpace(req.Phone), Valid: req.Phone != ""},
		Role:         role,
		DepartmentID: sql.NullString{String: strings.TrimSpace(req.DepartmentID), Valid: req.DepartmentID != ""},
	}

	if err := s.repo.CreateUser(ctx, userRecord); err != nil {
		return nil, err
	}

	return s.issueTokensForUser(ctx, userRecord)
}

func (s *service) Login(ctx context.Context, req LoginRequest) (*AuthResponse, error) {
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		return nil, errors.New("email and password are required")
	}

	userRecord, err := s.repo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return nil, errors.New("invalid email or password")
	}

	if userRecord.PasswordHash == "" {
		return nil, errors.New("this account was created using Google Sign-In. Please sign in with Google")
	}

	cleanPass := strings.TrimSpace(req.Password)
	if err := bcrypt.CompareHashAndPassword([]byte(userRecord.PasswordHash), []byte(cleanPass)); err != nil {
		if err2 := bcrypt.CompareHashAndPassword([]byte(userRecord.PasswordHash), []byte(req.Password)); err2 != nil {
			return nil, errors.New("invalid email or password")
		}
	}

	return s.issueTokensForUser(ctx, userRecord)
}

func (s *service) GoogleLogin(ctx context.Context, req GoogleAuthRequest) (*AuthResponse, error) {
	var verifiedEmail string
	var verifiedGoogleID string
	var verifiedName string
	var verifiedAvatarURL string

	if req.IdToken != "" {
		info, err := verifyGoogleIDToken(ctx, req.IdToken, s.googleClientID)
		if err != nil {
			return nil, err
		}
		verifiedEmail = strings.TrimSpace(strings.ToLower(info.Email))
		verifiedGoogleID = info.Sub
		verifiedName = info.Name
		verifiedAvatarURL = info.Picture
	} else {
		// Fallback for dev mode when idToken is not provided
		verifiedEmail = strings.TrimSpace(strings.ToLower(req.Email))
		verifiedGoogleID = req.GoogleID
		verifiedName = req.Name
		verifiedAvatarURL = req.AvatarURL
	}

	if verifiedEmail == "" {
		return nil, errors.New("email is required for Google Sign-In")
	}

	var userRecord *UserRecord

	if verifiedGoogleID != "" {
		userRecord, _ = s.repo.GetUserByGoogleID(ctx, verifiedGoogleID)
	}

	if userRecord == nil {
		userRecord, _ = s.repo.GetUserByEmail(ctx, verifiedEmail)
	}

	if userRecord != nil {
		// Link Google account if not linked
		_ = s.repo.LinkGoogleAccount(ctx, userRecord.ID, verifiedGoogleID, verifiedAvatarURL)
		if verifiedGoogleID != "" {
			userRecord.GoogleID = sql.NullString{String: verifiedGoogleID, Valid: true}
		}
		if verifiedAvatarURL != "" {
			userRecord.AvatarURL = sql.NullString{String: verifiedAvatarURL, Valid: true}
		}
	} else {
		// Create new citizen user via Google OAuth
		userRecord = &UserRecord{
			Email:     verifiedEmail,
			Name:      sql.NullString{String: strings.TrimSpace(verifiedName), Valid: verifiedName != ""},
			Role:      "citizen",
			GoogleID:  sql.NullString{String: strings.TrimSpace(verifiedGoogleID), Valid: verifiedGoogleID != ""},
			AvatarURL: sql.NullString{String: strings.TrimSpace(verifiedAvatarURL), Valid: verifiedAvatarURL != ""},
		}
		if err := s.repo.CreateUser(ctx, userRecord); err != nil {
			return nil, fmt.Errorf("failed to create Google user: %w", err)
		}
	}

	return s.issueTokensForUser(ctx, userRecord)
}

func (s *service) RefreshToken(ctx context.Context, rawRefreshToken string) (*TokenRefreshResponse, error) {
	rawRefreshToken = strings.TrimSpace(rawRefreshToken)
	if rawRefreshToken == "" {
		return nil, errors.New("refresh token is required")
	}

	claims, err := jwt.ValidateRefreshToken(rawRefreshToken, s.jwtSecret)
	if err != nil {
		return nil, errors.New("invalid or expired refresh token")
	}

	// Verify token status in DB/store
	storedToken, err := s.repo.GetRefreshToken(ctx, rawRefreshToken)
	if err != nil || storedToken.Revoked || time.Now().After(storedToken.ExpiresAt) {
		return nil, errors.New("refresh token has been revoked or expired")
	}

	userRecord, err := s.repo.GetUserByID(ctx, claims.UserID)
	if err != nil {
		return nil, errors.New("user account no longer exists")
	}

	// Revoke current refresh token (Token Rotation)
	_ = s.repo.RevokeRefreshToken(ctx, rawRefreshToken)

	// Issue new access & refresh tokens
	deptIDStr := ""
	if userRecord.DepartmentID.Valid {
		deptIDStr = userRecord.DepartmentID.String
	}

	newAccessToken, err := jwt.GenerateAccessToken(userRecord.ID, userRecord.Email, userRecord.Role, deptIDStr, s.jwtSecret)
	if err != nil {
		return nil, err
	}

	newTokenID := fmt.Sprintf("rt-%d", time.Now().UnixNano())
	newRefreshToken, err := jwt.GenerateRefreshToken(userRecord.ID, newTokenID, s.jwtSecret)
	if err != nil {
		return nil, err
	}

	_ = s.repo.StoreRefreshToken(ctx, userRecord.ID, newTokenID, newRefreshToken, time.Now().Add(jwt.RefreshTokenDuration))

	return &TokenRefreshResponse{
		AccessToken:  newAccessToken,
		RefreshToken: newRefreshToken,
	}, nil
}

func (s *service) Logout(ctx context.Context, rawRefreshToken string) error {
	if rawRefreshToken != "" {
		_ = s.repo.RevokeRefreshToken(ctx, rawRefreshToken)
	}
	return nil
}

func (s *service) GetMe(ctx context.Context, userID string) (*UserDTO, error) {
	userRecord, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, errors.New("user profile not found")
	}

	dto := mapToUserDTO(userRecord)
	return &dto, nil
}

func (s *service) issueTokensForUser(ctx context.Context, u *UserRecord) (*AuthResponse, error) {
	deptIDStr := ""
	if u.DepartmentID.Valid {
		deptIDStr = u.DepartmentID.String
	}

	accessToken, err := jwt.GenerateAccessToken(u.ID, u.Email, u.Role, deptIDStr, s.jwtSecret)
	if err != nil {
		return nil, err
	}

	tokenID := fmt.Sprintf("rt-%d", time.Now().UnixNano())
	refreshToken, err := jwt.GenerateRefreshToken(u.ID, tokenID, s.jwtSecret)
	if err != nil {
		return nil, err
	}

	_ = s.repo.StoreRefreshToken(ctx, u.ID, tokenID, refreshToken, time.Now().Add(jwt.RefreshTokenDuration))

	userDTO := mapToUserDTO(u)

	return &AuthResponse{
		User:         userDTO,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		Token:        accessToken,
	}, nil
}

func mapToUserDTO(u *UserRecord) UserDTO {
	var deptID *string
	if u.DepartmentID.Valid && u.DepartmentID.String != "" {
		deptID = &u.DepartmentID.String
	}

	var distID *string
	if u.DistrictID.Valid && u.DistrictID.String != "" {
		distID = &u.DistrictID.String
	}

	var talukID *string
	if u.TalukID.Valid && u.TalukID.String != "" {
		talukID = &u.TalukID.String
	}

	var offEmail *string
	if u.OfficialEmail.Valid && u.OfficialEmail.String != "" {
		offEmail = &u.OfficialEmail.String
	}

	var desig *string
	if u.Designation.Valid && u.Designation.String != "" {
		desig = &u.Designation.String
	}

	var nameStr string
	if u.Name.Valid {
		nameStr = u.Name.String
	}

	var phoneStr string
	if u.Phone.Valid {
		phoneStr = u.Phone.String
	}

	var googleID *string
	if u.GoogleID.Valid && u.GoogleID.String != "" {
		googleID = &u.GoogleID.String
	}

	var avatarURL *string
	if u.AvatarURL.Valid && u.AvatarURL.String != "" {
		avatarURL = &u.AvatarURL.String
	}

	return UserDTO{
		ID:            u.ID,
		Email:         u.Email,
		OfficialEmail: offEmail,
		Name:          nameStr,
		Phone:         phoneStr,
		Role:          u.Role,
		Designation:   desig,
		DepartmentID:  deptID,
		DistrictID:    distID,
		TalukID:       talukID,
		GoogleID:      googleID,
		AvatarURL:     avatarURL,
		CreatedAt:     u.CreatedAt,
		UpdatedAt:     u.UpdatedAt,
	}
}

func (s *service) ForgotPassword(ctx context.Context, req ForgotPasswordRequest) (*ForgotPasswordResponse, error) {
	email := strings.TrimSpace(strings.ToLower(req.Email))
	if email == "" {
		return nil, errors.New("email is required")
	}

	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil || user == nil {
		return &ForgotPasswordResponse{
			Message: "If an account exists with this email, password reset instructions have been sent to your inbox.",
		}, nil
	}

	rawToken, err := mailer.GenerateCryptoToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate reset token: %w", err)
	}

	hashedToken := mailer.HashToken(rawToken)
	expiresAt := time.Now().Add(15 * time.Minute)

	if err := s.repo.SetResetToken(ctx, email, hashedToken, expiresAt); err != nil {
		return nil, errors.New("failed to save password reset token")
	}

	go func() {
		_ = mailer.SendPasswordResetEmail(s.smtpCfg, user.Email, rawToken)
	}()

	return &ForgotPasswordResponse{
		Message: "If an account exists with this email, password reset instructions have been sent to your inbox.",
	}, nil
}

func (s *service) ResetPassword(ctx context.Context, req ResetPasswordRequest) error {
	email := strings.TrimSpace(strings.ToLower(req.Email))
	rawToken := strings.TrimSpace(req.Token)
	newPassword := req.NewPassword

	if rawToken == "" || newPassword == "" {
		return errors.New("reset token and new password are required")
	}

	if len(newPassword) < 8 {
		return errors.New("new password must be at least 8 characters long")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash new password: %w", err)
	}

	hashedToken := mailer.HashToken(rawToken)

	if email != "" {
		if err := s.repo.VerifyAndResetPassword(ctx, email, hashedToken, string(hashedPassword)); err == nil {
			return nil
		}
	}

	if err := s.repo.VerifyAndResetPasswordByToken(ctx, hashedToken, string(hashedPassword)); err != nil {
		return err
	}

	return nil
}
