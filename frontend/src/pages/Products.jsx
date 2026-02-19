import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function Products() {
    const { products, currentUser } = useApp();
    const [search, setSearch] = useState("");
    const [cat, setCat] = useState("");

    const cats = useMemo(() => [...new Set(products.map((p) => p.category))], [products]);
    const filtered = useMemo(() => {
        let r = products;
        if (search) r = r.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
        if (cat) r = r.filter((p) => p.category === cat);
        return r;
    }, [products, search, cat]);

    return (
        <div className="card">
            <div className="card-header">
                <h2 className="card-title">All Products</h2>
                {currentUser?.role === "owner" && (
                    <Link to="/dashboard/add-product" className="btn btn-primary">+ Add Product</Link>
                )}
            </div>
            <div className="filters">
                <div className="filter-group">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Search products..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="filter-group">
                    <select className="form-control" value={cat} onChange={(e) => setCat(e.target.value)}>
                        <option value="">All Categories</option>
                        {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Product Name</th>
                            <th>Category</th>
                            <th>Current Stock</th>
                            <th>Min Threshold</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length > 0 ? filtered.map((p) => {
                            const isLow = p.stock <= p.minThreshold;
                            return (
                                <tr key={p.id} className={isLow ? "low-stock-row" : ""}>
                                    <td><strong>{p.name}</strong></td>
                                    <td>{p.category}</td>
                                    <td>{p.stock}</td>
                                    <td>{p.minThreshold}</td>
                                    <td>
                                        <span className={`badge badge-${isLow ? "warning" : "success"}`}>
                                            {isLow ? "Low Stock" : "OK"}
                                        </span>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={5}>
                                    <div className="empty-state">
                                        <h3>No Products Found</h3>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
