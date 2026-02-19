import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div>
      {/* ── HEADER ── */}
      <header className="header">
        <div className="nav-container">
          <Link to="/" className="logo">📦 PRODTRACK</Link>
          <nav className="nav-links">
            <a href="#features" className="nav-link">Home</a>
            <a href="#features" className="nav-link">Features</a>
            <a href="#benefits" className="nav-link">Benefits</a>
            <Link to="/login" className="btn btn-primary">Get Started</Link>
          </nav>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero-container">
          <div className="hero-content">
            <span className="hero-badge">Smart Inventory Management</span>
            <h1 className="hero-title">
              Manage Your<br />
              <span className="gradient-text">Inventory</span><br />
              Effortlessly
            </h1>
            <p className="hero-description">
              PRODTRACK is a powerful, role-based inventory management system designed for businesses of all sizes. Track products, manage stock, monitor alerts, and maintain complete transparency.
            </p>
            <div className="hero-buttons">
              <Link to="/login" className="btn btn-primary btn-large">Launch Dashboard</Link>
              <a href="#features" className="btn btn-ghost btn-large">Learn More</a>
            </div>
          </div>
          <div className="hero-visual">
            <div className="dashboard-mockup">
              <div className="mockup-header">
                <div className="mockup-dot" />
                <div className="mockup-dot" />
                <div className="mockup-dot" />
              </div>
              <div className="mockup-content">
                <div className="mockup-stats">
                  <div className="stat-card">
                    <div className="stat-label">Total Products</div>
                    <div className="stat-value">245</div>
                  </div>
                  <div className="stat-card" style={{ borderLeftColor: 'var(--success)' }}>
                    <div className="stat-label">Stock Value</div>
                    <div className="stat-value">$89K</div>
                  </div>
                  <div className="stat-card" style={{ borderLeftColor: 'var(--warning)' }}>
                    <div className="stat-label">Low Stock</div>
                    <div className="stat-value">12</div>
                  </div>
                  <div className="stat-card" style={{ borderLeftColor: 'var(--danger)' }}>
                    <div className="stat-label">Out of Stock</div>
                    <div className="stat-value">3</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="features-section">
        <div className="features-container">
          <div className="section-header">
            <div className="section-tag">Features</div>
            <h2 className="section-title">Everything You Need to Manage Inventory</h2>
            <p className="section-desc">
              Powerful features designed to streamline your inventory operations and boost productivity
            </p>
          </div>
          <div className="features-grid">
            <FeatureCard title="Real-Time Dashboard" desc="Get instant insights with live metrics, stock levels, and recent activity at a glance." />
            <FeatureCard title="Product Management" desc="Easily add, track, and categorize products with searchable and filterable lists." />
            <FeatureCard title="Stock Control" desc="Manage stock movements with intuitive IN/OUT controls and automatic logging." />
            <FeatureCard title="Smart Alerts" desc="Receive automatic notifications when stock levels fall below your threshold." />
            <FeatureCard title="Complete History" desc="Maintain full audit trails with detailed logs of every stock movement." />
            <FeatureCard title="Role-Based Access" desc="Secure multi-user support with customizable permissions for Owners and Staff." />
          </div>
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section id="benefits" className="benefits-section">
        <div className="benefits-container">
          <div>
            <div className="section-tag">Why Choose PRODTRACK</div>
            <h2 className="section-title">Built for Modern Businesses</h2>
            <p style={{ fontSize: 18, color: 'var(--text-secondary)', marginBottom: 40, lineHeight: 1.7 }}>
              Designed with simplicity and power in mind, PRODTRACK helps you stay in control of your inventory without the complexity.
            </p>
            <BenefitItem title="Lightning Fast" desc="Built with React for instant updates and smooth performance across all devices." />
            <BenefitItem title="Secure & Private" desc="Your data stays secure with role-based access control and encrypted storage." />
            <BenefitItem title="Mobile Friendly" desc="Manage your inventory on the go with fully responsive design for any device." />
            <BenefitItem title="Easy to Use" desc="Intuitive interface designed for users of all ages and technical skill levels." />
          </div>
          <div>
            <div className="stats-grid">
              <StatBox value="99%" label="Uptime Reliability" />
              <StatBox value="24/7" label="Access Anywhere" />
              <StatBox value="100%" label="Data Accuracy" />
              <StatBox value="∞" label="Products Supported" />
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <div className="cta-glow" />
        <div className="cta-container">
          <h2 className="cta-title">Ready to Transform Your Inventory?</h2>
          <p className="cta-desc">
            Join businesses worldwide who trust PRODTRACK to manage their inventory efficiently and effectively.
          </p>
          <div className="cta-buttons">
            <Link to="/login" className="btn btn-primary btn-large">Start Managing Inventory</Link>
            <a href="#features" className="btn btn-ghost btn-large">View All Features</a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-grid">
            <div style={{ maxWidth: 350 }}>
              <div className="footer-logo">📦 PRODTRACK</div>
              <p className="footer-desc">
                A professional inventory management system designed to help businesses track products, manage stock, and maintain complete transparency with ease.
              </p>
            </div>
            <FooterCol title="Product" links={["Features", "Benefits", "Dashboard"]} />
            <FooterCol title="Company" links={["About", "Contact", "Support"]} />
            <FooterCol title="Legal" links={["Privacy Policy", "Terms of Service", "Cookie Policy"]} />
          </div>
          <div className="footer-bottom">
            <p>© 2024 PRODTRACK. All rights reserved. Built with ❤️ for efficient inventory management.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ title, desc }) {
  const emojis = {
    "Real-Time Dashboard": "📊",
    "Product Management": "📦",
    "Stock Control": "🔄",
    "Smart Alerts": "🔔",
    "Complete History": "📜",
    "Role-Based Access": "👤"
  };
  return (
    <div className="feature-card">
      <div className="feature-icon">{emojis[title] || "✨"}</div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-desc">{desc}</p>
    </div>
  );
}

function BenefitItem({ title, desc }) {
  const emojis = {
    "Lightning Fast": "⚡",
    "Secure & Private": "🛡️",
    "Mobile Friendly": "📱",
    "Easy to Use": "🎨"
  };
  return (
    <div className="benefit-item">
      <div className="benefit-icon">{emojis[title] || "✅"}</div>
      <div>
        <h3 className="benefit-title">{title}</h3>
        <p className="benefit-desc">{desc}</p>
      </div>
    </div>
  );
}

function StatBox({ value, label }) {
  return (
    <div className="stats-box">
      <div className="stats-value">{value}</div>
      <div className="stats-label">{label}</div>
    </div>
  );
}

function FooterCol({ title, links }) {
  return (
    <div>
      <h4 className="footer-col-title">{title}</h4>
      {links.map((l) => (
        <a key={l} href="#" className="footer-link">{l}</a>
      ))}
    </div>
  );
}
