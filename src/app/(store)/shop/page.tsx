import type { Metadata } from "next";
import Link from "next/link";
import { listProducts, listCategories } from "@/lib/catalog";
import { ProductCard } from "@/components/store/ProductCard";
import { JsonLd } from "@/components/store/JsonLd";
import { breadcrumbLd } from "@/lib/seo";
import { SortSelect } from "./SortSelect";

type SP = Promise<{ category?: string; tag?: string; q?: string; sort?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  return {
    title: sp.q ? `Search: ${sp.q}` : "Shop hand-tooled leather belts",
    description: "Browse VELMONT hand-tooled, painted and beaded full-grain leather belts. Sizes 30 to 40, free shipping across India.",
    alternates: { canonical: "/shop" },
    robots: sp.q ? { index: false } : undefined,
  };
}

const TAGS = [{ v: "beaded", l: "Beaded" }, { v: "painted", l: "Hand-painted" }, { v: "dark", l: "Dark leather" }];

export default async function Shop({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [products, cats] = await Promise.all([
    listProducts({ category: sp.category, tag: sp.tag, q: sp.q, sort: sp.sort }), listCategories(),
  ]);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { category: sp.category, tag: sp.tag, q: sp.q, sort: sp.sort, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return s ? `/shop?${s}` : "/shop";
  };
  const allOn = !sp.category && !sp.tag;
  return (
    <div className="wrap">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Shop", path: "/shop" }])} />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden>/</span><span>Shop</span></nav>
      <header className="page-head">
        <div className="eyebrow mono">{sp.q ? "Search results" : "The collection"}</div>
        <h1 className="display">{sp.q ? `“${sp.q}”` : "All belts"}</h1>
        <p>{products.length} {products.length === 1 ? "belt" : "belts"}. Every one cut, carved and finished by hand in full-grain cowhide.</p>
      </header>
      <div className="shop-tools">
        <div className="filters" role="group" aria-label="Filter belts">
          <Link className="chip" href={qs({ category: undefined, tag: undefined })} aria-current={allOn ? "true" : undefined}>All</Link>
          {cats.map((c) => (
            <Link key={c.id} className="chip" href={qs({ category: c.slug, tag: undefined })} aria-current={sp.category === c.slug ? "true" : undefined}>{c.name}</Link>
          ))}
          {TAGS.map((t) => (
            <Link key={t.v} className="chip" href={qs({ tag: t.v, category: undefined })} aria-current={sp.tag === t.v ? "true" : undefined}>{t.l}</Link>
          ))}
        </div>
        <SortSelect value={sp.sort || ""} />
      </div>
      {products.length ? (
        <div className="grid four">{products.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 2} />)}</div>
      ) : (
        <div className="empty-state">
          <span>No belts match {sp.q ? `“${sp.q}”` : "this filter"}.</span>
          <Link className="btn" href="/shop">See all belts</Link>
        </div>
      )}
      <div style={{ height: 80 }} />
    </div>
  );
}
