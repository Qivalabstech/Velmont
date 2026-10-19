import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, pages, faqs } from "@/db";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/utils";
import { PageHead, Card, Pill } from "@/components/admin/ui";
import { AForm, Submit, ConfirmSubmit } from "@/components/admin/Form";
import { saveHomepage, saveFaq, deleteFaq } from "./actions";

export const metadata = { title: "Homepage & pages" };

export default async function Content({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireStaff("content.manage");
  const tab = (await searchParams).tab || "home";
  const s = await getSettings();
  const c = s.content;
  return (
    <div style={{ maxWidth: 1000 }}>
      <PageHead title="Homepage & pages" sub="Edit the words on your store. Changes go live as soon as you save." />
      <nav className="tabs">
        {[["home", "Homepage"], ["pages", "Pages"], ["faq", "FAQ"]].map(([k, l]) => <Link key={k} href={`/admin/content?tab=${k}`} aria-current={tab === k ? "page" : undefined}>{l}</Link>)}
      </nav>

      {tab === "home" && (
        <AForm action={saveHomepage} className="stack">
          <Card title="Announcement bar" sub="One message per line. They scroll across the top of every page.">
            <textarea name="announcements" className="textarea" defaultValue={c.announcements.join("\n")} aria-label="Announcements" />
          </Card>
          <Card title="Hero">
            <div className="fgrid">
              <div className="field full"><label htmlFor="h-eb">Small label</label><input id="h-eb" name="heroEyebrow" className="input" defaultValue={c.heroEyebrow} /></div>
              <div className="field full"><label htmlFor="h-l">Headline</label><textarea id="h-l" name="heroLines" className="textarea" style={{ minHeight: 90 }} defaultValue={c.heroLines.join("\n")} /><span className="hint">One line per row, up to 4. The second line is shown in the accent colour.</span></div>
              <div className="field full"><label htmlFor="h-t">Intro text</label><textarea id="h-t" name="heroText" className="textarea" defaultValue={c.heroText} /></div>
            </div>
          </Card>
          <Card title="Scrolling banner" sub="Comma-separated words for the two big moving rows.">
            <div className="fgrid">
              <div className="field full"><label htmlFor="b1">Row one</label><input id="b1" name="bandRowOne" className="input" defaultValue={c.bandRowOne.join(", ")} /></div>
              <div className="field full"><label htmlFor="b2">Row two</label><input id="b2" name="bandRowTwo" className="input" defaultValue={c.bandRowTwo.join(", ")} /></div>
            </div>
          </Card>
          <Card title="Collection section">
            <div className="fgrid">
              <div className="field full"><label htmlFor="ct">Heading</label><input id="ct" name="collectionTitle" className="input" defaultValue={c.collectionTitle} /></div>
              <div className="field full"><label htmlFor="cx">Text</label><textarea id="cx" name="collectionText" className="textarea" defaultValue={c.collectionText} /></div>
            </div>
          </Card>
          <div className="savebar"><Link className="btn" href="/" target="_blank">Preview store ↗</Link><Submit>Save homepage</Submit></div>
        </AForm>
      )}

      {tab === "pages" && <PagesTab />}
      {tab === "faq" && <FaqTab />}
    </div>
  );
}

async function PagesTab() {
  const list = await db.select().from(pages).orderBy(asc(pages.slug));
  return (
    <Card flush actions={<Link className="btn sm solid" href="/admin/content/pages/new">New page</Link>} title="Store pages">
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Title</th><th>Address</th><th>Status</th><th>Updated</th></tr></thead>
        <tbody>{list.map((p) => (
          <tr key={p.id}><td><Link className="rowlink" href={`/admin/content/pages/${p.id}`}>{p.title}</Link></td><td className="sub">/pages/{p.slug}</td>
            <td><Pill tone={p.published ? "good" : "neutral"}>{p.published ? "Published" : "Hidden"}</Pill></td><td>{formatDate(p.updatedAt)}</td></tr>
        ))}</tbody>
      </table></div>
    </Card>
  );
}

async function FaqTab() {
  const list = await db.select().from(faqs).orderBy(asc(faqs.sortOrder));
  return (
    <div className="stack">
      <div className="hint-box">Clear question-and-answer pairs help Google show rich results and help AI assistants answer questions about your belts. Keep answers under about 60 words.</div>
      {list.map((f) => (
        <Card key={f.id}>
          <AForm action={saveFaq} className="fgrid">
            <input type="hidden" name="id" value={f.id} />
            <div className="field full"><label htmlFor={`q-${f.id}`}>Question</label><input id={`q-${f.id}`} name="question" className="input" defaultValue={f.question} /></div>
            <div className="field full"><label htmlFor={`a-${f.id}`}>Answer <span className="muted">({f.answer.split(/\s+/).length} words)</span></label><textarea id={`a-${f.id}`} name="answer" className="textarea" style={{ minHeight: 80 }} defaultValue={f.answer} /></div>
            <div className="field"><label htmlFor={`o-${f.id}`}>Order</label><input id={`o-${f.id}`} name="sortOrder" type="number" className="input" defaultValue={f.sortOrder} /></div>
            <label className="check" style={{ alignSelf: "end" }}><input type="checkbox" name="published" defaultChecked={f.published} />Show on site</label>
            <div><Submit className="btn sm solid">Save</Submit></div>
          </AForm>
          <AForm action={deleteFaq} style={{ marginTop: 8 }}><input type="hidden" name="id" value={f.id} /><ConfirmSubmit>Delete</ConfirmSubmit></AForm>
        </Card>
      ))}
      <Card title="Add a question">
        <AForm action={saveFaq} reset className="fgrid">
          <div className="field full"><label htmlFor="nq">Question</label><input id="nq" name="question" className="input" /></div>
          <div className="field full"><label htmlFor="na">Answer</label><textarea id="na" name="answer" className="textarea" /></div>
          <input type="hidden" name="sortOrder" value={list.length} /><input type="hidden" name="published" value="on" />
          <div><Submit>Add question</Submit></div>
        </AForm>
      </Card>
    </div>
  );
}
