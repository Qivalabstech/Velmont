// Finds the Postgres connection string. Vercel's Neon integration may name it DATABASE_URL or POSTGRES_URL.
const POOLED = ["DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL"];
const DIRECT = ["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "POSTGRES_URL_NO_SSL"];

function pick(names: string[]) {
  for (const n of names) if (process.env[n]) return process.env[n]!;
  return "";
}

/** Connection string for the running app (pooled when available). */
export function databaseUrl() {
  return pick(POOLED) || pick(DIRECT);
}

/** Connection string for migrations and scripts (direct when available). Explains clearly when nothing is set. */
export function scriptDatabaseUrl() {
  const url = pick(DIRECT) || pick(POOLED);
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  if (!url || (process.env.VERCEL && local)) {
    throw new Error(
      [
        "",
        "No database is connected to this Vercel project.",
        url ? `DATABASE_URL points to ${local ? "localhost" : "an unknown host"}, which does not exist on Vercel.` : "DATABASE_URL is not set.",
        "Fix: Vercel > your project > Storage > Create Database > Neon > Connect to project",
        "(tick Production, Preview and Development), or paste your Neon connection string as",
        "DATABASE_URL in Settings > Environment Variables. Then redeploy.",
        "",
      ].join("\n"),
    );
  }
  return url;
}
