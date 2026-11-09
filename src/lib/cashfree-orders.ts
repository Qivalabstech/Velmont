import "server-only";
import { eq } from "drizzle-orm";
import { db, orders } from "@/db";
import { addOrderEvent, markCashfreePaid } from "./orders";
import {
  CashfreeError, cashfreeMode, createCashfreeOrder, getCashfreeOrder, getCashfreePayments, type CfOrder,
} from "./cashfree";
import { orderToken } from "./order-token";
import { getSettings } from "./settings";
import { SITE_URL } from "./env";
import { inr } from "./money";
import { logError } from "./audit";

type OrderRow = typeof orders.$inferSelect;
export type CfStart = { ok: true; sessionId: string; mode: "production" | "sandbox" } | { ok: true; paid: true } | { ok: false; error: string };

const returnUrl = (number: string) =>
  `${SITE_URL}/api/payments/cashfree/return?o=${encodeURIComponent(number)}&t=${orderToken(number)}`;
// Cashfree only calls https notify URLs; on a local http dev server the return page and the status check cover it.
const notifyUrl = () => (SITE_URL.startsWith("https://") ? `${SITE_URL}/api/payments/cashfree/webhook` : null);

/** Creates (or reuses) the Cashfree order for a store order and returns the checkout session id. */
export async function startCashfreePayment(o: OrderRow): Promise<CfStart> {
  if (o.paymentMethod !== "CASHFREE") return { ok: false, error: "This order is not an online order." };
  if (o.paymentStatus === "PAID") return { ok: true, paid: true };
  if (o.status !== "PENDING_PAYMENT" || o.paymentStatus !== "PENDING") return { ok: false, error: "This order can no longer be paid. Please place a new order." };
  const mode = await cashfreeMode();
  if (mode === "off") return { ok: false, error: "Online payment is not available right now." };

  try {
    let cfId = o.cashfreeOrderId;
    if (cfId) {
      const existing = await getCashfreeOrder(cfId);
      if (existing.order_status === "PAID") {
        await confirmCashfreeOrder(o, "checkout");
        return { ok: true, paid: true };
      }
      if (existing.order_status === "ACTIVE" && existing.payment_session_id) return { ok: true, sessionId: existing.payment_session_id, mode };
      // Expired or terminated at Cashfree: open a fresh Cashfree order for the same store order.
      const n = Number(cfId.match(/-R(\d+)$/)?.[1] || 1) + 1;
      cfId = `${o.number}-R${n}`;
    } else cfId = o.number;

    const s = await getSettings();
    const created = await createCashfreeOrder({
      cfOrderId: cfId, amount: o.total, email: o.email, phone: o.phone, name: o.shippingAddress.name, userId: o.userId,
      returnUrl: returnUrl(o.number), notifyUrl: notifyUrl(), expiresInMinutes: s.payments.pendingPaymentMinutes,
      note: `VELMONT order ${o.number}`,
    }).catch(async (e) => {
      if (e instanceof CashfreeError && e.status === 409) return getCashfreeOrder(cfId!); // created before; reuse it
      throw e;
    });
    if (Math.round(Number(created.order_amount) * 100) !== o.total) throw new Error(`Cashfree order ${cfId} has amount ${created.order_amount}, store order is ${o.total / 100}.`);
    if (!created.payment_session_id) throw new Error("Cashfree did not return a payment session.");
    await db.update(orders).set({ cashfreeOrderId: cfId }).where(eq(orders.id, o.id));
    return { ok: true, sessionId: created.payment_session_id, mode };
  } catch (e) {
    await logError("cashfree.create", e, `/order/${o.number}`);
    return { ok: false, error: "The payment gateway did not respond. Try again in a minute, or choose another way to pay." };
  }
}

/**
 * Asks Cashfree for the real order status and marks the store order paid only when Cashfree says PAID
 * for exactly the order total in INR. Used by the return page, the webhook and the order page.
 */
export async function confirmCashfreeOrder(o: OrderRow, source: string): Promise<"paid" | "pending" | "failed" | "mismatch"> {
  if (o.paymentMethod !== "CASHFREE" || !o.cashfreeOrderId) return "pending";
  if (o.paymentStatus === "PAID" || o.paymentStatus === "REFUNDED" || o.paymentStatus === "PARTIALLY_REFUNDED") return "paid";
  let cf: CfOrder;
  try { cf = await getCashfreeOrder(o.cashfreeOrderId); }
  catch (e) { await logError("cashfree.confirm", e, `/order/${o.number}`); return "pending"; }

  if (cf.order_status !== "PAID") {
    if (cf.order_status !== "ACTIVE") return "failed";
    // Still open: "pending" only if a payment is in flight (or succeeded but the order has not caught up yet).
    const pays = await getCashfreePayments(o.cashfreeOrderId).catch(() => null);
    if (!pays) return "pending";
    return pays.some((p) => p.payment_status === "PENDING" || p.payment_status === "SUCCESS") ? "pending" : "failed";
  }
  if (cf.order_currency !== "INR" || Math.round(Number(cf.order_amount) * 100) !== o.total) {
    await addOrderEvent(o.id, `Cashfree says order ${o.cashfreeOrderId} is paid for ${cf.order_currency} ${cf.order_amount}, but the order total is ${inr(o.total)}. Not marked paid. Check the Cashfree dashboard.`, `Cashfree (${source})`);
    return "mismatch";
  }
  let paymentId: string | null = null;
  try {
    const pays = await getCashfreePayments(o.cashfreeOrderId);
    const ok = pays.find((p) => p.payment_status === "SUCCESS");
    paymentId = ok ? String(ok.cf_payment_id) : null;
  } catch { /* the order status is what matters; the payment id is a convenience */ }
  await markCashfreePaid(o.id, paymentId, source);
  return "paid";
}

export async function findCashfreeOrder(cfOrderId: string) {
  return db.query.orders.findFirst({ where: eq(orders.cashfreeOrderId, cfOrderId) });
}
