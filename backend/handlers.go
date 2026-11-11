package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"math"
	"net/http"
	"net/mail"
	"sort"
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// App bundles everything the handlers need.
type App struct {
	store  *Store
	tokens TokenService
}

// ============================================================================
// HELPERS
// ============================================================================

func sendJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func sendError(w http.ResponseWriter, status int, message string) {
	sendJSON(w, status, map[string]string{"message": message})
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MB is plenty for this API
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request data")
		return false
	}
	return true
}

func serverError(w http.ResponseWriter, where string, err error) {
	log.Printf("ERROR %s: %v", where, err)
	sendError(w, http.StatusInternalServerError, "Something went wrong. Please try again")
}

func normalizeEmail(email string) (string, bool) {
	email = strings.ToLower(strings.TrimSpace(email))
	addr, err := mail.ParseAddress(email)
	if err != nil || addr.Address != email || !strings.Contains(email[strings.LastIndex(email, "@")+1:], ".") {
		return email, false
	}
	return email, true
}

func validatePassword(p string) string {
	if len(p) < 8 {
		return "Password must be at least 8 characters"
	}
	if len(p) > 72 { // bcrypt only uses the first 72 bytes
		return "Password must be at most 72 characters"
	}
	return ""
}

func roundMoney(v float64) float64 { return math.Round(v*100) / 100 }

// UserView is the safe, public shape of a user sent to the frontend.
type UserView struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	Role         string `json:"role"`
	BusinessID   string `json:"businessId"`
	BusinessName string `json:"businessName"`
}

func (a *App) userView(ctx context.Context, u User) UserView {
	var b Business
	_ = a.store.businesses.FindOne(ctx, bson.M{"_id": u.BusinessID}).Decode(&b)
	return UserView{ID: u.ID.Hex(), Name: u.Name, Email: u.Email, Role: u.Role, BusinessID: u.BusinessID.Hex(), BusinessName: b.Name}
}

func (a *App) authResponse(w http.ResponseWriter, r *http.Request, status int, u User, message string) {
	token, err := a.tokens.Issue(u)
	if err != nil {
		serverError(w, "issue token", err)
		return
	}
	sendJSON(w, status, map[string]any{"message": message, "token": token, "user": a.userView(r.Context(), u)})
}

func pathID(w http.ResponseWriter, r *http.Request) (bson.ObjectID, bool) {
	id, err := bson.ObjectIDFromHex(r.PathValue("id"))
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid id")
		return id, false
	}
	return id, true
}

// ============================================================================
// AUTH
// ============================================================================

