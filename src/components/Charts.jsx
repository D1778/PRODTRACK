import { useState } from "react";
import { money, moneyCompact, number } from "../lib/format";

// Round the axis maximum up to a "nice" number (1, 2, 2.5, 5 × 10^n)
function niceMax(v) {
  if (v <= 0) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

// Column with a 4px rounded top and a square base on the baseline
function columnPath(x, y, w, h) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/**
 * Single-series column chart (revenue per day).
 * data: [{ key, label, fullLabel, value, count }]
 */
export function RevenueChart({ data, height = 240 }) {
  const [hover, setHover] = useState(null);
  const W = 720;
  const H = height;
  const pad = { top: 12, right: 8, bottom: 28, left: 56 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const band = plotW / Math.max(data.length, 1);
  const barW = Math.min(24, band * 0.62);
  const labelEvery = Math.ceil(data.length / 10);
  const hovered = hover != null ? data[hover] : null;

  const xOf = (i) => pad.left + band * i + (band - barW) / 2;
  const yOf = (v) => pad.top + plotH - (v / max) * plotH;

  return (
    <div className={`chart ${hover != null ? "hovering" : ""}`}>
      <div style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenue by day" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid-line" x1={pad.left} x2={W - pad.right} y1={yOf(t)} y2={yOf(t)} />
              <text className="axis-label" x={pad.left - 10} y={yOf(t) + 4} textAnchor="end">
                {moneyCompact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const h = (d.value / max) * plotH;
            return (
              <g key={d.key}>
                {d.value > 0 && (
                  <path className={`bar ${hover === i ? "active" : ""}`} d={columnPath(xOf(i), yOf(d.value), barW, h)} />
                )}
                {i % labelEvery === 0 && (
                  <text className="axis-label" x={xOf(i) + barW / 2} y={H - 8} textAnchor="middle">
                    {d.label}
                  </text>
                )}
                <rect
                  className="bar-hit"
                  x={pad.left + band * i}
                  y={pad.top}
                  width={band}
                  height={plotH}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  aria-label={`${d.fullLabel}: ${money(d.value)}, ${d.count} bills`}
                />
              </g>
            );
          })}
        </svg>
        {hovered && (
          <div
            className="chart-tooltip"
            style={{
              left: `${((xOf(hover) + barW / 2) / W) * 100}%`,
              top: `${(yOf(hovered.value) / H) * 100}%`,
            }}
          >
            <span>{hovered.fullLabel}</span>
            <strong>{money(hovered.value)}</strong>
            <span>
              {hovered.count} bill{hovered.count === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>Revenue by day</caption>
        <thead>
          <tr><th>Day</th><th>Revenue</th><th>Bills</th></tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}><td>{d.fullLabel}</td><td>{money(d.value)}</td><td>{d.count}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Ranked horizontal bars, e.g. top-selling products.
 * items: [{ id, name, value, detail }]
 */
export function BarList({ items, format = money }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="barlist">
      {items.map((item) => (
        <div className="barlist-row" key={item.id} title={`${item.name}: ${format(item.value)}`}>
          <span className="name">{item.name}</span>
          <span className="val">
            {format(item.value)}
            {item.detail != null && <span className="muted"> · {number(item.detail)} sold</span>}
          </span>
          <span className="track">
            <i style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}
