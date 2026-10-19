import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = { title: "Contact VELMONT customer support", description: "Questions about belt sizing, an order or a size exchange? Write to VELMONT. We reply within one working day by email or phone.", alternates: { canonical: "/contact" } };

export default async function Contact({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const s = await getSettings();
  const order = (await searchParams).order || "";
  return (
    <div className="wrap" style={{ paddingBottom: 80 }}>
      <header className="page-head"><div className="eyebrow mono">Help</div><h1 className="display">Contact us</h1>
        <p>We reply within one working day. For an order, include the order number so we can find it fast.</p></header>
      <div className="cart-layout">
        <ContactForm order={order} />
        <aside className="summary">
          <h2>Other ways to reach us</h2>
          <dl className="kv">
            <dt>Email</dt><dd>{s.store.email}</dd>
            <dt>Phone</dt><dd>{s.store.phone}</dd>
            {s.store.whatsapp && <><dt>WhatsApp</dt><dd>{s.store.whatsapp}</dd></>}
            <dt>Hours</dt><dd>{s.store.supportHours}</dd>
            <dt>Address</dt><dd>{s.store.address}</dd>
          </dl>
        </aside>
      </div>
    </div>
  );
}
