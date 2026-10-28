package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"backend/internal/config"
	"backend/internal/database"
	appMiddleware "backend/internal/middleware"
	"backend/internal/modules/auth"
	"backend/internal/modules/departments"
	"backend/internal/modules/districts"
	"backend/internal/modules/grievances"
	"backend/pkg/mailer"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
)

func main() {
	log.Println("Starting PGMS Go Modular Monolith Backend...")

	cfg := config.Load()
	log.Printf("Loaded configuration for environment: %s on port: %s\n", cfg.Env, cfg.Port)

	_ = os.MkdirAll("./uploads", 0755)

	// Database connection pool
	db, err := database.Connect(
		cfg.DatabaseURL,
		cfg.DBHost,
		cfg.DBPort,
		cfg.DBUser,
		cfg.DBPassword,
		cfg.DBName,
		cfg.DBSSLMode,
	)
	if err != nil {
		log.Printf("Database connection warning: Could not connect to PostgreSQL: %v\n", err)
	} else {
		log.Printf("PostgreSQL database connection pool initialized successfully (%s)\n", cfg.DBName)
		defer db.SQL.Close()
	}

	// Root Router setup
	r := chi.NewRouter()

	// Global Middlewares
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(appMiddleware.CORS(cfg.AllowedOrigin))

	// Root welcome endpoint
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok","service":"PGMS Go REST API","endpoints":"/api/v1"}`))
	})

	// Base API router
	r.Route("/api/v1", func(api chi.Router) {
		// Health check
		api.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"ok","service":"PGMS Go Backend","version":"1.0.0"}`))
		})

		authMiddleware := appMiddleware.AuthMiddleware(cfg.JWTSecret)
		optionalAuthMiddleware := appMiddleware.OptionalAuthMiddleware(cfg.JWTSecret)

		// Auth Module Wiring
		smtpCfg := mailer.SMTPConfig{
			Host:        cfg.SMTPHost,
			Port:        cfg.SMTPPort,
			Email:       cfg.SMTPEmail,
			Password:    cfg.SMTPPassword,
			FromEmail:   cfg.FromEmail,
			FrontendURL: cfg.FrontendURL,
		}
		authRepo := auth.NewRepository(db)
		authService := auth.NewService(authRepo, cfg.JWTSecret, cfg.GoogleClientID, smtpCfg)
		authHandler := auth.NewHandler(authService)
		authHandler.RegisterRoutes(api, authMiddleware)

		// Departments Module Wiring
		deptRepo := departments.NewRepository(db)
		deptService := departments.NewService(deptRepo)
		deptHandler := departments.NewHandler(deptService)
		deptHandler.RegisterRoutes(api, authMiddleware)

		// Districts & Taluks Module Wiring
		districtRepo := districts.NewRepository(db)
		districtService := districts.NewService(districtRepo, smtpCfg)
		districtHandler := districts.NewHandler(districtService)
		districtHandler.RegisterRoutes(api, authMiddleware)

		// Grievances Module Wiring
		grievanceRepo := grievances.NewRepository(db)
		grievanceService := grievances.NewService(grievanceRepo, smtpCfg)
		grievanceHandler := grievances.NewHandler(grievanceService)
		grievanceHandler.RegisterRoutes(api, authMiddleware, optionalAuthMiddleware)

		// Serve uploads statically
		workDir, _ := os.Getwd()
		filesDir := http.Dir(filepath.Join(workDir, "uploads"))
		api.Handle("/uploads/*", http.StripPrefix("/api/v1/uploads/", http.FileServer(filesDir)))
	})

	serverAddr := fmt.Sprintf(":%s", cfg.Port)
	srv := &http.Server{
		Addr:         serverAddr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Server run context
	serverCtx, serverStopCtx := context.WithCancel(context.Background())

	// Listen for syscall signals for graceful shutdown
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sig
		log.Println("Shutting down server gracefully...")

		shutdownCtx, cancel := context.WithTimeout(serverCtx, 30*time.Second)
		defer cancel()

		go func() {
			<-shutdownCtx.Done()
			if shutdownCtx.Err() == context.DeadlineExceeded {
				log.Fatal("Graceful shutdown timed out.. forcing exit.")
			}
		}()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Fatalf("Server shutdown error: %v", err)
		}
		serverStopCtx()
	}()

	log.Printf("PGMS Go REST API Server is listening on http://localhost%s/api/v1\n", serverAddr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("HTTP server failed: %v", err)
	}

	<-serverCtx.Done()
	log.Println("Server exited cleanly.")
}
