import Link from "next/link";
import Image from "next/image";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db, products, productImages } from "@/db";
import { requireStaff } from "@/lib/auth";
import { inr } from "@/lib/money";
import { PageHead, Card, Pill } from "@/components/admin/ui";
import { AForm, Submit } from "@/components/admin/Form";
import { quickStatus } from "./actions";

export const metadata = { title: "Products" };

export default async function Products({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const me = await requireStaff("products.view");
  const sp = await searchParams;
  const w: SQL[] = [];
  if (sp.status === "ACTIVE" || sp.status === "DRAFT" || sp.status === "ARCHIVED") w.push(eq(products.status, sp.status));
  if (sp.q) w.push(or(ilike(products.name, `%${sp.q}%`), ilike(products.slug, `%${sp.q}%`))!);
  const [list, sold] = await Promise.all([
    db.query.products.findMany({
      where: w.length ? and(...w) : undefined, orderBy: [asc(products.sortOrder), desc(products.createdAt)],
      with: { images: { orderBy: [asc(productImages.sortOrder)], limit: 1 }, variants: true, category: true },
    }),
    db.execute(sql`select oi.product_id as id, sum(oi.qty)::int as units from order_items oi join orders o on o.id = oi.order_id where o.status not in ('PENDING_PAYMENT','CANCELLED') group by 1`),
  ]);
  const units = new Map((sold.rows as { id: string; units: number }[]).map((r) => [r.id, r.units]));
  const can = me.perms.has("products.manage");
  const tone = { ACTIVE: "good", DRAFT: "warn", ARCHIVED: "neutral" } as const;
  return (
    <div>
      <PageHead title="Products" sub="Only active products appear in the store. Drafts are for work in progress." actions={can && <Link className="btn solid sm" href="/admin/products/new">Add product</Link>} />
      <nav className="tabs">
        {[["", "All"], ["ACTIVE", "Active"], ["DRAFT", "Drafts"], ["ARCHIVED", "Archived"]].map(([k, l]) => (
          <Link key={k} href={k ? `/admin/products?status=${k}` : "/admin/products"} aria-current={(sp.status || "") === k ? "page" : undefined}>{l}</Link>
        ))}
      </nav>
      <form className="toolbar" method="get">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <input className="input grow" name="q" defaultValue={sp.q} placeholder="Search products" aria-label="Search products" />
        <button className="btn sm">Search</button>
      </form>
      <Card flush>
        {can && (
          <AForm action={quickStatus} id="pbulk" className="toolbar" style={{ padding: "12px 14px", margin: 0, borderBottom: "1px solid var(--line)" }}>
            <span className="muted" style={{ fontSize: ".85rem" }}>With selected:</span>
            <Submit className="btn sm" name="status" value="ACTIVE">Publish</Submit>
            <Submit className="btn sm" name="status" value="DRAFT">Move to drafts</Submit>
            <Submit className="btn sm" name="status" value="ARCHIVED">Archive</Submit>
          </AForm>
        )}
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr>{can && <th style={{ width: 32 }}></th>}<th></th><th>Product</th><th>Status</th><th>Stock</th><th className="r">Price</th><th className="r">Sold</th></tr></thead>
          <tbody>
            {list.map((p) => {
              const stock = p.variants.reduce((a, v) => a + (v.active ? v.stock : 0), 0);
              const out = p.variants.filter((v) => v.active && v.stock <= 0).length;
              return (
                <tr key={p.id}>
                  {can && <td><input type="checkbox" name="ids" value={p.id} form="pbulk" aria-label={`Select ${p.name}`} style={{ width: 18, height: 18 }} /></td>}
                  <td style={{ width: 60 }}><div className="thumb">{p.images[0] && <Image src={p.images[0].url} alt="" width={44} height={44} />}</div></td>
                  <td><Link className="rowlink" href={`/admin/products/${p.id}`}>{p.name}</Link><div className="sub">{p.category?.name || "No category"} · /{p.slug}</div></td>
                  <td><Pill tone={tone[p.status]}>{p.status === "ACTIVE" ? "Active" : p.status === "DRAFT" ? "Draft" : "Archived"}</Pill>{p.featured && <div className="sub">Featured</div>}</td>
                  <td>{stock} in {p.variants.length} sizes{out > 0 && <div className="sub" style={{ color: "var(--bad)" }}>{out} sold out</div>}</td>
                  <td className="r">{inr(p.price)}<div className="sub"><s>{inr(p.mrp)}</s></div></td>
                  <td className="r">{units.get(p.id) ?? 0}</td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={7} className="empty">No products here yet.</td></tr>}
          </tbody>
        </table></div>
      </Card>
    </div>
  );
}
