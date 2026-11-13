import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }, // payment pop-ups still work
  // Narrow CSP that cannot break payment scripts: no framing by other sites, no <base> or plugin injection.
  { key: "Content-Security-Policy", value: `frame-ancestors 'self'; base-uri 'self'; object-src 'none'${process.env.VERCEL ? "; upgrade-insecure-requests" : ""}` },
  ...(process.env.VERCEL ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const config: NextConfig = {
  // Standalone output is for Docker / VPS. Vercel builds its own way.
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["pg", "nodemailer", "sharp"],
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2592000, // optimized photos stay cached at the edge for 30 days (product photos rarely change)
    localPatterns: [{ pathname: "/img/**" }, { pathname: "/media/**" }],
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  // inlineCss: styles ship inside the HTML, so the first paint does not wait for separate CSS files.
  experimental: { serverActions: { bodySizeLimit: "12mb" }, inlineCss: true },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "no-store" }] },
      { source: "/account/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/img/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};
export default config;
