import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, wishlistItems } from "@/db";
import { requireCustomer } from "@/lib/auth";
import { listProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/store/ProductCard";

export default async function Wishlist() {
  const c = await requireCustomer("/account/wishlist");
  const ids = new Set((await db.select().from(wishlistItems).where(eq(wishlistItems.userId, c.id))).map((w) => w.productId));
  const items = (await listProducts()).filter((p) => ids.has(p.id));
  return (
    <section style={{ display: "grid", gap: 16 }}>
      <h2 style={{ margin: 0 }}>Wishlist</h2>
      {items.length ? <div className="grid three">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        : <div className="empty-state"><span>Tap the heart on any belt to save it here.</span><Link className="btn solid" href="/shop">Shop belts</Link></div>}
    </section>
  );
}
