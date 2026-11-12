import { Link } from "react-router-dom";
import Icon from "./Icon";
import Logo from "./Logo";
import ThemeSwitch from "./ThemeSwitch";

const POINTS = [
  { icon: "barcode", text: "Find any item instantly by SKU or warehouse" },
  { icon: "receipt", text: "Bill customers and update stock in one click" },
  { icon: "bell", text: "Get warned before products run out" },
  { icon: "shield", text: "Secure logins with encrypted passwords" },
];

export default function AuthLayout({ children }) {
  return (
    <div className="auth">
      <aside className="auth-aside">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Logo />
          </span>
          PRODTRACK
        </Link>

        <div>
          <h2>
            Run your store with <em>clarity</em>, not spreadsheets.
          </h2>
          <p className="lead">Inventory, billing and your team, all in one place, updated the moment something changes.</p>
          <div className="auth-points">
            {POINTS.map((p) => (
              <div className="auth-point" key={p.icon}>
                <span className="ic">
                  <Icon name={p.icon} />
                </span>
                {p.text}
              </div>
            ))}
          </div>
        </div>

        <div className="auth-quote">
          Every sale, restock and edit is recorded with who did it and when, so the numbers always add up.
          <div className="mini-stats">
            <div>
              <strong>1 form</strong>
              <span>to sign up</span>
            </div>
            <div>
              <strong>Live</strong>
              <span>stock levels</span>
            </div>
            <div>
              <strong>2 roles</strong>
              <span>owner & staff</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="auth-main">
        <ThemeSwitch className="auth-theme" />
        <div className="auth-card">
          <Link to="/" className="mobile-brand l-brand">
            <span className="brand-mark">
              <Logo />
            </span>
            PRODTRACK
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
