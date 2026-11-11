import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import { EmptyState, PageHeader, StatCard, StockBadge, StockMeter } from "../components/ui";
import { useApp } from "../context/AppContext";
import { money, number, stockStatus } from "../lib/format";

export default function Alerts() {
  const { products } = useApp();
  const [show, setShow] = useState("all");

  const flagged = products
    .filter((p) => stockStatus(p) !== "ok")
    .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
  const out = flagged.filter((p) => p.stock <= 0);
  const low = flagged.filter((p) => p.stock > 0);
  const visible = show === "out" ? out : show === "low" ? low : flagged;

  // Suggest topping up to twice the alert level
  const suggest = (p) => Math.max(p.minThreshold * 2 - p.stock, 1);
  const restockCost = flagged.reduce((s, p) => s + suggest(p) * p.price, 0);

  return (
    <>
      <PageHeader title="Low-stock alerts" subtitle="Products at or below their alert level, most urgent first.">
        <Link to="/dashboard/products?status=low" className="btn btn-secondary">
          <Icon name="box" /> View in products
        </Link>
      </PageHeader>

      <div className="grid grid-3 mb">
        <StatCard label="Out of stock" value={number(out.length)} icon="alertCircle" tone="danger" foot="Can't be sold right now" />
        <StatCard label="Running low" value={number(low.length)} icon="alert" tone="warning" foot="At or below alert level" />
        <StatCard label="Suggested restock value" value={money(restockCost)} icon="rupee" tone="info" foot="At selling price, to 2× alert level" />
      </div>

      {flagged.length === 0 ? (
        <div className="card">
          <EmptyState icon="checkCircle" title="All stocked up" text="No product is at or below its alert level right now." />
        </div>
      ) : (
        <>
          <div className="chips mb">
            {[["all", "All", flagged.length], ["out", "Out of stock", out.length], ["low", "Running low", low.length]].map(([v, l, c]) => (
              <button key={v} className={`chip ${show === v ? "active" : ""}`} onClick={() => setShow(v)} aria-pressed={show === v}>
                {l} <span className="count">{c}</span>
              </button>
            ))}
          </div>
          <div className="alert-cards">
            {visible.map((p) => (
              <div key={p.id} className={`card alert-card ${p.stock <= 0 ? "out" : ""}`}>
                <div className="top">
                  <div>
                    <h3>{p.name}</h3>
                    <div className="cell-sub">
                      <span className="sku">{p.sku}</span>
                      {p.warehouse && <span className="tag"><Icon name="warehouse" />{p.warehouse}</span>}
                    </div>
                  </div>
                  <StockBadge product={p} />
                </div>
                <StockMeter product={p} />
                <div className="cell-sub" style={{ marginTop: 0 }}>
                  Alert at {p.minThreshold} · suggest +{suggest(p)} {p.vendor && `from ${p.vendor}`}
                </div>
                <Link to={`/dashboard/stock?product=${p.id}`} className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }}>
                  <Icon name="arrowIn" /> Restock
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
