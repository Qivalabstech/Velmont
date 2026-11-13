import "server-only";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import {
  db, orders, orderItems, orderEvents, variants, coupons, cartItems, refunds,
  type OrderStatus, type ShippingAddress, type PaymentMethod,
} from "@/db";
import type { CartLine, Totals } from "./cart";
import { getSettings } from "./settings";
import { mailNewOrderAlert, mailOrderPlaced, mailOrderStatus } from "./email";
import { STATUS_LABEL } from "./order-status";
import { refundRazorpayPayment } from "./razorpay";
import { refundCashfree } from "./cashfree";
import { refundPayu } from "./payu";
import { logError } from "./audit";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class StockError extends Error {}

async function nextOrderNumber(tx: Tx) {
  const r = await tx.execute(sql`select nextval('order_number_seq') as n`);
  return `VM-${(r.rows[0] as { n: string }).n}`;
}

export async function createOrder(input: {
  lines: CartLine[]; totals: Totals; method: PaymentMethod; email: string; phone: string;
  address: ShippingAddress; note: string; userId: string | null;
}) {
  const { lines, totals, method } = input;
  return db.transaction(async (tx) => {
    // Lock the variants so two shoppers cannot buy the last unit at the same time.
    const ids = lines.map((l) => l.variantId);
    const locked = await tx.select().from(variants).where(inArray(variants.id, ids)).for("update");
    for (const l of lines) {
      const v = locked.find((x) => x.id === l.variantId);
      if (!v || !v.active || v.stock < l.qty)
        throw new StockError(`${l.name} in size ${l.size} has only ${v?.stock ?? 0} left. Update your bag and try again.`);
    }
    for (const l of lines)
      await tx.update(variants).set({ stock: sql`${variants.stock} - ${l.qty}` }).where(eq(variants.id, l.variantId));

    const number = await nextOrderNumber(tx);
    const isCod = method === "COD";
    const now = new Date();
    const [order] = await tx.insert(orders).values({
      number, userId: input.userId, email: input.email.toLowerCase(), phone: input.phone,
      status: isCod ? "PLACED" : "PENDING_PAYMENT",
      paymentStatus: isCod ? "COD_PENDING" : "PENDING",
      paymentMethod: method,
      subtotal: totals.subtotal, discount: totals.discount, shipping: totals.shipping, codFee: totals.codFee,
      tax: totals.tax, total: totals.total, couponCode: totals.couponCode,
      shippingAddress: input.address, customerNote: input.note.slice(0, 500),
      placedAt: isCod ? now : null,
    }).returning();

    await tx.insert(orderItems).values(lines.map((l) => ({
      orderId: order.id, productId: l.productId, variantId: l.variantId, name: l.name, slug: l.slug,
      size: l.size, sku: l.sku, image: l.image, unitPrice: l.price, qty: l.qty, total: l.price * l.qty,
      hsn: l.hsn, gstRate: l.gstRate,
    })));
    await tx.insert(orderEvents).values({
      orderId: order.id, status: order.status,
      message: isCod ? "Order placed with cash on delivery." : method === "UPI" ? "Order created. Waiting for UPI payment." : "Order created. Waiting for online payment.",
      visibleToCustomer: isCod,
    });
    if (totals.couponCode)
      await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1` }).where(eq(coupons.code, totals.couponCode));
    return order;
  });
}

export async function getOrderFull(id: string) {
  return db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: { items: true, events: { orderBy: (e, { asc }) => [asc(e.createdAt)] }, refunds: true },
  });
}

export async function sendPlacedEmails(orderId: string) {
  const o = await getOrderFull(orderId);
  if (!o) return;
  try {
    await mailOrderPlaced(o);
    await mailNewOrderAlert(o);
  } catch (e) { await logError("email", e); }
  // Hand the order to Shiprocket (runs after the response; no-op when Shiprocket is off).
  try {
    const { onOrderPlacedShipping } = await import("./shiprocket-orders");
    await onOrderPlacedShipping(orderId);
  } catch (e) { await logError("shiprocket", e); }
}

export async function clearCart(cartId: string) {
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
}

type OrderRow = typeof orders.$inferSelect;

/** Moves a locked, unpaid order to paid + placed. Returns null when it was already paid. */
async function settle(
  find: (tx: Tx) => Promise<OrderRow | undefined>,
  patch: Partial<typeof orders.$inferInsert>,
  actorName: string,
) {
  const changed = await db.transaction(async (tx) => {
    const o = await find(tx);
    if (!o) throw new Error("Order not found for this payment.");
    if (o.paymentStatus === "PAID" || o.paymentStatus === "REFUNDED" || o.paymentStatus === "PARTIALLY_REFUNDED") return null;

    // Payment arrived after the hold expired: take the stock again (may go negative; staff will see it).
    if (o.stockReleased) {
      const its = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
      for (const i of its) if (i.variantId)
        await tx.update(variants).set({ stock: sql`${variants.stock} - ${i.qty}` }).where(eq(variants.id, i.variantId));
      if (o.couponCode)
        await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1` }).where(eq(coupons.code, o.couponCode));
    }
    const now = new Date();
    await tx.update(orders).set({
      ...patch, paymentStatus: "PAID", status: "PLACED", paidAt: now, placedAt: o.placedAt ?? now,
      stockReleased: false, cancelledAt: null,
    }).where(eq(orders.id, o.id));
    await tx.insert(orderEvents).values({ orderId: o.id, status: "PLACED", message: "Payment received. Order placed.", actorName });
    if (o.stockReleased)
      await tx.insert(orderEvents).values({
        orderId: o.id, message: "Payment came in after the stock hold expired. Check stock before packing.",
        visibleToCustomer: false,
      });
    return o.id;
  });
  if (changed) await sendPlacedEmails(changed);
  return changed;
}

