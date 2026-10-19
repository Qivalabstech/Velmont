import { lt } from "drizzle-orm";
import { db, uptimeChecks, visits, sessions, errorLogs, carts } from "@/db";
import { releaseExpiredOrders } from "./orders";
import { recordUptime } from "./health/live";
import { runSiteAudit } from "./health/audit";
import { runPageSpeed, pagespeedAvailable } from "./health/pagespeed";
import { logError } from "./audit";

let lastDaily = "";

async function every5min() {
  try { await releaseExpiredOrders(); } catch (e) { await logError("scheduler.release", e); }
  try { await recordUptime(); } catch (e) { await logError("scheduler.uptime", e); }
}

async function daily() {
  const ago = (d: number) => new Date(Date.now() - d * 86400_000);
  try {
    await db.delete(uptimeChecks).where(lt(uptimeChecks.createdAt, ago(30)));
    await db.delete(visits).where(lt(visits.createdAt, ago(400)));
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
    await db.delete(errorLogs).where(lt(errorLogs.createdAt, ago(90)));
    await db.delete(carts).where(lt(carts.updatedAt, ago(60)));
  } catch (e) { await logError("scheduler.cleanup", e); }
  try { await runSiteAudit("nightly"); } catch (e) { await logError("scheduler.audit", e); }
  if (pagespeedAvailable()) {
    try { await runPageSpeed("mobile", "/", "nightly"); } catch (e) { await logError("scheduler.pagespeed", e); }
  }
}

export function startScheduler() {
  // First run shortly after boot, once the server is accepting requests.
  setTimeout(every5min, 20_000);
  setInterval(every5min, 5 * 60_000);
  setInterval(() => {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const key = now.toDateString();
    if (now.getHours() === 3 && lastDaily !== key) { lastDaily = key; daily(); }
  }, 10 * 60_000);
  console.log("[velmont] background scheduler started");
}

export const runDailyNow = daily;
