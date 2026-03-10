import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function Login() {
  const { login } = useApp();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    const email = e.target.email.value;
    const password = e.target.password.value;
    const shopName = e.target.shopName.value;
    const shopId = e.target.shopId.value;

    setLoading(true);
    const result = await login(email, password, shopName, shopId);
    setLoading(false);

    if (result.success) {
      navigate("/dashboard");
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <Link to="/"><h1>PRODTRACK</h1></Link>
          <p>Inventory Management System</p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input type="email" name="email" className="form-control" placeholder="Enter your email" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" name="password" className="form-control" placeholder="Enter your password" required />
          </div>
          <div className="form-group">
            <label className="form-label">Shop Name</label>
            <input type="text" name="shopName" className="form-control" placeholder="Enter shop name" required />
          </div>
          <div className="form-group">
            <label className="form-label">Shop ID</label>
            <input type="text" name="shopId" className="form-control" placeholder="Enter shop ID" required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        <div className="auth-footer">
          Don't have an account? <Link to="/signup" className="auth-link">Sign up here</Link>
        </div>
      </div>
    </div>
  );
}
