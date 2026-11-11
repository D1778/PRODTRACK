// Theme store: "light", "dark" or "system" (follow the OS setting).
// Every theme switch on the page subscribes, so they all stay in sync.
import { useSyncExternalStore } from "react";

const KEY = "prodtrack.theme";
const listeners = new Set();
const media = typeof window !== "undefined" ? window.matchMedia?.("(prefers-color-scheme: dark)") : null;

function readPreference() {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

let preference = readPreference();

const resolved = () => (preference === "system" ? (media?.matches ? "dark" : "light") : preference);

function apply() {
  const root = document.documentElement;
  if (preference === "system") delete root.dataset.theme;
  else root.dataset.theme = preference;
  listeners.forEach((l) => l());
}

media?.addEventListener?.("change", () => preference === "system" && apply());

function setThemePreference(next) {
  preference = next;
  try {
    if (next === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    /* storage unavailable */
  }
  apply();
}

let snapshot = `${preference}|${resolved()}`;
function getSnapshot() {
  const next = `${preference}|${resolved()}`;
  if (next !== snapshot) snapshot = next;
  return snapshot;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Returns { preference: "light"|"dark"|"system", theme: "light"|"dark", setPreference, toggle } */
export function useTheme() {
  const [pref, theme] = useSyncExternalStore(subscribe, getSnapshot, getSnapshot).split("|");
  return {
    preference: pref,
    theme,
    setPreference: setThemePreference,
    toggle: () => setThemePreference(theme === "dark" ? "light" : "dark"),
  };
}
