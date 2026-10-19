import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db, products, redirects, pages, productImages } from "@/db";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHead, Card, Pill } from "@/components/admin/ui";
import { AForm, Submit, ConfirmSubmit } from "@/components/admin/Form";
import { saveSeo, addRedirect, deleteRedirect } from "./actions";
import { AI_CRAWLERS } from "@/app/robots";

export const metadata = { title: "SEO & AI search" };

const lenTone = (n: number, lo: number, hi: number) => (n === 0 ? "bad" : n < lo || n > hi ? "warn" : "good");

export default async function Seo({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireStaff("seo.manage");
  const tab = (await searchParams).tab || "listings";
  const s = await getSettings();
  return (
    <div style={{ maxWidth: 1100 }}>
      <PageHead title="SEO & AI search" sub="Control how the store appears on Google and in answers from ChatGPT, Claude, Perplexity and Gemini. Scores live on the Site health page."
        actions={<><a className="btn sm" href="/sitemap.xml" target="_blank">sitemap.xml</a><a className="btn sm" href="/robots.txt" target="_blank">robots.txt</a><a className="btn sm" href="/llms.txt" target="_blank">llms.txt</a><Link className="btn sm solid" href="/admin/health">Run health check</Link></>} />
      <nav className="tabs">
        {[["listings", "Page listings"], ["site", "Site-wide"], ["ai", "AI search (GEO)"], ["redirects", "Redirects"]].map(([k, l]) => <Link key={k} href={`/admin/seo?tab=${k}`} aria-current={tab === k ? "page" : undefined}>{l}</Link>)}
      </nav>
      {tab === "listings" && <Listings />}
      {tab === "site" && (
        <AForm action={saveSeo} className="stack">
          <Hidden s={s} keep={["allowAiCrawlers", "llmsIntro"]} />
          <Card title="Titles and descriptions">
            <div className="fgrid">
              <div className="field"><label htmlFor="s-tpl">Title template</label><input id="s-tpl" name="titleTemplate" className="input" defaultValue={s.seo.titleTemplate} /><span className="hint">%s is replaced by the page name, e.g. “The Solana | VELMONT”.</span></div>
              <div className="field"><label htmlFor="s-dt">Homepage title</label><input id="s-dt" name="defaultTitle" className="input" defaultValue={s.seo.defaultTitle} /></div>
              <div className="field full"><label htmlFor="s-dd">Homepage description</label><textarea id="s-dd" name="defaultDescription" className="textarea" style={{ minHeight: 70 }} defaultValue={s.seo.defaultDescription} /><span className="hint">{s.seo.defaultDescription.length} characters; aim for 120–160.</span></div>
              <div className="field"><label htmlFor="s-og">Share image path</label><input id="s-og" name="ogImage" className="input" defaultValue={s.seo.ogImage} /><span className="hint">Shown when the site is shared on WhatsApp, Instagram or X.</span></div>
              <div className="field"><label htmlFor="s-gv">Google Search Console code</label><input id="s-gv" name="googleVerification" className="input" defaultValue={s.seo.googleVerification} placeholder="content value of the meta tag" /></div>
              <div className="field full"><label htmlFor="s-sa">Brand profiles</label><textarea id="s-sa" name="sameAs" className="textarea" style={{ minHeight: 80 }} defaultValue={s.seo.sameAs.join("\n")} placeholder={"https://www.instagram.com/velmont\nhttps://www.facebook.com/velmont"} /><span className="hint">One link per line. Search engines and AI assistants use these to confirm the brand is real.</span></div>
            </div>
          </Card>
          <div className="savebar"><Submit>Save SEO settings</Submit></div>
        </AForm>
      )}
      {tab === "ai" && (
        <AForm action={saveSeo} className="stack">
          <Hidden s={s} keep={["titleTemplate", "defaultTitle", "defaultDescription", "ogImage", "googleVerification", "sameAs"]} />
          <Card title="AI crawlers" sub="These bots read your site so AI assistants can recommend and cite your belts.">
            <label className="check" style={{ marginBottom: 12 }}><input type="checkbox" name="allowAiCrawlers" defaultChecked={s.seo.allowAiCrawlers} /><span><b>Allow AI assistants to read the store</b><br /><span className="muted">Recommended. Turning this off blocks them in robots.txt and the store will not appear in AI answers.</span></span></label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{AI_CRAWLERS.map((c) => <Pill key={c} tone={s.seo.allowAiCrawlers ? "good" : "bad"}>{c}</Pill>)}</div>
          </Card>
          <Card title="llms.txt summary" sub="The first line AI assistants read about your store at /llms.txt. Products, policies and FAQs are added automatically.">
            <textarea name="llmsIntro" className="textarea" defaultValue={s.seo.llmsIntro} aria-label="llms.txt intro" />
          </Card>
          <Card title="What helps AI answers mention VELMONT">
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: ".9rem" }}>
              <li>Product descriptions of 80+ words with concrete facts: leather type, width, buckle, sizes.</li>
              <li>FAQ answers that start with the answer, in under 60 words.</li>
              <li>Brand profiles listed under Site-wide, so assistants can confirm the brand.</li>
              <li>Approved customer reviews, which add ratings to product data.</li>
            </ul>
          </Card>
          <div className="savebar"><Submit>Save AI settings</Submit></div>
        </AForm>
      )}
      {tab === "redirects" && <Redirects />}
    </div>
  );
}

