"use server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, pages, faqs } from "@/db";
import { run, type ActionState } from "@/lib/admin-action";
import { saveSetting } from "@/lib/settings";
import { str, num, bool, slugify } from "@/lib/utils";

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export async function saveHomepage(_: ActionState, fd: FormData) {
  return run("content.manage", async () => {
    await saveSetting("content", {
      heroEyebrow: str(fd, "heroEyebrow"), heroLines: lines(str(fd, "heroLines")).slice(0, 4), heroText: str(fd, "heroText"),
      announcements: lines(str(fd, "announcements")).slice(0, 8),
      bandRowOne: str(fd, "bandRowOne").split(",").map((x) => x.trim()).filter(Boolean),
      bandRowTwo: str(fd, "bandRowTwo").split(",").map((x) => x.trim()).filter(Boolean),
      collectionTitle: str(fd, "collectionTitle"), collectionText: str(fd, "collectionText"),
    });
    return { ok: "Homepage updated.", log: { action: "update", entity: "content", summary: "Homepage text" }, revalidate: ["/"] };
  });
}

export async function savePage(_: ActionState, fd: FormData) {
  const r = await run("content.manage", async () => {
    const id = str(fd, "id"), title = str(fd, "title");
    if (!title) return { error: "Give the page a title." };
    const slug = slugify(str(fd, "slug") || title);
    const clash = await db.query.pages.findFirst({ where: eq(pages.slug, slug) });
    if (clash && clash.id !== id) return { error: `/pages/${slug} already exists.` };
    const data = { title, slug, body: str(fd, "body"), seoTitle: str(fd, "seoTitle"), seoDescription: str(fd, "seoDescription"), published: bool(fd, "published") };
    if (id) await db.update(pages).set(data).where(eq(pages.id, id)); else await db.insert(pages).values(data);
    return { ok: "Page saved.", log: { action: id ? "update" : "create", entity: "page", id: id || null, summary: `/pages/${slug}` }, revalidate: [`/pages/${slug}`] };
  });
  if (r?.ok && !str(fd, "id")) redirect("/admin/content?tab=pages");
  return r;
}

export async function deletePage(_: ActionState, fd: FormData) {
  return run("content.manage", async () => {
    const [p] = await db.delete(pages).where(eq(pages.id, str(fd, "id"))).returning();
    return { ok: "Page deleted.", log: { action: "delete", entity: "page", id: p?.id, summary: `/pages/${p?.slug}` } };
  });
}

export async function saveFaq(_: ActionState, fd: FormData) {
  return run("content.manage", async () => {
    const id = str(fd, "id");
    const data = { question: str(fd, "question"), answer: str(fd, "answer"), sortOrder: num(fd, "sortOrder"), published: bool(fd, "published") };
    if (data.question.length < 5 || data.answer.length < 5) return { error: "Write both a question and an answer." };
    if (id) await db.update(faqs).set(data).where(eq(faqs.id, id)); else await db.insert(faqs).values(data);
    return { ok: "Question saved.", log: { action: id ? "update" : "create", entity: "faq", id: id || null, summary: data.question.slice(0, 120) }, revalidate: ["/faq", "/"] };
  });
}

export async function deleteFaq(_: ActionState, fd: FormData) {
  return run("content.manage", async () => {
    await db.delete(faqs).where(eq(faqs.id, str(fd, "id")));
    return { ok: "Question deleted.", log: { action: "delete", entity: "faq", summary: "FAQ removed" }, revalidate: ["/faq"] };
  });
}
