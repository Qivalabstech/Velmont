import "server-only";
import { createHash } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";

// Rate limits live in Postgres so they hold across every server instance (Vercel runs many short-lived ones).
// If the database is unreachable, fall back to a per-instance memory counter rather than blocking customers.
const memory = new Map<string, { count: number; reset: number }>();

function memoryLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = memory.get(key);
  if (!b || b.reset < now) { memory.set(key, { count: 1, reset: now + windowMs }); return { ok: true, retryInSec: 0 }; }
  b.count++;
  if (memory.size > 5000) for (const [k, v] of memory) if (v.reset < now) memory.delete(k);
  return { ok: b.count <= limit, retryInSec: Math.ceil((b.reset - now) / 1000) };
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryInSec: number }> {
  const k = createHash("sha256").update(key.toLowerCase()).digest("hex");
  try {
    const r = await db.execute<{ count: number; reset_at: Date }>(sql`
      insert into rate_limits (key, count, reset_at) values (${k}, 1, now() + (${windowMs} * interval '1 millisecond'))
      on conflict (key) do update set
        count = case when rate_limits.reset_at < now() then 1 else rate_limits.count + 1 end,
        reset_at = case when rate_limits.reset_at < now() then excluded.reset_at else rate_limits.reset_at end
      returning count, reset_at`);
    const row = r.rows[0];
    const retry = Math.max(0, Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000));
    return { ok: Number(row.count) <= limit, retryInSec: retry };
  } catch {
    return memoryLimit(k, limit, windowMs);
  }
}

/** Clears a counter, e.g. after a successful sign-in. */
export async function resetRateLimit(key: string) {
  const k = createHash("sha256").update(key.toLowerCase()).digest("hex");
  await db.execute(sql`delete from rate_limits where key = ${k}`).catch(() => {});
}
