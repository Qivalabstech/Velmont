"use server";
import { run, type ActionState } from "@/lib/admin-action";
import { saveSetting, clearSettingsCache } from "@/lib/settings";
import { pingRazorpay } from "@/lib/razorpay";
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
    const patch: Record<string, unknown> = {
      razorpayKeyId: keyId, prepaidDiscountPercent: Math.min(50, Math.max(0, num(fd, "prepaidDiscountPercent"))),
      pendingPaymentMinutes: Math.max(10, num(fd, "pendingPaymentMinutes", 30)),
    };
    // Secrets: leave unchanged when the field is left blank.
    if (str(fd, "razorpayKeySecret")) patch.razorpayKeySecret = str(fd, "razorpayKeySecret");
    if (str(fd, "razorpayWebhookSecret")) patch.razorpayWebhookSecret = str(fd, "razorpayWebhookSecret");
    if (bool(fd, "clearKeys")) Object.assign(patch, { razorpayKeyId: "", razorpayKeySecret: "", razorpayWebhookSecret: "" });
    await saveSetting("payments", patch);
    return { ok: "Payment settings saved.", log: { action: "update", entity: "settings", summary: `Payments (key ${keyId ? keyId.slice(0, 12) + "…" : "removed"})` } };
  });
}

export async function testRazorpay(_: ActionState) {
  return run("settings.manage", async () => {
    clearSettingsCache();
    try { await pingRazorpay(); return { ok: "Razorpay accepted the keys. Online payments are ready." }; }
    catch (e) { return { error: e instanceof Error ? e.message : "Razorpay rejected the keys." }; }
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
