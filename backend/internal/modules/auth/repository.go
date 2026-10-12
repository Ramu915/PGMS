package auth

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"backend/internal/database"
)

type UserRecord struct {
	ID            string
	Email         string
	OfficialEmail sql.NullString
	PasswordHash  string
	Name          sql.NullString
	Phone         sql.NullString
	Role          string
	Designation   sql.NullString
	DepartmentID  sql.NullString
	DistrictID    sql.NullString
	TalukID       sql.NullString
	GoogleID      sql.NullString
	AvatarURL     sql.NullString
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type RefreshTokenRecord struct {
	ID        string
	UserID    string
	TokenHash string
	ExpiresAt time.Time
	Revoked   bool
	CreatedAt time.Time
}

type Repository interface {
	CreateUser(ctx context.Context, u *UserRecord) error
	GetUserByEmail(ctx context.Context, email string) (*UserRecord, error)
	GetUserByGoogleID(ctx context.Context, googleID string) (*UserRecord, error)
	GetUserByID(ctx context.Context, id string) (*UserRecord, error)
	LinkGoogleAccount(ctx context.Context, userID, googleID, avatarURL string) error
	StoreRefreshToken(ctx context.Context, userID, tokenID, rawToken string, expiresAt time.Time) error
	GetRefreshToken(ctx context.Context, rawToken string) (*RefreshTokenRecord, error)
	RevokeRefreshToken(ctx context.Context, rawToken string) error
	SetResetToken(ctx context.Context, email string, token string, expiresAt time.Time) error
	VerifyAndResetPassword(ctx context.Context, email string, token string, newPasswordHash string) error
	VerifyAndResetPasswordByToken(ctx context.Context, token string, newPasswordHash string) error
}

type postgresRepo struct {
	db          *database.DB
	memLock     sync.RWMutex
	memUsers    map[string]*UserRecord
	memRefresh  map[string]*RefreshTokenRecord
}

func NewRepository(db *database.DB) Repository {
	repo := &postgresRepo{
		db:         db,
		memUsers:   make(map[string]*UserRecord),
		memRefresh: make(map[string]*RefreshTokenRecord),
	}

	adminPassHash := "$2a$10$j.JIJ8CNDX5ES8yD/GyYCOsvmNlb/IuJL/RSQYfrtcTc0Rwg.VXny" // adminpassword123
	adminUser := &UserRecord{
		ID:           "00000000-0000-0000-0000-000000000001",
		Email:        "admin@pgms.gov.in",
		PasswordHash: adminPassHash,
		Name:         sql.NullString{String: "System Administrator", Valid: true},
		Role:         "admin",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	repo.memUsers["admin@pgms.gov.in"] = adminUser

	if db != nil && db.SQL != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		var dbAdminID string
		err := db.SQL.QueryRowContext(ctx, `
			INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
			ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
			RETURNING id
		`, adminUser.ID, adminUser.Email, adminUser.PasswordHash, adminUser.Name.String, adminUser.Role).Scan(&dbAdminID)
		if err == nil && dbAdminID != "" {
			adminUser.ID = dbAdminID
		}

		// Also seed default citizen account
		citizenPassHash := "$2a$10$j.JIJ8CNDX5ES8yD/GyYCOsvmNlb/IuJL/RSQYfrtcTc0Rwg.VXny"
		_, _ = db.SQL.ExecContext(ctx, `
			INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
			ON CONFLICT (email) DO NOTHING
		`, "00000000-0000-0000-0000-000000000002", "citizen@pgms.gov.in", citizenPassHash, "Karnataka Citizen", "citizen")
	}

	return repo
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

func (r *postgresRepo) CreateUser(ctx context.Context, u *UserRecord) error {
	if r.db != nil && r.db.SQL != nil {
		query := `
			INSERT INTO users (email, password_hash, name, phone, role, department_id, google_id, avatar_url, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
			ON CONFLICT (email) DO UPDATE SET
				password_hash = COALESCE(NULLIF(EXCLUDED.password_hash, ''), users.password_hash),
				name = COALESCE(EXCLUDED.name, users.name),
				updated_at = NOW()
			RETURNING id, created_at, updated_at
		`
		var deptID *string
		if u.DepartmentID.Valid && u.DepartmentID.String != "" {
			deptID = &u.DepartmentID.String
		}
		var name *string
		if u.Name.Valid && u.Name.String != "" {
			name = &u.Name.String
		}
		var phone *string
		if u.Phone.Valid && u.Phone.String != "" {
			phone = &u.Phone.String
		}
		var googleID *string
		if u.GoogleID.Valid && u.GoogleID.String != "" {
			googleID = &u.GoogleID.String
		}
		var avatarURL *string
		if u.AvatarURL.Valid && u.AvatarURL.String != "" {
			avatarURL = &u.AvatarURL.String
		}

		err := r.db.SQL.QueryRowContext(ctx, query, u.Email, u.PasswordHash, name, phone, u.Role, deptID, googleID, avatarURL).Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
		if err == nil {
			r.memLock.Lock()
			r.memUsers[strings.ToLower(u.Email)] = u
			r.memLock.Unlock()
			return nil
		}
	}

	// In-memory fallback
	r.memLock.Lock()
	defer r.memLock.Unlock()

	u.ID = fmt.Sprintf("usr-%d", time.Now().UnixNano())
	u.CreatedAt = time.Now()
	u.UpdatedAt = time.Now()
	r.memUsers[strings.ToLower(u.Email)] = u
	return nil
}

func (r *postgresRepo) GetUserByEmail(ctx context.Context, email string) (*UserRecord, error) {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))

	if r.db != nil && r.db.SQL != nil {
		query := `
			SELECT id, email, official_email, COALESCE(password_hash, ''), name, phone, role, designation, department_id, district_id, taluk_id, google_id, avatar_url, created_at, updated_at
			FROM users
			WHERE LOWER(email) = LOWER($1) OR (official_email IS NOT NULL AND LOWER(official_email) = LOWER($1))
		`
		u := &UserRecord{}
		err := r.db.SQL.QueryRowContext(ctx, query, cleanEmail).Scan(
			&u.ID, &u.Email, &u.OfficialEmail, &u.PasswordHash, &u.Name, &u.Phone, &u.Role, &u.Designation, &u.DepartmentID, &u.DistrictID, &u.TalukID, &u.GoogleID, &u.AvatarURL, &u.CreatedAt, &u.UpdatedAt,
		)
		if err == nil {
			return u, nil
		}
	}

	// In-memory fallback lookup
	r.memLock.RLock()
	defer r.memLock.RUnlock()

	u, exists := r.memUsers[cleanEmail]
	if !exists {
		return nil, errors.New("user not found")
	}
	return u, nil
}

