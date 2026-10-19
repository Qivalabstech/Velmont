import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getStaff } from "@/lib/auth";

export async function GET() {
  const me = await getStaff();
  if (!me || !me.perms.has("marketing.manage")) return new Response("Forbidden", { status: 403 });
  const r = await db.execute(sql`select email, created_at, 'footer' as source from subscribers union select email, created_at, 'account' from users where marketing_opt_in and kind = 'CUSTOMER'`);
  const rows = (r.rows as { email: string; created_at: string; source: string }[]).map((x) => `${x.email},${new Date(x.created_at).toISOString().slice(0, 10)},${x.source}`);
  return new Response(["Email,Joined,Source", ...rows].join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="velmont-subscribers.csv"' } });
}
