import { createHmac } from "crypto";
/** Lets a guest open their own order page without an account. */
export const orderToken = (number: string) =>
  createHmac("sha256", process.env.AUTH_SECRET || "dev").update(`order:${number}`).digest("base64url").slice(0, 24);
export const checkOrderToken = (number: string, token: string | undefined) => !!token && token === orderToken(number);
