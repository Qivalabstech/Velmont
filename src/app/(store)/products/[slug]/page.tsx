import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getProduct, listProducts } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { getCustomer } from "@/lib/auth";
import { db, wishlistItems } from "@/db";
import { ProductCard } from "@/components/store/ProductCard";
import { JsonLd } from "@/components/store/JsonLd";
import { SizeGuide } from "@/components/store/SizeGuide";
import { breadcrumbLd, productLd } from "@/lib/seo";
import { ProductBuy } from "./ProductBuy";
import { ReviewForm } from "./ReviewForm";
import { formatDate } from "@/lib/utils";

type P = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  if (!p) return { title: "Belt not found" };
  return {
    title: p.seoTitle || p.name,
    description: p.seoDescription || p.tagline,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { type: "website", title: p.seoTitle || p.name, description: p.seoDescription || p.tagline, images: p.images.slice(0, 1).map((i) => i.url) },
  };
}

export default async function ProductPage({ params }: { params: P }) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) notFound();
  const [s, related, customer] = await Promise.all([getSettings(), listProducts({ excludeId: p.id, limit: 4 }), getCustomer()]);
  const saved = customer
    ? !!(await db.query.wishlistItems.findFirst({ where: and(eq(wishlistItems.userId, customer.id), eq(wishlistItems.productId, p.id)) }))
    : false;
  const dist = [5, 4, 3, 2, 1].map((r) => ({ r, n: p.reviews.filter((x) => x.rating === r).length }));
  const paras = p.description.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="wrap">
      <JsonLd data={[await productLd(p), breadcrumbLd([
        { name: "Home", path: "/" }, { name: "Shop", path: "/shop" }, { name: p.name, path: `/products/${p.slug}` },
      ])]} />
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span aria-hidden>/</span><Link href="/shop">Shop</Link><span aria-hidden>/</span><span>{p.name}</span>
      </nav>

      <ProductBuy
        product={{ id: p.id, name: p.name, slug: p.slug, price: p.price, mrp: p.mrp, tagline: p.tagline, badge: p.badge }}
        images={p.images.map((i) => ({ url: i.url, alt: i.alt || p.name }))}
        variants={p.variants.map((v) => ({ id: v.id, size: v.size, stock: v.stock, active: v.active }))}
        rating={p.rating} reviewCount={p.reviews.length} saved={saved} signedIn={!!customer}
        perks={{ dispatch: s.shipping.dispatchDays, exchange: s.shipping.exchangeDays, cod: s.shipping.codEnabled }}
      >
        <div className="acc">
          <details open>
            <summary>About this belt</summary>
            <div className="in">{paras.map((t, i) => <p key={i}>{t}</p>)}</div>
          </details>
          <details>
            <summary>Materials and size</summary>
            <div className="in">
              <dl className="spec">
                <dt>Leather</dt><dd>{p.leather}</dd>
                <dt>Buckle</dt><dd>{p.buckle}</dd>
                <dt>Width</dt><dd>{p.width}</dd>
                <dt>Sizes</dt><dd>{p.variants.map((v) => v.size).join(", ")} (inches, to the centre hole)</dd>
                {p.category && <><dt>Collection</dt><dd>{p.category.name}</dd></>}
                <dt>SKU</dt><dd>{p.variants[0]?.sku.replace(/-\d+$/, "")}</dd>
              </dl>
            </div>
          </details>
          <details>
            <summary>Care</summary>
            <div className="in"><p>{p.care || "Wipe dry after wear and condition plain leather twice a year."}</p></div>
          </details>
          <details>
            <summary>Shipping and exchanges</summary>
            <div className="in">
              <p>Free shipping across India. Dispatched in {s.shipping.dispatchDays}, delivered in {s.shipping.deliveryDays}.</p>
              <p>Wrong size? Exchange an unworn belt within {s.shipping.exchangeDays} days. <Link href="/pages/returns">Exchange policy</Link></p>
            </div>
          </details>
        </div>
      </ProductBuy>

      <section className="block" id="size-guide" style={{ paddingTop: 40, borderTop: "1px solid var(--line)" }}>
        <div className="head"><div><div className="eyebrow mono">Size guide</div><h2 className="display h3">Find your size</h2></div>
          <p>Take the waist size of the trousers you wear it with and add two inches.</p></div>
        <SizeGuide compact />
      </section>

      <section className="reviews" id="reviews" aria-label="Reviews">
        <div className="rev-summary">
          <div className="eyebrow mono">Reviews</div>
          {p.reviews.length ? (
            <>
              <div className="big tnum">{p.rating.toFixed(1)}</div>
              <div className="stars-svg" aria-label={`${p.rating.toFixed(1)} out of 5`}>{"★".repeat(Math.round(p.rating))}{"☆".repeat(5 - Math.round(p.rating))}</div>
              <div className="muted">{p.reviews.length} {p.reviews.length === 1 ? "review" : "reviews"}</div>
              <div className="bars">{dist.map((d) => (
                <div key={d.r}><span>{d.r}★</span><i><b style={{ width: `${(d.n / p.reviews.length) * 100}%` }} /></i><span className="tnum">{d.n}</span></div>
              ))}</div>
            </>
          ) : <p className="muted">No reviews yet. Bought this belt? Tell others how it fits and wears.</p>}
          <ReviewForm productId={p.id} signedIn={!!customer} slug={p.slug} />
        </div>
        <div className="rev-list">
          {p.reviews.map((r) => (
            <article className="rev" key={r.id}>
              <div className="stars-svg" aria-label={`${r.rating} out of 5`}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
              {r.title && <h4>{r.title}</h4>}
              <p>{r.body}</p>
              <div className="who">{r.name} · {formatDate(r.createdAt)} {r.verified && <span className="verified">· Verified buyer</span>}</div>
            </article>
          ))}
        </div>
      </section>

      {related.length > 0 && (
        <section className="block" style={{ paddingTop: 0 }}>
          <div className="head"><div><div className="eyebrow mono">More from the workshop</div><h2 className="display h3">You may also like</h2></div></div>
          <div className="grid four">{related.map((r) => <ProductCard key={r.id} p={r} />)}</div>
        </section>
      )}
    </div>
  );
}
