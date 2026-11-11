import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Icon from "./Icon";
import { useApp } from "../context/AppContext";
import { initials } from "../lib/format";
import ThemeSwitch from "./ThemeSwitch";

const TITLES = {
  "/dashboard": ["Dashboard", "Overview"],
  "/dashboard/billing": ["Billing", "Sales"],
  "/dashboard/products": ["Products", "Inventory"],
  "/dashboard/add-product": ["Add product", "Inventory"],
  "/dashboard/stock": ["Stock In / Out", "Inventory"],
  "/dashboard/alerts": ["Alerts", "Inventory"],
  "/dashboard/history": ["History", "Inventory"],
  "/dashboard/logbook": ["Log book", "Business"],
  "/dashboard/staff": ["Staff", "Business"],
  "/dashboard/profile": ["Profile", "Business"],
};

export default function Topbar({ onToggleSidebar, onOpenMobile }) {
  const { user, logout, refresh, loading } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const path = location.pathname.replace(/\/$/, "");
  const [title, crumb] = TITLES[path] || (path.includes("/edit") ? ["Edit product", "Inventory"] : ["Dashboard", "Overview"]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !menuRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="topbar">
      <button className="icon-btn menu-btn-mobile" onClick={onOpenMobile} aria-label="Open menu">
        <Icon name="menu" />
      </button>
      <button className="icon-btn menu-btn-desktop" onClick={onToggleSidebar} aria-label="Collapse sidebar">
        <Icon name="sidebar" />
      </button>
      <div>
        <div className="topbar-crumb">{crumb}</div>
        <div className="topbar-title">{title}</div>
      </div>

      <div className="topbar-right">
        <button className="icon-btn" onClick={refresh} aria-label="Refresh data" title="Refresh data" disabled={loading}>
          {loading ? <span className="spinner" /> : <Icon name="refresh" />}
        </button>
        <ThemeSwitch />

        <div className="user-menu" ref={menuRef}>
          <button className="user-trigger" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
            <span className="avatar gradient">{initials(user?.name)}</span>
            <span className="who">
              <strong>{user?.name}</strong>
              <span>{user?.role}</span>
            </span>
          </button>
          {open && (
            <div className="dropdown" role="menu">
              <div className="dropdown-head">
                <strong>{user?.name}</strong>
                <span>{user?.email}</span>
              </div>
              <Link to="/dashboard/profile" className="dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
                <Icon name="user" /> Profile & security
              </Link>
              <button
                className="dropdown-item danger"
                role="menuitem"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
              >
                <Icon name="logout" /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
