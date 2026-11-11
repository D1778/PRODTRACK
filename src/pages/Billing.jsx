import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Icon from "../components/Icon";
import { EmptyState, Highlight, Modal, PageHeader, Spinner, Stepper } from "../components/ui";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { searchTerms } from "../hooks/useProductFilters";
import { billNo, dateTime, money, number } from "../lib/format";

// jsPDF's built-in fonts have no ₹ glyph, so PDFs use "Rs."
const pdfMoney = (v) => `Rs. ${(Number(v) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function downloadPDF(bill, businessName) {
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.setTextColor(67, 56, 202);
  doc.text(businessName || "ProdTrack", 105, 20, { align: "center" });
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Tax invoice / Bill of sale", 105, 27, { align: "center" });
  doc.text(`Bill ${billNo(bill)}`, 20, 40);
  doc.text(`Date: ${new Date(bill.timestamp).toLocaleString("en-IN")}`, 20, 46);
  doc.text(`Billed by: ${bill.createdBy || "-"}`, 20, 52);

  autoTable(doc, {
    startY: 60,
    head: [["Item", "Price", "Qty", "Amount"]],
    body: bill.items.map((i) => [i.productName, pdfMoney(i.price), i.quantity, pdfMoney(i.price * i.quantity)]),
    theme: "striped",
    headStyles: { fillColor: [79, 70, 229] },
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "center" }, 3: { halign: "right" } },
  });
  const y = doc.lastAutoTable.finalY + 12;
  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text(`Total: ${pdfMoney(bill.totalAmount)}`, 190, y, { align: "right" });
  doc.setFontSize(10);
  doc.setTextColor(140);
  doc.text("Thank you for your business!", 105, y + 20, { align: "center" });
  doc.save(`bill-${String(bill.number).padStart(4, "0")}.pdf`);
}

function BillDetails({ bill, businessName, onClose, title = "Bill details" }) {
  return (
    <Modal
      title={title}
      subtitle={`Bill ${billNo(bill)} · ${dateTime(bill.timestamp)}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => downloadPDF(bill, businessName)}>
            <Icon name="download" /> Download PDF
          </button>
        </>
      }
    >
      <dl className="kv">
        <dt>Billed by</dt><dd>{bill.createdBy}</dd>
        <dt>Items</dt><dd>{bill.items.reduce((n, i) => n + i.quantity, 0)}</dd>
      </dl>
      {bill.items.map((i) => (
        <div className="receipt-line" key={i.productId}>
          <span>{i.productName} <span className="muted">× {i.quantity} @ {money(i.price)}</span></span>
          <span className="num">{money(i.price * i.quantity)}</span>
        </div>
      ))}
      <div className="receipt-total">
        <span>Total</span>
        <span className="num" style={{ color: "var(--primary-text)" }}>{money(bill.totalAmount)}</span>
      </div>
    </Modal>
  );
}

