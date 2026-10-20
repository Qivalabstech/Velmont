export const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
export const IS_PROD = process.env.NODE_ENV === "production";
/** True when running on Vercel (serverless): no local disk, no long-running process. */
export const IS_VERCEL = Boolean(process.env.VERCEL);
export const PAYMENTS_MOCK = process.env.PAYMENTS_MOCK === "true";
export const UPLOAD_DIR = process.env.UPLOAD_DIR || "./storage/uploads";
export const BACKUP_DIR = process.env.BACKUP_DIR || "./storage/backups";
