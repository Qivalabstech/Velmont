// First-party page-view counter for the dashboard. Stores a daily anonymous visitor hash, never an IP.
import { createHash } from "crypto";
import { db, visits } from "@/db";

const BOTS = /bot|crawl|spider|slurp|lighthouse|headless|preview|facebookexternalhit|whatsapp/i;

export async function POST(req: Request) {
  try {
    const ua = req.headers.get("user-agent") || "";
    if (BOTS.test(ua)) return new Response(null, { status: 204 });
    const { path = "/", ref = "" } = await req.json().catch(() => ({}));
    if (typeof path !== "string" || path.startsWith("/admin")) return new Response(null, { status: 204 });
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    const day = new Date().toISOString().slice(0, 10);
    const visitor = createHash("sha256").update(`${ip}|${ua}|${day}|${process.env.AUTH_SECRET}`).digest("hex").slice(0, 20);
    let referrer = "";
    try { const h = new URL(ref).hostname; if (h && !ref.includes(req.headers.get("host") || "~")) referrer = h; } catch {}
    await db.insert(visits).values({ path: path.slice(0, 200), referrer, visitor, device: /mobile|android|iphone/i.test(ua) ? "mobile" : "desktop" });
  } catch {}
  return new Response(null, { status: 204 });
}
