"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useTransition } from "react";
import { useCart } from "./CartProvider";
import { setQty } from "@/app/(store)/actions";
import { inr } from "@/lib/money";

export function CartLines({ compact = false }: { compact?: boolean }) {
  const { cart, setCart, toast } = useCart();
  const [pending, start] = useTransition();
  const change = (id: string, q: number) => start(async () => {
    const r = await setQty(id, q);
    if (r.cart) setCart(r.cart);
    if (!r.ok) toast(r.error);
  });
  if (!cart.lines.length) return null;
  return (
    <div aria-busy={pending}>
      {cart.lines.map((l) => (
        <div className="line" key={l.id}>
          <Link className="thumb" href={`/products/${l.slug}`}>
            {l.image && <Image src={l.image} alt="" width={compact ? 72 : 96} height={compact ? 72 : 96} />}
          </Link>
          <div>
            <Link className="t" href={`/products/${l.slug}`}>{l.name}</Link>
            <div className="s">Size {l.size} · {inr(l.price)}</div>
            {!l.available && <div className="warn-txt">No longer available. Remove it to continue.</div>}
            {l.available && l.qty > l.stock && <div className="warn-txt">Only {l.stock} left. Lower the quantity.</div>}
            <div style={{ display: "flex", alignItems: "center" }}>
              <div className="qty">
                <button type="button" aria-label="Decrease quantity" onClick={() => change(l.id, l.qty - 1)}>−</button>
                <span>{l.qty}</span>
                <button type="button" aria-label="Increase quantity" onClick={() => change(l.id, l.qty + 1)} disabled={l.qty >= l.stock}>+</button>
              </div>
              <button type="button" className="remove" onClick={() => change(l.id, 0)}>Remove</button>
            </div>
          </div>
          <div className="amt">{inr(l.price * l.qty)}</div>
        </div>
      ))}
    </div>
  );
}

export function CartDrawer() {
  const { cart, open, setOpen } = useCart();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [setOpen]);
  const t = cart.totals;
  return (
    <>
      <div className={`scrim${open ? " on" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`drawer${open ? " on" : ""}`} aria-label="Your bag" aria-hidden={!open} inert={!open}>
        <div className="dh"><h2>Your bag</h2><button className="x" onClick={() => setOpen(false)} aria-label="Close bag">×</button></div>
        <div className="items">
          {cart.lines.length ? <CartLines compact /> : (
            <div className="empty-state" style={{ marginTop: 20 }}>
              <span>Your bag is empty.</span>
              <Link className="btn solid" href="/shop" onClick={() => setOpen(false)}>Shop belts</Link>
            </div>
          )}
        </div>
        {cart.lines.length > 0 && t && (
          <div className="df">
            <div className="sum-row"><span>Subtotal</span><span>{inr(t.subtotal)}</span></div>
            {t.couponDiscount > 0 && <div className="sum-row disc"><span>Code {t.couponCode}</span><span>−{inr(t.couponDiscount)}</span></div>}
            <div className="free-bar">{t.shipping === 0 ? "Free shipping across India · Taxes included" : `Shipping ${inr(t.shipping)} · Taxes included`}</div>
            <Link className="btn solid" href="/checkout" onClick={() => setOpen(false)}>Checkout · {inr(t.total)} <span className="arr">→</span></Link>
            <Link className="btn" href="/cart" onClick={() => setOpen(false)}>View bag</Link>
          </div>
        )}
      </aside>
    </>
  );
}
