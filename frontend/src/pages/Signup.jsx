import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function Signup() {
  const { signup } = useApp();
  const navigate = useNavigate();
  const [message, setMessage] = useState(null);

  const handleSignup = (e) => {
    e.preventDefault();
    const role = e.target.role.value;
    if (!role) { setMessage({ ok: false, text: "Please select a role" }); return; }
    signup(e.target.fullName.value, e.target.email.value, e.target.password.value, role);
    setMessage({ ok: true, text: "Account created successfully! Redirecting..." });
    setTimeout(() => { setMessage(null); navigate("/login"); }, 1500);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <Link to="/"><h1>📦 PRODTRACK</h1></Link>
          <p>Create Your Account</p>
        </div>
        {message && (
          <div className={`alert ${message.ok ? "alert-success" : "alert-error"}`}>{message.text}</div>
        )}
        <form onSubmit={handleSignup}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input type="text" name="fullName" className="form-control" placeholder="Enter your full name" required />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input type="email" name="email" className="form-control" placeholder="Enter your email" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" name="password" className="form-control" placeholder="Create a password" required />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select name="role" className="form-control" required>
              <option value="">Select your role</option>
              <option value="owner">Owner</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create Account</button>
        </form>
        <div className="auth-footer">
          Already have an account? <Link to="/login" className="auth-link">Login here</Link>
        </div>
      </div>
    </div>
  );
}
