"use server";
import { eq } from "drizzle-orm";
import { db, contactMessages } from "@/db";
import { run, type ActionState } from "@/lib/admin-action";
import { str, bool } from "@/lib/utils";
export async function markHandled(_: ActionState, fd: FormData) {
  return run("content.manage", async () => {
    await db.update(contactMessages).set({ handled: bool(fd, "handled") }).where(eq(contactMessages.id, str(fd, "id")));
    return { ok: bool(fd, "handled") ? "Marked done." : "Moved back to inbox." };
  });
}
