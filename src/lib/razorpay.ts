import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { getSettings } from "./settings";
import { PAYMENTS_MOCK } from "./env";

const API = "https://api.razorpay.com/v1";

export async function razorpayKeys() {
  const s = await getSettings();
  return { keyId: s.payments.razorpayKeyId, secret: s.payments.razorpayKeySecret, webhookSecret: s.payments.razorpayWebhookSecret };
}

export async function paymentsMode(): Promise<"live" | "test" | "mock" | "off"> {
  const { keyId, secret } = await razorpayKeys();
  if (keyId && secret) return keyId.startsWith("rzp_live_") ? "live" : "test";
  return PAYMENTS_MOCK ? "mock" : "off";
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { keyId, secret } = await razorpayKeys();
  const res = await fetch(API + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${keyId}:${secret}`).toString("base64"),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { error?: { description?: string } })?.error?.description || res.statusText;
    throw new Error(`Razorpay: ${msg}`);
  }
  return body as T;
}

export async function createRazorpayOrder(amount: number, receipt: string, notes: Record<string, string>) {
  return call<{ id: string; amount: number; currency: string }>("/orders", {
    method: "POST",
    body: JSON.stringify({ amount, currency: "INR", receipt, notes, payment_capture: 1 }),
  });
}

export async function refundRazorpayPayment(paymentId: string, amount: number, note: string) {
  return call<{ id: string; status: string }>(`/payments/${paymentId}/refund`, {
    method: "POST",
    body: JSON.stringify({ amount, notes: { reason: note.slice(0, 250) } }),
  });
}

/** Checks the stored keys by listing one payment. Used by the health page. */
export async function pingRazorpay() {
  await call("/payments?count=1");
  return true;
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
  const { secret } = await razorpayKeys();
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqual(expected, signature);
}

export async function verifyWebhookSignature(rawBody: string, signature: string) {
  const { webhookSecret } = await razorpayKeys();
  if (!webhookSecret) return false;
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}
