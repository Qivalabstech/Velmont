"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, cartItems, carts, variants, subscribers, contactMessages, wishlistItems, reviews, orders, orderItems } from "@/db";
import { getCartRecord, getCartSummary, validateCoupon, getCartLines } from "@/lib/cart";
import { getCustomer, clientIp } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { isEmail } from "@/lib/utils";

export type CartSummary = Awaited<ReturnType<typeof getCartSummary>>;
type Res = { ok: true; cart: CartSummary; message?: string } | { ok: false; error: string; cart?: CartSummary };

export async function fetchCart(): Promise<CartSummary> {
  return getCartSummary();
}

export async function addToCart(variantId: string, qty = 1): Promise<Res> {
  const v = await db.query.variants.findFirst({ where: eq(variants.id, variantId), with: { product: true } });
  if (!v || !v.active || v.product.status !== "ACTIVE") return { ok: false, error: "This size is not available." };
  const cart = (await getCartRecord(true))!;
  const customer = await getCustomer();
  if (customer && !cart.userId) await db.update(carts).set({ userId: customer.id, email: customer.email }).where(eq(carts.id, cart.id));
  const existing = await db.query.cartItems.findFirst({ where: and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, variantId)) });
  const want = (existing?.qty ?? 0) + qty;
  if (want > v.stock) {
    return { ok: false, error: v.stock <= 0 ? "Sorry, this size just sold out." : `Only ${v.stock} left in size ${v.size}.`, cart: await getCartSummary() };
  }
  if (existing) await db.update(cartItems).set({ qty: want }).where(eq(cartItems.id, existing.id));
  else await db.insert(cartItems).values({ cartId: cart.id, variantId, qty });
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cart.id));
  return { ok: true, cart: await getCartSummary(), message: `${v.product.name}, size ${v.size}, added to your bag` };
}

export async function setQty(itemId: string, qty: number): Promise<Res> {
  const cart = await getCartRecord(false);
  if (!cart) return { ok: false, error: "Your bag is empty." };
  const item = await db.query.cartItems.findFirst({ where: and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)), with: { variant: true } });
  if (!item) return { ok: true, cart: await getCartSummary() };
  if (qty <= 0) await db.delete(cartItems).where(eq(cartItems.id, itemId));
  else {
    if (qty > item.variant.stock) return { ok: false, error: `Only ${item.variant.stock} left in this size.`, cart: await getCartSummary() };
    await db.update(cartItems).set({ qty: Math.min(qty, 10) }).where(eq(cartItems.id, itemId));
  }
  return { ok: true, cart: await getCartSummary() };
}

export async function applyCoupon(code: string): Promise<Res> {
  const cart = await getCartRecord(false);
  if (!cart) return { ok: false, error: "Add a belt to your bag first." };
  const lines = await getCartLines(cart.id);
  const subtotal = lines.filter((l) => l.available).reduce((a, l) => a + l.price * l.qty, 0);
  const customer = await getCustomer();
  const { coupon, error } = await validateCoupon(code, subtotal, customer?.email ?? cart.email);
  if (!coupon) return { ok: false, error: error!, cart: await getCartSummary() };
  await db.update(carts).set({ couponCode: coupon.code }).where(eq(carts.id, cart.id));
  return { ok: true, cart: await getCartSummary(), message: `Code ${coupon.code} applied` };
}

export async function removeCoupon(): Promise<Res> {
  const cart = await getCartRecord(false);
  if (cart) await db.update(carts).set({ couponCode: null }).where(eq(carts.id, cart.id));
  return { ok: true, cart: await getCartSummary() };
}

export async function subscribe(email: string) {
  const ip = await clientIp();
  if (!rateLimit(`sub:${ip}`, 5, 600_000).ok) return { ok: false, error: "Too many tries. Try again in a few minutes." };
  if (!isEmail(email)) return { ok: false, error: "Enter a full email address, like name@example.com." };
  await db.insert(subscribers).values({ email: email.toLowerCase() }).onConflictDoNothing();
  return { ok: true };
}

export async function sendContact(_: unknown, fd: FormData) {
  const ip = await clientIp();
  if (!rateLimit(`contact:${ip}`, 4, 600_000).ok) return { ok: false, error: "Too many messages. Try again in a few minutes." };
  const name = String(fd.get("name") || "").trim(), email = String(fd.get("email") || "").trim();
  const message = String(fd.get("message") || "").trim();
  if (fd.get("company")) return { ok: true }; // honeypot
  if (!name || !isEmail(email) || message.length < 10)
    return { ok: false, error: "Add your name, a valid email and a message of at least 10 characters." };
  await db.insert(contactMessages).values({
    name, email, message: message.slice(0, 4000),
    phone: String(fd.get("phone") || "").slice(0, 20), orderRef: String(fd.get("order") || "").slice(0, 30),
  });
  return { ok: true };
}

export async function toggleWishlist(productId: string) {
  const c = await getCustomer();
  if (!c) return { ok: false, needLogin: true };
  const existing = await db.query.wishlistItems.findFirst({
    where: and(eq(wishlistItems.userId, c.id), eq(wishlistItems.productId, productId)),
  });
  if (existing) await db.delete(wishlistItems).where(and(eq(wishlistItems.userId, c.id), eq(wishlistItems.productId, productId)));
  else await db.insert(wishlistItems).values({ userId: c.id, productId });
  revalidatePath("/account/wishlist");
  return { ok: true, saved: !existing };
}

export async function submitReview(_: unknown, fd: FormData) {
  const c = await getCustomer();
  if (!c) return { ok: false, error: "Sign in to write a review." };
  const productId = String(fd.get("productId") || "");
  const rating = Math.round(Number(fd.get("rating")));
  const title = String(fd.get("title") || "").trim().slice(0, 120);
  const body = String(fd.get("body") || "").trim();
  if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "Choose a star rating." };
  if (body.length < 20) return { ok: false, error: "Write at least 20 characters so others can learn from it." };
  const already = await db.query.reviews.findFirst({ where: and(eq(reviews.productId, productId), eq(reviews.userId, c.id)) });
  if (already) return { ok: false, error: "You have already reviewed this belt." };
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orders.userId, c.id), eq(orderItems.productId, productId), eq(orders.status, "DELIVERED")));
  await db.insert(reviews).values({
    productId, userId: c.id, name: c.name.split(" ")[0] + (c.name.split(" ")[1] ? ` ${c.name.split(" ")[1][0]}.` : ""),
    rating, title, body: body.slice(0, 3000), verified: n > 0,
  });
  return { ok: true };
}
