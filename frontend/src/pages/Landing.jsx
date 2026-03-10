import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div>
      {/* ── HEADER ── */}
      <header className="header">
        <div className="nav-container">
          <Link to="/" className="logo"> PRODTRACK</Link>
          <nav className="nav-links">
            <a href="#" className="nav-link">HOME</a>
            <a href="#features" className="nav-link">FEATURES</a>
            <a href="#benefits" className="nav-link">BENEFITS</a>
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
              <Link to="/login" className="btn btn-primary btn-large">LAUNCH DASHBOARD</Link>

            </div>
          </div>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16/10', borderRadius: '20px', overflow: 'hidden', border: '8px solid #1a1a1a', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0,0,0,0.1)', transform: 'perspective(1200px) rotateY(-4deg) rotateX(1deg) scale(1.02)', transformOrigin: 'center right', backgroundColor: 'var(--light-surface)' }}>
            <img
              src="/prodpic_1.png"
              alt="Product Dashboard Preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {/* Adding a soft inner overlay for a shading effect */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.1) 100%)', zIndex: 2, pointerEvents: 'none' }}></div>
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
            <div style={{ position: 'relative', width: '100%', height: '400px', borderRadius: '24px', overflow: 'hidden', backgroundColor: '#f0f0f0', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

              {/* Grid Background */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: 'linear-gradient(#e0e0e0 1px, transparent 1px), linear-gradient(90deg, #e0e0e0 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.6, zIndex: 0 }}></div>

              <svg width="100%" height="100%" viewBox="0 0 800 600" style={{ position: 'relative', zIndex: 1, filter: 'drop-shadow(0px 20px 30px rgba(0,0,0,0.1))' }}>

                {/* Thin Gray Circle Behind Chart */}
                <circle cx="450" cy="250" r="180" fill="none" stroke="#d0d0d0" strokeWidth="2" />

                {/* --- The Pie Chart --- */}
                {/* Dark Blue Slice */}
                <path d="M450 250 L350 120 A220 220 0 0 1 650 260 Z" fill="#001F82" stroke="#fff" strokeWidth="4" />
                {/* Adding squiggly pattern to Dark Blue Slice using a basic pattern definition or lines is complex, adding styling lines instead */}
                <path d="M420 150 Q430 140 440 150 T460 150 M440 180 Q450 170 460 180 T480 180 M480 140 Q490 130 500 140 T520 140 M480 210 Q490 200 500 210 T520 210 M520 170 Q530 160 540 170 T560 170 M560 210 Q570 200 580 210 T600 210" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" strokeLinecap="round" />

                {/* Light Gray Slice (left) */}
                <path d="M450 250 L350 120 A220 220 0 0 0 280 320 Z" fill="#e0e0e0" stroke="#fff" strokeWidth="4" />
                {/* Dashes/Dots on light grey */}
                <path d="M360 200 L370 210 M320 220 L330 230 M330 180 L345 180 M380 250 L390 260 M330 280 L345 285 M400 290 L415 295 M380 320 L395 330" fill="none" stroke="#b0b0b0" strokeWidth="4" strokeLinecap="round" />

                {/* Bright Blue Slice (bottom) */}
                <path d="M450 250 L280 320 A220 220 0 0 0 540 440 Z" fill="#0EA5E9" stroke="#fff" strokeWidth="4" />
                {/* Grid pattern on bright blue */}
                <path d="M350 350 L500 350 M380 380 L500 380 M420 410 L480 410 M380 320 L380 380 M420 320 L420 410 M460 320 L460 410" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />

                {/* Striped Blue Slice (right) */}
                <path d="M480 265 L660 275 A220 220 0 0 1 560 440 Z" fill="#4F46E5" stroke="#fff" strokeWidth="4" />
                {/* White stripes */}
                <path d="M490 290 L630 310 M490 320 L610 340 M500 350 L585 375 M520 380 L560 395 M535 410 L545 405" fill="none" stroke="#fff" strokeWidth="6" opacity="0.6" strokeLinecap="round" />

                {/* --- Arrows --- */}
                {/* Blue Arrow (Left) */}
                <path d="M220 310 C180 250 200 150 280 120" fill="none" stroke="#2563EB" strokeWidth="8" strokeLinecap="round" />
                <path d="M280 120 L240 110 M280 120 L270 160" fill="none" stroke="#2563EB" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />

                {/* Orange Arrow (Right Top) */}
                <path d="M600 70 C700 90 750 180 700 270" fill="none" stroke="#EA580C" strokeWidth="8" strokeLinecap="round" />
                <path d="M700 270 L700 230 M700 270 L660 260" fill="none" stroke="#EA580C" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />

                {/* Teal Arrow (Right Bottom) */}
                <path d="M630 450 C680 420 620 360 740 370" fill="none" stroke="#0D9488" strokeWidth="6" strokeLinecap="round" />
                <path d="M740 370 L710 350 M740 370 L720 390" fill="none" stroke="#0D9488" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />

                {/* --- 3D Hand Base --- */}
                {/* Grayscale hand holding it up */}
                <g opacity="0.85">
                  <path d="M50 480 Q100 480 200 490 Q300 500 350 480 Q450 450 500 480 Q550 510 650 480 Q700 460 710 490 Q650 540 500 550 Q300 560 150 550 Q50 540 50 480 Z" fill="#9ca3af" />
                  <path d="M200 490 Q250 450 350 460 Q400 470 450 480 C350 490 250 500 200 490 Z" fill="#d1d5db" />
                  <path d="M350 460 C400 430 450 450 550 450 Q600 450 620 470 C550 480 450 490 350 460 Z" fill="#e5e7eb" />
                  <path d="M450 480 Q500 480 550 510 C500 520 400 520 350 480 Z" fill="#6b7280" />
                  {/* Thumb */}
                  <path d="M350 460 C380 400 450 380 450 430 C430 460 380 480 350 460 Z" fill="#9ca3af" />
                  {/* Hand Cutoff edge (left arm) */}
                  <path d="M50 480 L50 540 Q70 510 50 480 Z" fill="#2563eb" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ── SIMPLE FOOTER ── */}
      <footer style={{ textAlign: "center", padding: "40px", backgroundColor: "var(--section-5)", color: "var(--text-secondary)", fontSize: "14px", borderTop: "1px solid var(--border)" }}>
        © 2026 PRODTRACK. All rights reserved. Built by Dinu & Kunnal for efficient inventory management.
      </footer>
    </div>
  );
}

function FeatureCard({ title, desc }) {
  const icons = {
    "Real-Time Dashboard": <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-6M6 20V10M18 20V4" /></svg>,
    "Product Management": <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>,
    "Stock Control": <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>,
    "Smart Alerts": <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
    "Complete History": <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18 9l-5 5-3-3-4 4" /></svg>,
    "Role-Based Access": <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  };
  return (
    <div className="feature-card">
      <div className="feature-icon">{icons[title] || <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}</div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-desc">{desc}</p>
    </div>
  );
}

function BenefitItem({ title, desc }) {
  const icons = {
    "Lightning Fast": <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
    "Secure & Private": <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    "Mobile Friendly": <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>,
    "Easy to Use": <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>
  };
  return (
    <div className="benefit-item">
      <div className="benefit-icon">{icons[title] || <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}</div>
      <div>
        <h3 className="benefit-title">{title}</h3>
        <p className="benefit-desc">{desc}</p>
      </div>
    </div>
  );
}



