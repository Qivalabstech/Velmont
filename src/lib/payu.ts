import "server-only";
// PayU India: hosted checkout (form POST to /_payment) + the merchant "postservice" API for status checks and refunds.
// Docs: https://docs.payu.in/docs/prebuilt-checkout-page-integration, /docs/generate-hash-payu-hosted, /docs/verify_payment_api
// The store never trusts what the browser or a webhook body says: an order is marked paid only after
// verify_payment says "success" for exactly the order total.
import { createHash, timingSafeEqual } from "crypto";
import { getSettings } from "./settings";

export class PayuError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

export async function payuKeys() {
  const p = (await getSettings()).payments;
  return { key: p.payuKey.trim(), salt: p.payuSalt.trim(), env: p.payuEnv };
}

export async function payuMode(): Promise<"production" | "test" | "off"> {
  const k = await payuKeys();
  if (!k.key || !k.salt) return "off";
  return k.env === "test" ? "test" : "production";
}

function hosts(env: "production" | "test") {
  // PAYU_API_BASE exists only so automated tests can point at a local stand-in. Never set it in production.
  const t = process.env.PAYU_API_BASE;
  if (t && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(t)) {
    const b = t.replace(/\/+$/, "");
    return { pay: `${b}/_payment`, api: `${b}/merchant/postservice.php?form=2` };
  }
  return env === "test"
    ? { pay: "https://test.payu.in/_payment", api: "https://test.payu.in/merchant/postservice.php?form=2" }
    : { pay: "https://secure.payu.in/_payment", api: "https://info.payu.in/merchant/postservice.php?form=2" };
}

const sha512 = (s: string) => createHash("sha512").update(s, "utf8").digest("hex");
const rupees = (paise: number) => (Math.round(paise) / 100).toFixed(2);

export type PayuForm = { action: string; fields: Record<string, string> };

/** The fields the browser posts to PayU. hash = sha512(key|txnid|amount|productinfo|firstname|email|udf1..udf5||||||salt). */
export async function payuCheckoutForm(input: {
  txnid: string; amount: number; productinfo: string; name: string; email: string; phone: string; udf1: string; returnUrl: string;
}): Promise<PayuForm> {
  const k = await payuKeys();
  if (!k.key || !k.salt) throw new PayuError("PayU Merchant Key and Salt are not set.");
  const f: Record<string, string> = {
    key: k.key,
    txnid: input.txnid,
    amount: rupees(input.amount),
    productinfo: input.productinfo.replace(/[^\w .,-]/g, "").slice(0, 100),
    firstname: (input.name.split(/\s+/)[0] || "Customer").replace(/[^A-Za-z .]/g, "").slice(0, 60) || "Customer",
    email: input.email.trim().slice(0, 100),
    phone: input.phone.replace(/\D/g, "").slice(-10),
    udf1: input.udf1, udf2: "", udf3: "", udf4: "", udf5: "",
    surl: input.returnUrl,
    furl: input.returnUrl,
  };
  f.hash = sha512([f.key, f.txnid, f.amount, f.productinfo, f.firstname, f.email, f.udf1, f.udf2, f.udf3, f.udf4, f.udf5, "", "", "", "", "", k.salt].join("|"));
  return { action: hosts(k.env).pay, fields: f };
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a.toLowerCase()), y = Buffer.from(b.toLowerCase());
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Checks the hash PayU puts on its response (surl/furl post and payment webhooks):
 * sha512([additional_charges|]salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key).
 */
export function checkPayuResponseHash(key: string, salt: string, b: Record<string, string>) {
  if (!key || !salt || !b.hash || b.key !== key) return false;
  const tail = [salt, b.status ?? "", "", "", "", "", "", b.udf5 ?? "", b.udf4 ?? "", b.udf3 ?? "", b.udf2 ?? "", b.udf1 ?? "",
    b.email ?? "", b.firstname ?? "", b.productinfo ?? "", b.amount ?? "", b.txnid ?? "", key].join("|");
  const expected = sha512(b.additionalCharges || b.additional_charges ? `${b.additionalCharges || b.additional_charges}|${tail}` : tail);
  return safeEqual(b.hash, expected);
}

async function command<T>(cmd: string, vars: Record<string, string>): Promise<T> {
  const k = await payuKeys();
  if (!k.key || !k.salt) throw new PayuError("PayU Merchant Key and Salt are not set.");
  const body = new URLSearchParams({ key: k.key, command: cmd, ...vars, hash: sha512([k.key, cmd, vars.var1 ?? "", k.salt].join("|")) });
  let res: Response;
  try {
    res = await fetch(hosts(k.env).api, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body, cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
  } catch (e) { throw new PayuError(`PayU did not respond: ${e instanceof Error ? e.message : e}`); }
  const text = await res.text();
  let j: T & { status?: number | string; msg?: string };
  try { j = JSON.parse(text); } catch { throw new PayuError(`PayU sent an unexpected reply (HTTP ${res.status}).`, res.status); }
  if (!res.ok) throw new PayuError(`PayU: ${j.msg || `HTTP ${res.status}`}`, res.status);
  if (/invalid (hash|key)|merchant key/i.test(String(j.msg || ""))) throw new PayuError("PayU rejected the Merchant Key or Salt. Check you copied the keys for the right environment (Test vs Live).", 401);
  return j;
}

export type PayuTxn = { status: string; mihpayid: string; amount: number; txnid: string; error?: string };

/** verify_payment for one txnid. null when PayU has no such transaction (the customer never paid). */
export async function verifyPayu(txnid: string): Promise<PayuTxn | null> {
  const r = await command<{ status?: number; msg?: string; transaction_details?: Record<string, { status?: string; mihpayid?: string; amt?: string; txnid?: string; error_Message?: string; field9?: string }> }>("verify_payment", { var1: txnid });
  const t = r.transaction_details?.[txnid];
  if (!t || !t.status || /not found/i.test(t.status)) return null;
  return {
    status: t.status.toLowerCase(), mihpayid: String(t.mihpayid ?? ""), amount: Math.round(Number(t.amt) * 100), txnid,
    error: t.error_Message || t.field9 || undefined,
  };
}

/** cancel_refund_transaction: refunds a captured payment (partial allowed). token must be unique per refund. */
export async function refundPayu(mihpayid: string, amount: number, token: string) {
  const r = await command<{ status?: number; msg?: string; request_id?: string; error_code?: number }>("cancel_refund_transaction", { var1: mihpayid, var2: token, var3: rupees(amount) });
  if (Number(r.status) !== 1) throw new PayuError(`PayU did not accept the refund: ${r.msg || "unknown reason"}.`);
  return { requestId: String(r.request_id || token), message: r.msg || "Refund request queued" };
}

/** Checks the keys by asking about a transaction that cannot exist: valid keys answer "0 out of 1 fetched". */
export async function pingPayu() {
  const r = await command<{ status?: number; msg?: string }>("verify_payment", { var1: "velmont-connection-test-0" });
  if (Number(r.status) === 1 || /out of/i.test(String(r.msg || ""))) return true;
  throw new PayuError(`PayU: ${r.msg || "unexpected reply"}`);
}
