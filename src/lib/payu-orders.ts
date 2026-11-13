import "server-only";
import { eq } from "drizzle-orm";
import { db, orders } from "@/db";
import { addOrderEvent, markPayuPaid } from "./orders";
import { payuCheckoutForm, payuMode, verifyPayu, type PayuForm } from "./payu";
import { SITE_URL } from "./env";
import { inr } from "./money";
import { logError } from "./audit";

type OrderRow = typeof orders.$inferSelect;
export type PayuStart = { ok: true; form: PayuForm } | { ok: true; paid: true } | { ok: false; error: string };

export const payuReturnUrl = () => `${SITE_URL}/api/payments/payu/return`;
/** txnid is the order number, then VM-10051-R2, -R3… for later attempts. */
export const orderNumberFromTxn = (txnid: string) => txnid.replace(/-R\d+$/, "");

/** Opens a PayU attempt for a store order: the form the browser posts to PayU's hosted checkout. */
export async function startPayuPayment(o: OrderRow): Promise<PayuStart> {
  if (o.paymentMethod !== "PAYU") return { ok: false, error: "This order is not an online order." };
  if (o.paymentStatus === "PAID") return { ok: true, paid: true };
  if (o.status !== "PENDING_PAYMENT" || o.paymentStatus !== "PENDING") return { ok: false, error: "This order can no longer be paid. Please place a new order." };
  if ((await payuMode()) === "off") return { ok: false, error: "Online payment is not available right now." };
  try {
    let txnid = o.number;
    if (o.payuTxnId) {
      const prev = await verifyPayu(o.payuTxnId);
      if (prev?.status === "success") {
        if ((await confirmPayuOrder(o, "checkout")) === "paid") return { ok: true, paid: true };
      }
      if (prev?.status === "pending") return { ok: false, error: "Your last payment is still being confirmed by the bank. Please check this page again in a few minutes before paying again." };
      txnid = `${o.number}-R${Number(o.payuTxnId.match(/-R(\d+)$/)?.[1] || 1) + 1}`;
    }
    const form = await payuCheckoutForm({
      txnid, amount: o.total, productinfo: `VELMONT order ${o.number}`, name: o.shippingAddress.name,
      email: o.email, phone: o.phone, udf1: o.number, returnUrl: payuReturnUrl(),
    });
    await db.update(orders).set({ payuTxnId: txnid }).where(eq(orders.id, o.id));
    return { ok: true, form };
  } catch (e) {
    await logError("payu.start", e, `/order/${o.number}`);
    return { ok: false, error: "The payment gateway did not respond. Try again in a minute, or choose another way to pay." };
  }
}

/**
 * Asks PayU (verify_payment) for the real status of an attempt and marks the order paid only when PayU says
 * "success" for exactly the order total. Used by the return page, the webhook and the order page.
 */
export async function confirmPayuOrder(o: OrderRow, source: string, txnid = o.payuTxnId): Promise<"paid" | "pending" | "failed" | "mismatch"> {
  if (o.paymentMethod !== "PAYU" || !txnid) return "pending";
  if (orderNumberFromTxn(txnid) !== o.number) return "failed";
  if (o.paymentStatus === "PAID" || o.paymentStatus === "REFUNDED" || o.paymentStatus === "PARTIALLY_REFUNDED") return "paid";
  let t;
  try { t = await verifyPayu(txnid); }
  catch (e) { await logError("payu.confirm", e, `/order/${o.number}`); return "pending"; }
  if (!t) return "failed";
  if (t.status === "pending" || t.status === "initiated" || t.status === "in progress") return "pending";
  if (t.status !== "success") return "failed";
  if (t.amount !== o.total) {
    await addOrderEvent(o.id, `PayU says ${txnid} is paid for ₹${(t.amount / 100).toFixed(2)}, but the order total is ${inr(o.total)}. Not marked paid. Check the PayU dashboard.`, `PayU (${source})`);
    return "mismatch";
  }
  await markPayuPaid(o.id, t.mihpayid || null, txnid, source);
  return "paid";
}

export async function findOrderForTxn(txnid: string) {
  if (!txnid) return undefined;
  return db.query.orders.findFirst({ where: eq(orders.number, orderNumberFromTxn(txnid)) });
}
