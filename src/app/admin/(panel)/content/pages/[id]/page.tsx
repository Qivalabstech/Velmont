import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, pages } from "@/db";
import { requireStaff } from "@/lib/auth";
import { PageHead, Card } from "@/components/admin/ui";
import { AForm, Submit, ConfirmSubmit } from "@/components/admin/Form";
import { savePage, deletePage } from "../../actions";

export const metadata = { title: "Edit page" };

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("content.manage");
  const id = (await params).id;
  const p = id === "new" ? null : await db.query.pages.findFirst({ where: eq(pages.id, id) });
  if (id !== "new" && !p) notFound();
  return (
    <div style={{ maxWidth: 900 }}>
      <PageHead title={p ? p.title : "New page"} back={{ href: "/admin/content?tab=pages", label: "Pages" }} actions={p && <a className="btn sm" href={`/pages/${p.slug}`} target="_blank">View ↗</a>} />
      <AForm action={savePage} className="stack">
        {p && <input type="hidden" name="id" value={p.id} />}
        <Card>
          <div className="fgrid">
            <div className="field"><label htmlFor="pg-t">Title</label><input id="pg-t" name="title" className="input" defaultValue={p?.title} /></div>
            <div className="field"><label htmlFor="pg-s">Address</label><input id="pg-s" name="slug" className="input" defaultValue={p?.slug} placeholder="e.g. gift-cards" /></div>
            <div className="field full"><label htmlFor="pg-b">Content</label><textarea id="pg-b" name="body" className="textarea" style={{ minHeight: 360, fontFamily: "var(--f-mono)", fontSize: ".85rem" }} defaultValue={p?.body} />
              <span className="hint">Formatting: start a line with ## for a heading, - for a bullet. **bold** and [link text](/shop) work too. Leave a blank line between paragraphs.</span></div>
            <label className="check full"><input type="checkbox" name="published" defaultChecked={p?.published ?? true} />Published</label>
          </div>
        </Card>
        <Card title="Search listing">
          <div className="fgrid">
            <div className="field full"><label htmlFor="pg-st">SEO title</label><input id="pg-st" name="seoTitle" className="input" defaultValue={p?.seoTitle} /></div>
            <div className="field full"><label htmlFor="pg-sd">Meta description</label><textarea id="pg-sd" name="seoDescription" className="textarea" style={{ minHeight: 70 }} defaultValue={p?.seoDescription} /></div>
          </div>
        </Card>
        <div className="savebar"><Submit>Save page</Submit></div>
      </AForm>
      {p && <AForm action={deletePage}><input type="hidden" name="id" value={p.id} /><ConfirmSubmit>Delete page</ConfirmSubmit></AForm>}
    </div>
  );
}
