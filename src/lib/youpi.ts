import "server-only";
// YouPI PG: a self-hosted UPI gateway (github.com/youpi-pg/YouPI-PG). The customer pays by UPI straight
// into the store's bank account. YouPI runs on its own server; this file is the store's side of it.
//
// Trust model, taken from YouPI's own docs:
//   RECONCILED        a bank-statement line matched the payment → safe to treat as paid
//   OBSERVED_SUCCESS  a bank SMS/email alert matched → likely paid, but staff should check the bank
//   MANUAL_REVIEW     the customer typed a UTR, or the alert was ambiguous → staff must check the bank
//   FAILED/EXPIRED/CANCELLED → this attempt ended; the customer can try again
import { createHmac, timingSafeEqual } from "crypto";
import { getSettings } from "./settings";

export type YoupiMethod = "UPI" | "MANUAL_UPI";
export type YoupiEvent =
  | "INITIATED" | "QUEUED" | "ACTIVE" | "PROCESSING"
  | "OBSERVED_SUCCESS" | "RECONCILED" | "MANUAL_REVIEW" | "SUCCESS" | "FAILED" | "EXPIRED" | "CANCELLED";

export class YoupiError extends Error {
  constructor(message: string, public code?: string, public status?: number) { super(message); }
}

export async function youpiConfig() {
  const p = (await getSettings()).payments;
  return {
    enabled: p.youpiEnabled,
    apiUrl: p.youpiApiUrl.trim().replace(/\/+$/, ""),
    merchantId: p.youpiMerchantId.trim(),
    apiKey: p.youpiApiKey.trim(),
    webhookSecret: p.youpiWebhookSecret.trim(),
    mode: p.youpiMode,
    trustBankAlerts: p.youpiTrustBankAlerts,
  };
}

