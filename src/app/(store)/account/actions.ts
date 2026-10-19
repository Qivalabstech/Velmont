"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, users, addresses, passwordResets, carts } from "@/db";
import {
  findUserByEmail, hashPassword, verifyPassword, startSession, endSession, getCustomer, requireCustomer,
  passwordProblem, clientIp, newToken, hashToken,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { mailPasswordReset, mailWelcome } from "@/lib/email";
import { getCartRecord } from "@/lib/cart";
import { SITE_URL } from "@/lib/env";
import { INDIAN_STATES, isEmail, normPhone, str, bool } from "@/lib/utils";

type State = { error?: string; ok?: string } | null;
const safeNext = (n: string) => (n.startsWith("/") && !n.startsWith("//") ? n : "/account");

async function attachCart(userId: string, email: string) {
  const cart = await getCartRecord(false);
  if (cart) await db.update(carts).set({ userId, email }).where(eq(carts.id, cart.id));
}

export async function login(_: State, fd: FormData): Promise<State> {
  const ip = await clientIp();
  const email = str(fd, "email").toLowerCase();
  if (!rateLimit(`login:${ip}`, 10, 900_000).ok || !rateLimit(`login:${email}`, 6, 900_000).ok)
    return { error: "Too many attempts. Wait 15 minutes and try again." };
  const u = await findUserByEmail(email);
  if (!u || u.kind !== "CUSTOMER" || !(await verifyPassword(str(fd, "password"), u.passwordHash)))
    return { error: "That email and password do not match." };
  if (!u.active) return { error: "This account is blocked. Contact us for help." };
  await startSession(u.id, "CUSTOMER");
  await attachCart(u.id, u.email);
  redirect(safeNext(str(fd, "next")));
}

export async function register(_: State, fd: FormData): Promise<State> {
  const ip = await clientIp();
  if (!rateLimit(`register:${ip}`, 5, 3600_000).ok) return { error: "Too many sign-ups from this network. Try again later." };
  const name = str(fd, "name"), email = str(fd, "email").toLowerCase(), password = str(fd, "password");
  const phone = normPhone(str(fd, "phone"));
  if (name.length < 2) return { error: "Enter your name." };
  if (!isEmail(email)) return { error: "Enter a valid email address." };
  if (phone && !/^[6-9]\d{9}$/.test(phone)) return { error: "Enter a 10-digit mobile number, or leave it empty." };
  const pp = passwordProblem(password);
  if (pp) return { error: pp };
  if (await findUserByEmail(email)) return { error: "An account with this email already exists. Sign in instead." };
  const [u] = await db.insert(users).values({
    name, email, phone: phone || null, passwordHash: await hashPassword(password), marketingOptIn: bool(fd, "optin"),
  }).returning();
  await startSession(u.id, "CUSTOMER");
  await attachCart(u.id, u.email);
  await mailWelcome(email, name.split(" ")[0]).catch(() => {});
  redirect(safeNext(str(fd, "next")));
}

export async function logout() {
  await endSession("CUSTOMER");
  redirect("/");
}

export async function forgot(_: State, fd: FormData): Promise<State> {
  const ip = await clientIp();
  if (!rateLimit(`forgot:${ip}`, 5, 3600_000).ok) return { error: "Too many requests. Try again later." };
  const email = str(fd, "email").toLowerCase();
  const u = await findUserByEmail(email);
  if (u && u.active) {
    const token = newToken();
    await db.insert(passwordResets).values({ tokenHash: hashToken(token), userId: u.id, expiresAt: new Date(Date.now() + 3600_000) });
    const base = u.kind === "STAFF" ? "/admin/reset" : "/account/reset";
    await mailPasswordReset(u.email, u.name.split(" ")[0], `${SITE_URL}${base}?token=${token}`, u.kind === "STAFF");
  }
  return { ok: "If that email has an account, a reset link is on its way. Check your inbox and spam folder." };
}

export async function resetPassword(_: State, fd: FormData): Promise<State> {
  const token = str(fd, "token"), password = str(fd, "password");
  const pp = passwordProblem(password);
  if (pp) return { error: pp };
  const r = await db.query.passwordResets.findFirst({
    where: and(eq(passwordResets.tokenHash, hashToken(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())),
  });
  if (!r) return { error: "This link has expired or was already used. Ask for a new one." };
  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, r.userId));
  await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, r.id));
  return { ok: "Password changed. You can sign in now." };
}

export async function updateProfile(_: State, fd: FormData): Promise<State> {
  const c = await requireCustomer();
  const name = str(fd, "name"), phone = normPhone(str(fd, "phone"));
  if (name.length < 2) return { error: "Enter your name." };
  if (phone && !/^[6-9]\d{9}$/.test(phone)) return { error: "Enter a 10-digit mobile number." };
  await db.update(users).set({ name, phone: phone || null, marketingOptIn: bool(fd, "optin") }).where(eq(users.id, c.id));
  revalidatePath("/account");
  return { ok: "Profile saved." };
}

export async function changePassword(_: State, fd: FormData): Promise<State> {
  const c = await requireCustomer();
  if (!(await verifyPassword(str(fd, "current"), c.passwordHash))) return { error: "Your current password is not correct." };
  const pp = passwordProblem(str(fd, "password"));
  if (pp) return { error: pp };
  await db.update(users).set({ passwordHash: await hashPassword(str(fd, "password")) }).where(eq(users.id, c.id));
  return { ok: "Password changed." };
}

export async function saveAddress(_: State, fd: FormData): Promise<State> {
  const c = await requireCustomer();
  const a = {
    name: str(fd, "name"), phone: normPhone(str(fd, "phone")), line1: str(fd, "line1"), line2: str(fd, "line2"),
    city: str(fd, "city"), state: str(fd, "state"), pincode: str(fd, "pincode"),
  };
  if (a.name.length < 2 || a.line1.length < 5 || a.city.length < 2) return { error: "Fill in the name, street and city." };
  if (!/^[6-9]\d{9}$/.test(a.phone)) return { error: "Enter a 10-digit mobile number." };
  if (!/^[1-9]\d{5}$/.test(a.pincode)) return { error: "Enter a 6-digit pincode." };
  if (!INDIAN_STATES.includes(a.state)) return { error: "Choose a state." };
  const id = str(fd, "id");
  const makeDefault = bool(fd, "isDefault");
  if (makeDefault) await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, c.id));
  if (id) await db.update(addresses).set({ ...a, ...(makeDefault ? { isDefault: true } : {}) }).where(and(eq(addresses.id, id), eq(addresses.userId, c.id)));
  else {
    const has = await db.query.addresses.findFirst({ where: eq(addresses.userId, c.id) });
    await db.insert(addresses).values({ ...a, userId: c.id, isDefault: makeDefault || !has });
  }
  revalidatePath("/account/addresses");
  return { ok: "Address saved." };
}

export async function deleteAddress(fd: FormData) {
  const c = await requireCustomer();
  await db.delete(addresses).where(and(eq(addresses.id, str(fd, "id")), eq(addresses.userId, c.id)));
  revalidatePath("/account/addresses");
}

export async function makeDefaultAddress(fd: FormData) {
  const c = await requireCustomer();
  await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, c.id));
  await db.update(addresses).set({ isDefault: true }).where(and(eq(addresses.id, str(fd, "id")), eq(addresses.userId, c.id)));
  revalidatePath("/account/addresses");
}

export async function currentCustomerName() {
  return (await getCustomer())?.name ?? null;
}
