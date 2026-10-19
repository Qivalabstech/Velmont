import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { db, products, pages } from "@/db";
import { SITE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [ps, pgs] = await Promise.all([
    db.query.products.findMany({ where: eq(products.status, "ACTIVE"), columns: { slug: true, updatedAt: true }, with: { images: { columns: { url: true } } } }),
    db.query.pages.findMany({ where: eq(pages.published, true), columns: { slug: true, updatedAt: true } }),
  ]);
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/shop`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...ps.map((p) => ({ url: `${SITE_URL}/products/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8, images: p.images.map((i) => `${SITE_URL}${i.url}`) })),
    { url: `${SITE_URL}/size-guide`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/contact`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/track`, changeFrequency: "yearly", priority: 0.3 },
    ...pgs.map((p) => ({ url: `${SITE_URL}/pages/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
