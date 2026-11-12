import "server-only";
// Shiprocket REST API (https://apiv2.shiprocket.in/v1/external). Auth is an API user's email/password, exchanged
// for a bearer token valid for 240 hours. The token is cached in the settings table and renewed after 9 days or on 401.
import { eq } from "drizzle-orm";
import { db, settings as settingsTable } from "@/db";
import { getSettings } from "./settings";

const TOKEN_KEY = "shiprocket_token";
const TOKEN_MAX_AGE = 9 * 24 * 60 * 60_000;

export class ShiprocketError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

function base() {
  // SHIPROCKET_API_BASE exists only so automated tests can point at a local stand-in.
  const t = process.env.SHIPROCKET_API_BASE;
  if (t && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(t)) return t.replace(/\/+$/, "");
  return "https://apiv2.shiprocket.in/v1/external";
}

export async function shiprocketConfig() {
  return (await getSettings()).shiprocket;
}

export function shiprocketMissing(c: Awaited<ReturnType<typeof shiprocketConfig>>) {
  const miss: string[] = [];
  if (!c.email) miss.push("API user email");
  if (!c.password) miss.push("API user password");
  if (!c.pickupLocation) miss.push("pickup location name");
  return miss;
}

export async function shiprocketReady() {
  const c = await shiprocketConfig();
  return c.enabled && shiprocketMissing(c).length === 0;
}

async function login(): Promise<string> {
  const c = await shiprocketConfig();
  if (!c.email || !c.password) throw new ShiprocketError("Shiprocket API user email and password are not set.");
  let res: Response;
  try {
    res = await fetch(`${base()}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: c.email, password: c.password }), cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
  } catch (e) { throw new ShiprocketError(`Shiprocket did not respond: ${e instanceof Error ? e.message : e}`); }
  const body = (await res.json().catch(() => ({}))) as { token?: string; message?: string };
  if (!res.ok || !body.token) throw new ShiprocketError(res.status === 400 || res.status === 401 || res.status === 403
    ? "Shiprocket rejected the API user email or password. Use the API user from Settings → API, not your normal login."
    : `Shiprocket login failed: ${body.message || `HTTP ${res.status}`}`, res.status);
  const value = { token: body.token, at: Date.now(), email: c.email };
  await db.insert(settingsTable).values({ key: TOKEN_KEY, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
  return body.token;
}

async function token(force = false) {
  if (!force) {
    const row = await db.query.settings.findFirst({ where: eq(settingsTable.key, TOKEN_KEY) });
    const v = row?.value as { token?: string; at?: number; email?: string } | undefined;
    const c = await shiprocketConfig();
    if (v?.token && v.at && Date.now() - v.at < TOKEN_MAX_AGE && v.email === c.email) return v.token;
  }
  return login();
}

/** Forgets the cached token, e.g. after the API user changes. */
export async function clearShiprocketToken() {
  await db.delete(settingsTable).where(eq(settingsTable.key, TOKEN_KEY));
}

async function call<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const t = await token();
  let res: Response;
  try {
    res = await fetch(base() + path, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}`, ...(init.headers || {}) },
      cache: "no-store", signal: AbortSignal.timeout(20_000),
    });
  } catch (e) { throw new ShiprocketError(`Shiprocket did not respond: ${e instanceof Error ? e.message : e}`); }
  if (res.status === 401 && !retried) { await token(true); return call<T>(path, init, true); }
  const body = (await res.json().catch(() => ({}))) as T & { message?: string; errors?: Record<string, string[]> };
  if (!res.ok) {
    const detail = body.errors ? Object.values(body.errors).flat().join(" ") : "";
    throw new ShiprocketError(`Shiprocket: ${body.message || `HTTP ${res.status}`}${detail ? ` (${detail})` : ""}`, res.status);
  }
  return body;
}

export async function pingShiprocket() {
  await token(true);
  return true;
}

export type SrOrderInput = {
  order_id: string; order_date: string; pickup_location: string;
  billing_customer_name: string; billing_last_name: string; billing_address: string; billing_address_2?: string;
  billing_city: string; billing_pincode: string; billing_state: string; billing_country: string;
  billing_email: string; billing_phone: string; shipping_is_billing: boolean;
  order_items: { name: string; sku: string; units: number; selling_price: number; discount?: number; tax?: number; hsn?: string }[];
  payment_method: "Prepaid" | "COD"; shipping_charges: number; total_discount: number; sub_total: number;
  length: number; breadth: number; height: number; weight: number;
};

export async function createShiprocketOrder(input: SrOrderInput) {
  return call<{ order_id: number; shipment_id: number; status?: string; status_code?: number; awb_code?: string; courier_name?: string }>(
    "/orders/create/adhoc", { method: "POST", body: JSON.stringify(input) });
}

export async function assignAwb(shipmentId: string) {
  const r = await call<{ awb_assign_status?: number; message?: string; response?: { data?: { awb_code?: string; courier_name?: string; courier_company_id?: number; pickup_scheduled_date?: string } } }>(
    "/courier/assign/awb", { method: "POST", body: JSON.stringify({ shipment_id: Number(shipmentId) }) });
  const d = r.response?.data;
  if (!d?.awb_code) throw new ShiprocketError(`Shiprocket could not book a courier: ${r.message || "no AWB returned"}. Check your wallet balance and that the pincode is serviceable.`);
  return { awb: d.awb_code, courier: d.courier_name || "Courier", courierId: d.courier_company_id };
}

export async function schedulePickup(shipmentId: string) {
  const r = await call<{ pickup_status?: number; response?: { pickup_scheduled_date?: string; data?: string } }>(
    "/courier/generate/pickup", { method: "POST", body: JSON.stringify({ shipment_id: [Number(shipmentId)] }) });
  return { scheduledFor: r.response?.pickup_scheduled_date || null };
}

export async function generateLabel(shipmentId: string) {
  const r = await call<{ label_created?: number; label_url?: string; response?: string }>(
    "/courier/generate/label", { method: "POST", body: JSON.stringify({ shipment_id: [Number(shipmentId)] }) });
  return r.label_url || null;
}

export type SrTracking = { status: string; trackUrl: string | null; etd: string | null; deliveredDate: string | null; courier: string | null };

export async function trackAwb(awb: string): Promise<SrTracking | null> {
  const r = await call<{ tracking_data?: { track_status?: number; shipment_track?: { current_status?: string; courier_name?: string; delivered_date?: string | null; edd?: string | null }[]; track_url?: string; etd?: string | null; error?: string } }>(
    `/courier/track/awb/${encodeURIComponent(awb)}`);
  const t = r.tracking_data;
  const st = t?.shipment_track?.[0];
  if (!t || !st?.current_status) return null;
  return { status: st.current_status, trackUrl: t.track_url || null, etd: t.etd || st.edd || null, deliveredDate: st.delivered_date || null, courier: st.courier_name || null };
}

export async function cancelShiprocketOrder(srOrderId: string) {
  return call<{ message?: string }>("/orders/cancel", { method: "POST", body: JSON.stringify({ ids: [Number(srOrderId)] }) });
}
