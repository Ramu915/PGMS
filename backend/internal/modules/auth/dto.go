package auth

import "time"

type RegisterRequest struct {
	Email        string `json:"email"`
	Password     string `json:"password"`
	Name         string `json:"name,omitempty"`
	Phone        string `json:"phone,omitempty"`
	Role         string `json:"role,omitempty"`
	DepartmentID string `json:"departmentId,omitempty"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type GoogleAuthRequest struct {
	Email     string `json:"email"`
	GoogleID  string `json:"googleId,omitempty"`
	Name      string `json:"name,omitempty"`
	AvatarURL string `json:"avatarUrl,omitempty"`
	IdToken   string `json:"idToken,omitempty"`
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type LogoutRequest struct {
	RefreshToken string `json:"refreshToken,omitempty"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

type ResetPasswordRequest struct {
	Email       string `json:"email"`
	Token       string `json:"token"`
	NewPassword string `json:"newPassword"`
}

type ForgotPasswordResponse struct {
	Message string `json:"message"`
}

type UserDTO struct {
	ID            string    `json:"id"`
	Email         string    `json:"email"`
	OfficialEmail *string   `json:"officialEmail,omitempty"`
	Name          string    `json:"name,omitempty"`
	Phone         string    `json:"phone,omitempty"`
	Role          string    `json:"role"`
	Designation   *string   `json:"designation,omitempty"`
	DepartmentID  *string   `json:"departmentId,omitempty"`
	DistrictID    *string   `json:"districtId,omitempty"`
	TalukID       *string   `json:"talukId,omitempty"`
	GoogleID      *string   `json:"googleId,omitempty"`
	AvatarURL     *string   `json:"avatarUrl,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

type AuthResponse struct {
	User         UserDTO `json:"user"`
	AccessToken  string  `json:"accessToken"`
	RefreshToken string  `json:"refreshToken"`
	Token        string  `json:"token,omitempty"` // legacy alias for accessToken
}

type TokenRefreshResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}
