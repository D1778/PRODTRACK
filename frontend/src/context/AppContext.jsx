import { createContext, useContext, useState } from "react";

const AppContext = createContext();

const initialProducts = [
  { id: 1, name: "Laptop Dell XPS 15", category: "Electronics", stock: 15, minThreshold: 5, vendor: "Dell Inc", notes: "Premium laptop" },
  { id: 2, name: "iPhone 15 Pro", category: "Electronics", stock: 3, minThreshold: 10, vendor: "Apple", notes: "Latest model" },
  { id: 3, name: "Office Chair", category: "Furniture", stock: 25, minThreshold: 10, vendor: "IKEA", notes: "Ergonomic" },
  { id: 4, name: "Coffee Beans", category: "Groceries", stock: 8, minThreshold: 20, vendor: "Local Roastery", notes: "Arabica" },
  { id: 5, name: "Printer Paper A4", category: "Office Supplies", stock: 50, minThreshold: 30, vendor: "Staples", notes: "500 sheets/pack" },
];

const initialHistory = [
  { id: 1, productId: 1, productName: "Laptop Dell XPS 15", action: "in", quantity: 5, performedBy: "Admin", timestamp: new Date().toISOString(), notes: "New shipment" },
  { id: 2, productId: 2, productName: "iPhone 15 Pro", action: "out", quantity: 2, performedBy: "Admin", timestamp: new Date(Date.now() - 86400000).toISOString(), notes: "Sales" },
];

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [products, setProducts] = useState(initialProducts);
  const [stockHistory, setStockHistory] = useState(initialHistory);

  const login = (email, password, role) => {
    const name = email.split("@")[0];
    const user = { name, email, role };
    setCurrentUser(user);
    localStorage.setItem("isLoggedIn", "true");
    return user;
  };

  const signup = (name, email, password, role) => {
    // In a real app this would call an API
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem("isLoggedIn");
  };

  const addProduct = (product) => {
    const newProduct = { ...product, id: Date.now() };
    setProducts((prev) => [...prev, newProduct]);

    if (newProduct.stock > 0) {
      const entry = {
        id: Date.now(),
        productId: newProduct.id,
        productName: newProduct.name,
        action: "in",
        quantity: newProduct.stock,
        performedBy: currentUser?.name || "Unknown",
        timestamp: new Date().toISOString(),
        notes: "Initial stock",
      };
      setStockHistory((prev) => [...prev, entry]);
    }
    return newProduct;
  };

  const updateStock = (productId, action, quantity, reason) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return { success: false, message: "Product not found" };

    if (action === "out" && product.stock < quantity) {
      return { success: false, message: `Insufficient stock. Available: ${product.stock}` };
    }

    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, stock: action === "in" ? p.stock + quantity : p.stock - quantity }
          : p
      )
    );

    const entry = {
      id: Date.now(),
      productId: product.id,
      productName: product.name,
      action,
      quantity,
      performedBy: currentUser?.name || "Unknown",
      timestamp: new Date().toISOString(),
      notes: reason || "",
    };
    setStockHistory((prev) => [...prev, entry]);

    return { success: true, message: `Stock ${action === "in" ? "added" : "removed"} successfully!` };
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
