import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, orders, carts } from "@/db";
import { markPaid, clearCart } from "@/lib/orders";
import { paymentsMode, verifyPaymentSignature } from "@/lib/razorpay";
import { getCartRecord } from "@/lib/cart";
import { orderToken } from "@/lib/order-token";
import { logError } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const orderId = String(b.razorpay_order_id || ""), paymentId = String(b.razorpay_payment_id || ""), sig = String(b.razorpay_signature || "");
    if (!orderId || !paymentId || !sig) return NextResponse.json({ ok: false, error: "Payment details are missing." }, { status: 400 });
    const mode = await paymentsMode();
    const valid = mode === "mock" ? orderId.startsWith("mock_") && sig === "mock" : await verifyPaymentSignature(orderId, paymentId, sig);
    if (!valid) return NextResponse.json({ ok: false, error: "We could not verify this payment. If money was deducted, contact us with your order number." }, { status: 400 });
    await markPaid(orderId, paymentId, "checkout");
    const o = await db.query.orders.findFirst({ where: eq(orders.razorpayOrderId, orderId) });
    const cart = await getCartRecord(false);
    if (cart) { await clearCart(cart.id); await db.update(carts).set({ couponCode: null }).where(eq(carts.id, cart.id)); }
    return NextResponse.json({ ok: true, number: o!.number, token: orderToken(o!.number) });
  } catch (e) {
    await logError("payments.verify", e, "/api/payments/verify");
    return NextResponse.json({ ok: false, error: "Something went wrong while confirming the payment. Your payment is safe; we will match it to your order." }, { status: 500 });
  }
}
