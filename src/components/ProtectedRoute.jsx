import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import Logo from "./Logo";

function Splash() {
  return (
    <div className="splash" aria-busy="true" aria-label="Loading">
      <span className="brand-mark">
        <Logo />
      </span>
    </div>
  );
}

// Only logged-in users; optionally restricted to certain roles.
export default function ProtectedRoute({ children, roles }) {
  const { status, user } = useApp();
  const location = useLocation();
  if (status === "checking") return <Splash />;
  if (status !== "authed") return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

// Login/signup pages: send already logged-in users to the dashboard.
export function GuestRoute({ children }) {
  const { status } = useApp();
  if (status === "checking") return <Splash />;
  if (status === "authed") return <Navigate to="/dashboard" replace />;
  return children;
}
