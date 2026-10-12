package middleware

import (
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// clientBucket tracks request counts within a fixed/sliding time window.
type clientBucket struct {
	windowStart time.Time
	count       int
}

// RateLimiter manages rate limits per client identifier (IP, Email, or Combined key).
type RateLimiter struct {
	mu            sync.RWMutex
	buckets       map[string]*clientBucket
	maxRequests   int
	window        time.Duration
	keyExtractor  func(r *http.Request) string
	trustedProxies []string
	stopCh        chan struct{}
}

// Option configuration function for RateLimiter.
type RateLimiterOption func(*RateLimiter)

// WithKeyExtractor allows rate limiting by custom keys (e.g., IP + Email address).
func WithKeyExtractor(fn func(r *http.Request) string) RateLimiterOption {
	return func(rl *RateLimiter) {
		rl.keyExtractor = fn
	}
}

// WithTrustedProxies sets trusted reverse proxy IPs to prevent X-Forwarded-For spoofing.
func WithTrustedProxies(proxies []string) RateLimiterOption {
	return func(rl *RateLimiter) {
		rl.trustedProxies = proxies
	}
}

// NewRateLimiter initializes a rate limiter instance with background cleanup.
func NewRateLimiter(maxRequests int, window time.Duration, opts ...RateLimiterOption) *RateLimiter {
	rl := &RateLimiter{
		buckets:     make(map[string]*clientBucket),
		maxRequests: maxRequests,
		window:      window,
		stopCh:      make(chan struct{}),
	}

	for _, opt := range opts {
		opt(rl)
	}

	if rl.keyExtractor == nil {
		rl.keyExtractor = rl.defaultIPExtractor
	}

	go rl.startCleanupRoutine()
	return rl
}

// Stop terminates the background cleanup goroutine cleanly during server shutdown.
func (rl *RateLimiter) Stop() {
	close(rl.stopCh)
}

func (rl *RateLimiter) startCleanupRoutine() {
	// Cleanup interval set to window duration for optimal memory reclamation
	cleanupInterval := rl.window
	if cleanupInterval < 10*time.Second {
		cleanupInterval = 10 * time.Second
	}
	ticker := time.NewTicker(cleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			rl.mu.Lock()
			now := time.Now()
			for key, bucket := range rl.buckets {
				if now.Sub(bucket.windowStart) > rl.window {
					delete(rl.buckets, key)
				}
			}
			rl.mu.Unlock()
		case <-rl.stopCh:
			return
		}
	}
}

// defaultIPExtractor extracts client IP, validating X-Forwarded-For against trusted proxies.
func (rl *RateLimiter) defaultIPExtractor(r *http.Request) string {
	remoteIP, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		remoteIP = r.RemoteAddr
	}

	// X-Forwarded-For header processing: trust only if RemoteAddr is in trustedProxies
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" && rl.isTrustedProxy(remoteIP) {
		parts := strings.Split(forwarded, ",")
		return strings.TrimSpace(parts[0])
	}

	return remoteIP
}

func (rl *RateLimiter) isTrustedProxy(ip string) bool {
	if len(rl.trustedProxies) == 0 {
		return false
	}
	for _, trusted := range rl.trustedProxies {
		if trusted == ip || trusted == "*" {
			return true
		}
	}
	return false
}

// Middleware enforces rate limits and returns standard RFC 6585 headers (Retry-After, X-RateLimit-*).
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := rl.keyExtractor(r)
		now := time.Now()

		rl.mu.Lock()
		bucket, exists := rl.buckets[key]

		// Reset window if client doesn't exist or window expired
		if !exists || now.Sub(bucket.windowStart) >= rl.window {
			bucket = &clientBucket{
				windowStart: now,
				count:       1,
			}
			rl.buckets[key] = bucket
		} else {
			bucket.count++
		}

		currentCount := bucket.count
		windowStart := bucket.windowStart
		rl.mu.Unlock()

		resetTime := windowStart.Add(rl.window)
		remaining := rl.maxRequests - currentCount
		if remaining < 0 {
			remaining = 0
		}
		retryAfterSec := int(time.Until(resetTime).Seconds()) + 1
		if retryAfterSec < 1 {
			retryAfterSec = 1
		}

		// Standard RFC 6585 & RateLimit Response Headers
		w.Header().Set("X-RateLimit-Limit", strconv.Itoa(rl.maxRequests))
		w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
		w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(resetTime.Unix(), 10))

		if currentCount > rl.maxRequests {
			w.Header().Set("Retry-After", strconv.Itoa(retryAfterSec))
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write(fmt.Appendf(nil, `{"error":"Too Many Requests","message":"Rate limit exceeded. Please try again after %d seconds."}`, retryAfterSec))
			return
		}

		next.ServeHTTP(w, r)
	})
}
