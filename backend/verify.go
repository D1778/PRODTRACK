package main

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// Email verification: an account is created "unverified" and can't log in until
// the owner of the mailbox enters the 6-digit code we email to it.
const (
	codeTTL         = 10 * time.Minute
	resendCooldown  = time.Minute
	maxCodeAttempts = 5
)

func newCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// codeHash stores only a keyed hash of the code, never the code itself.
func (a *App) codeHash(email, code string) string {
	m := hmac.New(sha256.New, a.tokens.secret)
	m.Write([]byte(email + ":" + code))
	return hex.EncodeToString(m.Sum(nil))
}

// sendCode generates a fresh code for the user, stores its hash and emails it.
func (a *App) sendCode(ctx context.Context, u User) error {
	code, err := newCode()
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	_, err = a.store.users.UpdateByID(ctx, u.ID, bson.M{"$set": bson.M{
		"verifyCodeHash": a.codeHash(u.Email, code),
		"verifyExpires":  now.Add(codeTTL),
		"verifyAttempts": 0,
		"verifySentAt":   now,
	}})
	if err != nil {
		return err
	}
	subject, text, html := verificationEmail(u.Name, code)
	if err := a.mailer.Send(ctx, u.Email, subject, text, html); err != nil {
		// Allow an immediate retry since nothing was delivered.
		_, _ = a.store.users.UpdateByID(ctx, u.ID, bson.M{"$unset": bson.M{"verifySentAt": ""}})
		return err
	}
	return nil
}

func inCooldown(u User) bool {
	return !u.VerifySentAt.IsZero() && time.Since(u.VerifySentAt) < resendCooldown
}

func needsVerification(w http.ResponseWriter, status int, email, message string) {
	sendJSON(w, status, map[string]any{"message": message, "needsVerification": true, "email": email})
}

// POST /api/auth/verify  {email, code}
// Confirms the mailbox and logs the user in.
func (a *App) verifyEmail(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	email, _ := normalizeEmail(req.Email)
	code := strings.TrimSpace(req.Code)
	ctx := r.Context()

	// Count this attempt atomically, so parallel guesses can't exceed the limit.
	var user User
	err := a.store.users.FindOneAndUpdate(ctx,
		bson.M{"email": email, "unverified": true, "verifyAttempts": bson.M{"$lt": maxCodeAttempts}},
		bson.M{"$inc": bson.M{"verifyAttempts": 1}},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		if n, _ := a.store.users.CountDocuments(ctx, bson.M{"email": email, "unverified": true}); n > 0 {
			sendError(w, http.StatusTooManyRequests, "Too many incorrect attempts. Request a new code")
			return
		}
		sendError(w, http.StatusBadRequest, "That code isn't valid. Request a new one")
		return
	}
	if err != nil {
		serverError(w, "verify lookup", err)
		return
	}
	if user.VerifyCodeHash == "" || time.Now().After(user.VerifyExpires) {
		sendError(w, http.StatusBadRequest, "This code has expired. Request a new one")
		return
	}
	if !hmac.Equal([]byte(a.codeHash(email, code)), []byte(user.VerifyCodeHash)) {
		left := maxCodeAttempts - user.VerifyAttempts
		if left <= 0 {
			sendError(w, http.StatusTooManyRequests, "Too many incorrect attempts. Request a new code")
			return
		}
		sendError(w, http.StatusBadRequest, fmt.Sprintf("Incorrect code. %d attempt(s) left", left))
		return
	}

	if _, err := a.store.users.UpdateByID(ctx, user.ID, bson.M{"$unset": bson.M{
		"unverified": "", "verifyCodeHash": "", "verifyExpires": "", "verifyAttempts": "", "verifySentAt": "",
	}}); err != nil {
		serverError(w, "mark verified", err)
		return
	}
	user.Unverified = false
	log.Printf("Verified email: %s", email)
	a.authResponse(w, r, http.StatusOK, user, "Email verified. Welcome to ProdTrack!")
}

