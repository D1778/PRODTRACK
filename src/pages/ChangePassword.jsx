import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import ResetByCode from "../components/ResetByCode";
import { PageHeader, PasswordInput, Spinner, StrengthMeter } from "../components/ui";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";

// Opened from the Edit button on the Profile page's Password row.
// Normally: current password + new password. If the current one is forgotten, a
// code is emailed to the account's own address and used to set a new password.
export default function ChangePassword() {
  const { user, updateProfile, forgotPassword, logout } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState("change"); // "change" | "forgot" | "code"
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const change = async (e) => {
    e.preventDefault();
    setError("");
    if (form.next.length < 8) return setError("New password must be at least 8 characters");
    if (form.next !== form.confirm) return setError("New passwords don't match");
    setBusy(true);
    try {
      await updateProfile({ name: user.name, email: user.email, currentPassword: form.current, newPassword: form.next });
      toast.success("Password changed");
      navigate("/dashboard/profile");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const sendCode = async () => {
    setError("");
    setBusy(true);
    try {
      await forgotPassword(user.email);
      setMode("code");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center-page">
      <PageHeader title="Change password" subtitle="Choose a new password for your account." />

      <div className="card mb">
        <div className="card-body">
          <Link to="/dashboard/profile" className="back-link">
            <Icon name="arrowLeft" size={16} /> Back to profile
          </Link>

          {error && <div className="alert alert-error" role="alert"><Icon name="alertCircle" /> {error}</div>}

          {mode === "change" && (
            <form onSubmit={change}>
              <div className="field">
                <label className="label" htmlFor="cp-cur">Current password</label>
                <PasswordInput id="cp-cur" value={form.current} onChange={set("current")} autoComplete="current-password" autoFocus />
                <button type="button" onClick={() => { setError(""); setMode("forgot"); }} style={{ alignSelf: "flex-start", textAlign: "left", background: "none", border: 0, padding: 0, marginTop: 8, color: "var(--primary-text, #4f46e5)", font: "inherit", fontSize: 13.5, textDecoration: "underline", cursor: "pointer" }}>
                  Forgot your current password?
                </button>
              </div>
              <div className="field">
                <label className="label" htmlFor="cp-new">New password</label>
                <PasswordInput id="cp-new" value={form.next} onChange={set("next")} autoComplete="new-password" />
                <StrengthMeter password={form.next} />
              </div>
              <div className="field">
                <label className="label" htmlFor="cp-confirm">Confirm new password</label>
                <PasswordInput id="cp-confirm" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" />
              </div>
              <div className="detail-actions">
                <button className="btn btn-primary" disabled={busy || !form.current || !form.next}>
                  {busy ? <Spinner /> : <Icon name="lock" />} Update password
                </button>
                <Link to="/dashboard/profile" className="btn btn-secondary">Cancel</Link>
              </div>
            </form>
          )}

          {mode === "forgot" && (
            <div>
              <h3 style={{ margin: "0 0 6px" }}>Forgot your password?</h3>
              <p className="muted" style={{ marginBottom: 16 }}>
                We'll email a 6-digit code to <strong>{user.email}</strong>. Enter it on the next screen to choose a new password. You'll be asked to log in again afterwards.
              </p>
              <div className="detail-actions">
                <button type="button" className="btn btn-primary" onClick={sendCode} disabled={busy}>
                  {busy ? <Spinner /> : <Icon name="mail" />} Email me a code
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => { setError(""); setMode("change"); }} disabled={busy}>Back</button>
              </div>
            </div>
          )}

          {mode === "code" && (
            <div>
              <p className="muted" style={{ marginBottom: 16 }}>
                Enter the 6-digit code we sent to <strong>{user.email}</strong> and your new password. The code expires in 10 minutes.
              </p>
              <ResetByCode
                email={user.email}
                onDone={() => {
                  // A reset signs out every earlier login, this one included
                  toast.success("Password changed. Please log in again");
                  logout();
                  navigate("/login", { replace: true });
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
