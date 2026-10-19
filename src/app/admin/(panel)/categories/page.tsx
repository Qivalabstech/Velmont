import { asc, eq, sql } from "drizzle-orm";
import { db, categories, products } from "@/db";
import { requireStaff } from "@/lib/auth";
import { PageHead, Card } from "@/components/admin/ui";
import { AForm, Submit, ConfirmSubmit } from "@/components/admin/Form";
import { saveCategory, deleteCategory } from "./actions";

export const metadata = { title: "Categories" };

export default async function Categories() {
  await requireStaff("products.manage");
  const rows = await db.select({ c: categories, n: sql<number>`count(${products.id})::int` }).from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id)).groupBy(categories.id).orderBy(asc(categories.sortOrder));
  return (
    <div className="stack" style={{ maxWidth: 900 }}>
      <PageHead title="Categories" sub="Categories become filters on the shop page." />
      {rows.map(({ c, n }) => (
        <Card key={c.id} title={c.name} sub={`${n} product${n === 1 ? "" : "s"} · /shop?category=${c.slug}`}>
          <AForm action={saveCategory} className="fgrid">
            <input type="hidden" name="id" value={c.id} />
            <div className="field"><label htmlFor={`cn-${c.id}`}>Name</label><input id={`cn-${c.id}`} name="name" className="input" defaultValue={c.name} /></div>
            <div className="field"><label htmlFor={`cs-${c.id}`}>Address</label><input id={`cs-${c.id}`} name="slug" className="input" defaultValue={c.slug} /></div>
            <div className="field full"><label htmlFor={`cd-${c.id}`}>Description</label><input id={`cd-${c.id}`} name="description" className="input" defaultValue={c.description} /></div>
            <div className="field"><label htmlFor={`co-${c.id}`}>Order</label><input id={`co-${c.id}`} name="sortOrder" type="number" className="input" defaultValue={c.sortOrder} /></div>
            <div style={{ alignSelf: "end" }}><Submit className="btn sm solid">Save</Submit></div>
          </AForm>
          <AForm action={deleteCategory} style={{ marginTop: 10 }}><input type="hidden" name="id" value={c.id} /><ConfirmSubmit>Delete category</ConfirmSubmit></AForm>
        </Card>
      ))}
      <Card title="Add a category">
        <AForm action={saveCategory} reset className="fgrid">
          <div className="field"><label htmlFor="nc-n">Name</label><input id="nc-n" name="name" className="input" /></div>
          <div className="field"><label htmlFor="nc-o">Order</label><input id="nc-o" name="sortOrder" type="number" className="input" defaultValue={rows.length} /></div>
          <div className="field full"><label htmlFor="nc-d">Description</label><input id="nc-d" name="description" className="input" /></div>
          <div><Submit>Add category</Submit></div>
        </AForm>
      </Card>
    </div>
  );
}
