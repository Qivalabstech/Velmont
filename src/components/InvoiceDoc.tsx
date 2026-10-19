import { inr } from "@/lib/money";
import { invoiceLines } from "@/lib/invoice";
import { formatDate } from "@/lib/utils";
import type { Settings } from "@/lib/settings";
import type { ShippingAddress } from "@/db/schema";
import { PrintButton } from "./PrintButton";

type O = {
  number: string; createdAt: Date; placedAt: Date | null; paymentMethod: string; paymentStatus: string; email: string; phone: string;
  subtotal: number; discount: number; shipping: number; codFee: number; total: number; shippingAddress: ShippingAddress;
  items: { name: string; size: string; sku: string; hsn: string; qty: number; total: number; gstRate: number }[];
};

export function InvoiceDoc({ o, s }: { o: O; s: Settings }) {
  const a = o.shippingAddress;
  const intra = a.state.toLowerCase() === s.store.state.toLowerCase();
  const inv = invoiceLines(o, intra);
  return (
    <div className="inv">
      <style>{`
        .inv{max-width:860px;margin:24px auto;background:#fff;color:#1C1714;padding:40px;font-family:var(--f-body);font-size:13px;border:1px solid #ddd}
        .inv h1{font-family:var(--f-display);font-size:30px;letter-spacing:.12em;margin:0}
        .inv .row{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap}
        .inv table{width:100%;border-collapse:collapse;margin:20px 0;font-variant-numeric:tabular-nums}
        .inv th,.inv td{border-bottom:1px solid #e3e0da;padding:7px 6px;text-align:right;vertical-align:top}
        .inv th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#6C665F;font-weight:600}
        .inv th:first-child,.inv td:first-child{text-align:left}
        .inv .tot td{font-weight:700;border-bottom:2px solid #1C1714}
        .inv .muted{color:#6C665F}
        .inv .bar{display:flex;justify-content:flex-end;margin-bottom:16px}
        .inv .scroll{overflow-x:auto}
        @media print{body{background:#fff}.inv{border:0;margin:0;max-width:none;padding:0}.inv .bar{display:none}}
        @media (max-width:640px){.inv{padding:18px;margin:0;border:0}}
      `}</style>
      <div className="bar"><PrintButton /></div>
      <div className="row">
        <div><h1>{s.store.name}</h1><div>{s.store.legalName}</div><div className="muted">{s.store.address}</div>
          {s.store.gstin && <div>GSTIN: <b>{s.store.gstin}</b></div>}<div className="muted">{s.store.email} · {s.store.phone}</div></div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{s.store.gstin ? "Tax invoice" : "Invoice"}</div>
          <div>No. {s.tax.invoicePrefix}{o.number.replace(/\D/g, "")}</div>
          <div>Order {o.number}</div>
          <div>Date {formatDate(o.placedAt ?? o.createdAt)}</div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 22 }}>
        <div><div className="muted">Bill and ship to</div><b>{a.name}</b><br />{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.city}, {a.state} {a.pincode}<br />{o.phone} · {o.email}</div>
        <div style={{ textAlign: "right" }}><div className="muted">Place of supply</div>{a.state}<div className="muted" style={{ marginTop: 8 }}>Payment</div>{o.paymentMethod === "COD" ? "Cash on delivery" : "Online (Razorpay)"}</div>
      </div>
      <div className="scroll">
        <table>
          <thead><tr><th>Item</th><th>HSN/SAC</th><th>Qty</th><th>Taxable value</th><th>GST %</th>
            {intra ? <><th>CGST</th><th>SGST</th></> : <th>IGST</th>}<th>Amount</th></tr></thead>
          <tbody>
            {inv.rows.map((r, i) => (
              <tr key={i}><td>{r.desc}{r.sku && <div className="muted">{r.sku}</div>}</td><td>{r.hsn}</td><td>{r.qty}</td><td>{inr(r.taxable, { decimals: true })}</td><td>{r.rate}%</td>
                {intra ? <><td>{inr(r.cgst, { decimals: true })}</td><td>{inr(r.sgst, { decimals: true })}</td></> : <td>{inr(r.igst, { decimals: true })}</td>}
                <td>{inr(r.gross, { decimals: true })}</td></tr>
            ))}
            <tr className="tot"><td colSpan={3}>Total</td><td>{inr(inv.taxable, { decimals: true })}</td><td></td>
              {intra ? <><td>{inr(Math.round(inv.tax / 2), { decimals: true })}</td><td>{inr(inv.tax - Math.round(inv.tax / 2), { decimals: true })}</td></> : <td>{inr(inv.tax, { decimals: true })}</td>}
              <td>{inr(o.total, { decimals: true })}</td></tr>
          </tbody>
        </table>
      </div>
      {o.discount > 0 && <p className="muted">Item values are shown after a discount of {inr(o.discount)}.</p>}
      <p className="muted">This is a computer-generated invoice and does not need a signature.</p>
    </div>
  );
}
