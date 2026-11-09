import { createHmac, timingSafeEqual } from "crypto";
import { authSecret } from "./secret";

/** Lets a guest open their own order page without an account. */
export const orderToken = (number: string) =>
  createHmac("sha256", authSecret()).update(`order:${number}`).digest("base64url").slice(0, 24);

export function checkOrderToken(number: string, token: string | undefined | null) {
  if (!token || token.length !== 24) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(orderToken(number)));
}
