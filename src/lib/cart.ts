import "server-only";
import { cookies } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { db, carts, cartItems, coupons, orders } from "@/db";
import { newToken } from "./auth";
import { getSettings, type Settings } from "./settings";
import { IS_PROD } from "./env";

export const CART_COOKIE = "vm_cart";

export type CartLine = {
  id: string; variantId: string; qty: number; size: string; sku: string; stock: number;
  productId: string; name: string; slug: string; price: number; mrp: number; image: string;
  gstRate: number; hsn: string; available: boolean;
};

export type Totals = {
  subtotal: number; couponDiscount: number; prepaidDiscount: number; discount: number;
  shipping: number; codFee: number; tax: number; total: number; itemCount: number;
  couponCode: string | null; couponError: string | null; freeShippingFromCoupon: boolean;
};

export async function cartToken(create = false) {
  const jar = await cookies();
  let token = jar.get(CART_COOKIE)?.value;
  if (!token && create) {
    token = newToken();
    jar.set(CART_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: IS_PROD, path: "/", maxAge: 60 * 24 * 3600 });
  }
  return token;
}

export async function getCartRecord(create = false) {
  const token = await cartToken(create);
  if (!token) return null;
  let cart = await db.query.carts.findFirst({ where: eq(carts.token, token) });
  if (!cart && create) [cart] = await db.insert(carts).values({ token }).returning();
  return cart ?? null;
}

export async function getCartLines(cartId: string): Promise<CartLine[]> {
  const s = await getSettings();
  const rows = await db.query.cartItems.findMany({
    where: eq(cartItems.cartId, cartId),
    with: { variant: { with: { product: { with: { images: { orderBy: (i, { asc }) => [asc(i.sortOrder)], limit: 1 } } } } } },
    orderBy: (c, { asc }) => [asc(c.id)],
  });
  return rows.map((r) => {
    const p = r.variant.product;
    return {
      id: r.id, variantId: r.variantId, qty: r.qty, size: r.variant.size, sku: r.variant.sku, stock: r.variant.stock,
      productId: p.id, name: p.name, slug: p.slug, price: p.price, mrp: p.mrp,
      image: p.images[0]?.url || "", gstRate: p.gstRate ?? s.tax.defaultGstRate, hsn: p.hsn,
      available: p.status === "ACTIVE" && r.variant.active && r.variant.stock > 0,
    };
  });
}

export async function validateCoupon(code: string, subtotal: number, email?: string | null) {
  const c = await db.query.coupons.findFirst({ where: eq(coupons.code, code.toUpperCase().trim()) });
  const now = new Date();
  if (!c || !c.active) return { coupon: null, error: "This code is not valid." };
  if (c.startsAt && c.startsAt > now) return { coupon: null, error: "This code is not active yet." };
  if (c.endsAt && c.endsAt < now) return { coupon: null, error: "This code has expired." };
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return { coupon: null, error: "This code has been fully used." };
  if (subtotal < c.minSubtotal)
    return { coupon: null, error: `Add ₹${((c.minSubtotal - subtotal) / 100).toLocaleString("en-IN")} more to use this code.` };
  if (c.perCustomerLimit != null && email) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(
      eq(orders.email, email.toLowerCase()), eq(orders.couponCode, c.code),
      sql`${orders.status} not in ('PENDING_PAYMENT','CANCELLED')`,
    ));
    if (n >= c.perCustomerLimit) return { coupon: null, error: "You have already used this code." };
  }
  return { coupon: c, error: null };
}

export async function computeTotals(
  lines: CartLine[], opts: { couponCode?: string | null; method?: "RAZORPAY" | "COD"; email?: string | null; settings?: Settings },
): Promise<Totals> {
  const s = opts.settings ?? (await getSettings());
  const live = lines.filter((l) => l.available);
  const subtotal = live.reduce((a, l) => a + l.price * l.qty, 0);
  const itemCount = live.reduce((a, l) => a + l.qty, 0);

  let couponDiscount = 0, couponError: string | null = null, couponCode: string | null = null, freeShip = false;
  if (opts.couponCode && subtotal > 0) {
    const { coupon, error } = await validateCoupon(opts.couponCode, subtotal, opts.email);
    if (coupon) {
      couponCode = coupon.code;
      if (coupon.type === "PERCENT") couponDiscount = Math.floor((subtotal * coupon.value) / 100);
      if (coupon.type === "FIXED") couponDiscount = Math.min(coupon.value, subtotal);
      if (coupon.type === "FREE_SHIPPING") freeShip = true;
      if (coupon.maxDiscount != null) couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);
    } else couponError = error;
  }
  const afterCoupon = subtotal - couponDiscount;
  const prepaidDiscount = opts.method === "RAZORPAY" && s.payments.prepaidDiscountPercent > 0
    ? Math.floor((afterCoupon * s.payments.prepaidDiscountPercent) / 100) : 0;
  const goods = afterCoupon - prepaidDiscount;
  const shipping = subtotal === 0 || freeShip || s.shipping.freeAbove === 0 || goods >= s.shipping.freeAbove ? 0 : s.shipping.flatRate;
  const codFee = opts.method === "COD" && subtotal > 0 ? s.shipping.codFee : 0;
  const total = goods + shipping + codFee;

  // Prices include GST. Work out the GST inside the total using the weighted item rate.
  const weighted = subtotal ? live.reduce((a, l) => a + l.gstRate * l.price * l.qty, 0) / subtotal : s.tax.defaultGstRate;
  const tax = Math.round((total * weighted) / (100 + weighted));

  return {
    subtotal, couponDiscount, prepaidDiscount, discount: couponDiscount + prepaidDiscount, shipping, codFee, tax, total,
    itemCount, couponCode, couponError, freeShippingFromCoupon: freeShip,
  };
}

/** Lightweight cart summary for the header and drawer. */
export async function getCartSummary() {
  const cart = await getCartRecord(false);
  if (!cart) return { lines: [] as CartLine[], totals: null as Totals | null, count: 0, couponCode: null as string | null };
  const lines = await getCartLines(cart.id);
  const totals = await computeTotals(lines, { couponCode: cart.couponCode });
  return { lines, totals, count: lines.reduce((a, l) => a + l.qty, 0), couponCode: cart.couponCode };
}
