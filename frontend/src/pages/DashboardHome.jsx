import { useApp } from "../context/AppContext";

export default function DashboardHome() {
    const { products, stockHistory } = useApp();

    const lowStock = products.filter((p) => p.stock <= p.minThreshold).length;
    const today = new Date().toDateString();
    const todayH = stockHistory.filter((h) => new Date(h.timestamp).toDateString() === today);
    const inToday = todayH.filter((h) => h.action === "in").reduce((s, h) => s + h.quantity, 0);
    const outToday = todayH.filter((h) => h.action === "out").reduce((s, h) => s + h.quantity, 0);
    const recent = [...stockHistory].reverse().slice(0, 10);

    return (
        <div>
            <div className="summary-grid">
                <div className="summary-card">
                    <div className="summary-label">📦 Total Products</div>
                    <div className="summary-value">{products.length}</div>
                </div>
                <div className="summary-card warning">
                    <div className="summary-label">⚠️ Low Stock Items</div>
                    <div className="summary-value">{lowStock}</div>
                </div>
                <div className="summary-card success">
                    <div className="summary-label">📥 Stock In Today</div>
                    <div className="summary-value">{inToday}</div>
                </div>
                <div className="summary-card danger">
                    <div className="summary-label">📤 Stock Out Today</div>
                    <div className="summary-value">{outToday}</div>
                </div>
            </div>

            <div className="card">
                <h2 className="card-title">Recent Activity</h2>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Action</th>
                                <th>Quantity</th>
                                <th>Date & Time</th>
                                <th>Performed By</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recent.length > 0 ? recent.map((h) => (
                                <tr key={h.id}>
                                    <td><strong>{h.productName}</strong></td>
                                    <td>
                                        <span className={`badge badge-${h.action === "in" ? "success" : "danger"}`}>
                                            {h.action === "in" ? "Stock IN" : "Stock OUT"}
                                        </span>
                                    </td>
                                    <td>{h.quantity}</td>
                                    <td>{new Date(h.timestamp).toLocaleString()}</td>
                                    <td>{h.performedBy}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5}>
                                        <div className="empty-state">
                                            <h3>No Recent Activity</h3>
                                            <p>Stock movements will appear here</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
