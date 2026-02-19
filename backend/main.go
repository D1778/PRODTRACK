package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// ======================== STRUCTS ========================

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
	Action      string `json:"action"` // "in" or "out"
	Quantity    int    `json:"quantity"`
	PerformedBy string `json:"performedBy"`
	Timestamp   string `json:"timestamp"`
	Notes       string `json:"notes"`
}

// ======================== STORAGE ========================

var (
	mu             sync.Mutex
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

// ======================== HELPER FUNCTIONS ========================

func enableCORS(w *http.ResponseWriter) {
	(*w).Header().Set("Access-Control-Allow-Origin", "*")
	(*w).Header().Set("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS")
	(*w).Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

func jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// printProducts is a VARIADIC function that prints details for any number of products
func printProducts(products ...Product) {
	fmt.Printf("\n====== Printing %d Product(s) ======\n", len(products))
	for _, p := range products {
		fmt.Printf("ID:            %d\n", p.ID)
		fmt.Printf("Name:          %s\n", p.Name)
		fmt.Printf("Category:      %s\n", p.Category)
		fmt.Printf("Stock:         %d\n", p.Stock)
		fmt.Printf("Min Threshold: %d\n", p.MinThreshold)
		fmt.Printf("Vendor:        %s\n", p.Vendor)
		fmt.Printf("Notes:         %s\n", p.Notes)
		fmt.Println("-----------------------------------")
	}
	fmt.Println("===================================")
}

// ======================== HANDLERS ========================

func authHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(&w)
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != "POST" {
		jsonResponse(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}

	if r.URL.Path == "/signup" {
		var newUser User
		if err := json.NewDecoder(r.Body).Decode(&newUser); err != nil {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"message": "Invalid request body"})
			return
		}
		mu.Lock()
		for _, u := range userStorage {
			if u.Email == newUser.Email {
				mu.Unlock()
				jsonResponse(w, http.StatusConflict, map[string]string{"message": "Email already registered"})
				return
			}
		}
		userStorage = append(userStorage, newUser)
		mu.Unlock()
		fmt.Printf("✅ Registered: %s (%s)\n", newUser.Name, newUser.Email)
		jsonResponse(w, http.StatusCreated, map[string]string{"message": "Account created successfully"})

	} else if r.URL.Path == "/login" {
		var loginData User
		if err := json.NewDecoder(r.Body).Decode(&loginData); err != nil {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"message": "Invalid request body"})
			return
		}
		mu.Lock()
		defer mu.Unlock()
		for _, u := range userStorage {
			if u.Email == loginData.Email && u.Password == loginData.Password && u.Role == loginData.Role {
				fmt.Printf("✅ Login: %s (%s)\n", u.Email, u.Role)
				jsonResponse(w, http.StatusOK, map[string]interface{}{
					"message": "Login successful",
					"user":    u,
				})
				return
			}
		}
		jsonResponse(w, http.StatusUnauthorized, map[string]string{"message": "Invalid credentials"})
	}
}

func productsHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(&w)
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	mu.Lock()
	defer mu.Unlock()

	if r.Method == "GET" {
		printProducts(productStorage...) // Variadic call with slice expansion
		jsonResponse(w, http.StatusOK, productStorage)
		return
	}

	if r.Method == "POST" {
		var newProduct Product
		if err := json.NewDecoder(r.Body).Decode(&newProduct); err != nil {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"message": "Invalid request body"})
			return
		}
		newProduct.ID = nextProductID
		nextProductID++
		productStorage = append(productStorage, newProduct)

		if newProduct.Stock > 0 {
			historyStorage = append(historyStorage, StockHistory{
				ID:          time.Now().UnixNano(),
				ProductID:   newProduct.ID,
				ProductName: newProduct.Name,
				Action:      "in",
				Quantity:    newProduct.Stock,
				PerformedBy: "System",
				Timestamp:   time.Now().Format(time.RFC3339),
				Notes:       "Initial stock",
			})
		}

		printProducts(newProduct) // Variadic call with single item
		jsonResponse(w, http.StatusCreated, newProduct)
		return
	}

	jsonResponse(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
}

func stockHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(&w)
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != "POST" {
		jsonResponse(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
		return
	}

	var req struct {
		ProductID   int    `json:"productId"`
		Action      string `json:"action"`
		Quantity    int    `json:"quantity"`
		Reason      string `json:"reason"`
		PerformedBy string `json:"performedBy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"message": "Invalid request"})
		return
	}

	mu.Lock()
	defer mu.Unlock()

	var product *Product
	for i := range productStorage {
		if productStorage[i].ID == req.ProductID {
			product = &productStorage[i]
			break
		}
	}

	if product == nil {
		jsonResponse(w, http.StatusNotFound, map[string]string{"message": "Product not found"})
		return
	}

	if req.Action == "out" {
		if product.Stock < req.Quantity {
			jsonResponse(w, http.StatusBadRequest, map[string]string{
				"message": fmt.Sprintf("Insufficient stock. Available: %d", product.Stock),
			})
			return
		}
		product.Stock -= req.Quantity
	} else if req.Action == "in" {
		product.Stock += req.Quantity
	} else {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"message": "Invalid action"})
		return
	}

	historyStorage = append(historyStorage, StockHistory{
		ID:          time.Now().UnixNano(),
		ProductID:   product.ID,
		ProductName: product.Name,
		Action:      req.Action,
		Quantity:    req.Quantity,
		PerformedBy: req.PerformedBy,
		Timestamp:   time.Now().Format(time.RFC3339),
		Notes:       req.Reason,
	})

	fmt.Printf("📦 Stock Update: %s %s %d (New Stock: %d)\n", product.Name, req.Action, req.Quantity, product.Stock)
	printProducts(*product) // Variadic call with single item

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Stock %s successful", req.Action),
		"product": product,
	})
}

func historyHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(&w)
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method == "GET" {
		mu.Lock()
		defer mu.Unlock()
		jsonResponse(w, http.StatusOK, historyStorage)
		return
	}
	jsonResponse(w, http.StatusMethodNotAllowed, map[string]string{"message": "Method not allowed"})
}

func main() {
	http.HandleFunc("/signup", authHandler)
	http.HandleFunc("/login", authHandler)
	http.HandleFunc("/products", productsHandler)
	http.HandleFunc("/stock", stockHandler)
	http.HandleFunc("/history", historyHandler)

	fmt.Println("🚀 ProdTrack Backend running at http://localhost:8080")
	fmt.Println("   Routes: /signup, /login, /products, /stock, /history")
	http.ListenAndServe(":8080", nil)
}
