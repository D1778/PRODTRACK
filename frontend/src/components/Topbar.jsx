import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

const pages = {
  "/dashboard": "Dashboard",
  "/dashboard/products": "Products",
  "/dashboard/add-product": "Add New Product",
  "/dashboard/stock": "Stock Management",
  "/dashboard/history": "History",
  "/dashboard/alerts": "Alerts",
  "/dashboard/profile": "Profile",
};

export default function Topbar() {
  const { currentUser, logout } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const title = pages[location.pathname] || "Dashboard";
  const initial = currentUser?.name?.charAt(0)?.toUpperCase() || "U";

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <h1 className="page-title">{title}</h1>
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
