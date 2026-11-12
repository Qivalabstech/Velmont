// Shiprocket tracking webhook. In Shiprocket → Settings → API → Webhooks, set the URL to
// https://YOURDOMAIN/api/logistics/tracking and the token to the one shown in Admin → Settings → Shipping.
// (Shiprocket rejects webhook URLs containing "shiprocket", "kartrocket", "sr" or "kr", hence this path.)
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db, orders } from "@/db";
import { shiprocketConfig } from "@/lib/shiprocket";
import { applyCourierStatus, syncTracking } from "@/lib/shiprocket-orders";
import { logError } from "@/lib/audit";

export const dynamic = "force-dynamic";

const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function POST(req: Request) {
  const cfg = await shiprocketConfig();
  if (!cfg.webhookToken || !same(req.headers.get("x-api-key") || "", cfg.webhookToken))
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });

  const p = (await req.json().catch(() => null)) as { awb?: string | number; current_status?: string; shipment_status?: string } | null;
  const awb = p?.awb ? String(p.awb).trim() : "";
  if (!awb) return NextResponse.json({ ok: true, note: "no awb" }); // Shiprocket's test ping

  try {
    const o = await db.query.orders.findFirst({ where: eq(orders.awb, awb) });
    if (!o) return NextResponse.json({ ok: true, note: "unknown awb" });
    // Re-read the status from Shiprocket's tracking API; fall back to the webhook's own text if that fails.
    try {
      const r = await syncTracking(o, "webhook");
      if (r.status) return NextResponse.json({ ok: true, status: r.status, moved: r.moved });
    } catch (e) { await logError("shiprocket.webhook.track", e); }
    const raw = String(p?.current_status || p?.shipment_status || "").trim();
    if (raw) {
      const r = await applyCourierStatus(o, raw, { source: "webhook" });
      return NextResponse.json({ ok: true, status: raw, moved: r.moved });
    }
    return NextResponse.json({ ok: true, note: "no status" });
  } catch (e) {
    await logError("shiprocket.webhook", e, "/api/logistics/tracking");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
