import Link from "next/link";
import { and, desc, inArray, sql } from "drizzle-orm";
import { db, orders } from "@/db";
import { requireStaff } from "@/lib/auth";
import { inr } from "@/lib/money";
import { STATUS_LABEL, STATUS_TONE, PAYMENT_LABEL, PAYMENT_TONE } from "@/lib/order-status";
import { formatDate } from "@/lib/utils";
import { PageHead, Card, Pill, Pager } from "@/components/admin/ui";
import { TABS, orderWhere, type OrderFilters } from "./query";
import { BulkBar } from "./BulkBar";

export const metadata = { title: "Orders" };
const PER = 25;

export default async function Orders({ searchParams }: { searchParams: Promise<OrderFilters> }) {
  const me = await requireStaff("orders.view");
  const f = await searchParams;
  const page = Math.max(1, Number(f.page) || 1);
  const where = orderWhere(f);
  const [list, [{ n }], counts] = await Promise.all([
    db.query.orders.findMany({ where, orderBy: [desc(orders.createdAt)], limit: PER, offset: (page - 1) * PER, with: { items: { columns: { qty: true } } } }),
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(where),
    Promise.all(TABS.map(async (t) => {
      const w = orderWhere({ ...f, tab: t.key });
      const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(orders).where(w);
      return c;
    })),
  ]);
  const params = new URLSearchParams(Object.entries(f).filter(([k, v]) => v && k !== "page") as [string, string][]);
  const base = `/admin/orders${params.toString() ? `?${params}` : ""}`;
  const tabHref = (k: string) => { const p = new URLSearchParams(params); p.set("tab", k); p.delete("page"); return `/admin/orders?${p}`; };
  const canManage = me.perms.has("orders.manage");

  return (
    <div>
      <PageHead title="Orders" sub="Pack, ship and track every order. Customers get an email when you change the status with “Notify customer” ticked."
        actions={<a className="btn sm" href={`/admin/orders/export?${params}`}>Export CSV</a>} />
      <nav className="tabs" aria-label="Order status">
        {TABS.map((t, i) => <Link key={t.key} href={tabHref(t.key)} aria-current={(f.tab || "all") === t.key ? "page" : undefined}>{t.label}<span className="n">{counts[i]}</span></Link>)}
      </nav>
      <form className="toolbar" method="get">
        {f.tab && <input type="hidden" name="tab" value={f.tab} />}
        <input className="input grow" name="q" defaultValue={f.q} placeholder="Search order number, name, email, phone or AWB" aria-label="Search orders" />
        <select className="select" name="method" defaultValue={f.method || ""} aria-label="Payment method"><option value="">All methods</option><option value="RAZORPAY">Online</option><option value="COD">Cash on delivery</option></select>
        <select className="select" name="payment" defaultValue={f.payment || ""} aria-label="Payment status"><option value="">Any payment</option>{Object.entries(PAYMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input className="input" type="date" name="from" defaultValue={f.from} aria-label="From date" />
        <input className="input" type="date" name="to" defaultValue={f.to} aria-label="To date" />
        <button className="btn sm solid">Filter</button>
        {(f.q || f.method || f.payment || f.from || f.to) && <Link className="btn sm" href={f.tab ? `/admin/orders?tab=${f.tab}` : "/admin/orders"}>Clear</Link>}
      </form>
      <Card flush>
        <BulkBar enabled={canManage} formId="bulk">
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr>{canManage && <th style={{ width: 32 }}><span className="sr-only">Select</span></th>}<th>Order</th><th className="hide-sm">Date</th><th>Customer</th><th className="hide-sm">Items</th><th>Status</th><th className="hide-sm">Payment</th><th className="r">Total</th></tr></thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id}>
                  {canManage && <td><input type="checkbox" name="ids" value={o.id} form="bulk" aria-label={`Select ${o.number}`} style={{ width: 18, height: 18 }} /></td>}
                  <td><Link className="rowlink" href={`/admin/orders/${o.id}`}>{o.number}</Link>{o.awb && <div className="sub">{o.courier} {o.awb}</div>}<div className="sub show-sm">{formatDate(o.createdAt)}</div></td>
                  <td className="nowrap hide-sm">{formatDate(o.createdAt, true)}</td>
                  <td>{o.shippingAddress.name}<div className="sub">{o.shippingAddress.city}, {o.shippingAddress.state}</div></td>
                  <td className="hide-sm">{o.items.reduce((a, i) => a + i.qty, 0)}</td>
                  <td><Pill tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Pill></td>
                  <td className="hide-sm"><Pill tone={PAYMENT_TONE[o.paymentStatus]}>{PAYMENT_LABEL[o.paymentStatus]}</Pill><div className="sub">{o.paymentMethod === "COD" ? "COD" : "Online"}</div></td>
                  <td className="r">{inr(o.total)}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={8} className="empty">No orders match these filters.</td></tr>}
            </tbody>
          </table></div>
        </BulkBar>
        <Pager page={page} total={n} per={PER} base={base} />
      </Card>
    </div>
  );
}
