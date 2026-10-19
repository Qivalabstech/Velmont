"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { addToCart, toggleWishlist } from "@/app/(store)/actions";
import { useCart } from "@/components/store/CartProvider";
import { HeartIcon } from "@/components/store/Icons";
import { inr, percentOff } from "@/lib/money";

type V = { id: string; size: string; stock: number; active: boolean };

export function ProductBuy({ product, images, variants, rating, reviewCount, saved, signedIn, perks, children }: {
  product: { id: string; name: string; slug: string; price: number; mrp: number; tagline: string; badge: string | null };
  images: { url: string; alt: string }[]; variants: V[]; rating: number; reviewCount: number; saved: boolean; signedIn: boolean;
  perks: { dispatch: string; exchange: number; cod: boolean }; children: React.ReactNode;
}) {
  const { setCart, setOpen, toast } = useCart();
  const router = useRouter();
  const [img, setImg] = useState(0);
  const [zoom, setZoom] = useState(false);
  const firstAvail = variants.find((v) => v.active && v.stock > 0 && v.size === "34") ?? variants.find((v) => v.active && v.stock > 0);
  const [sel, setSel] = useState<string | null>(firstAvail?.id ?? null);
  const [wish, setWish] = useState(saved);
  const [pending, start] = useTransition();
  const [sticky, setSticky] = useState(false);
  const buyRef = useRef<HTMLDivElement>(null);
  const v = variants.find((x) => x.id === sel);
  const soldOut = !variants.some((x) => x.active && x.stock > 0);
  const off = percentOff(product.price, product.mrp);

  useEffect(() => {
    const el = buyRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSticky(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const add = (buyNow = false) => {
    if (!v) { toast("Choose your size first."); return; }
    start(async () => {
      const r = await addToCart(v.id, 1);
      if (r.cart) setCart(r.cart);
      if (!r.ok) { toast(r.error); return; }
      if (buyNow) router.push("/checkout");
      else { setOpen(true); }
    });
  };

  return (
    <div className="pdp">
      <div className="gallery">
        <div className={`main${zoom ? " zoom" : ""}`} onClick={() => setZoom((z) => !z)}
          onMouseMove={(e) => {
            if (!zoom) return;
            const r = e.currentTarget.getBoundingClientRect();
            const im = e.currentTarget.querySelector("img");
            if (im) im.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
          }}
          role="button" tabIndex={0} aria-label={zoom ? "Zoom out" : "Zoom in"}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setZoom((z) => !z)}>
          {images[img] && <Image key={img} src={images[img].url} alt={images[img].alt} fill priority sizes="(max-width:860px) 100vw, 58vw" />}
        </div>
        {images.length > 1 && (
          <div className="thumbs" role="group" aria-label="Photos">
            {images.map((im, i) => (
              <button key={im.url} aria-pressed={i === img} aria-label={`Photo ${i + 1}`} onClick={() => { setImg(i); setZoom(false); }}>
                <Image src={im.url} alt="" width={84} height={84} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="buybox">
        <div>
          {product.badge && <div className="eyebrow mono" style={{ marginBottom: 10 }}>{product.badge}</div>}
          <h1 className="display">{product.name}</h1>
        </div>
        <p className="tag">{product.tagline}</p>
        {reviewCount > 0 && (
          <a className="rating-line" href="#reviews">
            <span className="stars-svg">{"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))}</span>
            {rating.toFixed(1)} · {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
          </a>
        )}
        <div>
          <div className="price"><span>{inr(product.price)}</span>{product.mrp > product.price && <s>{inr(product.mrp)}</s>}{off > 0 && <em>{off}% OFF</em>}</div>
          <div className="muted" style={{ fontSize: ".82rem" }}>Inclusive of all taxes · Free shipping</div>
        </div>

        <div ref={buyRef} style={{ display: "grid", gap: 12 }}>
          <div className="size-row">
            <span className="mono">Belt size {v ? `· ${v.size}` : ""}</span>
            <a className="link-btn" href="#size-guide">Size guide</a>
          </div>
          <div className="sizes" role="radiogroup" aria-label="Belt size">
            {variants.map((x) => (
              <button key={x.id} role="radio" aria-checked={x.id === sel} aria-pressed={x.id === sel}
                disabled={!x.active || x.stock <= 0} onClick={() => setSel(x.id)}
                aria-label={`Size ${x.size}${x.stock <= 0 ? ", sold out" : ""}`}>{x.size}</button>
            ))}
          </div>
          <div className={`stock-note${v && v.stock <= 3 ? " low" : ""}`} aria-live="polite">
            {soldOut ? "Sold out in every size. Write to us to hear when it is back." : v ? (v.stock <= 3 ? `Only ${v.stock} left in size ${v.size}.` : `In stock. Dispatched in ${perks.dispatch}.`) : "Choose a size."}
          </div>
          <div className="buy-actions">
            <button className="btn solid" onClick={() => add(false)} disabled={pending || soldOut}>
              {pending ? <span className="spinner" /> : soldOut ? "Sold out" : "Add to bag"}
            </button>
            <button className="btn wish" aria-pressed={wish} aria-label={wish ? "Remove from wishlist" : "Save to wishlist"}
              onClick={() => start(async () => {
                const r = await toggleWishlist(product.id);
                if (r.needLogin) { toast("Sign in to save belts to your wishlist.", `/account/login?next=/products/${product.slug}`, "Sign in"); return; }
                setWish(!!r.saved); toast(r.saved ? "Saved to your wishlist" : "Removed from your wishlist", r.saved ? "/account/wishlist" : undefined, "View");
              })}><HeartIcon /></button>
          </div>
          {!soldOut && <button className="btn" onClick={() => add(true)} disabled={pending}>Buy now</button>}
        </div>

        <div className="perks">
          <div><b>Free shipping</b><span className="muted">Across India</span></div>
          <div><b>{perks.exchange}-day exchange</b><span className="muted">Unworn belts</span></div>
          <div><b>{perks.cod ? "COD available" : "Secure payment"}</b><span className="muted">UPI · Cards · Netbanking</span></div>
        </div>
        {children}
        {!signedIn && <p className="muted" style={{ fontSize: ".85rem", margin: 0 }}><Link href={`/account/login?next=/products/${product.slug}`}>Sign in</Link> to track orders and save belts.</p>}
      </div>

      <div className={`sticky-buy${sticky ? " on" : ""}`} aria-hidden={!sticky}>
        <div style={{ minWidth: 0 }}>
          <div className="nm">{product.name}</div>
          <div className="muted" style={{ fontSize: ".85rem" }}>{inr(product.price)}{v ? ` · Size ${v.size}` : ""}</div>
        </div>
        <button className="btn solid" tabIndex={sticky ? 0 : -1} onClick={() => add(false)} disabled={pending || soldOut}>{soldOut ? "Sold out" : "Add to bag"}</button>
      </div>
    </div>
  );
}
