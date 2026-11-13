"use server";
import { eq } from "drizzle-orm";
import { db, orders } from "@/db";
import { checkOrderToken } from "@/lib/order-token";
import { getCustomer, clientIp } from "@/lib/auth";
import { startCashfreePayment, type CfStart } from "@/lib/cashfree-orders";
import { startPayuPayment, type PayuStart } from "@/lib/payu-orders";
import { rateLimit } from "@/lib/rate-limit";

/** "Pay now" on an unpaid online order: opens a new attempt at the order's gateway (PayU or Cashfree). */
export async function resumeOnline(number: string, t: string): Promise<CfStart | PayuStart> {
  if (!(await rateLimit(`cf-pay:${await clientIp()}`, 10, 600_000)).ok) return { ok: false, error: "Too many attempts. Wait a few minutes and try again." };
  const o = await db.query.orders.findFirst({ where: eq(orders.number, number) });
  const customer = await getCustomer();
  if (!o || !(checkOrderToken(number, t) || (customer && o.userId === customer.id))) return { ok: false, error: "Order not found." };
  return o.paymentMethod === "PAYU" ? startPayuPayment(o) : startCashfreePayment(o);
}
