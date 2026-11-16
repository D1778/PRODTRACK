import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import Icon from "../components/Icon";
import { Spinner } from "../components/ui";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";

const COOLDOWN = 60; // seconds before another code can be requested

export default function Verify() {
  const { verifyEmail, resendCode } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(COOLDOWN); // a code was just sent

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  // Reached without signing up or logging in first
  if (!email) return <Navigate to="/login" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await verifyEmail(email, code.trim());
      toast.success(`Email verified. Welcome, ${user.name.split(" ")[0]}!`);
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const resend = async () => {
    setError("");
    try {
      await resendCode(email);
      setWait(COOLDOWN);
      setCode("");
      toast.success("A new code is on its way");
    } catch (err) {
      setError(err.message);
      if (err.status === 429) setWait(COOLDOWN);
    }
  };

  return (
    <AuthLayout>
      <h1>Check your email</h1>
      <p className="sub">
        We sent a 6-digit code to <strong>{email}</strong>. Enter it below to continue. It expires in 10 minutes.
      </p>

      {error && (
        <div className="alert alert-error" role="alert">
          <Icon name="alertCircle" />
          {error}
        </div>
      )}

      <form onSubmit={submit}>
        <div className="field">
          <label className="label" htmlFor="code">Verification code</label>
          <input
            id="code"
            className="input"
            style={{ fontSize: 24, letterSpacing: "0.5em", textAlign: "center", fontFamily: "var(--font-mono, monospace)" }}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="······"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoFocus
            required
          />
        </div>
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || code.length !== 6}>
          {busy ? <Spinner /> : null}
          {busy ? "Verifying…" : "Verify and continue"}
          {!busy && <Icon name="arrowRight" />}
        </button>
      </form>

      <p className="auth-switch">
        Didn't get it?{" "}
        <button type="button" className="link-btn" onClick={resend} disabled={wait > 0} style={{ background: "none", border: 0, padding: 0, color: "inherit", font: "inherit", textDecoration: "underline", cursor: wait > 0 ? "default" : "pointer", opacity: wait > 0 ? 0.6 : 1 }}>
          {wait > 0 ? `Resend code in ${wait}s` : "Resend code"}
        </button>
      </p>
      <p className="auth-legal">
        Nothing arrived? Check your spam folder. If the address is wrong, an account can't be verified without the emailed code, so <Link to="/signup">start again</Link> with the correct one. · <Link to="/login">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}
