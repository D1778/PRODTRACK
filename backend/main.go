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
}

type Product struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	Category     string `json:"category"`
	Stock        int    `json:"stock"`
	MinThreshold int    `json:"minThreshold"`
	Vendor       string `json:"vendor"`
	Notes        string `json:"notes"`
}

type StockHistory struct {
	ID          int64  `json:"id"`
	ProductID   int    `json:"productId"`
	ProductName string `json:"productName"`
	Action      string `json:"action"` // "in" (stock added) or "out" (stock removed)
	Quantity    int    `json:"quantity"`
	PerformedBy string `json:"performedBy"`
	Timestamp   string `json:"timestamp"`
	Notes       string `json:"notes"`
}

// ============================================================================
// STORAGE (In-Memory Database)
// We are using Slices (dynamic arrays) to store data while the server is running.
// If the server restarts, this data is lost.
// ============================================================================

var (
	userStorage    = []User{}
	nextProductID  = 6
	productStorage = []Product{
		{ID: 1, Name: "Laptop Dell XPS 15", Category: "Electronics", Stock: 15, MinThreshold: 5, Vendor: "Dell Inc", Notes: "Premium laptop"},
		{ID: 2, Name: "iPhone 15 Pro", Category: "Electronics", Stock: 3, MinThreshold: 10, Vendor: "Apple", Notes: "Latest model"},
		{ID: 3, Name: "Office Chair", Category: "Furniture", Stock: 25, MinThreshold: 10, Vendor: "IKEA", Notes: "Ergonomic"},
		{ID: 4, Name: "Coffee Beans", Category: "Groceries", Stock: 8, MinThreshold: 20, Vendor: "Local Roastery", Notes: "Arabica"},
		{ID: 5, Name: "Printer Paper A4", Category: "Office Supplies", Stock: 50, MinThreshold: 30, Vendor: "Staples", Notes: "500 sheets/pack"},
	}
	historyStorage = []StockHistory{
		{ID: 1, ProductID: 1, ProductName: "Laptop Dell XPS 15", Action: "in", Quantity: 5, PerformedBy: "Admin", Timestamp: time.Now().Add(-24 * time.Hour).Format(time.RFC3339), Notes: "New shipment"},
		{ID: 2, ProductID: 2, ProductName: "iPhone 15 Pro", Action: "out", Quantity: 2, PerformedBy: "Admin", Timestamp: time.Now().Add(-48 * time.Hour).Format(time.RFC3339), Notes: "Sales"},
	}
)

// ============================================================================
// HELPER FUNCTIONS (Tools to make code cleaner)
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
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

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
		var newUser User
		// Decode the JSON coming from the browser into our 'User' struct
		if err := json.NewDecoder(r.Body).Decode(&newUser); err != nil {
			sendJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid data"})
			return
		}

		// Check if email already exists
		for _, u := range userStorage {
			if u.Email == newUser.Email {
				sendJSON(w, http.StatusConflict, map[string]string{"message": "Email already registered"})
				return
			}
		}
		userStorage = append(userStorage, newUser)

		fmt.Printf("User Created: %s\n", newUser.Email)
		sendJSON(w, http.StatusCreated, map[string]string{"message": "Success!"})

		// 2. LOGIN LOGIC
	} else if r.URL.Path == "/login" {
		var loginData User
		if err := json.NewDecoder(r.Body).Decode(&loginData); err != nil {
			sendJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid data"})
			return
		}

		for _, u := range userStorage {
			if u.Email == loginData.Email && u.Password == loginData.Password {
				fmt.Printf("Login: %s (%s)\n", u.Email, u.Role)
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

	// GET: Browser wants to SEE the list
	if r.Method == "GET" {
		sendJSON(w, http.StatusOK, productStorage)
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
		nextProductID++
		productStorage = append(productStorage, p)

		// Optionally add initial stock to history if stock > 0
		if p.Stock > 0 {
			historyStorage = append(historyStorage, StockHistory{
				ID:          time.Now().UnixNano(),
				ProductID:   p.ID,
				ProductName: p.Name,
				Action:      "in",
				Quantity:    p.Stock,
				PerformedBy: "System",
				Timestamp:   time.Now().Format(time.RFC3339),
				Notes:       "Initial stock",
			})
		}

		fmt.Println("--- Recent Inventory State ---")
		for _, item := range productStorage {
			fmt.Printf("ID: %d | Name: %-20s | Stock: %d | Category: %-15s | Vendor: %s\n", 
				item.ID, item.Name, item.Stock, item.Category, item.Vendor)
		}
		fmt.Println("-------------------------------")
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

	// Find the product in our storage
	var product *Product
	for i := range productStorage {
		if productStorage[i].ID == req.ProductID {
			product = &productStorage[i]
			break
		}
	}

	if product == nil {
		sendJSON(w, http.StatusNotFound, map[string]string{"message": "Product not found"})
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
		ProductID:   req.ProductID,
		ProductName: product.Name,
		Action:      req.Action,
		Quantity:    req.Quantity,
		PerformedBy: req.PerformedBy,
		Timestamp:   time.Now().Format(time.RFC3339),
		Notes:       req.Reason,
	})

	fmt.Printf("Stock Update: %s %s %d (New Stock: %d)\n", product.Name, req.Action, req.Quantity, product.Stock)
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

	sendJSON(w, http.StatusOK, historyStorage)
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
	http.ListenAndServe(":8080", nil)
}
