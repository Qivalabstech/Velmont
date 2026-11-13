import { db, settings as settingsTable } from "@/db";
import { eq } from "drizzle-orm";

export const DEFAULT_SETTINGS = {
  store: {
    name: "VELMONT",
    legalName: "Velmont Leather",
    tagline: "Hand-tooled leather belts",
    email: "hello@velmont.in",
    phone: "+91 90000 00000",
    whatsapp: "",
    address: "Udaipur, Rajasthan 313001, India",
    state: "Rajasthan",
    gstin: "",
    instagram: "",
    supportHours: "Mon–Sat, 10 am to 7 pm IST",
  },
  tax: {
    // Prices are always shown tax-inclusive. Confirm the right rate for HSN 4203 with your CA.
    defaultGstRate: 18,
    invoicePrefix: "VM-INV-",
  },
  shipping: {
    flatRate: 9900, // paise, used when order is below freeAbove
    freeAbove: 0, // 0 = always free
    codEnabled: true,
    codFee: 4900,
    codMaxOrder: 500000,
    dispatchDays: "1–2 business days",
    deliveryDays: "3–7 business days",
    exchangeDays: 7,
  },
  // Shiprocket: creates shipments, books couriers and tracks deliveries automatically.
  shiprocket: {
    enabled: false,
    email: "", // API user created in Shiprocket → Settings → API (not your normal login)
    password: "",
    pickupLocation: "", // pickup address nickname exactly as in Shiprocket → Settings → Pickup Addresses
    autoCreate: true, // send each placed order to Shiprocket
    autoAssign: true, // book the courier Shiprocket recommends and schedule pickup
    webhookToken: "", // sent by Shiprocket as x-api-key on tracking webhooks
    weightPerItemKg: 0.35,
    lengthCm: 32,
    breadthCm: 12,
    heightCm: 6,
  },
  payments: {
    // Which gateway handles "Pay online". "auto" uses PayU when its keys are set, then Cashfree, then Razorpay.
    onlineGateway: "auto" as "auto" | "payu" | "cashfree" | "razorpay",
    payuKey: "",
    payuSalt: "",
    payuEnv: "production" as "production" | "test",
    cashfreeAppId: "",
    cashfreeSecretKey: "",
    cashfreeEnv: "production" as "production" | "sandbox",
    razorpayKeyId: "",
    razorpayKeySecret: "",
    razorpayWebhookSecret: "",
    prepaidDiscountPercent: 0,
    pendingPaymentMinutes: 30,
    // YouPI: self-hosted UPI gateway, money goes straight to the store's bank account.
    youpiEnabled: false,
    youpiApiUrl: "", // e.g. https://pay.velmont.in
    youpiMerchantId: "",
    youpiApiKey: "",
    youpiWebhookSecret: "",
    // "auto": YouPI watches bank SMS/email and falls back to "manual" when its observers are offline.
    // "manual": the customer types the UTR after paying.
    youpiMode: "auto" as "auto" | "manual",
    // Confirm an order on a bank alert alone, without waiting for staff to check the bank. Off by default.
    youpiTrustBankAlerts: false,
  },
  inventory: { lowStockThreshold: 3 },
  notifications: { orderAlertEmail: "" },
  content: {
    announcements: [
      "Free shipping across India",
      "Hand-tooled in small batches",
      "Easy 7-day size exchange",
      "Full-grain cowhide, sizes 30–40",
    ],
    heroEyebrow: "Hand-tooled leather belts",
    heroLines: ["Carved", "by hand.", "Built to age."],
    heroText:
      "Full-grain cowhide, carved, painted and beaded by hand, then finished with an engraved silver-tone buckle. Each belt darkens and softens with you.",
    bandRowOne: ["Carved", "Beaded", "Stitched", "Velmont"],
    bandRowTwo: ["Full-grain", "Hand-painted", "Silver-tone", "Made slow"],
    collectionTitle: "Four belts. No two alike.",
    collectionText:
      "Every belt is cut and carved by hand, so the pattern on yours will vary slightly from the photos.",
  },
  seo: {
    titleTemplate: "%s | VELMONT",
    defaultTitle: "VELMONT | Hand-tooled leather belts",
    defaultDescription:
      "Hand-tooled full-grain leather belts with carved, painted and beaded designs and engraved western buckles. Free shipping across India.",
    ogImage: "/img/solana-ring.webp",
    sameAs: [] as string[],
    googleVerification: "",
    allowAiCrawlers: true,
    llmsIntro:
      "VELMONT makes hand-tooled full-grain leather belts in India: carved, hand-painted and beaded designs with engraved buckles, sold online in sizes 30 to 40.",
  },
};

