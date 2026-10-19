"use server";
import { eq } from "drizzle-orm";
import { db, reviews } from "@/db";
import { run, type ActionState } from "@/lib/admin-action";
import { str } from "@/lib/utils";

export async function moderate(_: ActionState, fd: FormData) {
  return run("reviews.manage", async () => {
    const id = str(fd, "id"), to = str(fd, "to");
    if (to === "DELETE") {
      const [r] = await db.delete(reviews).where(eq(reviews.id, id)).returning();
      return { ok: "Review deleted.", log: { action: "delete", entity: "review", id, summary: `${r?.name}: ${r?.rating}★` } };
    }
    if (to !== "APPROVED" && to !== "REJECTED" && to !== "PENDING") return { error: "Unknown action." };
    const [r] = await db.update(reviews).set({ status: to }).where(eq(reviews.id, id)).returning();
    return { ok: to === "APPROVED" ? "Review published." : to === "REJECTED" ? "Review hidden." : "Moved back to pending.", log: { action: to.toLowerCase(), entity: "review", id, summary: `${r.name}: ${r.rating}★` }, revalidate: ["/shop"] };
  });
}
