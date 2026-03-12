import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function Profile() {
    const { currentUser, logout } = useApp();
    const navigate = useNavigate();

    return (
        <div className="card">
            <div className="card-header" style={{ marginBottom: "24px" }}>
                <h2 className="card-title">User Profile & Feedback</h2>
                <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>Manage your account details and send us your thoughts.</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", alignItems: "start" }}>
                {/* Left Column: Profile */}
                <div style={{ paddingRight: "40px", borderRight: "1px solid var(--border)" }}>
                    <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px", color: "var(--text-primary)" }}>Account Details</h3>
                    <div className="form-group">
                        <label className="form-label">Full Name</label>
                        <input type="text" className="form-control" value={currentUser?.name || ""} readOnly />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input type="email" className="form-control" value={currentUser?.email || ""} readOnly />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Role</label>
                        <input type="text" className="form-control" value={currentUser?.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : ""} readOnly />
                    </div>
                    <div className="form-group" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
                        <label className="form-label">Business Name</label>
                        <input type="text" className="form-control" value={currentUser?.businessName || ""} readOnly />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Business Password</label>
                        <input type="password" className="form-control" value={currentUser?.businessPassword || ""} readOnly />
                    </div>
                    <button className="btn btn-secondary" onClick={() => { logout(); navigate("/"); }} style={{ marginTop: "16px" }}>Logout</button>
                </div>

                {/* Right Column: Feedback Form */}
                <div>
                    <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px", color: "var(--text-primary)" }}>Send Feedback</h3>
                    <div className="form-group">
                        <label className="form-label">How can we improve PRODTRACK?</label>
                        <textarea
                            className="form-control"
                            rows="5"
                            placeholder="Tell us what you love, what you hate, and what you'd like to see next..."
                            style={{ resize: "vertical", minHeight: "120px" }}
                        ></textarea>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={() => alert("Thank you for your feedback! Our team will review it shortly.")}
                    >
                        Submit Feedback
                    </button>
                </div>
            </div>
        </div>
    );
}
