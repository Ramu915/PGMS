package departments

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"backend/internal/database"
)

type DepartmentRecord struct {
	ID          string
	Name        string
	Code        sql.NullString
	Description sql.NullString
	CreatedAt   time.Time
}

type Repository interface {
	GetAll(ctx context.Context) ([]*DepartmentRecord, error)
	GetByID(ctx context.Context, id string) (*DepartmentRecord, error)
	Create(ctx context.Context, dept *DepartmentRecord) error
	Delete(ctx context.Context, id string) error
}

type postgresRepo struct {
	db      *database.DB
	memLock sync.RWMutex
	memData map[string]*DepartmentRecord
}

func NewRepository(db *database.DB) Repository {
	repo := &postgresRepo{
		db:      db,
		memData: make(map[string]*DepartmentRecord),
	}

	// Seed default departments in memory & PostgreSQL database
	defaultDepts := []*DepartmentRecord{
		{ID: "11111111-0000-0000-0000-000000000001", Name: "Public Works (Roads)", Code: sql.NullString{String: "PWD", Valid: true}, Description: sql.NullString{String: "Road maintenance, potholes, and traffic infrastructure", Valid: true}, CreatedAt: time.Now()},
		{ID: "11111111-0000-0000-0000-000000000002", Name: "Water Supply & Sewerage", Code: sql.NullString{String: "WSS", Valid: true}, Description: sql.NullString{String: "Clean drinking water supply, pipeline leaks, and sewerage", Valid: true}, CreatedAt: time.Now()},
		{ID: "11111111-0000-0000-0000-000000000003", Name: "Electricity Board", Code: sql.NullString{String: "EB", Valid: true}, Description: sql.NullString{String: "Power supply, transformers, and streetlight maintenance", Valid: true}, CreatedAt: time.Now()},
		{ID: "11111111-0000-0000-0000-000000000004", Name: "Sanitation & Waste Management", Code: sql.NullString{String: "SWM", Valid: true}, Description: sql.NullString{String: "Garbage collection, street cleaning, and waste management", Valid: true}, CreatedAt: time.Now()},
		{ID: "11111111-0000-0000-0000-000000000005", Name: "Urban Drainage", Code: sql.NullString{String: "UD", Valid: true}, Description: sql.NullString{String: "Stormwater drains, flood control, and canal maintenance", Valid: true}, CreatedAt: time.Now()},
	}

	for _, d := range defaultDepts {
		repo.memData[d.ID] = d
	}

	if db != nil && db.SQL != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		for _, d := range defaultDepts {
			var code *string
			if d.Code.Valid && d.Code.String != "" {
				code = &d.Code.String
			}
			var desc *string
			if d.Description.Valid && d.Description.String != "" {
				desc = &d.Description.String
			}

			var dbID string
			err := db.SQL.QueryRowContext(ctx, `
				INSERT INTO departments (name, code, description, created_at)
				VALUES ($1, $2, $3, NOW())
				ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
				RETURNING id
			`, d.Name, code, desc).Scan(&dbID)

			if err == nil && dbID != "" {
				d.ID = dbID
				repo.memData[dbID] = d
			}
		}

		// Also populate memData with all existing rows from DB
		rows, err := db.SQL.QueryContext(ctx, `SELECT id, name, code, description, created_at FROM departments`)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				rec := &DepartmentRecord{}
				if err := rows.Scan(&rec.ID, &rec.Name, &rec.Code, &rec.Description, &rec.CreatedAt); err == nil {
					repo.memData[rec.ID] = rec
				}
			}
			_ = rows.Err()
		}
	}

	return repo
}

func (r *postgresRepo) GetAll(ctx context.Context) ([]*DepartmentRecord, error) {
	var results []*DepartmentRecord
	seenIDs := make(map[string]bool)
	seenNames := make(map[string]bool)

	if r.db != nil && r.db.SQL != nil {
		query := `SELECT id, name, code, description, created_at FROM departments ORDER BY name ASC`
		rows, err := r.db.SQL.QueryContext(ctx, query)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				d := &DepartmentRecord{}
				if err := rows.Scan(&d.ID, &d.Name, &d.Code, &d.Description, &d.CreatedAt); err == nil {
					nameKey := strings.ToLower(strings.TrimSpace(d.Name))
					if !seenNames[nameKey] && !seenIDs[d.ID] {
						results = append(results, d)
						seenIDs[d.ID] = true
						seenNames[nameKey] = true
					}
				}
			}
			_ = rows.Err()
		}
	}

	// Merge any in-memory defaults or custom entries not in DB
	r.memLock.RLock()
	for id, d := range r.memData {
		nameKey := strings.ToLower(strings.TrimSpace(d.Name))
		if !seenIDs[id] && !seenNames[nameKey] {
			results = append(results, d)
			seenIDs[id] = true
			seenNames[nameKey] = true
		}
	}
	r.memLock.RUnlock()

	return results, nil
}

func (r *postgresRepo) GetByID(ctx context.Context, id string) (*DepartmentRecord, error) {
	if r.db != nil && r.db.SQL != nil {
		query := `SELECT id, name, code, description, created_at FROM departments WHERE id = $1`
		d := &DepartmentRecord{}
		err := r.db.SQL.QueryRowContext(ctx, query, id).Scan(&d.ID, &d.Name, &d.Code, &d.Description, &d.CreatedAt)
		if err == nil {
			return d, nil
		}
	}

	r.memLock.RLock()
	defer r.memLock.RUnlock()

	d, exists := r.memData[id]
	if !exists {
		return nil, errors.New("department not found")
	}
	return d, nil
}

func (r *postgresRepo) Create(ctx context.Context, d *DepartmentRecord) error {
	if d.ID == "" {
		d.ID = fmt.Sprintf("dept-%d", time.Now().UnixNano())
	}
	d.CreatedAt = time.Now()

	if r.db != nil && r.db.SQL != nil {
		query := `
			INSERT INTO departments (name, code, description, created_at)
			VALUES ($1, $2, $3, NOW())
			RETURNING id, created_at
		`
		var code *string
		if d.Code.Valid && d.Code.String != "" {
			code = &d.Code.String
		}
		var desc *string
		if d.Description.Valid && d.Description.String != "" {
			desc = &d.Description.String
		}

		err := r.db.SQL.QueryRowContext(ctx, query, d.Name, code, desc).Scan(&d.ID, &d.CreatedAt)
		if err != nil {
			// Fallback: If department name already exists, fetch its ID
			var existingID string
			if queryErr := r.db.SQL.QueryRowContext(ctx, `SELECT id FROM departments WHERE LOWER(name) = LOWER($1)`, d.Name).Scan(&existingID); queryErr == nil {
				d.ID = existingID
			}
		}
	}

	r.memLock.Lock()
	r.memData[d.ID] = d
	r.memLock.Unlock()

	return nil
}

func (r *postgresRepo) Delete(ctx context.Context, id string) error {
	if r.db != nil && r.db.SQL != nil {
		query := `DELETE FROM departments WHERE id = $1`
		_, err := r.db.SQL.ExecContext(ctx, query, id)
		if err == nil {
			r.memLock.Lock()
			delete(r.memData, id)
			r.memLock.Unlock()
			return nil
		}
	}

	r.memLock.Lock()
	defer r.memLock.Unlock()

	delete(r.memData, id)
	return nil
}

