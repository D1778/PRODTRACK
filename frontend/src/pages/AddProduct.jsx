import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function AddProduct() {
    const { addProduct } = useApp();
    const navigate = useNavigate();
    const [msg, setMsg] = useState(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        addProduct({
            name: e.target.productName.value,
            category: e.target.category.value,
            stock: parseInt(e.target.initialStock.value),
            minThreshold: parseInt(e.target.minThreshold.value),
            vendor: e.target.vendor.value,
            notes: e.target.notes.value,
        });
        setMsg("Product added successfully!");
        e.target.reset();
        setTimeout(() => { setMsg(null); navigate("/dashboard/products"); }, 1500);
    };

    return (
        <div className="card">
            <div className="card-header">
                <h2 className="card-title">Add New Product</h2>
            </div>
            {msg && <div className="alert alert-success">{msg}</div>}
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label">Product Name *</label>
                    <input type="text" name="productName" className="form-control" placeholder="Enter product name" required />
                </div>
                <div className="form-group">
                    <label className="form-label">Category *</label>
                    <input type="text" name="category" className="form-control" placeholder="e.g., Electronics, Groceries" required />
                </div>
                <div className="form-group">
                    <label className="form-label">Initial Stock Quantity *</label>
                    <input type="number" name="initialStock" className="form-control" min="0" placeholder="0" required />
                </div>
                <div className="form-group">
                    <label className="form-label">Minimum Stock Threshold *</label>
                    <input type="number" name="minThreshold" className="form-control" min="0" placeholder="0" required />
                </div>
                <div className="form-group">
                    <label className="form-label">Vendor / Supplier (Optional)</label>
                    <input type="text" name="vendor" className="form-control" placeholder="Enter vendor name" />
                </div>
                <div className="form-group">
                    <label className="form-label">Notes (Optional)</label>
                    <textarea name="notes" className="form-control" placeholder="Additional information" />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button type="submit" className="btn btn-success">Save Product</button>
                    <button type="button" className="btn btn-secondary" onClick={() => navigate("/dashboard/products")}>Cancel</button>
                </div>
            </form>
        </div>
    );
}
