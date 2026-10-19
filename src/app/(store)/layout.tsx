import "@/styles/store.css";
import { getSettings } from "@/lib/settings";
import { getCartSummary } from "@/lib/cart";
import { getCustomer } from "@/lib/auth";
import { CartProvider } from "@/components/store/CartProvider";
import { Header } from "@/components/store/Header";
import { CartDrawer } from "@/components/store/CartDrawer";
import { Footer } from "@/components/store/Footer";
import { Lift } from "@/components/store/Lift";
import { Analytics } from "@/components/store/Analytics";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [s, cart, customer] = await Promise.all([getSettings(), getCartSummary(), getCustomer()]);
  return (
    <CartProvider initial={cart}>
      <Header storeName={s.store.name} announcements={s.content.announcements} signedIn={!!customer} />
      <main id="main">{children}</main>
      <Footer storeName={s.store.name} legalName={s.store.legalName} email={s.store.email} phone={s.store.phone} address={s.store.address} />
      <CartDrawer />
      <Lift />
      <Analytics />
    </CartProvider>
  );
}
