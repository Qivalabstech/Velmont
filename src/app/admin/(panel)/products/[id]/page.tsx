import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, products, productImages, variants } from "@/db";
import { requireStaff } from "@/lib/auth";
import { listCategories } from "@/lib/catalog";
import { PageHead } from "@/components/admin/ui";
import { ProductForm } from "../ProductForm";
import { ProductDanger } from "../ProductDanger";

export const metadata = { title: "Edit product" };

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const me = await requireStaff("products.view");
  const p = await db.query.products.findFirst({
    where: eq(products.id, (await params).id),
    with: { images: { orderBy: [asc(productImages.sortOrder)] }, variants: { orderBy: [asc(variants.size)] } },
  });
  if (!p) notFound();
  const created = (await searchParams).created;
  return (
    <div>
      <PageHead title={p.name} back={{ href: "/admin/products", label: "Products" }}
        sub={created ? "Product created. Set it to Active when it is ready to sell." : undefined}
        actions={p.status === "ACTIVE" && <Link className="btn sm" href={`/products/${p.slug}`} target="_blank">View in store ↗</Link>} />
      <ProductForm
        readOnly={!me.perms.has("products.manage")} seoOnly={!me.perms.has("products.manage") && me.perms.has("seo.manage")}
        categories={(await listCategories()).map((c) => ({ id: c.id, name: c.name }))}
        p={{ ...p, images: p.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt })), variants: p.variants.map((v) => ({ id: v.id, size: v.size, sku: v.sku, stock: v.stock, active: v.active })) }}
      />
      {me.perms.has("products.manage") && <ProductDanger id={p.id} />}
    </div>
  );
}
