import { and, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { orders } from "@/db";
import type { OrderStatus, PaymentStatus } from "@/db/schema";

export const TABS: { key: string; label: string; statuses?: OrderStatus[] }[] = [
  { key: "all", label: "All" },
  { key: "to-ship", label: "To ship", statuses: ["PLACED", "CONFIRMED", "PACKED"] },
  { key: "in-transit", label: "In transit", statuses: ["SHIPPED", "OUT_FOR_DELIVERY"] },
  { key: "delivered", label: "Delivered", statuses: ["DELIVERED"] },
  { key: "returns", label: "Returns", statuses: ["RETURN_REQUESTED", "RETURNED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
  { key: "unpaid", label: "Unpaid", statuses: ["PENDING_PAYMENT"] },
];

export type OrderFilters = { tab?: string; q?: string; payment?: string; method?: string; from?: string; to?: string; page?: string };

export function orderWhere(f: OrderFilters, includeTab = true) {
  const w: SQL[] = [];
  const tab = TABS.find((t) => t.key === f.tab);
  if (includeTab && tab?.statuses) w.push(inArray(orders.status, tab.statuses));
  if (includeTab && (!tab || tab.key === "all")) w.push(sql`${orders.status} <> 'PENDING_PAYMENT'`);
  if (f.q) {
    const q = `%${f.q.trim()}%`;
    w.push(or(ilike(orders.number, q), ilike(orders.email, q), ilike(orders.phone, q), sql`${orders.shippingAddress}->>'name' ilike ${q}`, ilike(orders.awb, q))!);
  }
  if (f.payment) w.push(eq(orders.paymentStatus, f.payment as PaymentStatus));
  if (f.method === "COD" || f.method === "RAZORPAY") w.push(eq(orders.paymentMethod, f.method));
  if (f.from) w.push(gte(orders.createdAt, new Date(`${f.from}T00:00:00+05:30`)));
  if (f.to) w.push(lte(orders.createdAt, new Date(`${f.to}T23:59:59+05:30`)));
  return w.length ? and(...w) : undefined;
}
