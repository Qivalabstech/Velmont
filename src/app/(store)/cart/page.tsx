import type { Metadata } from "next";
import { CartView } from "./CartView";

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="wrap">
      <header className="page-head"><div className="eyebrow mono">Checkout · step 1 of 2</div><h1 className="display">Your bag</h1></header>
      <CartView />
    </div>
  );
}
