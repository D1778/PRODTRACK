import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

const pages = {
  "/dashboard": { title: "Dashboard", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-6M6 20V10M18 20V4" /></svg> },
  "/dashboard/products": { title: "Products", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg> },
  "/dashboard/add-product": { title: "Add New Product", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg> },
  "/dashboard/stock": { title: "Stock Management", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg> },
  "/dashboard/history": { title: "History", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18 9l-5 5-3-3-4 4" /></svg> },
  "/dashboard/alerts": { title: "Alerts", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg> },
  "/dashboard/profile": { title: "Profile & Feedback", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
};

export default function Topbar() {
  const { currentUser, logout } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const pageInfo = pages[location.pathname] || { title: "Dashboard", icon: null };
  const initial = currentUser?.name?.charAt(0)?.toUpperCase() || "U";

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--primary)' }}>
          {pageInfo.icon} {pageInfo.title}
        </h1>
      </div>
      <div className="top-bar-right">
        <div className="user-info">
          <div className="user-avatar">{initial}</div>
          <div className="user-details">
            <div className="user-name">{currentUser?.name || "User"}</div>
            <div className="user-role">{currentUser?.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : "Staff"}</div>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={() => { logout(); navigate("/"); }}>Logout</button>
      </div>
    </div>
  );
}
