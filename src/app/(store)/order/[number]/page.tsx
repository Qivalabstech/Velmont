import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, orders } from "@/db";
import { checkOrderToken, orderToken } from "@/lib/order-token";
import { getCustomer } from "@/lib/auth";
import { syncYoupiOrder } from "@/lib/youpi-orders";
import { confirmCashfreeOrder } from "@/lib/cashfree-orders";
import { PayAgain } from "./PayAgain";
import { inr } from "@/lib/money";
import { OrderView } from "@/components/store/OrderView";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false } };

const load = (number: string) => db.query.orders.findFirst({
  where: eq(orders.number, number),
  with: { items: true, events: { orderBy: (e, { asc }) => [asc(e.createdAt)] } },
});

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string; upi?: string; pay?: string }> }) {
  const { number } = await params;
  const { t, upi, pay } = await searchParams;
  let o = await load(number);
  if (!o) notFound();
  const customer = await getCustomer();
  if (!checkOrderToken(number, t) && !(customer && o.userId === customer.id)) notFound();

  // Back from the UPI gateway: ask it directly in case its webhook is still on the way.
  if (o.paymentMethod === "UPI" && o.status === "PENDING_PAYMENT" && o.paymentStatus === "PENDING" && o.youpiPaymentId) {
    await syncYoupiOrder(o);
    o = (await load(number))!;
  }

  // Cashfree order not marked paid yet: ask Cashfree directly (covers a late or missed webhook).
  if (o.paymentMethod === "CASHFREE" && o.status === "PENDING_PAYMENT" && o.paymentStatus === "PENDING" && o.cashfreeOrderId) {
    if ((await confirmCashfreeOrder(o, "order page")) === "paid") o = (await load(number))!;
  }

  const cfPayable = o.paymentMethod === "CASHFREE" && o.status === "PENDING_PAYMENT" && o.paymentStatus === "PENDING";
  const paid = o.status !== "PENDING_PAYMENT" && o.status !== "CANCELLED";
  const upiVerifying = o.paymentMethod === "UPI" && o.paymentStatus === "VERIFYING";
  const upiPayable = o.paymentMethod === "UPI" && o.status === "PENDING_PAYMENT" && o.paymentStatus === "PENDING";
  const title = paid ? "Thank you" : upiVerifying ? "Confirming payment" : o.status === "CANCELLED" ? "Order cancelled" : "Payment pending";
  const text = paid
    ? `Your order is confirmed. We have emailed the details to ${o.email} and will send tracking as soon as it ships.`
    : upiVerifying
      ? `Thank you. We have your UPI payment details${o.upiUtr ? ` (UTR ${o.upiUtr})` : ""} and are confirming them with our bank. This usually takes a few hours on working days. We will email ${o.email} as soon as it is confirmed. Your belt is reserved meanwhile.`
      : o.status === "CANCELLED" ? "This order was cancelled. If you were charged, the amount will be refunded." : "We have not received payment for this order yet.";

  return (
    <div className="wrap" style={{ paddingBottom: 80 }}>
      <header className="page-head">
        <div className="eyebrow mono">Order {o.number}</div>
        <h1 className="display">{title}</h1>
        <p>{text}</p>
      </header>
      {cfPayable && (
        <section className="panel" style={{ marginBottom: 24, display: "grid", gap: 12, maxWidth: 560 }}>
          {pay === "failed" && <div className="alert bad" role="alert">The payment did not go through. No money was taken for this attempt. You can try again below.</div>}
          {pay === "pending" && <div className="alert info" role="status">The payment is not complete yet. If money left your account, this page will update within a few minutes, so do not pay twice.</div>}
          <p style={{ margin: 0 }}>Pay <b>{inr(o.total)}</b> by UPI, card, netbanking or wallet. Your belt is reserved for a short while.</p>
          <PayAgain number={o.number} token={orderToken(o.number)} label={`Pay ${inr(o.total)}`} />
        </section>
      )}
      {upiPayable && (
        <section className="panel" style={{ marginBottom: 24, display: "grid", gap: 12, maxWidth: 560 }}>
          {upi === "retry" && <div className="alert bad" role="alert">The UPI payment page did not open. Please try again in a minute.</div>}
          {upi === "busy" && <div className="alert bad" role="alert">Too many attempts. Wait a few minutes and try again.</div>}
          <p style={{ margin: 0 }}>Pay <b>{inr(o.total)}</b> with any UPI app (GPay, PhonePe, Paytm, BHIM). Your belt is reserved for a short while.</p>
          <form action={`/order/${o.number}/pay`} method="post">
            <input type="hidden" name="t" value={orderToken(o.number)} />
            <button className="btn solid" type="submit" style={{ minHeight: 52 }}>Pay {inr(o.total)} by UPI</button>
          </form>
          <p className="muted" style={{ margin: 0, fontSize: ".84rem" }}>Already paid? Your payment will show here once it is confirmed. Do not pay twice.</p>
        </section>
      )}
      <OrderView o={o} invoiceHref={t ? `/order/${o.number}/invoice?t=${t}` : `/account/orders/${o.number}/invoice`} />
      <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
        <Link className="btn solid" href="/shop">Continue shopping</Link>
        <Link className="btn" href={`/track?order=${o.number}&email=${encodeURIComponent(o.email)}`}>Track this order</Link>
        {!customer && <Link className="btn" href={`/account/register?email=${encodeURIComponent(o.email)}`}>Create an account</Link>}
      </div>
    </div>
  );
}
