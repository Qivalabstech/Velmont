"use server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, carts, orders, addresses } from "@/db";
import { getCartRecord, getCartLines, computeTotals } from "@/lib/cart";
import { getCustomer, clientIp } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createOrder, clearCart, sendPlacedEmails, StockError, releaseExpiredOrders } from "@/lib/orders";
import { createRazorpayOrder, paymentsMode, razorpayKeys } from "@/lib/razorpay";
import { orderToken } from "@/lib/order-token";
import { rateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/audit";
import { INDIAN_STATES, normPhone } from "@/lib/utils";

const Input = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z.string().trim().transform(normPhone).refine((p) => /^[6-9]\d{9}$/.test(p), "Enter a 10-digit Indian mobile number."),
  name: z.string().trim().min(2, "Enter the full name for delivery.").max(80),
  line1: z.string().trim().min(5, "Enter the house number and street.").max(160),
  line2: z.string().trim().max(160).default(""),
  city: z.string().trim().min(2, "Enter the city.").max(60),
  state: z.string().refine((s) => INDIAN_STATES.includes(s), "Choose a state."),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a 6-digit pincode."),
  method: z.enum(["RAZORPAY", "COD"]),
  note: z.string().max(500).default(""),
  saveAddress: z.boolean().default(false),
});
export type CheckoutInput = z.input<typeof Input>;

export async function quote(couponCode: string | null) {
  const cart = await getCartRecord(false);
  if (!cart) return null;
  const lines = await getCartLines(cart.id);
  const s = await getSettings();
  const [online, cod] = await Promise.all([
    computeTotals(lines, { couponCode: couponCode ?? cart.couponCode, method: "RAZORPAY", settings: s }),
    computeTotals(lines, { couponCode: couponCode ?? cart.couponCode, method: "COD", settings: s }),
  ]);
  return { online, cod };
}

export type PlaceResult =
  | { ok: true; kind: "done"; number: string; token: string }
  | { ok: true; kind: "razorpay"; key: string; rzpOrderId: string; amount: number; number: string; name: string; email: string; phone: string; storeName: string }
  | { ok: true; kind: "mock"; rzpOrderId: string; amount: number; number: string }
  | { ok: false; error: string; field?: string };

export async function placeOrder(raw: CheckoutInput): Promise<PlaceResult> {
  const ip = await clientIp();
  if (!rateLimit(`checkout:${ip}`, 10, 600_000).ok) return { ok: false, error: "Too many attempts. Wait a few minutes and try again." };
  const parsed = Input.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: i.message, field: String(i.path[0]) };
  }
  const d = parsed.data;
  await releaseExpiredOrders().catch(() => {}); // frees stock held by abandoned online payments
  const cart = await getCartRecord(false);
  if (!cart) return { ok: false, error: "Your bag is empty." };
  const lines = await getCartLines(cart.id);
  if (!lines.length) return { ok: false, error: "Your bag is empty." };
  const bad = lines.find((l) => !l.available || l.qty > l.stock);
  if (bad) return { ok: false, error: `${bad.name} (size ${bad.size}) is no longer available in that quantity. Update your bag.` };

  const s = await getSettings();
  const customer = await getCustomer();
  const totals = await computeTotals(lines, { couponCode: cart.couponCode, method: d.method, email: d.email, settings: s });
  if (totals.couponError) await db.update(carts).set({ couponCode: null }).where(eq(carts.id, cart.id));
  if (d.method === "COD") {
    if (!s.shipping.codEnabled) return { ok: false, error: "Cash on delivery is not available right now." };
    if (totals.total > s.shipping.codMaxOrder) return { ok: false, error: "This order is above the cash on delivery limit. Pay online instead." };
  }
  const mode = await paymentsMode();
  if (d.method === "RAZORPAY" && mode === "off") return { ok: false, error: "Online payment is not set up yet. Choose cash on delivery or contact us." };

  const address = { name: d.name, phone: d.phone, line1: d.line1, line2: d.line2, city: d.city, state: d.state, pincode: d.pincode };
  let order;
  try {
    order = await createOrder({ lines, totals, method: d.method, email: d.email, phone: d.phone, address, note: d.note, userId: customer?.id ?? null });
  } catch (e) {
    if (e instanceof StockError) return { ok: false, error: e.message };
    await logError("checkout", e, "/checkout");
    return { ok: false, error: "We could not place the order. Please try again." };
  }

  await db.update(carts).set({ email: d.email }).where(eq(carts.id, cart.id));
  if (customer && d.saveAddress) {
    const dup = await db.query.addresses.findFirst({ where: and(eq(addresses.userId, customer.id), eq(addresses.line1, d.line1), eq(addresses.pincode, d.pincode)) });
    if (!dup) {
      const has = await db.query.addresses.findFirst({ where: eq(addresses.userId, customer.id) });
      await db.insert(addresses).values({ userId: customer.id, ...address, isDefault: !has });
    }
  }

  if (d.method === "COD") {
    await clearCart(cart.id);
    await db.update(carts).set({ couponCode: null }).where(eq(carts.id, cart.id));
    await sendPlacedEmails(order.id);
    return { ok: true, kind: "done", number: order.number, token: orderToken(order.number) };
  }

  if (mode === "mock") {
    const rzpOrderId = `mock_${order.id}`;
    await db.update(orders).set({ razorpayOrderId: rzpOrderId }).where(eq(orders.id, order.id));
    return { ok: true, kind: "mock", rzpOrderId, amount: order.total, number: order.number };
  }
  try {
    const rzp = await createRazorpayOrder(order.total, order.number, { order_number: order.number, email: d.email });
    await db.update(orders).set({ razorpayOrderId: rzp.id }).where(eq(orders.id, order.id));
    const { keyId } = await razorpayKeys();
    return { ok: true, kind: "razorpay", key: keyId, rzpOrderId: rzp.id, amount: order.total, number: order.number, name: d.name, email: d.email, phone: d.phone, storeName: s.store.name };
  } catch (e) {
    await logError("razorpay", e, "/checkout");
    return { ok: false, error: "The payment gateway did not respond. Try again in a minute, or choose cash on delivery." };
  }
}
