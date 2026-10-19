import "server-only";
import { parse, type HTMLElement } from "node-html-parser";
import { and, eq, sql } from "drizzle-orm";
import { db, products, pages, faqs, reviews, healthRuns } from "@/db";
import { getSettings } from "@/lib/settings";
import { SITE_URL } from "@/lib/env";
import { internalBase } from "./live";
import { score, pct, grade, type Check, type Section } from "./types";

type PageResult = {
  path: string; status: number; ms: number; bytes: number; title: string; description: string; h1: number; canonical: string;
  og: boolean; lang: boolean; viewport: boolean; noindex: boolean; imgs: number; imgsNoAlt: number; jsonld: unknown[]; jsonldErrors: number;
  questionHeadings: number; links: string[]; textWords: number;
};

async function fetchPage(p: string): Promise<{ res: PageResult; root: HTMLElement | null }> {
  const t = Date.now();
  try {
    const r = await fetch(internalBase() + p, { cache: "no-store", headers: { "user-agent": "VelmontAuditBot/1.0 (+health)" }, signal: AbortSignal.timeout(20000) });
    const html = await r.text();
    const ms = Date.now() - t;
    const root = parse(html);
    const meta = (sel: string) => root.querySelector(sel)?.getAttribute("content") || "";
    const jsonld: unknown[] = [];
    let jsonldErrors = 0;
    for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
      try { const v = JSON.parse(s.text); Array.isArray(v) ? jsonld.push(...v) : jsonld.push(v); } catch { jsonldErrors++; }
    }
    const imgs = root.querySelectorAll("main img");
    const main = root.querySelector("main") || root;
    const heads = main.querySelectorAll("h2, h3, summary");
    return {
      root,
      res: {
        path: p, status: r.status, ms, bytes: html.length, title: root.querySelector("title")?.text.trim() || "",
        description: meta('meta[name="description"]'), h1: root.querySelectorAll("h1").length,
        canonical: root.querySelector('link[rel="canonical"]')?.getAttribute("href") || "",
        og: !!meta('meta[property="og:title"]') && !!meta('meta[property="og:image"]'),
        lang: !!root.querySelector("html")?.getAttribute("lang"), viewport: !!root.querySelector('meta[name="viewport"]'),
        noindex: /noindex/i.test(meta('meta[name="robots"]')),
        imgs: imgs.length, imgsNoAlt: imgs.filter((i) => i.getAttribute("alt") === undefined).length,
        jsonld, jsonldErrors, questionHeadings: heads.filter((h) => h.text.trim().endsWith("?")).length,
        links: root.querySelectorAll("a[href^='/']").map((a) => a.getAttribute("href")!.split("#")[0].split("?")[0]).filter(Boolean),
        textWords: main.text.split(/\s+/).filter(Boolean).length,
      },
    };
  } catch (e) {
    return { root: null, res: { path: p, status: 0, ms: Date.now() - t, bytes: 0, title: "", description: "", h1: 0, canonical: "", og: false, lang: false, viewport: false, noindex: false, imgs: 0, imgsNoAlt: 0, jsonld: [], jsonldErrors: 0, questionHeadings: 0, links: [], textWords: 0 } };
  }
}

const types = (p: PageResult) => p.jsonld.map((j) => (j as { "@type"?: string })["@type"]);
const find = (p: PageResult, t: string) => p.jsonld.find((j) => (j as { "@type"?: string })["@type"] === t) as Record<string, unknown> | undefined;

