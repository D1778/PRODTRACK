import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon";
import ProductPicker from "../components/ProductPicker";
import { EmptyState, PageHeader, Spinner, StockBadge, Stepper } from "../components/ui";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { money, relativeTime } from "../lib/format";
import { describe, kindMeta, qtyText } from "../lib/events";

const REASONS = {
  in: ["Restock from supplier", "Customer return", "Stock count correction"],
  out: ["Damaged / expired", "Internal use", "Stock count correction"],
};

export default function Stock() {
  const { products, history, updateStock } = useApp();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const productId = params.get("product") || "";
  const [action, setAction] = useState("in");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const product = products.find((p) => p.id === productId);
  const quantity = Number(qty) || 0;
  const after = product ? product.stock + (action === "in" ? quantity : -quantity) : 0;
  const tooMany = product && action === "out" && after < 0;
  const recent = history.filter((h) => h.productId === productId).slice(0, 6);

  const selectProduct = (id) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set("product", id);
        else next.delete("product");
        return next;
      },
      { replace: true }
    );

  const submit = async (e) => {
    e.preventDefault();
    if (!product) {
      setError("Choose a product first");
      return;
    }
    setError("");
    setBusy(true);
    const seenStock = product.stock;
    try {
      const res = await updateStock({ productId, action, quantity, reason });
      const before = res.movement?.stockBefore;
      const now = res.product?.stock;
      const verb = action === "in" ? "Added" : "Removed";
      if (before != null && before !== seenStock) {
        // Someone else changed this product between loading and saving
        toast.info(`${verb} ${quantity} × ${product.name}. Note: stock had changed to ${before} by someone else, so it's now ${now}.`);
      } else {
        toast.success(`${verb} ${quantity} × ${product.name} · stock now ${now}`);
      }
      setQty(1);
      setReason("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!products.length) {
    return (
      <>
        <PageHeader title="Stock In / Out" subtitle="Record deliveries, returns and write-offs." />
        <div className="card">
          <EmptyState icon="box" title="No products yet" text="Add a product before recording stock." action={<Link to="/dashboard/add-product" className="btn btn-primary"><Icon name="plus" /> Add product</Link>} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Stock In / Out" subtitle="Record deliveries, returns and write-offs. Every change is logged in History." />

      <div className="grid grid-main" style={{ alignItems: "start" }}>
        <form className="card" onSubmit={submit}>
          <div className="card-head"><h2>New stock movement</h2></div>
          <div className="card-body">
            {error && (
              <div className="alert alert-error" role="alert">
                <Icon name="alertCircle" /> {error}
              </div>
            )}

            <div className="field">
              <span className="label">What happened?</span>
              <div className="segmented" role="radiogroup">
                <button type="button" role="radio" aria-checked={action === "in"} className={`segment in ${action === "in" ? "selected" : ""}`} onClick={() => setAction("in")}>
                  <span className="seg-icon"><Icon name="arrowIn" /></span>
                  <span><strong>Stock in</strong><span>Delivery, return, correction</span></span>
                </button>
                <button type="button" role="radio" aria-checked={action === "out"} className={`segment out ${action === "out" ? "selected" : ""}`} onClick={() => setAction("out")}>
                  <span className="seg-icon"><Icon name="arrowOut" /></span>
                  <span><strong>Stock out</strong><span>Damage, loss, internal use</span></span>
                </button>
              </div>
            </div>

            <div className="field">
              <span className="label">Product</span>
              <ProductPicker products={products} value={productId} onChange={selectProduct} autoFocus={!productId} />
            </div>

            <div className="field">
              <span className="label">Quantity</span>
              <Stepper value={qty} onChange={setQty} min={1} />
              {tooMany && <span className="field-error">Only {product.stock} in stock.</span>}
            </div>

            <div className="field">
              <label className="label" htmlFor="reason">Reason <span className="opt">(optional)</span></label>
              <div className="chips" style={{ marginBottom: 8 }}>
                {REASONS[action].map((r) => (
                  <button type="button" key={r} className={`chip ${reason === r ? "active" : ""}`} onClick={() => setReason(reason === r ? "" : r)}>
                    {r}
                  </button>
                ))}
              </div>
              <input id="reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Or type a note, e.g. invoice number" />
            </div>

            <button type="submit" className={`btn btn-lg btn-block ${action === "in" ? "btn-primary" : "btn-danger"}`} disabled={busy || !product || tooMany || quantity < 1}>
              {busy ? <Spinner /> : <Icon name={action === "in" ? "arrowIn" : "arrowOut"} />}
              {action === "in" ? "Add" : "Remove"} {quantity || ""} {product ? `× ${product.name}` : "units"}
            </button>
          </div>
        </form>

        <div className="stack">
          <div className="card">
            <div className="card-head"><h2>Selected product</h2></div>
            {product ? (
              <div className="card-body">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <div className="cell-main" style={{ fontSize: 16 }}>{product.name}</div>
                    <div className="cell-sub">
                      <span className="sku">{product.sku}</span>
                      {product.warehouse && <span className="tag"><Icon name="warehouse" />{product.warehouse}</span>}
                    </div>
                  </div>
                  <StockBadge product={product} />
                </div>
                <div className="divider" style={{ marginTop: 18 }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", textAlign: "center" }}>
                  <div>
                    <div className="muted" style={{ fontSize: 12.5 }}>Now</div>
                    <div className="stat-value">{product.stock}</div>
                  </div>
                  <Icon name="arrowRight" width={22} height={22} className="muted" />
                  <div>
                    <div className="muted" style={{ fontSize: 12.5 }}>After</div>
                    <div className="stat-value" style={{ color: tooMany ? "var(--danger)" : action === "in" ? "var(--success)" : "var(--text)" }}>
                      {after}
                    </div>
                  </div>
                </div>
                <div className="divider" style={{ marginTop: 18 }} />
                <dl className="kv" style={{ marginBottom: 0 }}>
                  <dt>Price</dt><dd>{money(product.price)}</dd>
                  <dt>Alert at</dt><dd>{product.minThreshold} units</dd>
                  <dt>Category</dt><dd>{product.category}</dd>
                  {product.vendor && <><dt>Vendor</dt><dd>{product.vendor}</dd></>}
                </dl>
              </div>
            ) : (
              <EmptyState icon="search" title="Pick a product" text="Search by SKU, name or warehouse to see its stock." />
            )}
          </div>

          {product && (
            <div className="card">
              <div className="card-head"><h2>Recent movements</h2></div>
              {recent.length ? (
                <div className="list">
                  {recent.map((h) => {
                    const meta = kindMeta(h);
                    return (
                      <div className="list-item" key={h.id}>
                        <span className={`list-icon tone-${meta.tone}`}>
                          <Icon name={meta.icon} />
                        </span>
                        <div className="grow">
                          <div className="title">{qtyText(h) ? `${qtyText(h)} · ` : ""}{describe(h)}</div>
                          <div className="sub">
                            {h.performedBy} · {relativeTime(h.timestamp)}
                            {h.stockBefore != null && h.stockAfter != null && h.stockBefore !== h.stockAfter && ` · ${h.stockBefore} → ${h.stockAfter}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon="history" title="No movements yet" />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
