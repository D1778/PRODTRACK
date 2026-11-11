import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

const KEY = "prodtrack.sidebar";

export default function Dashboard() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(KEY) === "collapsed"; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const toggle = () =>
    setCollapsed((c) => {
      try { localStorage.setItem(KEY, c ? "open" : "collapsed"); } catch { /* storage unavailable */ }
      return !c;
    });

  return (
    <div className={`app ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      <Sidebar onNavigate={() => setMobileOpen(false)} />
      {mobileOpen && <div className="backdrop" onClick={() => setMobileOpen(false)} />}
      <div className="main">
        <Topbar onToggleSidebar={toggle} onOpenMobile={() => setMobileOpen(true)} />
        <main className="content" key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
