import { desc, eq, sql } from "drizzle-orm";
import { db, subscribers, users } from "@/db";
import { requireStaff } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { PageHead, Card } from "@/components/admin/ui";

export const metadata = { title: "Subscribers" };

export default async function Subs() {
  await requireStaff("marketing.manage");
  const [list, [{ n }]] = await Promise.all([
    db.select().from(subscribers).orderBy(desc(subscribers.createdAt)).limit(500),
    db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.marketingOptIn, true)),
  ]);
  return (
    <div style={{ maxWidth: 820 }}>
      <PageHead title="Subscribers" sub={`${list.length} from the footer sign-up, plus ${n} account holders who opted in. Export to your email tool to send campaigns.`}
        actions={<a className="btn sm" href="/admin/subscribers/export">Export CSV</a>} />
      <Card flush><div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Email</th><th>Joined</th></tr></thead>
        <tbody>{list.map((s) => <tr key={s.id}><td>{s.email}</td><td>{formatDate(s.createdAt)}</td></tr>)}
          {!list.length && <tr><td colSpan={2} className="empty">No one has signed up yet.</td></tr>}</tbody>
      </table></div></Card>
    </div>
  );
}
