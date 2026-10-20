// Scheduled jobs. Vercel calls GET /api/cron daily (see vercel.json) with "Authorization: Bearer CRON_SECRET".
// Other schedulers can call /api/cron?job=daily&token=CRON_SECRET. Jobs: daily (default), audit, uptime, release.
import { releaseExpiredOrders } from "@/lib/orders";
import { runSiteAudit } from "@/lib/health/audit";
import { recordUptime } from "@/lib/health/live";
import { runDailyNow } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || (auth !== `Bearer ${secret}` && u.searchParams.get("token") !== secret)) return new Response("Forbidden", { status: 403 });
  const job = u.searchParams.get("job") || "daily";
  if (job === "audit") { const r = await runSiteAudit("cron"); return Response.json({ seo: r.seo.score, aeo: r.aeo.score, geo: r.geo.score }); }
  if (job === "uptime") return Response.json(await recordUptime("cron"));
  if (job === "release") return Response.json({ released: await releaseExpiredOrders() });
  await runDailyNow();
  return Response.json({ ok: true, job: "daily" });
}
