"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchSession, type CartSummary } from "@/app/(store)/actions";

type Toast = { msg: string; href?: string; label?: string } | null;
type Ctx = {
  cart: CartSummary; setCart: (c: CartSummary) => void;
  /** False until the bag has been read for this visitor (pages are served from the cache without it). */
  loaded: boolean; signedIn: boolean;
  open: boolean; setOpen: (v: boolean) => void;
  toast: (msg: string, href?: string, label?: string) => void;
};
const CartCtx = createContext<Ctx | null>(null);
export const useCart = () => {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
};

const EMPTY: CartSummary = { lines: [], totals: null, count: 0, couponCode: null };
// Leaving these sections can change the bag or the sign-in (login, logout, placing an order).
const REFRESH_AFTER = /^\/(account|checkout|order)(\/|$)/;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCartState] = useState<CartSummary>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const [t, setT] = useState<Toast>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const path = usePathname();
  const prevPath = useRef<string | null>(null);
  const toast = useCallback((msg: string, href?: string, label?: string) => {
    setT({ msg, href, label });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), 3200);
  }, []);
  const setCart = useCallback((c: CartSummary) => { setCartState(c); setLoaded(true); }, []);

  useEffect(() => {
    const prev = prevPath.current;
    prevPath.current = path;
    if (prev !== null && !REFRESH_AFTER.test(prev) && !REFRESH_AFTER.test(path)) return;
    let live = true;
    fetchSession().then((s) => { if (!live) return; setCartState(s.cart); setSignedIn(s.signedIn); setLoaded(true); }).catch(() => setLoaded(true));
    return () => { live = false; };
  }, [path]);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
  }, [open]);
  return (
    <CartCtx.Provider value={{ cart, setCart, loaded, signedIn, open, setOpen, toast }}>
      {children}
      <div className={`toast${t ? " on" : ""}`} role="status" aria-live="polite">
        <span>{t?.msg}</span>
        {t?.href && <a href={t.href}>{t.label}</a>}
      </div>
    </CartCtx.Provider>
  );
}
