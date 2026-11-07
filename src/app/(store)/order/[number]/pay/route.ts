// Reopens the UPI payment page for an unpaid UPI order (the "Pay by UPI" button on the order page).
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, orders } from "@/db";
import { checkOrderToken, orderToken } from "@/lib/order-token";
import { getCustomer, clientIp } from "@/lib/auth";
import { startUpiPayment } from "@/lib/youpi-start";
import { rateLimit } from "@/lib/rate-limit";
import { SITE_URL } from "@/lib/env";

export async function POST(req: Request, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const fd = await req.formData();
  const t = String(fd.get("t") || "");
  const o = await db.query.orders.findFirst({ where: eq(orders.number, number) });
  const customer = await getCustomer();
  if (!o || !(checkOrderToken(number, t) || (customer && o.userId === customer.id)))
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const back = `${SITE_URL}/order/${o.number}?t=${orderToken(o.number)}`;
  if (!rateLimit(`upi-pay:${await clientIp()}`, 10, 600_000).ok)
    return NextResponse.redirect(`${back}&upi=busy`, 303);
  const r = await startUpiPayment(o.id);
  return NextResponse.redirect(r.ok ? r.url : `${back}&upi=retry`, 303);
}