// POST /api/auth/signup  {name, businessName, email, password}
// Creates a business plus its owner account and logs the owner in.
func (a *App) signup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name         string `json:"name"`
		BusinessName string `json:"businessName"`
		Email        string `json:"email"`
		Password     string `json:"password"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.BusinessName = strings.TrimSpace(req.BusinessName)
	email, ok := normalizeEmail(req.Email)
	switch {
	case req.Name == "" || len(req.Name) > 80:
		sendError(w, http.StatusBadRequest, "Please enter your name")
		return
	case req.BusinessName == "" || len(req.BusinessName) > 120:
		sendError(w, http.StatusBadRequest, "Please enter your business name")
		return
	case !ok:
		sendError(w, http.StatusBadRequest, "Please enter a valid email address")
		return
	}
	if msg := validatePassword(req.Password); msg != "" {
		sendError(w, http.StatusBadRequest, msg)
		return
	}

	ctx := r.Context()
	if n, _ := a.store.users.CountDocuments(ctx, bson.M{"email": email}); n > 0 {
		sendError(w, http.StatusConflict, "An account with this email already exists")
		return
	}

	hash, err := hashPassword(req.Password)
	if err != nil {
		serverError(w, "hash password", err)
		return
	}

	now := time.Now().UTC()
	business := Business{ID: bson.NewObjectID(), Name: req.BusinessName, OwnerID: bson.NewObjectID(), CreatedAt: now}
	owner := User{ID: business.OwnerID, Name: req.Name, Email: email, PasswordHash: hash, Role: "owner", BusinessID: business.ID, CreatedAt: now}

	if _, err := a.store.businesses.InsertOne(ctx, business); err != nil {
		serverError(w, "insert business", err)
		return
	}
	if _, err := a.store.users.InsertOne(ctx, owner); err != nil {
		_, _ = a.store.businesses.DeleteOne(ctx, bson.M{"_id": business.ID})
		if mongo.IsDuplicateKeyError(err) {
			sendError(w, http.StatusConflict, "An account with this email already exists")
			return
		}
		serverError(w, "insert owner", err)
		return
	}

	log.Printf("Signup: %s created business %q", email, business.Name)
	a.authResponse(w, r, http.StatusCreated, owner, "Welcome to ProdTrack!")
}

// POST /api/auth/login  {email, password}
func (a *App) login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	email, _ := normalizeEmail(req.Email)

	var user User
	err := a.store.users.FindOne(r.Context(), bson.M{"email": email}).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		checkPassword(string(dummyHash), req.Password) // equalize timing
		sendError(w, http.StatusUnauthorized, "Incorrect email or password")
		return
	}
	if err != nil {
		serverError(w, "find user", err)
		return
	}
	if !checkPassword(user.PasswordHash, req.Password) {
		sendError(w, http.StatusUnauthorized, "Incorrect email or password")
		return
	}

	a.authResponse(w, r, http.StatusOK, user, "Welcome back!")
}

// GET /api/auth/me
func (a *App) me(w http.ResponseWriter, r *http.Request) {
	sendJSON(w, http.StatusOK, map[string]any{"user": a.userView(r.Context(), authUser(r))})
}

// PUT /api/auth/profile  {name, email, currentPassword, newPassword}
// Changing email or password requires the current password.
func (a *App) updateProfile(w http.ResponseWriter, r *http.Request) {
	user := authUser(r)
	var req struct {
		Name            string `json:"name"`
		Email           string `json:"email"`
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	email, ok := normalizeEmail(req.Email)
	if req.Name == "" || len(req.Name) > 80 {
		sendError(w, http.StatusBadRequest, "Please enter your name")
		return
	}
	if !ok {
		sendError(w, http.StatusBadRequest, "Please enter a valid email address")
		return
	}

	set := bson.M{"name": req.Name, "email": email}
	sensitive := email != user.Email || req.NewPassword != ""
	if sensitive && !checkPassword(user.PasswordHash, req.CurrentPassword) {
		sendError(w, http.StatusUnauthorized, "Current password is incorrect")
		return
	}
	if req.NewPassword != "" {
		if msg := validatePassword(req.NewPassword); msg != "" {
			sendError(w, http.StatusBadRequest, msg)
			return
		}
		hash, err := hashPassword(req.NewPassword)
		if err != nil {
			serverError(w, "hash password", err)
			return
		}
		set["passwordHash"] = hash
	}

	_, err := a.store.users.UpdateByID(r.Context(), user.ID, bson.M{"$set": set})
	if mongo.IsDuplicateKeyError(err) {
		sendError(w, http.StatusConflict, "That email is already used by another account")
		return
	}
	if err != nil {
		serverError(w, "update profile", err)
		return
	}
	user.Name, user.Email = req.Name, email
	sendJSON(w, http.StatusOK, map[string]any{"message": "Profile updated", "user": a.userView(r.Context(), user)})
}

// ============================================================================
// STAFF (owner only)
// ============================================================================

// GET /api/staff
func (a *App) listStaff(w http.ResponseWriter, r *http.Request) {
	owner := authUser(r)
	cur, err := a.store.users.Find(r.Context(), bson.M{"businessId": owner.BusinessID, "role": "staff"},
		options.Find().SetSort(bson.D{{Key: "name", Value: 1}}))
	if err != nil {
		serverError(w, "list staff", err)
		return
	}
	staff := []User{}
	if err := cur.All(r.Context(), &staff); err != nil {
		serverError(w, "decode staff", err)
		return
	}
	sendJSON(w, http.StatusOK, staff) // PasswordHash has json:"-", so it's never included
}

// POST /api/staff  {name, email, password}
func (a *App) createStaff(w http.ResponseWriter, r *http.Request) {
	owner := authUser(r)
	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	email, ok := normalizeEmail(req.Email)
	if req.Name == "" || len(req.Name) > 80 {
		sendError(w, http.StatusBadRequest, "Please enter the staff member's name")
		return
	}
	if !ok {
		sendError(w, http.StatusBadRequest, "Please enter a valid email address")
		return
	}
	if msg := validatePassword(req.Password); msg != "" {
		sendError(w, http.StatusBadRequest, msg)
		return
	}
	hash, err := hashPassword(req.Password)
	if err != nil {
		serverError(w, "hash password", err)
		return
	}

	staff := User{
		ID: bson.NewObjectID(), Name: req.Name, Email: email, PasswordHash: hash,
		Role: "staff", BusinessID: owner.BusinessID, CreatedAt: time.Now().UTC(),
	}
	if _, err := a.store.users.InsertOne(r.Context(), staff); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			sendError(w, http.StatusConflict, "An account with this email already exists")
			return
		}
		serverError(w, "insert staff", err)
		return
	}
	sendJSON(w, http.StatusCreated, staff)
}

// DELETE /api/staff/{id}
func (a *App) deleteStaff(w http.ResponseWriter, r *http.Request) {
	owner := authUser(r)
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	res, err := a.store.users.DeleteOne(r.Context(), bson.M{"_id": id, "businessId": owner.BusinessID, "role": "staff"})
	if err != nil {
		serverError(w, "delete staff", err)
		return
	}
	if res.DeletedCount == 0 {
		sendError(w, http.StatusNotFound, "Staff member not found")
		return
	}
	sendJSON(w, http.StatusOK, map[string]string{"message": "Staff member removed"})
}

// ============================================================================
// BILLING
// ============================================================================

// GET /api/billing - newest first
func (a *App) listBills(w http.ResponseWriter, r *http.Request) {
	user := authUser(r)
	bills, err := a.findBills(r.Context(), user.BusinessID)
	if err != nil {
		serverError(w, "list bills", err)
		return
	}
	sendJSON(w, http.StatusOK, bills)
}

func (a *App) findBills(ctx context.Context, businessID bson.ObjectID) ([]Bill, error) {
	cur, err := a.store.bills.Find(ctx, bson.M{"businessId": businessID},
		options.Find().SetSort(bson.D{{Key: "timestamp", Value: -1}}))
	if err != nil {
		return nil, err
	}
	bills := []Bill{}
	err = cur.All(ctx, &bills)
	return bills, err
}

// ============================================================================
// ANALYTICS (owner only) - uses a goroutine + channels to aggregate bills
// ============================================================================

type DailySummary struct {
	Date       string  `json:"date"` // YYYY-MM-DD in the viewer's timezone
	TotalSales float64 `json:"totalSales"`
	ItemsSold  int     `json:"itemsSold"`
	Bills      int     `json:"bills"`
}

type ProductSales struct {
	ProductID string  `json:"productId"`
	Name      string  `json:"name"`
	Quantity  int     `json:"quantity"`
	Revenue   float64 `json:"revenue"`
}

type analyticsResult struct {
	Daily       []DailySummary `json:"daily"`
	TopProducts []ProductSales `json:"topProducts"`
}

// aggregateBills reads bills from a channel in a background goroutine and
// sends the finished summary back on another channel.
func aggregateBills(bills []Bill, loc *time.Location) analyticsResult {
	billChan := make(chan Bill, 64)
	resultChan := make(chan analyticsResult)

	go func() {
		daily := map[string]*DailySummary{}
		products := map[string]*ProductSales{}
		for b := range billChan { // runs until billChan is closed
			date := b.Timestamp.In(loc).Format("2006-01-02")
			d, ok := daily[date]
			if !ok {
				d = &DailySummary{Date: date}
				daily[date] = d
			}
			d.TotalSales += b.TotalAmount
			d.Bills++
			for _, it := range b.Items {
				d.ItemsSold += it.Quantity
				key := it.ProductID.Hex()
				p, ok := products[key]
				if !ok {
					p = &ProductSales{ProductID: key, Name: it.ProductName}
					products[key] = p
				}
				p.Quantity += it.Quantity
				p.Revenue += it.Price * float64(it.Quantity)
			}
		}

		res := analyticsResult{Daily: []DailySummary{}, TopProducts: []ProductSales{}}
		for _, d := range daily {
			d.TotalSales = roundMoney(d.TotalSales)
			res.Daily = append(res.Daily, *d)
		}
		sort.Slice(res.Daily, func(i, j int) bool { return res.Daily[i].Date < res.Daily[j].Date })
		for _, p := range products {
			p.Revenue = roundMoney(p.Revenue)
			res.TopProducts = append(res.TopProducts, *p)
		}
		sort.Slice(res.TopProducts, func(i, j int) bool {
			if res.TopProducts[i].Revenue != res.TopProducts[j].Revenue {
				return res.TopProducts[i].Revenue > res.TopProducts[j].Revenue
			}
			return res.TopProducts[i].Name < res.TopProducts[j].Name
		})
		if len(res.TopProducts) > 5 {
			res.TopProducts = res.TopProducts[:5]
		}
		resultChan <- res
	}()

	for _, b := range bills {
		billChan <- b
	}
	close(billChan) // tells the worker there is nothing more to read
	return <-resultChan
}

// GET /api/analytics?tzOffset=<minutes, as returned by JS getTimezoneOffset()>
func (a *App) analytics(w http.ResponseWriter, r *http.Request) {
	user := authUser(r)
	loc := time.UTC
	if v := r.URL.Query().Get("tzOffset"); v != "" {
		if mins, err := strconv.Atoi(v); err == nil && mins >= -14*60 && mins <= 14*60 {
			loc = time.FixedZone("viewer", -mins*60)
		}
	}
	bills, err := a.findBills(r.Context(), user.BusinessID)
	if err != nil {
		serverError(w, "analytics bills", err)
		return
	}
	sendJSON(w, http.StatusOK, aggregateBills(bills, loc))
}

// GET /api/health
func (a *App) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	if err := a.store.client.Ping(ctx, nil); err != nil {
		sendJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "error", "database": "unreachable"})
		return
	}
	sendJSON(w, http.StatusOK, map[string]string{"status": "ok", "database": "connected"})
}
