import "server-only";
import nodemailer from "nodemailer";
import { db, emailLogs } from "@/db";
import { SITE_URL } from "./env";
import { inr } from "./money";
import { getSettings } from "./settings";
import { STATUS_LABEL } from "./order-status";

let transport: nodemailer.Transporter | null = null;
export const emailConfigured = () => Boolean(process.env.SMTP_HOST);

function getTransport() {
  if (!emailConfigured()) return null;
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function layout(title: string, body: string) {
  const s = await getSettings();
  return `<!doctype html><html><body style="margin:0;background:#ECEBE6;font-family:Helvetica,Arial,sans-serif;color:#1C1714">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#F7F6F2;border:1px solid #d9d6cf">
<tr><td style="background:#1C1714;color:#EFEAE3;padding:18px 24px;font-size:20px;letter-spacing:4px;font-weight:bold">${esc(s.store.name)}</td></tr>
<tr><td style="padding:28px 24px"><h1 style="margin:0 0 14px;font-size:22px">${esc(title)}</h1>${body}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #d9d6cf;font-size:12px;color:#6C665F">
${esc(s.store.legalName)} · ${esc(s.store.address)}<br>Questions? Reply to this email or write to ${esc(s.store.email)}.</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendMail(to: string, subject: string, template: string, html: string) {
  const t = getTransport();
  if (!t) {
    console.log(`[email:not-configured] to=${to} subject="${subject}"`);
    await db.insert(emailLogs).values({ to, subject, template, status: "skipped", error: "SMTP not configured" });
    return;
  }
  try {
    await t.sendMail({ from: process.env.MAIL_FROM || "orders@localhost", to, subject, html });
    await db.insert(emailLogs).values({ to, subject, template, status: "sent" });
  } catch (e) {
    await db.insert(emailLogs).values({ to, subject, template, status: "failed", error: String(e).slice(0, 500) });
  }
}

type MailOrder = {
  number: string; email: string; total: number; subtotal: number; discount: number; shipping: number; codFee: number;
  paymentMethod: string; status: string; courier?: string | null; awb?: string | null; trackingUrl?: string | null;
  shippingAddress: { name: string; line1: string; line2?: string; city: string; state: string; pincode: string };
  items: { name: string; size: string; qty: number; total: number }[];
};

function itemsTable(o: MailOrder) {
  const rows = o.items.map((i) =>
    `<tr><td style="padding:6px 0">${esc(i.name)} · Size ${esc(i.size)} × ${i.qty}</td><td align="right">${inr(i.total)}</td></tr>`).join("");
  const line = (l: string, v: string) => `<tr><td style="padding:4px 0;color:#6C665F">${l}</td><td align="right">${v}</td></tr>`;
  return `<table width="100%" style="font-size:14px;border-collapse:collapse">${rows}
<tr><td colspan="2" style="border-top:1px solid #d9d6cf;padding-top:6px"></td></tr>
${line("Subtotal", inr(o.subtotal))}${o.discount ? line("Discount", "−" + inr(o.discount)) : ""}
${line("Shipping", o.shipping ? inr(o.shipping) : "Free")}${o.codFee ? line("Cash on delivery fee", inr(o.codFee)) : ""}
<tr><td style="padding-top:6px;font-weight:bold">Total</td><td align="right" style="font-weight:bold">${inr(o.total)}</td></tr></table>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:22px 0"><a href="${href}" style="background:#1C1714;color:#fff;padding:12px 18px;text-decoration:none;font-weight:bold">${label}</a></p>`;

export async function mailOrderPlaced(o: MailOrder) {
  const a = o.shippingAddress;
  const html = await layout(`Thank you. Order ${o.number} is confirmed.`,
    `<p>We have your order and will dispatch it soon. ${o.paymentMethod === "COD" ? "Please keep " + inr(o.total) + " ready for cash on delivery." : "Your payment was received."}</p>
${itemsTable(o)}
<p style="font-size:14px;color:#6C665F;margin-top:18px"><b style="color:#1C1714">Shipping to</b><br>${esc(a.name)}<br>${esc(a.line1)}${a.line2 ? ", " + esc(a.line2) : ""}<br>${esc(a.city)}, ${esc(a.state)} ${esc(a.pincode)}</p>
${button(`${SITE_URL}/track?order=${encodeURIComponent(o.number)}&email=${encodeURIComponent(o.email)}`, "Track your order")}`);
  await sendMail(o.email, `Order ${o.number} confirmed`, "order_placed", html);
}

export async function mailOrderStatus(o: MailOrder, note?: string) {
  const label = STATUS_LABEL[o.status as keyof typeof STATUS_LABEL] || o.status;
  const tracking = o.awb
    ? `<p>Courier: <b>${esc(o.courier || "")}</b><br>Tracking number: <b>${esc(o.awb)}</b></p>${o.trackingUrl ? button(o.trackingUrl, "Track with courier") : ""}`
    : "";
  const html = await layout(`Order ${o.number}: ${label}`,
    `<p>${note ? esc(note) : `Your order is now <b>${label.toLowerCase()}</b>.`}</p>${tracking}
${button(`${SITE_URL}/track?order=${encodeURIComponent(o.number)}&email=${encodeURIComponent(o.email)}`, "See order status")}`);
  await sendMail(o.email, `Order ${o.number}: ${label}`, "order_status", html);
}

export async function mailNewOrderAlert(o: MailOrder) {
  const s = await getSettings();
  const to = s.notifications.orderAlertEmail;
  if (!to) return;
  const html = await layout(`New order ${o.number}`,
    `<p>${o.items.length} item(s), ${inr(o.total)}, paid by ${o.paymentMethod === "COD" ? "cash on delivery" : "Razorpay"}.</p>${itemsTable(o)}
${button(`${SITE_URL}/admin/orders`, "Open in admin")}`);
  await sendMail(to, `New order ${o.number} · ${inr(o.total)}`, "admin_new_order", html);
}

export async function mailPasswordReset(to: string, name: string, link: string, staff = false) {
  const html = await layout("Reset your password",
    `<p>Hi ${esc(name)}, use the button below to choose a new password for your ${staff ? "staff" : ""} account. The link works for 1 hour.</p>
${button(link, "Choose a new password")}<p style="font-size:13px;color:#6C665F">If you did not ask for this, ignore this email. Your password stays the same.</p>`);
  await sendMail(to, "Reset your password", "password_reset", html);
}

export async function mailStaffInvite(to: string, name: string, role: string, tempPassword: string) {
  const html = await layout("You have been added to the VELMONT team",
    `<p>Hi ${esc(name)}, you now have staff access as <b>${esc(role)}</b>.</p>
<p>Sign in with this email and the temporary password <b style="font-family:monospace">${esc(tempPassword)}</b>, then change it from <i>My account</i>.</p>
${button(`${SITE_URL}/admin/login`, "Sign in to admin")}`);
  await sendMail(to, "Your VELMONT staff access", "staff_invite", html);
}

export async function mailWelcome(to: string, name: string) {
  const html = await layout(`Welcome, ${name}`,
    `<p>Your account is ready. You can track orders, save addresses and keep a wishlist.</p>${button(`${SITE_URL}/shop`, "Shop the collection")}`);
  await sendMail(to, "Welcome to VELMONT", "welcome", html);
}
