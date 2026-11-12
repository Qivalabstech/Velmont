import "server-only";
import { authSecretOk } from "@/lib/secret";
import { IS_PROD, IS_VERCEL, PAYMENTS_MOCK, SITE_URL } from "@/lib/env";

/** Server configuration problems that weaken security. Shown on the Health page. */
export function securityStatus() {
  const problems: string[] = [];
  let critical = false;
  if (!authSecretOk()) { problems.push("Set AUTH_SECRET to a random value of at least 32 characters (it signs order links and sessions)."); critical = true; }
  if (IS_PROD && PAYMENTS_MOCK) { problems.push("Turn off PAYMENTS_MOCK: it lets anyone mark an order paid without paying."); critical = true; }
  if (IS_VERCEL && (process.env.CRON_SECRET || "").length < 16) problems.push("Set CRON_SECRET (at least 16 characters) so only Vercel can run the daily job.");
  if (IS_PROD && process.env.CASHFREE_API_BASE) problems.push("Remove CASHFREE_API_BASE: it is for automated tests only.");
  if (process.env.OWNER_RESET === "true") problems.push("Delete the OWNER_RESET environment variable now that the owner login has been reset; otherwise every deploy resets it again.");
  if (IS_PROD && process.env.OWNER_PASSWORD) problems.push("After you have signed in and changed the owner password, delete the OWNER_PASSWORD environment variable.");
  if (IS_PROD && !SITE_URL.startsWith("https://")) { problems.push(`SITE_URL is ${SITE_URL}; it must be your https address.`); critical = true; }
  return { problems, critical };
}
