import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db, addresses } from "@/db";
import { getCartRecord, getCartLines } from "@/lib/cart";
import { getCustomer } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { paymentsMode } from "@/lib/razorpay";
import { quote } from "./actions";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const cart = await getCartRecord(false);
  const lines = cart ? await getCartLines(cart.id) : [];
  if (!lines.length) redirect("/cart");
  const [customer, s, q, mode] = await Promise.all([getCustomer(), getSettings(), quote(null), paymentsMode()]);
  const saved = customer ? await db.select().from(addresses).where(eq(addresses.userId, customer.id)).orderBy(desc(addresses.isDefault), asc(addresses.name)) : [];
  return (
    <div className="wrap">
      <header className="page-head"><div className="eyebrow mono">Checkout · step 2 of 2</div><h1 className="display">Delivery and payment</h1></header>
      <CheckoutForm
        lines={lines} quote={q!} paymentsMode={mode}
        customer={customer ? { name: customer.name, email: customer.email, phone: customer.phone || "" } : null}
        saved={saved.map((a) => ({ ...a }))}
        cod={{ enabled: s.shipping.codEnabled, fee: s.shipping.codFee, max: s.shipping.codMaxOrder }}
        prepaidPercent={s.payments.prepaidDiscountPercent}
        delivery={s.shipping.deliveryDays}
      />
    </div>
  );
}
