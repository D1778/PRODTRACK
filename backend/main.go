package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// ============================================================================
// STRUCTS (Data Blueprints)
// In Go, a 'struct' is like a template for data. It's similar to an Object in JS.
// The `json:"..."` tags tell Go how to name these fields when converting to JSON.
// ============================================================================

type User struct {
	Name             string `json:"name"`
	Email            string `json:"email"`
	Password         string `json:"password"`
	Role             string `json:"role"`
	BusinessPassword string `json:"businessPassword"`
	BusinessName     string `json:"businessName"`
}

type Business struct {
	BusinessPassword string `json:"businessPassword"`
	BusinessName     string `json:"businessName"`
	OwnerEmail       string `json:"ownerEmail"`
}

type Product struct {
	ID               int     `json:"id"`
	BusinessPassword string  `json:"businessPassword"`
	Name             string  `json:"name"`
	Category         string  `json:"category"`
	Price            float64 `json:"price"`
	Stock            int     `json:"stock"`
	MinThreshold     int     `json:"minThreshold"`
	Vendor           string  `json:"vendor"`
	Notes            string  `json:"notes"`
	PerformedBy      string  `json:"performedBy"`
}

type StockHistory struct {
	ID               int64  `json:"id"`
	BusinessPassword string `json:"businessPassword"`
	ProductID        int    `json:"productId"`
	ProductName      string `json:"productName"`
	Action           string `json:"action"` // "in" (stock added) or "out" (stock removed)
	Quantity         int    `json:"quantity"`
	PerformedBy      string `json:"performedBy"`
	Timestamp        string `json:"timestamp"`
	Notes            string `json:"notes"`
}

type BillItem struct {
	ProductID   int     `json:"productId"`
	ProductName string  `json:"productName"`
	Quantity    int     `json:"quantity"`
	Price       float64 `json:"price"`
}

type Bill struct {
	ID               int64      `json:"id"`
	BusinessPassword string     `json:"businessPassword"`
	Items            []BillItem `json:"items"`
	TotalAmount      float64    `json:"totalAmount"`
	CreatedBy        string     `json:"createdBy"`
	Timestamp        string     `json:"timestamp"`
}

// ============================================================================
// STORAGE 
// We are using Slices (dynamic arrays) to store data while the server is running.
// If the server restarts, this data is lost.
// ============================================================================

var (
	userStorage     = []User{}
	businessStorage = []Business{}
	nextProductID   = 1
	productStorage  = []Product{}
	historyStorage  = []StockHistory{}
	billStorage     = []Bill{}
)

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// sendJSON is a simplified way to send a response back to the browser.
// Status: The HTTP code (200 for OK, 404 for Not Found, etc.)
// Data: Whatever info you want to send.
func sendJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// handleCORS handles the "security check" browsers do when calling an API.
// If the browser asks "Are you allowed to talk to me?", we say "Yes".
func handleCORS(w http.ResponseWriter, r *http.Request) bool {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Business-Password, X-User-Role")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return true
	}
	return false
}

// ============================================================================
// HANDLERS (The code that runs for each URL)
// ============================================================================

