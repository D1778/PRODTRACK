// ProdTrack logo: solid indigo-violet hexagon with a white checklist clipboard.
export default function Logo({ className }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="pt-logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <path d="M24 3.5 42 14v20L24 44.5 6 34V14z" fill="url(#pt-logo-grad)" stroke="url(#pt-logo-grad)" strokeWidth="3" strokeLinejoin="round" />
      <rect x="15.5" y="14" width="17" height="21" rx="3" fill="none" stroke="#fff" strokeWidth="2.4" />
      <rect x="19.5" y="11.5" width="9" height="6" rx="2" fill="#fff" />
      <path d="m19.8 25 2.8 2.8 5.6-5.8" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 31.5h8" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.75" />
    </svg>
  );
}