function Hidden({ s, keep }: { s: Awaited<ReturnType<typeof getSettings>>; keep: string[] }) {
  const v: Record<string, string> = {
    titleTemplate: s.seo.titleTemplate, defaultTitle: s.seo.defaultTitle, defaultDescription: s.seo.defaultDescription, ogImage: s.seo.ogImage,
    googleVerification: s.seo.googleVerification, sameAs: s.seo.sameAs.join("\n"), allowAiCrawlers: s.seo.allowAiCrawlers ? "on" : "", llmsIntro: s.seo.llmsIntro,
  };
  return <>{keep.map((k) => <input key={k} type="hidden" name={k} value={v[k]} />)}</>;
}

async function Listings() {
  const [ps, pgs] = await Promise.all([
    db.query.products.findMany({ where: eq(products.status, "ACTIVE"), orderBy: [asc(products.sortOrder)], with: { images: { orderBy: [asc(productImages.sortOrder)] } } }),
    db.select().from(pages).orderBy(asc(pages.slug)),
  ]);
  return (
    <div className="stack">
      <Card title="Products" sub="Titles 30–60 characters, descriptions 120–160. Click a product to edit its listing." flush>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Product</th><th>SEO title</th><th>Description</th><th>Words</th><th>Alt text</th></tr></thead>
          <tbody>{ps.map((p) => {
            const t = (p.seoTitle || p.name).length, d = (p.seoDescription || p.tagline).length, w = p.description.split(/\s+/).filter(Boolean).length;
            const missingAlt = p.images.filter((i) => !i.alt.trim()).length;
            return (
              <tr key={p.id}>
                <td><Link className="rowlink" href={`/admin/products/${p.id}`}>{p.name}</Link><div className="sub">/products/{p.slug}</div></td>
                <td><Pill tone={lenTone(t, 30, 60)}>{t} chars</Pill></td>
                <td><Pill tone={lenTone(d, 120, 160)}>{d} chars</Pill></td>
                <td><Pill tone={w >= 80 ? "good" : w >= 40 ? "warn" : "bad"}>{w}</Pill></td>
                <td><Pill tone={missingAlt ? "warn" : "good"}>{missingAlt ? `${missingAlt} missing` : "All set"}</Pill></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </Card>
      <Card title="Pages" flush>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Page</th><th>SEO title</th><th>Description</th></tr></thead>
          <tbody>{pgs.map((p) => (
            <tr key={p.id}><td><Link className="rowlink" href={`/admin/content/pages/${p.id}`}>{p.title}</Link><div className="sub">/pages/{p.slug}</div></td>
              <td><Pill tone={lenTone((p.seoTitle || p.title).length, 10, 60)}>{(p.seoTitle || p.title).length} chars</Pill></td>
              <td><Pill tone={lenTone(p.seoDescription.length, 70, 160)}>{p.seoDescription.length} chars</Pill></td></tr>
          ))}</tbody>
        </table></div>
      </Card>
    </div>
  );
}

async function Redirects() {
  const list = await db.select().from(redirects).orderBy(desc(redirects.createdAt));
  return (
    <div className="stack">
      <Card title="Add a redirect" sub="Use this when you rename a product or remove a page, so old links and Google results still work.">
        <AForm action={addRedirect} reset className="fgrid three">
          <div className="field"><label htmlFor="r-f">Old path</label><input id="r-f" name="from" className="input" placeholder="/products/old-name" /></div>
          <div className="field"><label htmlFor="r-t">New path or URL</label><input id="r-t" name="to" className="input" placeholder="/products/new-name" /></div>
          <label className="check" style={{ alignSelf: "end" }}><input type="checkbox" name="permanent" defaultChecked />Permanent (301)</label>
          <div><Submit>Add redirect</Submit></div>
        </AForm>
      </Card>
      <Card flush><div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>From</th><th>To</th><th>Type</th><th></th></tr></thead>
        <tbody>{list.map((r) => (
          <tr key={r.id}><td><code>{r.from}</code></td><td><code>{r.to}</code></td><td>{r.permanent ? "301" : "302"}</td>
            <td className="r"><AForm action={deleteRedirect}><input type="hidden" name="id" value={r.id} /><ConfirmSubmit>Remove</ConfirmSubmit></AForm></td></tr>
        ))}{!list.length && <tr><td colSpan={4} className="empty">No redirects yet.</td></tr>}</tbody>
      </table></div></Card>
    </div>
  );
}
