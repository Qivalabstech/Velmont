// Public liveness check for uptime monitors (UptimeRobot, Better Stack). Returns 200 when the app and database respond.
// Each call (at most one every 4 minutes) is also stored, which fills the uptime strip on Admin > Site health.
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { recordUptimeThrottled } from "@/lib/health/live";

export const dynamic = "force-dynamic";

export async function GET() {
  const t = Date.now();
  try {
    await db.execute(sql`select 1`);
    const dbMs = Date.now() - t;
    await recordUptimeThrottled(dbMs).catch(() => {});
    return Response.json({ status: "ok", dbMs, uptimeSec: Math.round(process.uptime()) });
  } catch {
    return Response.json({ status: "down", error: "database" }, { status: 503 });
  }
}