// authHandler handles /signup and /login
func authHandler(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	} // Handle security check first

	// We only allow POST requests (sending data) for login/signup
	if r.Method != "POST" {
		sendJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Please use POST"})
		return
	}

	// 1. SIGNUP LOGIC
	if r.URL.Path == "/signup" {
		var req struct {
			Name             string `json:"name"`
			Email            string `json:"email"`
			Password         string `json:"password"`
			Role             string `json:"role"`
			BusinessPassword string `json:"businessPassword"`
			BusinessName     string `json:"businessName"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			sendJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid data"})
			return
		}

		if req.Role == "owner" && (req.BusinessPassword == "" || req.BusinessName == "") {
			sendJSON(w, http.StatusBadRequest, map[string]string{"message": "Business Name and Password are required for Owners"})
			return
		}

		for _, u := range userStorage {
			if u.Email == req.Email {
				sendJSON(w, http.StatusConflict, map[string]string{"message": "Email already registered"})
				return
			}
		}

		if req.Role == "owner" {
			for _, s := range businessStorage {
				if s.BusinessPassword == req.BusinessPassword {
					sendJSON(w, http.StatusConflict, map[string]string{"message": "Business Password already exists"})
					return
				}
			}
			businessStorage = append(businessStorage, Business{
				BusinessPassword: req.BusinessPassword,
				BusinessName:     req.BusinessName,
				OwnerEmail:       req.Email,
			})
		}

		newUser := User{
			Name:             req.Name,
			Email:            req.Email,
			Password:         req.Password,
			Role:             req.Role,
			BusinessPassword: req.BusinessPassword,
			BusinessName:     req.BusinessName,
		}
		userStorage = append(userStorage, newUser)

		fmt.Printf("User Created: %s (%s) for Business Password: %s\n", newUser.Email, newUser.Role, newUser.BusinessPassword)
		sendJSON(w, http.StatusCreated, map[string]string{"message": "Success!"})

	} else if r.URL.Path == "/login" {
		var req struct {
			Email            string `json:"email"`
			Password         string `json:"password"`
			BusinessPassword string `json:"businessPassword"`
			BusinessName     string `json:"businessName"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			sendJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid data"})
			return
		}

		for i, u := range userStorage {
			if u.Email == req.Email && u.Password == req.Password {
				if u.Role == "owner" && u.BusinessPassword != req.BusinessPassword {
					sendJSON(w, http.StatusUnauthorized, map[string]string{"message": "Incorrect Business Password for this Owner account"})
					return
				}
				if u.Role == "staff" && u.BusinessPassword != "" && u.BusinessPassword != req.BusinessPassword {
					sendJSON(w, http.StatusUnauthorized, map[string]string{"message": "You are registered to a different Business."})
					return
				}

				// Find the real business name from system storage to be 100% accurate
				var systemBusinessName string
				for _, s := range businessStorage {
					if s.BusinessPassword == req.BusinessPassword {
						systemBusinessName = s.BusinessName
						break
					}
				}

				// If system has a name, use it; otherwise fallback to request
				if systemBusinessName != "" {
					userStorage[i].BusinessName = systemBusinessName
				} else {
					userStorage[i].BusinessName = req.BusinessName
				}

				if u.Role == "staff" && u.BusinessPassword == "" {
					userStorage[i].BusinessPassword = req.BusinessPassword
					fmt.Printf("Notice: Bound Staff %s to Business Password %s (%s)\n", u.Email, req.BusinessPassword, userStorage[i].BusinessName)
				}
				
				// Return the most up-to-date user object from our storage
				u = userStorage[i]

				fmt.Printf("Login: %s (%s) at Business Password %s (%s)\n", u.Email, u.Role, u.BusinessPassword, u.BusinessName)
				sendJSON(w, http.StatusOK, map[string]interface{}{"message": "Welcome!", "user": u})
				return
			}
		}
		sendJSON(w, http.StatusUnauthorized, map[string]string{"message": "Wrong email or password"})
	}
}

