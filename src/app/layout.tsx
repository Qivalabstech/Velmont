import type { Metadata, Viewport } from "next";
import "@fontsource/big-shoulders-display/latin-700.css";
import "@fontsource/big-shoulders-display/latin-800.css";
import "@fontsource/big-shoulders-display/latin-900.css";
import "@fontsource/hanken-grotesk/latin-400.css";
import "@fontsource/hanken-grotesk/latin-500.css";
import "@fontsource/hanken-grotesk/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@/styles/base.css";
import { SITE_URL } from "@/lib/env";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: s.seo.defaultTitle, template: s.seo.titleTemplate },
    description: s.seo.defaultDescription,
    openGraph: { siteName: s.store.name, type: "website", locale: "en_IN", images: [s.seo.ogImage] },
    twitter: { card: "summary_large_image" },
    verification: s.seo.googleVerification ? { google: s.seo.googleVerification } : undefined,
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = { themeColor: "#1C1714", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
