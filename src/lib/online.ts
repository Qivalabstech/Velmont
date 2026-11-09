import "server-only";
import { getSettings } from "./settings";
import { paymentsMode } from "./razorpay";
import { cashfreeMode } from "./cashfree";

export type OnlineGateway =
  | { provider: "cashfree"; mode: "production" | "sandbox" }
  | { provider: "razorpay"; mode: "live" | "test" }
  | { provider: "mock"; mode: "mock" }
  | { provider: "off"; mode: "off" };

/** Which gateway handles "Pay online" right now. */
export async function onlineGateway(): Promise<OnlineGateway> {
  const [s, cf, rz] = await Promise.all([getSettings(), cashfreeMode(), paymentsMode()]);
  const pref = s.payments.onlineGateway;
  const useCf = cf !== "off" && pref !== "razorpay";
  const useRz = (rz === "live" || rz === "test") && pref !== "cashfree";
  if (useCf) return { provider: "cashfree", mode: cf };
  if (useRz) return { provider: "razorpay", mode: rz };
  if (rz === "mock" && !process.env.VERCEL) return { provider: "mock", mode: "mock" }; // PAYMENTS_MOCK=true and no keys: local testing only
  return { provider: "off", mode: "off" };
}
