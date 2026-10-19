import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, sessions, users, roles } from "@/db";
import { ALL_PERMISSIONS, type Permission } from "./permissions";
import { IS_PROD } from "./env";

export const CUSTOMER_COOKIE = "vm_c";
export const ADMIN_COOKIE = "vm_a";
const CUSTOMER_TTL = 30 * 24 * 3600 * 1000;
const ADMIN_TTL = 12 * 3600 * 1000;

export const hashToken = (t: string) =>
  createHash("sha256").update(t + (process.env.AUTH_SECRET || "")).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export function passwordProblem(p: string) {
  if (p.length < 8) return "Use at least 8 characters.";
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return "Use at least one letter and one number.";
  return null;
}

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") || h.get("x-real-ip") || "").split(",")[0].trim() || "unknown";
}

export async function startSession(userId: string, kind: "CUSTOMER" | "ADMIN") {
  const token = newToken();
  const ttl = kind === "ADMIN" ? ADMIN_TTL : CUSTOMER_TTL;
  const h = await headers();
  await db.insert(sessions).values({
    tokenHash: hashToken(token), userId, kind,
    expiresAt: new Date(Date.now() + ttl),
    ip: await clientIp(), userAgent: (h.get("user-agent") || "").slice(0, 300),
  });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  const jar = await cookies();
  jar.set(kind === "ADMIN" ? ADMIN_COOKIE : CUSTOMER_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: IS_PROD, path: "/", maxAge: ttl / 1000,
  });
  // tidy expired sessions occasionally
  if (Math.random() < 0.05) await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export async function endSession(kind: "CUSTOMER" | "ADMIN") {
  const jar = await cookies();
  const name = kind === "ADMIN" ? ADMIN_COOKIE : CUSTOMER_COOKIE;
  const token = jar.get(name)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  jar.delete(name);
}

async function userFromCookie(kind: "CUSTOMER" | "ADMIN") {
  const jar = await cookies();
  const token = jar.get(kind === "ADMIN" ? ADMIN_COOKIE : CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  const row = await db.query.sessions.findFirst({
    where: and(eq(sessions.tokenHash, hashToken(token)), eq(sessions.kind, kind), gt(sessions.expiresAt, new Date())),
    with: { user: { with: { role: true } } },
  });
  if (!row || !row.user.active) return null;
  return row.user;
}

export const getCustomer = cache(async () => {
  const u = await userFromCookie("CUSTOMER");
  return u && u.kind === "CUSTOMER" ? u : null;
});

export type StaffUser = NonNullable<Awaited<ReturnType<typeof userFromCookie>>> & { perms: Set<Permission> };

export const getStaff = cache(async (): Promise<StaffUser | null> => {
  const u = await userFromCookie("ADMIN");
  if (!u || u.kind !== "STAFF") return null;
  const perms = new Set<Permission>(
    u.isOwner ? ALL_PERMISSIONS : ((u.role?.permissions || []) as Permission[]),
  );
  return { ...u, perms };
});

export async function requireCustomer(next = "/account") {
  const u = await getCustomer();
  if (!u) redirect(`/account/login?next=${encodeURIComponent(next)}`);
  return u;
}

/** Use at the top of every admin page and server action. */
export async function requireStaff(perm?: Permission) {
  const u = await getStaff();
  if (!u) redirect("/admin/login");
  if (perm && !u.perms.has(perm)) redirect("/admin/no-access");
  return u;
}

/** For server actions: throws instead of redirecting, so the form shows an error. */
export async function assertStaff(perm: Permission) {
  const u = await getStaff();
  if (!u) throw new Error("Your session has ended. Sign in again.");
  if (!u.perms.has(perm)) throw new Error("Your role does not allow this action.");
  return u;
}

export async function findUserByEmail(email: string) {
  return db.query.users.findFirst({ where: eq(users.email, email.toLowerCase().trim()) });
}

export async function roleNames() {
  return db.select({ id: roles.id, name: roles.name }).from(roles);
}
