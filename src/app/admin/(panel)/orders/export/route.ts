import { desc } from "drizzle-orm";
import { db, orders } from "@/db";
import { getStaff } from "@/lib/auth";
import { orderWhere } from "../query";
import { STATUS_LABEL, PAYMENT_LABEL } from "@/lib/order-status";
import { audit } from "@/lib/audit";

const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export async function GET(req: Request) {
  const me = await getStaff();
  if (!me || !me.perms.has("orders.view")) return new Response("Forbidden", { status: 403 });
  const f = Object.fromEntries(new URL(req.url).searchParams);
  const list = await db.query.orders.findMany({ where: orderWhere(f), orderBy: [desc(orders.createdAt)], limit: 10000, with: { items: true } });
  const head = ["Order", "Date", "Status", "Payment", "Method", "Name", "Email", "Phone", "Address", "City", "State", "Pincode", "Items", "Subtotal", "Discount", "Shipping", "COD fee", "Total", "Refunded", "Coupon", "Courier", "AWB"];
  const rows = list.map((o) => {
    const a = o.shippingAddress;
    return [o.number, o.createdAt.toISOString(), STATUS_LABEL[o.status], PAYMENT_LABEL[o.paymentStatus], o.paymentMethod, a.name, o.email, o.phone,
      [a.line1, a.line2].filter(Boolean).join(", "), a.city, a.state, a.pincode, o.items.map((i) => `${i.sku} x${i.qty}`).join("; "),
      o.subtotal / 100, o.discount / 100, o.shipping / 100, o.codFee / 100, o.total / 100, o.refunded / 100, o.couponCode, o.courier, o.awb].map(esc).join(",");
  });
  await audit({ id: me.id, name: me.name }, "export", "order", null, `Exported ${list.length} orders`);
  return new Response("﻿" + [head.join(","), ...rows].join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="velmont-orders-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
