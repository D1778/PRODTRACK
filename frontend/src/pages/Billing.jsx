import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Billing() {
  const { products, createBill, bills, currentUser } = useApp();
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [view, setView] = useState("new"); // "new" or "records"
  const [selectedBill, setSelectedBill] = useState(null);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product) => {
    if (product.stock <= 0) {
      setMessage({ text: "Product out of stock", type: "error" });
      return;
    }
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      if (existing.quantity + 1 > product.stock) {
        setMessage({ text: "Insufficient stock", type: "error" });
        return;
      }
      setCart(cart.map(item => 
        item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      // For this demo, we assume price is 100 if not specified (we should add price to Product struct)
      // Since backend doesn't have price yet, let's hardcode or imagine one.
    setCart([...cart, { 
        productId: product.id, 
        productName: product.name, 
        quantity: 1, 
        price: product.price 
      }]);
    }
    setMessage({ text: "", type: "" });
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    const billData = {
      items: cart,
      totalAmount: totalAmount
    };
    const res = await createBill(billData);
    if (res.success) {
      setCart([]);
      setMessage({ text: "Bill generated and recorded successfully!", type: "success" });
      setTimeout(() => setMessage({ text: "", type: "" }), 3000);
    } else {
      setMessage({ text: res.message || "Checkout failed", type: "error" });
    }
  };

  const downloadPDF = (bill) => {
    try {
      const doc = new jsPDF();
      const date = new Date(bill.timestamp).toLocaleString();

      // Business Header
      doc.setFontSize(22);
      doc.setTextColor(158, 127, 91); // --primary color
      doc.text(currentUser?.businessName || "INVENTORY MANAGEMENT SYSTEM", 105, 20, { align: "center" });
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Bill ID: ${bill.id}`, 20, 35);
      doc.text(`Date & Time: ${date}`, 20, 42);
      doc.text(`Processed By: ${bill.createdBy || "System"}`, 20, 49);

      // Table
      const tableData = bill.items.map(item => [
        item.productName,
        `₹${item.price}`,
        item.quantity,
        `₹${item.price * item.quantity}`
      ]);

      autoTable(doc, {
          startY: 60,
          head: [['Product', 'Price', 'Qty', 'Total']],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [158, 127, 91] },
          styles: { fontSize: 10, cellPadding: 5 },
          columnStyles: { 3: { halign: 'right' } }
      });

      const finalY = (doc).lastAutoTable.finalY + 10;
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text(`Grand Total: ₹${bill.totalAmount}`, 190, finalY, { align: "right" });

      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text("Thank you for your business!", 105, finalY + 25, { align: "center" });

      doc.save(`bill_${bill.id}.pdf`);
    } catch (err) {
      console.error("PDF Generation Error:", err);
      alert("Failed to generate PDF. Make sure all items are correctly loaded.");
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        <button 
          onClick={() => setView("new")} 
          style={{ 
            background: 'none', 
            border: 'none', 
            fontWeight: 'bold', 
            color: view === "new" ? 'var(--primary)' : 'var(--text-secondary)',
            borderBottom: view === "new" ? '2px solid var(--primary)' : 'none',
            padding: '8px 16px',
            cursor: 'pointer'
          }}
        >
          New Bill
        </button>
        <button 
          onClick={() => setView("records")} 
          style={{ 
            background: 'none', 
            border: 'none', 
            fontWeight: 'bold', 
            color: view === "records" ? 'var(--primary)' : 'var(--text-secondary)',
            borderBottom: view === "records" ? '2px solid var(--primary)' : 'none',
            padding: '8px 16px',
            cursor: 'pointer'
          }}
        >
          Bill Records
        </button>
      </div>

      {view === "new" ? (
        <div className="billing-grid">
          <div className="inventory-section">
            <div style={{ marginBottom: '24px' }}>
              <h1 className="page-title">Generate Bill</h1>
              <input 
                type="text" 
                placeholder="Search products..." 
                className="form-control"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ marginTop: '12px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              {filteredProducts.map(product => (
                <div key={product.id} className="card" style={{ padding: '16px', borderRadius: '12px', textAlign: 'center', background: 'var(--light-surface)', border: '1px solid var(--border)' }}>
                  <h3 style={{ margin: '0 0 8px 0' }}>{product.name}</h3>
                  <p style={{ opacity: 0.6, fontSize: '14px', marginBottom: '12px' }}>{product.category}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>₹ {product.price}</span>
                    <span style={{ fontSize: '12px', color: product.stock < 10 ? 'var(--warning)' : 'var(--success)' }}>Stock: {product.stock}</span>
                  </div>
                  <button 
                    onClick={() => addToCart(product)}
                    className="btn btn-secondary"
                    disabled={product.stock <= 0}
                    style={{ width: '100%', padding: '8px', fontSize: '14px' }}
                  >
                    Add to Bill
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="cart-section">
            <div className="card" style={{ padding: '24px', borderRadius: '20px', position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 150px)', background: 'var(--light-surface)', border: '1px solid var(--border)' }}>
              <h2 style={{ marginBottom: '20px' }}>Current Bill</h2>
              
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px' }}>
                {cart.length > 0 ? cart.map(item => (
                  <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <h4 style={{ margin: 0 }}>{item.productName}</h4>
                      <p style={{ margin: 0, fontSize: '12px', opacity: 0.6 }}>{item.quantity} x ₹{item.price}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 'bold' }}>₹{item.quantity * item.price}</span>
                      <button onClick={() => removeFromCart(item.productId)} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>✕</button>
                    </div>
                  </div>
                )) : (
                  <p style={{ textAlign: 'center', opacity: 0.6, marginTop: '40px' }}>No items in bill.</p>
                )}
              </div>

              <div style={{ borderTop: '2px solid var(--border)', paddingTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 'bold' }}>Total</span>
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary)' }}>₹{totalAmount}</span>
                </div>
                
                {message.text && (
                  <p style={{ color: message.type === 'success' ? 'var(--success)' : 'var(--danger)', marginBottom: '12px', textAlign: 'center', fontSize: '14px' }}>
                    {message.text}
                  </p>
                )}

                <button 
                  onClick={handleCheckout}
                  disabled={cart.length === 0}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '16px', fontSize: '16px' }}
                >
                  Print Bill & Record Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="records-section">
          <div className="card" style={{ padding: '24px', borderRadius: '16px', background: 'var(--light-surface)', border: '1px solid var(--border)' }}>
            <h2 style={{ marginBottom: '20px' }}>Recent Bills</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px' }}>Bill ID</th>
                  <th style={{ padding: '12px' }}>Date</th>
                  <th style={{ padding: '12px' }}>Total</th>
                  <th style={{ padding: '12px' }}>Processed By</th>
                  <th style={{ padding: '12px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bills.length > 0 ? [...bills].reverse().map(bill => (
                  <tr key={bill.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px' }}>#{String(bill.id).slice(-6)}</td>
                    <td style={{ padding: '12px' }}>{new Date(bill.timestamp).toLocaleDateString()}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>₹{bill.totalAmount}</td>
                    <td style={{ padding: '12px' }}>{bill.createdBy}</td>
                    <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => setSelectedBill(bill)}
                      >
                        Details
                      </button>
                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => downloadPDF(bill)}
                      >
                        Download PDF
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" style={{ padding: '24px', textAlign: 'center', opacity: 0.6 }}>No bills recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedBill && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '500px', maxHeight: '80vh', overflowY: 'auto', padding: '32px', borderRadius: '20px', background: 'var(--light-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h2>Bill Details</h2>
              <button onClick={() => setSelectedBill(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            
            <div style={{ marginBottom: '20px', fontSize: '14px', opacity: 0.8 }}>
              <p><strong>Bill ID:</strong> #{selectedBill.id}</p>
              <p><strong>Date:</strong> {new Date(selectedBill.timestamp).toLocaleString()}</p>
              <p><strong>Processed By:</strong> {selectedBill.createdBy}</p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Items</h4>
              {selectedBill.items.map(item => (
                <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>{item.productName} (x{item.quantity})</span>
                  <span>₹{item.price * item.quantity}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold', borderTop: '2px solid var(--border)', paddingTop: '16px', marginBottom: '24px' }}>
              <span>Grand Total</span>
              <span style={{ color: 'var(--primary)' }}>₹{selectedBill.totalAmount}</span>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%' }}
              onClick={() => downloadPDF(selectedBill)}
            >
              Download PDF Bill
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
