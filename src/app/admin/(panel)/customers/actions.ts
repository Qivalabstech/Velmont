"use server";
import { eq } from "drizzle-orm";
import { db, users, sessions } from "@/db";
import { run, type ActionState } from "@/lib/admin-action";
import { str, bool } from "@/lib/utils";

export async function setCustomerActive(_: ActionState, fd: FormData) {
  return run("customers.manage", async () => {
    const id = str(fd, "id"), active = bool(fd, "active");
    const [u] = await db.update(users).set({ active }).where(eq(users.id, id)).returning();
    if (!active) await db.delete(sessions).where(eq(sessions.userId, id));
    return { ok: active ? "Customer unblocked." : "Customer blocked and signed out.", log: { action: active ? "unblock" : "block", entity: "customer", id, summary: u.email } };
  });
}

export async function editCustomer(_: ActionState, fd: FormData) {
  return run("customers.manage", async () => {
    const id = str(fd, "id");
    const [u] = await db.update(users).set({ name: str(fd, "name"), phone: str(fd, "phone") || null, marketingOptIn: bool(fd, "optin") }).where(eq(users.id, id)).returning();
    return { ok: "Customer saved.", log: { action: "update", entity: "customer", id, summary: u.email } };
  });
}
