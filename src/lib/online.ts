import "server-only";
import { getSettings } from "./settings";
import { paymentsMode } from "./razorpay";
import { cashfreeMode } from "./cashfree";
import { payuMode } from "./payu";

export type OnlineGateway =
  | { provider: "payu"; mode: "production" | "test" }
  | { provider: "cashfree"; mode: "production" | "sandbox" }
  | { provider: "razorpay"; mode: "live" | "test" }
  | { provider: "mock"; mode: "mock" }
  | { provider: "off"; mode: "off" };

/** Which gateway handles "Pay online" right now. */
export async function onlineGateway(): Promise<OnlineGateway> {
  const [s, pu, cf, rz] = await Promise.all([getSettings(), payuMode(), cashfreeMode(), paymentsMode()]);
  const pref = s.payments.onlineGateway;
  const pick = (name: "payu" | "cashfree" | "razorpay") => pref === "auto" || pref === name;
  if (pu !== "off" && pick("payu")) return { provider: "payu", mode: pu };
  if (cf !== "off" && pick("cashfree")) return { provider: "cashfree", mode: cf };
  if ((rz === "live" || rz === "test") && pick("razorpay")) return { provider: "razorpay", mode: rz };
  if (rz === "mock" && !process.env.VERCEL) return { provider: "mock", mode: "mock" }; // PAYMENTS_MOCK=true and no keys: local testing only
  return { provider: "off", mode: "off" };
}