// productsHandler handles adding and listing products
func productsHandler(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	businessPassword := r.Header.Get("X-Business-Password")
	if businessPassword == "" && r.Method != "OPTIONS" {
		sendJSON(w, http.StatusUnauthorized, map[string]string{"message": "Missing Business Password header"})
		return
	}

	if r.Method == "GET" {
		var scopedProducts []Product
		for _, p := range productStorage {
			if p.BusinessPassword == businessPassword {
				scopedProducts = append(scopedProducts, p)
			}
		}
		if scopedProducts == nil {
			scopedProducts = []Product{}
		}
		sendJSON(w, http.StatusOK, scopedProducts)
		return
	}

	// For administrative actions (POST), check if the user is an owner
	// Note: In a real app, we'd verify the user's role from a token.
	// For this local demo, we'll look at the request header or body if needed.
	// But let's simplify and check if the role is 'owner' from a custom header
	userRole := r.Header.Get("X-User-Role")

	// POST: Browser wants to ADD a new product
	if r.Method == "POST" {
		if userRole != "owner" && userRole != "staff" {
			sendJSON(w, http.StatusForbidden, map[string]string{"message": "Unauthorized role"})
			return
		}

		var p Product
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			sendJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid data"})
			return
		}

		p.ID = nextProductID
		p.BusinessPassword = businessPassword
		nextProductID++
		productStorage = append(productStorage, p)

		if p.Stock > 0 {
			historyStorage = append(historyStorage, StockHistory{
				ID:               time.Now().UnixNano(),
				BusinessPassword: businessPassword,
				ProductID:        p.ID,
				ProductName:      p.Name,
				Action:           "in",
				Quantity:         p.Stock,
				PerformedBy:      p.PerformedBy,
				Timestamp:        time.Now().Format(time.RFC3339),
				Notes:            "Initial stock",
			})
		}

		sendJSON(w, http.StatusCreated, p)
		return
	}

	// DELETE: Remove a product
	if r.Method == "DELETE" {
		if userRole != "owner" && userRole != "staff" {
			sendJSON(w, http.StatusForbidden, map[string]string{"message": "Unauthorized role"})
			return
		}

		var req struct {
			ID int `json:"id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			sendJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid data"})
			return
		}

		for i, p := range productStorage {
			if p.ID == req.ID && p.BusinessPassword == businessPassword {
				productStorage = append(productStorage[:i], productStorage[i+1:]...)
				sendJSON(w, http.StatusOK, map[string]string{"message": "Product deleted"})
				return
			}
		}
		sendJSON(w, http.StatusNotFound, map[string]string{"message": "Product not found"})
		return
	}

	sendJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Please use GET, POST, or DELETE"})
}

// stockHandler handles changing the stock count
func stockHandler(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}
	if r.Method != "POST" {
		sendJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Please use POST"})
		return
	}

	businessPassword := r.Header.Get("X-Business-Password")
	userRole := r.Header.Get("X-User-Role")

	if businessPassword == "" {
		sendJSON(w, http.StatusUnauthorized, map[string]string{"message": "Missing Business Password header"})
		return
	}

	var req struct {
		ProductID   int    `json:"productId"`
		Action      string `json:"action"` // "in" or "out"
		Quantity    int    `json:"quantity"`
		Reason      string `json:"reason"`
		PerformedBy string `json:"performedBy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid data"})
		return
	}

	// Only owners and staff can add stock ("in")
	if req.Action == "in" && userRole != "owner" && userRole != "staff" {
		sendJSON(w, http.StatusForbidden, map[string]string{"message": "Unauthorized role"})
		return
	}

	// Find the product in our storage scoped to BusinessID
	var product *Product
	for i := range productStorage {
		if productStorage[i].ID == req.ProductID && productStorage[i].BusinessPassword == businessPassword {
			product = &productStorage[i]
			break
		}
	}

	if product == nil {
		sendJSON(w, http.StatusNotFound, map[string]string{"message": "Product not found in this business"})
		return
	}

	if req.Action == "in" {
		product.Stock += req.Quantity
	} else if req.Action == "out" {
		if product.Stock < req.Quantity {
			sendJSON(w, http.StatusBadRequest, map[string]string{
				"message": fmt.Sprintf("Insufficient stock. Available: %d", product.Stock),
			})
			return
		}
		product.Stock -= req.Quantity
	} else {
		sendJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid action. Use 'in' or 'out'"})
		return
	}

	// Add to history list
	historyStorage = append(historyStorage, StockHistory{
		ID:               time.Now().UnixNano(),
		BusinessPassword: businessPassword,
		ProductID:   req.ProductID,
		ProductName: product.Name,
		Action:      req.Action,
		Quantity:    req.Quantity,
		PerformedBy: req.PerformedBy,
		Timestamp:   time.Now().Format(time.RFC3339),
		Notes:       req.Reason,
	})

	fmt.Printf("Stock Update (Business Password %s): %s %s %d (New Stock: %d)\n", businessPassword, product.Name, req.Action, req.Quantity, product.Stock)
	sendJSON(w, http.StatusOK, map[string]interface{}{"message": "Stock updated!", "product": product})
}

// historyHandler lets us see the log of all changes
func historyHandler(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}
	if r.Method != "GET" {
		sendJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Please use GET"})
		return
	}

	businessPassword := r.Header.Get("X-Business-Password")
	if businessPassword == "" {
		sendJSON(w, http.StatusUnauthorized, map[string]string{"message": "Missing Business Password header"})
		return
	}

	var scopedHistory []StockHistory
	for _, h := range historyStorage {
		if h.BusinessPassword == businessPassword {
			scopedHistory = append(scopedHistory, h)
		}
	}
	if scopedHistory == nil {
		scopedHistory = []StockHistory{}
	}

	sendJSON(w, http.StatusOK, scopedHistory)
}