/** What is still missing before UPI can be offered at checkout. Empty when ready. */
export function youpiMissing(c: Awaited<ReturnType<typeof youpiConfig>>) {
  const miss: string[] = [];
  if (!/^https?:\/\//.test(c.apiUrl)) miss.push("gateway address");
  if (!c.merchantId) miss.push("merchant ID");
  if (!c.apiKey) miss.push("merchant API key");
  if (!c.webhookSecret) miss.push("webhook secret");
  return miss;
}

export async function youpiReady() {
  const c = await youpiConfig();
  return c.enabled && youpiMissing(c).length === 0;
}

async function call<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<{ status: number; body: T }> {
  const c = await youpiConfig();
  let res: Response;
  try {
    res = await fetch(c.apiUrl + path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Merchant-Id": c.merchantId,
        "X-Merchant-Key": c.apiKey,
        ...(init.headers || {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 12_000),
    });
  } catch (e) {
    throw new YoupiError(`The UPI gateway at ${c.apiUrl || "(not set)"} did not respond: ${e instanceof Error ? e.message : e}`, "UNREACHABLE");
  }
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

type CreateBody = {
  paymentId?: string; checkoutUrl?: string; status?: string;
  error?: string; code?: string; message?: string; session_id?: string;
};

const rupees = (paise: number) => (paise / 100).toFixed(2);

/**
 * Starts (or continues) a YouPI payment for an order and returns where to send the customer.
 * An order keeps the same method for every attempt, because YouPI refuses to switch methods mid-order.
 */
export async function createYoupiPayment(o: {
  number: string; total: number; email: string; phone: string; name: string; youpiMethod: string | null; returnUrl: string;
}): Promise<{ paymentId: string; checkoutUrl: string; method: YoupiMethod }> {
  const c = await youpiConfig();
  const first: YoupiMethod = (o.youpiMethod as YoupiMethod | null) ?? (c.mode === "manual" ? "MANUAL_UPI" : "UPI");

  const attempt = async (method: YoupiMethod) => call<CreateBody>("/api/v1/payments", {
    method: "POST",
    headers: { "Idempotency-Key": `${o.number}:${method}` },
    body: JSON.stringify({
      orderId: o.number, amount: rupees(o.total), currency: "INR", method,
      description: `Order ${o.number}`, returnUrl: o.returnUrl,
      customer: { name: o.name, email: o.email, phoneNumber: o.phone },
      metadata: { store: "velmont", order_number: o.number },
    }),
  });

  let method = first;
  let r = await attempt(method);
  // Bank-alert watchers are offline: fall back to the customer typing their UTR, but only for a brand-new order.
  if (r.status === 503 && r.body.code === "OBSERVERS_UNHEALTHY" && !o.youpiMethod && c.mode === "auto") {
    method = "MANUAL_UPI";
    r = await attempt(method);
  }
  if ((r.status === 200 || r.status === 201) && r.body.paymentId && r.body.checkoutUrl)
    return { paymentId: r.body.paymentId, checkoutUrl: r.body.checkoutUrl, method };

  const code = r.body.code || r.body.error;
  if (code === "DUPLICATE_SESSION_DETECTED" || code === "DEVICE_SESSION_MISMATCH")
    throw new YoupiError("This payment is already open on another device. Finish it there, or wait 5 minutes and try again.", code, r.status);
  if (code === "ORDER_AMOUNT_MISMATCH")
    throw new YoupiError("The gateway has this order with a different amount. Contact us with your order number.", code, r.status);
  throw new YoupiError(`UPI gateway: ${r.body.message || r.body.error || `HTTP ${r.status}`}`, code, r.status);
}

export type YoupiPayment = {
  paymentId: string; orderId: string; amountPaise: number; currency: string; status: YoupiEvent;
  settlementState?: string; method?: string;
};

/** Reads a payment's current state from the gateway (used when the customer comes back, in case a webhook is late). */
export async function getYoupiPayment(paymentId: string): Promise<YoupiPayment | null> {
  const r = await call<Record<string, unknown>>(`/api/v1/payments/${encodeURIComponent(paymentId)}`, { timeoutMs: 6_000 });
  if (r.status !== 200) return null;
  const b = r.body;
  return {
    paymentId: String(b.paymentId), orderId: String(b.orderId), amountPaise: Number(b.amountPaise),
    currency: String(b.currency || "INR"), status: String(b.status) as YoupiEvent,
    settlementState: b.settlementState ? String(b.settlementState) : undefined, method: b.method ? String(b.method) : undefined,
  };
}

/** Checks the gateway is reachable without creating a payment. (The key is only checked when a payment is created.) */
export async function pingYoupi() {
  const r = await call<{ error?: string; code?: string }>("/api/v1/payments/velmont-connection-test", { timeoutMs: 8_000 });
  if (r.status === 404) return true; // reachable; the made-up payment simply does not exist
  if (r.status === 401) throw new YoupiError("The gateway rejected the merchant API key.");
  throw new YoupiError(`The gateway answered HTTP ${r.status}${r.body.error ? `: ${r.body.error}` : ""}.`);
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const MAX_AGE_MS = 24 * 60 * 60_000; // YouPI retries for about an hour; anything older is refused

/** Verifies a YouPI webhook over the raw body bytes. Returns a reason when it fails. */
export function checkYoupiSignature(secret: string, raw: string, h: Headers, now = Date.now()): string | null {
  if (!secret) return "Webhook secret is not set.";
  const v1 = h.get("x-gateway-signature") || "";
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  if (!safeEqual(v1, expected)) return "Signature does not match.";
  const ts = h.get("x-gateway-timestamp");
  const v2 = h.get("x-gateway-signature-v2");
  if (ts && v2) {
    const expected2 = "sha256=" + createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex");
    if (!safeEqual(v2, expected2)) return "Timestamped signature does not match.";
    const age = now - Number(ts);
    if (!Number.isFinite(age) || age > MAX_AGE_MS || age < -5 * 60_000) return "Delivery is too old or from the future.";
  }
  return null;
}
