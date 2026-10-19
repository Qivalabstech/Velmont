import "server-only";
import { revalidatePath } from "next/cache";
import { assertStaff, type StaffUser } from "./auth";
import { audit, logError } from "./audit";
import type { Permission } from "./permissions";

export type ActionState = { ok?: string; error?: string; at?: number } | null;

/** Wraps an admin server action: checks permission, catches errors, records the activity log. */
export async function run(
  perm: Permission,
  fn: (staff: StaffUser) => Promise<{ ok: string; log?: { action: string; entity: string; id?: string | null; summary: string }; revalidate?: string[] } | { error: string }>,
): Promise<ActionState> {
  try {
    const staff = await assertStaff(perm);
    const r = await fn(staff);
    if ("error" in r) return { error: r.error, at: Date.now() };
    if (r.log) await audit({ id: staff.id, name: staff.name }, r.log.action, r.log.entity, r.log.id ?? null, r.log.summary);
    (r.revalidate || []).forEach((p) => revalidatePath(p));
    revalidatePath("/admin", "layout"); // fresh data in the same response, so saved forms show saved values

    return { ok: r.ok, at: Date.now() };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
    await logError("admin", e);
    return { error: e instanceof Error ? e.message : "Something went wrong.", at: Date.now() };
  }
}
