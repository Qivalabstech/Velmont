// Applies pending SQL migrations from ./drizzle. Safe to run on every deploy.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "path";
import { scriptDatabaseUrl } from "../src/db/url";

async function main() {
  const pool = new Pool({ connectionString: scriptDatabaseUrl() });
  await migrate(drizzle(pool), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await pool.end();
  console.log("Database is up to date.");
}
main().catch((e) => { console.error(e instanceof Error && e.message.includes("No database") ? e.message : e); process.exit(1); });
