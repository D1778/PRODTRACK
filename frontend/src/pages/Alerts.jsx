import { useApp } from "../context/AppContext";

export default function Alerts() {
    const { products } = useApp();
    const low = products.filter((p) => p.stock <= p.minThreshold);

    return (
        <div className="card">
            <div className="card-header">
                <h2 className="card-title">Low Stock Alerts</h2>
            </div>
            {low.length > 0 ? low.map((p) => {
                const isOut = p.stock === 0;
                return (
                    <div key={p.id} className={`alert alert-${isOut ? "error" : "warning"}`}>
                        <div>
                            <strong>{p.name}</strong>
                            <div style={{ fontSize: 13, marginTop: 4 }}>
                                Current Stock: <strong>{p.stock}</strong> | Minimum Threshold: <strong>{p.minThreshold}</strong>
                                {isOut && <span style={{ color: 'var(--danger)', marginLeft: 8 }}>⚠️ OUT OF STOCK</span>}
                            </div>
                        </div>
                    </div>
                );
            }) : (
                <div className="empty-state">
                    <div className="empty-icon">✅</div>
                    <h3>All Good!</h3>
                    <p>No low stock alerts at this time.</p>
                </div>
            )}
        </div>
    );
}
