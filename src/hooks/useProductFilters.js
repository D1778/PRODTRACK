import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { stockStatus } from "../lib/format";

export const NO_WAREHOUSE = "__none";

export const SORTS = {
  relevance: "Best match",
  name: "Name (A–Z)",
  sku: "SKU",
  "stock-asc": "Stock: low to high",
  "stock-desc": "Stock: high to low",
  "price-desc": "Price: high to low",
  recent: "Recently updated",
};

const DEFAULTS = { q: "", wh: "", cat: "", status: "all", sort: "relevance" };

export const searchTerms = (q) => q.toLowerCase().split(/\s+/).filter(Boolean);

// How well a product matches the search; 0 = no match.
function matchScore(p, terms) {
  if (!terms.length) return 1;
  const sku = (p.sku || "").toLowerCase();
  const fields = [sku, p.name, p.vendor, p.category, p.warehouse].map((f) => (f || "").toLowerCase());
  let score = 0;
  for (const t of terms) {
    if (!fields.some((f) => f.includes(t))) return 0; // every term must match somewhere
    if (sku === t) score += 100;
    else if (sku.startsWith(t)) score += 40;
    else if (sku.includes(t)) score += 20;
    if (p.name.toLowerCase().startsWith(t)) score += 10;
    else if (p.name.toLowerCase().includes(t)) score += 5;
    score += 1;
  }
  return score;
}

const countBy = (items, keyFn) => {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
};

/**
 * Search & filter state for the product list, kept in the URL
 * (?q=&wh=&cat=&status=&sort=) so a filtered view can be bookmarked or shared.
 */
export function useProductFilters(products) {
  const [params, setParams] = useSearchParams();
  // The search text lives in local state so typing is instant; it is copied
  // to the URL shortly after the user stops typing.
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const filters = useMemo(
    () => ({ ...Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, params.get(k) ?? DEFAULTS[k]])), q: query }),
    [params, query]
  );

  const writeParam = useCallback(
    (key, value) => {
      // Read the live URL (not a render-time snapshot) so a delayed search
      // write never wipes filters chosen in the meantime.
      const next = new URLSearchParams(window.location.search);
      if (value === DEFAULTS[key] || value === "" || value == null) next.delete(key);
      else next.set(key, value);
      setParams(next, { replace: true });
    },
    [setParams]
  );

  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const setFilter = useCallback(
    (key, value) => {
      if (key !== "q") return writeParam(key, value);
      setQuery(value);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => writeParam("q", value), 250);
    },
    [writeParam]
  );

  const clearAll = useCallback(() => {
    clearTimeout(timer.current);
    setQuery("");
    setParams(new URLSearchParams(), { replace: true });
  }, [setParams]);

  const result = useMemo(() => {
    const terms = searchTerms(filters.q);
    const scored = [];
    for (const p of products) {
      const score = matchScore(p, terms);
      if (score) scored.push({ p, score });
    }

    const byWarehouse = scored.filter(({ p }) =>
      !filters.wh ? true : filters.wh === NO_WAREHOUSE ? !p.warehouse : p.warehouse === filters.wh
    );
    const byCategory = byWarehouse.filter(({ p }) => !filters.cat || p.category === filters.cat);

    // Chip counts reflect every filter except status itself
    const statusCounts = { all: byCategory.length, ok: 0, low: 0, out: 0 };
    for (const { p } of byCategory) statusCounts[stockStatus(p)]++;

    const visible = byCategory.filter(({ p }) => filters.status === "all" || stockStatus(p) === filters.status);

    const sorters = {
      relevance: (a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name),
      name: (a, b) => a.p.name.localeCompare(b.p.name),
      sku: (a, b) => (a.p.sku || "").localeCompare(b.p.sku || "", undefined, { numeric: true }),
      "stock-asc": (a, b) => a.p.stock - b.p.stock,
      "stock-desc": (a, b) => b.p.stock - a.p.stock,
      "price-desc": (a, b) => b.p.price - a.p.price,
      recent: (a, b) => new Date(b.p.updatedAt) - new Date(a.p.updatedAt),
    };
    visible.sort(sorters[filters.sort] || sorters.relevance);

    // Option lists with counts across all products
    const whCounts = countBy(products, (p) => p.warehouse || NO_WAREHOUSE);
    const warehouses = [...whCounts.entries()]
      .filter(([k]) => k !== NO_WAREHOUSE)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, count]) => ({ value, label: value, count }));
    if (whCounts.has(NO_WAREHOUSE)) warehouses.push({ value: NO_WAREHOUSE, label: "Unassigned", count: whCounts.get(NO_WAREHOUSE) });

    const categories = [...countBy(products, (p) => p.category).entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, count]) => ({ value, label: value, count }));

    return { items: visible.map((v) => v.p), statusCounts, warehouses, categories };
  }, [products, filters]);

  const activeCount = ["q", "wh", "cat", "status"].filter((k) => filters[k] !== DEFAULTS[k]).length;

  return { filters, setFilter, clearAll, activeCount, ...result };
}
