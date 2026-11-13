"use server";
import { run, type ActionState } from "@/lib/admin-action";
import { saveSetting, clearSettingsCache } from "@/lib/settings";
import { pingRazorpay } from "@/lib/razorpay";
import { pingCashfree } from "@/lib/cashfree";
import { pingPayu } from "@/lib/payu";
import { pingShiprocket, clearShiprocketToken, shiprocketConfig, shiprocketMissing } from "@/lib/shiprocket";
import { randomBytes } from "crypto";
import { pingYoupi, youpiConfig, youpiMissing } from "@/lib/youpi";
import { str, num, bool, isEmail, INDIAN_STATES } from "@/lib/utils";
import { toPaise } from "@/lib/money";

export async function saveStore(_: ActionState, fd: FormData) {
  return run("settings.manage", async () => {
    const gstin = str(fd, "gstin").toUpperCase();
    if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) return { error: "That GSTIN does not look right. It has 15 characters, like 08ABCDE1234F1Z5." };
    if (!isEmail(str(fd, "email"))) return { error: "Enter a valid store email." };
    if (!INDIAN_STATES.includes(str(fd, "state"))) return { error: "Choose the state your business is registered in." };
    await saveSetting("store", {
      name: str(fd, "name") || "VELMONT", legalName: str(fd, "legalName"), tagline: str(fd, "tagline"), email: str(fd, "email"),
      phone: str(fd, "phone"), whatsapp: str(fd, "whatsapp"), address: str(fd, "address"), state: str(fd, "state"), gstin,
      instagram: str(fd, "instagram"), supportHours: str(fd, "supportHours"),
    });
    await saveSetting("tax", { defaultGstRate: num(fd, "defaultGstRate", 18), invoicePrefix: str(fd, "invoicePrefix") || "VM-INV-" });
    return { ok: "Store details saved.", log: { action: "update", entity: "settings", summary: "Store and tax details" }, revalidate: ["/"] };
  });
}

export async function saveShipping(_: ActionState, fd: FormData) {
  return run("settings.manage", async () => {
    await saveSetting("shipping", {
      flatRate: toPaise(num(fd, "flatRate")), freeAbove: toPaise(num(fd, "freeAbove")), codEnabled: bool(fd, "codEnabled"),
      codFee: toPaise(num(fd, "codFee")), codMaxOrder: toPaise(num(fd, "codMaxOrder")), dispatchDays: str(fd, "dispatchDays"),
      deliveryDays: str(fd, "deliveryDays"), exchangeDays: num(fd, "exchangeDays", 7),
    });
    await saveSetting("inventory", { lowStockThreshold: num(fd, "lowStockThreshold", 3) });
    return { ok: "Shipping settings saved.", log: { action: "update", entity: "settings", summary: "Shipping, COD and stock alerts" }, revalidate: ["/"] };
  });
}

export async function savePayments(_: ActionState, fd: FormData) {
  return run("settings.manage", async () => {
    const keyId = str(fd, "razorpayKeyId");
    if (keyId && !/^rzp_(test|live)_/.test(keyId)) return { error: "Razorpay key IDs start with rzp_test_ or rzp_live_." };
    const patch: Record<string, unknown> = { razorpayKeyId: keyId };
    // Secrets: leave unchanged when the field is left blank.
    if (str(fd, "razorpayKeySecret")) patch.razorpayKeySecret = str(fd, "razorpayKeySecret");
    if (str(fd, "razorpayWebhookSecret")) patch.razorpayWebhookSecret = str(fd, "razorpayWebhookSecret");
    if (bool(fd, "clearKeys")) Object.assign(patch, { razorpayKeyId: "", razorpayKeySecret: "", razorpayWebhookSecret: "" });
    await saveSetting("payments", patch);
    return { ok: "Razorpay settings saved.", log: { action: "update", entity: "settings", summary: `Razorpay (key ${keyId ? keyId.slice(0, 12) + "…" : "removed"})` } };
  });
}

