import { useEffect, useState } from "react";
import Icon from "./Icon";
import { PasswordInput, Spinner, StrengthMeter } from "./ui";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";

const COOLDOWN = 60; // seconds before another code can be requested

// Second step of "forgot password": the 6-digit code that was emailed, plus the new password.
// Used on the public forgot-password page and on the in-app change-password page.
export default function ResetByCode({ email, onDone, submitLabel = "Change password" }) {
  const { resetPassword, forgotPassword } = useApp();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(COOLDOWN); // a code was just sent

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (next.length < 8) return setError("New password must be at least 8 characters");
    if (next !== confirm) return setError("New passwords don't match");
    setBusy(true);
    try {
      await resetPassword(email, code.trim(), next);
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const resend = async () => {
    setError("");
    try {
      await forgotPassword(email);
      setWait(COOLDOWN);
      setCode("");
      toast.success("If that account exists, a new code is on its way");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={submit}>
      {error && (
        <div className="alert alert-error" role="alert">
          <Icon name="alertCircle" />
          {error}
        </div>
      )}
      <div className="field">
        <label className="label" htmlFor="reset-code">6-digit code</label>
        <input
          id="reset-code"
          className="input"
          style={{ fontSize: 22, letterSpacing: "0.5em", textAlign: "center", fontFamily: "var(--font-mono, monospace)" }}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="······"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          autoFocus
          required
        />
      </div>
      <div className="field">
        <label className="label" htmlFor="reset-new">New password</label>
        <PasswordInput id="reset-new" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        <StrengthMeter password={next} />
      </div>
      <div className="field">
        <label className="label" htmlFor="reset-confirm">Confirm new password</label>
        <PasswordInput id="reset-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      </div>
      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || code.length !== 6 || !next}>
        {busy ? <Spinner /> : <Icon name="lock" />}
        {busy ? "Saving…" : submitLabel}
      </button>
      <p className="auth-switch">
        Didn't get a code?{" "}
        <button type="button" onClick={resend} disabled={wait > 0} style={{ background: "none", border: 0, padding: 0, color: "inherit", font: "inherit", textDecoration: "underline", cursor: wait > 0 ? "default" : "pointer", opacity: wait > 0 ? 0.6 : 1 }}>
          {wait > 0 ? `Resend code in ${wait}s` : "Resend code"}
        </button>
      </p>
    </form>
  );
}
