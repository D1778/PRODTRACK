import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function Profile() {
    const { currentUser, logout, updateProfile } = useApp();
    const navigate = useNavigate();
    const [feedback, setFeedback] = useState("");

    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(currentUser?.name || "");
    const [editEmail, setEditEmail] = useState(currentUser?.email || "");
    const [editPassword, setEditPassword] = useState("");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    const handleEditToggle = () => {
        setEditName(currentUser?.name || "");
        setEditEmail(currentUser?.email || "");
        setEditPassword("");
        setIsEditing(true);
        setMessage(null);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setMessage(null);
    };

    const handleSave = async () => {
        if (!editName.trim() || !editEmail.trim()) {
            setMessage({ type: "error", text: "Name and Email cannot be empty." });
            return;
        }
        setSaving(true);
        setMessage(null);
        const result = await updateProfile(editName.trim(), editEmail.trim(), editPassword);
        setSaving(false);
        if (result.success) {
            setIsEditing(false);
            setMessage({ type: "success", text: result.message });
        } else {
            setMessage({ type: "error", text: result.message });
        }
    };

    const handleFeedbackSubmit = () => {
        if (!feedback.trim()) return;
        alert("Thank you for your feedback! Our team will review it shortly.");
        setFeedback("");
    };

    return (
        <div className="card">
            <div className="card-header" style={{ marginBottom: "24px" }}>
                <h2 className="card-title">User Profile & Feedback</h2>
                <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>Manage your account details and send us your thoughts.</p>
            </div>

            {message && (
                <div className={`alert alert-${message.type}`} style={{ marginBottom: "20px" }}>
                    {message.text}
                </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", alignItems: "start" }}>
                {/* Left Column: Profile */}
                <div style={{ paddingRight: "40px", borderRight: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                        <h3 style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-primary)" }}>Account Details</h3>
                        {!isEditing && (
                            <button
                                className="btn btn-ghost"
                                onClick={handleEditToggle}
                                style={{ padding: "8px 16px", fontSize: "13px" }}
                            >
                                ✏️ Edit Profile
                            </button>
                        )}
                    </div>
                    <div className="form-group">
                        <label className="form-label">Full Name</label>
                        <input
                            type="text"
                            className="form-control"
                            value={isEditing ? editName : (currentUser?.name || "")}
                            onChange={(e) => setEditName(e.target.value)}
                            readOnly={!isEditing}
                            style={!isEditing ? { opacity: 0.85 } : { borderColor: "var(--primary)" }}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input
                            type="email"
                            className="form-control"
                            value={isEditing ? editEmail : (currentUser?.email || "")}
                            onChange={(e) => setEditEmail(e.target.value)}
                            readOnly={!isEditing}
                            style={!isEditing ? { opacity: 0.85 } : { borderColor: "var(--primary)" }}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Role</label>
                        <input type="text" className="form-control" value={currentUser?.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : ""} readOnly style={{ opacity: isEditing ? 0.5 : 0.85 }} />
                    </div>
                    <div className="form-group" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
                        <label className="form-label">Business Name</label>
                        <input type="text" className="form-control" value={currentUser?.businessName || ""} readOnly style={{ opacity: isEditing ? 0.5 : 0.85 }} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Business Password</label>
                        <input type="password" className="form-control" value={currentUser?.businessPassword || ""} readOnly style={{ opacity: isEditing ? 0.5 : 0.85 }} />
                    </div>

                    {isEditing && (
                        <div className="form-group" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
                            <label className="form-label">New Password <span style={{ fontWeight: 400, color: "var(--text-tertiary)" }}>(leave blank to keep current)</span></label>
                            <input
                                type="password"
                                className="form-control"
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                placeholder="Enter new password..."
                                style={{ borderColor: "var(--primary)" }}
                            />
                        </div>
                    )}

                    {isEditing ? (
                        <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? "Saving..." : "💾 Save"}
                            </button>
                            <button className="btn btn-secondary" onClick={handleCancel} disabled={saving}>
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <button className="btn btn-secondary" onClick={() => { logout(); navigate("/"); }} style={{ marginTop: "16px" }}>Logout</button>
                    )}
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
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                        ></textarea>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={handleFeedbackSubmit}
                    >
                        Submit Feedback
                    </button>
                </div>
            </div>
        </div>
    );
}
