import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, contactMessages } from "@/db";
import { requireStaff } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { PageHead, Card, Pill } from "@/components/admin/ui";
import { AForm, Submit } from "@/components/admin/Form";
import { markHandled } from "./actions";

export const metadata = { title: "Inbox" };

export default async function Inbox({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  await requireStaff("content.manage");
  const done = (await searchParams).done === "1";
  const list = await db.select().from(contactMessages).where(eq(contactMessages.handled, done)).orderBy(desc(contactMessages.createdAt)).limit(200);
  return (
    <div style={{ maxWidth: 900 }}>
      <PageHead title="Inbox" sub="Messages from the Contact page. Reply from your email, then mark them done." />
      <nav className="tabs"><Link href="/admin/inbox" aria-current={!done ? "page" : undefined}>To answer</Link><Link href="/admin/inbox?done=1" aria-current={done ? "page" : undefined}>Done</Link></nav>
      <div className="stack">
        {list.map((m) => (
          <Card key={m.id} title={m.name} sub={<>{m.email}{m.phone && ` · ${m.phone}`} · {formatDate(m.createdAt, true)} {m.orderRef && <Pill tone="info">Order {m.orderRef}</Pill>}</>}
            actions={<AForm action={markHandled}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="handled" value={done ? "false" : "true"} /><Submit className="btn sm">{done ? "Reopen" : "Mark done"}</Submit></AForm>}>
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.message}</p>
            <a className="btn sm" style={{ marginTop: 12 }} href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message to VELMONT")}`}>Reply by email</a>
          </Card>
        ))}
        {!list.length && <Card><p className="empty" style={{ padding: 10 }}>{done ? "No answered messages yet." : "All caught up."}</p></Card>}
      </div>
    </div>
  );
}
