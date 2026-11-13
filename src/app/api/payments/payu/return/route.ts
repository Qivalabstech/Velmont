// PayU posts the customer's browser here (surl and furl) after a payment attempt. The post is only used to
// learn which attempt it was: the result is read from PayU's verify_payment API. The POST then redirects to the
// GET below, which (being a top-level GET) carries the bag cookie so a paid bag can be emptied.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, orders, carts } from "@/db";
import { checkOrderToken, orderToken } from "@/lib/order-token";
import { confirmPayuOrder, findOrderForTxn } from "@/lib/payu-orders";
import { getCartRecord } from "@/lib/cart";
import { clearCart } from "@/lib/orders";
import { SITE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const fd = await req.formData().catch(() => null);
  const txnid = String(fd?.get("txnid") || "");
  const o = await findOrderForTxn(txnid);
  if (!o) return NextResponse.redirect(`${SITE_URL}/`, 303);
  const result = await confirmPayuOrder(o, "return", txnid);
  return NextResponse.redirect(`${SITE_URL}/api/payments/payu/return?o=${encodeURIComponent(o.number)}&t=${orderToken(o.number)}&r=${result}`, 303);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const number = url.searchParams.get("o") || "";
  if (!checkOrderToken(number, url.searchParams.get("t") || "")) return NextResponse.redirect(`${SITE_URL}/`, 303);
  const o = await db.query.orders.findFirst({ where: eq(orders.number, number) });
  if (!o) return NextResponse.redirect(`${SITE_URL}/`, 303);
  const back = `${SITE_URL}/order/${o.number}?t=${orderToken(o.number)}`;
  const paid = o.paymentStatus === "PAID" || o.paymentStatus === "PARTIALLY_REFUNDED" || o.paymentStatus === "REFUNDED";
  if (paid) {
    const cart = await getCartRecord(false);
    if (cart) {
      await clearCart(cart.id);
      await db.update(carts).set({ couponCode: null }).where(eq(carts.id, cart.id));
    }
    return NextResponse.redirect(back, 303);
  }
  return NextResponse.redirect(`${back}&pay=${url.searchParams.get("r") === "pending" ? "pending" : "failed"}`, 303);
}
