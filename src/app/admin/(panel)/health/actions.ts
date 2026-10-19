"use server";
import { run, type ActionState } from "@/lib/admin-action";
import { runSiteAudit } from "@/lib/health/audit";
import { runPageSpeed } from "@/lib/health/pagespeed";
import { recordUptime } from "@/lib/health/live";
import { str } from "@/lib/utils";

export async function runAudit(_: ActionState) {
  return run("health.view", async (me) => {
    const r = await runSiteAudit(`manual · ${me.name}`);
    return { ok: `Audit finished. SEO ${r.seo.score}, answer engines ${r.aeo.score}, AI search ${r.geo.score}.`, revalidate: ["/admin/health"] };
  });
}

export async function runSpeed(_: ActionState, fd: FormData) {
  return run("health.view", async (me) => {
    const strategy = str(fd, "strategy") === "desktop" ? "desktop" : "mobile";
    const r = await runPageSpeed(strategy, "/", `manual · ${me.name}`);
    return { ok: `PageSpeed ${strategy}: performance ${r.scores.performance}/100.`, revalidate: ["/admin/health"] };
  });
}

export async function pingNow(_: ActionState) {
  return run("health.view", async () => {
    const r = await recordUptime("manual");
    return r.ok ? { ok: `Store is up. Homepage answered in ${r.latency} ms, database in ${r.dbMs} ms.` } : { error: "The homepage did not respond correctly. Check the Errors tab in Activity log." };
  });
}
