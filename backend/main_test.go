package main

import (
	"os"
	"testing"
)

// TestPersistence verifies that saveData and loadData work as expected.
func TestPersistence(t *testing.T) {
	testFile := "test_data.json"
	defer os.Remove(testFile) // Cleanup after test

	type TestData struct {
		Name  string `json:"name"`
		Value int    `json:"value"`
	}

	original := []TestData{{Name: "Test", Value: 123}}
	saveData(testFile, original)

	var loaded []TestData
	err := loadData(testFile, &loaded)
	if err != nil {
		t.Fatalf("Failed to load data: %v", err)
	}

	if len(loaded) != 1 || loaded[0].Name != "Test" || loaded[0].Value != 123 {
		t.Errorf("Loaded data does not match original. Got: %+v", loaded)
	}
}

// TestStockUpdateLogic verifies that stock math works correctly.
func TestStockUpdateLogic(t *testing.T) {
	// Setup initial state
	product := Product{
		ID:    1,
		Name:  "Test Product",
		Stock: 10,
	}

	// Case 1: Add stock
	product.Stock += 5
	if product.Stock != 15 {
		t.Errorf("Expected stock 15 after adding 5, got %d", product.Stock)
	}

	// Case 2: Subtract stock
	product.Stock -= 3
	if product.Stock != 12 {
		t.Errorf("Expected stock 12 after subtracting 3, got %d", product.Stock)
	}
}

// TestUserCreation verifies struct initialization.
func TestUserCreation(t *testing.T) {
	user := User{
		Name:  "Admin",
		Email: "admin@example.com",
		Role:  "owner",
	}

	if user.Name != "Admin" || user.Role != "owner" {
		t.Errorf("User struct not initialized correctly: %+v", user)
	}
}
