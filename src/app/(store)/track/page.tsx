import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db, orders } from "@/db";
import { OrderView } from "@/components/store/OrderView";
import { orderToken } from "@/lib/order-token";
import { clientIp } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { normPhone } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Track your VELMONT order",
  description: "Check where your VELMONT belt is: enter your order number and the email or mobile number you used to see status and courier tracking.",
  alternates: { canonical: "/track" },
};

export default async function Track({ searchParams }: { searchParams: Promise<{ order?: string; email?: string }> }) {
  const sp = await searchParams;
  const number = (sp.order || "").trim().toUpperCase();
  const contact = (sp.email || "").trim().toLowerCase();
  let error: string | null = null;
  let o = null;
  if (number && contact) {
    const ip = await clientIp();
    if (!rateLimit(`track:${ip}`, 20, 600_000).ok) error = "Too many lookups. Try again in a few minutes.";
    else {
      const byEmail = contact.includes("@");
      o = await db.query.orders.findFirst({
        where: and(eq(orders.number, number.startsWith("VM-") ? number : `VM-${number}`), byEmail ? eq(orders.email, contact) : eq(orders.phone, normPhone(contact))),
        with: { items: true, events: { orderBy: (e, { asc }) => [asc(e.createdAt)] } },
      });
      if (!o) error = "We could not find an order with those details. Check the order number in your confirmation email.";
    }
  }
  return (
    <div className="wrap" style={{ paddingBottom: 80 }}>
      <header className="page-head">
        <div className="eyebrow mono">Order status</div>
        <h1 className="display">Track your order</h1>
        <p>Enter the order number from your confirmation email, like VM-10001, and the email or mobile number you ordered with.</p>
      </header>
      <form className="panel" method="get" style={{ display: "grid", gap: 14, marginBottom: 24 }}>
        <div className="form-grid">
          <div className="field"><label htmlFor="t-order">Order number</label><input id="t-order" name="order" className="input" defaultValue={number} placeholder="VM-10001" required /></div>
          <div className="field"><label htmlFor="t-email">Email or mobile</label><input id="t-email" name="email" className="input" defaultValue={sp.email || ""} required /></div>
        </div>
        {error && <div className="alert bad" role="alert">{error}</div>}
        <div><button className="btn solid">Find my order</button></div>
      </form>
      {o && <OrderView o={o} invoiceHref={`/order/${o.number}/invoice?t=${orderToken(o.number)}`} />}
    </div>
  );
}
