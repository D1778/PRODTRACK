import { useMemo, useState } from "react";
import Icon from "../components/Icon";
import { EmptyState, Highlight, PageHeader, StatCard } from "../components/ui";
import { useApp } from "../context/AppContext";
import { FIELD_LABELS, describe, kindMeta, qtyText } from "../lib/events";
import { dateTime, number } from "../lib/format";

const RANGES = { today: "Today", 7: "Last 7 days", 30: "Last 30 days", all: "All time" };
const GROUPS = {
  all: { label: "All", kinds: null },
  added: { label: "Added", kinds: ["created", "restock"] },
  sold: { label: "Sold", kinds: ["sale"] },
  removed: { label: "Stock out", kinds: ["removed"] },
  changes: { label: "Edits & deletions", kinds: ["edited", "deleted"] },
};
const PAGE = 50;

export default function History() {
  const { history, products } = useApp();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("all");
  const [range, setRange] = useState("30");
  const [person, setPerson] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const skuById = useMemo(() => new Map(products.map((p) => [p.id, p.sku])), [products]);
  const people = useMemo(() => [...new Set(history.map((h) => h.performedBy).filter(Boolean))].sort(), [history]);

  const filtered = useMemo(() => {
    const now = new Date();
    const start =
      range === "all" ? 0 : range === "today" ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() : now.getTime() - Number(range) * 864e5;
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const kinds = GROUPS[group].kinds;
    return history.filter((h) => {
      if (new Date(h.timestamp).getTime() < start) return false;
      if (kinds && !kinds.includes(h.kind)) return false;
      if (person && h.performedBy !== person) return false;
      const hay = `${h.productName} ${h.sku || skuById.get(h.productId) || ""} ${describe(h)} ${h.performedBy}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [history, q, group, range, person, skuById]);

  const totals = filtered.reduce(
    (t, h) => {
      if (h.action === "in") t.in += h.quantity;
      if (h.action === "out") t.out += h.quantity;
      if (h.action === "edit" || h.action === "delete") t.changes += 1;
      return t;
    },
    { in: 0, out: 0, changes: 0 }
  );
  const reset = () => setLimit(PAGE);

  return (
    <>
      <PageHeader title="Stock history" subtitle="Every new product, restock, sale, edit and deletion, with who did it and when." />

      <div className="grid grid-4 mb">
        <StatCard label="Entries" value={number(filtered.length)} icon="history" tone="primary" foot={RANGES[range]} />
        <StatCard label="Units in" value={totals.in ? `+${number(totals.in)}` : "0"} icon="arrowIn" tone="success" foot="New products & restocks" />
        <StatCard label="Units out" value={totals.out ? `−${number(totals.out)}` : "0"} icon="arrowOut" tone="danger" foot="Sales & write-offs" />
        <StatCard label="Edits & deletions" value={number(totals.changes)} icon="edit" tone="warning" foot="Product detail changes" />
      </div>

      <div className="card">
        <div className="filters">
          <div className="filters-row">
            <div className="input-wrap search">
              <Icon name="search" />
              <input className="input" type="search" placeholder="Search product, SKU, note or person…" value={q} onChange={(e) => { setQ(e.target.value); reset(); }} aria-label="Search history" />
            </div>
            <select className="select" value={range} onChange={(e) => { setRange(e.target.value); reset(); }} aria-label="Date range">
              {Object.entries(RANGES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className="select" value={person} onChange={(e) => { setPerson(e.target.value); reset(); }} aria-label="Performed by">
              <option value="">Everyone</option>
              {people.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="chips">
            {Object.entries(GROUPS).map(([v, g]) => (
              <button key={v} className={`chip ${group === v ? "active" : ""}`} onClick={() => { setGroup(v); reset(); }} aria-pressed={group === v}>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon="history" title="No entries found" text={history.length ? "Try a wider date range or clear the search." : "Changes to your inventory will be recorded here automatically."} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Type</th>
                    <th className="right">Qty</th>
                    <th className="right">Stock</th>
                    <th>Details</th>
                    <th>By</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, limit).map((h) => {
                    const meta = kindMeta(h);
                    const sku = h.sku || skuById.get(h.productId);
                    return (
                      <tr key={h.id}>
                        <td>
                          <div className="cell-main"><Highlight text={h.productName} query={q} /></div>
                          {sku && <div className="cell-sub"><span className="sku"><Highlight text={sku} query={q} /></span></div>}
                        </td>
                        <td>
                          <span className={`badge badge-${meta.tone}`}><Icon name={meta.icon} /> {meta.label}</span>
                        </td>
                        <td className={`right num ${h.action === "in" ? "pos-num" : h.action === "out" ? "neg-num" : ""}`}>{qtyText(h) || "—"}</td>
                        <td className="right num muted" style={{ whiteSpace: "nowrap" }}>
                          {h.stockBefore != null && h.stockAfter != null && h.stockBefore !== h.stockAfter ? `${h.stockBefore} → ${h.stockAfter}` : h.stockAfter ?? "—"}
                        </td>
                        <td style={{ color: "var(--text-2)", maxWidth: 320 }}>
                          {h.kind === "edited" && h.changes?.length ? (
                            <ul className="changes" style={{ margin: 0 }}>
                              {h.changes.map((c) => (
                                <li key={c.field}>
                                  {FIELD_LABELS[c.field] || c.field}: <del>{c.from || "—"}</del> → {c.to || "—"}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <Highlight text={describe(h)} query={q} />
                          )}
                        </td>
                        <td><Highlight text={h.performedBy || "—"} query={q} /></td>
                        <td className="muted" style={{ whiteSpace: "nowrap" }}>{dateTime(h.timestamp)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > limit && (
              <div className="card-foot" style={{ textAlign: "center" }}>
                <button className="btn btn-secondary" onClick={() => setLimit((l) => l + PAGE)}>
                  Show more ({number(filtered.length - limit)} left)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
