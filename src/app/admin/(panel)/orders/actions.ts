"use server";
import { eq, inArray } from "drizzle-orm";
import { db, orders, orderEvents } from "@/db";
import { run, type ActionState } from "@/lib/admin-action";
import { updateOrderStatus, refundOrder, markUpiPaid, rejectUpiPayment } from "@/lib/orders";
import { NEXT_STATUSES, STATUS_LABEL, COURIERS } from "@/lib/order-status";
import type { OrderStatus } from "@/db/schema";
import { str, bool, num, INDIAN_STATES } from "@/lib/utils";

export async function changeStatus(_: ActionState, fd: FormData) {
  return run("orders.manage", async (me) => {
    const id = str(fd, "id"), status = str(fd, "status") as OrderStatus;
    const o = await db.query.orders.findFirst({ where: eq(orders.id, id) });
    if (!o) return { error: "Order not found." };
    if (!NEXT_STATUSES[o.status].includes(status)) return { error: `An order that is ${STATUS_LABEL[o.status].toLowerCase()} cannot move to ${STATUS_LABEL[status].toLowerCase()}.` };
    if (status === "CANCELLED" && !me.perms.has("orders.refund")) return { error: "Your role cannot cancel orders." };
    const courier = str(fd, "courier"), awb = str(fd, "awb");
    let trackingUrl = str(fd, "trackingUrl");
    if (status === "SHIPPED" && !awb) return { error: "Add the courier tracking number before marking as shipped." };
    if (awb && !trackingUrl) {
      const tpl = COURIERS.find((c) => c.name === courier)?.url;
      if (tpl) trackingUrl = tpl.replace("{awb}", encodeURIComponent(awb));
    }
    await updateOrderStatus({
      orderId: id, status, actorName: me.name, note: str(fd, "note"), notify: bool(fd, "notify"),
      ...(status === "SHIPPED" || awb ? { courier, awb, trackingUrl } : {}),
      restockOnCancel: fd.get("restock") ? bool(fd, "restock") : true,
    });
    return { ok: `Order ${o.number} is now ${STATUS_LABEL[status].toLowerCase()}.`, log: { action: "status", entity: "order", id, summary: `${o.number}: ${STATUS_LABEL[o.status]} → ${STATUS_LABEL[status]}` }, revalidate: ["/admin/orders"] };
  });
}

export async function updateTracking(_: ActionState, fd: FormData) {
  return run("orders.manage", async (me) => {
    const id = str(fd, "id");
    const courier = str(fd, "courier"), awb = str(fd, "awb");
    let trackingUrl = str(fd, "trackingUrl");
    if (awb && !trackingUrl) trackingUrl = (COURIERS.find((c) => c.name === courier)?.url || "").replace("{awb}", encodeURIComponent(awb));
    const [o] = await db.update(orders).set({ courier: courier || null, awb: awb || null, trackingUrl: trackingUrl || null }).where(eq(orders.id, id)).returning();
    await db.insert(orderEvents).values({ orderId: id, message: `Tracking updated: ${courier} ${awb}`.trim(), actorName: me.name, visibleToCustomer: false });
    return { ok: "Tracking saved.", log: { action: "tracking", entity: "order", id, summary: `${o.number}: ${courier} ${awb}` } };
  });
}

export async function addNote(_: ActionState, fd: FormData) {
  return run("orders.manage", async (me) => {
    const id = str(fd, "id"), note = str(fd, "note");
    if (!note) return { error: "Write a note first." };
    const visible = bool(fd, "visible");
    await db.insert(orderEvents).values({ orderId: id, message: note.slice(0, 1000), actorName: me.name, visibleToCustomer: visible });
    return { ok: visible ? "Update posted to the customer's tracking page." : "Note added." };
  });
}

export async function markCodCollected(_: ActionState, fd: FormData) {
  return run("orders.manage", async (me) => {
    const id = str(fd, "id");
    const [o] = await db.update(orders).set({ paymentStatus: "COD_COLLECTED" }).where(eq(orders.id, id)).returning();
    await db.insert(orderEvents).values({ orderId: id, message: "Cash collected by courier.", actorName: me.name, visibleToCustomer: false });
    return { ok: "Marked as collected.", log: { action: "cod_collected", entity: "order", id, summary: `${o.number}: COD collected` } };
  });
}

export async function refund(_: ActionState, fd: FormData) {
  return run("orders.refund", async (me) => {
    const id = str(fd, "id");
    const amount = Math.round(num(fd, "amount") * 100);
    const reason = str(fd, "reason");
    if (!reason) return { error: "Add a reason for the refund." };
    await refundOrder({ orderId: id, amount, reason, actorName: me.name, viaGateway: str(fd, "mode") === "gateway" });
    const o = await db.query.orders.findFirst({ where: eq(orders.id, id) });
    return { ok: `Refund of ₹${amount / 100} recorded.`, log: { action: "refund", entity: "order", id, summary: `${o?.number}: refund ₹${amount / 100} (${reason})` } };
  });
}

export async function editAddress(_: ActionState, fd: FormData) {
  return run("orders.manage", async (me) => {
    const id = str(fd, "id");
    const a = { name: str(fd, "name"), phone: str(fd, "phone"), line1: str(fd, "line1"), line2: str(fd, "line2"), city: str(fd, "city"), state: str(fd, "state"), pincode: str(fd, "pincode") };
    if (!a.name || !a.line1 || !a.city || !/^[1-9]\d{5}$/.test(a.pincode) || !INDIAN_STATES.includes(a.state)) return { error: "Fill in name, street, city, a valid state and a 6-digit pincode." };
    const [o] = await db.update(orders).set({ shippingAddress: a }).where(eq(orders.id, id)).returning();
    await db.insert(orderEvents).values({ orderId: id, message: "Delivery address updated.", actorName: me.name, visibleToCustomer: false });
    return { ok: "Address updated.", log: { action: "address", entity: "order", id, summary: `${o.number}: address edited` } };
  });
}

