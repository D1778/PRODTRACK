package main

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"golang.org/x/crypto/bcrypt"
)

// ============================================================================
// PASSWORDS (bcrypt)
// ============================================================================

const bcryptCost = 12

func hashPassword(plain string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), bcryptCost)
	return string(hash), err
}

func checkPassword(hash, plain string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}

// dummyHash lets failed logins for unknown emails take as long as real ones,
// so attackers can't discover which emails are registered by timing.
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("prodtrack-timing-guard"), bcryptCost)

// ============================================================================
// TOKENS (JWT, HS256)
// ============================================================================

type Claims struct {
	BusinessID string `json:"bid"`
	Role       string `json:"role"`
	jwt.RegisteredClaims
}

type TokenService struct {
	secret []byte
	ttl    time.Duration
}

func (t TokenService) Issue(u User) (string, error) {
	now := time.Now()
	claims := Claims{
		BusinessID: u.BusinessID.Hex(),
		Role:       u.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   u.ID.Hex(),
			Issuer:    "prodtrack",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(t.ttl)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(t.secret)
}

func (t TokenService) Parse(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(tokenStr, claims, func(*jwt.Token) (any, error) {
		return t.secret, nil
	},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer("prodtrack"),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return nil, err
	}
	return claims, nil
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

type ctxKey struct{}

// authUser is the logged-in user, loaded fresh from MongoDB on every request,
// so removed staff lose access immediately even if their token hasn't expired.
func authUser(r *http.Request) User {
	u, _ := r.Context().Value(ctxKey{}).(User)
	return u
}

// requireAuth verifies the "Authorization: Bearer <jwt>" header.
// roles optionally restricts the route (e.g. only "owner").
func (a *App) requireAuth(next http.HandlerFunc, roles ...string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		tokenStr, ok := strings.CutPrefix(header, "Bearer ")
		if !ok || tokenStr == "" {
			sendError(w, http.StatusUnauthorized, "Please log in to continue")
			return
		}
		claims, err := a.tokens.Parse(tokenStr)
		if err != nil {
			sendError(w, http.StatusUnauthorized, "Your session has expired. Please log in again")
			return
		}
		userID, err := bson.ObjectIDFromHex(claims.Subject)
		if err != nil {
			sendError(w, http.StatusUnauthorized, "Invalid session")
			return
		}

		var user User
		if err := a.store.users.FindOne(r.Context(), bson.M{"_id": userID}).Decode(&user); err != nil {
			if errors.Is(err, mongo.ErrNoDocuments) {
				sendError(w, http.StatusUnauthorized, "This account no longer exists")
				return
			}
			sendError(w, http.StatusInternalServerError, "Database error")
			return
		}

		if len(roles) > 0 && !contains(roles, user.Role) {
			sendError(w, http.StatusForbidden, "You don't have permission to do that")
			return
		}

		next(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, user)))
	}
}

func contains(list []string, v string) bool {
	for _, item := range list {
		if item == v {
			return true
		}
	}
	return false
}
