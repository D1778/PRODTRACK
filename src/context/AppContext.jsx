import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, onUnauthorized, tokenStore } from "../lib/api";

const AppContext = createContext(null);

const EMPTY = { products: [], history: [], bills: [], staff: [], analytics: { daily: [], topProducts: [] } };

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  // "checking" while we validate a saved token on startup
  const [status, setStatus] = useState(() => (tokenStore.get() ? "checking" : "guest"));
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setData(EMPTY);
    setStatus("guest");
  }, []);

  // Any 401 from the API (expired token, removed account) signs the user out.
  useEffect(() => onUnauthorized(logout), [logout]);

  const loadAll = useCallback(async (u, { silent = false } = {}) => {
    if (!u) return;
    if (!silent) setLoading(true);
    const owner = u.role === "owner";
    const tz = new Date().getTimezoneOffset();
    const [products, history, bills, staff, analytics] = await Promise.allSettled([
      api("/products"),
      api("/history"),
      api("/billing"),
      owner ? api("/staff") : Promise.resolve([]),
      owner ? api(`/analytics?tzOffset=${tz}`) : Promise.resolve(EMPTY.analytics),
    ]);
    const pick = (r, fallback) => (r.status === "fulfilled" && r.value ? r.value : fallback);
    setData((prev) => ({
      // On a failed request keep what we had instead of blanking the screen
      products: pick(products, prev.products),
      history: pick(history, prev.history),
      bills: pick(bills, prev.bills),
      staff: pick(staff, prev.staff),
      analytics: pick(analytics, prev.analytics),
    }));
    if (!silent) setLoading(false);
  }, []);

  // Keep every screen in sync with changes made by other people: refresh in
  // the background every 15 s while the tab is visible, and on returning to it.
  useEffect(() => {
    if (status !== "authed" || !user) return;
    const tick = () => document.visibilityState === "visible" && loadAll(user, { silent: true });
    const id = setInterval(tick, 15000);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, [status, user, loadAll]);

  // Restore the session from a saved token. If the backend is still starting
  // (network error / proxy 5xx), keep retrying instead of logging the user out.
  useEffect(() => {
    if (status !== "checking") return;
    let cancelled = false;
    let timer;
    const attempt = (tries) =>
      api("/auth/me")
        .then(({ user }) => {
          if (cancelled) return;
          setUser(user);
          setStatus("authed");
          loadAll(user);
        })
        .catch((err) => {
          if (cancelled) return;
          const backendStarting = err.status === 0 || err.status >= 500;
          if (backendStarting && tries < 30) timer = setTimeout(() => attempt(tries + 1), 1000);
          else logout();
        });
    attempt(0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [status, loadAll, logout]);

  const startSession = useCallback(
    async ({ token, user }) => {
      tokenStore.set(token);
      setUser(user);
      setStatus("authed");
      await loadAll(user);
      return user;
    },
    [loadAll]
  );

  const actions = useMemo(() => {
    const refresh = () => loadAll(user);
    const quietRefresh = () => loadAll(user, { silent: true });

    return {
      refresh,
      login: async (email, password) => startSession(await api("/auth/login", { method: "POST", body: { email, password } })),
      signup: async (form) => startSession(await api("/auth/signup", { method: "POST", body: form })),
      logout,

      updateProfile: async (form) => {
        const res = await api("/auth/profile", { method: "PUT", body: form });
        setUser(res.user);
        return res;
      },

      addProduct: async (product) => {
        const created = await api("/products", { method: "POST", body: product });
        await quietRefresh();
        return created;
      },
      // Throws ApiError 409 with err.data.current when someone else saved first
      updateProduct: async (id, product) => {
        try {
          const updated = await api(`/products/${id}`, { method: "PUT", body: product });
          setData((d) => ({ ...d, products: d.products.map((p) => (p.id === id ? updated : p)) }));
          quietRefresh();
          return updated;
        } catch (err) {
          if (err.status === 409 || err.status === 404) quietRefresh();
          throw err;
        }
      },
      deleteProduct: async (id) => {
        try {
          await api(`/products/${id}`, { method: "DELETE" });
          setData((d) => ({ ...d, products: d.products.filter((p) => p.id !== id) }));
        } finally {
          quietRefresh();
        }
      },
      updateStock: async (payload) => {
        try {
          return await api("/stock", { method: "POST", body: payload });
        } finally {
          await quietRefresh(); // show the real stock, including other people's changes
        }
      },
      fetchLogbook: (date) => api(`/logbook?date=${date}&tzOffset=${new Date().getTimezoneOffset()}`),

      addStaff: async (form) => {
        const created = await api("/staff", { method: "POST", body: form });
        setData((d) => ({ ...d, staff: [...d.staff, created].sort((a, b) => a.name.localeCompare(b.name)) }));
        return created;
      },
      removeStaff: async (id) => {
        await api(`/staff/${id}`, { method: "DELETE" });
        setData((d) => ({ ...d, staff: d.staff.filter((s) => s.id !== id) }));
      },

      createBill: async (items) => {
        try {
          return await api("/billing", { method: "POST", body: { items } });
        } finally {
          await quietRefresh(); // on failure too: stock may have changed under us
        }
      },
    };
  }, [user, loadAll, startSession, logout]);

  const value = useMemo(
    () => ({
      user,
      status,
      loading,
      isOwner: user?.role === "owner",
      ...data,
      ...actions,
    }),
    [user, status, loading, data, actions]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
