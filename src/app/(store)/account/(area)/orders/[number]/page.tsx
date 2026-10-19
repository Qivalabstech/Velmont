import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, orders } from "@/db";
import { requireCustomer } from "@/lib/auth";
import { OrderView } from "@/components/store/OrderView";

export default async function AccountOrder({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const c = await requireCustomer(`/account/orders/${number}`);
  const o = await db.query.orders.findFirst({
    where: and(eq(orders.number, number), eq(orders.userId, c.id)),
    with: { items: true, events: { orderBy: (e, { asc }) => [asc(e.createdAt)] } },
  });
  if (!o) notFound();
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Link href="/account" className="muted">← All orders</Link>
      <OrderView o={o} invoiceHref={`/account/orders/${o.number}/invoice`} />
      <p className="muted" style={{ fontSize: ".9rem" }}>Need help with this order? <Link href={`/contact?order=${o.number}`}>Contact us</Link> with the order number.</p>
    </div>
  );
}