// POST /api/auth/forgot  {email}
// Emails a password-reset code to a verified account. The answer is always the
// same, so it can't be used to find out which emails are registered.
func (a *App) forgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	generic := map[string]string{"message": "If an account exists for that email, we've sent a 6-digit code to reset the password"}
	email, ok := normalizeEmail(req.Email)
	if !ok {
		sendJSON(w, http.StatusOK, generic)
		return
	}
	ctx := r.Context()
	var user User
	err := a.store.users.FindOne(ctx, bson.M{"email": email, "unverified": bson.M{"$ne": true}}).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		sendJSON(w, http.StatusOK, generic)
		return
	}
	if err != nil {
		serverError(w, "forgot lookup", err)
		return
	}
	if !user.ResetSentAt.IsZero() && time.Since(user.ResetSentAt) < resendCooldown {
		sendJSON(w, http.StatusOK, generic) // a code was just sent; stay quiet rather than reveal anything
		return
	}

	code, err := newCode()
	if err != nil {
		serverError(w, "reset code", err)
		return
	}
	now := time.Now().UTC()
	if _, err := a.store.users.UpdateByID(ctx, user.ID, bson.M{"$set": bson.M{
		"resetCodeHash": a.codeHash("reset:"+email, code),
		"resetExpires":  now.Add(codeTTL),
		"resetAttempts": 0,
		"resetSentAt":   now,
	}}); err != nil {
		serverError(w, "store reset code", err)
		return
	}
	subject, text, html := resetEmail(user.Name, code)
	if err := a.mailer.Send(ctx, email, subject, text, html); err != nil {
		log.Printf("ERROR send password reset email to %s: %v", email, err)
		_, _ = a.store.users.UpdateByID(ctx, user.ID, bson.M{"$unset": bson.M{"resetSentAt": ""}})
	}
	sendJSON(w, http.StatusOK, generic)
}

// POST /api/auth/reset  {email, code, newPassword}
// Sets a new password when the emailed code is right. Every earlier login stops working.
func (a *App) resetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email       string `json:"email"`
		Code        string `json:"code"`
		NewPassword string `json:"newPassword"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	if msg := validatePassword(req.NewPassword); msg != "" {
		sendError(w, http.StatusBadRequest, msg)
		return
	}
	email, _ := normalizeEmail(req.Email)
	code := strings.TrimSpace(req.Code)
	ctx := r.Context()

	// Count this attempt atomically, so parallel guesses can't exceed the limit.
	var user User
	err := a.store.users.FindOneAndUpdate(ctx,
		bson.M{"email": email, "unverified": bson.M{"$ne": true}, "resetAttempts": bson.M{"$lt": maxCodeAttempts}},
		bson.M{"$inc": bson.M{"resetAttempts": 1}},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		if n, _ := a.store.users.CountDocuments(ctx, bson.M{"email": email, "resetAttempts": bson.M{"$gte": maxCodeAttempts}}); n > 0 {
			sendError(w, http.StatusTooManyRequests, "Too many incorrect attempts. Request a new code")
			return
		}
		sendError(w, http.StatusBadRequest, "That code isn't valid. Request a new one")
		return
	}
	if err != nil {
		serverError(w, "reset lookup", err)
		return
	}
	if user.ResetCodeHash == "" || time.Now().After(user.ResetExpires) {
		sendError(w, http.StatusBadRequest, "This code has expired. Request a new one")
		return
	}
	if !hmac.Equal([]byte(a.codeHash("reset:"+email, code)), []byte(user.ResetCodeHash)) {
		left := maxCodeAttempts - user.ResetAttempts
		if left <= 0 {
			sendError(w, http.StatusTooManyRequests, "Too many incorrect attempts. Request a new code")
			return
		}
		sendError(w, http.StatusBadRequest, fmt.Sprintf("Incorrect code. %d attempt(s) left", left))
		return
	}

	hash, err := hashPassword(req.NewPassword)
	if err != nil {
		serverError(w, "hash password", err)
		return
	}
	if _, err := a.store.users.UpdateByID(ctx, user.ID, bson.M{
		"$set":   bson.M{"passwordHash": hash, "passwordChangedAt": time.Now().UTC()},
		"$unset": bson.M{"resetCodeHash": "", "resetExpires": "", "resetAttempts": "", "resetSentAt": ""},
	}); err != nil {
		serverError(w, "reset password", err)
		return
	}
	log.Printf("Password reset: %s", email)
	sendJSON(w, http.StatusOK, map[string]string{"message": "Your password has been changed. Please log in with it"})
}

// POST /api/auth/resend  {email}
// Sends a new code to an account that is waiting for verification. The answer
// is the same whether or not the account exists, so it can't be used to probe
// which emails are registered.
func (a *App) resendCode(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	email, ok := normalizeEmail(req.Email)
	generic := map[string]string{"message": "If this account is waiting for verification, a new code has been sent"}
	if !ok {
		sendJSON(w, http.StatusOK, generic)
		return
	}
	var user User
	err := a.store.users.FindOne(r.Context(), bson.M{"email": email, "unverified": true}).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		sendJSON(w, http.StatusOK, generic)
		return
	}
	if err != nil {
		serverError(w, "resend lookup", err)
		return
	}
	if inCooldown(user) {
		sendError(w, http.StatusTooManyRequests, "Please wait a minute before requesting another code")
		return
	}
	if err := a.sendCode(r.Context(), user); err != nil {
		log.Printf("ERROR send verification email to %s: %v", email, err)
		sendError(w, http.StatusBadGateway, "We couldn't send the email. Please try again shortly")
		return
	}
	sendJSON(w, http.StatusOK, generic)
}
