import { NavLink } from "react-router-dom";
import { useApp } from "../context/AppContext";

const nav = [
  { to: "/dashboard", label: "📊 Dashboard", end: true },
  { to: "/dashboard/products", label: "📦 Products" },
  { to: "/dashboard/stock", label: "🔄 Stock Management" },
  { to: "/dashboard/history", label: "📜 History" },
  { to: "/dashboard/alerts", label: "🔔 Alerts" },
  { to: "/dashboard/profile", label: "👤 Profile" },
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
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
