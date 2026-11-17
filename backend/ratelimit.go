package main

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// rateLimiter allows at most `limit` requests per `window` for each client IP.
// It protects the public auth routes (login, signup, codes) from password
// guessing, code guessing and email flooding. State is in memory, so with
// several server instances each one counts on its own.
type rateLimiter struct {
	mu         sync.Mutex
	limit      int
	window     time.Duration
	trustProxy bool // read the client IP from X-Forwarded-For (set behind Render, Nginx...)
	hits       map[string]*rateWindow
}

type rateWindow struct {
	start time.Time
	count int
}

func newRateLimiter(limit int, window time.Duration, trustProxy bool) *rateLimiter {
	return &rateLimiter{limit: limit, window: window, trustProxy: trustProxy, hits: map[string]*rateWindow{}}
}

// allow records a request from key and reports whether it is within the limit.
func (l *rateLimiter) allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if len(l.hits) > 10_000 { // drop finished windows so memory stays bounded
		for k, w := range l.hits {
			if now.Sub(w.start) >= l.window {
				delete(l.hits, k)
			}
		}
	}
	w, ok := l.hits[key]
	if !ok || now.Sub(w.start) >= l.window {
		l.hits[key] = &rateWindow{start: now, count: 1}
		return true
	}
	w.count++
	return w.count <= l.limit
}

// clientIP is the address the request came from. Behind a reverse proxy the
// proxy's own address is RemoteAddr, so the last X-Forwarded-For entry (the
// one the proxy added; earlier ones can be forged by the client) is used.
func (l *rateLimiter) clientIP(r *http.Request) string {
	if l.trustProxy {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			parts := strings.Split(xff, ",")
			if ip := strings.TrimSpace(parts[len(parts)-1]); ip != "" {
				return ip
			}
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// wrap limits next. A nil limiter (tests, or disabled) lets everything through.
func (l *rateLimiter) wrap(next http.HandlerFunc) http.HandlerFunc {
	if l == nil {
		return next
	}
	return func(w http.ResponseWriter, r *http.Request) {
		if !l.allow(l.clientIP(r), time.Now()) {
			w.Header().Set("Retry-After", "300")
			sendError(w, http.StatusTooManyRequests, "Too many attempts. Please wait a few minutes and try again")
			return
		}
		next(w, r)
	}
}