export async function savePaymentGeneral(_: ActionState, fd: FormData) {
  return run("settings.manage", async () => {
    const g = str(fd, "onlineGateway");
    const onlineGateway = g === "payu" || g === "cashfree" || g === "razorpay" ? g : "auto";
    await saveSetting("payments", {
      onlineGateway,
      prepaidDiscountPercent: Math.min(50, Math.max(0, num(fd, "prepaidDiscountPercent"))),
      pendingPaymentMinutes: Math.min(1440, Math.max(16, num(fd, "pendingPaymentMinutes", 30))),
    });
    return { ok: "Saved.", log: { action: "update", entity: "settings", summary: `Payments: online gateway ${onlineGateway}` } };
  });
}

export async function savePayu(_: ActionState, fd: FormData) {
  return run("settings.manage", async () => {
    const key = str(fd, "payuKey");
    if (key && !/^[A-Za-z0-9]{4,40}$/.test(key)) return { error: "That does not look like a PayU Merchant Key. Copy it from PayU Dashboard → Developers → API Keys." };
    const env = str(fd, "payuEnv") === "test" ? "test" : "production";
    const patch: Record<string, unknown> = { payuKey: key, payuEnv: env };
    if (str(fd, "payuSalt")) patch.payuSalt = str(fd, "payuSalt");
    if (bool(fd, "clearPayu")) Object.assign(patch, { payuKey: "", payuSalt: "" });
    await saveSetting("payments", patch);
    return { ok: "PayU settings saved. Press “Test connection” to check the keys.", log: { action: "update", entity: "settings", summary: `PayU (${env}, key ${key ? key.slice(0, 3) + "…" : "removed"})` } };
  });
}

export async function testPayu(_: ActionState) {
  return run("settings.manage", async () => {
    clearSettingsCache();
    try { await pingPayu(); return { ok: "PayU accepted the Merchant Key and Salt. Online payments are ready." }; }
    catch (e) { return { error: e instanceof Error ? e.message : "PayU rejected the keys." }; }
  });
}

export async function saveCashfree(_: ActionState, fd: FormData) {
  return run("settings.manage", async () => {
    const appId = str(fd, "cashfreeAppId");
    if (appId && !/^[A-Za-z0-9_-]{6,80}$/.test(appId)) return { error: "That does not look like a Cashfree App ID (Client ID). Copy it from Developers → API Keys." };
    const env = str(fd, "cashfreeEnv") === "sandbox" ? "sandbox" : "production";
    const patch: Record<string, unknown> = { cashfreeAppId: appId, cashfreeEnv: env };
    if (str(fd, "cashfreeSecretKey")) patch.cashfreeSecretKey = str(fd, "cashfreeSecretKey");
    if (bool(fd, "clearCashfree")) Object.assign(patch, { cashfreeAppId: "", cashfreeSecretKey: "" });
    await saveSetting("payments", patch);
    return { ok: "Cashfree settings saved. Press “Test connection” to check the keys.", log: { action: "update", entity: "settings", summary: `Cashfree (${env}, app ${appId ? appId.slice(0, 6) + "…" : "removed"})` } };
  });
}

export async function testCashfree(_: ActionState) {
  return run("settings.manage", async () => {
    clearSettingsCache();
    try { await pingCashfree(); return { ok: "Cashfree accepted the keys. Online payments are ready." }; }
    catch (e) { return { error: e instanceof Error ? e.message : "Cashfree rejected the keys." }; }
  });
}

export async function testRazorpay(_: ActionState) {
  return run("settings.manage", async () => {
    clearSettingsCache();
    try { await pingRazorpay(); return { ok: "Razorpay accepted the keys. Online payments are ready." }; }
    catch (e) { return { error: e instanceof Error ? e.message : "Razorpay rejected the keys." }; }
  });
}

