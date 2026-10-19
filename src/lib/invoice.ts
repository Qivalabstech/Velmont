type Item = { name: string; size: string; sku: string; hsn: string; qty: number; total: number; gstRate: number };

/** Splits tax-inclusive order amounts into taxable value and GST per line. */
export function invoiceLines(o: { items: Item[]; subtotal: number; discount: number; shipping: number; codFee: number }, intraState: boolean) {
  const factor = o.subtotal ? (o.subtotal - o.discount) / o.subtotal : 1;
  const rows = o.items.map((i) => {
    const gross = Math.round(i.total * factor);
    const taxable = Math.round((gross * 100) / (100 + i.gstRate));
    const tax = gross - taxable;
    return { desc: `${i.name} · Size ${i.size}`, sku: i.sku, hsn: i.hsn, qty: i.qty, rate: i.gstRate, gross, taxable, tax };
  });
  const fees = o.shipping + o.codFee;
  if (fees > 0) {
    const rate = o.items.length ? Math.max(...o.items.map((i) => i.gstRate)) : 18;
    const taxable = Math.round((fees * 100) / (100 + rate));
    rows.push({ desc: o.codFee ? "Shipping and cash handling" : "Shipping", sku: "", hsn: "9965", qty: 1, rate, gross: fees, taxable, tax: fees - taxable });
  }
  const sum = (k: "gross" | "taxable" | "tax") => rows.reduce((a, r) => a + r[k], 0);
  return {
    rows: rows.map((r) => ({ ...r, cgst: intraState ? Math.round(r.tax / 2) : 0, sgst: intraState ? r.tax - Math.round(r.tax / 2) : 0, igst: intraState ? 0 : r.tax })),
    taxable: sum("taxable"), tax: sum("tax"), gross: sum("gross"),
  };
}
