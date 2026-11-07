import "server-only";
import { eq } from "drizzle-orm";
import { db, orders } from "@/db";
import { addOrderEvent, getOrderFull, markUpiPaid, markUpiVerifying } from "./orders";
import { youpiConfig, getYoupiPayment, type YoupiEvent } from "./youpi";
import { mailUpiToVerify } from "./email";
import { inr } from "./money";
import { logError } from "./audit";

export type Outcome = {
  event: YoupiEvent; paymentId: string; orderNumber: string; amountPaise: number; currency: string;
  method?: string; settlementState?: string; utr?: string;
};

const UTR = /^[A-Za-z0-9]{6,35}$/;

/**
 * Applies a YouPI payment outcome to the matching order. Used by the webhook and by the status check
 * when a customer returns from the gateway. Safe to call more than once for the same outcome.
 */
export async function applyYoupiOutcome(x: Outcome, source: "webhook" | "status check"): Promise<{ ok: boolean; note: string }> {
  const o = await db.query.orders.findFirst({ where: eq(orders.number, x.orderNumber) });
  if (!o) return { ok: false, note: "No order with that number." };
  if (o.paymentMethod !== "UPI") return { ok: false, note: "Order is not a UPI order." };
  if (x.currency.toUpperCase() !== "INR" || x.amountPaise !== o.total) {
    await addOrderEvent(o.id, `UPI gateway reported ${x.event} for ${inr(x.amountPaise)}, but the order total is ${inr(o.total)}. Ignored. Check the bank before shipping.`, `YouPI (${source})`);
    return { ok: false, note: "Amount does not match the order." };
  }
  const utr = x.utr && UTR.test(x.utr) ? x.utr : null;
  const cfg = await youpiConfig();
  const actor = `YouPI (${source})`;

  switch (x.event) {
    case "RECONCILED": {
      if (x.settlementState && x.settlementState !== "RECONCILED") return { ok: false, note: "Not reconciled." };
      const done = await markUpiPaid(o.id, { utr, youpiPaymentId: x.paymentId, actorName: `${actor}: matched bank statement` });
      return { ok: true, note: done ? "Marked paid." : "Already paid." };
    }
    case "OBSERVED_SUCCESS": {
      if (cfg.trustBankAlerts) {
        const done = await markUpiPaid(o.id, { utr, youpiPaymentId: x.paymentId, actorName: `${actor}: bank alert` });
        return { ok: true, note: done ? "Marked paid on bank alert (auto-confirm is on)." : "Already paid." };
      }
      const changed = await markUpiVerifying(o.id, {
        utr, youpiPaymentId: x.paymentId, actorName: actor,
        message: `Bank alert matched ${inr(x.amountPaise)}${utr ? ` with UTR ${utr}` : ""}. Check your bank app, then press “Payment received”.`,
      });
      if (changed) await alertStaff(o.id);
      return { ok: true, note: "Flagged for staff to verify." };
    }
    case "MANUAL_REVIEW": {
      const changed = await markUpiVerifying(o.id, {
        utr, youpiPaymentId: x.paymentId, actorName: actor,
        message: utr
          ? `Customer says they paid ${inr(x.amountPaise)}. UTR ${utr}. Find this UTR in your bank app, then press “Payment received”.`
          : `The gateway could not match this payment on its own. Check your bank app for ${inr(x.amountPaise)}.`,
      });
      if (changed) await alertStaff(o.id);
      return { ok: true, note: "Flagged for staff to verify." };
    }
    case "FAILED": case "EXPIRED": case "CANCELLED": {
      if (o.paymentStatus === "PENDING" && source === "webhook") {
        const what = { FAILED: "was not confirmed in time", EXPIRED: "timed out", CANCELLED: "was cancelled by the customer" }[x.event];
        await addOrderEvent(o.id, `UPI payment attempt ${what}. The customer can try again from their order page.`, actor);
      }
      return { ok: true, note: "Logged." };
    }
    default:
      return { ok: true, note: "Nothing to do." };
  }
}

async function alertStaff(orderId: string) {
  const full = await getOrderFull(orderId);
  if (full) await mailUpiToVerify(full).catch((e) => logError("email", e));
}

/** When a customer lands back on their order page, ask the gateway in case its webhook has not arrived yet. */
export async function syncYoupiOrder(o: { number: string; paymentMethod: string; paymentStatus: string; youpiPaymentId: string | null }) {
  if (o.paymentMethod !== "UPI" || !o.youpiPaymentId || o.paymentStatus !== "PENDING") return;
  try {
    const p = await getYoupiPayment(o.youpiPaymentId);
    if (!p || p.orderId !== o.number) return;
    if (!["RECONCILED", "OBSERVED_SUCCESS", "MANUAL_REVIEW"].includes(p.status)) return;
    await applyYoupiOutcome({
      event: p.status, paymentId: p.paymentId, orderNumber: o.number, amountPaise: p.amountPaise,
      currency: p.currency, method: p.method, settlementState: p.settlementState,
    }, "status check");
  } catch (e) {
    await logError("youpi.sync", e, `/order/${o.number}`);
  }
}
