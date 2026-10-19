import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, users, orders } from "@/db";
import { requireStaff } from "@/lib/auth";
import { inr } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { PageHead, Card, Pill, Pager } from "@/components/admin/ui";

export const metadata = { title: "Customers" };
const PER = 30;

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; tab?: string }> }) {
  await requireStaff("customers.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const tab = sp.tab === "guests" ? "guests" : "accounts";

  if (tab === "guests") {
    const q = sp.q ? sql`and (o.email ilike ${"%" + sp.q + "%"} or o.phone ilike ${"%" + sp.q + "%"} or o.shipping_address->>'name' ilike ${"%" + sp.q + "%"})` : sql``;
    const r = await db.execute(sql`select o.email, max(o.shipping_address->>'name') as name, max(o.phone) as phone, count(*)::int as n,
      sum(o.total - o.refunded)::int as spent, max(o.created_at) as last from orders o
      where o.user_id is null and o.status not in ('PENDING_PAYMENT','CANCELLED') ${q}
      group by o.email order by last desc limit ${PER} offset ${(page - 1) * PER}`);
    const rows = r.rows as { email: string; name: string; phone: string; n: number; spent: number; last: string }[];
    return (
      <div>
        <PageHead title="Customers" sub="Shoppers who checked out without an account, grouped by email." actions={<a className="btn sm" href="/admin/customers/export?tab=guests">Export CSV</a>} />
        <Tabs tab={tab} />
        <Search q={sp.q} tab={tab} />
        <Card flush><div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th className="r">Orders</th><th className="r">Spent</th><th>Last order</th></tr></thead>
          <tbody>{rows.map((g) => (
            <tr key={g.email}><td>{g.name}</td><td><Link className="rowlink" href={`/admin/orders?q=${encodeURIComponent(g.email)}`}>{g.email}</Link></td><td>{g.phone}</td><td className="r">{g.n}</td><td className="r">{inr(g.spent)}</td><td>{formatDate(new Date(g.last))}</td></tr>
          ))}{!rows.length && <tr><td colSpan={6} className="empty">No guest orders yet.</td></tr>}</tbody>
        </table></div></Card>
      </div>
    );
  }

  const where = and(eq(users.kind, "CUSTOMER"), sp.q ? or(ilike(users.name, `%${sp.q}%`), ilike(users.email, `%${sp.q}%`), ilike(users.phone, `%${sp.q}%`)) : undefined);
  const [rows, [{ n }]] = await Promise.all([
    db.select({
      id: users.id, name: users.name, email: users.email, phone: users.phone, active: users.active, createdAt: users.createdAt, optin: users.marketingOptIn,
      orders: sql<number>`count(${orders.id}) filter (where ${orders.status} not in ('PENDING_PAYMENT','CANCELLED'))::int`,
      spent: sql<number>`coalesce(sum(${orders.total} - ${orders.refunded}) filter (where ${orders.status} not in ('PENDING_PAYMENT','CANCELLED')),0)::int`,
    }).from(users).leftJoin(orders, eq(orders.userId, users.id)).where(where).groupBy(users.id).orderBy(desc(users.createdAt)).limit(PER).offset((page - 1) * PER),
    db.select({ n: sql<number>`count(*)::int` }).from(users).where(where),
  ]);
  return (
    <div>
      <PageHead title="Customers" sub="Shoppers with an account." actions={<a className="btn sm" href="/admin/customers/export">Export CSV</a>} />
      <Tabs tab={tab} />
      <Search q={sp.q} tab={tab} />
      <Card flush>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Customer</th><th>Phone</th><th>Joined</th><th className="r">Orders</th><th className="r">Spent</th><th></th></tr></thead>
          <tbody>{rows.map((u) => (
            <tr key={u.id}>
              <td><Link className="rowlink" href={`/admin/customers/${u.id}`}>{u.name}</Link><div className="sub">{u.email}</div></td>
              <td>{u.phone || "—"}</td><td>{formatDate(u.createdAt)}</td><td className="r">{u.orders}</td><td className="r">{inr(u.spent)}</td>
              <td>{!u.active ? <Pill tone="bad">Blocked</Pill> : u.optin ? <Pill tone="info">Subscribed</Pill> : null}</td>
            </tr>
          ))}{!rows.length && <tr><td colSpan={6} className="empty">No customer accounts yet.</td></tr>}</tbody>
        </table></div>
        <Pager page={page} total={n} per={PER} base={`/admin/customers${sp.q ? `?q=${encodeURIComponent(sp.q)}` : ""}`} />
      </Card>
    </div>
  );
}

function Tabs({ tab }: { tab: string }) {
  return <nav className="tabs"><Link href="/admin/customers" aria-current={tab === "accounts" ? "page" : undefined}>With account</Link><Link href="/admin/customers?tab=guests" aria-current={tab === "guests" ? "page" : undefined}>Guest checkouts</Link></nav>;
}
function Search({ q, tab }: { q?: string; tab: string }) {
  return (
    <form className="toolbar" method="get">
      {tab === "guests" && <input type="hidden" name="tab" value="guests" />}
      <input className="input grow" name="q" defaultValue={q} placeholder="Search name, email or phone" aria-label="Search customers" />
      <button className="btn sm">Search</button>
    </form>
  );
}
