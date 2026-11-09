import "server-only";
// Cashfree Payments (PG) — REST API. Docs: https://www.cashfree.com/docs/api-reference/payments/latest
// Flow: create order (server) → payment_session_id → Cashfree JS SDK checkout (browser) → return_url (server
// re-checks the order with Cashfree) and webhook (signature-checked, then re-checked with Cashfree).
// The store never trusts amounts or statuses sent by the browser or by a webhook body alone.
import { createHmac, timingSafeEqual, randomUUID } from "crypto";
import { getSettings } from "./settings";

const API_VERSION = process.env.CASHFREE_API_VERSION || "2025-01-01";

export class CashfreeError extends Error {
  constructor(message: string, public status?: number, public code?: string) { super(message); }
}

export async function cashfreeKeys() {
  const p = (await getSettings()).payments;
  return { appId: p.cashfreeAppId.trim(), secret: p.cashfreeSecretKey.trim(), env: p.cashfreeEnv };
}

export async function cashfreeMode(): Promise<"production" | "sandbox" | "off"> {
  const k = await cashfreeKeys();
  if (!k.appId || !k.secret) return "off";
  return k.env === "sandbox" ? "sandbox" : "production";
}

function base(env: "production" | "sandbox") {
  // CASHFREE_API_BASE exists only so automated tests can point at a local stand-in. Never set it in production.
  const t = process.env.CASHFREE_API_BASE;
  if (t && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(t)) return t.replace(/\/+$/, "");
  return env === "sandbox" ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";
}

async function call<T>(path: string, init: RequestInit & { idempotencyKey?: string; timeoutMs?: number } = {}): Promise<T> {
  const k = await cashfreeKeys();
  if (!k.appId || !k.secret) throw new CashfreeError("Cashfree keys are not set.");
  let res: Response;
  try {
    res = await fetch(base(k.env) + path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-version": API_VERSION,
        "x-client-id": k.appId,
        "x-client-secret": k.secret,
        "x-request-id": randomUUID(),
        ...(init.idempotencyKey ? { "x-idempotency-key": init.idempotencyKey } : {}),
        ...(init.headers || {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 15_000),
    });
  } catch (e) {
    throw new CashfreeError(`Cashfree did not respond: ${e instanceof Error ? e.message : e}`);
  }
  const body = (await res.json().catch(() => ({}))) as T & { message?: string; code?: string };
  if (!res.ok) throw new CashfreeError(`Cashfree: ${body.message || res.statusText || `HTTP ${res.status}`}`, res.status, body.code);
  return body;
}

export type CfOrder = {
  cf_order_id: string | number; order_id: string; order_amount: number; order_currency: string;
  order_status: "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED" | "TERMINATION_REQUESTED"; payment_session_id?: string;
  order_expiry_time?: string;
};
export type CfPayment = {
  cf_payment_id: string | number; payment_status: string; payment_amount: number; payment_currency: string;
  bank_reference?: string; payment_group?: string; is_captured?: boolean;
};

const rupees = (paise: number) => Math.round(paise) / 100;

/** Cashfree accepts 3–50 letters/digits as customer_id. */
function customerId(userId: string | null, phone: string) {
  const id = (userId || `g${phone}`).replace(/[^A-Za-z0-9]/g, "");
  return (id.length >= 3 ? id : `cust${id}`).slice(0, 50);
}

export async function createCashfreeOrder(input: {
  cfOrderId: string; amount: number; email: string; phone: string; name: string; userId: string | null;
  returnUrl: string; notifyUrl: string | null; expiresInMinutes: number; note: string;
}) {
  const expiry = new Date(Date.now() + Math.max(16, input.expiresInMinutes) * 60_000).toISOString();
  return call<CfOrder>("/orders", {
    method: "POST",
    idempotencyKey: randomUUID(),
    body: JSON.stringify({
      order_id: input.cfOrderId,
      order_amount: rupees(input.amount),
      order_currency: "INR",
      order_expiry_time: expiry,
      order_note: input.note.slice(0, 200),
      customer_details: {
        customer_id: customerId(input.userId, input.phone),
        customer_phone: input.phone,
        customer_email: input.email,
        customer_name: input.name.length >= 3 ? input.name.slice(0, 100) : `${input.name} .`.slice(0, 100),
      },
      order_meta: {
        return_url: input.returnUrl,
        ...(input.notifyUrl ? { notify_url: input.notifyUrl } : {}),
      },
      order_tags: { store: "velmont" },
    }),
  });
}

export async function getCashfreeOrder(cfOrderId: string) {
  return call<CfOrder>(`/orders/${encodeURIComponent(cfOrderId)}`, { timeoutMs: 10_000 });
}

export async function getCashfreePayments(cfOrderId: string) {
  return call<CfPayment[]>(`/orders/${encodeURIComponent(cfOrderId)}/payments`, { timeoutMs: 10_000 });
}

export async function refundCashfree(cfOrderId: string, amount: number, refundId: string, note: string) {
  return call<{ cf_refund_id: string | number; refund_id: string; refund_status: string }>(`/orders/${encodeURIComponent(cfOrderId)}/refunds`, {
    method: "POST",
    idempotencyKey: randomUUID(),
    body: JSON.stringify({
      refund_amount: rupees(amount), refund_id: refundId,
      refund_note: (note || "Refund").replace(/[^\w .,-]/g, "").slice(0, 100).padEnd(3, "."),
    }),
  });
}

/** Checks the keys: asking for an order that cannot exist returns 404 with valid keys and 401 with bad ones. */
export async function pingCashfree() {
  try {
    await getCashfreeOrder("velmont-connection-test-0");
    return true;
  } catch (e) {
    if (e instanceof CashfreeError && e.status === 404) return true;
    if (e instanceof CashfreeError && e.status === 401) throw new CashfreeError("Cashfree rejected the App ID or Secret Key. Check you copied the keys for the right environment (Test vs Production).", 401);
    throw e;
  }
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Verifies a Cashfree webhook. Signature = base64(HMAC-SHA256(secretKey, timestamp + rawBody)),
 * exactly as Cashfree's official Node SDK (PGVerifyWebhookSignature) computes it.
 */
export function checkCashfreeSignature(secret: string, raw: string, timestamp: string | null, signature: string | null) {
  if (!secret || !timestamp || !signature) return false;
  const expected = createHmac("sha256", secret).update(timestamp + raw).digest("base64");
  return safeEqual(signature, expected);
}
