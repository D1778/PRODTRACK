// Small fetch wrapper for the ProdTrack API.
// - Adds the JWT as "Authorization: Bearer <token>"
// - Turns error responses into ApiError with the server's message
// - Calls the registered handler when the session is no longer valid (401)

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const TOKEN_KEY = "prodtrack.token";

export const tokenStore = {
  get() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable */ }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      // Clean up keys used by older versions of the app
      localStorage.removeItem("user");
      localStorage.removeItem("isLoggedIn");
    } catch { /* storage unavailable */ }
  },
};

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.status = status;
    this.data = data; // full error body, e.g. { code: "version_conflict", current: {...} }
  }
}

let unauthorizedHandler = null;
export function onUnauthorized(fn) {
  unauthorizedHandler = fn;
}

export async function api(path, { method = "GET", body, signal } = {}) {
  const token = tokenStore.get();
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError("Can't reach the server. Check that the backend is running.", 0);
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }

  if (!res.ok) {
    if (res.status === 401 && token && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(data?.message || `Request failed (${res.status})`, res.status, data);
  }
  return data;
}
