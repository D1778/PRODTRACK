import { createContext, useContext, useState, useEffect } from "react";

const AppContext = createContext();

// API_URL: In production, this comes from Vercel environment variables.
// In development, it defaults to your local Go server.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const storedUserStr = localStorage.getItem("user");
    return storedUserStr ? JSON.parse(storedUserStr) : null;
  });
  const [products, setProducts] = useState([]);
  const [stockHistory, setStockHistory] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [bills, setBills] = useState([]);
  const [salesAnalytics, setSalesAnalytics] = useState([]);

  // Helper for headers
  const getHeaders = () => {
    const userStr = localStorage.getItem("user");
    const storedUser = userStr ? JSON.parse(userStr) : {};
    return {
      "Content-Type": "application/json",
      "X-Business-Password": storedUser.businessPassword || storedUser.shopId || "",
      "X-User-Role": storedUser.role || ""
    };
  };

  // Fetch products from backend
  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/products`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  };

  // Fetch history from backend
  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/history`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setStockHistory(data);
      } else {
        setStockHistory([]);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  const fetchStaffMembers = async () => {
    try {
      const res = await fetch(`${API_URL}/staff`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setStaffMembers(data);
      }
    } catch (err) {
      console.error("Failed to fetch staff:", err);
    }
  };

  const fetchBills = async () => {
    try {
      const res = await fetch(`${API_URL}/billing`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setBills(data);
      }
    } catch (err) {
      console.error("Failed to fetch bills:", err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${API_URL}/analytics`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSalesAnalytics(data);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    }
  };

  // Load data on mount
  useEffect(() => {
    const storedUserStr = localStorage.getItem("user");
    if (storedUserStr) {
      const storedUser = JSON.parse(storedUserStr);
      setCurrentUser(storedUser);
      refreshData(storedUser);
    }
  }, []);

  const refreshData = async (user) => {
    if (!user) return;
    await fetchProducts();
    await fetchHistory();
    if (user.role === "owner") {
      await fetchStaffMembers();
      await fetchAnalytics();
    }
    await fetchBills();
  };

  const signup = async (name, email, password, role, businessName, businessPassword) => {
    try {
      const res = await fetch(`${API_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, businessName, businessPassword }),
      });
      const data = await res.json();

      if (res.status === 409) {
        return { success: false, message: data.message || "Email or Business Password already registered" };
      }
      if (!res.ok) {
        return { success: false, message: data.message || "Signup failed" };
      }

      return { success: true, message: data.message || "Account created successfully!" };
    } catch (err) {
      console.error("Signup error:", err);
      return { success: false, message: "Cannot connect to server." };
    }
  };

  const login = async (email, password, businessName, businessPassword) => {
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, businessName, businessPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, message: data.message || "Invalid credentials or Business Password" };
      }

      const user = data.user;
      setCurrentUser(user);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("isLoggedIn", "true");

      await refreshData(user);

      return { success: true, message: "Login successful", user };
    } catch (err) {
      console.error("Login error:", err);
      return { success: false, message: "Cannot connect to server." };
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
        headers: getHeaders(),
        body: JSON.stringify({
          ...product,
          performedBy: currentUser?.name || "Unknown"
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, message: data.message || "Failed to add product" };
      }

      const newProduct = await res.json();
      await fetchProducts();
      await fetchHistory();

      return { success: true, product: newProduct };
    } catch (err) {
      console.error("Add product error:", err);
      return { success: false, message: "Cannot connect to server." };
    }
  };

  const deleteProduct = async (productId) => {
    try {
      const res = await fetch(`${API_URL}/products`, {
        method: "DELETE",
        headers: getHeaders(),
        body: JSON.stringify({ id: productId }),
      });
      if (!res.ok) {
        const data = await res.json();
        return { success: false, message: data.message || "Failed to delete product" };
      }
      await fetchProducts();
      return { success: true, message: "Product deleted successfully" };
    } catch (err) {
      console.error("Error deleting product:", err);
      return { success: false, message: "Cannot connect to server." };
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
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, message: data.message || "Stock update failed" };
      }

      await fetchProducts();
      await fetchHistory();

      return { success: true, message: data.message };
    } catch (err) {
      console.error("Stock update error:", err);
      return { success: false, message: "Cannot connect to server" };
    }
  };

  const addStaffMember = async (staffData) => {
    try {
      const res = await fetch(`${API_URL}/staff`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(staffData)
      });
      if (res.ok) {
        await fetchStaffMembers();
        return { success: true, message: "Staff member added successfully" };
      }
      const data = await res.json();
      return { success: false, message: data.message };
    } catch (err) {
      console.error("Error adding staff:", err);
      return { success: false, message: "Server error" };
    }
  };

  const removeStaffMember = async (email) => {
    try {
      const res = await fetch(`${API_URL}/staff`, {
        method: "DELETE",
        headers: getHeaders(),
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        return { success: false, message: data.message || "Failed to remove staff member" };
      }
      await fetchStaffMembers();
      return { success: true, message: "Staff member removed successfully" };
    } catch (err) {
      console.error("Error removing staff:", err);
      return { success: false, message: "Cannot connect to server." };
    }
  };

  const createBill = async (billData) => {
    try {
      const res = await fetch(`${API_URL}/billing`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          ...billData,
          createdBy: currentUser?.name || "Unknown"
        })
      });
      if (res.ok) {
        await fetchProducts(); // Refresh stock
        await fetchHistory();
        await fetchBills();
        if (currentUser?.role === "owner") await fetchAnalytics();
        return { success: true };
      }
      const data = await res.json();
      return { success: false, message: data.message };
    } catch (err) {
      return { success: false, message: "Server error" };
    }
  };

  const updateProfile = async (name, newEmail, newPassword = "") => {
    try {
      const res = await fetch(`${API_URL}/profile`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ email: currentUser.email, name, newEmail, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.message || "Update failed" };
      }
      const updatedUser = data.user;
      setCurrentUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      return { success: true, message: data.message || "Profile updated!" };
    } catch (err) {
      console.error("Profile update error:", err);
      return { success: false, message: "Cannot connect to server." };
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        products,
        stockHistory,
        staffMembers,
        bills,
        salesAnalytics,
        login,
        signup,
        logout,
        addProduct,
        deleteProduct,
        updateStock,
        addStaffMember,
        removeStaffMember,
        createBill,
        refreshData,
        updateProfile
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
