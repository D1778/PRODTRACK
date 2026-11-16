import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import Icon from "../components/Icon";
import ResetByCode from "../components/ResetByCode";
import { Spinner } from "../components/ui";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";

// Public page: enter your email, get a code, set a new password.
export default function ForgotPassword() {
  const { forgotPassword } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const sendCode = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout>
        <h1>Reset your password</h1>
        <p className="sub">
          If an account exists for <strong>{email.trim()}</strong>, we've sent it a 6-digit code. Enter it below with your new password. The code expires in 10 minutes.
        </p>
        <ResetByCode
          email={email.trim()}
          onDone={() => {
            toast.success("Password changed. Log in with your new password");
            navigate("/login", { replace: true });
          }}
        />
        <p className="auth-legal">
          Wrong email? <button type="button" onClick={() => setSent(false)} style={{ background: "none", border: 0, padding: 0, color: "inherit", font: "inherit", textDecoration: "underline", cursor: "pointer" }}>Use a different one</button> · <Link to="/login">Back to log in</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1>Forgot your password?</h1>
      <p className="sub">Enter your account email and we'll send you a code to reset it.</p>

      {error && (
        <div className="alert alert-error" role="alert">
          <Icon name="alertCircle" />
          {error}
        </div>
      )}

      <form onSubmit={sendCode}>
        <div className="field">
          <label className="label" htmlFor="fp-email">Email</label>
          <div className="input-wrap">
            <Icon name="mail" />
            <input id="fp-email" type="email" className="input" placeholder="you@business.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus required />
          </div>
        </div>
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || !email.trim()}>
          {busy ? <Spinner /> : null}
          {busy ? "Sending…" : "Send code"}
          {!busy && <Icon name="arrowRight" />}
        </button>
      </form>

      <p className="auth-switch">
        Remembered it? <Link to="/login">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}