func (r *postgresRepo) GetUserByGoogleID(ctx context.Context, googleID string) (*UserRecord, error) {
	if googleID == "" {
		return nil, errors.New("empty google_id")
	}

	if r.db != nil && r.db.SQL != nil {
		query := `
			SELECT id, email, official_email, COALESCE(password_hash, ''), name, phone, role, designation, department_id, district_id, taluk_id, google_id, avatar_url, created_at, updated_at
			FROM users
			WHERE google_id = $1
		`
		u := &UserRecord{}
		err := r.db.SQL.QueryRowContext(ctx, query, googleID).Scan(
			&u.ID, &u.Email, &u.OfficialEmail, &u.PasswordHash, &u.Name, &u.Phone, &u.Role, &u.Designation, &u.DepartmentID, &u.DistrictID, &u.TalukID, &u.GoogleID, &u.AvatarURL, &u.CreatedAt, &u.UpdatedAt,
		)
		if err == nil {
			return u, nil
		}
	}

	r.memLock.RLock()
	defer r.memLock.RUnlock()

	for _, u := range r.memUsers {
		if u.GoogleID.Valid && u.GoogleID.String == googleID {
			return u, nil
		}
	}
	return nil, errors.New("user not found")
}

func (r *postgresRepo) GetUserByID(ctx context.Context, id string) (*UserRecord, error) {
	if r.db != nil && r.db.SQL != nil {
		query := `
			SELECT id, email, official_email, COALESCE(password_hash, ''), name, phone, role, designation, department_id, district_id, taluk_id, google_id, avatar_url, created_at, updated_at
			FROM users
			WHERE id = $1
		`
		u := &UserRecord{}
		err := r.db.SQL.QueryRowContext(ctx, query, id).Scan(
			&u.ID, &u.Email, &u.OfficialEmail, &u.PasswordHash, &u.Name, &u.Phone, &u.Role, &u.Designation, &u.DepartmentID, &u.DistrictID, &u.TalukID, &u.GoogleID, &u.AvatarURL, &u.CreatedAt, &u.UpdatedAt,
		)
		if err == nil {
			return u, nil
		}
	}

	// In-memory fallback lookup
	r.memLock.RLock()
	defer r.memLock.RUnlock()

	for _, u := range r.memUsers {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, errors.New("user not found")
}

func (r *postgresRepo) LinkGoogleAccount(ctx context.Context, userID, googleID, avatarURL string) error {
	if r.db != nil && r.db.SQL != nil {
		query := `
			UPDATE users 
			SET google_id = COALESCE(NULLIF($2, ''), google_id),
			    avatar_url = COALESCE(NULLIF($3, ''), avatar_url),
			    updated_at = NOW()
			WHERE id = $1
		`
		_, err := r.db.SQL.ExecContext(ctx, query, userID, googleID, avatarURL)
		if err == nil {
			return nil
		}
	}

	r.memLock.Lock()
	defer r.memLock.Unlock()

	for _, u := range r.memUsers {
		if u.ID == userID {
			if googleID != "" {
				u.GoogleID = sql.NullString{String: googleID, Valid: true}
			}
			if avatarURL != "" {
				u.AvatarURL = sql.NullString{String: avatarURL, Valid: true}
			}
			return nil
		}
	}
	return nil
}

func (r *postgresRepo) StoreRefreshToken(ctx context.Context, userID, tokenID, rawToken string, expiresAt time.Time) error {
	tHash := hashToken(rawToken)

	if r.db != nil && r.db.SQL != nil {
		query := `
			INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked, created_at)
			VALUES ($1, $2, $3, $4, FALSE, NOW())
		`
		_, err := r.db.SQL.ExecContext(ctx, query, tokenID, userID, tHash, expiresAt)
		if err == nil {
			return nil
		}
	}

	r.memLock.Lock()
	defer r.memLock.Unlock()

	r.memRefresh[tHash] = &RefreshTokenRecord{
		ID:        tokenID,
		UserID:    userID,
		TokenHash: tHash,
		ExpiresAt: expiresAt,
		Revoked:   false,
		CreatedAt: time.Now(),
	}
	return nil
}

func (r *postgresRepo) GetRefreshToken(ctx context.Context, rawToken string) (*RefreshTokenRecord, error) {
	tHash := hashToken(rawToken)

	if r.db != nil && r.db.SQL != nil {
		query := `
			SELECT id, user_id, token_hash, expires_at, revoked, created_at
			FROM refresh_tokens
			WHERE token_hash = $1
		`
		rec := &RefreshTokenRecord{}
		err := r.db.SQL.QueryRowContext(ctx, query, tHash).Scan(
			&rec.ID, &rec.UserID, &rec.TokenHash, &rec.ExpiresAt, &rec.Revoked, &rec.CreatedAt,
		)
		if err == nil {
			return rec, nil
		}
	}

	r.memLock.RLock()
	defer r.memLock.RUnlock()

	rec, exists := r.memRefresh[tHash]
	if !exists {
		return nil, errors.New("refresh token not found")
	}
	return rec, nil
}

func (r *postgresRepo) RevokeRefreshToken(ctx context.Context, rawToken string) error {
	tHash := hashToken(rawToken)

	if r.db != nil && r.db.SQL != nil {
		query := `UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`
		_, _ = r.db.SQL.ExecContext(ctx, query, tHash)
	}

	r.memLock.Lock()
	defer r.memLock.Unlock()

	if rec, exists := r.memRefresh[tHash]; exists {
		rec.Revoked = true
	}
	return nil
}

func (r *postgresRepo) SetResetToken(ctx context.Context, email string, token string, expiresAt time.Time) error {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	if r.db != nil && r.db.SQL != nil {
		query := `
			UPDATE users
			SET reset_token = $2, reset_token_expires_at = $3, updated_at = NOW()
			WHERE LOWER(email) = LOWER($1) OR (official_email IS NOT NULL AND LOWER(official_email) = LOWER($1))
		`
		res, err := r.db.SQL.ExecContext(ctx, query, cleanEmail, token, expiresAt)
		if err == nil {
			if rows, _ := res.RowsAffected(); rows > 0 {
				return nil
			}
		}
	}

	r.memLock.Lock()
	defer r.memLock.Unlock()

	if _, exists := r.memUsers[cleanEmail]; exists {
		return nil
	}
	return errors.New("user not found")
}

func (r *postgresRepo) VerifyAndResetPassword(ctx context.Context, email string, token string, newPasswordHash string) error {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	cleanToken := strings.TrimSpace(token)

	if cleanEmail != "" {
		if r.db != nil && r.db.SQL != nil {
			query := `
				UPDATE users
				SET password_hash = $3, reset_token = NULL, reset_token_expires_at = NULL, updated_at = NOW()
				WHERE (LOWER(email) = LOWER($1) OR (official_email IS NOT NULL AND LOWER(official_email) = LOWER($1))) 
				  AND reset_token = $2 
				  AND reset_token_expires_at > NOW()
			`
			res, err := r.db.SQL.ExecContext(ctx, query, cleanEmail, cleanToken, newPasswordHash)
			if err == nil {
				rows, _ := res.RowsAffected()
				if rows > 0 {
					return nil
				}
			}
		}
	}

	return r.VerifyAndResetPasswordByToken(ctx, cleanToken, newPasswordHash)
}

func (r *postgresRepo) VerifyAndResetPasswordByToken(ctx context.Context, token string, newPasswordHash string) error {
	cleanToken := strings.TrimSpace(token)
	if cleanToken == "" {
		return errors.New("reset token is required")
	}

	if r.db != nil && r.db.SQL != nil {
		query := `
			UPDATE users
			SET password_hash = $2, reset_token = NULL, reset_token_expires_at = NULL, updated_at = NOW()
			WHERE reset_token = $1 AND reset_token_expires_at > NOW()
		`
		res, err := r.db.SQL.ExecContext(ctx, query, cleanToken, newPasswordHash)
		if err == nil {
			rows, _ := res.RowsAffected()
			if rows > 0 {
				return nil
			}
		}
	}

	return errors.New("invalid or expired password reset link")
}
