import { notFound } from "next/navigation";
import { getOrderFull } from "@/lib/orders";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { InvoiceDoc } from "@/components/InvoiceDoc";

export const metadata = { title: "Invoice", robots: { index: false } };

export default async function AdminInvoice({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("orders.view");
  const o = await getOrderFull((await params).id);
  if (!o) notFound();
  return <InvoiceDoc o={o} s={await getSettings()} />;
}
