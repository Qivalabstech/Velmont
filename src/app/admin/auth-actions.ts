"use server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import { findUserByEmail, verifyPassword, startSession, endSession, clientIp, requireStaff, hashPassword, passwordProblem } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { str } from "@/lib/utils";

type S = { error?: string; ok?: string } | null;

export async function adminLogin(_: S, fd: FormData): Promise<S> {
  const ip = await clientIp();
  const email = str(fd, "email").toLowerCase();
  if (!rateLimit(`alogin:${ip}`, 8, 900_000).ok || !rateLimit(`alogin:${email}`, 5, 900_000).ok)
    return { error: "Too many attempts. Wait 15 minutes and try again." };
  const u = await findUserByEmail(email);
  if (!u || u.kind !== "STAFF" || !(await verifyPassword(str(fd, "password"), u.passwordHash))) {
    await audit(null, "login_failed", "staff", null, `Failed staff sign-in for ${email} from ${ip}`);
    return { error: "That email and password do not match a staff account." };
  }
  if (!u.active) return { error: "Your staff access has been turned off. Ask the store owner." };
  await startSession(u.id, "ADMIN");
  await audit({ id: u.id, name: u.name }, "login", "staff", u.id, `${u.name} signed in`);
  redirect("/admin");
}

export async function adminLogout() {
  await endSession("ADMIN");
  redirect("/admin/login");
}

export async function changeOwnPassword(_: S, fd: FormData): Promise<S> {
  const me = await requireStaff();
  if (!(await verifyPassword(str(fd, "current"), me.passwordHash))) return { error: "Your current password is not correct." };
  const pp = passwordProblem(str(fd, "password"));
  if (pp) return { error: pp };
  await db.update(users).set({ passwordHash: await hashPassword(str(fd, "password")) }).where(eq(users.id, me.id));
  await audit({ id: me.id, name: me.name }, "password_change", "staff", me.id, `${me.name} changed their password`);
  return { ok: "Password changed." };
}

export async function updateOwnProfile(_: S, fd: FormData): Promise<S> {
  const me = await requireStaff();
  const name = str(fd, "name");
  if (name.length < 2) return { error: "Enter your name." };
  await db.update(users).set({ name, phone: str(fd, "phone") || null }).where(eq(users.id, me.id));
  return { ok: "Profile saved." };
}