export async function saveYoupi(_: ActionState, fd: FormData) {
  return run("settings.manage", async () => {
    const apiUrl = str(fd, "youpiApiUrl").replace(/\/+$/, "");
    if (apiUrl && !/^https:\/\//.test(apiUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(apiUrl))
      return { error: "The gateway address must start with https:// (for example https://pay.velmont.in)." };
    const mode = str(fd, "youpiMode") === "manual" ? "manual" : "auto";
    const patch: Record<string, unknown> = {
      youpiEnabled: bool(fd, "youpiEnabled"), youpiApiUrl: apiUrl, youpiMerchantId: str(fd, "youpiMerchantId"),
      youpiMode: mode, youpiTrustBankAlerts: bool(fd, "youpiTrustBankAlerts"),
    };
    if (str(fd, "youpiApiKey")) patch.youpiApiKey = str(fd, "youpiApiKey");
    if (str(fd, "youpiWebhookSecret")) patch.youpiWebhookSecret = str(fd, "youpiWebhookSecret");
    if (bool(fd, "clearYoupi")) Object.assign(patch, { youpiEnabled: false, youpiApiUrl: "", youpiMerchantId: "", youpiApiKey: "", youpiWebhookSecret: "" });
    await saveSetting("payments", patch);
    const c = await youpiConfig();
    const miss = youpiMissing(c);
    const msg = !c.enabled ? "Saved. UPI is switched off at checkout."
      : miss.length ? `Saved, but UPI stays hidden at checkout until you add the ${miss.join(", ")}.`
      : "Saved. UPI is now offered at checkout. Press “Test connection” to check the gateway.";
    return { ok: msg, log: { action: "update", entity: "settings", summary: `UPI (YouPI) ${c.enabled ? "on" : "off"}, mode ${mode}${c.trustBankAlerts ? ", auto-confirm on bank alert" : ""}` } };
  });
}

export async function testYoupi(_: ActionState) {
  return run("settings.manage", async () => {
    clearSettingsCache();
    const miss = youpiMissing(await youpiConfig());
    if (miss.length) return { error: `Add the ${miss.join(", ")} first.` };
    try { await pingYoupi(); return { ok: "The UPI gateway is reachable. Place a small test order to confirm the merchant key and webhook." }; }
    catch (e) { return { error: e instanceof Error ? e.message : "The UPI gateway did not answer." }; }
  });
}

export async function saveShiprocket(_: ActionState, fd: FormData) {
  return run("settings.manage", async () => {
    const cur = await shiprocketConfig();
    const email = str(fd, "srEmail").toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter the Shiprocket API user's email address." };
    const dims = (k: string, d: number, max: number) => Math.min(max, Math.max(0.1, Number(str(fd, k)) || d));
    const patch: Record<string, unknown> = {
      enabled: bool(fd, "srEnabled"), email, pickupLocation: str(fd, "srPickup"),
      autoCreate: bool(fd, "srAutoCreate"), autoAssign: bool(fd, "srAutoAssign"),
      weightPerItemKg: dims("srWeight", 0.35, 20), lengthCm: dims("srL", 32, 200), breadthCm: dims("srB", 12, 200), heightCm: dims("srH", 6, 200),
    };
    if (str(fd, "srPassword")) patch.password = str(fd, "srPassword");
    if (!cur.webhookToken || bool(fd, "srNewToken")) patch.webhookToken = randomBytes(24).toString("base64url");
    await saveSetting("shiprocket", patch);
    if (email !== cur.email || patch.password) await clearShiprocketToken();
    const c = await shiprocketConfig();
    const miss = shiprocketMissing(c);
    return {
      ok: !c.enabled ? "Saved. Shiprocket is switched off." : miss.length ? `Saved, but Shiprocket stays off until you add the ${miss.join(", ")}.` : "Saved. New orders will be sent to Shiprocket. Press “Test connection” to check the login.",
      log: { action: "update", entity: "settings", summary: `Shiprocket ${c.enabled ? "on" : "off"}${c.autoAssign ? ", auto-book courier" : ""}` },
    };
  });
}

export async function testShiprocket(_: ActionState) {
  return run("settings.manage", async () => {
    clearSettingsCache();
    const miss = shiprocketMissing(await shiprocketConfig()).filter((m) => m !== "pickup location name");
    if (miss.length) return { error: `Add the ${miss.join(", ")} first.` };
    try { await pingShiprocket(); return { ok: "Shiprocket accepted the API user. You're connected." }; }
    catch (e) { return { error: e instanceof Error ? e.message : "Shiprocket rejected the login." }; }
  });
}

export async function saveNotifications(_: ActionState, fd: FormData) {
  return run("settings.manage", async () => {
    const e = str(fd, "orderAlertEmail");
    if (e && !isEmail(e)) return { error: "Enter a valid email or leave it empty." };
    await saveSetting("notifications", { orderAlertEmail: e });
    return { ok: "Notification settings saved." };
  });
}
