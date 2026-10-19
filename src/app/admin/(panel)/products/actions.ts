"use server";
import { redirect } from "next/navigation";
import { and, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { db, products, productImages, variants, orderItems } from "@/db";
import { run, type ActionState } from "@/lib/admin-action";
import { saveImage, deleteImage } from "@/lib/uploads";
import { str, num, bool, slugify } from "@/lib/utils";
import { toPaise } from "@/lib/money";
import { audit } from "@/lib/audit";
import { assertStaff } from "@/lib/auth";

type Img = { id?: string; url: string; alt: string };
type Var = { id?: string; size: string; sku: string; stock: number; active: boolean };

export async function saveProduct(_: ActionState, fd: FormData): Promise<ActionState> {
  let createdId: string | null = null;
  const res = await run("products.manage", async (me) => {
    const id = str(fd, "id");
    const name = str(fd, "name");
    if (name.length < 2) return { error: "Give the product a name." };
    const slug = slugify(str(fd, "slug") || name);
    const clash = await db.query.products.findFirst({ where: and(eq(products.slug, slug), id ? ne(products.id, id) : undefined) });
    if (clash) return { error: `The web address “${slug}” is already used by ${clash.name}.` };
    const price = toPaise(num(fd, "price")), mrp = toPaise(num(fd, "mrp") || num(fd, "price"));
    if (price <= 0) return { error: "Enter a selling price." };
    if (mrp < price) return { error: "MRP cannot be lower than the selling price." };
    const imgs: Img[] = JSON.parse(str(fd, "imagesJson") || "[]");
    const vars: Var[] = JSON.parse(str(fd, "variantsJson") || "[]");
    if (!vars.length) return { error: "Add at least one size." };
    const sizes = new Set<string>();
    for (const v of vars) {
      v.size = v.size.trim(); v.sku = v.sku.trim().toUpperCase();
      if (!v.size || !v.sku) return { error: "Every size needs a size label and a SKU." };
      if (sizes.has(v.size)) return { error: `Size ${v.size} is listed twice.` };
      sizes.add(v.size);
      if (!Number.isInteger(Number(v.stock)) || Number(v.stock) < 0) return { error: `Stock for size ${v.size} must be a whole number.` };
    }
    const skuClash = await db.select({ sku: variants.sku }).from(variants).where(and(inArray(variants.sku, vars.map((v) => v.sku)), id ? ne(variants.productId, id) : undefined));
    if (skuClash.length) return { error: `SKU ${skuClash[0].sku} is already used by another product.` };

    // Upload new photos first so a failed upload does not leave half-saved data.
    const files = fd.getAll("newImages").filter((f): f is File => f instanceof File && f.size > 0);
    const uploaded: string[] = [];
    for (const f of files) uploaded.push(await saveImage(f));
    const newAlts: string[] = JSON.parse(str(fd, "newAltsJson") || "[]");

    const data = {
      name, slug, tagline: str(fd, "tagline"), description: str(fd, "description"), price, mrp,
      status: (["DRAFT", "ACTIVE", "ARCHIVED"].includes(str(fd, "status")) ? str(fd, "status") : "DRAFT") as "DRAFT" | "ACTIVE" | "ARCHIVED",
      featured: bool(fd, "featured"), badge: str(fd, "badge") || null, categoryId: str(fd, "categoryId") || null,
      leather: str(fd, "leather"), buckle: str(fd, "buckle"), width: str(fd, "width"), care: str(fd, "care"),
      colors: str(fd, "colors").split(",").map((c) => c.trim()).filter((c) => /^#[0-9a-f]{3,8}$/i.test(c)).slice(0, 6),
      tags: str(fd, "tags").split(",").map((t) => slugify(t)).filter(Boolean).slice(0, 12),
      hsn: str(fd, "hsn") || "4203", gstRate: str(fd, "gstRate") ? num(fd, "gstRate") : null,
      seoTitle: str(fd, "seoTitle"), seoDescription: str(fd, "seoDescription"), sortOrder: num(fd, "sortOrder"),
    };

    const removedUrls: string[] = [];
    const pid = await db.transaction(async (tx) => {
      let pid = id;
      if (id) await tx.update(products).set(data).where(eq(products.id, id));
      else pid = (await tx.insert(products).values(data).returning({ id: products.id }))[0].id;

      const keepIds = imgs.filter((i) => i.id).map((i) => i.id!);
      const old = await tx.select().from(productImages).where(eq(productImages.productId, pid));
      for (const o of old) if (!keepIds.includes(o.id)) removedUrls.push(o.url);
      await tx.delete(productImages).where(keepIds.length ? and(eq(productImages.productId, pid), notInArray(productImages.id, keepIds)) : eq(productImages.productId, pid));
      let order = 0;
      for (const i of imgs) if (i.id) await tx.update(productImages).set({ alt: i.alt, sortOrder: order++ }).where(eq(productImages.id, i.id));
      if (uploaded.length) await tx.insert(productImages).values(uploaded.map((url, j) => ({ productId: pid, url, alt: newAlts[j] || name, sortOrder: order + j })));

      const keepVar = vars.filter((v) => v.id).map((v) => v.id!);
      await tx.delete(variants).where(keepVar.length ? and(eq(variants.productId, pid), notInArray(variants.id, keepVar)) : eq(variants.productId, pid));
      for (const v of vars) {
        const row = { size: v.size, sku: v.sku, stock: Number(v.stock), active: !!v.active };
        if (v.id) await tx.update(variants).set(row).where(eq(variants.id, v.id));
        else await tx.insert(variants).values({ ...row, productId: pid });
      }
      return pid;
    });
    for (const u of removedUrls) await deleteImage(u);
    if (!id) createdId = pid;
    return { ok: id ? "Product saved." : "Product created.", log: { action: id ? "update" : "create", entity: "product", id: pid, summary: `${id ? "Edited" : "Added"} ${name} (${data.status.toLowerCase()})` }, revalidate: ["/", "/shop", `/products/${slug}`, "/admin/products"] };
  });
  if (createdId) redirect(`/admin/products/${createdId}?created=1`);
  return res;
}

export async function deleteProduct(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await assertStaff("products.manage");
  const id = str(fd, "id");
  const p = await db.query.products.findFirst({ where: eq(products.id, id), with: { images: true } });
  if (!p) return { error: "Product not found." };
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(orderItems).where(eq(orderItems.productId, id));
  if (n > 0) {
    await db.update(products).set({ status: "ARCHIVED" }).where(eq(products.id, id));
    await audit({ id: me.id, name: me.name }, "archive", "product", id, `Archived ${p.name} (has ${n} order lines)`);
    return { ok: `${p.name} has past orders, so it was archived instead of deleted. It is hidden from the store.` };
  }
  await db.delete(products).where(eq(products.id, id));
  for (const i of p.images) await deleteImage(i.url);
  await audit({ id: me.id, name: me.name }, "delete", "product", id, `Deleted ${p.name}`);
  redirect("/admin/products");
}

export async function duplicateProduct(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await assertStaff("products.manage");
  const p = await db.query.products.findFirst({ where: eq(products.id, str(fd, "id")), with: { images: true, variants: true } });
  if (!p) return { error: "Product not found." };
  const suffix = Date.now().toString(36).slice(-4);
  const { id: _i, createdAt: _c, updatedAt: _u, images, variants: vs, ...rest } = p;
  const [copy] = await db.insert(products).values({ ...rest, name: `${p.name} (copy)`, slug: `${p.slug}-${suffix}`, status: "DRAFT" }).returning();
  if (images.length) await db.insert(productImages).values(images.map((i) => ({ productId: copy.id, url: i.url, alt: i.alt, sortOrder: i.sortOrder })));
  if (vs.length) await db.insert(variants).values(vs.map((v) => ({ productId: copy.id, size: v.size, sku: `${v.sku}-${suffix.toUpperCase()}`, stock: 0, active: v.active })));
  await audit({ id: me.id, name: me.name }, "duplicate", "product", copy.id, `Duplicated ${p.name}`);
  redirect(`/admin/products/${copy.id}`);
}

export async function quickStatus(_: ActionState, fd: FormData) {
  return run("products.manage", async () => {
    const ids = fd.getAll("ids").map(String);
    const status = str(fd, "status") as "ACTIVE" | "DRAFT" | "ARCHIVED";
    if (!ids.length) return { error: "Tick at least one product." };
    await db.update(products).set({ status }).where(inArray(products.id, ids));
    return { ok: `${ids.length} product(s) set to ${status.toLowerCase()}.`, log: { action: "bulk_status", entity: "product", summary: `${ids.length} products → ${status}` }, revalidate: ["/", "/shop"] };
  });
}

export async function saveProductSeo(_: ActionState, fd: FormData) {
  return run("seo.manage", async () => {
    const id = str(fd, "id");
    const slug = slugify(str(fd, "slug"));
    if (!slug) return { error: "The web address cannot be empty." };
    const clash = await db.query.products.findFirst({ where: and(eq(products.slug, slug), ne(products.id, id)) });
    if (clash) return { error: `“${slug}” is already used by ${clash.name}.` };
    const imgs: Img[] = JSON.parse(str(fd, "imagesJson") || "[]");
    const [p] = await db.update(products).set({ slug, seoTitle: str(fd, "seoTitle"), seoDescription: str(fd, "seoDescription") }).where(eq(products.id, id)).returning();
    for (const i of imgs) if (i.id) await db.update(productImages).set({ alt: i.alt }).where(eq(productImages.id, i.id));
    return { ok: "SEO details saved.", log: { action: "seo", entity: "product", id, summary: `SEO updated for ${p.name}` }, revalidate: [`/products/${slug}`] };
  });
}