function NewBill({ onCreated }) {
  const { products, createBill } = useApp();
  const toast = useToast();
  const [cart, setCart] = useState([]); // [{ productId, quantity }]
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products]);
  const tiles = useMemo(() => {
    const terms = searchTerms(q);
    return products.filter((p) => {
      if (cat && p.category !== cat) return false;
      const hay = `${p.sku} ${p.name} ${p.category} ${p.warehouse}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [products, q, cat]);

  const inCart = (id) => cart.find((c) => c.productId === id)?.quantity || 0;
  const lines = cart.map((c) => ({ ...c, product: byId.get(c.productId) })).filter((l) => l.product);
  const total = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
  const units = lines.reduce((s, l) => s + l.quantity, 0);

  const add = (p, n = 1) => {
    const have = inCart(p.id);
    if (have + n > p.stock) {
      toast.error(p.stock <= 0 ? `${p.name} is out of stock` : `Only ${p.stock} ${p.name} in stock`);
      return;
    }
    setCart((c) => (have ? c.map((x) => (x.productId === p.id ? { ...x, quantity: x.quantity + n } : x)) : [...c, { productId: p.id, quantity: n }]));
  };
  const setQty = (id, quantity) => setCart((c) => c.map((x) => (x.productId === id ? { ...x, quantity } : x)));
  const remove = (id) => setCart((c) => c.filter((x) => x.productId !== id));

  // Enter on an exact SKU adds it straight to the bill (works with barcode scanners)
  const onSearchKey = (e) => {
    if (e.key !== "Enter") return;
    const exact = products.find((p) => (p.sku || "").toLowerCase() === q.trim().toLowerCase());
    const target = exact || (tiles.length === 1 ? tiles[0] : null);
    if (target) {
      add(target);
      setQ("");
    }
  };

  const checkout = async () => {
    setBusy(true);
    try {
      const bill = await createBill(lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity) || 1 })));
      setCart([]);
      toast.success(`Bill ${billNo(bill)} saved · ${money(bill.totalAmount)}`);
      onCreated(bill);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!products.length) {
    return (
      <div className="card">
        <EmptyState icon="box" title="Nothing to sell yet" text="Add products first, then come back to bill customers." action={<Link className="btn btn-primary" to="/dashboard/add-product"><Icon name="plus" /> Add product</Link>} />
      </div>
    );
  }

  return (
    <div className="pos">
      <div className="card">
        <div className="filters">
          <div className="filters-row">
            <div className="input-wrap search">
              <Icon name="barcode" />
              <input
                className="input"
                type="search"
                placeholder="Scan or type a SKU, or search by name…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onSearchKey}
                autoFocus
                aria-label="Search products to bill"
              />
            </div>
          </div>
          <div className="chips">
            <button className={`chip ${!cat ? "active" : ""}`} onClick={() => setCat("")}>All</button>
            {categories.map((c) => (
              <button key={c} className={`chip ${cat === c ? "active" : ""}`} onClick={() => setCat(cat === c ? "" : c)}>{c}</button>
            ))}
          </div>
        </div>
        {tiles.length ? (
          <div className="product-tiles">
            {tiles.map((p) => {
              const qty = inCart(p.id);
              const disabled = p.stock <= 0;
              return (
                <button key={p.id} className={`tile ${disabled ? "disabled" : ""}`} onClick={() => add(p)} disabled={disabled} aria-label={`Add ${p.name} to bill`}>
                  <span className="cell-sub" style={{ marginTop: 0 }}>
                    <span className="sku"><Highlight text={p.sku} query={q} /></span>
                  </span>
                  <span className="tile-name"><Highlight text={p.name} query={q} /></span>
                  <span className="tile-meta">
                    <span className="price">{money(p.price)}</span>
                    <span className={`badge badge-${disabled ? "danger" : p.stock <= p.minThreshold ? "warning" : "success"}`}>
                      {disabled ? "Out" : `${p.stock} left`}
                    </span>
                  </span>
                  {qty > 0 && <span className="in-cart">✓ {qty} in bill</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="search" title="No products match" text="Try another SKU or name." />
        )}
      </div>

      <div className="card cart">
        <div className="card-head">
          <div>
            <h2>Current bill</h2>
            <p>{units ? `${number(units)} item${units === 1 ? "" : "s"}` : "Tap products to add them"}</p>
          </div>
          {lines.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setCart([])}>Clear</button>}
        </div>
        <div className="cart-items">
          {lines.length ? (
            lines.map((l) => (
              <div className="cart-line" key={l.productId}>
                <div>
                  <div className="name">{l.product.name}</div>
                  <div className="each">{money(l.product.price)} each · {l.product.sku}</div>
                </div>
                <div className="line-total">{money(l.product.price * (Number(l.quantity) || 0))}</div>
                <div className="controls">
                  <Stepper small value={l.quantity} min={1} max={l.product.stock} onChange={(v) => setQty(l.productId, v)} />
                  <button className="icon-btn danger" onClick={() => remove(l.productId)} aria-label={`Remove ${l.product.name}`}>
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <EmptyState icon="cart" title="Bill is empty" text="Search or tap a product to start." />
          )}
        </div>
        <div className="cart-total">
          <div className="row"><span>Items</span><span className="num">{number(units)}</span></div>
          <div className="grand">
            <span style={{ fontWeight: 700 }}>Total</span>
            <strong>{money(total)}</strong>
          </div>
          <button className="btn btn-primary btn-lg btn-block" onClick={checkout} disabled={!lines.length || busy}>
            {busy ? <Spinner /> : <Icon name="check" />} Complete sale
          </button>
        </div>
      </div>
    </div>
  );
}

function Records({ onOpen }) {
  const { bills, user } = useApp();
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);

  const filtered = useMemo(() => {
    const terms = searchTerms(q.replace("#", ""));
    return bills.filter((b) => {
      if (mine && b.createdById !== user?.id) return false;
      const hay = `${String(b.number).padStart(4, "0")} ${b.createdBy} ${b.items.map((i) => i.productName).join(" ")}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [bills, q, mine, user]);
  const total = filtered.reduce((s, b) => s + b.totalAmount, 0);

  return (
    <div className="card">
      <div className="filters">
        <div className="filters-row">
          <div className="input-wrap search">
            <Icon name="search" />
            <input className="input" type="search" placeholder="Search bill number, product or staff…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search bills" />
          </div>
          <button className={`chip ${mine ? "active" : ""}`} onClick={() => setMine((m) => !m)} aria-pressed={mine}>Only my bills</button>
        </div>
      </div>
      <div className="results-meta">
        <span><strong style={{ color: "var(--text)" }}>{filtered.length}</strong> bills · {money(total)}</span>
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon="receipt" title={bills.length ? "No bills match" : "No bills yet"} text={bills.length ? "Try a different search." : "Completed sales will be listed here."} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Bill</th>
                <th>Date</th>
                <th>Items</th>
                <th>Billed by</th>
                <th className="right">Total</th>
                <th className="right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id}>
                  <td><span className="cell-main mono">{billNo(b)}</span></td>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>{dateTime(b.timestamp)}</td>
                  <td style={{ maxWidth: 280 }}>
                    <div className="cell-sub" style={{ marginTop: 0 }}>
                      {b.items.slice(0, 2).map((i) => `${i.productName} ×${i.quantity}`).join(", ")}
                      {b.items.length > 2 && ` +${b.items.length - 2} more`}
                    </div>
                  </td>
                  <td>{b.createdBy}</td>
                  <td className="right num" style={{ fontWeight: 700 }}>{money(b.totalAmount)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => onOpen(b)} title="View" aria-label={`View bill ${billNo(b)}`}><Icon name="file" /></button>
                      <button className="icon-btn" onClick={() => downloadPDF(b, user?.businessName)} title="Download PDF" aria-label={`Download bill ${billNo(b)}`}><Icon name="download" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Billing() {
  const { user } = useApp();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "records" ? "records" : "new";
  const [open, setOpen] = useState(null); // { bill, fresh }

  const setView = (v) => setParams(v === "records" ? { view: "records" } : {}, { replace: true });

  return (
    <>
      <PageHeader title="Billing" subtitle="Ring up sales. Stock updates automatically when a bill is completed." />
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={view === "new"} className={view === "new" ? "active" : ""} onClick={() => setView("new")}>
          <Icon name="cart" /> New bill
        </button>
        <button role="tab" aria-selected={view === "records"} className={view === "records" ? "active" : ""} onClick={() => setView("records")}>
          <Icon name="receipt" /> Bill records
        </button>
      </div>

      {view === "new" ? <NewBill onCreated={(bill) => setOpen({ bill, fresh: true })} /> : <Records onOpen={(bill) => setOpen({ bill })} />}

      {open && (
        <BillDetails
          bill={open.bill}
          businessName={user?.businessName}
          title={open.fresh ? "Sale complete 🎉" : "Bill details"}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
