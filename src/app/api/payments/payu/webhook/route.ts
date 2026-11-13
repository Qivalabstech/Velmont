// PayU payment webhook. In the PayU dashboard (Developers → Webhooks) add
// https://YOURDOMAIN/api/payments/payu/webhook for "Successful" and "Failed" payment events.
// The body is trusted only after its hash checks out with the Salt, and even then the status is re-read from PayU.
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db, gatewayDeliveries } from "@/db";
import { checkPayuResponseHash, payuKeys } from "@/lib/payu";
import { confirmPayuOrder, findOrderForTxn } from "@/lib/payu-orders";
import { addOrderEvent } from "@/lib/orders";
import { logError } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  const b: Record<string, string> = {};
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("json")) Object.assign(b, JSON.parse(raw));
    else new URLSearchParams(raw).forEach((v, k) => { b[k] = v; });
  } catch { return NextResponse.json({ ok: false, error: "Unreadable body" }, { status: 400 }); }
  for (const k of Object.keys(b)) b[k] = String(b[k] ?? "");

  const { key, salt } = await payuKeys();
  if (!b.txnid) return NextResponse.json({ ok: true, note: "ignored" }); // refund/dispute events or a test ping
  if (!checkPayuResponseHash(key, salt, b)) {
    await logError("payu.webhook", new Error("Rejected webhook: hash does not match."), "/api/payments/payu/webhook");
    return NextResponse.json({ ok: false, error: "Invalid hash" }, { status: 401 });
  }
  const id = `payu:${createHash("sha256").update(raw).digest("hex")}`;
  if (await db.query.gatewayDeliveries.findFirst({ where: eq(gatewayDeliveries.id, id) })) return NextResponse.json({ ok: true, duplicate: true });
  try {
    const o = await findOrderForTxn(b.txnid);
    let note = "ignored";
    const status = (b.status || "").toLowerCase();
    if (o && status === "success") {
      note = await confirmPayuOrder(o, "webhook", b.txnid);
      if (note === "pending") return NextResponse.json({ ok: false, note }, { status: 503 }); // PayU's API not caught up: retry
    } else if (o && status === "failure" && o.paymentStatus === "PENDING") {
      await addOrderEvent(o.id, `PayU: payment failed${b.error_Message || b.field9 ? ` (${b.error_Message || b.field9})` : ""}. The customer can try again from their order page.`, "PayU (webhook)");
      note = "logged";
    }
    await db.insert(gatewayDeliveries).values({ id, provider: "payu", event: status || "unknown", orderNumber: o?.number ?? null }).onConflictDoNothing();
    return NextResponse.json({ ok: true, note });
  } catch (e) {
    await logError("payu.webhook", e, "/api/payments/payu/webhook");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
