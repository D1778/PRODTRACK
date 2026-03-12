import { useApp } from "../context/AppContext";
import { Link } from "react-router-dom";

export default function DashboardHome() {
    const { products, stockHistory, currentUser, salesAnalytics, bills } = useApp();

    const lowStockItems = products.filter((p) => p.stock <= p.minThreshold);
    const lowStockCount = lowStockItems.length;
    const today = new Date().toDateString();
    
    // Sales Logic
    const todayBills = bills.filter(b => new Date(b.timestamp).toDateString() === today);
    const todaySales = todayBills.reduce((sum, b) => sum + b.totalAmount, 0);
    const totalSales = bills.reduce((sum, b) => sum + b.totalAmount, 0);

    const recentActivity = [...stockHistory].reverse().slice(0, 5);

    if (currentUser?.role === "owner") {
        return (
            <div className="dashboard-owner">
                <header style={{ marginBottom: '32px' }}>
                    <h1 className="page-title">{currentUser?.businessName || "Business"} Dashboard</h1>
                    <p style={{ opacity: 0.6 }}>Analyze performance and manage operations</p>
                </header>

                <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                    <div className="summary-card" style={{ backgroundColor: 'var(--light-surface)', border: '1px solid var(--border)' }}>
                        <div className="summary-label">Today's Sales</div>
                        <div className="summary-value">₹{todaySales}</div>
                    </div>
                    <div className="summary-card" style={{ backgroundColor: 'var(--light-surface)', border: '1px solid var(--border)' }}>
                        <div className="summary-label">Total Volume</div>
                        <div className="summary-value">₹{totalSales}</div>
                    </div>
                    <div className={`summary-card ${lowStockCount > 0 ? 'warning' : 'success'}`}>
                        <div className="summary-label">Inventory Health</div>
                        <div className="summary-value">{lowStockCount} Low Items</div>
                    </div>
                    <div className="summary-card" style={{ backgroundColor: 'var(--light-surface)', border: '1px solid var(--border)' }}>
                        <div className="summary-label">Total Products</div>
                        <div className="summary-value">{products.length}</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
                    <div className="card" style={{ padding: '24px', borderRadius: '20px', background: 'var(--light-surface)', border: '1px solid var(--border)' }}>
                        <h2 style={{ marginBottom: '20px' }}>Sales Performance</h2>
                        <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '20px 0' }}>
                           {salesAnalytics.map((day, i) => (
                             <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                               <div style={{ 
                                 width: '100%', 
                                 height: `${Math.min((day.totalSales / (todaySales || 1000)) * 100, 100)}%`, 
                                 background: 'var(--gradient-1)', 
                                 borderRadius: '4px' 
                               }}></div>
                               <span style={{ fontSize: '10px', opacity: 0.6 }}>{day.date.slice(5)}</span>
                             </div>
                           ))}
                           {salesAnalytics.length === 0 && <p style={{ width: '100%', textAlign: 'center', opacity: 0.5 }}>No sale data recorded yet</p>}
                        </div>
                    </div>

                    <div className="card" style={{ padding: '24px', borderRadius: '20px', background: 'var(--light-surface)', border: '1px solid var(--border)' }}>
                        <h2 style={{ marginBottom: '20px' }}>Quick Actions</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <Link to="/dashboard/staff" className="btn btn-primary" style={{ textAlign: 'center' }}>Manage Staff</Link>
                            <Link to="/dashboard/add-product" className="btn btn-secondary" style={{ textAlign: 'center' }}>Add New Product</Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Staff Dashboard
    return (
        <div className="dashboard-staff">
            <header style={{ marginBottom: '32px' }}>
                <h1 className="page-title">{currentUser?.businessName || "Business"} Terminal</h1>
                <p style={{ opacity: 0.6 }}>Manage daily sales and inventory requests</p>
            </header>

            <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
                <div className="summary-card" style={{ backgroundColor: 'var(--light-surface)', border: '1px solid var(--border)' }}>
                    <div className="summary-label">My Sales Today</div>
                    <div className="summary-value">₹{todaySales}</div>
                </div>
                <div className="summary-card" style={{ backgroundColor: 'var(--light-surface)', border: '1px solid var(--border)' }}>
                    <div className="summary-label">Items Sold Today</div>
                    <div className="summary-value">{todayBills.reduce((s, b) => s + b.items.length, 0)}</div>
                </div>
                <div className="summary-card" style={{ backgroundColor: 'var(--light-surface)', border: '1px solid var(--border)' }}>
                    <div className="summary-label">Available Products</div>
                    <div className="summary-value">{products.length}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div className="card" style={{ padding: '32px', borderRadius: '24px', textAlign: 'center', border: '1px solid var(--primary)', background: 'var(--light-surface)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛒</div>
                    <h2>New Billing</h2>
                    <p style={{ opacity: 0.6, marginBottom: '24px' }}>Create a new bill and process checkout for a customer.</p>
                    <Link to="/dashboard/billing" className="btn btn-primary" style={{ display: 'inline-block', padding: '12px 32px' }}>Open Terminal</Link>
                </div>

                <div className="card" style={{ padding: '24px', borderRadius: '20px', background: 'var(--light-surface)', border: '1px solid var(--border)' }}>
                    <h2 style={{ marginBottom: '20px' }}>Recent Sales</h2>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {todayBills.length > 0 ? todayBills.map((b, i) => (
                          <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Bill #{b.id.toString().slice(-5)}</span>
                            <span style={{ fontWeight: 'bold' }}>₹{b.totalAmount}</span>
                          </div>
                        )) : <p style={{ opacity: 0.5, textAlign: 'center' }}>No sales today</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
