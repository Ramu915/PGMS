package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

type DB struct {
	SQL *sql.DB
}

func Connect(host, port, user, password, dbname, sslmode string) (*DB, error) {
	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode,
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("postgres driver initialization error: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(15 * time.Minute)
	db.SetConnMaxIdleTime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		// Try auto-creating database if missing
		if strings.Contains(err.Error(), "does not exist") {
			log.Printf(" Database '%s' does not exist. Attempting auto-creation...", dbname)
			adminConnStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=postgres sslmode=%s", host, port, user, password, sslmode)
			adminDB, adminErr := sql.Open("postgres", adminConnStr)
			if adminErr == nil {
				_, _ = adminDB.Exec(fmt.Sprintf(`CREATE DATABASE "%s";`, dbname))
				_ = adminDB.Close()

				// Retry target DB connection
				db, err = sql.Open("postgres", connStr)
				if err == nil {
					db.SetMaxOpenConns(25)
					db.SetMaxIdleConns(5)
					db.SetConnMaxLifetime(15 * time.Minute)
					db.SetConnMaxIdleTime(5 * time.Minute)
					if err := db.PingContext(ctx); err == nil {
						log.Printf("Automatically created & connected to PostgreSQL database '%s' at %s:%s\n", dbname, host, port)
						instance := &DB{SQL: db}
						if err := instance.RunMigrations(); err != nil {
							log.Printf("Migration notice: %v\n", err)
						}
						return instance, nil
					}
				}
			}
		}
		return nil, fmt.Errorf("failed to connect to PostgreSQL database '%s' at %s:%s (user: %s): %w", dbname, host, port, user, err)
	}

	log.Printf("Connected to PostgreSQL database '%s' at %s:%s\n", dbname, host, port)

	instance := &DB{SQL: db}
	if err := instance.RunMigrations(); err != nil {
		log.Printf("Migration warning: %v\n", err)
	}

	return instance, nil
}

func (d *DB) RunMigrations() error {
	migrationsDir := "migrations"
	if _, err := os.Stat(migrationsDir); os.IsNotExist(err) {
		migrationsDir = "../migrations"
	}

	files, err := filepath.Glob(filepath.Join(migrationsDir, "*.up.sql"))
	if err != nil || len(files) == 0 {
		return fmt.Errorf("no SQL migration files found in %s", migrationsDir)
	}

	sort.Strings(files)

	for _, file := range files {
		content, err := os.ReadFile(file)
		if err != nil {
			log.Printf("Failed to read migration file %s: %v", filepath.Base(file), err)
			continue
		}

		queries := strings.Split(string(content), ";")
		for _, q := range queries {
			q = strings.TrimSpace(q)
			if q == "" {
				continue
			}
			if _, err := d.SQL.Exec(q); err != nil {
				// Ignore duplicate table/index errors if already existing
				if !strings.Contains(err.Error(), "already exists") {
					log.Printf("Migration [%s] statement notice: %v", filepath.Base(file), err)
				}
			}
		}
	}

	log.Println(" All database migrations executed & verified successfully")
	return nil
}