/** Marks a Razorpay order as paid. Safe to call twice (browser callback and webhook). */
export async function markPaid(razorpayOrderId: string, paymentId: string, source: string) {
  return settle(
    async (tx) => (await tx.select().from(orders).where(eq(orders.razorpayOrderId, razorpayOrderId)).for("update"))[0],
    { razorpayPaymentId: paymentId }, `Razorpay (${source})`,
  );
}

/** Marks a Cashfree order as paid after the order status was confirmed with Cashfree's API. Safe to call twice. */
export async function markCashfreePaid(orderId: string, cfPaymentId: string | null, source: string) {
  return settle(
    async (tx) => {
      const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
      if (o && o.paymentMethod !== "CASHFREE") throw new Error("This order was not paid through Cashfree.");
      return o;
    },
    cfPaymentId ? { cashfreePaymentId: cfPaymentId } : {}, `Cashfree (${source})`,
  );
}

/** Marks a PayU order as paid after verify_payment confirmed it. Safe to call twice (return page and webhook). */
export async function markPayuPaid(orderId: string, mihpayid: string | null, txnid: string, source: string) {
  return settle(
    async (tx) => {
      const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
      if (o && o.paymentMethod !== "PAYU") throw new Error("This order was not paid through PayU.");
      return o;
    },
    { payuTxnId: txnid, ...(mihpayid ? { payuPaymentId: mihpayid } : {}) }, `PayU (${source})`,
  );
}

/** Marks a direct-UPI (YouPI) order as paid, by staff after checking the bank or by a reconciled statement. */
export async function markUpiPaid(orderId: string, input: { utr?: string | null; youpiPaymentId?: string | null; actorName: string }) {
  return settle(
    async (tx) => {
      const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
      if (o && o.paymentMethod !== "UPI") throw new Error("This order was not paid by direct UPI.");
      return o;
    },
    {
      ...(input.utr ? { upiUtr: input.utr } : {}),
      ...(input.youpiPaymentId ? { youpiPaymentId: input.youpiPaymentId } : {}),
    },
    input.actorName,
  );
}

/**
 * A UPI payment is claimed (customer entered a UTR) or seen in a bank alert, but not yet confirmed.
 * Keeps the stock held and flags the order for staff. Returns true the first time.
 */
export async function markUpiVerifying(orderId: string, input: { utr?: string | null; youpiPaymentId?: string | null; message: string; actorName: string }) {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!o || o.paymentMethod !== "UPI") return false;
    if (o.paymentStatus !== "PENDING" && o.paymentStatus !== "FAILED" && o.paymentStatus !== "VERIFYING") return false;
    const first = o.paymentStatus !== "VERIFYING";
    const sameUtr = !input.utr || input.utr === o.upiUtr;
    if (!first && sameUtr) return false;
    await tx.update(orders).set({
      paymentStatus: "VERIFYING",
      ...(input.utr ? { upiUtr: input.utr } : {}),
      ...(input.youpiPaymentId ? { youpiPaymentId: input.youpiPaymentId } : {}),
    }).where(eq(orders.id, o.id));
    await tx.insert(orderEvents).values({ orderId: o.id, message: input.message, actorName: input.actorName, visibleToCustomer: false });
    if (first)
      await tx.insert(orderEvents).values({
        orderId: o.id, message: "We have your UPI payment details and are confirming them with the bank.", actorName: "System",
      });
    return true;
  });
}

