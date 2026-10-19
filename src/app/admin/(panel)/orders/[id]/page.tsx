import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { db, orders } from "@/db";
import { requireStaff } from "@/lib/auth";
import { getOrderFull } from "@/lib/orders";
import { inr } from "@/lib/money";
import { STATUS_LABEL, STATUS_TONE, PAYMENT_LABEL, PAYMENT_TONE, NEXT_STATUSES, COURIERS } from "@/lib/order-status";
import { formatDate } from "@/lib/utils";
import { PageHead, Card, Pill } from "@/components/admin/ui";
import { StatusForm, NoteForm, RefundForm, AddressForm, InternalNote, CodForm, TrackingForm } from "./Forms";

export const metadata = { title: "Order" };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff("orders.view");
  const o = await getOrderFull((await params).id);
  if (!o) notFound();
  const [{ n: prevOrders }] = await db.select({ n: sql<number>`count(*)::int` }).from(orders)
    .where(and(eq(orders.email, o.email), ne(orders.id, o.id), sql`${orders.status} not in ('PENDING_PAYMENT','CANCELLED')`));
  const a = o.shippingAddress;
  const canManage = me.perms.has("orders.manage"), canRefund = me.perms.has("orders.refund");
  const next = NEXT_STATUSES[o.status].filter((s) => s !== "CANCELLED" || canRefund);
  const refundable = o.total - o.refunded;
  const paidOnline = o.paymentMethod === "RAZORPAY" && (o.paymentStatus === "PAID" || o.paymentStatus === "PARTIALLY_REFUNDED");
  const waText = encodeURIComponent(`Hi ${a.name.split(" ")[0]}, this is VELMONT about your order ${o.number}.`);

  return (
    <div>
      <PageHead title={o.number} back={{ href: "/admin/orders", label: "Orders" }}
        sub={<>{formatDate(o.createdAt, true)} · <Pill tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Pill> <Pill tone={PAYMENT_TONE[o.paymentStatus]}>{PAYMENT_LABEL[o.paymentStatus]}</Pill></>}
        actions={<><a className="btn sm" href={`/admin/orders/${o.id}/invoice`} target="_blank" rel="noopener">Invoice</a>
          <a className="btn sm" href={`https://wa.me/91${o.phone}?text=${waText}`} target="_blank" rel="noopener noreferrer">WhatsApp customer</a></>} />
      <div className="cols">
        <div className="stack">
          <Card title={`Items · ${o.items.reduce((s, i) => s + i.qty, 0)}`} flush>
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th></th><th>Product</th><th>SKU</th><th className="r">Price</th><th className="r">Qty</th><th className="r">Total</th></tr></thead>
              <tbody>{o.items.map((i) => (
                <tr key={i.id}>
                  <td style={{ width: 60 }}><div className="thumb">{i.image && <Image src={i.image} alt="" width={44} height={44} />}</div></td>
                  <td><b>{i.name}</b><div className="sub">Size {i.size}</div></td><td className="sub">{i.sku}</td>
                  <td className="r">{inr(i.unitPrice)}</td><td className="r">{i.qty}</td><td className="r">{inr(i.total)}</td>
                </tr>))}</tbody>
            </table></div>
            <div style={{ padding: "14px 18px", borderTop: "1px solid var(--line)", display: "grid", gap: 6, justifyItems: "end", fontSize: ".9rem" }}>
              <div>Subtotal <b className="tnum" style={{ display: "inline-block", minWidth: 90, textAlign: "right" }}>{inr(o.subtotal)}</b></div>
              {o.discount > 0 && <div>Discount {o.couponCode && `(${o.couponCode})`} <b className="tnum" style={{ display: "inline-block", minWidth: 90, textAlign: "right", color: "var(--good)" }}>−{inr(o.discount)}</b></div>}
              <div>Shipping <b className="tnum" style={{ display: "inline-block", minWidth: 90, textAlign: "right" }}>{o.shipping ? inr(o.shipping) : "Free"}</b></div>
              {o.codFee > 0 && <div>COD fee <b className="tnum" style={{ display: "inline-block", minWidth: 90, textAlign: "right" }}>{inr(o.codFee)}</b></div>}
              <div style={{ fontSize: "1.05rem" }}>Total <b className="tnum" style={{ display: "inline-block", minWidth: 90, textAlign: "right" }}>{inr(o.total)}</b></div>
              <div className="sub">GST included: {inr(o.tax)}</div>
              {o.refunded > 0 && <div style={{ color: "var(--bad)" }}>Refunded <b className="tnum" style={{ display: "inline-block", minWidth: 90, textAlign: "right" }}>{inr(o.refunded)}</b></div>}
            </div>
          </Card>

          {canManage && next.length > 0 && (
            <Card title="Update status" sub="Ticking “Notify customer” sends an email and updates their tracking page.">
              <StatusForm id={o.id} current={o.status} next={next} couriers={COURIERS.map((c) => c.name)} courier={o.courier || ""} awb={o.awb || ""} trackingUrl={o.trackingUrl || ""} />
            </Card>
          )}
          {canManage && (o.status === "SHIPPED" || o.status === "OUT_FOR_DELIVERY" || o.status === "DELIVERED") && (
            <Card title="Courier and tracking"><TrackingForm id={o.id} couriers={COURIERS.map((c) => c.name)} courier={o.courier || ""} awb={o.awb || ""} trackingUrl={o.trackingUrl || ""} /></Card>
          )}

          <Card title="Timeline">
            <ol className="otimeline">
              {o.events.slice().reverse().map((e) => (
                <li key={e.id}><span className={`d${e.visibleToCustomer ? "" : " int"}`} />
                  <div>{e.message}<br /><small>{formatDate(e.createdAt, true)} · {e.actorName}{!e.visibleToCustomer && " · staff only"}</small></div></li>
              ))}
            </ol>
            {canManage && <NoteForm id={o.id} />}
          </Card>
        </div>

        <div className="stack">
          <Card title="Customer">
            <dl className="kvx">
              <dt>Name</dt><dd>{a.name}</dd>
              <dt>Email</dt><dd>{o.userId ? <Link href={`/admin/customers/${o.userId}`}>{o.email}</Link> : o.email}</dd>
              <dt>Phone</dt><dd>{o.phone}</dd>
              <dt>History</dt><dd>{prevOrders ? `${prevOrders} earlier order${prevOrders > 1 ? "s" : ""}` : "First order"}{!o.userId && " · guest checkout"}</dd>
            </dl>
            {o.customerNote && <div className="hint-box" style={{ marginTop: 12 }}>Customer note: {o.customerNote}</div>}
          </Card>
          <Card title="Ship to">
            <p style={{ margin: "0 0 12px", fontSize: ".9rem" }}>{a.name}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.city}, {a.state} {a.pincode}<br />{a.phone}</p>
            {canManage && !["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "RETURNED"].includes(o.status) && <AddressForm id={o.id} a={a} />}
          </Card>
          <Card title="Payment">
            <dl className="kvx">
              <dt>Method</dt><dd>{o.paymentMethod === "COD" ? "Cash on delivery" : "Razorpay (online)"}</dd>
              <dt>Status</dt><dd><Pill tone={PAYMENT_TONE[o.paymentStatus]}>{PAYMENT_LABEL[o.paymentStatus]}</Pill></dd>
              {o.paidAt && <><dt>Paid</dt><dd>{formatDate(o.paidAt, true)}</dd></>}
              {o.razorpayPaymentId && <><dt>Payment ID</dt><dd><code>{o.razorpayPaymentId}</code></dd></>}
              {o.razorpayOrderId && <><dt>Razorpay order</dt><dd><code>{o.razorpayOrderId}</code></dd></>}
            </dl>
            {canManage && o.paymentStatus === "COD_PENDING" && o.status !== "CANCELLED" && <CodForm id={o.id} />}
            {o.refunds.length > 0 && (
              <div style={{ marginTop: 12, display: "grid", gap: 6, fontSize: ".85rem" }}>
                <b>Refunds</b>
                {o.refunds.map((r) => <div key={r.id}>{inr(r.amount)} · {r.reason} · {r.status === "manual" ? "recorded manually" : "via Razorpay"} · {formatDate(r.createdAt)} · {r.actorName}</div>)}
              </div>
            )}
          </Card>
          {canRefund && refundable > 0 && o.paymentStatus !== "PENDING" && o.paymentStatus !== "COD_PENDING" && (
            <Card title="Refund" sub={`Up to ${inr(refundable)}`}><RefundForm id={o.id} max={refundable / 100} online={paidOnline} /></Card>
          )}
          {canManage && <Card title="Staff note" sub="Only staff can see this."><InternalNote id={o.id} value={o.internalNote} /></Card>}
        </div>
      </div>
    </div>
  );
}
