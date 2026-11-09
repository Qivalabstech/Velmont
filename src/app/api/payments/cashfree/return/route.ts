// Cashfree sends the customer here (GET) after a payment attempt. The URL carries the order number and its
// private token; the payment result is read from Cashfree's API, never from the URL.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, orders, carts } from "@/db";
import { checkOrderToken, orderToken } from "@/lib/order-token";
import { confirmCashfreeOrder } from "@/lib/cashfree-orders";
import { getCartRecord } from "@/lib/cart";
import { clearCart } from "@/lib/orders";
import { SITE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const number = url.searchParams.get("o") || "";
  const t = url.searchParams.get("t") || "";
  if (!checkOrderToken(number, t)) return NextResponse.redirect(`${SITE_URL}/`, 303);
  const o = await db.query.orders.findFirst({ where: eq(orders.number, number) });
  if (!o) return NextResponse.redirect(`${SITE_URL}/`, 303);

  const result = await confirmCashfreeOrder(o, "return");
  const back = `${SITE_URL}/order/${o.number}?t=${orderToken(o.number)}`;
  if (result === "paid") {
    const cart = await getCartRecord(false);
    if (cart) {
      await clearCart(cart.id);
      await db.update(carts).set({ couponCode: null }).where(eq(carts.id, cart.id));
    }
    return NextResponse.redirect(back, 303);
  }
  return NextResponse.redirect(`${back}&pay=${result === "pending" ? "pending" : "failed"}`, 303);
}
