"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { CartSummary } from "@/app/(store)/actions";

type Toast = { msg: string; href?: string; label?: string } | null;
type Ctx = {
  cart: CartSummary; setCart: (c: CartSummary) => void;
  open: boolean; setOpen: (v: boolean) => void;
  toast: (msg: string, href?: string, label?: string) => void;
};
const CartCtx = createContext<Ctx | null>(null);
export const useCart = () => {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
};

export function CartProvider({ initial, children }: { initial: CartSummary; children: React.ReactNode }) {
  const [cart, setCart] = useState(initial);
  const [open, setOpen] = useState(false);
  const [t, setT] = useState<Toast>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback((msg: string, href?: string, label?: string) => {
    setT({ msg, href, label });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), 3200);
  }, []);
  useEffect(() => { setCart(initial); }, [initial]);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
  }, [open]);
  return (
    <CartCtx.Provider value={{ cart, setCart, open, setOpen, toast }}>
      {children}
      <div className={`toast${t ? " on" : ""}`} role="status" aria-live="polite">
        <span>{t?.msg}</span>
        {t?.href && <a href={t.href}>{t.label}</a>}
      </div>
    </CartCtx.Provider>
  );
}
