package middleware

import (
	"context"
	"net/http"
	"strings"

	"backend/pkg/jwt"
	"backend/pkg/response"
)

type contextKey string

const (
	UserIDKey       contextKey = "userID"
	UserEmailKey    contextKey = "userEmail"
	UserRoleKey     contextKey = "userRole"
	DepartmentIDKey contextKey = "departmentID"
)

func AuthMiddleware(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				response.Error(w, http.StatusUnauthorized, "Missing Authorization header")
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				response.Error(w, http.StatusUnauthorized, "Invalid Authorization header format")
				return
			}

			tokenString := parts[1]
			claims, err := jwt.ValidateToken(tokenString, secret)
			if err != nil {
				response.Error(w, http.StatusUnauthorized, "Invalid or expired token")
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			ctx = context.WithValue(ctx, UserEmailKey, claims.Email)
			ctx = context.WithValue(ctx, UserRoleKey, claims.Role)
			ctx = context.WithValue(ctx, DepartmentIDKey, claims.DepartmentID)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func OptionalAuthMiddleware(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader != "" {
				parts := strings.Split(authHeader, " ")
				if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
					tokenString := parts[1]
					claims, err := jwt.ValidateToken(tokenString, secret)
					if err == nil && claims != nil {
						ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
						ctx = context.WithValue(ctx, UserEmailKey, claims.Email)
						ctx = context.WithValue(ctx, UserRoleKey, claims.Role)
						ctx = context.WithValue(ctx, DepartmentIDKey, claims.DepartmentID)
						r = r.WithContext(ctx)
					}
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			roleVal := r.Context().Value(UserRoleKey)
			if roleVal == nil {
				response.Error(w, http.StatusUnauthorized, "Unauthorized")
				return
			}

			userRole, ok := roleVal.(string)
			if !ok {
				response.Error(w, http.StatusForbidden, "Forbidden: Invalid user role")
				return
			}

			permitted := false
			for _, r := range allowedRoles {
				if userRole == r {
					permitted = true
					break
				}
			}

			if !permitted {
				response.Error(w, http.StatusForbidden, "Forbidden: Insufficient privileges")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
