import { IS_PROD } from "./env";

/**
 * The server's signing secret (AUTH_SECRET). It signs guest order links and hashes session tokens, so in
 * production it must be set and long. Without it anyone could forge an order link and read a customer's address.
 */
export function authSecret(): string {
  const s = process.env.AUTH_SECRET || "";
  if (s.length >= 32) return s;
  if (IS_PROD && process.env.NEXT_PHASE !== "phase-production-build")
    throw new Error("AUTH_SECRET is missing or shorter than 32 characters. Set it in your hosting environment variables (generate one with: openssl rand -base64 48).");
  return s || "dev-only-secret-not-for-production";
}

export const authSecretOk = () => (process.env.AUTH_SECRET || "").length >= 32;

/** Plain-English message shown on sign-in and checkout when the secret is missing, instead of a crash. */
export const AUTH_SECRET_MISSING =
  "This site is not fully set up: AUTH_SECRET is missing. In Vercel open Settings → Environment Variables, add AUTH_SECRET (32+ characters) for Production, then redeploy.";
export const authSecretMissing = () => IS_PROD && process.env.NEXT_PHASE !== "phase-production-build" && !authSecretOk();
