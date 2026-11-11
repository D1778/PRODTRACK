import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import Icon from "../components/Icon";
import { PasswordInput, Spinner } from "../components/ui";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";

export default function Login() {
  const { login } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name.split(" ")[0]}!`);
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h1>Welcome back</h1>
      <p className="sub">Log in to manage your inventory and sales.</p>

      {error && (
        <div className="alert alert-error" role="alert">
          <Icon name="alertCircle" />
          {error}
        </div>
      )}

      <form onSubmit={submit} noValidate={false}>
        <div className="field">
          <label className="label" htmlFor="email">Email</label>
          <div className="input-wrap">
            <Icon name="mail" />
            <input
              id="email"
              type="email"
              className="input"
              placeholder="you@business.com"
              value={form.email}
              onChange={set("email")}
              autoComplete="email"
              autoFocus
              required
            />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="password">Password</label>
          <PasswordInput
            id="password"
            value={form.password}
            onChange={set("password")}
            placeholder="Your password"
            autoComplete="current-password"
          />
        </div>
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? <Spinner /> : null}
          {busy ? "Logging in…" : "Log in"}
          {!busy && <Icon name="arrowRight" />}
        </button>
      </form>

      <p className="auth-switch">
        New to ProdTrack? <Link to="/signup">Create a free account</Link>
      </p>
      <p className="auth-legal">Staff accounts are created by the business owner from the Staff page.</p>
    </AuthLayout>
  );
}
