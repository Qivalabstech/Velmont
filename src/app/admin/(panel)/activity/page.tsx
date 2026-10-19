import Link from "next/link";
import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db, auditLogs, emailLogs, errorLogs } from "@/db";
import { requireStaff } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { PageHead, Card, Pill, Pager } from "@/components/admin/ui";

export const metadata = { title: "Activity log" };
const PER = 50;

export default async function Activity({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; entity?: string; page?: string }> }) {
  await requireStaff("activity.view");
  const sp = await searchParams;
  const tab = sp.tab || "staff";
  const page = Math.max(1, Number(sp.page) || 1);
  return (
    <div style={{ maxWidth: 1100 }}>
      <PageHead title="Activity log" sub="Who changed what, which emails went out, and any errors the site recorded." />
      <nav className="tabs">{[["staff", "Staff actions"], ["emails", "Emails"], ["errors", "Errors"]].map(([k, l]) => <Link key={k} href={`/admin/activity?tab=${k}`} aria-current={tab === k ? "page" : undefined}>{l}</Link>)}</nav>
      {tab === "staff" && <StaffLog sp={sp} page={page} />}
      {tab === "emails" && <Emails page={page} />}
      {tab === "errors" && <Errors page={page} />}
    </div>
  );
}

async function StaffLog({ sp, page }: { sp: { q?: string; entity?: string }; page: number }) {
  const w: SQL[] = [];
  if (sp.entity) w.push(eq(auditLogs.entity, sp.entity));
  if (sp.q) w.push(sql`(${ilike(auditLogs.summary, `%${sp.q}%`)} or ${ilike(auditLogs.actorName, `%${sp.q}%`)})`);
  const where = w.length ? and(...w) : undefined;
  const [rows, [{ n }], ents] = await Promise.all([
    db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(PER).offset((page - 1) * PER),
    db.select({ n: sql<number>`count(*)::int` }).from(auditLogs).where(where),
    db.selectDistinct({ e: auditLogs.entity }).from(auditLogs),
  ]);
  return (
    <>
      <form className="toolbar" method="get">
        <input className="input grow" name="q" defaultValue={sp.q} placeholder="Search person or change" aria-label="Search activity" />
        <select className="select" name="entity" defaultValue={sp.entity || ""} aria-label="Area"><option value="">All areas</option>{ents.map((e) => <option key={e.e} value={e.e}>{e.e}</option>)}</select>
        <button className="btn sm">Filter</button>
      </form>
      <Card flush>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>When</th><th>Who</th><th>Area</th><th>What changed</th><th>IP</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}><td className="nowrap">{formatDate(r.createdAt, true)}</td><td>{r.actorName}</td><td><Pill tone={r.action === "login_failed" ? "bad" : "neutral"}>{r.entity} · {r.action}</Pill></td><td>{r.summary}</td><td className="sub">{r.ip || "—"}</td></tr>
          ))}{!rows.length && <tr><td colSpan={5} className="empty">Nothing recorded yet.</td></tr>}</tbody>
        </table></div>
        <Pager page={page} total={n} per={PER} base={`/admin/activity?tab=staff${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}${sp.entity ? `&entity=${sp.entity}` : ""}`} />
      </Card>
    </>
  );
}

async function Emails({ page }: { page: number }) {
  const rows = await db.select().from(emailLogs).orderBy(desc(emailLogs.createdAt)).limit(PER).offset((page - 1) * PER);
  return (
    <Card flush><div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>When</th><th>To</th><th>Subject</th><th>Status</th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.id}><td className="nowrap">{formatDate(r.createdAt, true)}</td><td>{r.to}</td><td>{r.subject}</td>
          <td><Pill tone={r.status === "sent" ? "good" : r.status === "failed" ? "bad" : "warn"}>{r.status === "skipped" ? "Not sent (email not set up)" : r.status}</Pill>{r.error && r.status === "failed" && <div className="sub">{r.error}</div>}</td></tr>
      ))}{!rows.length && <tr><td colSpan={4} className="empty">No emails yet.</td></tr>}</tbody>
    </table></div></Card>
  );
}

async function Errors({ page }: { page: number }) {
  const rows = await db.select().from(errorLogs).orderBy(desc(errorLogs.createdAt)).limit(PER).offset((page - 1) * PER);
  return (
    <Card flush><div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>When</th><th>Where</th><th>Message</th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.id}><td className="nowrap">{formatDate(r.createdAt, true)}</td><td><code>{r.source}</code><div className="sub">{r.path}</div></td><td>{r.message}</td></tr>
      ))}{!rows.length && <tr><td colSpan={3} className="empty">No errors recorded.</td></tr>}</tbody>
    </table></div></Card>
  );
}
