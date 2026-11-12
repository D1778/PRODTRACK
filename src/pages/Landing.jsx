import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import Logo from "../components/Logo";
import ThemeSwitch from "../components/ThemeSwitch";
import { useApp } from "../context/AppContext";

const FEATURES = [
  { icon: "barcode", tone: "primary", title: "Find anything by SKU", text: "Instant search across SKU, name, vendor and warehouse, with filters for stock level and location." },
  { icon: "receipt", tone: "success", title: "Billing that updates stock", text: "Ring up a sale, print a PDF bill, and inventory drops automatically. No double entry." },
  { icon: "bell", tone: "warning", title: "Low-stock alerts", text: "Set an alert level per product and see what to reorder before shelves go empty." },
  { icon: "chart", tone: "info", title: "Sales at a glance", text: "Daily revenue, best sellers and stock value on one dashboard, for owners and staff." },
  { icon: "users", tone: "primary", title: "Owner & staff roles", text: "Give each team member their own login. Staff sell and restock; owners see everything." },
  { icon: "history", tone: "success", title: "Full audit trail", text: "Every stock movement is logged with who did it, when and why." },
];

const BARS = [38, 52, 44, 70, 58, 82, 64, 90, 74, 96, 80, 100];

export default function Landing() {
  const { status } = useApp();
  const authed = status === "authed";

  return (
    <div className="landing">
      <nav className="l-nav">
        <div className="l-container">
          <Link to="/" className="l-brand">
            <span className="brand-mark"><Logo /></span>
            PRODTRACK
          </Link>
          <div className="l-links">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
          </div>
          <div className="right">
            <ThemeSwitch />
            {authed ? (
              <Link to="/dashboard" className="btn btn-primary">Open dashboard <Icon name="arrowRight" /></Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost">Log in</Link>
                <Link to="/signup" className="btn btn-primary">Get started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="l-container">
          <span className="pill"><b>New</b> SKU search, warehouses & dark mode</span>
          <h1>
            Inventory and billing, <em>finally in sync</em>.
          </h1>
          <p className="lead">
            ProdTrack keeps your stock, sales and team in one place, so you always know what's on the shelf, what's selling and what to reorder.
          </p>
          <div className="cta">
            <Link to={authed ? "/dashboard" : "/signup"} className="btn btn-primary btn-lg">
              {authed ? "Go to dashboard" : "Create your free workspace"} <Icon name="arrowRight" />
            </Link>
            {!authed && <Link to="/login" className="btn btn-secondary btn-lg">I already have an account</Link>}
          </div>
          <div className="trust">
            <span><Icon name="checkCircle" /> Set up in a minute</span>
            <span><Icon name="checkCircle" /> Secure JWT logins</span>
            <span><Icon name="checkCircle" /> Works on any device</span>
          </div>

          <div className="preview" aria-hidden="true">
            <div className="preview-inner">
              <div className="preview-side">
                <i className="on" /><i /><i /><i /><i /><i />
              </div>
              <div className="preview-main">
                <div className="pv-stats">
                  <div className="pv-stat"><span>Today's revenue</span><strong>₹18,420</strong></div>
                  <div className="pv-stat"><span>Bills today</span><strong>36</strong></div>
                  <div className="pv-stat"><span>Products</span><strong>248</strong></div>
                  <div className="pv-stat"><span>Low stock</span><strong>7</strong></div>
                </div>
                <div className="pv-row">
                  <div className="pv-card">
                    <div className="t">Revenue · last 12 days</div>
                    <div className="pv-bars">
                      {BARS.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}
                    </div>
                  </div>
                  <div className="pv-card pv-list">
                    <div className="t">Low stock</div>
                    <i><b>Blue gel pen</b> 4 left</i>
                    <i><b>A4 notebook</b> 2 left</i>
                    <i><b>Glue stick</b> 0 left</i>
                    <i><b>Stapler pins</b> 6 left</i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="section" id="features">
        <div className="l-container">
          <div className="section-head">
            <div className="eyebrow">Features</div>
            <h2>Everything a growing store needs</h2>
            <p>From the stockroom to the counter, without the spreadsheets.</p>
          </div>
          <div className="features">
            {FEATURES.map((f) => (
              <div className="card feature" key={f.title}>
                <div className={`f-icon tone-${f.tone}`}><Icon name={f.icon} /></div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="how" style={{ paddingTop: 0 }}>
        <div className="l-container">
          <div className="section-head">
            <div className="eyebrow">How it works</div>
            <h2>Up and running in three steps</h2>
          </div>
          <div className="how">
            <div className="card how-step">
              <h3>Create your workspace</h3>
              <p>Sign up with your name, business name, email and a password. That's it.</p>
            </div>
            <div className="card how-step">
              <h3>Add products</h3>
              <p>Give each item a price, SKU and warehouse. SKUs are generated if you skip them.</p>
            </div>
            <div className="card how-step">
              <h3>Sell & restock</h3>
              <p>Bill customers, record deliveries and invite staff. The dashboard updates live.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="l-container">
        <div className="cta-band">
          <h2>Ready to take control of your stock?</h2>
          <p>Create your workspace and add your first product in under a minute.</p>
          <Link to={authed ? "/dashboard" : "/signup"} className="btn btn-light btn-lg">
            {authed ? "Open dashboard" : "Get started"} <Icon name="arrowRight" />
          </Link>
        </div>
      </section>

      <footer className="l-footer">
        <div className="l-container">
          <span className="l-brand" style={{ fontSize: 15 }}>
            <span className="brand-mark" style={{ width: 30, height: 30 }}><Logo /></span>
            PRODTRACK
          </span>
          <span>Built with Go, MongoDB and React · by Dinu & Kunnal</span>
        </div>
      </footer>
    </div>
  );
}
