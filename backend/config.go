package main

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Config holds all runtime settings. Values come from environment variables,
// optionally loaded from backend/.env (see .env.example).
type Config struct {
	Port      string
	MongoURI  string
	MongoDB   string
	JWTSecret []byte
	JWTTTL    time.Duration
	StaticDir string
}

func loadConfig() Config {
	loadDotEnv(".env")

	cfg := Config{
		Port:      getenv("PORT", "8080"),
		MongoURI:  getenv("MONGODB_URI", "mongodb://localhost:27017"),
		MongoDB:   getenv("MONGODB_DB", "prodtrack"),
		StaticDir: getenv("STATIC_DIR", filepath.Join("..", "dist")),
		JWTTTL:    7 * 24 * time.Hour,
	}

	if ttl := os.Getenv("JWT_TTL_HOURS"); ttl != "" {
		if d, err := time.ParseDuration(ttl + "h"); err == nil && d > 0 {
			cfg.JWTTTL = d
		}
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		// Development fallback: random per start. Tokens stop working after a restart.
		buf := make([]byte, 32)
		_, _ = rand.Read(buf)
		secret = hex.EncodeToString(buf)
		log.Println("WARNING: JWT_SECRET is not set; using a random secret (users must log in again after each restart).")
	} else if len(secret) < 32 {
		log.Println("WARNING: JWT_SECRET is shorter than 32 characters; use a long random value in production.")
	}
	cfg.JWTSecret = []byte(secret)
	return cfg
}

func getenv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

// loadDotEnv reads KEY=VALUE lines from a file into the environment.
// Variables already set in the real environment always win.
func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(strings.TrimPrefix(key, "export "))
		value = strings.TrimSpace(value)
		if len(value) >= 2 && (value[0] == '"' || value[0] == '\'') && value[len(value)-1] == value[0] {
			value = value[1 : len(value)-1]
		}
		if _, exists := os.LookupEnv(key); !exists {
			os.Setenv(key, value)
		}
	}
}
