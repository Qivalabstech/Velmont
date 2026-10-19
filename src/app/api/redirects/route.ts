// Read by middleware to apply redirects managed in Admin > SEO.
import { db, redirects } from "@/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const rows = await db.select({ from: redirects.from, to: redirects.to, permanent: redirects.permanent }).from(redirects);
  return Response.json(rows, { headers: { "Cache-Control": "no-store" } });
}
