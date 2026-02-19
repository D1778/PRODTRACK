import { createContext, useContext, useState, useEffect } from "react";

const AppContext = createContext();

const API_URL = "http://localhost:8080";

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [stockHistory, setStockHistory] = useState([]);

  // Fetch products from backend
  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/products`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  };

  // Fetch history from backend
  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/history`);
      if (res.ok) {
        const data = await res.json();
        setStockHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  // Load data on mount
  useEffect(() => {
    fetchProducts();
    fetchHistory();
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
  }, []);

  const signup = async (name, email, password, role) => {
    try {
      const res = await fetch(`${API_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();

      if (res.status === 409) {
        return { success: false, message: data.message || "Email already registered" };
      }
      if (!res.ok) {
        return { success: false, message: data.message || "Signup failed" };
      }

      return { success: true, message: data.message || "Account created successfully!" };
    } catch (err) {
      console.error("Signup error:", err);
      return { success: false, message: "Cannot connect to server. Is the backend running?" };
    }
  };

  const login = async (email, password, role) => {
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, message: data.message || "Invalid credentials" };
      }

      const user = data.user;
      setCurrentUser(user);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("isLoggedIn", "true");

      // Refresh data after login
      await fetchProducts();
      await fetchHistory();

      return { success: true, message: "Login successful", user };
    } catch (err) {
      console.error("Login error:", err);
      return { success: false, message: "Cannot connect to server. Is the backend running?" };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("isLoggedIn");
  };

  const addProduct = async (product) => {
    try {
      const res = await fetch(`${API_URL}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, message: data.message || "Failed to add product" };
      }

      const newProduct = await res.json();

      // Refresh local state to ensure sync
      await fetchProducts();
      await fetchHistory();

      return { success: true, product: newProduct };
    } catch (err) {
      console.error("Add product error:", err);
      return { success: false, message: "Cannot connect to server. Is the backend running?" };
    }
  };

  const updateStock = async (productId, action, quantity, reason) => {
    try {
      const payload = {
        productId,
        action,
        quantity,
        reason,
        performedBy: currentUser?.name || "Unknown"
      };

      const res = await fetch(`${API_URL}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, message: data.message || "Stock update failed" };
      }

      // Refresh data
      await fetchProducts();
      await fetchHistory();

      return { success: true, message: data.message };

    } catch (err) {
      console.error("Stock update error:", err);
      return { success: false, message: "Cannot connect to server" };
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        products,
        stockHistory,
        login,
        signup,
        logout,
        addProduct,
        updateStock,
        fetchProducts,
        fetchHistory
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
