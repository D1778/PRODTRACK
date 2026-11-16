import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

const KEY = "prodtrack.sidebar";

export default function Dashboard() {
  // Floating by default: a slim rail that expands over the page on hover.
  // Pinned: stays open and the page makes room for it.
  const [pinned, setPinned] = useState(() => {
    try { return localStorage.getItem(KEY) === "pinned"; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const togglePinned = () =>
    setPinned((p) => {
      try { localStorage.setItem(KEY, p ? "floating" : "pinned"); } catch { /* storage unavailable */ }
      return !p;
    });

  return (
    <div className={`app ${pinned ? "pinned" : "floating"} ${mobileOpen ? "mobile-open" : ""}`}>
      <Sidebar pinned={pinned} onTogglePinned={togglePinned} onNavigate={() => setMobileOpen(false)} />
      {mobileOpen && <div className="backdrop" onClick={() => setMobileOpen(false)} />}
      <div className="main">
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <main className="content" key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
