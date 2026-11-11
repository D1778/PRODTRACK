import { NavLink } from "react-router-dom";
import Icon from "./Icon";
import { useApp } from "../context/AppContext";
import { initials } from "../lib/format";

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
      { to: "/dashboard/profile", label: "Profile", icon: "settings" },
    ],
  },
];

export default function Sidebar({ onNavigate }) {
  const { user, isOwner, products } = useApp();
  const alertCount = products.filter((p) => p.stock <= p.minThreshold).length;

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar-brand">
        <span className="brand-mark">
          <Icon name="logo" />
        </span>
        <span className="brand-name">
          PRODTRACK
          <small>Inventory & Billing</small>
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
        <div className="business-chip" title={user?.businessName}>
          <span className="avatar">{initials(user?.businessName)}</span>
          <div>
            <strong>{user?.businessName}</strong>
            <span>{isOwner ? "Owner workspace" : "Staff workspace"}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
