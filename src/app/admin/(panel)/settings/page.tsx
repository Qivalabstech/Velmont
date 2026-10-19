import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { paymentsMode } from "@/lib/razorpay";
import { emailConfigured } from "@/lib/email";
import { SITE_URL } from "@/lib/env";
import { INDIAN_STATES } from "@/lib/utils";
import { PageHead, Card, Pill } from "@/components/admin/ui";
import { AForm, Submit } from "@/components/admin/Form";
import { saveStore, saveShipping, savePayments, testRazorpay, saveNotifications } from "./actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireStaff("settings.manage");
  const tab = (await searchParams).tab || "store";
  const s = await getSettings();
  const mode = await paymentsMode();
  const envKeys = !!process.env.RAZORPAY_KEY_ID;
  const mask = (v: string) => (v ? `${v.slice(0, 4)}••••••${v.slice(-4)}` : "Not set");
  return (
    <div style={{ maxWidth: 980 }}>
      <PageHead title="Settings" />
      <nav className="tabs">{[["store", "Store & GST"], ["shipping", "Shipping & COD"], ["payments", "Payments"], ["notifications", "Notifications & email"]].map(([k, l]) => <Link key={k} href={`/admin/settings?tab=${k}`} aria-current={tab === k ? "page" : undefined}>{l}</Link>)}</nav>

      {tab === "store" && (
        <AForm action={saveStore} className="stack">
          <Card title="Store">
            <div className="fgrid">
              <div className="field"><label htmlFor="st-n">Store name</label><input id="st-n" name="name" className="input" defaultValue={s.store.name} /></div>
              <div className="field"><label htmlFor="st-l">Legal business name</label><input id="st-l" name="legalName" className="input" defaultValue={s.store.legalName} /></div>
              <div className="field full"><label htmlFor="st-t">Tagline</label><input id="st-t" name="tagline" className="input" defaultValue={s.store.tagline} /></div>
              <div className="field"><label htmlFor="st-e">Customer support email</label><input id="st-e" name="email" className="input" defaultValue={s.store.email} /></div>
              <div className="field"><label htmlFor="st-p">Phone</label><input id="st-p" name="phone" className="input" defaultValue={s.store.phone} /></div>
              <div className="field"><label htmlFor="st-w">WhatsApp</label><input id="st-w" name="whatsapp" className="input" defaultValue={s.store.whatsapp} /></div>
              <div className="field"><label htmlFor="st-i">Instagram handle</label><input id="st-i" name="instagram" className="input" defaultValue={s.store.instagram} /></div>
              <div className="field full"><label htmlFor="st-a">Business address</label><input id="st-a" name="address" className="input" defaultValue={s.store.address} /></div>
              <div className="field"><label htmlFor="st-s">State (for GST)</label><select id="st-s" name="state" className="select" defaultValue={s.store.state}>{INDIAN_STATES.map((x) => <option key={x}>{x}</option>)}</select></div>
              <div className="field"><label htmlFor="st-h">Support hours</label><input id="st-h" name="supportHours" className="input" defaultValue={s.store.supportHours} /></div>
            </div>
          </Card>
          <Card title="GST and invoices" sub="Invoices split CGST + SGST for buyers in your state and IGST for other states.">
            <div className="fgrid three">
              <div className="field"><label htmlFor="st-g">GSTIN</label><input id="st-g" name="gstin" className="input" defaultValue={s.store.gstin} placeholder="Leave blank if not registered" /></div>
              <div className="field"><label htmlFor="st-r">Default GST rate %</label><input id="st-r" name="defaultGstRate" type="number" className="input" defaultValue={s.tax.defaultGstRate} /></div>
              <div className="field"><label htmlFor="st-x">Invoice number prefix</label><input id="st-x" name="invoicePrefix" className="input" defaultValue={s.tax.invoicePrefix} /></div>
            </div>
            <p className="hint-box" style={{ marginTop: 12 }}>Confirm the right GST rate for leather belts (HSN 4203) with your accountant. You can also set a rate per product.</p>
          </Card>
          <div className="savebar"><Submit>Save store details</Submit></div>
        </AForm>
      )}

      {tab === "shipping" && (
        <AForm action={saveShipping} className="stack">
          <Card title="Shipping charges">
            <div className="fgrid">
              <div className="field"><label htmlFor="sh-f">Free shipping on orders above (₹)</label><input id="sh-f" name="freeAbove" type="number" className="input" defaultValue={s.shipping.freeAbove / 100} /><span className="hint">0 means every order ships free.</span></div>
              <div className="field"><label htmlFor="sh-r">Shipping fee below that (₹)</label><input id="sh-r" name="flatRate" type="number" className="input" defaultValue={s.shipping.flatRate / 100} /></div>
              <div className="field"><label htmlFor="sh-d">Dispatch time</label><input id="sh-d" name="dispatchDays" className="input" defaultValue={s.shipping.dispatchDays} /></div>
              <div className="field"><label htmlFor="sh-v">Delivery time</label><input id="sh-v" name="deliveryDays" className="input" defaultValue={s.shipping.deliveryDays} /></div>
              <div className="field"><label htmlFor="sh-x">Exchange window (days)</label><input id="sh-x" name="exchangeDays" type="number" className="input" defaultValue={s.shipping.exchangeDays} /></div>
            </div>
          </Card>
          <Card title="Cash on delivery">
            <div className="fgrid three">
              <label className="check full"><input type="checkbox" name="codEnabled" defaultChecked={s.shipping.codEnabled} />Offer cash on delivery</label>
              <div className="field"><label htmlFor="cod-f">COD handling fee (₹)</label><input id="cod-f" name="codFee" type="number" className="input" defaultValue={s.shipping.codFee / 100} /></div>
              <div className="field"><label htmlFor="cod-m">COD up to order value (₹)</label><input id="cod-m" name="codMaxOrder" type="number" className="input" defaultValue={s.shipping.codMaxOrder / 100} /></div>
            </div>
          </Card>
          <Card title="Stock alerts">
            <div className="field" style={{ maxWidth: 260 }}><label htmlFor="ls">Warn when a size has this many or fewer</label><input id="ls" name="lowStockThreshold" type="number" className="input" defaultValue={s.inventory.lowStockThreshold} /></div>
          </Card>
          <div className="savebar"><Submit>Save shipping</Submit></div>
        </AForm>
      )}

      {tab === "payments" && (
        <div className="stack">
          <Card title="Razorpay" sub={<>Status: <Pill tone={mode === "live" ? "good" : mode === "test" ? "info" : mode === "mock" ? "warn" : "bad"}>{mode === "live" ? "Live payments" : mode === "test" ? "Test mode" : mode === "mock" ? "Simulated (development)" : "Not set up"}</Pill></>}>
            {envKeys && <p className="hint-box" style={{ marginTop: 0 }}>Keys are set in the server’s .env file, which overrides the values below.</p>}
            <AForm action={savePayments} className="fgrid">
              <div className="field full"><label htmlFor="rz-k">Key ID</label><input id="rz-k" name="razorpayKeyId" className="input" defaultValue={s.payments.razorpayKeyId} placeholder="rzp_live_…" autoComplete="off" /></div>
              <div className="field"><label htmlFor="rz-s">Key secret <span className="muted">({mask(s.payments.razorpayKeySecret)})</span></label><input id="rz-s" name="razorpayKeySecret" type="password" className="input" placeholder="Leave blank to keep" autoComplete="new-password" /></div>
              <div className="field"><label htmlFor="rz-w">Webhook secret <span className="muted">({mask(s.payments.razorpayWebhookSecret)})</span></label><input id="rz-w" name="razorpayWebhookSecret" type="password" className="input" placeholder="Leave blank to keep" autoComplete="new-password" /></div>
              <div className="field"><label htmlFor="rz-d">Extra discount for paying online (%)</label><input id="rz-d" name="prepaidDiscountPercent" type="number" min={0} max={50} className="input" defaultValue={s.payments.prepaidDiscountPercent} /><span className="hint">Encourages prepaid orders over COD. 0 turns it off.</span></div>
              <div className="field"><label htmlFor="rz-m">Hold stock for unpaid orders (minutes)</label><input id="rz-m" name="pendingPaymentMinutes" type="number" min={10} className="input" defaultValue={s.payments.pendingPaymentMinutes} /></div>
              <label className="check full"><input type="checkbox" name="clearKeys" />Remove saved keys</label>
              <div><Submit>Save payment settings</Submit></div>
            </AForm>
            <AForm action={testRazorpay} style={{ marginTop: 12 }}><Submit className="btn sm" pendingText="Checking…">Test connection</Submit></AForm>
          </Card>
          <Card title="Webhook setup">
            <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: ".9rem" }}>
              <li>In the Razorpay Dashboard open Accounts &amp; Settings → Webhooks → Add new webhook.</li>
              <li>Webhook URL: <code>{SITE_URL}/api/payments/webhook</code></li>
              <li>Choose a secret, tick <code>payment.captured</code>, <code>order.paid</code> and <code>payment.failed</code>, then save.</li>
              <li>Paste the same secret in “Webhook secret” above. This catches payments even if the shopper closes the browser early.</li>
            </ol>
          </Card>
        </div>
      )}

      {tab === "notifications" && (
        <div className="stack">
          <Card title="New order alerts">
            <AForm action={saveNotifications} className="fgrid">
              <div className="field"><label htmlFor="nt-e">Email me each new order at</label><input id="nt-e" name="orderAlertEmail" className="input" defaultValue={s.notifications.orderAlertEmail} placeholder="orders@yourdomain.in" /></div>
              <div style={{ alignSelf: "end" }}><Submit>Save</Submit></div>
            </AForm>
          </Card>
          <Card title="Outgoing email" sub={<>Status: <Pill tone={emailConfigured() ? "good" : "warn"}>{emailConfigured() ? `Connected to ${process.env.SMTP_HOST}` : "Not set up"}</Pill></>}>
            <p style={{ margin: 0, fontSize: ".9rem" }}>Order confirmations, shipping updates, password resets and staff invites go through SMTP. Set <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code> and <code>MAIL_FROM</code> in the server’s .env file (Zoho Mail, Google Workspace, Brevo and Amazon SES all work), then restart. See every email sent under <Link href="/admin/activity?tab=emails">Activity log → Emails</Link>.</p>
          </Card>
        </div>
      )}
    </div>
  );
}
