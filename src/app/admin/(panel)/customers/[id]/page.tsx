import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db, users, orders, addresses } from "@/db";
import { requireStaff } from "@/lib/auth";
import { inr } from "@/lib/money";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/order-status";
import { formatDate } from "@/lib/utils";
import { PageHead, Card, Pill, Kpi } from "@/components/admin/ui";
import { AForm, Submit, ConfirmSubmit } from "@/components/admin/Form";
import { setCustomerActive, editCustomer } from "../actions";

export const metadata = { title: "Customer" };

export default async function Customer({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff("customers.view");
  const id = (await params).id;
  const u = await db.query.users.findFirst({ where: and(eq(users.id, id), eq(users.kind, "CUSTOMER")) });
  if (!u) notFound();
  const [list, addrs] = await Promise.all([
    db.query.orders.findMany({ where: eq(orders.userId, id), orderBy: [desc(orders.createdAt)] }),
    db.select().from(addresses).where(eq(addresses.userId, id)),
  ]);
  const counted = list.filter((o) => o.status !== "PENDING_PAYMENT" && o.status !== "CANCELLED");
  const spent = counted.reduce((a, o) => a + o.total - o.refunded, 0);
  const can = me.perms.has("customers.manage");
  return (
    <div>
      <PageHead title={u.name} back={{ href: "/admin/customers", label: "Customers" }} sub={<>{u.email} · joined {formatDate(u.createdAt)} {!u.active && <Pill tone="bad">Blocked</Pill>}</>} />
      <div className="kpis">
        <Kpi label="Orders" value={counted.length} />
        <Kpi label="Lifetime spend" value={inr(spent)} />
        <Kpi label="Average order" value={inr(counted.length ? Math.round(spent / counted.length) : 0)} />
        <Kpi label="Last seen" value={u.lastLoginAt ? formatDate(u.lastLoginAt) : "—"} />
      </div>
      <div className="cols">
        <Card title="Orders" flush>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Order</th><th>Date</th><th>Status</th><th className="r">Total</th></tr></thead>
            <tbody>{list.map((o) => (
              <tr key={o.id}><td><Link className="rowlink" href={`/admin/orders/${o.id}`}>{o.number}</Link></td><td>{formatDate(o.createdAt)}</td>
                <td><Pill tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Pill></td><td className="r">{inr(o.total)}</td></tr>
            ))}{!list.length && <tr><td colSpan={4} className="empty">No orders yet.</td></tr>}</tbody>
          </table></div>
        </Card>
        <div className="stack">
          <Card title="Details">
            {can ? (
              <AForm action={editCustomer} style={{ display: "grid", gap: 12 }}>
                <input type="hidden" name="id" value={u.id} />
                <div className="field"><label htmlFor="cu-n">Name</label><input id="cu-n" name="name" className="input" defaultValue={u.name} /></div>
                <div className="field"><label htmlFor="cu-p">Phone</label><input id="cu-p" name="phone" className="input" defaultValue={u.phone || ""} /></div>
                <label className="check"><input type="checkbox" name="optin" defaultChecked={u.marketingOptIn} />Agreed to marketing emails</label>
                <div><Submit className="btn sm solid">Save</Submit></div>
              </AForm>
            ) : <dl className="kvx"><dt>Phone</dt><dd>{u.phone || "—"}</dd><dt>Marketing</dt><dd>{u.marketingOptIn ? "Subscribed" : "No"}</dd></dl>}
          </Card>
          <Card title="Saved addresses">
            {addrs.length ? addrs.map((a) => <p key={a.id} style={{ margin: "0 0 10px", fontSize: ".88rem" }}>{a.name}{a.isDefault && " (default)"}<br />{a.line1}, {a.city}, {a.state} {a.pincode}<br />{a.phone}</p>) : <p className="muted" style={{ margin: 0 }}>None saved.</p>}
          </Card>
          {can && (
            <Card title="Access">
              <AForm action={setCustomerActive}>
                <input type="hidden" name="id" value={u.id} /><input type="hidden" name="active" value={u.active ? "false" : "true"} />
                {u.active ? <ConfirmSubmit confirmText="Click again to block">Block customer</ConfirmSubmit> : <Submit className="btn sm">Unblock customer</Submit>}
              </AForm>
              <p className="muted" style={{ fontSize: ".8rem", margin: "8px 0 0" }}>A blocked customer cannot sign in. They can still check out as a guest.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
