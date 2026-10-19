import type { Metadata } from "next";
import Link from "next/link";
import { listFaqs } from "@/lib/catalog";
import { JsonLd } from "@/components/store/JsonLd";
import { faqLd, breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: "Answers about belt sizing, leather, delivery, exchanges, cash on delivery and care for VELMONT belts.",
  alternates: { canonical: "/faq" },
};

export default async function Faq() {
  const faqs = await listFaqs();
  return (
    <div className="wrap narrow" style={{ paddingBottom: 80 }}>
      <JsonLd data={[faqLd(faqs), breadcrumbLd([{ name: "Home", path: "/" }, { name: "FAQ", path: "/faq" }])]} />
      <header className="page-head"><div className="eyebrow mono">Help</div><h1 className="display">Questions, answered</h1></header>
      <div className="faq-list">
        {faqs.map((f, i) => (
          <details key={f.id} open={i === 0}><summary><h2 style={{ font: "inherit", margin: 0 }}>{f.question}</h2></summary><div className="ans">{f.answer}</div></details>
        ))}
      </div>
      <p style={{ marginTop: 24 }}>Still stuck? <Link href="/contact">Send us a message</Link>.</p>
    </div>
  );
}
