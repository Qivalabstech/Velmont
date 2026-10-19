"use server";
import { eq } from "drizzle-orm";
import { db, variants } from "@/db";
import { run, type ActionState } from "@/lib/admin-action";

export async function saveStock(_: ActionState, fd: FormData) {
  return run("inventory.manage", async () => {
    const changes: string[] = [];
    for (const [k, v] of fd.entries()) {
      if (!k.startsWith("stock:")) continue;
      const id = k.slice(6), n = Number(v), before = Number(fd.get(`was:${id}`));
      if (!Number.isInteger(n) || n < 0) return { error: "Stock must be a whole number, 0 or more." };
      if (n !== before) {
        const [row] = await db.update(variants).set({ stock: n }).where(eq(variants.id, id)).returning();
        changes.push(`${row.sku} ${before}→${n}`);
      }
    }
    if (!changes.length) return { ok: "No stock levels changed." };
    return { ok: `Updated ${changes.length} size${changes.length > 1 ? "s" : ""}.`, log: { action: "stock", entity: "inventory", summary: changes.join(", ").slice(0, 480) }, revalidate: ["/shop"] };
  });
}
