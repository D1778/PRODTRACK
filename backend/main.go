package main

import (
    "encoding/json"
    "fmt"
    "net/http"
)

// Unit-1: Custom Type updated with 'Role'
type User struct {
    Name     string `json:"name"`
    Email    string `json:"email"`
    Password string `json:"password"`
    Role     string `json:"role"` // New field to distinguish Owner/Staff
}

var userStorage = []User{}

func enableCORS(w *http.ResponseWriter) {
    (*w).Header().Set("Access-Control-Allow-Origin", "*")
    (*w).Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    (*w).Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

func signupHandler(w http.ResponseWriter, r *http.Request) {
    enableCORS(&w)
    if r.Method == "OPTIONS" { return }

    if r.Method == "POST" {
        var newUser User
        json.NewDecoder(r.Body).Decode(&newUser)

        // Redundancy Check
        for _, existing := range userStorage {
            if existing.Email == newUser.Email {
                w.WriteHeader(http.StatusConflict)
                return
            }
        }

        userStorage = append(userStorage, newUser)
        fmt.Printf("Registered: %s as %s\n", newUser.Email, newUser.Role)
        w.WriteHeader(http.StatusOK)
    }
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
    enableCORS(&w)
    if r.Method == "OPTIONS" { return }

    if r.Method == "POST" {
        var loginData User
        json.NewDecoder(r.Body).Decode(&loginData)

        // Unit-1 & 2 Logic: Now verifying the Role as well
        found := false
        for _, u := range userStorage {
            // SUCCESS ONLY IF Email, Password, AND Role match
            if u.Email == loginData.Email && u.Password == loginData.Password && u.Role == loginData.Role {
                found = true
                break
            }
        }

        if found {
            w.WriteHeader(http.StatusOK)
            fmt.Printf("Login Successful: %s logged in as %s\n", loginData.Email, loginData.Role)
        } else {
            w.WriteHeader(http.StatusUnauthorized)
            fmt.Printf("Login Denied: Role mismatch or wrong credentials for %s\n", loginData.Email)
        }
    }
}

func main() {
    http.HandleFunc("/signup", signupHandler)
    http.HandleFunc("/login", loginHandler)
    fmt.Println("Backend running at http://localhost:8080")
    http.ListenAndServe(":8080", nil)
}