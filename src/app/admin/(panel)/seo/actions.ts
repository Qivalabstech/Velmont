"use server";
import { eq } from "drizzle-orm";
import { db, redirects } from "@/db";
import { run, type ActionState } from "@/lib/admin-action";
import { saveSetting } from "@/lib/settings";
import { str, bool } from "@/lib/utils";

export async function saveSeo(_: ActionState, fd: FormData) {
  return run("seo.manage", async () => {
    const tpl = str(fd, "titleTemplate");
    if (!tpl.includes("%s")) return { error: "The title template must contain %s where the page name goes." };
    await saveSetting("seo", {
      titleTemplate: tpl, defaultTitle: str(fd, "defaultTitle"), defaultDescription: str(fd, "defaultDescription"),
      ogImage: str(fd, "ogImage") || "/img/solana-ring.webp", googleVerification: str(fd, "googleVerification"),
      sameAs: str(fd, "sameAs").split("\n").map((x) => x.trim()).filter((x) => /^https?:\/\//.test(x)),
      allowAiCrawlers: bool(fd, "allowAiCrawlers"), llmsIntro: str(fd, "llmsIntro"),
    });
    return { ok: "SEO settings saved.", log: { action: "update", entity: "seo", summary: "Site-wide SEO settings" }, revalidate: ["/"] };
  });
}

export async function addRedirect(_: ActionState, fd: FormData) {
  return run("seo.manage", async () => {
    const from = "/" + str(fd, "from").replace(/^https?:\/\/[^/]+/, "").replace(/^\/+/, "").replace(/\/$/, "");
    const to = str(fd, "to");
    if (from === "/" || from.startsWith("/admin") || from.startsWith("/api")) return { error: "Choose an old path like /old-belt-name." };
    if (!to) return { error: "Enter where it should go." };
    if (from === to) return { error: "A page cannot redirect to itself." };
    await db.insert(redirects).values({ from, to, permanent: bool(fd, "permanent") }).onConflictDoUpdate({ target: redirects.from, set: { to, permanent: bool(fd, "permanent") } });
    return { ok: `${from} now redirects to ${to}. Allow up to a minute to take effect.`, log: { action: "create", entity: "redirect", summary: `${from} → ${to}` } };
  });
}

export async function deleteRedirect(_: ActionState, fd: FormData) {
  return run("seo.manage", async () => {
    const [r] = await db.delete(redirects).where(eq(redirects.id, str(fd, "id"))).returning();
    return { ok: "Redirect removed.", log: { action: "delete", entity: "redirect", summary: `${r?.from} → ${r?.to}` } };
  });
}
