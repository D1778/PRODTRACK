import { useState } from "react";
import { NavLink } from "react-router-dom";
import AccountMenu from "./AccountMenu";
import Icon from "./Icon";
import { useApp } from "../context/AppContext";

const SECTIONS = [
  {
    title: "Overview",
    items: [{ to: "/dashboard", label: "Dashboard", icon: "dashboard", end: true }],
  },
  {
    title: "Sales",
    items: [{ to: "/dashboard/billing", label: "Billing", icon: "receipt" }],
  },
  {
    title: "Inventory",
    items: [
      { to: "/dashboard/products", label: "Products", icon: "box" },
      { to: "/dashboard/stock", label: "Stock In / Out", icon: "swap" },
      { to: "/dashboard/alerts", label: "Alerts", icon: "bell", badge: "alerts" },
      { to: "/dashboard/history", label: "History", icon: "history" },
    ],
  },
  {
    title: "Business",
    items: [
      { to: "/dashboard/logbook", label: "Log book", icon: "calendar", owner: true },
      { to: "/dashboard/staff", label: "Staff", icon: "users", owner: true },
    ],
  },
];

export default function Sidebar({ pinned, onTogglePinned, onNavigate }) {
  const { isOwner, products } = useApp();
  const [menuOpen, setMenuOpen] = useState(false); // the account menu is open: keep the sidebar expanded
  const alertCount = products.filter((p) => p.stock <= p.minThreshold).length;

  return (
    <aside className={`sidebar ${menuOpen ? "menu-open" : ""}`} aria-label="Main navigation">
      <div className="sidebar-head">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onTogglePinned}
          aria-pressed={pinned}
          aria-label={pinned ? "Unpin sidebar (let it float)" : "Pin sidebar open"}
          title={pinned ? "Unpin sidebar (let it float)" : "Pin sidebar open"}
        >
          <Icon name="menu" />
        </button>
        <span className="sidebar-head-label">
          <i aria-hidden="true" />
          Main Menu
        </span>
      </div>

      <nav className="nav">
        {SECTIONS.map((section) => {
          const items = section.items.filter((i) => !i.owner || isOwner);
          if (!items.length) return null;
          return (
            <div key={section.title}>
              <div className="sidebar-section">{section.title}</div>
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                  title={item.label}
                  onClick={onNavigate}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  {item.badge === "alerts" && alertCount > 0 && <em className="nav-count">{alertCount}</em>}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <AccountMenu onNavigate={onNavigate} onOpenChange={setMenuOpen} />
      </div>
    </aside>
  );
}
