import { useState } from "react";
import { useApp } from "../context/AppContext";

export default function Stock() {
    const { products, updateStock } = useApp();
    const [action, setAction] = useState("");
    const [msg, setMsg] = useState(null);

    const selectAction = (a) => setAction(a);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!action) { setMsg({ ok: false, text: "Please select a stock action" }); return; }
        const productId = parseInt(e.target.product.value);
        const qty = parseInt(e.target.qty.value);
        const reason = e.target.reason.value;
        const res = updateStock(productId, action, qty, reason);
        setMsg({ ok: res.success, text: res.message });
        if (res.success) { e.target.reset(); setAction(""); }
        setTimeout(() => setMsg(null), 3000);
    };

    return (
        <div className="card">
            <div className="card-header">
                <h2 className="card-title">Update Stock</h2>
            </div>
            {msg && <div className={`alert ${msg.ok ? "alert-success" : "alert-error"}`}>{msg.text}</div>}
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label">Stock Action *</label>
                    <div className="stock-action-grid">
                        <div className={`action-option ${action === "in" ? "selected" : ""}`} onClick={() => selectAction("in")}>
                            <h3>📥 Stock IN</h3>
                            <p>Add inventory</p>
                        </div>
                        <div className={`action-option ${action === "out" ? "selected" : ""}`} onClick={() => selectAction("out")}>
                            <h3>📤 Stock OUT</h3>
                            <p>Remove inventory</p>
                        </div>
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Select Product *</label>
                    <select name="product" className="form-control" required>
                        <option value="">Choose a product</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name} (Current: {p.stock})</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Quantity *</label>
                    <input type="number" name="qty" className="form-control" min="1" placeholder="0" required />
                </div>
                <div className="form-group">
                    <label className="form-label">Reason / Notes</label>
                    <textarea name="reason" className="form-control" placeholder="Optional notes" />
                </div>
                <button type="submit" className="btn btn-primary">Submit Stock Update</button>
            </form>
        </div>
    );
}
