import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { useApp } from "../context/AppContext";

// Account card at the bottom of the sidebar. Click it for Profile and Log out.
export default function AccountMenu({ onNavigate, onOpenChange }) {
  const { user, logout } = useApp();
  const navigate = useNavigate();
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const [pos, setPos] = useState(null); // null = closed

  const handle = "@" + (user?.email || "").split("@")[0];
  const close = () => setPos(null);

  const toggle = () => {
    if (pos) return close();
    const r = triggerRef.current.getBoundingClientRect();
    // Opens upwards from the card. A portal keeps it from being clipped by the sidebar.
    setPos({ left: r.left, bottom: window.innerHeight - r.top + 8, width: Math.max(r.width, 236) });
  };

  // The sidebar stays expanded while the menu is open, so the menu never hangs over a collapsed sidebar
  const isOpen = !!pos;
  useEffect(() => {
    onOpenChange?.(isOpen);
    return () => onOpenChange?.(false);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!pos) return;
    const onDown = (e) => !popRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target) && close();
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  const go = () => {
    close();
    onNavigate?.();
  };

  return (
    <>
      <button type="button" ref={triggerRef} className="account-card" onClick={toggle} aria-haspopup="menu" aria-expanded={!!pos} title={user?.name}>
        <span className="account-avatar">
          <Avatar className="gradient" src={user?.avatar} name={user?.name} />
          <i className="status-dot" aria-hidden="true" />
        </span>
        <span className="account-text">
          <strong>{user?.name}</strong>
          <span>{handle}</span>
        </span>
        <Icon name="chevronsUpDown" className="account-chevron" />
      </button>

      {pos &&
        createPortal(
          <div ref={popRef} className="account-pop" role="menu" style={{ left: pos.left, bottom: pos.bottom, width: pos.width }}>
            <div className="dropdown-head">
              <strong>{user?.name}</strong>
              <span>{handle}</span>
            </div>
            <Link to="/dashboard/profile" className="dropdown-item" role="menuitem" onClick={go}>
              <Icon name="user" /> Profile
            </Link>
            <button
              type="button"
              className="dropdown-item danger"
              role="menuitem"
              onClick={() => {
                close();
                logout();
                navigate("/login");
              }}
            >
              <Icon name="logout" /> Log out
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
