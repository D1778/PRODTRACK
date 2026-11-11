import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import { BarList, RevenueChart } from "../components/Charts";
import { EmptyState, StatCard, StockBadge } from "../components/ui";
import { useApp } from "../context/AppContext";
import { describe, kindMeta, qtyText } from "../lib/events";
import { billNo, dayKey, greeting, money, number, relativeTime, stockStatus, time } from "../lib/format";

function buildDays(n, valuesByDay) {
  const days = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = dayKey(d);
    const v = valuesByDay.get(key) || { value: 0, count: 0 };
    days.push({
      key,
      label: n > 14 ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : d.toLocaleDateString("en-IN", { weekday: "short" }),
      fullLabel: d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }),
      ...v,
    });
  }
  return days;
}

function Trend({ now, before }) {
  if (!before && !now) return <span>No sales yet</span>;
  if (!before) return <span className="trend-up">New sales today</span>;
  const pct = Math.round(((now - before) / before) * 100);
  return (
    <span className={pct >= 0 ? "trend-up" : "trend-down"}>
      {pct >= 0 ? "▲" : "▼"} {Math.abs(pct)}% vs yesterday
    </span>
  );
}

function ActivityList({ history }) {
  if (!history.length) return <EmptyState icon="history" title="No activity yet" text="Stock changes and sales will show up here." />;
  return (
    <div className="list">
      {history.slice(0, 6).map((h) => {
        const meta = kindMeta(h);
        return (
        <div className="list-item" key={h.id}>
          <span className={`list-icon tone-${meta.tone}`}>
            <Icon name={meta.icon} />
          </span>
          <div className="grow">
            <div className="title">
              {qtyText(h) ? `${qtyText(h)} ` : `${meta.label}: `}
              {h.productName}
            </div>
            <div className="sub">
              {describe(h)} · {h.performedBy || "—"}
            </div>
          </div>
          <span className="muted" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{relativeTime(h.timestamp)}</span>
        </div>
        );
      })}
    </div>
  );
}

function LowStockList({ products }) {
  const low = products.filter((p) => stockStatus(p) !== "ok").sort((a, b) => a.stock - b.stock);
  if (!low.length) return <EmptyState icon="checkCircle" title="Stock levels look healthy" text="Nothing is at or below its minimum." />;
  return (
    <div className="list">
      {low.slice(0, 5).map((p) => (
        <div className="list-item" key={p.id}>
          <div className="grow">
            <div className="title">{p.name}</div>
            <div className="sub">
              <span className="sku">{p.sku}</span> {p.stock} left · min {p.minThreshold}
            </div>
          </div>
          <StockBadge product={p} />
        </div>
      ))}
    </div>
  );
}

