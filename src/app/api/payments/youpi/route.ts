// YouPI webhook. In the YouPI merchant admin set the webhook URL to https://YOURDOMAIN/api/payments/youpi
// and use the same webhook secret as Settings → Payments → UPI (YouPI).
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, gatewayDeliveries } from "@/db";
import { youpiConfig, checkYoupiSignature, type YoupiEvent } from "@/lib/youpi";
import { applyYoupiOutcome } from "@/lib/youpi-orders";
import { logError } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text(); // the signature covers these exact bytes, so read before parsing
  const cfg = await youpiConfig();
  const bad = checkYoupiSignature(cfg.webhookSecret, raw, req.headers);
  if (bad) {
    await logError("youpi.webhook", new Error(`Rejected webhook: ${bad}`), "/api/payments/youpi");
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  let p: Record<string, unknown>;
  try { p = JSON.parse(raw); } catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const deliveryId = String(req.headers.get("x-gateway-delivery-id") || p.deliveryId || "");
  if (!deliveryId) return NextResponse.json({ ok: false, error: "Missing delivery id" }, { status: 400 });
  if (p.deliveryId && String(p.deliveryId) !== deliveryId) return NextResponse.json({ ok: false, error: "Delivery id mismatch" }, { status: 400 });

  const key = `youpi:${deliveryId}`;
  if (await db.query.gatewayDeliveries.findFirst({ where: eq(gatewayDeliveries.id, key) }))
    return NextResponse.json({ ok: true, duplicate: true });

  const event = String(p.event || req.headers.get("x-gateway-event") || "") as YoupiEvent;
  const orderNumber = String(p.orderId || "");
  try {
    const r = await applyYoupiOutcome({
      event, orderNumber, paymentId: String(p.paymentId || ""),
      amountPaise: Number(p.amountPaise), currency: String(p.currency || "INR"),
      method: p.method ? String(p.method) : undefined, settlementState: p.settlementState ? String(p.settlementState) : undefined,
      utr: p.utr ? String(p.utr) : undefined,
    }, "webhook");
    await db.insert(gatewayDeliveries).values({ id: key, provider: "youpi", event, orderNumber }).onConflictDoNothing();
    // 200 even for an unknown order or wrong amount: retrying would not change the answer.
    return NextResponse.json({ ok: true, applied: r.ok, note: r.note });
  } catch (e) {
    await logError("youpi.webhook", e, "/api/payments/youpi");
    return NextResponse.json({ ok: false }, { status: 500 }); // YouPI retries with backoff
  }
}