export async function runSiteAudit(trigger = "manual") {
  const started = Date.now();
  const s = await getSettings();
  const [ps, pgs, fq, [{ approved }]] = await Promise.all([
    db.query.products.findMany({ where: eq(products.status, "ACTIVE"), with: { images: true } }),
    db.select().from(pages).where(eq(pages.published, true)),
    db.select().from(faqs).where(eq(faqs.published, true)),
    db.select({ approved: sql<number>`count(*)::int` }).from(reviews).where(eq(reviews.status, "APPROVED")),
  ]);
  const paths = ["/", "/shop", "/faq", "/size-guide", "/contact", "/track", ...ps.map((p) => `/products/${p.slug}`), ...pgs.map((p) => `/pages/${p.slug}`)];
  const crawled: PageResult[] = [];
  for (const p of paths) crawled.push((await fetchPage(p)).res);

  const fetchText = async (p: string) => {
    try { const r = await fetch(internalBase() + p, { cache: "no-store" }); return { ok: r.ok, text: await r.text() }; } catch { return { ok: false, text: "" }; }
  };
  const [sitemap, robots, llms] = await Promise.all([fetchText("/sitemap.xml"), fetchText("/robots.txt"), fetchText("/llms.txt")]);

  // Broken internal links (sample of unique links found on crawled pages)
  const broken: string[] = [];
  const allLinks = [...new Set(crawled.flatMap((c) => c.links))].filter((l) => !l.startsWith("/account") && !l.startsWith("/admin"));
  const linkSet = allLinks.filter((l) => !paths.includes(l)).slice(0, 40);
  for (const c of crawled) if (c.status >= 400 && allLinks.includes(c.path)) broken.push(c.path);
  for (const l of linkSet) {
    try { const r = await fetch(internalBase() + l, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(10000) }); if (r.status >= 400) broken.push(l); } catch { broken.push(l); }
  }

  const ok = crawled.filter((c) => c.status === 200);
  const content = ok.filter((c) => !["/track", "/contact"].includes(c.path));
  const productPages = crawled.filter((c) => c.path.startsWith("/products/"));
  const titles = ok.map((c) => c.title);
  const dupTitles = titles.filter((t, i) => titles.indexOf(t) !== i);
  const badTitle = ok.filter((c) => c.title.length < 20 || c.title.length > 70);
  const badDesc = ok.filter((c) => c.description.length < 70 || c.description.length > 170);
  const badH1 = ok.filter((c) => c.h1 !== 1);
  const noCanon = ok.filter((c) => !c.canonical && c.path !== "/track" && c.path !== "/contact");
  const totalImgs = ok.reduce((a, c) => a + c.imgs, 0), noAlt = ok.reduce((a, c) => a + c.imgsNoAlt, 0);
  const avgMs = Math.round(ok.reduce((a, c) => a + c.ms, 0) / Math.max(ok.length, 1));
  const slowest = [...ok].sort((a, b) => b.ms - a.ms)[0];
  const ldErrors = ok.reduce((a, c) => a + c.jsonldErrors, 0);
  const sitemapMissing = ps.filter((p) => !sitemap.text.includes(`/products/${p.slug}`));
  const robotsBlocksAll = /User-agent:\s*\*\s*\n(?:.*\n)*?Disallow:\s*\/\s*$/im.test(robots.text);
  const list = (arr: PageResult[]) => arr.slice(0, 4).map((x) => x.path).join(", ") + (arr.length > 4 ? ` +${arr.length - 4} more` : "");

  const seoChecks: Check[] = [
    { id: "status", label: "All store pages load", status: ok.length === crawled.length ? "pass" : "fail", value: `${ok.length}/${crawled.length}`, fix: ok.length < crawled.length ? `Not loading: ${list(crawled.filter((c) => c.status !== 200))}` : undefined, weight: 3 },
    { id: "https", label: "Site uses HTTPS", status: SITE_URL.startsWith("https://") ? "pass" : "fail", value: SITE_URL, fix: "Set SITE_URL to your https:// domain once SSL is live.", weight: 2 },
    { id: "titles", label: "Page titles are 20–70 characters", status: grade(ok.length - badTitle.length, ok.length), value: `${ok.length - badTitle.length}/${ok.length}`, fix: badTitle.length ? `Adjust: ${list(badTitle)}` : undefined, weight: 2 },
    { id: "dup-titles", label: "No two pages share a title", status: dupTitles.length ? "warn" : "pass", value: dupTitles.length ? `${dupTitles.length} duplicates` : "Unique", fix: dupTitles.length ? `Duplicated: ${[...new Set(dupTitles)].slice(0, 3).join(" · ")}` : undefined },
    { id: "desc", label: "Meta descriptions are 70–170 characters", status: grade(ok.length - badDesc.length, ok.length), value: `${ok.length - badDesc.length}/${ok.length}`, fix: badDesc.length ? `Write descriptions for: ${list(badDesc)}` : undefined, weight: 2 },
    { id: "h1", label: "Each page has exactly one H1 heading", status: grade(ok.length - badH1.length, ok.length), value: `${ok.length - badH1.length}/${ok.length}`, fix: badH1.length ? `Check: ${list(badH1)}` : undefined },
    { id: "canonical", label: "Canonical URLs set", status: grade(ok.length - noCanon.length, ok.length), value: `${ok.length - noCanon.length}/${ok.length}`, fix: noCanon.length ? `Missing on: ${list(noCanon)}` : undefined },
    { id: "og", label: "Share previews (Open Graph) on every page", status: grade(ok.filter((c) => c.og).length, ok.length), value: `${ok.filter((c) => c.og).length}/${ok.length}` },
    { id: "alt", label: "Images have alt text", status: grade(totalImgs - noAlt, totalImgs, 0.9), value: `${pct(totalImgs - noAlt, totalImgs)}%`, fix: noAlt ? "Add photo descriptions in each product’s Photos section." : undefined, weight: 2 },
    { id: "lang", label: "Language and mobile viewport declared", status: ok.every((c) => c.lang && c.viewport) ? "pass" : "fail" },
    { id: "noindex", label: "Public pages are indexable", status: ok.some((c) => c.noindex && !["/track"].includes(c.path)) ? "fail" : "pass" },
    { id: "sitemap", label: "Sitemap lists every product", status: sitemap.ok && !sitemapMissing.length ? "pass" : "fail", value: sitemap.ok ? `${ps.length - sitemapMissing.length}/${ps.length}` : "Not reachable", weight: 2 },
    { id: "robots", label: "robots.txt allows search engines and points to the sitemap", status: robots.ok && !robotsBlocksAll && /sitemap:/i.test(robots.text) ? "pass" : "fail", weight: 2 },
    { id: "schema", label: "Structured data is valid JSON-LD", status: ldErrors ? "fail" : "pass", value: ldErrors ? `${ldErrors} broken blocks` : `${ok.reduce((a, c) => a + c.jsonld.length, 0)} blocks` },
    { id: "links", label: "No broken internal links", status: broken.length ? "fail" : "pass", value: broken.length ? `${broken.length} broken` : `${allLinks.length} links checked`, fix: broken.length ? `Fix or redirect: ${broken.slice(0, 5).join(", ")}` : undefined, weight: 2 },
    { id: "speed", label: "Server responds fast (under 800 ms per page)", status: avgMs < 800 ? "pass" : avgMs < 1800 ? "warn" : "fail", value: `${avgMs} ms average`, fix: avgMs >= 800 ? `Slowest: ${slowest?.path} at ${slowest?.ms} ms. Check server CPU and database.` : undefined, weight: 2 },
    { id: "thin", label: "Content pages have enough text to rank (120+ words)", status: grade(content.filter((c) => c.textWords >= 120).length, content.length, 0.7), value: `${content.filter((c) => c.textWords >= 120).length}/${content.length}`, fix: content.some((c) => c.textWords < 120) ? `Add text to: ${list(content.filter((c) => c.textWords < 120))}` : undefined },
  ];

  // ----- AEO: answer engines (Google rich results, voice, featured snippets)
  const home = crawled.find((c) => c.path === "/");
  const faqPage = crawled.find((c) => c.path === "/faq");
  const faqLd = faqPage && find(faqPage, "FAQPage");
  const faqCount = (faqLd?.mainEntity as unknown[] | undefined)?.length ?? 0;
  const concise = fq.filter((f) => f.answer.split(/\s+/).length <= 60).length;
  const withProduct = productPages.filter((c) => { const p = find(c, "Product"); const o = p?.offers as Record<string, unknown> | undefined; return !!(p && o?.price && o?.availability); });
  const withRating = productPages.filter((c) => !!find(c, "Product")?.aggregateRating);
  const withCrumb = productPages.filter((c) => types(c).includes("BreadcrumbList"));
  const withPolicy = productPages.filter((c) => { const o = find(c, "Product")?.offers as Record<string, unknown> | undefined; return !!(o?.hasMerchantReturnPolicy && o?.shippingDetails); });
  const org = home && find(home, "Organization");
  const site = home && find(home, "WebSite");
  const aeoChecks: Check[] = [
    { id: "faq-schema", label: "FAQ page has FAQ structured data", status: faqCount >= 5 ? "pass" : faqCount > 0 ? "warn" : "fail", value: `${faqCount} questions`, fix: faqCount < 5 ? "Add at least 5 questions in Homepage & pages → FAQ." : undefined, weight: 3 },
    { id: "faq-concise", label: "FAQ answers are short enough to be quoted (≤ 60 words)", status: grade(concise, fq.length), value: `${concise}/${fq.length}`, fix: concise < fq.length ? "Start each answer with the direct answer, then add detail." : undefined, weight: 2 },
    { id: "q-headings", label: "Questions written as headings", status: (faqPage?.questionHeadings ?? 0) >= 5 ? "pass" : "warn", value: `${faqPage?.questionHeadings ?? 0} on /faq` },
    { id: "product-schema", label: "Every product has Product data with price and stock", status: grade(withProduct.length, productPages.length, 1), value: `${withProduct.length}/${productPages.length}`, weight: 3 },
    { id: "policies", label: "Shipping and return policy in product data", status: grade(withPolicy.length, productPages.length, 1), value: `${withPolicy.length}/${productPages.length}` },
    { id: "ratings", label: "Products show star ratings", status: withRating.length === productPages.length && productPages.length ? "pass" : withRating.length ? "warn" : "fail", value: `${withRating.length}/${productPages.length} with reviews`, fix: withRating.length < productPages.length ? "Ask delivered customers for reviews and approve them under Reviews." : undefined, weight: 2 },
    { id: "breadcrumbs", label: "Breadcrumb data on product pages", status: grade(withCrumb.length, productPages.length, 1), value: `${withCrumb.length}/${productPages.length}` },
    { id: "org", label: "Business identity with contact details", status: org && org.contactPoint ? "pass" : "fail", weight: 2 },
    { id: "search-action", label: "Site search available to search engines", status: site && site.potentialAction ? "pass" : "warn" },
    { id: "size-answer", label: "Size question answered in one sentence", status: crawled.find((c) => c.path === "/size-guide")?.status === 200 ? "pass" : "fail", value: "/size-guide" },
  ];

  // ----- GEO: generative engines (ChatGPT, Claude, Perplexity, Gemini, AI Overviews)
  const words = ps.map((p) => p.description.split(/\s+/).filter(Boolean).length);
  const rich = words.filter((w) => w >= 80).length;
  const descs = ps.map((p) => p.description.trim().slice(0, 200));
  const dupDesc = descs.filter((d, i) => d && descs.indexOf(d) !== i).length;
  const facts = ps.filter((p) => p.leather && p.buckle && p.width).length;
  const llmsMissing = ps.filter((p) => !llms.text.includes(`/products/${p.slug}`));
  const aiBots = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "OAI-SearchBot"];
  const blockedBots = aiBots.filter((b) => new RegExp(`User-agent:\\s*${b}\\s*\\n\\s*Disallow:\\s*/\\s*$`, "im").test(robots.text));
  const sameAs = s.seo.sameAs.filter(Boolean).length;
  const staleCut = Date.now() - 180 * 86400_000;
  const fresh = [...ps.map((p) => p.updatedAt), ...pgs.map((p) => p.updatedAt)].filter((d) => d.getTime() > staleCut).length;
  const about = pgs.find((p) => p.slug === "about");
  const ssr = productPages.filter((c) => { const pr = ps.find((p) => c.path.endsWith(p.slug)); return pr && c.title.includes(pr.name); }).length;
  const geoChecks: Check[] = [
    { id: "ai-crawlers", label: "AI assistants are allowed to read the store", status: blockedBots.length ? "fail" : "pass", value: blockedBots.length ? `Blocked: ${blockedBots.join(", ")}` : aiBots.join(", "), fix: blockedBots.length ? "Turn on “Allow AI assistants” in SEO & AI search." : undefined, weight: 3 },
    { id: "llms", label: "llms.txt describes the store and every product", status: llms.ok && !llmsMissing.length ? "pass" : llms.ok ? "warn" : "fail", value: llms.ok ? `${ps.length - llmsMissing.length}/${ps.length} products` : "Missing", weight: 2 },
    { id: "rich-desc", label: "Product descriptions have 80+ words of facts", status: grade(rich, ps.length, 0.75), value: `${rich}/${ps.length}`, fix: rich < ps.length ? "Add materials, size, how it wears and what to wear it with." : undefined, weight: 3 },
    { id: "unique", label: "Every product description is unique", status: dupDesc ? "fail" : "pass", weight: 2 },
    { id: "facts", label: "Leather, buckle and width filled for every product", status: grade(facts, ps.length, 1), value: `${facts}/${ps.length}`, weight: 2 },
    { id: "entity", label: "Brand profiles linked (Instagram, Facebook, marketplaces)", status: sameAs >= 2 ? "pass" : sameAs === 1 ? "warn" : "fail", value: `${sameAs} linked`, fix: sameAs < 2 ? "Add brand profile links in SEO & AI search → Site-wide." : undefined, weight: 2 },
    { id: "reviews", label: "Independent proof: approved customer reviews", status: approved >= 10 ? "pass" : approved >= 3 ? "warn" : "fail", value: `${approved} approved`, fix: approved < 10 ? "AI answers favour products with real reviews. Email delivered customers and ask for one." : undefined, weight: 2 },
    { id: "about", label: "About page explains who makes the belts", status: about && about.body.split(/\s+/).length >= 120 ? "pass" : about ? "warn" : "fail", value: about ? `${about.body.split(/\s+/).length} words` : "Missing" },
    { id: "fresh", label: "Content updated in the last 6 months", status: grade(fresh, ps.length + pgs.length, 0.5), value: `${fresh}/${ps.length + pgs.length} pages` },
    { id: "ssr", label: "Product content is in the page HTML (no JavaScript needed)", status: grade(ssr, productPages.length, 1), value: `${ssr}/${productPages.length}`, weight: 2 },
    { id: "alt-geo", label: "Photos are described for AI image understanding", status: grade(totalImgs - noAlt, totalImgs, 0.9), value: `${pct(totalImgs - noAlt, totalImgs)}%` },
  ];

  const seo: Section = { score: score(seoChecks), checks: seoChecks };
  const aeo: Section = { score: score(aeoChecks), checks: aeoChecks };
  const geo: Section = { score: score(geoChecks), checks: geoChecks };
  const result = {
    seo, aeo, geo,
    pages: crawled.map((c) => ({ path: c.path, status: c.status, ms: c.ms, kb: Math.round(c.bytes / 1024), title: c.title, words: c.textWords })),
    avgMs,
  };
  const overall = Math.round((seo.score + aeo.score + geo.score) / 3);
  await db.insert(healthRuns).values({ kind: "audit", trigger, score: overall, result, durationMs: Date.now() - started });
  return result;
}

export async function latestRun(kind: string) {
  return db.query.healthRuns.findFirst({ where: eq(healthRuns.kind, kind), orderBy: (h, { desc }) => [desc(h.createdAt)] });
}

export async function runHistory(kind: string, limit = 14) {
  return db.query.healthRuns.findMany({ where: and(eq(healthRuns.kind, kind)), orderBy: (h, { desc }) => [desc(h.createdAt)], limit });
}
