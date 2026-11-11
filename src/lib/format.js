const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const inrCompact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });
const num = new Intl.NumberFormat("en-IN");

export const money = (v) => inr.format(Number(v) || 0);
export const moneyCompact = (v) => inrCompact.format(Number(v) || 0);
export const number = (v) => num.format(Number(v) || 0);

export const date = (v) => new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const dateTime = (v) =>
  new Date(v).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const time = (v) => new Date(v).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
export function relativeTime(v) {
  const diff = (new Date(v).getTime() - Date.now()) / 1000;
  const steps = [[60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.345, "week"], [12, "month"], [Infinity, "year"]];
  let value = diff;
  for (const [size, unit] of steps) {
    if (Math.abs(value) < size) return rtf.format(Math.round(value), unit);
    value /= size;
  }
  return "";
}

// Local calendar day as YYYY-MM-DD
export function dayKey(v) {
  const d = new Date(v);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function stockStatus(p) {
  if (p.stock <= 0) return "out";
  if (p.stock <= p.minThreshold) return "low";
  return "ok";
}

export const STATUS_META = {
  ok: { label: "In stock", tone: "success" },
  low: { label: "Low stock", tone: "warning" },
  out: { label: "Out of stock", tone: "danger" },
};

export function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export const billNo = (b) => `#${String(b.number || 0).padStart(4, "0")}`;

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
