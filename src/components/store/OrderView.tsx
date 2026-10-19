import Image from "next/image";
import Link from "next/link";
import { inr } from "@/lib/money";
import { STATUS_LABEL, TRACK_STEPS, PAYMENT_LABEL } from "@/lib/order-status";
import { formatDate } from "@/lib/utils";
import type { OrderStatus, PaymentStatus, ShippingAddress } from "@/db/schema";

type O = {
  number: string; status: OrderStatus; paymentStatus: PaymentStatus; paymentMethod: "RAZORPAY" | "COD";
  subtotal: number; discount: number; shipping: number; codFee: number; tax: number; total: number; refunded: number;
  couponCode: string | null; shippingAddress: ShippingAddress; createdAt: Date; placedAt: Date | null;
  courier: string | null; awb: string | null; trackingUrl: string | null;
  items: { id: string; name: string; slug: string; size: string; qty: number; unitPrice: number; total: number; image: string }[];
  events: { id: string; status: OrderStatus | null; message: string; visibleToCustomer: boolean; createdAt: Date }[];
};

export function OrderView({ o, invoiceHref }: { o: O; invoiceHref?: string }) {
  const stepIdx = TRACK_STEPS.indexOf(o.status);
  const off = o.status === "CANCELLED" || o.status === "RETURN_REQUESTED" || o.status === "RETURNED" || o.status === "PENDING_PAYMENT";
  const when = (s: OrderStatus) => o.events.find((e) => e.status === s)?.createdAt;
  const a = o.shippingAddress;
  return (
    <div className="track-card">
      <section className="panel">
        <h2>Status</h2>
        {off ? (
          <div className={`alert ${o.status === "CANCELLED" ? "bad" : "warn"}`} style={{ marginBottom: 16 }}>
            {o.status === "PENDING_PAYMENT" ? "We have not received payment for this order yet." : STATUS_LABEL[o.status]}
          </div>
        ) : (
          <ol className="timeline">
            {TRACK_STEPS.map((s, i) => {
              const at = when(s);
              return (
                <li key={s} className={i < stepIdx || (i === stepIdx && s === "DELIVERED") ? "done" : i === stepIdx ? "done now" : ""}>
                  <span className="dot">{i <= stepIdx ? "✓" : ""}</span>
                  <div><b>{STATUS_LABEL[s]}</b>{at && <small>{formatDate(at, true)}</small>}
                    {s === "SHIPPED" && o.awb && i <= stepIdx && (
                      <small style={{ display: "block" }}>{o.courier} · {o.awb}{o.trackingUrl && <> · <a href={o.trackingUrl} target="_blank" rel="noopener noreferrer">Track with courier</a></>}</small>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <h2 style={{ marginTop: 8 }}>Updates</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10, fontSize: ".9rem" }}>
          {o.events.filter((e) => e.visibleToCustomer).slice().reverse().map((e) => (
            <li key={e.id}><span className="muted">{formatDate(e.createdAt, true)}</span><br />{e.message}</li>
          ))}
        </ul>
      </section>
      <section className="panel" style={{ display: "grid", gap: 16, alignContent: "start" }}>
        <h2 style={{ margin: 0 }}>Order {o.number}</h2>
        <div>
          {o.items.map((i) => (
            <div className="mini-line" key={i.id} style={{ marginBottom: 10 }}>
              <div className="thumb">{i.image && <Image src={i.image} alt="" width={56} height={56} />}<span className="q">{i.qty}</span></div>
              <div><Link href={`/products/${i.slug}`}><b>{i.name}</b></Link><div className="muted" style={{ fontSize: ".82rem" }}>Size {i.size} · {inr(i.unitPrice)}</div></div>
              <div className="tnum">{inr(i.total)}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <div className="sum-row"><span>Subtotal</span><span>{inr(o.subtotal)}</span></div>
          {o.discount > 0 && <div className="sum-row disc"><span>Discount{o.couponCode ? ` (${o.couponCode})` : ""}</span><span>−{inr(o.discount)}</span></div>}
          <div className="sum-row"><span>Shipping</span><span>{o.shipping ? inr(o.shipping) : "Free"}</span></div>
          {o.codFee > 0 && <div className="sum-row"><span>Cash on delivery fee</span><span>{inr(o.codFee)}</span></div>}
          <div className="sum-row total"><span>Total</span><span>{inr(o.total)}</span></div>
          {o.refunded > 0 && <div className="sum-row disc"><span>Refunded</span><span>{inr(o.refunded)}</span></div>}
        </div>
        <dl className="kv">
          <dt>Placed</dt><dd>{formatDate(o.placedAt ?? o.createdAt, true)}</dd>
          <dt>Payment</dt><dd>{o.paymentMethod === "COD" ? "Cash on delivery" : "Online (Razorpay)"} · {PAYMENT_LABEL[o.paymentStatus]}</dd>
          <dt>Ship to</dt><dd>{a.name}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.city}, {a.state} {a.pincode}<br />{a.phone}</dd>
        </dl>
        {invoiceHref && o.status !== "PENDING_PAYMENT" && <a className="btn sm" href={invoiceHref} target="_blank" rel="noopener">View invoice</a>}
      </section>
    </div>
  );
}
