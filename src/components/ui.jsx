import { useEffect, useId, useState } from "react";
import Icon from "./Icon";
import { STATUS_META, stockStatus } from "../lib/format";

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon, tone = "primary", foot }) {
  return (
    <div className="card stat">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className={`stat-icon tone-${tone}`}>
          <Icon name={icon} />
        </span>
      </div>
      <div className="stat-value">{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  );
}

export function EmptyState({ icon = "box", title, text, action }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} />
      </div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

export function StockBadge({ product }) {
  const s = STATUS_META[stockStatus(product)];
  return (
    <span className={`badge badge-${s.tone}`}>
      <span className="dot" />
      {s.label}
    </span>
  );
}

export function StockMeter({ product }) {
  const status = stockStatus(product);
  // Full bar = 3x the minimum threshold (or the stock itself if no threshold is set)
  const scale = Math.max(product.minThreshold * 3, product.stock, 1);
  const pct = Math.min(100, Math.round((product.stock / scale) * 100));
  return (
    <div className={`stock-meter ${status}`} title={`${product.stock} in stock, minimum ${product.minThreshold}`}>
      <span className="num">{product.stock}</span>
      <span className="bar">
        <i style={{ width: `${Math.max(pct, product.stock > 0 ? 4 : 0)}%` }} />
      </span>
    </div>
  );
}

// Highlights every search word found in `text` (case-insensitive).
export function Highlight({ text = "", query = "" }) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length || !text) return text;
  const escaped = terms.sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  return text.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part));
}

export function Modal({ title, subtitle, onClose, children, footer, wide }) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="modal-layer" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = "Delete", onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={title}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={run} disabled={busy}>
            {busy && <Spinner />} {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ color: "var(--text-2)" }}>{message}</p>
    </Modal>
  );
}

export function PasswordInput({ id, name, value, onChange, placeholder, autoComplete, required = true, autoFocus }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-wrap has-action">
      <Icon name="lock" />
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        className="input"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        className="icon-btn input-action"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
      >
        <Icon name={show ? "eyeOff" : "eye"} />
      </button>
    </div>
  );
}

function passwordStrength(p) {
  if (!p) return 0;
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
  return Math.max(1, Math.min(4, score));
}

export function StrengthMeter({ password }) {
  const level = passwordStrength(password);
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  return (
    <div>
      <div className="strength" data-level={level}>
        <i /><i /><i /><i />
      </div>
      <div className="hint" style={{ marginTop: 6 }}>
        {password ? `${labels[level]} password${password.length < 8 ? " — use at least 8 characters" : ""}` : "At least 8 characters"}
      </div>
    </div>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99999, small }) {
  const clamp = (v) => Math.max(min, Math.min(max, v));
  return (
    <div className={`stepper ${small ? "sm" : ""}`}>
      <button type="button" onClick={() => onChange(clamp((Number(value) || min) - 1))} aria-label="Decrease">−</button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value === "" ? "" : clamp(parseInt(e.target.value, 10) || min))}
        onBlur={() => value === "" && onChange(min)}
        aria-label="Quantity"
      />
      <button type="button" onClick={() => onChange(clamp((Number(value) || 0) + 1))} aria-label="Increase">+</button>
    </div>
  );
}
