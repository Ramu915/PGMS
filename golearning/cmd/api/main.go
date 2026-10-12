package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	_ "github.com/lib/pq"

	"golearning/handler"
	"golearning/middelware"
	"golearning/repository"
	"golearning/service"
)

func main() {
	dbUser := "postgres"
	dbPass := "Ramu@915"
	dbHost := "localhost"
	dbPort := "5432"
	dbName := "golearning_db"

	// 1. Ensure the dedicated 'golearning_db' database exists
	if err := ensureDatabaseExists(dbUser, dbPass, dbHost, dbPort, dbName); err != nil {
		log.Fatal("Error ensuring database exists:", err)
	}

	// 2. Open connection to dedicated 'golearning_db' database
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", dbHost, dbPort, dbUser, dbPass, dbName)
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Error opening database driver:", err)
	}
	defer db.Close()

	// 3. Ping database
	if err := db.Ping(); err != nil {
		log.Fatal("Database ping failed:", err)
	}
	log.Printf("Successfully connected to PostgreSQL database '%s'!\n", dbName)

	// 4. Run all .up.sql migrations from migrations directory
	if err := runMigrations(db); err != nil {
		log.Fatal("Migration failed:", err)
	}

	// 5. Initialize layers: Repository -> Service -> Handler
	userRepo := repository.NewUserDB(db)
	userService := service.NewUserService(userRepo)
	userHandler := handler.NewUserHandler(userService)

	// 6. Register HTTP Routes
	mux := http.NewServeMux()

	mux.HandleFunc("GET /users", userHandler.GetAllUsers)
	mux.HandleFunc("GET /users/{id}", userHandler.GetUserByID)
	mux.HandleFunc("POST /users", userHandler.CreateUser)
	mux.HandleFunc("PUT /users/{id}", userHandler.UpdateUser)
	mux.HandleFunc("DELETE /users/{id}", userHandler.DeleteUser)

	logger := middelware.UserMiddelWare(mux)

	log.Println("Server running on http://localhost:8081")
	if err := http.ListenAndServe(":8081", logger); err != nil {
		log.Fatal("Server startup failed:", err)
	}
}

// ensureDatabaseExists connects to default postgres database and creates dbName if it doesn't exist yet
func ensureDatabaseExists(user, password, host, port, dbName string) error {
	sysConn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=postgres sslmode=disable", host, port, user, password)
	db, err := sql.Open("postgres", sysConn)
	if err != nil {
		return err
	}
	defer db.Close()

	var exists bool
	query := fmt.Sprintf("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = '%s')", dbName)
	if err := db.QueryRow(query).Scan(&exists); err != nil {
		return err
	}

	if !exists {
		if _, err := db.Exec(fmt.Sprintf("CREATE DATABASE %s", dbName)); err != nil {
			return err
		}
		log.Printf("Created database '%s' successfully!\n", dbName)
	}
	return nil
}

// runMigrations reads and executes all *.up.sql migration files in the migrations directory
func runMigrations(db *sql.DB) error {
	dirsToTry := []string{"migrations", "../../migrations", "../migrations"}
	var migrationDir string
	for _, dir := range dirsToTry {
		if info, err := os.Stat(dir); err == nil && info.IsDir() {
			migrationDir = dir
			break
		}
	}

	if migrationDir == "" {
		return fmt.Errorf("migrations directory not found")
	}

	entries, err := os.ReadDir(migrationDir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".up.sql") {
			filePath := filepath.Join(migrationDir, entry.Name())
			content, err := os.ReadFile(filePath)
			if err != nil {
				return fmt.Errorf("reading %s failed: %w", entry.Name(), err)
			}

			if _, err := db.Exec(string(content)); err != nil {
				return fmt.Errorf("executing %s failed: %w", entry.Name(), err)
			}
			log.Printf("Migration executed: %s\n", entry.Name())
		}
	}
	return nil
}
