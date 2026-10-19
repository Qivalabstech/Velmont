import Link from "next/link";
import { and, desc, eq, gte, lt, lte, sql, inArray, notInArray, ne } from "drizzle-orm";
import { db, orders, orderItems, variants, products, visits, carts, cartItems } from "@/db";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { inr } from "@/lib/money";
import { STATUS_LABEL, STATUS_TONE, PAYMENT_LABEL, PAYMENT_TONE } from "@/lib/order-status";
import { formatDate, timeAgo } from "@/lib/utils";
import { PageHead, Card, Kpi, Pill } from "@/components/admin/ui";
import { Bars } from "@/components/admin/Charts";

export const metadata = { title: "Dashboard" };
const COUNTED = sql`${orders.status} not in ('PENDING_PAYMENT','CANCELLED')`;

function delta(cur: number, prev: number) {
  if (!prev) return cur ? { t: "New this period", tone: "up" as const } : { t: "No change", tone: "" as const };
  const p = Math.round(((cur - prev) / prev) * 100);
  return { t: `${p >= 0 ? "▲" : "▼"} ${Math.abs(p)}% vs previous period`, tone: p >= 0 ? ("up" as const) : ("down" as const) };
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const me = await requireStaff("dashboard.view");
  const s = await getSettings();
  const days = [7, 30, 90].includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 30;
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));
  const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - days);

  const agg = (from: Date, to: Date) => db.select({
    revenue: sql<number>`coalesce(sum(${orders.total} - ${orders.refunded}),0)::int`, n: sql<number>`count(*)::int`,
  }).from(orders).where(and(COUNTED, gte(orders.createdAt, from), lt(orders.createdAt, to)));
  const visitorsQ = (from: Date, to: Date) => db.select({ n: sql<number>`count(distinct ${visits.visitor})::int` }).from(visits)
    .where(and(gte(visits.createdAt, from), lt(visits.createdAt, to)));

  const [[cur], [prev], [vCur], [vPrev], daily, toShip, codDue, top, low, recent, refs, devices, abandoned] = await Promise.all([
    agg(start, now), agg(prevStart, start), visitorsQ(start, now), visitorsQ(prevStart, start),
    db.select({ d: sql<string>`to_char(${orders.createdAt} at time zone 'Asia/Kolkata','YYYY-MM-DD')`, v: sql<number>`sum(${orders.total} - ${orders.refunded})::int`, n: sql<number>`count(*)::int` })
      .from(orders).where(and(COUNTED, gte(orders.createdAt, start))).groupBy(sql`1`),
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(inArray(orders.status, ["PLACED", "CONFIRMED", "PACKED"])),
    db.select({ v: sql<number>`coalesce(sum(${orders.total}),0)::int`, n: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.paymentStatus, "COD_PENDING"), ne(orders.status, "CANCELLED"))),
    db.select({ name: orderItems.name, units: sql<number>`sum(${orderItems.qty})::int`, rev: sql<number>`sum(${orderItems.total})::int` })
      .from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(and(COUNTED, gte(orders.createdAt, start)))
      .groupBy(orderItems.name).orderBy(desc(sql`2`)).limit(5),
    db.select({ sku: variants.sku, size: variants.size, stock: variants.stock, name: products.name, pid: products.id })
      .from(variants).innerJoin(products, eq(products.id, variants.productId))
      .where(and(lte(variants.stock, s.inventory.lowStockThreshold), eq(variants.active, true), eq(products.status, "ACTIVE"))).orderBy(variants.stock).limit(8),
    db.query.orders.findMany({ where: ne(orders.status, "PENDING_PAYMENT"), orderBy: [desc(orders.createdAt)], limit: 8 }),
    db.select({ r: visits.referrer, n: sql<number>`count(distinct ${visits.visitor})::int` }).from(visits)
      .where(and(gte(visits.createdAt, start), ne(visits.referrer, ""))).groupBy(visits.referrer).orderBy(desc(sql`2`)).limit(5),
    db.select({ d: visits.device, n: sql<number>`count(distinct ${visits.visitor})::int` }).from(visits).where(gte(visits.createdAt, start)).groupBy(visits.device),
    db.select({ n: sql<number>`count(distinct ${carts.id})::int` }).from(carts).innerJoin(cartItems, eq(cartItems.cartId, carts.id))
      .where(and(lt(carts.updatedAt, new Date(Date.now() - 3600_000)), gte(carts.updatedAt, start))),
  ]);

  const byDay = new Map(daily.map((d) => [d.d, d]));
  const series = Array.from({ length: days }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i);
    const key = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const row = byDay.get(key);
    return { label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), value: row?.v ?? 0, title: `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}: ${inr(row?.v ?? 0)} from ${row?.n ?? 0} orders` };
  });
  const aov = cur.n ? Math.round(cur.revenue / cur.n) : 0;
  const prevAov = prev.n ? Math.round(prev.revenue / prev.n) : 0;
  const conv = vCur.n ? (cur.n / vCur.n) * 100 : 0;
  const dRev = delta(cur.revenue, prev.revenue), dN = delta(cur.n, prev.n), dA = delta(aov, prevAov), dV = delta(vCur.n, vPrev.n);
  const totalDev = devices.reduce((a, d) => a + d.n, 0) || 1;
  const topMax = Math.max(...top.map((t) => t.units), 1);
  const hour = Number(now.toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));

  return (
    <div>
      <PageHead title={`Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, ${me.name.split(" ")[0]}`}
        sub={`Last ${days} days, compared with the ${days} days before.`}
        actions={<div className="tabs" style={{ margin: 0, border: 0 }}>{[7, 30, 90].map((d) => <Link key={d} href={`/admin?days=${d}`} aria-current={d === days ? "page" : undefined}>{d} days</Link>)}</div>} />

      <div className="kpis">
        <Kpi label="Revenue" value={inr(cur.revenue)} delta={dRev.t} tone={dRev.tone} />
        <Kpi label="Orders" value={cur.n} delta={dN.t} tone={dN.tone} href="/admin/orders" />
        <Kpi label="Average order" value={inr(aov)} delta={dA.t} tone={dA.tone} />
        <Kpi label="Visitors" value={vCur.n} delta={`${conv.toFixed(1)}% bought · ${dV.t}`} tone={dV.tone} />
      </div>
      <div className="kpis">
        <Link href="/admin/orders?tab=to-ship" className={`kpi${toShip[0].n ? " alert-k" : ""}`} style={{ textDecoration: "none" }}>
          <span className="l">To pack and ship</span><span className="v">{toShip[0].n}</span><span className="d">Open the queue →</span></Link>
        <Kpi label="COD to collect" value={inr(codDue[0].v)} delta={`${codDue[0].n} orders`} href="/admin/orders?payment=COD_PENDING" />
        <Kpi label="Low stock sizes" value={low.length} delta={`At or below ${s.inventory.lowStockThreshold} units`} href="/admin/inventory?low=1" />
        <Kpi label="Abandoned bags" value={abandoned[0].n} delta="Bags left for over an hour" />
      </div>

      <div className="cols">
        <div className="stack">
          <Card title="Daily revenue" sub="Paid and cash-on-delivery orders, after refunds">
            <Bars data={series} money />
          </Card>
          <Card title="Recent orders" actions={<Link className="btn sm" href="/admin/orders">All orders</Link>} flush>
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Payment</th><th className="r">Total</th></tr></thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id}>
                    <td><Link className="rowlink" href={`/admin/orders/${o.id}`}>{o.number}</Link><div className="sub">{timeAgo(o.createdAt)}</div></td>
                    <td>{o.shippingAddress.name}<div className="sub">{o.shippingAddress.city}</div></td>
                    <td><Pill tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Pill></td>
                    <td><Pill tone={PAYMENT_TONE[o.paymentStatus]}>{PAYMENT_LABEL[o.paymentStatus]}</Pill></td>
                    <td className="r">{inr(o.total)}</td>
                  </tr>
                ))}
                {!recent.length && <tr><td colSpan={5} className="empty">No orders yet. They will appear here the moment someone checks out.</td></tr>}
              </tbody>
            </table></div>
          </Card>
        </div>
        <div className="stack">
          <Card title="Best sellers" sub={`Units sold, last ${days} days`}>
            {top.length ? <div style={{ display: "grid", gap: 12 }}>{top.map((t) => (
              <div className="hbar" key={t.name}><span>{t.name}</span><span className="tnum">{t.units} · {inr(t.rev)}</span><span className="track"><i style={{ width: `${(t.units / topMax) * 100}%` }} /></span></div>
            ))}</div> : <p className="muted" style={{ margin: 0 }}>No sales in this period yet.</p>}
          </Card>
          <Card title="Low stock" actions={<Link className="btn sm" href="/admin/inventory?low=1">Restock</Link>} flush>
            {low.length ? <table className="tbl"><tbody>{low.map((l) => (
              <tr key={l.sku}><td><Link className="rowlink" href={`/admin/products/${l.pid}`}>{l.name}</Link><div className="sub">{l.sku}</div></td><td>Size {l.size}</td>
                <td className="r"><Pill tone={l.stock <= 0 ? "bad" : "warn"}>{l.stock <= 0 ? "Sold out" : `${l.stock} left`}</Pill></td></tr>
            ))}</tbody></table> : <p className="empty">Every size is above {s.inventory.lowStockThreshold} units.</p>}
          </Card>
          <Card title="Where visitors come from">
            <div style={{ display: "grid", gap: 8, fontSize: ".88rem" }}>
              {refs.length ? refs.map((r) => <div key={r.r} style={{ display: "flex", justifyContent: "space-between" }}><span>{r.r}</span><span className="tnum">{r.n}</span></div>)
                : <span className="muted">Direct visits only so far.</span>}
              <div className="muted" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                {devices.map((d) => `${d.d === "mobile" ? "Phone" : "Desktop"} ${Math.round((d.n / totalDev) * 100)}%`).join(" · ") || "No visits recorded yet"}
              </div>
            </div>
          </Card>
        </div>
      </div>
      <p className="muted" style={{ fontSize: ".8rem", marginTop: 16 }}>Updated {formatDate(now, true)}. Visitor counts are anonymous and exclude bots and staff pages.</p>
    </div>
  );
}
