"use server";
import { randomBytes } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, users, roles, sessions } from "@/db";
import { run, type ActionState } from "@/lib/admin-action";
import { hashPassword, findUserByEmail, passwordProblem } from "@/lib/auth";
import { mailStaffInvite } from "@/lib/email";
import { emailConfigured } from "@/lib/email";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions";
import { str, bool, isEmail } from "@/lib/utils";

const tempPassword = () => randomBytes(9).toString("base64url").replace(/[-_]/g, "x") + "7";

export async function addStaff(_: ActionState, fd: FormData) {
  return run("staff.manage", async () => {
    const name = str(fd, "name"), email = str(fd, "email").toLowerCase(), roleId = str(fd, "roleId");
    if (name.length < 2 || !isEmail(email)) return { error: "Enter a name and a valid email." };
    const role = await db.query.roles.findFirst({ where: eq(roles.id, roleId) });
    if (!role) return { error: "Choose a role." };
    const existing = await findUserByEmail(email);
    if (existing) return { error: existing.kind === "STAFF" ? "This person is already on the team." : "This email belongs to a customer account. Use a different email for staff access." };
    let pw = str(fd, "password");
    if (pw) { const pp = passwordProblem(pw); if (pp) return { error: pp }; } else pw = tempPassword();
    await db.insert(users).values({ name, email, kind: "STAFF", roleId, passwordHash: await hashPassword(pw), phone: str(fd, "phone") || null });
    await mailStaffInvite(email, name.split(" ")[0], role.name, pw);
    const note = emailConfigured() ? "We emailed them their sign-in details." : `Email is not set up, so share this temporary password with them: ${pw}`;
    return { ok: `${name} added as ${role.name}. ${note}`, log: { action: "create", entity: "staff", summary: `Added ${email} as ${role.name}` } };
  });
}

export async function updateStaff(_: ActionState, fd: FormData) {
  return run("staff.manage", async (me) => {
    const id = str(fd, "id");
    const u = await db.query.users.findFirst({ where: and(eq(users.id, id), eq(users.kind, "STAFF")) });
    if (!u) return { error: "Staff member not found." };
    if (u.isOwner && !me.isOwner) return { error: "Only the owner can change the owner account." };
    if (u.id === me.id && !bool(fd, "active")) return { error: "You cannot turn off your own access." };
    const roleId = str(fd, "roleId") || null;
    await db.update(users).set({ roleId: u.isOwner ? u.roleId : roleId, active: u.isOwner ? true : bool(fd, "active"), name: str(fd, "name") || u.name }).where(eq(users.id, id));
    if (!bool(fd, "active") && !u.isOwner) await db.delete(sessions).where(eq(sessions.userId, id));
    return { ok: "Staff member updated.", log: { action: "update", entity: "staff", id, summary: `${u.email}: ${bool(fd, "active") ? "active" : "access off"}` } };
  });
}

export async function resetStaffPassword(_: ActionState, fd: FormData) {
  return run("staff.manage", async (me) => {
    const u = await db.query.users.findFirst({ where: and(eq(users.id, str(fd, "id")), eq(users.kind, "STAFF")) });
    if (!u) return { error: "Staff member not found." };
    if (u.isOwner && !me.isOwner) return { error: "Only the owner can reset the owner password." };
    const pw = tempPassword();
    await db.update(users).set({ passwordHash: await hashPassword(pw) }).where(eq(users.id, u.id));
    await db.delete(sessions).where(eq(sessions.userId, u.id));
    return { ok: `New temporary password for ${u.name}: ${pw}  (they should change it from My account)`, log: { action: "password_reset", entity: "staff", id: u.id, summary: u.email } };
  });
}

export async function removeStaff(_: ActionState, fd: FormData) {
  return run("staff.manage", async (me) => {
    const u = await db.query.users.findFirst({ where: and(eq(users.id, str(fd, "id")), eq(users.kind, "STAFF")) });
    if (!u) return { error: "Staff member not found." };
    if (u.isOwner) return { error: "The owner account cannot be removed." };
    if (u.id === me.id) return { error: "You cannot remove yourself." };
    await db.delete(users).where(eq(users.id, u.id));
    return { ok: `${u.name} removed from the team.`, log: { action: "delete", entity: "staff", id: u.id, summary: u.email } };
  });
}

export async function saveRole(_: ActionState, fd: FormData) {
  return run("staff.manage", async () => {
    const id = str(fd, "id"), name = str(fd, "name");
    if (name.length < 2) return { error: "Name the role." };
    const perms = fd.getAll("perms").map(String).filter((p): p is Permission => (ALL_PERMISSIONS as string[]).includes(p));
    if (!perms.length) return { error: "Tick at least one permission." };
    const clash = await db.query.roles.findFirst({ where: eq(roles.name, name) });
    if (clash && clash.id !== id) return { error: "A role with this name already exists." };
    const data = { name, description: str(fd, "description"), permissions: perms };
    if (id) await db.update(roles).set(data).where(eq(roles.id, id)); else await db.insert(roles).values(data);
    return { ok: `Role “${name}” saved. Changes apply on the staff member's next page load.`, log: { action: id ? "update" : "create", entity: "role", id: id || null, summary: `${name}: ${perms.join(", ")}`.slice(0, 480) } };
  });
}

export async function deleteRole(_: ActionState, fd: FormData) {
  return run("staff.manage", async () => {
    const id = str(fd, "id");
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.roleId, id));
    if (n) return { error: `${n} staff member${n > 1 ? "s" : ""} still use this role. Move them to another role first.` };
    const [r] = await db.delete(roles).where(eq(roles.id, id)).returning();
    return { ok: "Role deleted.", log: { action: "delete", entity: "role", id, summary: r?.name || "" } };
  });
}
