import { NextResponse, type NextRequest } from "next/server";

type R = { from: string; to: string; permanent: boolean };
let cache: { at: number; rows: R[] } = { at: 0, rows: [] };

async function getRedirects(): Promise<R[]> {
  if (Date.now() - cache.at < 60_000) return cache.rows;
  try {
    const base = process.env.INTERNAL_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
    const r = await fetch(`${base}/api/redirects`, { cache: "no-store" });
    if (r.ok) cache = { at: Date.now(), rows: await r.json() };
  } catch {
    cache.at = Date.now();
  }
  return cache.rows;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Admin area: bounce to sign-in early when there is no admin session cookie. Pages re-check the session.
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login") && !pathname.startsWith("/admin/reset") && !pathname.startsWith("/admin/forgot")) {
    if (!req.cookies.get("vm_a")) return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  if (!pathname.startsWith("/admin")) {
    const rows = await getRedirects();
    const hit = rows.find((r) => r.from === pathname || r.from === pathname.replace(/\/$/, ""));
    if (hit) {
      const to = hit.to.startsWith("http") ? hit.to : new URL(hit.to, req.url).toString();
      return NextResponse.redirect(to, hit.permanent ? 301 : 302);
    }
  }
  const res = NextResponse.next();
  if (pathname.startsWith("/admin")) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/((?!_next/|api/|media/|img/|icon.svg|favicon.ico|robots.txt|sitemap.xml|llms.txt).*)"],
};
