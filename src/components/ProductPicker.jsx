import { useEffect, useId, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import { Highlight, StockBadge } from "./ui";
import { searchTerms } from "../hooks/useProductFilters";

// Searchable product combobox: type a SKU, name or warehouse; ↑ ↓ Enter to pick.
export default function ProductPicker({ products, value, onChange, autoFocus }) {
  const selected = products.find((p) => p.id === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);
  const listId = useId();

  const matches = useMemo(() => {
    const terms = searchTerms(query);
    const list = products.filter((p) => {
      const hay = `${p.sku} ${p.name} ${p.warehouse} ${p.category}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
    const q = query.trim().toLowerCase();
    list.sort((a, b) => Number((b.sku || "").toLowerCase() === q) - Number((a.sku || "").toLowerCase() === q) || a.name.localeCompare(b.name));
    return list.slice(0, 50);
  }, [products, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !wrapRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (p) => {
    onChange(p.id);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open && matches[active]) {
      e.preventDefault();
      pick(matches[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div className="input-wrap has-action">
        <Icon name="search" />
        <input
          className="input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder={selected ? `${selected.sku} · ${selected.name}` : "Search by SKU, name or warehouse…"}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
        />
        {selected && !query && (
          <button type="button" className="icon-btn input-action" onClick={() => onChange("")} aria-label="Clear selected product">
            <Icon name="x" />
          </button>
        )}
      </div>

      {open && (
        <div className="dropdown" style={{ left: 0, right: 0, maxHeight: 320, overflowY: "auto" }} id={listId} role="listbox">
          {matches.length === 0 ? (
            <div className="dropdown-item muted" style={{ cursor: "default" }}>No products match “{query}”</div>
          ) : (
            matches.map((p, i) => (
              <button
                type="button"
                key={p.id}
                role="option"
                aria-selected={p.id === value}
                className="dropdown-item"
                style={{ background: i === active ? "var(--surface-3)" : undefined, justifyContent: "space-between" }}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(p)}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 600 }}><Highlight text={p.name} query={query} /></span>
                  <span className="cell-sub" style={{ marginTop: 0 }}>
                    <span className="sku"><Highlight text={p.sku} query={query} /></span>
                    {p.warehouse && <span><Highlight text={p.warehouse} query={query} /></span>}
                    <span>· {p.stock} in stock</span>
                  </span>
                </span>
                <StockBadge product={p} />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
