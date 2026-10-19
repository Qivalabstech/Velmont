"use server";
import { eq } from "drizzle-orm";
import { db, categories } from "@/db";
import { run, type ActionState } from "@/lib/admin-action";
import { str, num, slugify } from "@/lib/utils";

export async function saveCategory(_: ActionState, fd: FormData) {
  return run("products.manage", async () => {
    const id = str(fd, "id"), name = str(fd, "name");
    if (name.length < 2) return { error: "Enter a category name." };
    const data = { name, slug: slugify(str(fd, "slug") || name), description: str(fd, "description"), sortOrder: num(fd, "sortOrder") };
    const clash = await db.query.categories.findFirst({ where: eq(categories.slug, data.slug) });
    if (clash && clash.id !== id) return { error: `The address “${data.slug}” is already used.` };
    if (id) await db.update(categories).set(data).where(eq(categories.id, id));
    else await db.insert(categories).values(data);
    return { ok: id ? "Category saved." : "Category added.", log: { action: id ? "update" : "create", entity: "category", id: id || null, summary: name }, revalidate: ["/shop"] };
  });
}

export async function deleteCategory(_: ActionState, fd: FormData) {
  return run("products.manage", async () => {
    const [c] = await db.delete(categories).where(eq(categories.id, str(fd, "id"))).returning();
    return { ok: "Category deleted. Its products are now uncategorised.", log: { action: "delete", entity: "category", id: c?.id, summary: c?.name || "" }, revalidate: ["/shop"] };
  });
}
