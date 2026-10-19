import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot"];
const PRIVATE = ["/admin", "/account", "/cart", "/checkout", "/order", "/api"];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const s = await getSettings();
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      ...AI_CRAWLERS.map((ua) => (s.seo.allowAiCrawlers ? { userAgent: ua, allow: "/", disallow: PRIVATE } : { userAgent: ua, disallow: "/" })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
