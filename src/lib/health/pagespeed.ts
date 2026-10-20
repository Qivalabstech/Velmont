import "server-only";
import { db, healthRuns } from "@/db";
import { SITE_URL } from "@/lib/env";

type Strategy = "mobile" | "desktop";
type Audit = { numericValue?: number; displayValue?: string; score?: number | null };
type Metric = { percentile?: number; category?: string };

export function pagespeedAvailable() {
  const host = new URL(SITE_URL).hostname;
  return SITE_URL.startsWith("https://") && !/^(localhost|127\.|10\.|192\.168\.)/.test(host);
}

/** Runs Google PageSpeed Insights (Lighthouse) against the public homepage and a product page. */
export async function runPageSpeed(strategy: Strategy, path = "/", trigger = "manual") {
  if (!pagespeedAvailable()) throw new Error("PageSpeed needs the store to be live on a public https:// address. Set SITE_URL to your domain first.");
  const started = Date.now();
  const url = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  url.searchParams.set("url", SITE_URL + path);
  url.searchParams.set("strategy", strategy);
  for (const c of ["performance", "seo", "accessibility", "best-practices"]) url.searchParams.append("category", c);
  if (process.env.PAGESPEED_API_KEY) url.searchParams.set("key", process.env.PAGESPEED_API_KEY);
  const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(55_000) });
  const j = await r.json();
  if (!r.ok) throw new Error(`PageSpeed: ${j?.error?.message || r.statusText}`);
  const lh = j.lighthouseResult;
  const cat = (k: string) => Math.round((lh.categories?.[k]?.score ?? 0) * 100);
  const a = (k: string): Audit => lh.audits?.[k] ?? {};
  const field = (k: string): Metric => j.loadingExperience?.metrics?.[k] ?? {};
  const opportunities = Object.values(lh.audits as Record<string, Audit & { title: string; details?: { type?: string; overallSavingsMs?: number } }>)
    .filter((x) => x.details?.type === "opportunity" && (x.details.overallSavingsMs ?? 0) > 100)
    .sort((x, y) => (y.details!.overallSavingsMs ?? 0) - (x.details!.overallSavingsMs ?? 0)).slice(0, 6)
    .map((x) => ({ title: x.title, savingsMs: Math.round(x.details!.overallSavingsMs ?? 0) }));
  const result = {
    strategy, url: SITE_URL + path,
    scores: { performance: cat("performance"), seo: cat("seo"), accessibility: cat("accessibility"), bestPractices: cat("best-practices") },
    lab: {
      lcp: a("largest-contentful-paint").displayValue, fcp: a("first-contentful-paint").displayValue, tbt: a("total-blocking-time").displayValue,
      cls: a("cumulative-layout-shift").displayValue, si: a("speed-index").displayValue, ttfb: a("server-response-time").displayValue,
    },
    field: j.loadingExperience?.metrics ? {
      lcp: field("LARGEST_CONTENTFUL_PAINT_MS"), inp: field("INTERACTION_TO_NEXT_PAINT"), cls: field("CUMULATIVE_LAYOUT_SHIFT_SCORE"),
      overall: j.loadingExperience.overall_category,
    } : null,
    opportunities,
  };
  await db.insert(healthRuns).values({ kind: `pagespeed-${strategy}`, trigger, score: result.scores.performance, result, durationMs: Date.now() - started });
  return result;
}
