package main

import (
	"context"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

// ============================================================================
// ProdTrack API server
//   - MongoDB for storage            (db.go)
//   - JWT + bcrypt authentication    (auth.go)
//   - REST handlers under /api       (handlers.go)
//   - Serves the built React app from ../dist
// ============================================================================

func main() {
	cfg := loadConfig()

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	store, err := connectStore(ctx, cfg.MongoURI, cfg.MongoDB)
	cancel()
	if err != nil {
		log.Fatalf("Could not connect to MongoDB.\n%s\n(details: %v)", connectionHint(err), err)
	}
	defer store.Close()
	log.Printf("Connected to MongoDB database %q (transactions: %v)", cfg.MongoDB, store.txn)

	app := &App{store: store, tokens: TokenService{secret: cfg.JWTSecret, ttl: cfg.JWTTTL}}

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           newRouter(app, cfg.StaticDir),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		log.Printf("Server started at http://localhost:%s  (API under /api)", cfg.Port)
		if hasFrontend(cfg.StaticDir) {
			log.Printf("Serving frontend from %s", cfg.StaticDir)
		} else {
			log.Printf("No frontend build at %s - use `npm run dev` (port 5173) or `npm run build`", cfg.StaticDir)
		}
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Graceful shutdown on Ctrl+C / SIGTERM
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	// When started by the Vite dev server, exit as soon as the dev server goes
	// away (its end of our stdin pipe closes), even if it was force-killed.
	if os.Getenv("PRODTRACK_EXIT_WITH_PARENT") == "1" {
		go func() {
			_, _ = io.Copy(io.Discard, os.Stdin)
			stop <- os.Interrupt
		}()
	}
	<-stop
	log.Println("Shutting down...")
	ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

func newRouter(app *App, staticDir string) http.Handler {
	api := http.NewServeMux()
	owner, anyone := []string{"owner"}, []string{"owner", "staff"}
	auth := app.requireAuth

	api.HandleFunc("GET /health", app.health)
	api.HandleFunc("POST /auth/signup", app.signup)
	api.HandleFunc("POST /auth/login", app.login)
	api.HandleFunc("GET /auth/me", auth(app.me))
	api.HandleFunc("PUT /auth/profile", auth(app.updateProfile))

	api.HandleFunc("GET /products", auth(app.listProducts))
	api.HandleFunc("POST /products", auth(app.createProduct, anyone...))
	api.HandleFunc("PUT /products/{id}", auth(app.updateProduct, anyone...))
	api.HandleFunc("DELETE /products/{id}", auth(app.deleteProduct, anyone...))

	api.HandleFunc("POST /stock", auth(app.updateStock, anyone...))
	api.HandleFunc("GET /history", auth(app.listHistory))

	api.HandleFunc("GET /staff", auth(app.listStaff, owner...))
	api.HandleFunc("POST /staff", auth(app.createStaff, owner...))
	api.HandleFunc("DELETE /staff/{id}", auth(app.deleteStaff, owner...))

	api.HandleFunc("GET /billing", auth(app.listBills))
	api.HandleFunc("POST /billing", auth(app.createBill, anyone...))
	api.HandleFunc("GET /analytics", auth(app.analytics, owner...))
	api.HandleFunc("GET /logbook", auth(app.logbook, owner...))

	api.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		sendError(w, http.StatusNotFound, "Not found")
	})

	root := http.NewServeMux()
	root.Handle("/api/", withCORS(http.StripPrefix("/api", api)))
	root.Handle("/", frontendHandler(staticDir))
	return withSecurityHeaders(root)
}

// withCORS allows a separately hosted frontend (e.g. Vercel) to call the API.
// Auth uses bearer tokens, not cookies, so no credentials are shared.
func withCORS(next http.Handler) http.Handler {
	origin := getenv("CORS_ORIGIN", "*")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Max-Age", "600")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func withSecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("X-Frame-Options", "DENY")
		next.ServeHTTP(w, r)
	})
}

// hasFrontend reports whether a built frontend (index.html) exists in dir.
func hasFrontend(dir string) bool {
	_, err := os.Stat(filepath.Join(dir, "index.html"))
	return err == nil
}

// frontendHandler serves the built React app. Unknown paths fall back to
// index.html so React Router can handle them (e.g. /dashboard/stock).
func frontendHandler(staticDir string) http.Handler {
	fileServer := http.FileServer(http.Dir(staticDir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !hasFrontend(staticDir) {
			sendJSON(w, http.StatusOK, map[string]string{"message": "ProdTrack API is running. Frontend not built yet (npm run build)."})
			return
		}
		cleanPath := filepath.Clean(filepath.FromSlash(strings.TrimPrefix(r.URL.Path, "/")))
		if strings.HasPrefix(cleanPath, "..") {
			http.NotFound(w, r)
			return
		}
		if info, err := os.Stat(filepath.Join(staticDir, cleanPath)); err == nil && !info.IsDir() {
			if strings.HasPrefix(r.URL.Path, "/assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable") // hashed filenames
			}
			fileServer.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
	})
}

// connectionHint turns common MongoDB connection errors into a fix the user can act on.
func connectionHint(err error) string {
	msg := err.Error()
	switch {
	case strings.Contains(msg, "tls: internal error"), strings.Contains(msg, "connection reset"), strings.Contains(msg, "ReplicaSetNoPrimary"):
		return "Atlas refused the connection. Your IP address is probably not allowed: open MongoDB Atlas > Network Access > Add IP Address > Add Current IP Address, wait about a minute, then restart."
	case strings.Contains(msg, "bad auth"), strings.Contains(msg, "Authentication failed"):
		return "Wrong database user name or password in MONGODB_URI (backend/.env). Check Atlas > Database Access."
	case strings.Contains(msg, "no such host"), strings.Contains(msg, "lookup"):
		return "The cluster address in MONGODB_URI can't be found. Check your internet connection and the connection string."
	case strings.Contains(msg, "connection refused"):
		return "Nothing is listening at the MongoDB address. If you use a local MongoDB, make sure it is running."
	}
	return "Check MONGODB_URI in backend/.env (see backend/.env.example) and your internet connection."
}
