import type { Metadata } from "next";
import { SizeGuide } from "@/components/store/SizeGuide";
import { JsonLd } from "@/components/store/JsonLd";
import { faqLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Belt size guide",
  description: "How to choose your belt size: add 2 inches to your trouser waist. Size chart for VELMONT belts 30 to 40 with centre-hole and length in inches and cm.",
  alternates: { canonical: "/size-guide" },
};

export default function SizeGuidePage() {
  return (
    <div className="wrap" style={{ paddingBottom: 80 }}>
      <JsonLd data={faqLd([
        { question: "What size belt should I buy?", answer: "Add 2 inches to your trouser waist size. A 32 inch waist needs a size 34 belt." },
        { question: "How is VELMONT belt size measured?", answer: "From the fold of the buckle to the centre hole, in inches. Each belt has five holes, one inch apart." },
      ])} />
      <header className="page-head"><div className="eyebrow mono">Size guide</div><h1 className="display">Belt size is not your waist size</h1>
        <p>Belts are sized to the centre hole. Take the waist size of the trousers you will wear the belt with and add two inches. A 32 inch waist needs a size 34 belt.</p></header>
      <SizeGuide />
      <div className="prose" style={{ marginTop: 40 }}>
        <h2>How we measure</h2>
        <p>The size is the distance in inches from the fold where the buckle attaches to the centre of five holes. Holes are one inch apart, so each belt fits two inches either side of its size.</p>
        <h2>Between sizes?</h2>
        <p>Choose the larger size. Leather settles a little with wear and the tip can always go through the keeper.</p>
      </div>
    </div>
  );
}
