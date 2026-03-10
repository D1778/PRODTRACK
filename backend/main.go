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
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
	ShopID   string `json:"shopId"`
}

type Shop struct {
	ShopID     string `json:"shopId"`
	ShopName   string `json:"shopName"`
	OwnerEmail string `json:"ownerEmail"`
}

type Product struct {
	ID           int    `json:"id"`
	ShopID       string `json:"shopId"`
	Name         string `json:"name"`
	Category     string `json:"category"`
	Stock        int    `json:"stock"`
	MinThreshold int    `json:"minThreshold"`
	Vendor       string `json:"vendor"`
	Notes        string `json:"notes"`
}

type StockHistory struct {
	ID          int64  `json:"id"`
	ShopID      string `json:"shopId"`
	ProductID   int    `json:"productId"`
	ProductName string `json:"productName"`
	Action      string `json:"action"` // "in" (stock added) or "out" (stock removed)
	Quantity    int    `json:"quantity"`
	PerformedBy string `json:"performedBy"`
	Timestamp   string `json:"timestamp"`
	Notes       string `json:"notes"`
}

// ============================================================================
// STORAGE 
// We are using Slices (dynamic arrays) to store data while the server is running.
// If the server restarts, this data is lost.
// ============================================================================

var (
	userStorage    = []User{}
	shopStorage    = []Shop{}
	nextProductID  = 1
	productStorage = []Product{}
	historyStorage = []StockHistory{}
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
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Shop-ID")

	// If the browser sends an "OPTIONS" request, it's just checking permissions.
	// we stop here and return 'true' to indicate we handled it.
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
			Name     string `json:"name"`
			Email    string `json:"email"`
			Password string `json:"password"`
			Role     string `json:"role"`
			ShopID   string `json:"shopId"`
			ShopName string `json:"shopName"`
		}
		// Decode the JSON coming from the browser
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			sendJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid data"})
			return
		}

		if req.Role == "owner" && (req.ShopID == "" || req.ShopName == "") {
			sendJSON(w, http.StatusBadRequest, map[string]string{"message": "Shop Name and ID are required for Owners"})
			return
		}

		// Check if email already exists
		for _, u := range userStorage {
			if u.Email == req.Email {
				sendJSON(w, http.StatusConflict, map[string]string{"message": "Email already registered"})
				return
			}
		}

		if req.Role == "owner" {
			// Ensure ShopID is unique globally
			for _, s := range shopStorage {
				if s.ShopID == req.ShopID {
					sendJSON(w, http.StatusConflict, map[string]string{"message": "Shop ID already exists"})
					return
				}
			}
			shopStorage = append(shopStorage, Shop{
				ShopID:     req.ShopID,
				ShopName:   req.ShopName,
				OwnerEmail: req.Email,
			})
		}

		newUser := User{
			Name:     req.Name,
			Email:    req.Email,
			Password: req.Password,
			Role:     req.Role,
			ShopID:   req.ShopID,
		}
		userStorage = append(userStorage, newUser)

		fmt.Printf("User Created: %s (%s) for Shop: %s\n", newUser.Email, newUser.Role, newUser.ShopID)
		sendJSON(w, http.StatusCreated, map[string]string{"message": "Success!"})

		// 2. LOGIN LOGIC
	} else if r.URL.Path == "/login" {
		var req struct {
			Email    string `json:"email"`
			Password string `json:"password"`
			ShopID   string `json:"shopId"`
			ShopName string `json:"shopName"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			sendJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid data"})
			return
		}

		for i, u := range userStorage {
			if u.Email == req.Email && u.Password == req.Password {

				// Owners must match their created ShopID immediately.
				// Staff might have an empty ShopID if this is their first login.
				if u.Role == "owner" && u.ShopID != req.ShopID {
					sendJSON(w, http.StatusUnauthorized, map[string]string{"message": "Incorrect Shop ID for this Owner account"})
					return
				}
				if u.Role == "staff" && u.ShopID != "" && u.ShopID != req.ShopID {
					sendJSON(w, http.StatusUnauthorized, map[string]string{"message": "You are registered to a different Shop."})
					return
				}

				// Verify shopName matches actual shop
				shopValid := false
				for _, s := range shopStorage {
					if s.ShopID == req.ShopID && s.ShopName == req.ShopName {
						shopValid = true
						break
					}
				}
				if !shopValid {
					sendJSON(w, http.StatusUnauthorized, map[string]string{"message": "Invalid Shop Name or ID."})
					return
				}

				// Bind Staff to this Shop if it's their first time logging in
				if u.Role == "staff" && u.ShopID == "" {
					userStorage[i].ShopID = req.ShopID
					u.ShopID = req.ShopID // update local copy to return in JSON
					fmt.Printf("Notice: Bound Staff %s to Shop %s\n", u.Email, u.ShopID)
				}

				fmt.Printf("Login: %s (%s) at Shop %s\n", u.Email, u.Role, u.ShopID)
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

	shopID := r.Header.Get("X-Shop-ID")
	if shopID == "" && r.Method != "OPTIONS" {
		sendJSON(w, http.StatusUnauthorized, map[string]string{"message": "Missing Shop ID header"})
		return
	}

	// GET: Browser wants to SEE the list
	if r.Method == "GET" {
		var scopedProducts []Product
		for _, p := range productStorage {
			if p.ShopID == shopID {
				scopedProducts = append(scopedProducts, p)
			}
		}
		if scopedProducts == nil {
			scopedProducts = []Product{}
		}
		sendJSON(w, http.StatusOK, scopedProducts)
		return
	}

	// POST: Browser wants to ADD a new product
	if r.Method == "POST" {
		var p Product
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			sendJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid data"})
			return
		}

		p.ID = nextProductID
		p.ShopID = shopID
		nextProductID++
		productStorage = append(productStorage, p)

		// Optionally add initial stock to history if stock > 0
		if p.Stock > 0 {
			historyStorage = append(historyStorage, StockHistory{
				ID:          time.Now().UnixNano(),
				ShopID:      shopID,
				ProductID:   p.ID,
				ProductName: p.Name,
				Action:      "in",
				Quantity:    p.Stock,
				PerformedBy: "System",
				Timestamp:   time.Now().Format(time.RFC3339),
				Notes:       "Initial stock",
			})
		}

		sendJSON(w, http.StatusCreated, p)
		return
	}

	sendJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "Please use GET or POST"})
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

	shopID := r.Header.Get("X-Shop-ID")
	if shopID == "" {
		sendJSON(w, http.StatusUnauthorized, map[string]string{"message": "Missing Shop ID header"})
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

	// Find the product in our storage scoped to ShopID
	var product *Product
	for i := range productStorage {
		if productStorage[i].ID == req.ProductID && productStorage[i].ShopID == shopID {
			product = &productStorage[i]
			break
		}
	}

	if product == nil {
		sendJSON(w, http.StatusNotFound, map[string]string{"message": "Product not found in this shop"})
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
		ID:          time.Now().UnixNano(),
		ShopID:      shopID,
		ProductID:   req.ProductID,
		ProductName: product.Name,
		Action:      req.Action,
		Quantity:    req.Quantity,
		PerformedBy: req.PerformedBy,
		Timestamp:   time.Now().Format(time.RFC3339),
		Notes:       req.Reason,
	})

	fmt.Printf("Stock Update (Shop %s): %s %s %d (New Stock: %d)\n", shopID, product.Name, req.Action, req.Quantity, product.Stock)
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

	shopID := r.Header.Get("X-Shop-ID")
	if shopID == "" {
		sendJSON(w, http.StatusUnauthorized, map[string]string{"message": "Missing Shop ID header"})
		return
	}

	var scopedHistory []StockHistory
	for _, h := range historyStorage {
		if h.ShopID == shopID {
			scopedHistory = append(scopedHistory, h)
		}
	}
	if scopedHistory == nil {
		scopedHistory = []StockHistory{}
	}

	sendJSON(w, http.StatusOK, scopedHistory)
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
