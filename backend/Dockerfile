# Build Stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Install git and ca-certificates
RUN apk add --no-cache git ca-certificates

# Copy go modules manifests
COPY go.mod go.sum ./
RUN go mod download

# Copy backend source code and migrations
COPY . .

# Build statically linked binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /pgms-api ./cmd/api

# Runtime Stage
FROM alpine:3.20

WORKDIR /app

RUN apk --no-cache add ca-certificates tzdata

# Copy binary and assets from builder
COPY --from=builder /pgms-api /app/pgms-api
COPY --from=builder /app/migrations /app/migrations
COPY --from=builder /app/templates /app/templates

# Ensure upload directory exists and has sample assets
COPY --from=builder /app/uploads /app/uploads
RUN mkdir -p /app/uploads

EXPOSE 8080

CMD ["/app/pgms-api"]
