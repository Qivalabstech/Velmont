// Public liveness check for uptime monitors (UptimeRobot, Better Stack). Returns 200 when the app and database respond.
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const t = Date.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok", dbMs: Date.now() - t, uptimeSec: Math.round(process.uptime()) });
  } catch {
    return Response.json({ status: "down", error: "database" }, { status: 503 });
  }
}
