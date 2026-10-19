import Link from "next/link";
import { desc, eq, and, ne } from "drizzle-orm";
import { db, orders } from "@/db";
import { requireCustomer } from "@/lib/auth";
import { inr } from "@/lib/money";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/order-status";
import { formatDate } from "@/lib/utils";

export default async function AccountHome() {
  const c = await requireCustomer();
  const list = await db.query.orders.findMany({
    where: and(eq(orders.userId, c.id), ne(orders.status, "PENDING_PAYMENT")),
    orderBy: [desc(orders.createdAt)], with: { items: { columns: { name: true, qty: true } } },
  });
  return (
    <section>
      <h2 style={{ marginTop: 0 }}>Your orders</h2>
      {list.length ? (
        <div className="order-rows">
          {list.map((o) => (
            <Link className="order-row" key={o.id} href={`/account/orders/${o.number}`}>
              <div style={{ minWidth: 0 }}>
                <div className="n">{o.number}</div>
                <div className="meta">{formatDate(o.createdAt)} · {o.items.map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ")}</div>
              </div>
              <div style={{ textAlign: "right", display: "grid", gap: 4, justifyItems: "end" }}>
                <span className={`pill ${STATUS_TONE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                <span className="tnum">{inr(o.total)}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state"><span>You have not placed an order yet.</span><Link className="btn solid" href="/shop">Shop belts</Link></div>
      )}
    </section>
  );
}
