import "server-only";
import { eq } from "drizzle-orm";
import { db, orders } from "@/db";
import { addOrderEvent } from "./orders";
import { createYoupiPayment, YoupiError } from "./youpi";
import { orderToken } from "./order-token";
import { SITE_URL } from "./env";
import { logError } from "./audit";

/** Opens (or reopens) the UPI payment page for an unpaid UPI order. */
export async function startUpiPayment(orderId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const o = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!o || o.paymentMethod !== "UPI") return { ok: false, error: "This order does not use UPI." };
  if (o.status !== "PENDING_PAYMENT" || o.paymentStatus !== "PENDING")
    return { ok: false, error: o.paymentStatus === "VERIFYING" ? "We already have your payment details and are confirming them." : "This order can no longer be paid." };
  try {
    const r = await createYoupiPayment({
      number: o.number, total: o.total, email: o.email, phone: o.phone, name: o.shippingAddress.name,
      youpiMethod: o.youpiMethod, returnUrl: `${SITE_URL}/order/${o.number}?t=${orderToken(o.number)}`,
    });
    if (r.paymentId !== o.youpiPaymentId || r.method !== o.youpiMethod) {
      await db.update(orders).set({ youpiPaymentId: r.paymentId, youpiMethod: r.method }).where(eq(orders.id, o.id));
      await addOrderEvent(o.id, `UPI payment page opened (${r.method === "MANUAL_UPI" ? "customer enters UTR" : "bank alerts"}). Gateway payment ${r.paymentId}.`, "YouPI");
    }
    return { ok: true, url: r.checkoutUrl };
  } catch (e) {
    await logError("youpi.create", e, `/order/${o.number}`);
    return { ok: false, error: e instanceof YoupiError && e.code ? e.message : "The UPI payment page did not open. Try again in a minute." };
  }
}
