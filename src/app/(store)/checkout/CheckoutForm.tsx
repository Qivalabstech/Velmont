"use client";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { CartLine, Totals } from "@/lib/cart";
import { inr } from "@/lib/money";
import { INDIAN_STATES } from "@/lib/utils";
import { useCart } from "@/components/store/CartProvider";
import { LockIcon } from "@/components/store/Icons";
import { CouponBox } from "../cart/CartView";
import { placeOrder, quote as fetchQuote, type CheckoutInput, type PlaceResult } from "./actions";
import { fetchCart } from "../actions";

type Addr = { id: string; name: string; phone: string; line1: string; line2: string; city: string; state: string; pincode: string; isDefault: boolean };
type RzpSuccess = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
declare global { interface Window { Razorpay?: new (o: object) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void } } }

export function CheckoutForm({ lines, quote, paymentsMode, customer, saved, cod, prepaidPercent, delivery }: {
  lines: CartLine[]; quote: { online: Totals; cod: Totals }; paymentsMode: "live" | "test" | "mock" | "off";
  customer: { name: string; email: string; phone: string } | null; saved: Addr[];
  cod: { enabled: boolean; fee: number; max: number }; prepaidPercent: number; delivery: string;
}) {
  const router = useRouter();
  const { cart, setCart } = useCart();
  const [q, setQ] = useState(quote);
  const def = saved.find((a) => a.isDefault) ?? saved[0];
  const [addrId, setAddrId] = useState<string>(def?.id ?? "new");
  const onlineOk = paymentsMode !== "off";
  const [method, setMethod] = useState<"RAZORPAY" | "COD">(onlineOk ? "RAZORPAY" : "COD");
  const [form, setForm] = useState({
    email: customer?.email ?? "", phone: customer?.phone ?? "", name: customer?.name ?? "",
    line1: "", line2: "", city: "", state: "", pincode: "", note: "", saveAddress: true,
  });
  const [err, setErr] = useState<{ msg: string; field?: string } | null>(null);
  const [pending, start] = useTransition();
  const [mock, setMock] = useState<Extract<PlaceResult, { kind: "mock" }> | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [lastRzp, setLastRzp] = useState<Extract<PlaceResult, { kind: "razorpay" }> | null>(null);

  // Keep totals in sync when the coupon changes in the summary.
  useEffect(() => { fetchQuote(null).then((r) => r && setQ(r)); }, [cart.couponCode, cart.totals?.total]);

  const t = method === "COD" ? q.cod : q.online;
  const codAllowed = cod.enabled && q.cod.total <= cod.max;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));
  const chosen = useMemo(() => saved.find((a) => a.id === addrId), [saved, addrId]);

  async function verify(body: RzpSuccess) {
    setVerifying(true);
    const r = await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (j.ok) {
      setCart(await fetchCart());
      router.push(`/order/${j.number}?t=${j.token}`);
    } else {
      setVerifying(false);
      setErr({ msg: j.error || "We could not confirm the payment. If money was taken, it will be matched to your order automatically." });
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const a = chosen ?? form;
    const payload: CheckoutInput = {
      email: form.email, phone: chosen ? chosen.phone : form.phone, name: a.name, line1: a.line1, line2: a.line2,
      city: a.city, state: a.state, pincode: a.pincode, method, note: form.note, saveAddress: !chosen && form.saveAddress && !!customer,
    };
    if (method === "RAZORPAY" && lastRzp) { openRazorpay(lastRzp); return; }
    start(async () => {
      const r = await placeOrder(payload);
      if (!r.ok) {
        setErr({ msg: r.error, field: r.field });
        if (r.field) document.getElementById(`co-${r.field}`)?.focus();
        return;
      }
      if (r.kind === "done") { setCart(await fetchCart()); router.push(`/order/${r.number}?t=${r.token}`); return; }
      if (r.kind === "mock") { setMock(r); return; }
      setLastRzp(r);
      openRazorpay(r);
    });
  }

  function openRazorpay(r: Extract<PlaceResult, { kind: "razorpay" }>) {
      if (!window.Razorpay) { setErr({ msg: "The payment window did not load. Check your connection and try again." }); return; }
      const rzp = new window.Razorpay({
        key: r.key, order_id: r.rzpOrderId, amount: r.amount, currency: "INR", name: r.storeName,
        description: `Order ${r.number}`, prefill: { name: r.name, email: r.email, contact: r.phone },
        theme: { color: "#1C1714" }, handler: (resp: RzpSuccess) => verify(resp),
        modal: { ondismiss: () => setErr({ msg: `Payment was not completed. Your order ${r.number} is saved for 30 minutes. Press Pay again to retry.` }) },
      });
      rzp.on("payment.failed", () => setErr({ msg: "The payment failed. Try another method or card." }));
      rzp.open();
  }

  const fieldErr = (f: string) => (err?.field === f ? <div className="err">{err.msg}</div> : null);

  return (
    <>
      {paymentsMode !== "mock" && paymentsMode !== "off" && <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />}
      <form className="checkout" onSubmit={submit} noValidate>
        <div>
          <section className="panel">
            <h2 className="step-title"><i>1</i>Contact</h2>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="co-email">Email</label>
                <input id="co-email" className="input" type="email" autoComplete="email" value={form.email} onChange={set("email")} required />
                {fieldErr("email")}
              </div>
              {!chosen && (
                <div className="field">
                  <label htmlFor="co-phone">Mobile number</label>
                  <input id="co-phone" className="input" type="tel" inputMode="numeric" autoComplete="tel" value={form.phone} onChange={set("phone")} placeholder="10-digit mobile" required />
                  {fieldErr("phone")}
                </div>
              )}
            </div>
            {!customer && <p className="muted" style={{ fontSize: ".86rem", margin: "12px 0 0" }}>Have an account? <Link href="/account/login?next=/checkout">Sign in</Link> for saved addresses.</p>}
          </section>

          <section className="panel">
            <h2 className="step-title"><i>2</i>Delivery address</h2>
            {saved.length > 0 && (
              <div className="saved-addr" style={{ marginBottom: 14 }}>
                {saved.map((a) => (
                  <label key={a.id} className="pay-opt">
                    <input type="radio" name="addr" checked={addrId === a.id} onChange={() => setAddrId(a.id)} />
                    <span><b>{a.name}</b><small>{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode} · {a.phone}</small></span>
                    <span />
                  </label>
                ))}
                <label className="pay-opt">
                  <input type="radio" name="addr" checked={addrId === "new"} onChange={() => setAddrId("new")} />
                  <span><b>Use a new address</b></span><span />
                </label>
              </div>
            )}
            {!chosen && (
              <div className="form-grid">
                <div className="field full"><label htmlFor="co-name">Full name</label><input id="co-name" className="input" autoComplete="name" value={form.name} onChange={set("name")} required />{fieldErr("name")}</div>
                <div className="field full"><label htmlFor="co-line1">House number and street</label><input id="co-line1" className="input" autoComplete="address-line1" value={form.line1} onChange={set("line1")} required />{fieldErr("line1")}</div>
                <div className="field full"><label htmlFor="co-line2">Area, landmark <span className="muted">(optional)</span></label><input id="co-line2" className="input" autoComplete="address-line2" value={form.line2} onChange={set("line2")} /></div>
                <div className="field"><label htmlFor="co-pincode">Pincode</label><input id="co-pincode" className="input" inputMode="numeric" maxLength={6} autoComplete="postal-code" value={form.pincode} onChange={set("pincode")} required />{fieldErr("pincode")}</div>
                <div className="field"><label htmlFor="co-city">City</label><input id="co-city" className="input" autoComplete="address-level2" value={form.city} onChange={set("city")} required />{fieldErr("city")}</div>
                <div className="field full"><label htmlFor="co-state">State</label>
                  <select id="co-state" className="select" autoComplete="address-level1" value={form.state} onChange={set("state")} required>
                    <option value="">Choose state</option>{INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                  </select>{fieldErr("state")}
                </div>
                {customer && <label className="check full"><input type="checkbox" checked={form.saveAddress} onChange={set("saveAddress")} />Save this address to my account</label>}
              </div>
            )}
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="co-note">Delivery note <span className="muted">(optional)</span></label>
              <input id="co-note" className="input" value={form.note} onChange={set("note")} maxLength={500} placeholder="e.g. Call before delivery" />
            </div>
          </section>

          <section className="panel">
            <h2 className="step-title"><i>3</i>Payment</h2>
            <div className="pay-opts" role="radiogroup" aria-label="Payment method">
              <label className="pay-opt" aria-disabled={!onlineOk} style={!onlineOk ? { opacity: .5 } : undefined}>
                <input type="radio" name="method" checked={method === "RAZORPAY"} disabled={!onlineOk} onChange={() => setMethod("RAZORPAY")} />
                <span><b>Pay online</b><small>{onlineOk ? "UPI, cards, netbanking and wallets via Razorpay" : "Not available right now"}{prepaidPercent > 0 ? ` · extra ${prepaidPercent}% off` : ""}</small></span>
                <span className="tnum">{inr(q.online.total)}</span>
              </label>
              {cod.enabled && (
                <label className="pay-opt" style={!codAllowed ? { opacity: .5 } : undefined}>
                  <input type="radio" name="method" checked={method === "COD"} disabled={!codAllowed} onChange={() => setMethod("COD")} />
                  <span><b>Cash on delivery</b><small>{codAllowed ? `${inr(cod.fee)} handling fee` : `Available on orders up to ${inr(cod.max)}`}</small></span>
                  <span className="tnum">{inr(q.cod.total)}</span>
                </label>
              )}
            </div>
            {paymentsMode === "mock" && method === "RAZORPAY" && <div className="alert info" style={{ marginTop: 12 }}>Test mode: no Razorpay keys are set, so online payment is simulated.</div>}
          </section>
        </div>

        <aside className="summary" aria-label="Order summary">
          <h2>Order summary</h2>
          <div className="mini-lines">
            {lines.filter((l) => l.available).map((l) => (
              <div className="mini-line" key={l.id}>
                <div className="thumb">{l.image && <Image src={l.image} alt="" width={56} height={56} />}<span className="q">{l.qty}</span></div>
                <div><b>{l.name}</b><div className="muted" style={{ fontSize: ".82rem" }}>Size {l.size}</div></div>
                <div className="tnum">{inr(l.price * l.qty)}</div>
              </div>
            ))}
          </div>
          <CouponBox />
          <div className="sum-row"><span>Subtotal</span><span>{inr(t.subtotal)}</span></div>
          {t.couponDiscount > 0 && <div className="sum-row disc"><span>Code {t.couponCode}</span><span>−{inr(t.couponDiscount)}</span></div>}
          {t.prepaidDiscount > 0 && <div className="sum-row disc"><span>Online payment discount</span><span>−{inr(t.prepaidDiscount)}</span></div>}
          <div className="sum-row"><span>Shipping</span><span>{t.shipping ? inr(t.shipping) : "Free"}</span></div>
          {t.codFee > 0 && <div className="sum-row"><span>Cash on delivery fee</span><span>{inr(t.codFee)}</span></div>}
          <div className="sum-row total"><span>Total</span><span>{inr(t.total)}</span></div>
          <div className="muted" style={{ fontSize: ".8rem" }}>Includes GST of {inr(t.tax)} · Delivery in {delivery}</div>
          {err && !err.field && <div className="alert bad" role="alert">{err.msg}</div>}
          <button className="btn solid" type="submit" disabled={pending || verifying} style={{ minHeight: 52 }}>
            {pending || verifying ? <><span className="spinner" /> {verifying ? "Confirming payment…" : "Placing order…"}</> : method === "COD" ? `Place order · ${inr(t.total)}` : `Pay ${inr(t.total)}`}
          </button>
          <div className="secure"><LockIcon /> {method === "COD" ? "Pay in cash when the belt arrives" : "Secure payment by Razorpay"}</div>
          <p className="muted" style={{ fontSize: ".78rem", margin: 0 }}>By placing the order you agree to our <Link href="/pages/terms">terms</Link> and <Link href="/pages/returns">exchange policy</Link>.</p>
        </aside>
      </form>

      {mock && (
        <div className="scrim on" style={{ display: "grid", placeItems: "center", padding: 16 }}>
          <div className="panel" role="dialog" aria-modal="true" aria-labelledby="mock-t" style={{ maxWidth: 420, width: "100%", display: "grid", gap: 14 }}>
            <h2 id="mock-t" style={{ margin: 0 }}>Test payment</h2>
            <p className="muted" style={{ margin: 0 }}>Order {mock.number} · {inr(mock.amount)}. This window only appears when Razorpay keys are not set.</p>
            <button className="btn solid" onClick={() => { const id = mock.rzpOrderId; setMock(null); verify({ razorpay_order_id: id, razorpay_payment_id: `mock_pay_${Date.now()}`, razorpay_signature: "mock" }); }}>Simulate successful payment</button>
            <button className="btn" onClick={() => { setMock(null); setErr({ msg: `Payment was not completed. Your order ${mock.number} is saved for 30 minutes.` }); }}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}
