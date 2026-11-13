"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/store/ProductCard";
import type { ShopProduct } from "@/lib/catalog";

type SP = { category?: string; tag?: string; q?: string; sort?: string };
type Cat = { slug: string; name: string };
const TAGS = [{ v: "beaded", l: "Beaded" }, { v: "painted", l: "Hand-painted" }, { v: "dark", l: "Dark leather" }];

export function ShopWithParams({ products, categories }: { products: ShopProduct[]; categories: Cat[] }) {
  const s = useSearchParams();
  const sp: SP = { category: s.get("category") || undefined, tag: s.get("tag") || undefined, q: s.get("q") || undefined, sort: s.get("sort") || undefined };
  return <ShopGrid products={products} categories={categories} sp={sp} />;
}

export function ShopGrid({ products, categories, sp }: { products: ShopProduct[]; categories: Cat[]; sp: SP }) {
  const router = useRouter();
  const list = useMemo(() => {
    const words = (sp.q || "").toLowerCase().split(/\s+/).filter(Boolean);
    const out = products.filter((p) =>
      (!sp.category || p.categorySlug === sp.category) &&
      (!sp.tag || p.tags.includes(sp.tag)) &&
      words.every((w) => p.search.includes(w)));
    if (sp.sort === "price-asc") out.sort((a, b) => a.price - b.price);
    else if (sp.sort === "price-desc") out.sort((a, b) => b.price - a.price);
    else if (sp.sort === "new") out.sort((a, b) => b.createdAt - a.createdAt);
    return out;
  }, [products, sp.category, sp.tag, sp.q, sp.sort]);
  const qs = (patch: SP) => {
    const p = new URLSearchParams();
    Object.entries({ ...sp, ...patch }).forEach(([k, v]) => v && p.set(k, v));
    const str = p.toString();
    return str ? `/shop?${str}` : "/shop";
  };
  const allOn = !sp.category && !sp.tag;
  return (
    <>
      <header className="page-head">
        <div className="eyebrow mono">{sp.q ? "Search results" : "The collection"}</div>
        <h1 className="display">{sp.q ? `“${sp.q}”` : "All belts"}</h1>
        <p>{list.length} {list.length === 1 ? "belt" : "belts"}. Every one cut, carved and finished by hand in full-grain cowhide.</p>
      </header>
      <div className="shop-tools">
        <div className="filters" role="group" aria-label="Filter belts">
          <Link className="chip" href={qs({ category: undefined, tag: undefined })} scroll={false} aria-current={allOn ? "true" : undefined}>All</Link>
          {categories.map((c) => (
            <Link key={c.slug} className="chip" href={qs({ category: c.slug, tag: undefined })} scroll={false} aria-current={sp.category === c.slug ? "true" : undefined}>{c.name}</Link>
          ))}
          {TAGS.map((t) => (
            <Link key={t.v} className="chip" href={qs({ tag: t.v, category: undefined })} scroll={false} aria-current={sp.tag === t.v ? "true" : undefined}>{t.l}</Link>
          ))}
        </div>
        <div>
          <label htmlFor="sort" className="sr-only">Sort by</label>
          <select id="sort" className="select" value={sp.sort || ""} onChange={(e) => router.push(qs({ sort: e.target.value || undefined }), { scroll: false })}>
            <option value="">Sort: Featured</option>
            <option value="new">Newest</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </div>
      </div>
      {list.length ? (
        <div className="grid four">{list.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 2} />)}</div>
      ) : (
        <div className="empty-state">
          <span>No belts match {sp.q ? `“${sp.q}”` : "this filter"}.</span>
          <Link className="btn" href="/shop">See all belts</Link>
        </div>
      )}
    </>
  );
}
