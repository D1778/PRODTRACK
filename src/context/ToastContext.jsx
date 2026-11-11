import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon";

const ToastContext = createContext(null);
const ICONS = { success: "checkCircle", error: "alertCircle", info: "info" };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback(
    (message, type = "success") => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-3), { id, message, type }]);
      setTimeout(() => dismiss(id), type === "error" ? 6000 : 3500);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (m) => show(m, "success"),
      error: (m) => show(m, "error"),
      info: (m) => show(m, "info"),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <Icon name={ICONS[t.type]} />
            <div>{t.message}</div>
            <button className="icon-btn toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <Icon name="x" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
