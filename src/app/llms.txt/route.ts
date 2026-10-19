// llms.txt: a plain-text guide to the store for AI assistants (https://llmstxt.org).
import { asc, eq } from "drizzle-orm";
import { db, products, pages, faqs } from "@/db";
import { getSettings } from "@/lib/settings";
import { SITE_URL } from "@/lib/env";
import { inr } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSettings();
  const [ps, pgs, fq] = await Promise.all([
    db.query.products.findMany({ where: eq(products.status, "ACTIVE"), orderBy: [asc(products.sortOrder)], with: { variants: true } }),
    db.select().from(pages).where(eq(pages.published, true)),
    db.select().from(faqs).where(eq(faqs.published, true)).orderBy(asc(faqs.sortOrder)),
  ]);
  const lines = [
    `# ${s.store.name}`, "", `> ${s.seo.llmsIntro}`, "",
    `- Ships to: all of India, ${s.shipping.freeAbove === 0 ? "free shipping on every order" : `free above ${inr(s.shipping.freeAbove)}`}`,
    `- Dispatch: ${s.shipping.dispatchDays}; delivery: ${s.shipping.deliveryDays}`,
    `- Exchanges: ${s.shipping.exchangeDays}-day size exchange on unworn belts`,
    `- Payment: UPI, cards, netbanking via Razorpay${s.shipping.codEnabled ? "; cash on delivery" : ""}`,
    `- Contact: ${s.store.email}, ${s.store.phone}`, "",
    "## Products", "",
    ...ps.map((p) => `- [${p.name}](${SITE_URL}/products/${p.slug}): ${p.tagline} ${inr(p.price)} (MRP ${inr(p.mrp)}). ${p.leather}; ${p.buckle}. Sizes ${p.variants.map((v) => v.size).join(", ")}${p.variants.some((v) => v.stock > 0) ? "" : " (sold out)"}.`),
    "", "## Guides", "",
    `- [Size guide](${SITE_URL}/size-guide): add 2 inches to your trouser waist to get your belt size.`,
    `- [FAQ](${SITE_URL}/faq)`,
    ...pgs.map((p) => `- [${p.title}](${SITE_URL}/pages/${p.slug})`),
    "", "## Common questions", "",
    ...fq.flatMap((f) => [`### ${f.question}`, f.answer, ""]),
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
