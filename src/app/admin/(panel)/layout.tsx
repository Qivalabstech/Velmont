import { and, eq, sql } from "drizzle-orm";
import { db, orders, reviews, contactMessages } from "@/db";
import { requireStaff } from "@/lib/auth";
import { ADMIN_NAV } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { Shell } from "@/components/admin/Shell";

export default async function Panel({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  const s = await getSettings();
  const [[toShip], [pendingReviews], [unread]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(sql`${orders.status} in ('PLACED','CONFIRMED','PACKED')`),
    db.select({ n: sql<number>`count(*)::int` }).from(reviews).where(eq(reviews.status, "PENDING")),
    db.select({ n: sql<number>`count(*)::int` }).from(contactMessages).where(eq(contactMessages.handled, false)),
  ]);
  const badges: Record<string, number> = { "/admin/orders": toShip.n, "/admin/reviews": pendingReviews.n, "/admin/inbox": unread.n };
  const items = ADMIN_NAV.filter((n) => me.perms.has(n.perm)).map((n) => ({ href: n.href, label: n.label, group: n.group, badge: badges[n.href] }));
  return (
    <Shell items={items} me={{ name: me.name, role: me.isOwner ? "Owner" : me.role?.name || "Staff" }} storeName={s.store.name}>
      {children}
    </Shell>
  );
}
