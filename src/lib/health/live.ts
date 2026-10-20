import "server-only";
import { statfs, readdir, stat } from "fs/promises";
import path from "path";
import tls from "tls";
import { and, desc, gte, lt, eq, sql } from "drizzle-orm";
import { db, uptimeChecks, errorLogs, orders, visits } from "@/db";
import { paymentsMode } from "@/lib/razorpay";
import { emailConfigured } from "@/lib/email";
import { BACKUP_DIR, SITE_URL, UPLOAD_DIR } from "@/lib/env";

export const internalBase = () =>
  process.env.INTERNAL_URL || (process.env.VERCEL ? SITE_URL : `http://127.0.0.1:${process.env.PORT || 3000}`);

/** Called by /api/health. Records at most one check every 4 minutes, so an external monitor fills the uptime strip. */
export async function recordUptimeThrottled(dbMs: number) {
  const g = globalThis as unknown as { __vmLastUp?: number };
  if (g.__vmLastUp && Date.now() - g.__vmLastUp < 240_000) return;
  g.__vmLastUp = Date.now();
  const last = await db.query.uptimeChecks.findFirst({ orderBy: (u, { desc }) => [desc(u.createdAt)] });
  if (last && Date.now() - last.createdAt.getTime() < 240_000) return;
  await db.insert(uptimeChecks).values({ ok: true, latencyMs: dbMs, dbMs, note: "monitor" });
}

export async function recordUptime(note = "") {
  const t0 = Date.now();
  let dbMs = -1, ok = true, latency = -1;
  try { await db.execute(sql`select 1`); dbMs = Date.now() - t0; } catch { ok = false; }
  const t1 = Date.now();
  try {
    const r = await fetch(`${internalBase()}/`, { cache: "no-store", headers: { "user-agent": "VelmontHealthBot/1.0" }, signal: AbortSignal.timeout(15000) });
    latency = Date.now() - t1;
    if (!r.ok) ok = false;
  } catch { ok = false; }
  try { await db.insert(uptimeChecks).values({ ok, latencyMs: latency, dbMs, note }); } catch {}
  return { ok, latency, dbMs };
}

function sslExpiry(host: string): Promise<Date | null> {
  return new Promise((resolve) => {
    const s = tls.connect({ host, port: 443, servername: host, timeout: 5000 }, () => {
      const c = s.getPeerCertificate();
      s.end();
      resolve(c?.valid_to ? new Date(c.valid_to) : null);
    });
    s.on("error", () => resolve(null));
    s.on("timeout", () => { s.destroy(); resolve(null); });
  });
}

async function lastBackup() {
  try {
    const dir = path.resolve(BACKUP_DIR);
    const files = (await readdir(dir)).filter((f) => f.endsWith(".gz") || f.endsWith(".sql"));
    let latest: Date | null = null;
    for (const f of files) { const st = await stat(path.join(dir, f)); if (!latest || st.mtime > latest) latest = st.mtime; }
    return latest;
  } catch { return null; }
}

export async function liveStatus() {
  const day = new Date(Date.now() - 86400_000);
  const t0 = Date.now();
  let dbOk = true;
  try { await db.execute(sql`select 1`); } catch { dbOk = false; }
  const dbMs = Date.now() - t0;
  const [checks, [errs], [stuck], [visits24], mode, backup] = await Promise.all([
    db.select().from(uptimeChecks).where(gte(uptimeChecks.createdAt, day)).orderBy(desc(uptimeChecks.createdAt)),
    db.select({ n: sql<number>`count(*)::int` }).from(errorLogs).where(gte(errorLogs.createdAt, day)),
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.status, "PENDING_PAYMENT"), lt(orders.createdAt, new Date(Date.now() - 3 * 3600_000)))),
    db.select({ n: sql<number>`count(distinct ${visits.visitor})::int` }).from(visits).where(gte(visits.createdAt, day)),
    paymentsMode(), lastBackup(),
  ]);
  let disk: { freeGb: number; totalGb: number } | null = null;
  if (!process.env.VERCEL) try {
    const s = await statfs(path.resolve(UPLOAD_DIR)).catch(() => statfs(process.cwd()));
    disk = { freeGb: (s.bavail * s.bsize) / 1e9, totalGb: (s.blocks * s.bsize) / 1e9 };
  } catch {}
  const mem = process.memoryUsage();
  const https = SITE_URL.startsWith("https://");
  const ssl = https ? await sslExpiry(new URL(SITE_URL).hostname) : null;
  // 48 half-hour buckets for the last 24 hours, oldest first.
  const buckets = Array.from({ length: 48 }, (_, i) => {
    const from = Date.now() - (48 - i) * 1800_000, to = from + 1800_000;
    const inB = checks.filter((c) => c.createdAt.getTime() >= from && c.createdAt.getTime() < to);
    return inB.length === 0 ? "none" : inB.every((c) => c.ok) ? "ok" : "bad";
  });
  const okChecks = checks.filter((c) => c.ok);
  return {
    dbOk, dbMs, uptimePct: checks.length ? (okChecks.length / checks.length) * 100 : null, checks: checks.length,
    avgLatency: okChecks.length ? Math.round(okChecks.reduce((a, c) => a + c.latencyMs, 0) / okChecks.length) : null,
    buckets, errors24h: errs.n, stuckPending: stuck.n, visitors24h: visits24.n,
    payments: mode, email: emailConfigured(), https, sslExpires: ssl, backup,
    disk, memMb: Math.round(mem.rss / 1e6), uptimeSec: Math.round(process.uptime()), node: process.version,
    lastCheck: checks[0]?.createdAt ?? null, vercel: Boolean(process.env.VERCEL),
  };
}
