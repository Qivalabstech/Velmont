import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getStaff } from "@/lib/auth";
import { audit } from "@/lib/audit";

const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export async function GET(req: Request) {
  const me = await getStaff();
  if (!me || !me.perms.has("customers.view")) return new Response("Forbidden", { status: 403 });
  const guests = new URL(req.url).searchParams.get("tab") === "guests";
  const r = guests
    ? await db.execute(sql`select max(shipping_address->>'name') as name, email, max(phone) as phone, count(*)::int as orders, sum(total-refunded)/100.0 as spent, false as subscribed from orders where user_id is null and status not in ('PENDING_PAYMENT','CANCELLED') group by email`)
    : await db.execute(sql`select u.name, u.email, u.phone, count(o.id) filter (where o.status not in ('PENDING_PAYMENT','CANCELLED'))::int as orders,
        coalesce(sum(o.total - o.refunded) filter (where o.status not in ('PENDING_PAYMENT','CANCELLED')),0)/100.0 as spent, u.marketing_opt_in as subscribed
        from users u left join orders o on o.user_id = u.id where u.kind = 'CUSTOMER' group by u.id`);
  const rows = r.rows as Record<string, unknown>[];
  await audit({ id: me.id, name: me.name }, "export", "customer", null, `Exported ${rows.length} ${guests ? "guest" : "account"} customers`);
  const head = ["Name", "Email", "Phone", "Orders", "Spent", "Subscribed"];
  const body = rows.map((x) => [x.name, x.email, x.phone, x.orders, x.spent, x.subscribed].map(esc).join(","));
  return new Response("﻿" + [head.join(","), ...body].join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="velmont-customers.csv"` },
  });
}
