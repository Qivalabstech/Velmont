import "server-only";
import { and, asc, desc, eq, ilike, inArray, ne, or, sql, arrayContains } from "drizzle-orm";
import { db, products, productImages, variants, reviews, categories, faqs } from "@/db";

export type CardProduct = {
  id: string; name: string; slug: string; tagline: string; price: number; mrp: number; badge: string | null;
  colors: string[]; images: { url: string; alt: string }[]; inStock: boolean; rating: number; reviewCount: number;
};

async function ratingMap(ids: string[]) {
  if (!ids.length) return new Map<string, { avg: number; n: number }>();
  const rows = await db.select({
    productId: reviews.productId, avg: sql<number>`avg(${reviews.rating})::float`, n: sql<number>`count(*)::int`,
  }).from(reviews).where(and(inArray(reviews.productId, ids), eq(reviews.status, "APPROVED"))).groupBy(reviews.productId);
  return new Map(rows.map((r) => [r.productId, { avg: r.avg, n: r.n }]));
}

export async function listProducts(opts: {
  category?: string; tag?: string; q?: string; sort?: string; featured?: boolean; limit?: number; excludeId?: string;
} = {}): Promise<CardProduct[]> {
  const where = [eq(products.status, "ACTIVE")];
  if (opts.category) {
    const c = await db.query.categories.findFirst({ where: eq(categories.slug, opts.category) });
    if (c) where.push(eq(products.categoryId, c.id));
  }
  if (opts.tag) where.push(arrayContains(products.tags, [opts.tag]));
  if (opts.featured) where.push(eq(products.featured, true));
  if (opts.excludeId) where.push(ne(products.id, opts.excludeId));
  if (opts.q) {
    const q = `%${opts.q.replace(/[%_]/g, "")}%`;
    where.push(or(ilike(products.name, q), ilike(products.tagline, q), ilike(products.description, q), ilike(products.leather, q))!);
  }
  const order = opts.sort === "price-asc" ? [asc(products.price)]
    : opts.sort === "price-desc" ? [desc(products.price)]
    : opts.sort === "new" ? [desc(products.createdAt)]
    : [asc(products.sortOrder), desc(products.createdAt)];
  const rows = await db.query.products.findMany({
    where: and(...where), orderBy: order, limit: opts.limit,
    with: {
      images: { orderBy: [asc(productImages.sortOrder)], limit: 2 },
      variants: { columns: { stock: true, active: true } },
    },
  });
  const ratings = await ratingMap(rows.map((r) => r.id));
  return rows.map((p) => ({
    id: p.id, name: p.name, slug: p.slug, tagline: p.tagline, price: p.price, mrp: p.mrp, badge: p.badge,
    colors: p.colors, images: p.images.map((i) => ({ url: i.url, alt: i.alt || p.name })),
    inStock: p.variants.some((v) => v.active && v.stock > 0),
    rating: ratings.get(p.id)?.avg ?? 0, reviewCount: ratings.get(p.id)?.n ?? 0,
  }));
}

export async function getProduct(slug: string) {
  const p = await db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.status, "ACTIVE")),
    with: {
      images: { orderBy: [asc(productImages.sortOrder)] },
      variants: { orderBy: [asc(variants.size)] },
      category: true,
    },
  });
  if (!p) return null;
  const revs = await db.query.reviews.findMany({
    where: and(eq(reviews.productId, p.id), eq(reviews.status, "APPROVED")),
    orderBy: [desc(reviews.createdAt)], limit: 50,
  });
  const avg = revs.length ? revs.reduce((a, r) => a + r.rating, 0) / revs.length : 0;
  return { ...p, reviews: revs, rating: avg };
}

export async function listCategories() {
  return db.select().from(categories).orderBy(asc(categories.sortOrder));
}

export async function listFaqs() {
  return db.select().from(faqs).where(eq(faqs.published, true)).orderBy(asc(faqs.sortOrder));
}

export function sizeRows() {
  return ["30", "32", "34", "36", "38", "40"].map((s) => {
    const n = Number(s);
    return { size: s, waist: `${n - 3}–${n - 1} in`, centre: `${n} in · ${Math.round(n * 2.54)} cm`, length: `${n + 5} in` };
  });
}
