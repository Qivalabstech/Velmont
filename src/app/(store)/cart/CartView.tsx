"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useCart } from "@/components/store/CartProvider";
import { CartLines } from "@/components/store/CartDrawer";
import { applyCoupon, removeCoupon } from "@/app/(store)/actions";
import { inr } from "@/lib/money";

export function CouponBox() {
  const { cart, setCart, toast } = useCart();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const t = cart.totals;
  if (t?.couponCode) return (
    <div className="coupon-on"><span>Code {t.couponCode} applied</span>
      <button className="link-btn" onClick={() => start(async () => { const r = await removeCoupon(); if (r.cart) setCart(r.cart); })}>Remove</button>
    </div>
  );
  const apply = () => start(async () => {
    const r = await applyCoupon(code);
    if (r.cart) setCart(r.cart);
    if (r.ok) { setErr(null); toast(r.message || "Code applied"); } else setErr(r.error);
  });
  return (
    <div className="coupon-form-wrap">
      <label htmlFor="coupon" className="sr-only">Discount code</label>
      <div className="coupon-form">
        <input id="coupon" className="input" placeholder="Discount code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (code.trim()) apply(); } }} />
        <button type="button" className="btn" disabled={pending || !code.trim()} onClick={apply}>Apply</button>
      </div>
      {(err || cart.totals?.couponError) && <div className="err" style={{ marginTop: 6 }}>{err || cart.totals?.couponError}</div>}
    </div>
  );
}

export function CartView() {
  const { cart } = useCart();
  const t = cart.totals;
  if (!cart.lines.length || !t) return (
    <div className="empty-state" style={{ marginBottom: 80 }}>
      <span>Your bag is empty.</span><Link className="btn solid" href="/shop">Shop belts</Link>
    </div>
  );
  const blocked = cart.lines.some((l) => !l.available || l.qty > l.stock);
  return (
    <div className="cart-layout">
      <div><CartLines /></div>
      <aside className="summary" aria-label="Order summary">
        <h2>Order summary</h2>
        <div className="sum-row"><span>Subtotal · {t.itemCount} {t.itemCount === 1 ? "item" : "items"}</span><span>{inr(t.subtotal)}</span></div>
        {t.couponDiscount > 0 && <div className="sum-row disc"><span>Discount ({t.couponCode})</span><span>−{inr(t.couponDiscount)}</span></div>}
        <div className="sum-row"><span>Shipping</span><span>{t.shipping ? inr(t.shipping) : "Free"}</span></div>
        <div className="sum-row total"><span>Total</span><span>{inr(t.total)}</span></div>
        <div className="muted" style={{ fontSize: ".8rem" }}>Includes GST of {inr(t.tax)}. Cash on delivery fee, if chosen, is added at checkout.</div>
        <CouponBox />
        {blocked && <div className="alert warn">Fix the highlighted items to continue.</div>}
        <Link className="btn solid" href="/checkout" aria-disabled={blocked}>Continue to checkout <span className="arr">→</span></Link>
        <Link className="btn" href="/shop">Keep shopping</Link>
      </aside>
    </div>
  );
}