/** Staff checked the bank and the UPI money is not there. Cancels the order and frees the stock. */
export async function rejectUpiPayment(orderId: string, input: { reason: string; actorName: string; notify: boolean }) {
  const o = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!o || o.paymentMethod !== "UPI") throw new Error("This order was not paid by direct UPI.");
  if (o.paymentStatus === "PAID" || o.paymentStatus === "REFUNDED" || o.paymentStatus === "PARTIALLY_REFUNDED")
    throw new Error("This order is already marked paid. Use a refund instead.");
  const msg = `UPI payment not received${input.reason ? `: ${input.reason}` : "."}`;
  if (o.status === "PENDING_PAYMENT") {
    await updateOrderStatus({ orderId, status: "CANCELLED", actorName: input.actorName, note: msg, notify: input.notify, restockOnCancel: true });
  } else {
    await db.insert(orderEvents).values({ orderId, message: msg, actorName: input.actorName, visibleToCustomer: false });
  }
  await db.update(orders).set({ paymentStatus: "FAILED" }).where(eq(orders.id, orderId));
}

/** Logs a note against an order without changing it (e.g. a UPI attempt expired). */
export async function addOrderEvent(orderId: string, message: string, actorName: string) {
  await db.insert(orderEvents).values({ orderId, message: message.slice(0, 500), actorName, visibleToCustomer: false });
}

export async function markPaymentFailed(razorpayOrderId: string, reason: string) {
  const o = await db.query.orders.findFirst({ where: eq(orders.razorpayOrderId, razorpayOrderId) });
  if (!o || o.paymentStatus !== "PENDING") return;
  await db.insert(orderEvents).values({
    orderId: o.id, message: `Payment attempt failed: ${reason}`.slice(0, 300), visibleToCustomer: false, actorName: "Razorpay",
  });
}

async function restock(tx: Tx, orderId: string) {
  const its = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const i of its) if (i.variantId)
    await tx.update(variants).set({ stock: sql`${variants.stock} + ${i.qty}` }).where(eq(variants.id, i.variantId));
}

/** Cancels online orders that were never paid and puts their stock back. Runs every few minutes. */
export async function releaseExpiredOrders() {
  const s = await getSettings();
  const cutoff = new Date(Date.now() - s.payments.pendingPaymentMinutes * 60_000);
  const stale = await db.select({ id: orders.id, couponCode: orders.couponCode }).from(orders).where(and(
    eq(orders.status, "PENDING_PAYMENT"), eq(orders.paymentStatus, "PENDING"), eq(orders.stockReleased, false), lt(orders.createdAt, cutoff),
  ));
  for (const o of stale) {
    await db.transaction(async (tx) => {
      await restock(tx, o.id);
      await tx.update(orders).set({
        status: "CANCELLED", paymentStatus: "FAILED", stockReleased: true, cancelledAt: new Date(),
      }).where(eq(orders.id, o.id));
      if (o.couponCode)
        await tx.update(coupons).set({ usedCount: sql`greatest(${coupons.usedCount} - 1, 0)` }).where(eq(coupons.code, o.couponCode));
      await tx.insert(orderEvents).values({
        orderId: o.id, status: "CANCELLED", message: "Payment was not completed in time. Stock released.", visibleToCustomer: false,
      });
    });
  }
  return stale.length;
}

const STAMP: Partial<Record<OrderStatus, "shippedAt" | "deliveredAt" | "cancelledAt">> = {
  SHIPPED: "shippedAt", DELIVERED: "deliveredAt", CANCELLED: "cancelledAt",
};

