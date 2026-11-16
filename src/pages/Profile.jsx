import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import { PageHeader, Spinner } from "../components/ui";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { pictureToDataURL } from "../lib/image";

// The profile photo with an edit button right on it (and a remove button once one is set).
function EditableAvatar() {
  const { user, updateAvatar } = useApp();
  const toast = useToast();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const save = async (makeImage, message) => {
    setBusy(true);
    try {
      await updateAvatar(await makeImage());
      toast.success(message);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow choosing the same file again later
    if (file) save(() => pictureToDataURL(file), "Profile picture updated");
  };

  return (
    <div className="avatar-edit">
      <Avatar className="lg gradient" src={user.avatar} name={user.name} />
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} />
      <button type="button" className="avatar-edit-btn" disabled={busy} onClick={() => fileRef.current?.click()} title="Change profile picture" aria-label="Change profile picture">
        {busy ? <Spinner /> : <Icon name="edit" />}
      </button>
      {user.avatar && (
        <button type="button" className="avatar-remove-btn" disabled={busy} onClick={() => save(async () => "", "Profile picture removed")} title="Remove profile picture" aria-label="Remove profile picture">
          <Icon name="x" />
        </button>
      )}
    </div>
  );
}

// One line of the details card: a label, its value, and an Edit button when it can be edited.
function DetailRow({ label, value, hint, editing, onEdit, children }) {
  return (
    <div className="detail-row">
      <div className="detail-label">{label}</div>
      <div className="detail-main">
        {editing ? (
          children
        ) : (
          <>
            <div className="detail-value">{value}</div>
            {hint && <div className="hint">{hint}</div>}
          </>
        )}
      </div>
      {onEdit && !editing && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>
          <Icon name="edit" /> Edit
        </button>
      )}
    </div>
  );
}

function NameRow() {
  const { user, updateProfile } = useApp();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const open = () => {
    setName(user.name);
    setError("");
    setEditing(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await updateProfile({ name, email: user.email });
      toast.success("Name updated");
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DetailRow label="Full name" value={user.name} editing={editing} onEdit={open}>
      <form onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && setEditing(false)}>
        {error && <div className="alert alert-error" role="alert"><Icon name="alertCircle" /> {error}</div>}
        <input className="input" aria-label="Full name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus required />
        <div className="detail-actions">
          <button className="btn btn-primary btn-sm" disabled={busy || !name.trim() || name.trim() === user.name}>
            {busy ? <Spinner /> : <Icon name="check" />} Save
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
        </div>
      </form>
    </DetailRow>
  );
}

// The password is changed on its own page, opened by the Edit button
function PasswordRow() {
  const navigate = useNavigate();
  return <DetailRow label="Password" value="••••••••••" onEdit={() => navigate("/dashboard/password")} />;
}

export default function Profile() {
  const { user, isOwner } = useApp();

  return (
    <>
      <PageHeader title="Profile & security" subtitle="Manage your account details and password." />

      <div className="card mb">
        <div className="profile-hero">
          <EditableAvatar />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{user.name}</h2>
            <div className="muted">{user.email}</div>
            <div className="meta">
              <span className="badge badge-primary"><Icon name={isOwner ? "shield" : "user"} /> {isOwner ? "Owner" : "Staff"}</span>
              <span className="badge"><Icon name="store" /> {user.businessName}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb">
        <div className="card-head">
          <div>
            <h2>Account details</h2>
            <p>Click Edit to change your name, or to open the page for changing your password.</p>
          </div>
        </div>
        <NameRow />
        <DetailRow label="Email" value={user.email} hint="Your login email was verified at signup and can't be changed." />
        <PasswordRow />
      </div>
    </>
  );
}
