import Link from "next/link";
import { and, asc, eq, lte } from "drizzle-orm";
import { db, variants, products } from "@/db";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHead, Card, Pill } from "@/components/admin/ui";
import { AForm, Submit } from "@/components/admin/Form";
import { saveStock } from "./actions";

export const metadata = { title: "Inventory" };

export default async function Inventory({ searchParams }: { searchParams: Promise<{ low?: string }> }) {
  await requireStaff("inventory.manage");
  const s = await getSettings();
  const low = (await searchParams).low === "1";
  const rows = await db.select({ id: variants.id, sku: variants.sku, size: variants.size, stock: variants.stock, active: variants.active, name: products.name, pid: products.id, status: products.status })
    .from(variants).innerJoin(products, eq(products.id, variants.productId))
    .where(low ? and(lte(variants.stock, s.inventory.lowStockThreshold), eq(variants.active, true)) : undefined)
    .orderBy(asc(products.sortOrder), asc(products.name), asc(variants.size));
  const total = rows.reduce((a, r) => a + r.stock, 0);
  return (
    <div>
      <PageHead title="Inventory" sub={`${total} belts in stock across ${rows.length} sizes. Change any number and save.`} />
      <nav className="tabs"><Link href="/admin/inventory" aria-current={!low ? "page" : undefined}>All sizes</Link><Link href="/admin/inventory?low=1" aria-current={low ? "page" : undefined}>Low stock (≤ {s.inventory.lowStockThreshold})</Link></nav>
      <AForm action={saveStock}>
        <Card flush>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Product</th><th>Size</th><th>SKU</th><th>Status</th><th>Stock</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link className="rowlink" href={`/admin/products/${r.pid}`}>{r.name}</Link>{r.status !== "ACTIVE" && <div className="sub">{r.status.toLowerCase()}</div>}</td>
                  <td>{r.size}</td><td className="sub">{r.sku}</td>
                  <td>{!r.active ? <Pill tone="neutral">Off sale</Pill> : r.stock <= 0 ? <Pill tone="bad">Sold out</Pill> : r.stock <= s.inventory.lowStockThreshold ? <Pill tone="warn">Low</Pill> : <Pill tone="good">In stock</Pill>}</td>
                  <td><input type="hidden" name={`was:${r.id}`} value={r.stock} />
                    <input className="input sm num-in" type="number" min={0} name={`stock:${r.id}`} defaultValue={r.stock} aria-label={`Stock for ${r.name} size ${r.size}`} /></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={5} className="empty">{low ? "Nothing is running low." : "No products yet."}</td></tr>}
            </tbody>
          </table></div>
        </Card>
        <div className="savebar"><Submit>Save stock</Submit></div>
      </AForm>
    </div>
  );
}
