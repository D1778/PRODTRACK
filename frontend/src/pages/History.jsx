import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";

export default function History() {
    const { stockHistory } = useApp();
    const [pf, setPf] = useState("");
    const [af, setAf] = useState("");

    const names = useMemo(() => [...new Set(stockHistory.map((h) => h.productName))], [stockHistory]);
    const filtered = useMemo(() => {
        let r = [...stockHistory].reverse();
        if (pf) r = r.filter((h) => h.productName === pf);
        if (af) r = r.filter((h) => h.action === af);
        return r;
    }, [stockHistory, pf, af]);

    return (
        <div className="card">
            <div className="card-header">
                <h2 className="card-title">Stock Movement History</h2>
            </div>
            <div className="filters">
                <div className="filter-group">
                    <select className="form-control" value={pf} onChange={(e) => setPf(e.target.value)}>
                        <option value="">All Products</option>
                        {names.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                </div>
                <div className="filter-group">
                    <select className="form-control" value={af} onChange={(e) => setAf(e.target.value)}>
                        <option value="">All Actions</option>
                        <option value="in">Stock IN</option>
                        <option value="out">Stock OUT</option>
                    </select>
                </div>
            </div>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Product Name</th>
                            <th>Action Type</th>
                            <th>Quantity</th>
                            <th>Performed By</th>
                            <th>Date & Time</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length > 0 ? filtered.map((h) => (
                            <tr key={h.id}>
                                <td><strong>{h.productName}</strong></td>
                                <td>
                                    <span className={`badge badge-${h.action === "in" ? "success" : "danger"}`}>
                                        {h.action === "in" ? "Stock IN" : "Stock OUT"}
                                    </span>
                                </td>
                                <td>{h.quantity}</td>
                                <td>{h.performedBy}</td>
                                <td>{new Date(h.timestamp).toLocaleString()}</td>
                                <td>{h.notes || "-"}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={6}>
                                    <div className="empty-state">
                                        <div className="empty-icon">📋</div>
                                        <h3>No History Found</h3>
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
