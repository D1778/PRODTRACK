import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Icon from "../components/Icon";
import { EmptyState, Modal, PageHeader, Spinner, StockBadge } from "../components/ui";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";

const EMPTY = { name: "", sku: "", category: "", warehouse: "", price: "", stock: "", minThreshold: "5", vendor: "", notes: "" };

const toForm = (p) => ({ ...EMPTY, ...p, price: String(p.price), stock: String(p.stock), minThreshold: String(p.minThreshold) });

const COMPARE = [
  ["name", "Name"],
  ["sku", "SKU"],
  ["category", "Category"],
  ["warehouse", "Warehouse"],
  ["price", "Price (₹)"],
  ["minThreshold", "Alert level"],
  ["vendor", "Vendor"],
  ["notes", "Notes"],
];

// Shown when someone else saved this product while you were editing it.
function ConflictDialog({ mine, latest, onUseLatest, onKeepMine, onClose, busy }) {
  const norm = (k, v) => (k === "price" ? Number(v || 0).toFixed(2) : String(v ?? ""));
  return (
    <Modal
      wide
      title="Someone else changed this product"
      subtitle={`${latest.updatedBy || "Another user"} saved changes while you were editing. Compare and choose what to keep.`}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onUseLatest} disabled={busy}>
            Use their version
          </button>
          <button className="btn btn-primary" onClick={onKeepMine} disabled={busy}>
            {busy ? <Spinner /> : <Icon name="check" />} Save mine over it
          </button>
        </>
      }
    >
      <table className="conflict-table">
        <thead>
          <tr><th>Field</th><th>Your edit</th><th>Latest saved</th></tr>
        </thead>
        <tbody>
          {COMPARE.map(([k, label]) => {
            const a = norm(k, mine[k]);
            const b = norm(k, latest[k]);
            return (
              <tr key={k}>
                <td className="muted">{label}</td>
                <td className={a !== b ? "diff" : ""}>{a || "—"}</td>
                <td className={a !== b ? "diff" : ""}>{b || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="hint" style={{ marginTop: 12 }}>Stock is never overwritten here: it is {latest.stock} and only changes through Stock In / Out and billing.</p>
    </Modal>
  );
}

export default function ProductForm() {
  const { id } = useParams();
  const { products, loading } = useApp();
  const existing = products.find((p) => p.id === id);

  if (id && !existing) {
    return (
      <div className="card">
        {loading ? (
          <div className="card-body"><div className="skeleton" style={{ height: 240 }} /></div>
        ) : (
          <EmptyState icon="search" title="Product not found" text="It may have been deleted." action={<Link className="btn btn-secondary" to="/dashboard/products">Back to products</Link>} />
        )}
      </div>
    );
  }
  // key resets the form when switching between products
  return <ProductFormInner key={id || "new"} id={id} existing={existing} />;
}

function ProductFormInner({ id, existing }) {
  const { products, addProduct, updateProduct } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const editing = Boolean(id);

  const [form, setForm] = useState(() => (existing ? toForm(existing) : EMPTY));
  // The version this edit started from. It deliberately does NOT follow the
  // background refresh, so a save after someone else's change is detected.
  const [baseVersion, setBaseVersion] = useState(existing?.version);
  const [conflict, setConflict] = useState(null); // { latest, payload }
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const changedMeanwhile = editing && existing && baseVersion != null && existing.version !== baseVersion;

  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);
  const warehouses = useMemo(() => [...new Set(products.map((p) => p.warehouse).filter(Boolean))].sort(), [products]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const payload = {
      name: form.name,
      sku: form.sku,
      category: form.category,
      warehouse: form.warehouse,
      price: parseFloat(form.price) || 0,
      stock: parseInt(form.stock, 10) || 0,
      minThreshold: parseInt(form.minThreshold, 10) || 0,
      vendor: form.vendor,
      notes: form.notes,
    };
    try {
      if (editing) {
        await updateProduct(id, { ...payload, version: baseVersion });
        toast.success(`${payload.name} updated`);
      } else {
        const p = await addProduct(payload);
        toast.success(`${p.name} added as ${p.sku}`);
      }
      navigate("/dashboard/products");
    } catch (err) {
      if (err.status === 409 && err.data?.code === "version_conflict") {
        setConflict({ latest: err.data.current, payload });
      } else {
        setError(err.message);
      }
      setBusy(false);
    }
  };

  const applyLatest = () => {
    setForm(toForm(conflict.latest));
    setBaseVersion(conflict.latest.version);
    setConflict(null);
    toast.info("Loaded the latest saved details");
  };

  const keepMine = async () => {
    setBusy(true);
    try {
      await updateProduct(id, { ...conflict.payload, version: conflict.latest.version });
      toast.success(`${conflict.payload.name} updated`);
      navigate("/dashboard/products");
    } catch (err) {
      if (err.status === 409 && err.data?.code === "version_conflict") {
        setConflict({ ...conflict, latest: err.data.current }); // changed again - show newest
      } else {
        setConflict(null);
        setError(err.message);
      }
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={editing ? `Edit ${existing.name}` : "Add a product"}
        subtitle={editing ? "Update details. Use Stock In / Out to change quantities." : "Give it a SKU and warehouse so your team can find it fast."}
      >
        <Link to="/dashboard/products" className="btn btn-secondary">
          <Icon name="arrowLeft" /> Back
        </Link>
      </PageHeader>

      <form onSubmit={submit} className="grid grid-main" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="card-head"><h2>Product details</h2></div>
          <div className="card-body">
            {error && (
              <div className="alert alert-error" role="alert">
                <Icon name="alertCircle" /> {error}
              </div>
            )}
            {changedMeanwhile && (
              <div className="alert alert-info" role="status">
                <Icon name="info" />
                <span>
                  {existing.updatedBy || "Someone"} just changed this product. You can keep editing; when you save you'll be asked which version to keep.
                </span>
              </div>
            )}
            <div className="field">
              <label className="label" htmlFor="name">Product name</label>
              <input id="name" className="input" value={form.name} onChange={set("name")} placeholder="e.g. Classic Blue Pen" required autoFocus={!editing} />
            </div>
            <div className="field-row">
              <div className="field">
                <label className="label" htmlFor="sku">SKU <span className="opt">(optional)</span></label>
                <div className="input-wrap">
                  <Icon name="barcode" />
                  <input id="sku" className="input mono" value={form.sku} onChange={set("sku")} placeholder={editing ? "" : "Auto: SKU-0001"} maxLength={40} />
                </div>
                <span className="hint">{editing ? "Must be unique in your business." : "Leave blank and we'll generate one."}</span>
              </div>
              <div className="field">
                <label className="label" htmlFor="category">Category</label>
                <input id="category" className="input" list="category-options" value={form.category} onChange={set("category")} placeholder="e.g. Stationery" required />
                <datalist id="category-options">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="label" htmlFor="warehouse">Warehouse / location <span className="opt">(optional)</span></label>
                <div className="input-wrap">
                  <Icon name="warehouse" />
                  <input id="warehouse" className="input" list="warehouse-options" value={form.warehouse} onChange={set("warehouse")} placeholder="e.g. Main Store, Rack B2" maxLength={80} />
                </div>
                <datalist id="warehouse-options">{warehouses.map((w) => <option key={w} value={w} />)}</datalist>
              </div>
              <div className="field">
                <label className="label" htmlFor="vendor">Vendor / supplier <span className="opt">(optional)</span></label>
                <input id="vendor" className="input" value={form.vendor} onChange={set("vendor")} placeholder="e.g. Acme Supplies" />
              </div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor="notes">Notes <span className="opt">(optional)</span></label>
              <textarea id="notes" className="textarea" value={form.notes} onChange={set("notes")} placeholder="Anything your team should know" />
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head"><h2>Pricing & stock</h2></div>
            <div className="card-body">
              <div className="field">
                <label className="label" htmlFor="price">Selling price (₹)</label>
                <div className="input-wrap">
                  <Icon name="rupee" />
                  <input id="price" type="number" step="0.01" min="0" className="input" value={form.price} onChange={set("price")} placeholder="0.00" required />
                </div>
              </div>
              {editing ? (
                <div className="field">
                  <span className="label">Current stock</span>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <strong className="num" style={{ fontSize: 22 }}>{existing.stock}</strong>
                    <StockBadge product={existing} />
                  </div>
                  <Link to={`/dashboard/stock?product=${existing.id}`} className="hint">Change quantity in Stock In / Out →</Link>
                </div>
              ) : (
                <div className="field">
                  <label className="label" htmlFor="stock">Opening stock</label>
                  <input id="stock" type="number" min="0" className="input" value={form.stock} onChange={set("stock")} placeholder="0" />
                </div>
              )}
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="label" htmlFor="min">Low-stock alert at</label>
                <input id="min" type="number" min="0" className="input" value={form.minThreshold} onChange={set("minThreshold")} required />
                <span className="hint">You'll be alerted when stock falls to this level.</span>
              </div>
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? <Spinner /> : <Icon name="check" />}
            {editing ? "Save changes" : "Add product"}
          </button>
        </div>
      </form>

      {conflict && (
        <ConflictDialog
          mine={conflict.payload}
          latest={conflict.latest}
          busy={busy}
          onUseLatest={applyLatest}
          onKeepMine={keepMine}
          onClose={() => setConflict(null)}
        />
      )}
    </>
  );
}
