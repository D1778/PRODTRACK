import { NavLink } from "react-router-dom";
import { useApp } from "../context/AppContext";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: "📊", end: true },
  { to: "/dashboard/products", label: "Products", icon: "📦" },
  { to: "/dashboard/stock", label: "Stock Management", icon: "📥" },
  { to: "/dashboard/history", label: "History", icon: "📋" },
  { to: "/dashboard/alerts", label: "Alerts", icon: "🔔" },
  { to: "/dashboard/profile", label: "Profile", icon: "👤" },
];

export default function Sidebar() {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-logo">📦 PRODTRACK</h2>
        <p className="sidebar-subtitle">Inventory Management</p>
      </div>
      <nav className="nav-menu">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
