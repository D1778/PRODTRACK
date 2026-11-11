import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import Icon from "../components/Icon";
import { PasswordInput, Spinner, StrengthMeter } from "../components/ui";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";

export default function Signup() {
  const { signup } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", businessName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      const user = await signup(form);
      toast.success(`Your workspace “${user.businessName}” is ready!`);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h1>Create your account</h1>
      <p className="sub">Set up your business in under a minute. No card needed.</p>

      {error && (
        <div className="alert alert-error" role="alert">
          <Icon name="alertCircle" />
          {error}
        </div>
      )}

      <form onSubmit={submit}>
        <div className="field-row">
          <div className="field">
            <label className="label" htmlFor="name">Your name</label>
            <div className="input-wrap">
              <Icon name="user" />
              <input id="name" className="input" placeholder="Asha Kumar" value={form.name} onChange={set("name")} autoComplete="name" autoFocus required />
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="business">Business name</label>
            <div className="input-wrap">
              <Icon name="store" />
              <input id="business" className="input" placeholder="Asha Stores" value={form.businessName} onChange={set("businessName")} autoComplete="organization" required />
            </div>
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="email">Work email</label>
          <div className="input-wrap">
            <Icon name="mail" />
            <input id="email" type="email" className="input" placeholder="you@business.com" value={form.email} onChange={set("email")} autoComplete="email" required />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="password">Password</label>
          <PasswordInput id="password" value={form.password} onChange={set("password")} placeholder="Create a password" autoComplete="new-password" />
          <StrengthMeter password={form.password} />
        </div>
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? <Spinner /> : null}
          {busy ? "Creating your workspace…" : "Create account"}
          {!busy && <Icon name="arrowRight" />}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
      <p className="auth-legal">You'll be the owner and can invite staff from your dashboard.</p>
    </AuthLayout>
  );
}