export async function updateOrderStatus(input: {
  orderId: string; status: OrderStatus; actorName: string; note?: string; notify: boolean;
  courier?: string; awb?: string; trackingUrl?: string; restockOnCancel?: boolean;
}) {
  const o = await db.query.orders.findFirst({ where: eq(orders.id, input.orderId) });
  if (!o) throw new Error("Order not found.");
  await db.transaction(async (tx) => {
    const patch: Partial<typeof orders.$inferInsert> = { status: input.status };
    const stamp = STAMP[input.status];
    if (stamp) patch[stamp] = new Date();
    if (input.courier !== undefined) patch.courier = input.courier || null;
    if (input.awb !== undefined) patch.awb = input.awb || null;
    if (input.trackingUrl !== undefined) patch.trackingUrl = input.trackingUrl || null;
    if (input.status === "DELIVERED" && o.paymentMethod === "COD" && o.paymentStatus === "COD_PENDING")
      patch.paymentStatus = "COD_COLLECTED";
    if (input.status === "CANCELLED" && input.restockOnCancel !== false && !o.stockReleased) {
      await restock(tx, o.id);
      patch.stockReleased = true;
      if (o.couponCode)
        await tx.update(coupons).set({ usedCount: sql`greatest(${coupons.usedCount} - 1, 0)` }).where(eq(coupons.code, o.couponCode));
    }
    if (input.status === "RETURNED" && !o.stockReleased) { await restock(tx, o.id); patch.stockReleased = true; }
    await tx.update(orders).set(patch).where(eq(orders.id, o.id));
    await tx.insert(orderEvents).values({
      orderId: o.id, status: input.status,
      message: input.note?.trim() || `${STATUS_LABEL[input.status]}.` + (input.awb ? ` ${input.courier || "Courier"} tracking ${input.awb}.` : ""),
      actorName: input.actorName,
    });
  });
  if (input.notify) {
    const full = await getOrderFull(o.id);
    if (full) await mailOrderStatus(full, input.note).catch((e) => logError("email", e));
  }
  if (input.status === "CANCELLED" && o.shiprocketOrderId && !["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(o.status)) {
    const { cancelInShiprocket } = await import("./shiprocket-orders");
    await cancelInShiprocket(o, input.actorName);
  }
}

export async function refundOrder(input: { orderId: string; amount: number; reason: string; actorName: string; viaGateway: boolean }) {
  const o = await db.query.orders.findFirst({ where: eq(orders.id, input.orderId) });
  if (!o) throw new Error("Order not found.");
  const refundable = o.total - o.refunded;
  if (input.amount <= 0 || input.amount > refundable) throw new Error(`You can refund up to ₹${refundable / 100}.`);
  let gatewayId: string | null = null;
  let gatewayNote = "sent to the original payment method";
  if (input.viaGateway) {
    if (o.paymentMethod === "PAYU" && o.payuPaymentId) {
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(refunds).where(eq(refunds.orderId, o.id));
      const r = await refundPayu(o.payuPaymentId, input.amount, `${o.number.replace(/[^A-Za-z0-9]/g, "")}R${n + 1}${Date.now().toString(36)}`);
      gatewayId = `payu:${r.requestId}`;
      gatewayNote = "started at PayU; the bank usually takes 5–7 working days";
    } else if (o.paymentMethod === "CASHFREE" && o.cashfreeOrderId) {
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(refunds).where(eq(refunds.orderId, o.id));
      const refundId = `${o.number.replace(/[^A-Za-z0-9]/g, "")}R${n + 1}`;
      const r = await refundCashfree(o.cashfreeOrderId, input.amount, refundId, input.reason);
      gatewayId = `cf:${r.cf_refund_id ?? refundId}`;
      if (r.refund_status && r.refund_status !== "SUCCESS") gatewayNote = `started at Cashfree (${r.refund_status.toLowerCase().replace(/_/g, " ")}); the bank usually takes 5–7 working days`;
    } else if (o.paymentMethod === "RAZORPAY" && o.razorpayPaymentId) {
      if (o.razorpayPaymentId.startsWith("mock_")) gatewayId = "mock_refund";
      else gatewayId = (await refundRazorpayPayment(o.razorpayPaymentId, input.amount, input.reason)).id;
    } else throw new Error("This order was not paid through a gateway, so refund it manually and record it.");
  }
  const refundedTotal = o.refunded + input.amount;
  await db.transaction(async (tx) => {
    await tx.insert(refunds).values({
      orderId: o.id, amount: input.amount, reason: input.reason, razorpayRefundId: gatewayId,
      actorName: input.actorName, status: gatewayId ? "processed" : "manual",
    });
    await tx.update(orders).set({
      refunded: refundedTotal, paymentStatus: refundedTotal >= o.total ? "REFUNDED" : "PARTIALLY_REFUNDED",
    }).where(eq(orders.id, o.id));
    await tx.insert(orderEvents).values({
      orderId: o.id, actorName: input.actorName,
      message: `Refund of ₹${(input.amount / 100).toLocaleString("en-IN")} ${gatewayId ? gatewayNote : "recorded"}. ${input.reason}`.trim(),
    });
  });
}
