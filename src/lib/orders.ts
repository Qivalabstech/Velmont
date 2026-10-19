import "server-only";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import {
  db, orders, orderItems, orderEvents, variants, coupons, cartItems, refunds,
  type OrderStatus, type ShippingAddress,
} from "@/db";
import type { CartLine, Totals } from "./cart";
import { getSettings } from "./settings";
import { mailNewOrderAlert, mailOrderPlaced, mailOrderStatus } from "./email";
import { STATUS_LABEL } from "./order-status";
import { refundRazorpayPayment } from "./razorpay";
import { logError } from "./audit";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class StockError extends Error {}

async function nextOrderNumber(tx: Tx) {
  const r = await tx.execute(sql`select nextval('order_number_seq') as n`);
  return `VM-${(r.rows[0] as { n: string }).n}`;
}

export async function createOrder(input: {
  lines: CartLine[]; totals: Totals; method: "RAZORPAY" | "COD"; email: string; phone: string;
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
      message: isCod ? "Order placed with cash on delivery." : "Order created. Waiting for online payment.",
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
}

export async function clearCart(cartId: string) {
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
}

/** Marks an online order as paid. Safe to call twice (browser callback and webhook). */
export async function markPaid(razorpayOrderId: string, paymentId: string, source: string) {
  const changed = await db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.razorpayOrderId, razorpayOrderId)).for("update");
    if (!o) throw new Error("Order not found for this payment.");
    if (o.paymentStatus === "PAID" || o.paymentStatus === "REFUNDED" || o.paymentStatus === "PARTIALLY_REFUNDED") return null;

    // Payment arrived after the hold expired: take the stock again (may go negative; staff will see it).
    if (o.stockReleased) {
      const its = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
      for (const i of its) if (i.variantId)
        await tx.update(variants).set({ stock: sql`${variants.stock} - ${i.qty}` }).where(eq(variants.id, i.variantId));
    }
    const now = new Date();
    await tx.update(orders).set({
      paymentStatus: "PAID", status: "PLACED", razorpayPaymentId: paymentId, paidAt: now, placedAt: o.placedAt ?? now,
      stockReleased: false, cancelledAt: null,
    }).where(eq(orders.id, o.id));
    await tx.insert(orderEvents).values({
      orderId: o.id, status: "PLACED", message: "Payment received. Order placed.", actorName: `Razorpay (${source})`,
    });
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
    eq(orders.status, "PENDING_PAYMENT"), eq(orders.stockReleased, false), lt(orders.createdAt, cutoff),
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
}

export async function refundOrder(input: { orderId: string; amount: number; reason: string; actorName: string; viaGateway: boolean }) {
  const o = await db.query.orders.findFirst({ where: eq(orders.id, input.orderId) });
  if (!o) throw new Error("Order not found.");
  const refundable = o.total - o.refunded;
  if (input.amount <= 0 || input.amount > refundable) throw new Error(`You can refund up to ₹${refundable / 100}.`);
  let gatewayId: string | null = null;
  if (input.viaGateway) {
    if (o.paymentMethod !== "RAZORPAY" || !o.razorpayPaymentId) throw new Error("This order was not paid online, so refund it manually.");
    if (o.razorpayPaymentId.startsWith("mock_")) gatewayId = "mock_refund";
    else gatewayId = (await refundRazorpayPayment(o.razorpayPaymentId, input.amount, input.reason)).id;
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
      message: `Refund of ₹${(input.amount / 100).toLocaleString("en-IN")} ${gatewayId ? "sent to the original payment method" : "recorded"}. ${input.reason}`.trim(),
    });
  });
}
