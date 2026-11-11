import { useEffect, useRef } from "react";
import Icon from "./Icon";
import { NO_WAREHOUSE, SORTS } from "../hooks/useProductFilters";

const STATUS_CHIPS = [
  { value: "all", label: "All", color: null },
  { value: "ok", label: "In stock", color: "var(--success)" },
  { value: "low", label: "Low stock", color: "var(--warning)" },
  { value: "out", label: "Out of stock", color: "var(--danger)" },
];

/**
 * Interactive search & filter bar for products:
 * search by SKU / name / vendor / category / warehouse, filter by warehouse,
 * category and stock status, sort, and see/clear the active filters.
 * Press "/" anywhere to jump to the search box.
 */
export default function ProductFilters({ state, total }) {
  const { filters, setFilter, clearAll, activeCount, statusCounts, warehouses, categories, items } = state;
  const searchRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag) && !e.target.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const whLabel = filters.wh === NO_WAREHOUSE ? "Unassigned" : filters.wh;
  const pills = [
    filters.q && { key: "q", label: `Search: "${filters.q}"` },
    filters.wh && { key: "wh", label: `Warehouse: ${whLabel}` },
    filters.cat && { key: "cat", label: `Category: ${filters.cat}` },
    filters.status !== "all" && { key: "status", label: STATUS_CHIPS.find((c) => c.value === filters.status)?.label },
  ].filter(Boolean);

  return (
    <>
      <div className="filters">
        <div className="filters-row">
          <div className="input-wrap has-action search">
            <Icon name="search" />
            <input
              ref={searchRef}
              type="search"
              className="input"
              placeholder="Search by SKU, name, vendor, category or warehouse…"
              value={filters.q}
              onChange={(e) => setFilter("q", e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setFilter("q", "")}
              aria-label="Search products"
            />
            {filters.q ? (
              <button className="icon-btn input-action" onClick={() => setFilter("q", "")} aria-label="Clear search">
                <Icon name="x" />
              </button>
            ) : (
              <span className="input-action hide-sm" style={{ display: "grid", placeItems: "center", width: 32 }}>
                <span className="kbd">/</span>
              </span>
            )}
          </div>

          <select className="select" value={filters.wh} onChange={(e) => setFilter("wh", e.target.value)} aria-label="Filter by warehouse">
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label} ({w.count})
              </option>
            ))}
          </select>

          <select className="select" value={filters.cat} onChange={(e) => setFilter("cat", e.target.value)} aria-label="Filter by category">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label} ({c.count})
              </option>
            ))}
          </select>

          <select className="select" value={filters.sort} onChange={(e) => setFilter("sort", e.target.value)} aria-label="Sort products">
            {Object.entries(SORTS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="chips" role="group" aria-label="Filter by stock status">
          {STATUS_CHIPS.map((c) => (
            <button
              key={c.value}
              className={`chip ${filters.status === c.value ? "active" : ""}`}
              onClick={() => setFilter("status", c.value)}
              aria-pressed={filters.status === c.value}
            >
              {c.color && <span className="dot" style={{ background: c.color }} />}
              {c.label}
              <span className="count">{statusCounts[c.value]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="results-meta">
        <span>
          Showing <strong style={{ color: "var(--text)" }}>{items.length}</strong> of {total} products
        </span>
        {activeCount > 0 && (
          <div className="active-filters">
            {pills.map((p) => (
              <span key={p.key} className="filter-pill">
                {p.label}
                <button onClick={() => setFilter(p.key, p.key === "status" ? "all" : "")} aria-label={`Remove ${p.label}`}>
                  <Icon name="x" />
                </button>
              </span>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={clearAll}>
              Clear all
            </button>
          </div>
        )}
      </div>
    </>
  );
}
