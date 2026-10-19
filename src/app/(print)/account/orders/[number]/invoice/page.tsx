import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, orders } from "@/db";
import { requireCustomer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { InvoiceDoc } from "@/components/InvoiceDoc";

export const metadata = { title: "Invoice", robots: { index: false } };

export default async function AccountInvoice({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const c = await requireCustomer(`/account/orders/${number}/invoice`);
  const o = await db.query.orders.findFirst({ where: and(eq(orders.number, number), eq(orders.userId, c.id)), with: { items: true } });
  if (!o || o.status === "PENDING_PAYMENT") notFound();
  return <InvoiceDoc o={o} s={await getSettings()} />;
}
