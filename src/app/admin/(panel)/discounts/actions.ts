"use server";
import { eq } from "drizzle-orm";
import { db, coupons } from "@/db";
import { run, type ActionState } from "@/lib/admin-action";
import { str, num, bool } from "@/lib/utils";
import { toPaise } from "@/lib/money";

export async function saveCoupon(_: ActionState, fd: FormData) {
  return run("marketing.manage", async () => {
    const id = str(fd, "id");
    const code = str(fd, "code").toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (code.length < 3) return { error: "Use a code of at least 3 letters or numbers." };
    const type = str(fd, "type") as "PERCENT" | "FIXED" | "FREE_SHIPPING";
    const value = type === "PERCENT" ? num(fd, "value") : type === "FIXED" ? toPaise(num(fd, "value")) : 0;
    if (type === "PERCENT" && (value < 1 || value > 90)) return { error: "Percent off must be between 1 and 90." };
    if (type === "FIXED" && value <= 0) return { error: "Enter the rupee amount off." };
    const clash = await db.query.coupons.findFirst({ where: eq(coupons.code, code) });
    if (clash && clash.id !== id) return { error: `Code ${code} already exists.` };
    const data = {
      code, type, value, description: str(fd, "description"),
      minSubtotal: toPaise(num(fd, "minSubtotal")), maxDiscount: str(fd, "maxDiscount") ? toPaise(num(fd, "maxDiscount")) : null,
      usageLimit: str(fd, "usageLimit") ? num(fd, "usageLimit") : null, perCustomerLimit: str(fd, "perCustomerLimit") ? num(fd, "perCustomerLimit") : null,
      startsAt: str(fd, "startsAt") ? new Date(`${str(fd, "startsAt")}T00:00:00+05:30`) : null,
      endsAt: str(fd, "endsAt") ? new Date(`${str(fd, "endsAt")}T23:59:59+05:30`) : null,
      active: bool(fd, "active"),
    };
    if (id) await db.update(coupons).set(data).where(eq(coupons.id, id)); else await db.insert(coupons).values(data);
    return { ok: id ? `Code ${code} saved.` : `Code ${code} created.`, log: { action: id ? "update" : "create", entity: "coupon", id: id || null, summary: code } };
  });
}

export async function deleteCoupon(_: ActionState, fd: FormData) {
  return run("marketing.manage", async () => {
    const [c] = await db.delete(coupons).where(eq(coupons.id, str(fd, "id"))).returning();
    return { ok: "Code deleted.", log: { action: "delete", entity: "coupon", id: c?.id, summary: c?.code || "" } };
  });
}
