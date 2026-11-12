import "server-only";
import { and, eq, gt, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { db, orders, orderEvents, type OrderStatus } from "@/db";
import {
  ShiprocketError, assignAwb, cancelShiprocketOrder, createShiprocketOrder, generateLabel, schedulePickup,
  shiprocketConfig, shiprocketMissing, trackAwb, type SrOrderInput,
} from "./shiprocket";
import { updateOrderStatus } from "./orders";
import { logError } from "./audit";

type OrderRow = typeof orders.$inferSelect;

const note = (orderId: string, message: string, actorName = "Shiprocket") =>
  db.insert(orderEvents).values({ orderId, message: message.slice(0, 500), actorName, visibleToCustomer: false });

const rupees = (p: number) => Math.round(p) / 100;

/** "2026-11-13 02:30" in India time, the format Shiprocket expects. */
function istStamp(d: Date) {
  const s = new Date(d.getTime() + 5.5 * 3600_000).toISOString();
  return `${s.slice(0, 10)} ${s.slice(11, 16)}`;
}

async function buildPayload(o: OrderRow): Promise<SrOrderInput> {
  const cfg = await shiprocketConfig();
  const items = await db.query.orderItems.findMany({ where: (t, { eq }) => eq(t.orderId, o.id) });
  const units = items.reduce((n, i) => n + i.qty, 0) || 1;
  const a = o.shippingAddress;
  const [first, ...rest] = a.name.trim().split(/\s+/);
  const phone = (a.phone || o.phone).replace(/\D/g, "").slice(-10);
  // Item prices include GST. Discounts and the COD fee are passed as order-level amounts so the total matches.
  const itemsTotal = items.reduce((n, i) => n + i.total, 0);
  const discount = Math.max(0, itemsTotal + o.shipping + o.codFee - o.total);
  return {
    order_id: o.number,
    order_date: istStamp(o.placedAt ?? o.createdAt),
    pickup_location: cfg.pickupLocation,
    billing_customer_name: first || a.name,
    billing_last_name: rest.join(" ") || ".",
    billing_address: a.line1,
    ...(a.line2 ? { billing_address_2: a.line2 } : {}),
    billing_city: a.city, billing_pincode: a.pincode, billing_state: a.state, billing_country: "India",
    billing_email: o.email, billing_phone: phone,
    shipping_is_billing: true,
    order_items: items.map((i) => ({
      name: `${i.name} (Size ${i.size})`.slice(0, 200), sku: i.sku, units: i.qty,
      selling_price: rupees(i.unitPrice), hsn: i.hsn, tax: i.gstRate,
    })),
    payment_method: o.paymentMethod === "COD" ? "COD" : "Prepaid",
    shipping_charges: rupees(o.shipping + o.codFee),
    total_discount: rupees(discount),
    sub_total: rupees(o.total),
    length: cfg.lengthCm, breadth: cfg.breadthCm, height: cfg.heightCm,
    weight: Math.max(0.1, Math.round(cfg.weightPerItemKg * units * 100) / 100),
  };
}

export type ShipStep = "created" | "booked" | "skipped" | "failed";

/**
 * Sends an order to Shiprocket and, when auto-booking is on, books the recommended courier, schedules pickup
 * and fetches the label. Every step is resumable: running it again continues from where it stopped.
 */
export async function shipWithShiprocket(orderId: string, opts: { book?: boolean; actorName?: string } = {}): Promise<{ step: ShipStep; message: string }> {
  const cfg = await shiprocketConfig();
  const miss = shiprocketMissing(cfg);
  if (!cfg.enabled || miss.length) return { step: "skipped", message: cfg.enabled ? `Shiprocket needs: ${miss.join(", ")}.` : "Shiprocket is switched off." };
  let o = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!o) return { step: "failed", message: "Order not found." };
  if (!["PLACED", "CONFIRMED", "PACKED"].includes(o.status)) return { step: "skipped", message: `Order is ${o.status.toLowerCase()}, so it was not sent to Shiprocket.` };
  const actor = opts.actorName || "Shiprocket (automatic)";
  const book = opts.book ?? cfg.autoAssign;

  try {
    if (!o.shiprocketShipmentId) {
      const r = await createShiprocketOrder(await buildPayload(o));
      if (!r.shipment_id) throw new ShiprocketError("Shiprocket did not return a shipment.");
      await db.update(orders).set({ shiprocketOrderId: String(r.order_id), shiprocketShipmentId: String(r.shipment_id), shippingError: null }).where(eq(orders.id, o.id));
      await note(o.id, `Sent to Shiprocket (order ${r.order_id}, shipment ${r.shipment_id}).`, actor);
      if (o.status === "PLACED") await updateOrderStatus({ orderId: o.id, status: "CONFIRMED", actorName: actor, notify: false, note: "Order confirmed. We are preparing it for dispatch." });
      o = (await db.query.orders.findFirst({ where: eq(orders.id, o.id) }))!;
    }
    if (!book) return { step: "created", message: "Sent to Shiprocket. Book the courier from Shiprocket or press “Book courier”." };

    let { awb, courier } = { awb: o.awb, courier: o.courier };
    if (!awb) {
      const a = await assignAwb(o.shiprocketShipmentId!);
      awb = a.awb; courier = a.courier;
      await db.update(orders).set({ awb, courier, shippingError: null }).where(eq(orders.id, o.id));
      await note(o.id, `Courier booked: ${courier}, AWB ${awb}.`, actor);
    }
    if (!o.pickupScheduledFor) {
      const p = await schedulePickup(o.shiprocketShipmentId!).catch(async (e) => {
        // Pickup is often already requested (e.g. booked from the Shiprocket panel); do not fail the whole chain.
        await note(o!.id, `Pickup request: ${e instanceof Error ? e.message : e}`, actor);
        return { scheduledFor: null };
      });
      if (p.scheduledFor) {
        await db.update(orders).set({ pickupScheduledFor: p.scheduledFor }).where(eq(orders.id, o.id));
        await note(o.id, `Pickup scheduled for ${p.scheduledFor}.`, actor);
      }
    }
    if (!o.shippingLabelUrl) {
      const label = await generateLabel(o.shiprocketShipmentId!).catch(() => null);
      if (label) await db.update(orders).set({ shippingLabelUrl: label }).where(eq(orders.id, o.id));
    }
    const fresh = (await db.query.orders.findFirst({ where: eq(orders.id, o.id) }))!;
    if (fresh.status === "CONFIRMED" || fresh.status === "PLACED") {
      await updateOrderStatus({
        orderId: o.id, status: "PACKED", actorName: actor, notify: true, courier: courier || undefined, awb: awb || undefined,
        note: `Packed and booked with ${courier}. Tracking number ${awb}.`,
      });
    }
    return { step: "booked", message: `Booked with ${courier}, AWB ${awb}.` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(orders).set({ shippingError: msg.slice(0, 500) }).where(eq(orders.id, orderId));
    await note(orderId, `Shiprocket step failed: ${msg}`, actor);
    await logError("shiprocket", e, `/admin/orders/${orderId}`);
    return { step: "failed", message: msg };
  }
}

/** Called when an order becomes "placed" (paid online, or COD). Runs after the response where possible. */
export async function onOrderPlacedShipping(orderId: string) {
  const cfg = await shiprocketConfig().catch(() => null);
  if (!cfg?.enabled || !cfg.autoCreate) return;
  const job = () => shipWithShiprocket(orderId).then(() => undefined, (e) => logError("shiprocket", e));
  try {
    const { after } = await import("next/server");
    after(job);
  } catch {
    await job(); // outside a request (scripts, tests)
  }
}

// Courier status text → store status. Only forward moves are applied.
const RANK: Partial<Record<OrderStatus, number>> = { PLACED: 1, CONFIRMED: 2, PACKED: 3, SHIPPED: 4, OUT_FOR_DELIVERY: 5, DELIVERED: 6 };
export function mapCourierStatus(raw: string): { status?: OrderStatus; note?: string } {
  const s = raw.toUpperCase().replace(/[_-]+/g, " ").trim();
  if (/^RTO|RETURN/.test(s)) return { note: `Courier: ${raw}. The parcel is going back to you.` };
  if (/CANCEL/.test(s)) return { note: `Courier: ${raw}.` };
  if (/UNDELIVERED|NDR|DELIVERY FAILED|NOT DELIVERED|FAILED ATTEMPT/.test(s)) return { note: `Courier could not deliver: ${raw}. Check NDR in Shiprocket.` };
  if (/^DELIVERED/.test(s)) return { status: "DELIVERED" };
  if (/OUT FOR DELIVERY/.test(s)) return { status: "OUT_FOR_DELIVERY" };
  if (/PICKED UP|IN TRANSIT|SHIPPED|REACHED|DISPATCH|AT DESTINATION|MISROUTED|DELAYED/.test(s)) return { status: "SHIPPED" };
  return {}; // e.g. PICKUP SCHEDULED, AWB ASSIGNED, MANIFEST GENERATED
}

/** Applies a courier status to an order: logs it, moves the order forward, emails the customer on real changes. */
export async function applyCourierStatus(o: OrderRow, raw: string, extra: { trackUrl?: string | null; courier?: string | null; source: string }) {
  const changedText = raw !== o.shippingStatus;
  await db.update(orders).set({
    shippingStatus: raw, shippingSyncedAt: new Date(),
    ...(extra.trackUrl && extra.trackUrl !== o.trackingUrl ? { trackingUrl: extra.trackUrl } : {}),
    ...(extra.courier && !o.courier ? { courier: extra.courier } : {}),
  }).where(eq(orders.id, o.id));
  const m = mapCourierStatus(raw);
  if (m.status && (RANK[m.status] ?? 0) > (RANK[o.status] ?? 99)) {
    await updateOrderStatus({ orderId: o.id, status: m.status, actorName: `Shiprocket (${extra.source})`, notify: true, note: `${raw.charAt(0) + raw.slice(1).toLowerCase()}.` });
    return { moved: m.status };
  }
  if (changedText && m.note) await note(o.id, m.note, `Shiprocket (${extra.source})`);
  return { moved: null };
}

/** Asks Shiprocket for the latest tracking of one order. */
export async function syncTracking(o: OrderRow, source = "sync") {
  if (!o.awb) return { moved: null, status: null as string | null };
  const t = await trackAwb(o.awb);
  if (!t) {
    await db.update(orders).set({ shippingSyncedAt: new Date() }).where(eq(orders.id, o.id));
    return { moved: null, status: null };
  }
  const r = await applyCourierStatus(o, t.status, { trackUrl: t.trackUrl, courier: t.courier, source });
  return { ...r, status: t.status };
}

/** Daily job: finish orders whose Shiprocket step failed, and refresh tracking of orders still on the way. */
export async function shiprocketDaily() {
  const cfg = await shiprocketConfig();
  if (!cfg.enabled || shiprocketMissing(cfg).length) return { retried: 0, synced: 0 };
  const since = new Date(Date.now() - 30 * 86400_000);
  const pending = await db.select().from(orders).where(and(
    inArray(orders.status, ["PLACED", "CONFIRMED", "PACKED"]), gt(orders.createdAt, since), isNotNull(orders.shippingError),
    cfg.autoAssign ? or(isNull(orders.shiprocketShipmentId), isNull(orders.awb)) : isNull(orders.shiprocketShipmentId),
  )).limit(20);
  let retried = 0;
  for (const o of pending) { await shipWithShiprocket(o.id); retried++; }
  const moving = await db.select().from(orders).where(and(
    inArray(orders.status, ["CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY"]), isNotNull(orders.awb),
    isNotNull(orders.shiprocketShipmentId), gt(orders.createdAt, since),
  )).limit(60);
  let synced = 0;
  for (const o of moving) { try { await syncTracking(o, "daily sync"); synced++; } catch (e) { await logError("shiprocket", e); } }
  return { retried, synced };
}

/** Cancels the Shiprocket order when a store order is cancelled before it ships. */
export async function cancelInShiprocket(o: OrderRow, actorName: string) {
  if (!o.shiprocketOrderId) return;
  try {
    await cancelShiprocketOrder(o.shiprocketOrderId);
    await note(o.id, `Cancelled in Shiprocket (order ${o.shiprocketOrderId}).`, actorName);
  } catch (e) {
    await note(o.id, `Could not cancel in Shiprocket: ${e instanceof Error ? e.message : e}. Cancel it in the Shiprocket panel.`, actorName);
  }
}
