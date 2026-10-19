import Link from "next/link";
import Image from "next/image";
import { getSettings } from "@/lib/settings";
import { listProducts, listFaqs } from "@/lib/catalog";
import { ProductCard } from "@/components/store/ProductCard";
import { HeroCarousel } from "@/components/store/HeroCarousel";
import { Band } from "@/components/store/Band";
import { SizeGuide } from "@/components/store/SizeGuide";
import { JsonLd } from "@/components/store/JsonLd";
import { organizationLd, websiteLd, faqLd } from "@/lib/seo";

export const metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const [s, products, faqs] = await Promise.all([getSettings(), listProducts(), listFaqs()]);
  const featured = products.filter((p) => p.images[0]).slice(0, 5);
  const c = s.content;
  const name = s.store.name;
  return (
    <>
      <JsonLd data={[await organizationLd(), await websiteLd(), faqLd(faqs.slice(0, 6))]} />
      <section className="hero">
        <div className="wrap">
          <div className="intro">
            <div className="eyebrow mono">{c.heroEyebrow}</div>
            <h1>{c.heroLines.map((l, i) => <span className="ln" key={i}><span>{l}</span></span>)}</h1>
          </div>
          <HeroCarousel storeName={name} slides={featured.map((p) => ({
            name: p.name, slug: p.slug, price: p.price, mrp: p.mrp, image: p.images[0].url, alt: p.images[0].alt,
          }))} />
          <div className="rest">
            <p className="lede">{c.heroText}</p>
            <div className="ctas">
              <Link className="btn solid" href="/shop">Shop the collection <span className="arr">→</span></Link>
              <Link className="btn" href="/size-guide">Find your size</Link>
            </div>
            <div className="specs mono"><span>Full-grain cowhide</span><span>1.5 in width</span><span>Sizes 30–40</span></div>
          </div>
        </div>
        <div className="giant" aria-hidden="true">{[...name].map((ch, i) => <span key={i} style={{ animationDelay: `${i * 0.08}s` }}>{ch}</span>)}</div>
      </section>

      <Band rowOne={c.bandRowOne} rowTwo={c.bandRowTwo} image="/img/solana-detail.webp" caption="The Solana · detail" />

      <section className="block" id="shop">
        <div className="wrap">
          <div className="head lift">
            <div>
              <div className="eyebrow mono">The collection</div>
              <h2 className="display h2">{c.collectionTitle}</h2>
            </div>
            <p>{c.collectionText}</p>
          </div>
          <div className="grid four">
            {products.slice(0, 8).map((p, i) => <ProductCard key={p.id} p={p} priority={i < 2} />)}
          </div>
          <div style={{ marginTop: 28, display: "flex", justifyContent: "center" }}>
            <Link className="btn" href="/shop">See all belts <span className="arr">→</span></Link>
          </div>
        </div>
      </section>

      <section className="block craft" id="craft">
        <div className="wrap cols">
          <figure className="lift">
            <Image src="/img/azure-detail.webp" alt="Close-up of The Azure belt showing carved leaves over a turquoise ground" fill sizes="(max-width:860px) 90vw, 45vw" />
            <figcaption className="mono">The Azure · carving detail</figcaption>
          </figure>
          <div className="lift">
            <div className="eyebrow mono">The craft</div>
            <h2 className="display h2" style={{ marginTop: 10 }}>Three passes<br />by hand</h2>
            <ol className="steps">
              <li><span className="n">1</span><div><h3>Carving</h3><p>The pattern is traced onto dampened full-grain hide, then cut with a swivel knife and pressed with stamping tools to raise the leaves and scrolls.</p></div></li>
              <li><span className="n">2</span><div><h3>Painting and beading</h3><p>Backgrounds are hand-painted, and the beadwork panel is strung bead by bead and set into the belt before it is lined.</p></div></li>
              <li><span className="n">3</span><div><h3>Stitching and finishing</h3><p>Edges are saddle-stitched, burnished and sealed. The engraved buckle is fitted on a snap keeper so it can be swapped later.</p></div></li>
            </ol>
          </div>
        </div>
      </section>

      <section className="block" id="size">
        <div className="wrap">
          <div className="head lift">
            <div>
              <div className="eyebrow mono">Size guide</div>
              <h2 className="display h2">Belt size is not<br />your waist size</h2>
            </div>
            <p>Belts are sized to the centre hole. Take the waist size of the trousers you will wear it with and add two inches.</p>
          </div>
          <SizeGuide />
        </div>
      </section>

      {faqs.length > 0 && (
        <section className="block" style={{ paddingTop: 0 }}>
          <div className="wrap narrow">
            <div className="head lift"><div><div className="eyebrow mono">Questions</div><h2 className="display h2">Before you buy</h2></div></div>
            <div className="faq-list">
              {faqs.slice(0, 6).map((f) => (
                <details key={f.id}><summary>{f.question}</summary><div className="ans">{f.answer}</div></details>
              ))}
            </div>
            <p style={{ marginTop: 18 }}><Link href="/faq">All questions →</Link></p>
          </div>
        </section>
      )}

      <div className="wrap">
        <div className="promises">
          <div><h3>Free shipping</h3><p>On every order across India.</p></div>
          <div><h3>Easy size exchange</h3><p>Swap an unworn belt within {s.shipping.exchangeDays} days.</p></div>
          <div><h3>Gift-ready box</h3><p>Every belt ships boxed with a care card.</p></div>
          <div><h3>Secure checkout</h3><p>UPI, cards, netbanking{s.shipping.codEnabled ? " and cash on delivery" : ""}.</p></div>
        </div>
      </div>
      <div style={{ height: 64 }} />
    </>
  );
}
