import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, pages } from "@/db";
import { Markdown, plainText } from "@/components/store/Markdown";
import { JsonLd } from "@/components/store/JsonLd";
import { breadcrumbLd } from "@/lib/seo";
import { formatDate } from "@/lib/utils";

const get = (slug: string) => db.query.pages.findFirst({ where: and(eq(pages.slug, slug), eq(pages.published, true)) });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await get((await params).slug);
  if (!p) return {};
  return { title: p.seoTitle || p.title, description: p.seoDescription || plainText(p.body).slice(0, 155), alternates: { canonical: `/pages/${p.slug}` } };
}

export default async function InfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await get((await params).slug);
  if (!p) notFound();
  return (
    <div className="wrap narrow" style={{ paddingBottom: 80 }}>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: p.title, path: `/pages/${p.slug}` }])} />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden>/</span><span>{p.title}</span></nav>
      <header className="page-head"><h1 className="display">{p.title}</h1><p className="mono">Updated {formatDate(p.updatedAt)}</p></header>
      <Markdown source={p.body} />
    </div>
  );
}
