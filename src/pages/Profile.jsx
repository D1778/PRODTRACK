import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import { PageHeader, PasswordInput, Spinner, StrengthMeter } from "../components/ui";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { initials } from "../lib/format";
import { ThemePicker } from "../components/ThemeSwitch";

function DetailsForm() {
  const { user, updateProfile } = useApp();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, email: user.email, currentPassword: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const emailChanged = form.email.trim().toLowerCase() !== user.email;
  const dirty = form.name.trim() !== user.name || emailChanged;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await updateProfile({ name: form.name, email: form.email, currentPassword: form.currentPassword });
      setForm((f) => ({ ...f, currentPassword: "" }));
      toast.success("Profile updated");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <div className="card-head">
        <div>
          <h2>Personal details</h2>
          <p>How you appear on bills and in history.</p>
        </div>
      </div>
      <div className="card-body">
        {error && <div className="alert alert-error" role="alert"><Icon name="alertCircle" /> {error}</div>}
        <div className="field">
          <label className="label" htmlFor="p-name">Full name</label>
          <input id="p-name" className="input" value={form.name} onChange={set("name")} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="p-email">Email</label>
          <input id="p-email" type="email" className="input" value={form.email} onChange={set("email")} required />
        </div>
        {emailChanged && (
          <div className="field">
            <label className="label" htmlFor="p-cur">Current password</label>
            <PasswordInput id="p-cur" value={form.currentPassword} onChange={set("currentPassword")} placeholder="Confirm it's you" autoComplete="current-password" />
            <span className="hint">Required to change your login email.</span>
          </div>
        )}
        <button className="btn btn-primary" disabled={!dirty || busy}>
          {busy ? <Spinner /> : <Icon name="check" />} Save changes
        </button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const { updateProfile, user } = useApp();
  const toast = useToast();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.next.length < 8) return setError("New password must be at least 8 characters");
    if (form.next !== form.confirm) return setError("New passwords don't match");
    setBusy(true);
    try {
      await updateProfile({ name: user.name, email: user.email, currentPassword: form.current, newPassword: form.next });
      setForm({ current: "", next: "", confirm: "" });
      toast.success("Password changed");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <div className="card-head">
        <div>
          <h2>Change password</h2>
          <p>Passwords are stored encrypted with bcrypt.</p>
        </div>
      </div>
      <div className="card-body">
        {error && <div className="alert alert-error" role="alert"><Icon name="alertCircle" /> {error}</div>}
        <div className="field">
          <label className="label" htmlFor="pw-cur">Current password</label>
          <PasswordInput id="pw-cur" value={form.current} onChange={set("current")} autoComplete="current-password" />
        </div>
        <div className="field">
          <label className="label" htmlFor="pw-new">New password</label>
          <PasswordInput id="pw-new" value={form.next} onChange={set("next")} autoComplete="new-password" />
          <StrengthMeter password={form.next} />
        </div>
        <div className="field">
          <label className="label" htmlFor="pw-confirm">Confirm new password</label>
          <PasswordInput id="pw-confirm" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" />
        </div>
        <button className="btn btn-primary" disabled={busy || !form.current || !form.next}>
          {busy ? <Spinner /> : <Icon name="lock" />} Update password
        </button>
      </div>
    </form>
  );
}

export default function Profile() {
  const { user, isOwner, logout } = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const [feedback, setFeedback] = useState("");

  const sendFeedback = (e) => {
    e.preventDefault();
    const body = encodeURIComponent(feedback.trim());
    window.location.href = `mailto:?subject=${encodeURIComponent("ProdTrack feedback")}&body=${body}`;
    toast.info("Opening your email app to send the feedback");
    setFeedback("");
  };

  return (
    <>
      <PageHeader title="Profile & security" subtitle="Manage your account details and password." />

      <div className="card mb">
        <div className="profile-hero">
          <span className="avatar lg gradient">{initials(user.name)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{user.name}</h2>
            <div className="muted">{user.email}</div>
            <div className="meta">
              <span className="badge badge-primary"><Icon name={isOwner ? "shield" : "user"} /> {isOwner ? "Owner" : "Staff"}</span>
              <span className="badge"><Icon name="store" /> {user.businessName}</span>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => { logout(); navigate("/login"); }}>
            <Icon name="logout" /> Log out
          </button>
        </div>
      </div>

      <div className="grid grid-2 mb" style={{ alignItems: "start" }}>
        <DetailsForm />
        <PasswordForm />
      </div>

      <div className="card mb">
        <div className="card-head">
          <div>
            <h2>Appearance</h2>
            <p>Choose light or dark, or follow your device setting.</p>
          </div>
          <ThemePicker />
        </div>
      </div>

      <form className="card" onSubmit={sendFeedback}>
        <div className="card-head">
          <div>
            <h2>Send feedback</h2>
            <p>Tell us what you love, what's missing, or what's broken.</p>
          </div>
        </div>
        <div className="card-body">
          <textarea className="textarea" rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Your thoughts…" aria-label="Feedback" />
          <button className="btn btn-secondary" style={{ marginTop: 12 }} disabled={!feedback.trim()}>
            <Icon name="message" /> Send feedback
          </button>
        </div>
      </form>
    </>
  );
}
