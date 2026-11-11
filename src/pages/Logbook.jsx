import { useCallback, useEffect, useState } from "react";
import Icon from "../components/Icon";
import { EmptyState, PageHeader, StatCard } from "../components/ui";
import { useApp } from "../context/AppContext";
import { FIELD_LABELS, describe, kindMeta, qtyText } from "../lib/events";
import { dayKey, initials, money, number, time } from "../lib/format";

// "+12" / "−3", but plain "0" for nothing
const sgn = (n, sign) => (n ? `${sign}${number(n)}` : "0");

const shiftDay = (key, days) => {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + days));
};
const longDate = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};
const shortDate = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
};

function exportCSV(book) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["Time", "Type", "Product", "SKU", "Quantity", "Stock before", "Stock after", "Details", "By"],
    ...book.entries.map((e) => [
      new Date(e.timestamp).toLocaleTimeString("en-IN"),
      kindMeta(e).label,
      e.productName,
      e.sku || "",
      qtyText(e),
      e.stockBefore ?? "",
      e.stockAfter ?? "",
      e.kind === "edited" ? (e.changes || []).map((c) => `${FIELD_LABELS[c.field] || c.field}: ${c.from} -> ${c.to}`).join("; ") : describe(e),
      e.performedBy,
    ]),
  ];
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `logbook-${book.date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Logbook() {
  const { fetchLogbook, history } = useApp();
  const today = dayKey(new Date());
  const [date, setDate] = useState(today);
  const [book, setBook] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (d, quiet) => {
      if (!quiet) setLoading(true);
      try {
        const data = await fetchLogbook(d);
        setBook(data);
        setError("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [fetchLogbook]
  );

  useEffect(() => {
    load(date);
  }, [date, load]);

  // Reload quietly whenever new activity arrives (background sync updates `history`)
  const latest = history[0]?.id;
  useEffect(() => {
    if (latest && date === today) load(date, true);
  }, [latest, date, today, load]);

  const s = book?.summary;
  const go = (d) => d <= today && setDate(d);

  return (
    <>
      <PageHeader title="Log book" subtitle="Everything added, sold, removed and changed in your inventory, day by day.">
        <div className="day-nav no-print">
          <button className="icon-btn" onClick={() => go(shiftDay(date, -1))} aria-label="Previous day" title="Previous day">
            <Icon name="arrowLeft" />
          </button>
          <input type="date" className="input" value={date} max={today} onChange={(e) => e.target.value && go(e.target.value)} aria-label="Pick a day" />
          <button className="icon-btn" onClick={() => go(shiftDay(date, 1))} disabled={date >= today} aria-label="Next day" title="Next day">
            <Icon name="arrowRight" />
          </button>
          {date !== today && <button className="btn btn-secondary btn-sm" onClick={() => setDate(today)}>Today</button>}
          <button className="btn btn-secondary btn-sm" onClick={() => book && exportCSV(book)} disabled={!book?.entries.length}>
            <Icon name="download" /> CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()} disabled={!book}>
            <Icon name="file" /> Print
          </button>
        </div>
      </PageHeader>

      {error && (
        <div className="alert alert-error" role="alert">
          <Icon name="alertCircle" /> {error}
        </div>
      )}

      <div className="logbook-layout">
        <div className="stack">
          <div className="card card-pad" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div className="muted" style={{ fontSize: 13 }}>{date === today ? "Today" : "Log for"}</div>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>{longDate(date)}</h2>
            </div>
            {s && s.people.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="muted" style={{ fontSize: 13 }}>Active:</span>
                {s.people.map((p) => (
                  <span key={p} className="badge"><span className="avatar" style={{ width: 18, height: 18, fontSize: 9, borderRadius: 5 }}>{initials(p)}</span>{p}</span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-4">
            <StatCard label="Stock added" value={sgn(s?.unitsIn, "+")} icon="arrowIn" tone="success" foot={`${number(s?.productsAdded || 0)} new product${s?.productsAdded === 1 ? "" : "s"}`} />
            <StatCard label="Sold" value={sgn(s?.unitsSold, "−")} icon="receipt" tone="info" foot={`${number(s?.bills || 0)} bill${s?.bills === 1 ? "" : "s"} · ${money(s?.revenue || 0)}`} />
            <StatCard label="Other stock out" value={sgn(s?.unitsRemoved, "−")} icon="arrowOut" tone="danger" foot="Damage, loss, corrections" />
            <StatCard label="Edits & deletions" value={number((s?.edits || 0) + (s?.deletions || 0))} icon="edit" tone="warning" foot={`${number(s?.entries || 0)} log entries`} />
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <h2>Products touched</h2>
                <p>Opening + added − sold − removed = closing</p>
              </div>
            </div>
            {loading && !book ? (
              <div className="card-body"><div className="skeleton" style={{ height: 120 }} /></div>
            ) : !book?.products.length ? (
              <EmptyState icon="calendar" title="Nothing happened this day" text="Pick another day from the list to see its log." />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="right">Opening</th>
                      <th className="right">Added</th>
                      <th className="right">Sold</th>
                      <th className="right">Removed</th>
                      <th className="right">Closing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {book.products.map((p) => (
                      <tr key={p.productId}>
                        <td>
                          <div className="cell-main">{p.name}</div>
                          <div className="cell-sub">
                            {p.sku && <span className="sku">{p.sku}</span>}
                            {p.created && <span className="badge badge-primary">New</span>}
                            {p.deleted && <span className="badge badge-danger">Deleted</span>}
                          </div>
                        </td>
                        <td className="right num">{p.opening ?? "—"}</td>
                        <td className="right num pos-num">{p.added ? `+${p.added}` : "—"}</td>
                        <td className="right num neg-num">{p.sold ? `−${p.sold}` : "—"}</td>
                        <td className="right num neg-num">{p.removed ? `−${p.removed}` : "—"}</td>
                        <td className="right num" style={{ fontWeight: 700 }}>{p.closing ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="cell-main">Total</td>
                      <td />
                      <td className="right num pos-num" style={{ fontWeight: 700 }}>{sgn(s.unitsIn, "+")}</td>
                      <td className="right num neg-num" style={{ fontWeight: 700 }}>{sgn(s.unitsSold, "−")}</td>
                      <td className="right num neg-num" style={{ fontWeight: 700 }}>{sgn(s.unitsRemoved, "−")}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <h2>Timeline</h2>
                <p>In the order it happened</p>
              </div>
            </div>
            {book?.entries.length ? (
              <div className="timeline">
                {book.entries.map((e) => {
                  const meta = kindMeta(e);
                  return (
                    <div className="tl-item" key={e.id}>
                      <span className="tl-time">{time(e.timestamp)}</span>
                      <span className={`list-icon tone-${meta.tone}`}><Icon name={meta.icon} /></span>
                      <div className="tl-main">
                        <div className="title">
                          {meta.label} · {e.productName}
                        </div>
                        <div className="sub">
                          {e.sku && <span className="sku">{e.sku}</span>}
                          <span>{e.performedBy}</span>
                          {e.kind !== "edited" && <span>· {describe(e)}</span>}
                        </div>
                        {e.kind === "edited" && e.changes?.length > 0 && (
                          <ul className="changes">
                            {e.changes.map((c) => (
                              <li key={c.field}>
                                {FIELD_LABELS[c.field] || c.field}: <del>{c.from || "—"}</del> → <strong>{c.to || "—"}</strong>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className={`tl-qty ${e.action === "in" ? "pos-num" : e.action === "out" ? "neg-num" : ""}`}>
                        {qtyText(e)}
                        {e.stockBefore != null && e.stockAfter != null && e.stockBefore !== e.stockAfter && (
                          <small>stock {e.stockBefore} → {e.stockAfter}</small>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              !loading && <EmptyState icon="history" title="No entries" text="Nothing was recorded on this day." />
            )}
          </div>
        </div>

        <div className="card no-print">
          <div className="card-head">
            <div>
              <h2>Recent days</h2>
              <p>Last 60 days with activity</p>
            </div>
          </div>
          {book?.days.length ? (
            <div className="day-list">
              {book.days.map((d) => (
                <button key={d.date} className={`day-item ${d.date === date ? "active" : ""}`} onClick={() => setDate(d.date)}>
                  <strong>{d.date === today ? "Today" : shortDate(d.date)}</strong>
                  <span>
                    {sgn(d.unitsIn, "+")} in · {sgn(d.unitsOut, "−")} out{d.revenue ? ` · ${money(d.revenue)}` : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState icon="calendar" title="No activity yet" />
          )}
        </div>
      </div>
    </>
  );
}
