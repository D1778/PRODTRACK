import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function Profile() {
    const { currentUser, logout } = useApp();
    const navigate = useNavigate();

    return (
        <div className="card">
            <div className="card-header">
                <h2 className="card-title">User Profile</h2>
            </div>
            <div style={{ maxWidth: 500 }}>
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
                <button className="btn btn-secondary" onClick={() => { logout(); navigate("/"); }}>Logout</button>
            </div>
        </div>
    );
}