export async function saveInternalNote(_: ActionState, fd: FormData) {
  return run("orders.manage", async () => {
    await db.update(orders).set({ internalNote: str(fd, "internalNote").slice(0, 2000) }).where(eq(orders.id, str(fd, "id")));
    return { ok: "Staff note saved." };
  });
}

export async function bulkStatus(_: ActionState, fd: FormData) {
  return run("orders.manage", async (me) => {
    const ids = fd.getAll("ids").map(String).filter(Boolean);
    const status = str(fd, "status") as OrderStatus;
    if (!ids.length) return { error: "Tick at least one order." };
    if ((status as string) === "SHIPROCKET") {
      if (ids.length > 10) return { error: "Send up to 10 orders to Shiprocket at a time." };
      const { shipWithShiprocket } = await import("@/lib/shiprocket-orders");
      const results = [];
      for (const id of ids) results.push(await shipWithShiprocket(id, { book: true, actorName: me.name }));
      const ok = results.filter((r) => r.step === "booked" || r.step === "created").length;
      const failed = results.filter((r) => r.step === "failed");
      const msg = `${ok} of ${ids.length} orders booked with Shiprocket.${failed.length ? ` ${failed.length} failed: ${failed[0].message}` : ""}`;
      return ok ? { ok: msg, log: { action: "bulk_shiprocket", entity: "order", summary: msg }, revalidate: ["/admin/orders"] } : { error: msg };
    }
    if (!["CONFIRMED", "PACKED"].includes(status)) return { error: "Bulk updates can mark orders confirmed or packed." };
    const list = await db.select().from(orders).where(inArray(orders.id, ids));
    let n = 0;
    for (const o of list) if (NEXT_STATUSES[o.status].includes(status)) {
      await updateOrderStatus({ orderId: o.id, status, actorName: me.name, notify: false }); n++;
    }
    return { ok: `${n} of ${ids.length} orders marked ${STATUS_LABEL[status].toLowerCase()}.`, log: { action: "bulk_status", entity: "order", summary: `${n} orders → ${STATUS_LABEL[status]}` } };
  });
}

/** Staff found the UPI money in the bank app. */
export async function confirmUpi(_: ActionState, fd: FormData) {
  return run("orders.refund", async (me) => {
    const id = str(fd, "id");
    const utr = str(fd, "utr").replace(/\s+/g, "");
    if (utr && !/^[A-Za-z0-9]{6,35}$/.test(utr)) return { error: "The UTR should be letters and numbers only (usually 12 digits)." };
    if (!bool(fd, "checked")) return { error: "Tick the box to confirm you saw this payment in your bank account." };
    const done = await markUpiPaid(id, { utr: utr || null, actorName: `${me.name} (checked bank)` });
    const o = await db.query.orders.findFirst({ where: eq(orders.id, id) });
    if (!done) return { error: `Order ${o?.number} is already marked paid.` };
    return { ok: `Payment confirmed. ${o?.number} is now placed and the customer has been emailed.`, log: { action: "upi_confirm", entity: "order", id, summary: `${o?.number}: UPI payment confirmed${utr ? ` (UTR ${utr})` : ""}` }, revalidate: ["/admin/orders"] };
  });
}

/** Staff checked the bank and the UPI money did not arrive. */
export async function rejectUpi(_: ActionState, fd: FormData) {
  return run("orders.refund", async (me) => {
    const id = str(fd, "id");
    await rejectUpiPayment(id, { reason: str(fd, "reason"), actorName: me.name, notify: bool(fd, "notify") });
    const o = await db.query.orders.findFirst({ where: eq(orders.id, id) });
    return { ok: `Marked as not received. ${o?.number} is cancelled and its stock is back.`, log: { action: "upi_reject", entity: "order", id, summary: `${o?.number}: UPI payment not received` }, revalidate: ["/admin/orders"] };
  });
}

/** Shiprocket: send the order, book a courier, or refresh tracking. */
export async function shiprocketAction(_: ActionState, fd: FormData) {
  return run("orders.manage", async (me) => {
    const id = str(fd, "id");
    const what = str(fd, "do");
    const { shipWithShiprocket, syncTracking } = await import("@/lib/shiprocket-orders");
    const o = await db.query.orders.findFirst({ where: eq(orders.id, id) });
    if (!o) return { error: "Order not found." };
    if (what === "track") {
      if (!o.awb) return { error: "This order has no tracking number yet." };
      const r = await syncTracking(o, "staff");
      return { ok: r.status ? `Courier status: ${r.status}${r.moved ? `. Order moved to ${r.moved.toLowerCase().replace(/_/g, " ")}.` : "."}` : "Shiprocket has no tracking scans for this parcel yet.", revalidate: ["/admin/orders"] };
    }
    const r = await shipWithShiprocket(id, { book: what === "book", actorName: me.name });
    if (r.step === "failed" || r.step === "skipped") return { error: r.message };
    return { ok: r.message, log: { action: "shiprocket", entity: "order", id, summary: `${o.number}: ${r.message}` }, revalidate: ["/admin/orders"] };
  });
}