export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

let cache: { at: number; value: Settings } | null = null;

/** Defaults + what is saved in the database, without environment overrides. */
async function storedSettings(): Promise<{ value: Settings; fromDb: boolean }> {
  let rows: { key: string; value: unknown }[] = [];
  let fromDb = true;
  try { rows = await db.select().from(settingsTable); } catch { fromDb = false; } // e.g. during a build with no database
  const merged = structuredClone(DEFAULT_SETTINGS) as Settings;
  for (const r of rows) {
    const k = r.key as SettingKey;
    if (k in merged) (merged as Record<string, unknown>)[k] = { ...(merged[k] as object), ...(r.value as object) };
  }
  return { value: merged, fromDb };
}

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < 15_000) return cache.value;
  const { value: merged, fromDb } = await storedSettings();
  // Environment variables win over values stored in the database.
  if (process.env.RAZORPAY_KEY_ID) merged.payments.razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  if (process.env.RAZORPAY_KEY_SECRET) merged.payments.razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
  if (process.env.RAZORPAY_WEBHOOK_SECRET) merged.payments.razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (process.env.PAYU_KEY) merged.payments.payuKey = process.env.PAYU_KEY;
  if (process.env.PAYU_SALT) merged.payments.payuSalt = process.env.PAYU_SALT;
  if (process.env.PAYU_ENV === "test" || process.env.PAYU_ENV === "production") merged.payments.payuEnv = process.env.PAYU_ENV;
  if (process.env.CASHFREE_APP_ID) merged.payments.cashfreeAppId = process.env.CASHFREE_APP_ID;
  if (process.env.CASHFREE_SECRET_KEY) merged.payments.cashfreeSecretKey = process.env.CASHFREE_SECRET_KEY;
  if (process.env.CASHFREE_ENV === "sandbox" || process.env.CASHFREE_ENV === "production") merged.payments.cashfreeEnv = process.env.CASHFREE_ENV;
  if (process.env.SHIPROCKET_EMAIL) merged.shiprocket.email = process.env.SHIPROCKET_EMAIL;
  if (process.env.SHIPROCKET_PASSWORD) merged.shiprocket.password = process.env.SHIPROCKET_PASSWORD;
  if (process.env.SHIPROCKET_WEBHOOK_TOKEN) merged.shiprocket.webhookToken = process.env.SHIPROCKET_WEBHOOK_TOKEN;
  if (process.env.YOUPI_API_URL) merged.payments.youpiApiUrl = process.env.YOUPI_API_URL;
  if (process.env.YOUPI_MERCHANT_ID) merged.payments.youpiMerchantId = process.env.YOUPI_MERCHANT_ID;
  if (process.env.YOUPI_MERCHANT_API_KEY) merged.payments.youpiApiKey = process.env.YOUPI_MERCHANT_API_KEY;
  if (process.env.YOUPI_WEBHOOK_SECRET) merged.payments.youpiWebhookSecret = process.env.YOUPI_WEBHOOK_SECRET;
  if (fromDb) cache = { at: Date.now(), value: merged };
  return merged;
}

export async function saveSetting<K extends SettingKey>(key: K, value: Partial<Settings[K]>) {
  // Merge into the stored values only, so secrets that come from environment variables are never copied into the database.
  const current = (await storedSettings()).value[key];
  const next = { ...(current as object), ...(value as object) };
  await db.insert(settingsTable).values({ key, value: next })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: next } });
  cache = null;
}

export function clearSettingsCache() { cache = null; }

export async function getSettingRow(key: SettingKey) {
  return db.query.settings.findFirst({ where: eq(settingsTable.key, key) });
}