// staffHandler handles staff management (Owner only)
func staffHandler(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	businessPassword := r.Header.Get("X-Business-Password")
	userRole := r.Header.Get("X-User-Role")

	if userRole != "owner" {
		sendJSON(w, http.StatusForbidden, map[string]string{"message": "Restricted to Owners"})
		return
	}

	if r.Method == "GET" {
		var scopedStaff []User
		for _, u := range userStorage {
			if u.BusinessPassword == businessPassword && u.Role == "staff" {
				scopedStaff = append(scopedStaff, u)
			}
		}
		if scopedStaff == nil {
			scopedStaff = []User{}
		}
		sendJSON(w, http.StatusOK, scopedStaff)
		return
	}

	if r.Method == "POST" {
		var staff User
		if err := json.NewDecoder(r.Body).Decode(&staff); err != nil {
			sendJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid data"})
			return
		}
		staff.BusinessPassword = businessPassword
		staff.Role = "staff"
		userStorage = append(userStorage, staff)
		sendJSON(w, http.StatusCreated, staff)
		return
	}

	if r.Method == "DELETE" {
		var req struct {
			Email string `json:"email"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			sendJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid data"})
			return
		}

		for i, u := range userStorage {
			if u.Email == req.Email && u.BusinessPassword == businessPassword && u.Role == "staff" {
				userStorage = append(userStorage[:i], userStorage[i+1:]...)
				sendJSON(w, http.StatusOK, map[string]string{"message": "Staff member removed"})
				return
			}
		}
		sendJSON(w, http.StatusNotFound, map[string]string{"message": "Staff member not found"})
		return
	}

	sendJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
}

// billingHandler handles creating sales records (Staff and Owner)
func billingHandler(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	businessPassword := r.Header.Get("X-Business-Password")
	if businessPassword == "" {
		sendJSON(w, http.StatusUnauthorized, map[string]string{"message": "Missing Business Password"})
		return
	}

	if r.Method == "POST" {
		var bill Bill
		if err := json.NewDecoder(r.Body).Decode(&bill); err != nil {
			sendJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid data"})
			return
		}

		bill.ID = time.Now().UnixNano()
		bill.BusinessPassword = businessPassword
		bill.Timestamp = time.Now().Format(time.RFC3339)

		for _, item := range bill.Items {
			for i := range productStorage {
				if productStorage[i].ID == item.ProductID && productStorage[i].BusinessPassword == businessPassword {
					if productStorage[i].Stock < item.Quantity {
						sendJSON(w, http.StatusBadRequest, map[string]string{"message": fmt.Sprintf("Out of stock: %s", item.ProductName)})
						return
					}
					productStorage[i].Stock -= item.Quantity

					historyStorage = append(historyStorage, StockHistory{
						ID:               time.Now().UnixNano(),
						BusinessPassword: businessPassword,
						ProductID:   item.ProductID,
						ProductName: item.ProductName,
						Action:      "out",
						Quantity:    item.Quantity,
						PerformedBy: bill.CreatedBy,
						Timestamp:   time.Now().Format(time.RFC3339),
						Notes:       "Sold via billing",
					})
				}
			}
		}

		billStorage = append(billStorage, bill)
		sendJSON(w, http.StatusCreated, bill)
		return
	}

	if r.Method == "GET" {
		var scopedBills []Bill
		for _, b := range billStorage {
			if b.BusinessPassword == businessPassword {
				scopedBills = append(scopedBills, b)
			}
		}
		if scopedBills == nil {
			scopedBills = []Bill{}
		}
		sendJSON(w, http.StatusOK, scopedBills)
		return
	}

	sendJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
}

// analyticsHandler handles sales performance logic (Owner only)
func analyticsHandler(w http.ResponseWriter, r *http.Request) {
	if handleCORS(w, r) {
		return
	}

	businessPassword := r.Header.Get("X-Business-Password")
	userRole := r.Header.Get("X-User-Role")

	if userRole != "owner" {
		sendJSON(w, http.StatusForbidden, map[string]string{"message": "Restricted to Owners"})
		return
	}

	if r.Method != "GET" {
		sendJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}

	type DailySummary struct {
		Date       string  `json:"date"`
		TotalSales float64 `json:"totalSales"`
		ItemsSold  int     `json:"itemsSold"`
	}

	summaries := make(map[string]*DailySummary)
	for _, b := range billStorage {
		if b.BusinessPassword == businessPassword {
			date := b.Timestamp[:10]
			if _, exists := summaries[date]; !exists {
				summaries[date] = &DailySummary{Date: date}
			}
			summaries[date].TotalSales += b.TotalAmount
			for _, item := range b.Items {
				summaries[date].ItemsSold += item.Quantity
			}
		}
	}

	result := []DailySummary{}
	for _, s := range summaries {
		result = append(result, *s)
	}

	sendJSON(w, http.StatusOK, result)
}

// ============================================================================
// MAIN FUNCTION (The starting point)
// ============================================================================
func main() {
	// Step 1: Tell Go which URL leads to which function
	// http.HandleFunc connects a URL path to a specific handler function.
	http.HandleFunc("/signup", authHandler)
	http.HandleFunc("/login", authHandler)
	http.HandleFunc("/products", productsHandler)
	http.HandleFunc("/stock", stockHandler)
	http.HandleFunc("/history", historyHandler)
	http.HandleFunc("/staff", staffHandler)
	http.HandleFunc("/billing", billingHandler)
	http.HandleFunc("/analytics", analyticsHandler)

	// Step 2: Start the server
	// http.ListenAndServe starts the web server on a specific port.
	// ":8080" means it will listen on port 8080 on all available network interfaces.
	// 'nil' means it will use the default ServeMux (router) which we configured with http.HandleFunc.
	fmt.Println("Server started at http://localhost:8080")
	fmt.Println("Routes: /signup, /login, /products, /stock, /history")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		fmt.Printf("Server failed to start: %v\n", err)
	}
}
