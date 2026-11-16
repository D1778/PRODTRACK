import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Avatar from "./Avatar";
import BusinessProfileModal from "./BusinessProfileModal";
import Icon from "./Icon";
import { useApp } from "../context/AppContext";
import Logo from "./Logo";
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
  "/dashboard/password": ["Change password", "Business"],
};

export default function Topbar({ onOpenMobile }) {
  const { user, isOwner, refresh, loading } = useApp();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const path = location.pathname.replace(/\/$/, "");
  // Only the section (Sales, Inventory, Business...) is shown here; the page has its own title
  const [, section] = TITLES[path] || (path.includes("/edit") ? ["Edit product", "Inventory"] : ["Dashboard", "Overview"]);

  return (
    <header className="topbar">
      <button className="icon-btn menu-btn-mobile" onClick={onOpenMobile} aria-label="Open menu">
        <Icon name="menu" />
      </button>
      <Link to="/dashboard" className="topbar-brand" aria-label="ProdTrack home">
        <span className="brand-mark">
          <Logo />
        </span>
        <span className="brand-name">PRODTRACK</span>
      </Link>
      <div className="topbar-title">{section}</div>

      <div className="topbar-right">
        <button className="icon-btn" onClick={refresh} aria-label="Refresh data" title="Refresh data" disabled={loading}>
          {loading ? <span className="spinner" /> : <Icon name="refresh" />}
        </button>
        <ThemeSwitch />

        <button type="button" className="topbar-business" onClick={() => setOpen(true)} aria-haspopup="dialog" title="Business profile">
          <Avatar className="gradient" src={user?.businessLogo} name={user?.businessName} />
          <span className="who">
            <strong>{user?.businessName}</strong>
            <span>{isOwner ? "Owner workspace" : "Staff workspace"}</span>
          </span>
        </button>
      </div>
      {open && <BusinessProfileModal onClose={() => setOpen(false)} />}
    </header>
  );
}
