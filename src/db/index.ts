import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const g = globalThis as unknown as { __vmPool?: Pool };
export const pool =
  g.__vmPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Serverless (Vercel) runs many small instances: keep each one's pool small and let idle connections close.
    max: Number(process.env.DB_POOL_MAX || (process.env.VERCEL ? 3 : 10)),
    idleTimeoutMillis: process.env.VERCEL ? 10_000 : 30_000,
  });
if (process.env.NODE_ENV !== "production") g.__vmPool = pool;

export const db = drizzle(pool, { schema });
export type DB = typeof db;
export * from "./schema";
