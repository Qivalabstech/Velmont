import { db, auditLogs, errorLogs } from "@/db";
import { headers } from "next/headers";

type Actor = { id: string; name: string } | null;

export async function audit(actor: Actor, action: string, entity: string, entityId: string | null, summary: string) {
  let ip: string | null = null;
  try {
    const h = await headers();
    ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  } catch {}
  await db.insert(auditLogs).values({
    actorId: actor?.id ?? null, actorName: actor?.name ?? "System",
    action, entity, entityId, summary: summary.slice(0, 500), ip,
  });
}

export async function logError(source: string, err: unknown, path = "") {
  const message = err instanceof Error ? `${err.message}` : String(err);
  console.error(`[${source}]`, err);
  try {
    await db.insert(errorLogs).values({ source, message: message.slice(0, 1000), path });
  } catch {}
}
