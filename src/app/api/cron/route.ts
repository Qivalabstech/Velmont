// Optional: trigger jobs from an external scheduler. GET /api/cron?job=audit&token=CRON_SECRET
import { releaseExpiredOrders } from "@/lib/orders";
import { runSiteAudit } from "@/lib/health/audit";
import { recordUptime } from "@/lib/health/live";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const u = new URL(req.url);
  if (!process.env.CRON_SECRET || u.searchParams.get("token") !== process.env.CRON_SECRET) return new Response("Forbidden", { status: 403 });
  const job = u.searchParams.get("job");
  if (job === "audit") { const r = await runSiteAudit("cron"); return Response.json({ seo: r.seo.score, aeo: r.aeo.score, geo: r.geo.score }); }
  if (job === "uptime") return Response.json(await recordUptime("cron"));
  return Response.json({ released: await releaseExpiredOrders() });
}
