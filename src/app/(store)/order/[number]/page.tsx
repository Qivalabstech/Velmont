import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, orders } from "@/db";
import { checkOrderToken } from "@/lib/order-token";
import { getCustomer } from "@/lib/auth";
import { OrderView } from "@/components/store/OrderView";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false } };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string }> }) {
  const { number } = await params;
  const { t } = await searchParams;
  const o = await db.query.orders.findFirst({
    where: eq(orders.number, number),
    with: { items: true, events: { orderBy: (e, { asc }) => [asc(e.createdAt)] } },
  });
  if (!o) notFound();
  const customer = await getCustomer();
  if (!checkOrderToken(number, t) && !(customer && o.userId === customer.id)) notFound();
  const paid = o.status !== "PENDING_PAYMENT" && o.status !== "CANCELLED";
  return (
    <div className="wrap" style={{ paddingBottom: 80 }}>
      <header className="page-head">
        <div className="eyebrow mono">Order {o.number}</div>
        <h1 className="display">{paid ? "Thank you" : o.status === "CANCELLED" ? "Order cancelled" : "Payment pending"}</h1>
        <p>{paid
          ? `Your order is confirmed. We have emailed the details to ${o.email} and will send tracking as soon as it ships.`
          : o.status === "CANCELLED" ? "This order was cancelled. If you were charged, the amount will be refunded." : "We have not received payment for this order yet."}</p>
      </header>
      <OrderView o={o} invoiceHref={t ? `/order/${o.number}/invoice?t=${t}` : `/account/orders/${o.number}/invoice`} />
      <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
        <Link className="btn solid" href="/shop">Continue shopping</Link>
        <Link className="btn" href={`/track?order=${o.number}&email=${encodeURIComponent(o.email)}`}>Track this order</Link>
        {!customer && <Link className="btn" href={`/account/register?email=${encodeURIComponent(o.email)}`}>Create an account</Link>}
      </div>
    </div>
  );
}
