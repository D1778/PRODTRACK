import { useState } from "react";
import { useApp } from "../context/AppContext";

export default function StaffManagement() {
  const { staffMembers, addStaffMember, removeStaffMember } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStaff = staffMembers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddStaff = async (e) => {
    e.preventDefault();
    setError("");
    const res = await addStaffMember(formData);
    if (res.success) {
      setShowAddModal(false);
      setFormData({ name: "", email: "", password: "" });
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header page-header-flex">
        <div>
          <h1 className="page-title">Staff Management</h1>
          <p className="page-subtitle">Manage your business staff accounts and permissions</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => setShowAddModal(true)}
          style={{ 
            padding: '10px 20px', 
            border: 'none',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          + Add Staff Member
        </button>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <input
          type="text"
          className="form-control"
          placeholder="Search staff members by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ maxWidth: '400px' }}
        />
      </div>

      <div className="card" style={{ padding: '24px', borderRadius: '16px', background: 'var(--light-surface)', border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px' }}>Name</th>
              <th style={{ padding: '12px' }}>Email</th>
              <th style={{ padding: '12px' }}>Role</th>
              <th style={{ padding: '12px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaff.length > 0 ? filteredStaff.map((staff) => (
              <tr key={staff.email} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px' }}>{staff.name}</td>
                <td style={{ padding: '12px' }}>{staff.email}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '6px', 
                    fontSize: '12px', 
                    backgroundColor: 'rgba(158, 127, 91, 0.1)', 
                    color: 'var(--primary)' 
                  }}>
                    Staff
                  </span>
                </td>
                <td style={{ padding: '12px' }}>
                  <button 
                    className="btn btn-secondary"
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '12px', 
                      background: 'var(--danger)', 
                      borderColor: 'var(--danger)', 
                      color: 'white' 
                    }}
                    onClick={async () => {
                      if (window.confirm(`Are you sure you want to remove ${staff.name}?`)) {
                        await removeStaffMember(staff.email);
                      }
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="4" style={{ padding: '24px', textAlign: 'center', opacity: 0.6 }}>No staff members found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 
        }}>
          <div className="card" style={{ width: '400px', padding: '32px', borderRadius: '20px', background: 'var(--light-surface)', border: '1px solid var(--border)' }}>
            <h2 style={{ marginBottom: '20px' }}>Add New Staff</h2>
            <form onSubmit={handleAddStaff} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="form-label">Full Name</label>
                <input 
                  type="text" 
                  className="form-control"
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                  required 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-control"
                  value={formData.email} 
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                  required 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="form-label">Temporary Password</label>
                <input 
                  type="password" 
                  className="form-control"
                  value={formData.password} 
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
                  required 
                />
              </div>
              {error && <p style={{ color: 'var(--danger)', fontSize: '14px' }}>{error}</p>}
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
