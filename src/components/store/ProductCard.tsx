import Link from "next/link";
import Image from "next/image";
import type { CardProduct } from "@/lib/catalog";
import { inr, percentOff } from "@/lib/money";

export function ProductCard({ p, priority = false }: { p: CardProduct; priority?: boolean }) {
  const off = percentOff(p.price, p.mrp);
  const [a, b] = p.images;
  return (
    <article className="card lift">
      <div className="pic">
        {a && <Image className="a" src={a.url} alt={a.alt} fill sizes="(max-width:640px) 50vw, (max-width:1100px) 45vw, 25vw" priority={priority} />}
        {b && <Image className="b" src={b.url} alt="" fill sizes="(max-width:640px) 50vw, (max-width:1100px) 45vw, 25vw" />}
        {!p.inStock ? <span className="flag out mono">Sold out</span> : p.badge ? <span className="flag mono">{p.badge}</span> : null}
      </div>
      <div className="body">
        <h3><Link href={`/products/${p.slug}`}>{p.name}</Link></h3>
        <div className="price">
          <span>{inr(p.price)}</span>{p.mrp > p.price && <s>{inr(p.mrp)}</s>}{off > 0 && <em>−{off}%</em>}
        </div>
        <p className="desc">{p.tagline}</p>
        <div className="foot">
          <div className="swatch" aria-hidden="true">{p.colors.map((c) => <i key={c} style={{ background: c }} />)}</div>
          {p.reviewCount > 0 && <span className="stars">★ {p.rating.toFixed(1)} ({p.reviewCount})</span>}
        </div>
      </div>
    </article>
  );
}
