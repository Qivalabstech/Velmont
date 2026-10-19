import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, reviews } from "@/db";
import { requireStaff } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { PageHead, Card, Pill } from "@/components/admin/ui";
import { AForm, Submit, ConfirmSubmit } from "@/components/admin/Form";
import { moderate } from "./actions";

export const metadata = { title: "Reviews" };

export default async function Reviews({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff("reviews.manage");
  const st = ((await searchParams).status || "PENDING") as "PENDING" | "APPROVED" | "REJECTED";
  const list = await db.query.reviews.findMany({ where: eq(reviews.status, st), orderBy: [desc(reviews.createdAt)], with: { product: { columns: { name: true, slug: true } } }, limit: 100 });
  return (
    <div style={{ maxWidth: 980 }}>
      <PageHead title="Reviews" sub="Reviews stay hidden until approved. Verified means the reviewer bought and received this belt." />
      <nav className="tabs">{(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => <Link key={s} href={`/admin/reviews?status=${s}`} aria-current={st === s ? "page" : undefined}>{s === "PENDING" ? "Waiting" : s === "APPROVED" ? "Published" : "Hidden"}</Link>)}</nav>
      <div className="stack">
        {list.map((r) => (
          <Card key={r.id} title={`${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}  ${r.title || ""}`} sub={<>{r.name} on <Link href={`/products/${r.product.slug}`} target="_blank">{r.product.name}</Link> · {formatDate(r.createdAt)} {r.verified && <Pill tone="good">Verified buyer</Pill>}</>}>
            <p style={{ margin: "0 0 12px", whiteSpace: "pre-wrap" }}>{r.body}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {r.status !== "APPROVED" && <AForm action={moderate}><input type="hidden" name="id" value={r.id} /><Submit className="btn sm solid" name="to" value="APPROVED">Publish</Submit></AForm>}
              {r.status !== "REJECTED" && <AForm action={moderate}><input type="hidden" name="id" value={r.id} /><Submit className="btn sm" name="to" value="REJECTED">Hide</Submit></AForm>}
              <AForm action={moderate}><input type="hidden" name="id" value={r.id} /><ConfirmSubmit name="to" value="DELETE">Delete</ConfirmSubmit></AForm>
            </div>
          </Card>
        ))}
        {!list.length && <Card><p className="empty" style={{ padding: 10 }}>Nothing here.</p></Card>}
      </div>
    </div>
  );
}
