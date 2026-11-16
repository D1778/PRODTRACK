import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { Modal, Spinner } from "./ui";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { pictureToDataURL } from "../lib/image";

// Opened by clicking the business in the header. Everyone can look at the business
// profile; the owner also gets an Edit button inside it to change the name and picture.
export default function BusinessProfileModal({ onClose }) {
  const { user, isOwner, staff, updateBusiness } = useApp();
  const toast = useToast();
  const fileRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.businessName);
  const [logo, setLogo] = useState(undefined); // undefined = unchanged, "" = removed, else a new data URL
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const shownLogo = editing && logo !== undefined ? logo : user.businessLogo;
  const dirty = name.trim() !== user.businessName || logo !== undefined;

  const startEditing = () => {
    setName(user.businessName);
    setLogo(undefined);
    setError("");
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setError("");
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    try {
      setLogo(await pictureToDataURL(file));
    } catch (err) {
      setError(err.message);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await updateBusiness({ name, logo });
      toast.success("Business updated");
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Portal: keeps the overlay out of the header, which has its own stacking and blur
  return createPortal(
    <Modal
      title={editing ? "Edit business" : "Business profile"}
      subtitle={editing ? "The name and picture your whole team sees." : undefined}
      onClose={onClose}
      footer={
        editing ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={cancelEditing} disabled={busy}>Cancel</button>
            <button type="submit" form="business-form" className="btn btn-primary" disabled={!dirty || busy || !name.trim()}>
              {busy ? <Spinner /> : <Icon name="check" />} Save changes
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            {isOwner && (
              <button type="button" className="btn btn-primary" onClick={startEditing}>
                <Icon name="edit" /> Edit
              </button>
            )}
          </>
        )
      }
    >
      {editing ? (
        <form id="business-form" onSubmit={save}>
          {error && <div className="alert alert-error" role="alert"><Icon name="alertCircle" /> {error}</div>}
          <div className="pic-row" style={{ marginBottom: 20 }}>
            <Avatar className="xl gradient" src={shownLogo} name={name || user.businessName} />
            <div className="pic-actions">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} />
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Icon name="edit" /> {shownLogo ? "Change picture" : "Upload picture"}
              </button>
              {shownLogo && (
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setLogo("")}>
                  <Icon name="trash" /> Remove
                </button>
              )}
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label" htmlFor="biz-name">Business name</label>
            <input id="biz-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus required />
          </div>
        </form>
      ) : (
        <>
          <div className="biz-profile">
            <Avatar className="xl gradient" src={user.businessLogo} name={user.businessName} />
            <div style={{ minWidth: 0 }}>
              <h3>{user.businessName}</h3>
              <span className="badge badge-primary">
                <Icon name={isOwner ? "shield" : "user"} /> {isOwner ? "Owner workspace" : "Staff workspace"}
              </span>
            </div>
          </div>
          <dl className="kv" style={{ marginBottom: 0 }}>
            <dt>Business</dt>
            <dd>{user.businessName}</dd>
            <dt>Your role</dt>
            <dd style={{ textTransform: "capitalize" }}>{user.role}</dd>
            {isOwner && (
              <>
                <dt>Team</dt>
                <dd>{staff.length === 0 ? "Just you" : `You and ${staff.length} staff member${staff.length === 1 ? "" : "s"}`}</dd>
              </>
            )}
          </dl>
        </>
      )}
    </Modal>,
    document.body
  );
}