export default function DashboardHome() {
  const { user, isOwner, products, bills, history, analytics } = useApp();
  const [range, setRange] = useState(14);
  const firstName = user?.name?.split(" ")[0] || "there";

  const stats = useMemo(() => {
    const today = dayKey(new Date());
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterday = dayKey(y);
    const mine = isOwner ? bills : bills.filter((b) => b.createdById === user?.id);
    const sum = (list) => list.reduce((s, b) => s + b.totalAmount, 0);
    const todays = mine.filter((b) => dayKey(b.timestamp) === today);
    const monthAgo = new Date().getTime() - 30 * 864e5;
    return {
      mine,
      todays,
      todayRevenue: sum(todays),
      yesterdayRevenue: sum(mine.filter((b) => dayKey(b.timestamp) === yesterday)),
      monthRevenue: sum(mine.filter((b) => new Date(b.timestamp).getTime() >= monthAgo)),
      itemsToday: todays.reduce((s, b) => s + b.items.reduce((n, i) => n + i.quantity, 0), 0),
      units: products.reduce((s, p) => s + p.stock, 0),
      stockValue: products.reduce((s, p) => s + p.stock * p.price, 0),
      lowCount: products.filter((p) => stockStatus(p) === "low").length,
      outCount: products.filter((p) => stockStatus(p) === "out").length,
    };
  }, [bills, products, isOwner, user]);

  const chartData = useMemo(() => {
    const map = new Map();
    if (isOwner) {
      for (const d of analytics.daily) map.set(d.date, { value: d.totalSales, count: d.bills });
    } else {
      for (const b of stats.mine) {
        const k = dayKey(b.timestamp);
        const cur = map.get(k) || { value: 0, count: 0 };
        map.set(k, { value: cur.value + b.totalAmount, count: cur.count + 1 });
      }
    }
    return buildDays(range, map);
  }, [analytics, stats.mine, range, isOwner]);

  const rangeTotal = chartData.reduce((s, d) => s + d.value, 0);
  const rangeBills = chartData.reduce((s, d) => s + d.count, 0);

  const top = useMemo(() => {
    if (isOwner) return analytics.topProducts.map((p) => ({ id: p.productId, name: p.name, value: p.revenue, detail: p.quantity }));
    const m = new Map();
    for (const b of stats.mine)
      for (const it of b.items) {
        const cur = m.get(it.productId) || { id: it.productId, name: it.productName, value: 0, detail: 0 };
        cur.value += it.price * it.quantity;
        cur.detail += it.quantity;
        m.set(it.productId, cur);
      }
    return [...m.values()].sort((a, b) => b.value - a.value).slice(0, 5);
  }, [analytics, stats.mine, isOwner]);

  return (
    <>
      <section className="welcome">
        <div className="row">
          <div>
            <h1>
              {greeting()}, {firstName} 👋
            </h1>
            <p>
              {isOwner
                ? `Here's how ${user?.businessName} is doing today.`
                : `You're signed in to ${user?.businessName}. Ready for the next customer?`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/dashboard/billing" className="btn btn-light btn-lg">
              <Icon name="receipt" /> New bill
            </Link>
            <Link to="/dashboard/add-product" className="btn btn-glass btn-lg">
              <Icon name="plus" /> Add product
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-4 mb">
        <StatCard
          label={isOwner ? "Today's revenue" : "My sales today"}
          value={money(stats.todayRevenue)}
          icon="rupee"
          tone="primary"
          foot={<Trend now={stats.todayRevenue} before={stats.yesterdayRevenue} />}
        />
        {isOwner ? (
          <StatCard label="Last 30 days" value={money(stats.monthRevenue)} icon="trendUp" tone="success" foot={`${number(stats.mine.length)} bill${stats.mine.length === 1 ? "" : "s"} all time`} />
        ) : (
          <StatCard label="My bills today" value={number(stats.todays.length)} icon="receipt" tone="success" foot={`${number(stats.itemsToday)} items sold`} />
        )}
        <StatCard
          label="Products"
          value={number(products.length)}
          icon="box"
          tone="info"
          foot={isOwner ? `${number(stats.units)} units · ${money(stats.stockValue)} value` : `${number(stats.units)} units in stock`}
        />
        <StatCard
          label="Needs attention"
          value={number(stats.lowCount + stats.outCount)}
          icon="alert"
          tone={stats.outCount ? "danger" : stats.lowCount ? "warning" : "success"}
          foot={
            <Link to="/dashboard/alerts">
              {stats.outCount} out · {stats.lowCount} low →
            </Link>
          }
        />
      </div>

      <div className="grid grid-main mb">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>{isOwner ? "Revenue" : "My sales"}</h2>
              <p>Daily totals for the last {range} days</p>
            </div>
            <div className="range-toggle" role="group" aria-label="Date range">
              {[7, 14, 30].map((n) => (
                <button key={n} className={range === n ? "active" : ""} onClick={() => setRange(n)} aria-pressed={range === n}>
                  {n}D
                </button>
              ))}
            </div>
          </div>
          <div className="chart-summary">
            <div>
              <span>Total</span>
              <strong>{money(rangeTotal)}</strong>
            </div>
            <div>
              <span>Bills</span>
              <strong>{number(rangeBills)}</strong>
            </div>
            <div>
              <span>Avg. bill</span>
              <strong>{money(rangeBills ? rangeTotal / rangeBills : 0)}</strong>
            </div>
          </div>
          <RevenueChart data={chartData} />
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2>Top sellers</h2>
              <p>By revenue, all time</p>
            </div>
          </div>
          {top.length ? <BarList items={top} /> : <EmptyState icon="chart" title="No sales yet" text="Create your first bill to see best sellers here." />}
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <div className="card-head">
            <h2>Low stock</h2>
            <Link to="/dashboard/alerts" className="btn btn-ghost btn-sm">View all</Link>
          </div>
          <LowStockList products={products} />
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Recent activity</h2>
            <Link to={isOwner ? "/dashboard/logbook" : "/dashboard/history"} className="btn btn-ghost btn-sm">{isOwner ? "Log book" : "History"}</Link>
          </div>
          <ActivityList history={history} />
        </div>

        <div className="card">
          {isOwner ? (
            <>
              <div className="card-head">
                <h2>Quick actions</h2>
              </div>
              <div className="quick-actions">
                <Link to="/dashboard/billing" className="quick">
                  <span className="list-icon tone-primary"><Icon name="receipt" /></span>
                  <strong>New bill</strong>
                  <span>Sell to a customer</span>
                </Link>
                <Link to="/dashboard/stock" className="quick">
                  <span className="list-icon tone-success"><Icon name="swap" /></span>
                  <strong>Restock</strong>
                  <span>Record stock in/out</span>
                </Link>
                <Link to="/dashboard/products?status=low" className="quick">
                  <span className="list-icon tone-warning"><Icon name="search" /></span>
                  <strong>Find items</strong>
                  <span>Search by SKU</span>
                </Link>
                <Link to="/dashboard/logbook" className="quick">
                  <span className="list-icon tone-info"><Icon name="calendar" /></span>
                  <strong>Log book</strong>
                  <span>Today's ins & outs</span>
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="card-head">
                <h2>My recent bills</h2>
                <Link to="/dashboard/billing?view=records" className="btn btn-ghost btn-sm">All bills</Link>
              </div>
              {stats.mine.length ? (
                <div className="list">
                  {stats.mine.slice(0, 6).map((b) => (
                    <div className="list-item" key={b.id}>
                      <span className="list-icon tone-primary"><Icon name="receipt" /></span>
                      <div className="grow">
                        <div className="title">Bill {billNo(b)}</div>
                        <div className="sub">
                          {b.items.length} item{b.items.length === 1 ? "" : "s"} · {time(b.timestamp)}
                        </div>
                      </div>
                      <strong className="num">{money(b.totalAmount)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon="receipt" title="No bills yet" text="Your sales will appear here." />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
