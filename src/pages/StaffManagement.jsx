import { useMemo, useState } from "react";
import Icon from "../components/Icon";
import { ConfirmDialog, EmptyState, Modal, PageHeader, PasswordInput, Spinner, StatCard } from "../components/ui";
import { useApp } from "../context/AppContext";
import { useToast } from "../context/ToastContext";
import { date, dayKey, initials, money, number } from "../lib/format";

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function AddStaffModal({ onClose }) {
  const { addStaff } = useApp();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const s = await addStaff(form);
      toast.success(`${s.name} can now log in with ${s.email}`);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Add a staff member" subtitle="They'll log in with this email and password. Share it with them securely." onClose={onClose}>
      <form onSubmit={submit}>
        {error && (
          <div className="alert alert-error" role="alert">
            <Icon name="alertCircle" /> {error}
          </div>
        )}
        <div className="field">
          <label className="label" htmlFor="s-name">Full name</label>
          <div className="input-wrap">
            <Icon name="user" />
            <input id="s-name" className="input" value={form.name} onChange={set("name")} placeholder="Ravi Sharma" required autoFocus />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="s-email">Email</label>
          <div className="input-wrap">
            <Icon name="mail" />
            <input id="s-email" type="email" className="input" value={form.email} onChange={set("email")} placeholder="ravi@business.com" required />
          </div>
        </div>
        <div className="field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label className="label" htmlFor="s-pass">Temporary password</label>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm((f) => ({ ...f, password: randomPassword() }))}>
              <Icon name="sparkles" /> Generate
            </button>
          </div>
          <PasswordInput id="s-pass" value={form.password} onChange={set("password")} placeholder="At least 8 characters" autoComplete="new-password" />
          <span className="hint">They can change it later from their Profile page.</span>
        </div>
        <div className="modal-foot" style={{ padding: "8px 0 0" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? <Spinner /> : <Icon name="plus" />} Create login
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function StaffManagement() {
  const { staff, bills, removeStaff } = useApp();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [toRemove, setToRemove] = useState(null);
  const [q, setQ] = useState("");

  const today = dayKey(new Date());
  const perf = useMemo(() => {
    const m = new Map();
    for (const b of bills) {
      const cur = m.get(b.createdById) || { total: 0, count: 0, today: 0 };
      cur.total += b.totalAmount;
      cur.count += 1;
      if (dayKey(b.timestamp) === today) cur.today += b.totalAmount;
      m.set(b.createdById, cur);
    }
    return m;
  }, [bills, today]);

  const filtered = staff.filter((s) => `${s.name} ${s.email}`.toLowerCase().includes(q.toLowerCase()));
  const staffSalesToday = staff.reduce((sum, s) => sum + (perf.get(s.id)?.today || 0), 0);

  return (
    <>
      <PageHeader title="Staff" subtitle="Give your team their own logins. Staff can bill, add products and record stock.">
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Icon name="plus" /> Add staff
        </button>
      </PageHeader>

      <div className="grid grid-3 mb">
        <StatCard label="Team members" value={number(staff.length)} icon="users" tone="primary" foot="Plus you, the owner" />
        <StatCard label="Staff sales today" value={money(staffSalesToday)} icon="rupee" tone="success" foot="Bills created by staff" />
        <StatCard label="Permissions" value="Staff" icon="shield" tone="info" foot="No access to staff or analytics" />
      </div>

      <div className="card">
        {staff.length > 0 && (
          <div className="filters">
            <div className="input-wrap search" style={{ maxWidth: 420 }}>
              <Icon name="search" />
              <input className="input" type="search" placeholder="Search by name or email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search staff" />
            </div>
          </div>
        )}
        {staff.length === 0 ? (
          <EmptyState
            icon="users"
            title="No staff yet"
            text="Add a team member so they can create bills and manage stock with their own login."
            action={<button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" /> Add staff</button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon="search" title="No one matches" text="Try a different name or email." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th className="right">Bills</th>
                  <th className="right">Sales</th>
                  <th>Joined</th>
                  <th className="right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const p = perf.get(s.id) || { total: 0, count: 0 };
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span className="avatar">{initials(s.name)}</span>
                          <div>
                            <div className="cell-main">{s.name}</div>
                            <div className="cell-sub" style={{ marginTop: 0 }}>{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-primary">Staff</span></td>
                      <td className="right num">{number(p.count)}</td>
                      <td className="right num">{money(p.total)}</td>
                      <td className="muted">{date(s.createdAt)}</td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-danger-soft btn-sm" onClick={() => setToRemove(s)}>
                            <Icon name="trash" /> Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adding && <AddStaffModal onClose={() => setAdding(false)} />}
      {toRemove && (
        <ConfirmDialog
          title={`Remove ${toRemove.name}?`}
          message="Their login stops working immediately. Bills they created are kept."
          confirmLabel="Remove"
          onClose={() => setToRemove(null)}
          onConfirm={async () => {
            try {
              await removeStaff(toRemove.id);
              toast.success(`${toRemove.name} removed`);
            } catch (err) {
              toast.error(err.message);
              throw err;
            }
          }}
        />
      )}
    </>
  );
}
