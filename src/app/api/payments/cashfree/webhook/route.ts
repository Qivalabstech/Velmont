// Cashfree webhook. In the Cashfree dashboard (Developers → Webhooks) add
// https://YOURDOMAIN/api/payments/cashfree/webhook for Payment events.
// The body is trusted only after the signature checks out, and even then the order is re-read from Cashfree's API.
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db, gatewayDeliveries } from "@/db";
import { cashfreeKeys, checkCashfreeSignature } from "@/lib/cashfree";
import { confirmCashfreeOrder, findCashfreeOrder } from "@/lib/cashfree-orders";
import { addOrderEvent } from "@/lib/orders";
import { logError } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Body = { type?: string; data?: { order?: { order_id?: string }; payment?: { payment_status?: string; payment_message?: string }; error_details?: { error_description?: string; error_reason?: string } } };

export async function POST(req: Request) {
  const raw = await req.text(); // the signature covers the exact bytes, so read before parsing
  const ts = req.headers.get("x-webhook-timestamp");
  const sig = req.headers.get("x-webhook-signature");
  const { secret } = await cashfreeKeys();
  if (!checkCashfreeSignature(secret, raw, ts, sig)) {
    await logError("cashfree.webhook", new Error("Rejected webhook: signature does not match."), "/api/payments/cashfree/webhook");
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }
  let p: Body;
  try { p = JSON.parse(raw); } catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const key = `cashfree:${req.headers.get("x-idempotency-header") || createHash("sha256").update(`${ts}.${raw}`).digest("hex")}`;
  if (await db.query.gatewayDeliveries.findFirst({ where: eq(gatewayDeliveries.id, key) }))
    return NextResponse.json({ ok: true, duplicate: true });

  const type = String(p.type || "");
  const cfOrderId = String(p.data?.order?.order_id || "");
  try {
    const o = cfOrderId ? await findCashfreeOrder(cfOrderId) : undefined;
    let note = "ignored";
    if (o && type === "PAYMENT_SUCCESS_WEBHOOK") {
      note = await confirmCashfreeOrder(o, "webhook");
      // Cashfree's order API not showing PAID yet (or not reachable): ask Cashfree to retry later.
      if (note === "pending") return NextResponse.json({ ok: false, note }, { status: 503 });
    } else if (o && (type === "PAYMENT_FAILED_WEBHOOK" || type === "PAYMENT_USER_DROPPED_WEBHOOK") && o.paymentStatus === "PENDING") {
      const why = p.data?.error_details?.error_description || p.data?.payment?.payment_message || "";
      await addOrderEvent(o.id, `Cashfree: payment ${type === "PAYMENT_FAILED_WEBHOOK" ? "failed" : "abandoned by the customer"}${why ? ` (${why})` : ""}. The customer can try again from their order page.`, "Cashfree (webhook)");
      note = "logged";
    }
    await db.insert(gatewayDeliveries).values({ id: key, provider: "cashfree", event: type || "unknown", orderNumber: o?.number ?? null }).onConflictDoNothing();
    return NextResponse.json({ ok: true, note });
  } catch (e) {
    await logError("cashfree.webhook", e, "/api/payments/cashfree/webhook");
    return NextResponse.json({ ok: false }, { status: 500 }); // Cashfree retries
  }
}
