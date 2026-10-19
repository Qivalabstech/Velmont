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
  payments: {
    razorpayKeyId: "",
    razorpayKeySecret: "",
    razorpayWebhookSecret: "",
    prepaidDiscountPercent: 0,
    pendingPaymentMinutes: 30,
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

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < 15_000) return cache.value;
  let rows: { key: string; value: unknown }[] = [];
  let fromDb = true;
  try { rows = await db.select().from(settingsTable); } catch { fromDb = false; } // e.g. during docker build with no database
  const merged = structuredClone(DEFAULT_SETTINGS) as Settings;
  for (const r of rows) {
    const k = r.key as SettingKey;
    if (k in merged) (merged as Record<string, unknown>)[k] = { ...(merged[k] as object), ...(r.value as object) };
  }
  // Environment variables win over values stored in the database.
  if (process.env.RAZORPAY_KEY_ID) merged.payments.razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  if (process.env.RAZORPAY_KEY_SECRET) merged.payments.razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
  if (process.env.RAZORPAY_WEBHOOK_SECRET) merged.payments.razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (fromDb) cache = { at: Date.now(), value: merged };
  return merged;
}

export async function saveSetting<K extends SettingKey>(key: K, value: Partial<Settings[K]>) {
  const current = (await getSettings())[key];
  const next = { ...(current as object), ...(value as object) };
  await db.insert(settingsTable).values({ key, value: next })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: next } });
  cache = null;
}

export function clearSettingsCache() { cache = null; }

export async function getSettingRow(key: SettingKey) {
  return db.query.settings.findFirst({ where: eq(settingsTable.key, key) });
}
