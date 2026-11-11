import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import ProductFilters from "../components/ProductFilters";
import { ConfirmDialog, EmptyState, Highlight, PageHeader, StockBadge, StockMeter } from "../components/ui";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { useProductFilters } from "../hooks/useProductFilters";
import { money } from "../lib/format";

function exportCSV(rows) {
  const header = ["SKU", "Name", "Category", "Warehouse", "Price", "Stock", "Min threshold", "Vendor"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((p) => [p.sku, p.name, p.category, p.warehouse, p.price, p.stock, p.minThreshold, p.vendor].map(esc).join(","));
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Products() {
  const { products, deleteProduct, loading } = useApp();
  const toast = useToast();
  const filters = useProductFilters(products);
  const [toDelete, setToDelete] = useState(null);
  const q = filters.filters.q;

  return (
    <>
      <PageHeader title="Products" subtitle="Search by SKU or warehouse, filter by stock level, and keep your catalogue tidy.">
        <button className="btn btn-secondary" onClick={() => exportCSV(filters.items)} disabled={!filters.items.length}>
          <Icon name="download" /> Export CSV
        </button>
        <Link to="/dashboard/add-product" className="btn btn-primary">
          <Icon name="plus" /> Add product
        </Link>
      </PageHeader>

      <div className="card">
        {products.length > 0 && <ProductFilters state={filters} total={products.length} />}

        {products.length === 0 ? (
          loading ? (
            <div className="card-body">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton" style={{ height: 44, marginBottom: 10 }} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="box"
              title="No products yet"
              text="Add your first product with its SKU and warehouse to start tracking stock."
              action={
                <Link to="/dashboard/add-product" className="btn btn-primary">
                  <Icon name="plus" /> Add product
                </Link>
              }
            />
          )
        ) : filters.items.length === 0 ? (
          <EmptyState
            icon="search"
            title="No matching products"
            text="Try a different SKU or name, or clear some filters."
            action={<button className="btn btn-secondary" onClick={filters.clearAll}>Clear filters</button>}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Warehouse</th>
                  <th className="right">Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th className="right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filters.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="cell-main"><Highlight text={p.name} query={q} /></div>
                      <div className="cell-sub">
                        <span className="tag"><Icon name="tag" /><Highlight text={p.category} query={q} /></span>
                        {p.vendor && <span>· <Highlight text={p.vendor} query={q} /></span>}
                      </div>
                    </td>
                    <td><span className="sku"><Highlight text={p.sku} query={q} /></span></td>
                    <td>
                      {p.warehouse ? (
                        <span className="cell-sub" style={{ marginTop: 0, color: "var(--text-2)" }}>
                          <Icon name="warehouse" width={14} height={14} />
                          <Highlight text={p.warehouse} query={q} />
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="right num">{money(p.price)}</td>
                    <td><StockMeter product={p} /></td>
                    <td><StockBadge product={p} /></td>
                    <td>
                      <div className="row-actions">
                        <Link to={`/dashboard/stock?product=${p.id}`} className="icon-btn" title="Stock in / out" aria-label={`Change stock for ${p.name}`}>
                          <Icon name="swap" />
                        </Link>
                        <Link to={`/dashboard/products/${p.id}/edit`} className="icon-btn" title="Edit" aria-label={`Edit ${p.name}`}>
                          <Icon name="edit" />
                        </Link>
                        <button className="icon-btn danger" title="Delete" aria-label={`Delete ${p.name}`} onClick={() => setToDelete(p)}>
                          <Icon name="trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toDelete && (
        <ConfirmDialog
          title={`Delete ${toDelete.name}?`}
          message={`This removes ${toDelete.sku} from your catalogue. Past bills and stock history are kept.`}
          onClose={() => setToDelete(null)}
          onConfirm={async () => {
            try {
              await deleteProduct(toDelete.id);
              toast.success(`${toDelete.name} deleted`);
            } catch (err) {
              toast.error(err.message);
              throw err;
            }
          }}
        />
      )}
    </>
  );
}
