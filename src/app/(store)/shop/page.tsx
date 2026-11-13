import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { listShopProducts, listCategories } from "@/lib/catalog";
import { JsonLd } from "@/components/store/JsonLd";
import { breadcrumbLd } from "@/lib/seo";
import { ShopGrid, ShopWithParams } from "./ShopView";

export const metadata: Metadata = {
  title: "Shop hand-tooled leather belts",
  description: "Browse VELMONT hand-tooled, painted and beaded full-grain leather belts. Sizes 30 to 40, free shipping across India.",
  alternates: { canonical: "/shop" },
};

// Served from the cache; filters, sorting and search run in the browser, so every tap is instant.
export const revalidate = 60;

export default async function Shop() {
  const [products, cats] = await Promise.all([listShopProducts(), listCategories()]);
  const categories = cats.map((c) => ({ slug: c.slug, name: c.name }));
  return (
    <div className="wrap">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Shop", path: "/shop" }])} />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden>/</span><span>Shop</span></nav>
      <Suspense fallback={<ShopGrid products={products} categories={categories} sp={{}} />}>
        <ShopWithParams products={products} categories={categories} />
      </Suspense>
      <div style={{ height: 80 }} />
    </div>
  );
}
