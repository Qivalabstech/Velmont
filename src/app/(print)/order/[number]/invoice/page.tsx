import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, orders } from "@/db";
import { checkOrderToken } from "@/lib/order-token";
import { getSettings } from "@/lib/settings";
import { InvoiceDoc } from "@/components/InvoiceDoc";

export const metadata = { title: "Invoice", robots: { index: false } };

export default async function GuestInvoice({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string }> }) {
  const { number } = await params;
  if (!checkOrderToken(number, (await searchParams).t)) notFound();
  const o = await db.query.orders.findFirst({ where: eq(orders.number, number), with: { items: true } });
  if (!o || o.status === "PENDING_PAYMENT") notFound();
  return <InvoiceDoc o={o} s={await getSettings()} />;
}
