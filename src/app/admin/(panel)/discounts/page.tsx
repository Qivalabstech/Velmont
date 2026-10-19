import { desc } from "drizzle-orm";
import { db, coupons } from "@/db";
import { requireStaff } from "@/lib/auth";
import { inr } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { PageHead, Card, Pill } from "@/components/admin/ui";
import { CouponForm } from "./CouponForm";

export const metadata = { title: "Discounts" };

export default async function Discounts() {
  await requireStaff("marketing.manage");
  const list = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  const now = new Date();
  const fmt = (c: typeof list[number]) => c.type === "PERCENT" ? `${c.value}% off${c.maxDiscount ? ` (up to ${inr(c.maxDiscount)})` : ""}` : c.type === "FIXED" ? `${inr(c.value)} off` : "Free shipping";
  return (
    <div className="stack" style={{ maxWidth: 1000 }}>
      <PageHead title="Discounts" sub="Codes customers type at checkout. Usage counts update when orders are placed and drop back if an order is cancelled." />
      <Card flush>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Code</th><th>Offer</th><th>Conditions</th><th>Used</th><th>Status</th></tr></thead>
          <tbody>{list.map((c) => {
            const live = c.active && (!c.endsAt || c.endsAt > now) && (!c.startsAt || c.startsAt <= now) && (c.usageLimit == null || c.usedCount < c.usageLimit);
            return (
              <tr key={c.id}>
                <td><b className="mono" style={{ fontSize: ".85rem" }}>{c.code}</b><div className="sub">{c.description}</div></td>
                <td>{fmt(c)}</td>
                <td className="sub">{c.minSubtotal ? `Min ${inr(c.minSubtotal)}` : "Any order"}{c.perCustomerLimit ? ` · ${c.perCustomerLimit} per customer` : ""}{c.endsAt ? ` · ends ${formatDate(c.endsAt)}` : ""}</td>
                <td>{c.usedCount}{c.usageLimit != null ? ` / ${c.usageLimit}` : ""}</td>
                <td><Pill tone={live ? "good" : "neutral"}>{live ? "Live" : c.active ? "Not live" : "Off"}</Pill></td>
              </tr>
            );
          })}{!list.length && <tr><td colSpan={5} className="empty">No codes yet.</td></tr>}</tbody>
        </table></div>
      </Card>
      {list.map((c) => (
        <details key={c.id} className="cardx" style={{ padding: "0 18px" }}>
          <summary style={{ padding: "14px 0", cursor: "pointer", fontWeight: 600 }}>Edit {c.code}</summary>
          <div style={{ paddingBottom: 18 }}><CouponForm c={{ ...c, startsAt: c.startsAt?.toISOString().slice(0, 10) ?? "", endsAt: c.endsAt?.toISOString().slice(0, 10) ?? "" }} /></div>
        </details>
      ))}
      <Card title="Create a code"><CouponForm /></Card>
    </div>
  );
}
