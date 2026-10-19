// Razorpay webhook. In the Razorpay dashboard add https://YOURDOMAIN/api/payments/webhook
// with events: payment.captured, order.paid, payment.failed, refund.processed
import { NextResponse } from "next/server";
import { markPaid, markPaymentFailed } from "@/lib/orders";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { logError } from "@/lib/audit";

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") || "";
  if (!(await verifyWebhookSignature(raw, sig))) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const ev = JSON.parse(raw);
    const pay = ev?.payload?.payment?.entity;
    if ((ev.event === "payment.captured" || ev.event === "order.paid") && pay?.order_id) await markPaid(pay.order_id, pay.id, "webhook");
    if (ev.event === "payment.failed" && pay?.order_id) await markPaymentFailed(pay.order_id, pay.error_description || "failed");
    return NextResponse.json({ ok: true });
  } catch (e) {
    await logError("payments.webhook", e, "/api/payments/webhook");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
