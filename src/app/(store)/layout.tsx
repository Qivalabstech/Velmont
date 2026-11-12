import "@/styles/store.css";
import { getSettings } from "@/lib/settings";
import { CartProvider } from "@/components/store/CartProvider";
import { Header } from "@/components/store/Header";
import { CartDrawer } from "@/components/store/CartDrawer";
import { Footer } from "@/components/store/Footer";
import { Lift } from "@/components/store/Lift";
import { Analytics } from "@/components/store/Analytics";
import { NavProgress } from "@/components/store/NavProgress";
import { Suspense } from "react";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <CartProvider>
      <Header storeName={s.store.name} announcements={s.content.announcements} />
      <main id="main">{children}</main>
      <Footer storeName={s.store.name} legalName={s.store.legalName} email={s.store.email} phone={s.store.phone} address={s.store.address} />
      <CartDrawer />
      <Lift />
      <Suspense fallback={null}><NavProgress /></Suspense>
      <Analytics />
    </CartProvider>
  );
}
