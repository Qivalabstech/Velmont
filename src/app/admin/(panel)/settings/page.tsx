import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { paymentsMode } from "@/lib/razorpay";
import { emailConfigured } from "@/lib/email";
import { SITE_URL } from "@/lib/env";
import { INDIAN_STATES } from "@/lib/utils";
import { PageHead, Card, Pill } from "@/components/admin/ui";
import { AForm, Submit } from "@/components/admin/Form";
import { saveStore, saveShipping, savePayments, testRazorpay, saveNotifications, saveYoupi, testYoupi, savePaymentGeneral, saveCashfree, testCashfree, savePayu, testPayu, saveShiprocket, testShiprocket } from "./actions";
import { shiprocketMissing } from "@/lib/shiprocket";
import { onlineGateway } from "@/lib/online";
import { cashfreeMode } from "@/lib/cashfree";
import { payuMode } from "@/lib/payu";
import { youpiConfig, youpiMissing } from "@/lib/youpi";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireStaff("settings.manage");
  const tab = (await searchParams).tab || "store";
  const s = await getSettings();
  const mode = await paymentsMode();
  const envKeys = !!process.env.RAZORPAY_KEY_ID;
  const [gw, cfMode, puMode] = await Promise.all([onlineGateway(), cashfreeMode(), payuMode()]);
  const puEnv = !!(process.env.PAYU_KEY || process.env.PAYU_SALT);
  const cfEnv = !!(process.env.CASHFREE_APP_ID || process.env.CASHFREE_SECRET_KEY);
  const yp = await youpiConfig();
  const ypMissing = youpiMissing(yp);
  const ypEnv = !!(process.env.YOUPI_API_URL || process.env.YOUPI_MERCHANT_API_KEY);
  const siteOrigin = new URL(SITE_URL).origin;
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

      {tab === "shipping" && (<div className="stack">
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
        <Card title="Shiprocket" sub={<>Status: <Pill tone={s.shiprocket.enabled && !shiprocketMissing(s.shiprocket).length ? "good" : s.shiprocket.enabled ? "warn" : "neutral"}>{s.shiprocket.enabled && !shiprocketMissing(s.shiprocket).length ? (s.shiprocket.autoAssign ? "Automatic: shipment, courier, pickup, tracking" : "Automatic: shipment and tracking") : s.shiprocket.enabled ? `Needs ${shiprocketMissing(s.shiprocket).join(", ")}` : "Off"}</Pill></>}>
          <p className="hint-box" style={{ marginTop: 0 }}>When an order is placed (paid online, or COD), it is sent to Shiprocket. With auto-booking on, the courier Shiprocket recommends is booked, pickup is scheduled, the label is created and the customer gets the tracking number. Courier updates then move the order to Shipped, Out for delivery and Delivered, with an email each time.</p>
          {(process.env.SHIPROCKET_EMAIL || process.env.SHIPROCKET_PASSWORD) && <p className="hint-box">The Shiprocket login is set as server environment variables, which override the values below.</p>}
          <AForm action={saveShiprocket} className="fgrid">
            <label className="check full"><input type="checkbox" name="srEnabled" defaultChecked={s.shiprocket.enabled} />Use Shiprocket for shipping</label>
            <div className="field"><label htmlFor="sr-e">API user email</label><input id="sr-e" name="srEmail" type="email" className="input" defaultValue={s.shiprocket.email} autoComplete="off" /><span className="hint">Shiprocket → Settings → API → Configure → Create API user. Not your normal login.</span></div>
            <div className="field"><label htmlFor="sr-p">API user password <span className="muted">({s.shiprocket.password ? "saved" : "not set"})</span></label><input id="sr-p" name="srPassword" type="password" className="input" placeholder="Leave blank to keep" autoComplete="new-password" /></div>
            <div className="field full"><label htmlFor="sr-l">Pickup location name</label><input id="sr-l" name="srPickup" className="input" defaultValue={s.shiprocket.pickupLocation} placeholder="Primary" /><span className="hint">Exactly as written in Shiprocket → Settings → Pickup Addresses (the nickname, e.g. “Primary”).</span></div>
            <label className="check full"><input type="checkbox" name="srAutoCreate" defaultChecked={s.shiprocket.autoCreate} />Send every placed order to Shiprocket automatically</label>
            <label className="check full"><input type="checkbox" name="srAutoAssign" defaultChecked={s.shiprocket.autoAssign} />Also book the recommended courier, schedule pickup and create the label <span className="muted">(uses your Shiprocket wallet)</span></label>
            <div className="field"><label htmlFor="sr-w">Weight per belt, packed (kg)</label><input id="sr-w" name="srWeight" type="number" step="0.01" className="input" defaultValue={s.shiprocket.weightPerItemKg} /></div>
            <div className="field"><label>Box size L × B × H (cm)</label><div style={{ display: "flex", gap: 6 }}><input aria-label="Length cm" name="srL" type="number" className="input" defaultValue={s.shiprocket.lengthCm} /><input aria-label="Breadth cm" name="srB" type="number" className="input" defaultValue={s.shiprocket.breadthCm} /><input aria-label="Height cm" name="srH" type="number" className="input" defaultValue={s.shiprocket.heightCm} /></div><span className="hint">Courier charges use the larger of real and volumetric weight, so keep these accurate.</span></div>
            <label className="check full"><input type="checkbox" name="srNewToken" />Make a new webhook token</label>
            <div><Submit>Save Shiprocket settings</Submit></div>
          </AForm>
          <AForm action={testShiprocket} style={{ marginTop: 12 }}><Submit className="btn sm" pendingText="Checking…">Test connection</Submit></AForm>
          <ol style={{ margin: "16px 0 0", paddingLeft: 18, display: "grid", gap: 6, fontSize: ".9rem" }}>
            <li>Shiprocket → Settings → API → Webhooks: URL <code>{SITE_URL}/api/logistics/tracking</code>, token <code style={{ wordBreak: "break-all" }}>{s.shiprocket.webhookToken || "save once to create it"}</code>, then switch it on.</li>
            <li>Keep money in your Shiprocket wallet so couriers can be booked. If booking fails, the order shows the reason and you can retry from the order page.</li>
            <li>Tracking is also refreshed once a day and whenever you open an order, in case a webhook is missed.</li>
          </ol>
        </Card>
      </div>)}

      {tab === "payments" && (
        <div className="stack">
          <Card title="Online payments" sub={<>“Pay online” uses: <Pill tone={gw.provider === "off" ? "bad" : gw.provider === "mock" ? "warn" : "good"}>{gw.provider === "payu" ? `PayU (${gw.mode === "test" ? "test mode" : "live"})` : gw.provider === "cashfree" ? `Cashfree (${gw.mode === "sandbox" ? "test mode" : "live"})` : gw.provider === "razorpay" ? `Razorpay (${gw.mode === "test" ? "test mode" : "live"})` : gw.provider === "mock" ? "Simulated (development)" : "Not set up"}</Pill></>}>
            <AForm action={savePaymentGeneral} className="fgrid">
              <div className="field full"><label htmlFor="pg-g">Gateway for “Pay online”</label>
                <select id="pg-g" name="onlineGateway" className="select" defaultValue={s.payments.onlineGateway}>
                  <option value="auto">Automatic: PayU when its keys are set, then Cashfree, then Razorpay</option>
                  <option value="payu">PayU only</option>
                  <option value="cashfree">Cashfree only</option>
                  <option value="razorpay">Razorpay only</option>
                </select></div>
              <div className="field"><label htmlFor="rz-d">Extra discount for paying online (%)</label><input id="rz-d" name="prepaidDiscountPercent" type="number" min={0} max={50} className="input" defaultValue={s.payments.prepaidDiscountPercent} /><span className="hint">Encourages prepaid orders over COD. 0 turns it off.</span></div>
              <div className="field"><label htmlFor="rz-m">Hold stock for unpaid orders (minutes)</label><input id="rz-m" name="pendingPaymentMinutes" type="number" min={16} max={1440} className="input" defaultValue={s.payments.pendingPaymentMinutes} /><span className="hint">Unpaid online orders are cancelled and their stock released after this time (at least 16 minutes).</span></div>
              <div><Submit>Save</Submit></div>
            </AForm>
          </Card>
          <Card title="PayU" sub={<>Status: <Pill tone={puMode === "production" ? "good" : puMode === "test" ? "info" : "neutral"}>{puMode === "production" ? "Live keys" : puMode === "test" ? "Test mode" : "Not set up"}</Pill></>}>
            {puEnv && <p className="hint-box" style={{ marginTop: 0 }}>PayU keys are set as server environment variables, which override the values below.</p>}
            <AForm action={savePayu} className="fgrid">
              <div className="field"><label htmlFor="pu-k">Merchant Key</label><input id="pu-k" name="payuKey" className="input" defaultValue={s.payments.payuKey} autoComplete="off" /></div>
              <div className="field"><label htmlFor="pu-s">Merchant Salt (version 2) <span className="muted">({mask(s.payments.payuSalt)})</span></label><input id="pu-s" name="payuSalt" type="password" className="input" placeholder="Leave blank to keep" autoComplete="new-password" /></div>
              <div className="field"><label htmlFor="pu-e">Environment</label>
                <select id="pu-e" name="payuEnv" className="select" defaultValue={s.payments.payuEnv}>
                  <option value="production">Live (real payments)</option>
                  <option value="test">Test (no real money)</option>
                </select></div>
              <label className="check full"><input type="checkbox" name="clearPayu" />Remove saved PayU keys</label>
              <div><Submit>Save PayU settings</Submit></div>
            </AForm>
            <AForm action={testPayu} style={{ marginTop: 12 }}><Submit className="btn sm" pendingText="Checking…">Test PayU connection</Submit></AForm>
            <ol style={{ margin: "16px 0 0", paddingLeft: 18, display: "grid", gap: 6, fontSize: ".9rem" }}>
              <li>PayU Dashboard → Developers → API Keys: copy the Merchant Key and the Salt (version 2). Test keys for test mode, live keys after your account is activated.</li>
              <li>Developers → Webhooks: add <code>{SITE_URL}/api/payments/payu/webhook</code> for successful and failed payments.</li>
              <li>Make sure your website <code>{siteOrigin}</code> is the approved website on your PayU account, or PayU will refuse the payment.</li>
              <li>Place a ₹1 order, check it shows as paid here, then refund it from the order page.</li>
            </ol>
          </Card>
          <Card title="Cashfree Payments" sub={<>Status: <Pill tone={cfMode === "production" ? "good" : cfMode === "sandbox" ? "info" : "neutral"}>{cfMode === "production" ? "Live keys" : cfMode === "sandbox" ? "Test mode (sandbox)" : "Not set up"}</Pill></>}>
            {cfEnv && <p className="hint-box" style={{ marginTop: 0 }}>Cashfree keys are set as server environment variables, which override the values below.</p>}
            <AForm action={saveCashfree} className="fgrid">
              <div className="field"><label htmlFor="cf-a">App ID (Client ID)</label><input id="cf-a" name="cashfreeAppId" className="input" defaultValue={s.payments.cashfreeAppId} autoComplete="off" /></div>
              <div className="field"><label htmlFor="cf-s">Secret Key <span className="muted">({mask(s.payments.cashfreeSecretKey)})</span></label><input id="cf-s" name="cashfreeSecretKey" type="password" className="input" placeholder="Leave blank to keep" autoComplete="new-password" /></div>
              <div className="field"><label htmlFor="cf-e">Environment</label>
                <select id="cf-e" name="cashfreeEnv" className="select" defaultValue={s.payments.cashfreeEnv}>
                  <option value="production">Production (real money)</option>
                  <option value="sandbox">Test / sandbox</option>
                </select></div>
              <label className="check full"><input type="checkbox" name="clearCashfree" />Remove saved Cashfree keys</label>
              <div><Submit>Save Cashfree settings</Submit></div>
            </AForm>
            <AForm action={testCashfree} style={{ marginTop: 12 }}><Submit className="btn sm" pendingText="Checking…">Test connection</Submit></AForm>
            <ol style={{ margin: "16px 0 0", paddingLeft: 18, display: "grid", gap: 6, fontSize: ".9rem" }}>
              <li>Cashfree Dashboard → Developers → API Keys: copy the App ID and Secret Key (test keys for sandbox, production keys after your account is activated).</li>
              <li>Developers → Webhooks: add <code>{SITE_URL}/api/payments/cashfree/webhook</code> for Payment events. The Secret Key above also checks webhook signatures.</li>
              <li>Developers → Whitelisting: add your domain <code>{siteOrigin}</code> (Cashfree only opens checkout on approved domains).</li>
              <li>Place a ₹1 order, check it shows as paid here, then refund it from the order page.</li>
            </ol>
          </Card>
          <Card title="Razorpay" sub={<>Status: <Pill tone={mode === "live" ? "good" : mode === "test" ? "info" : mode === "mock" ? "warn" : "bad"}>{mode === "live" ? "Live payments" : mode === "test" ? "Test mode" : mode === "mock" ? "Simulated (development)" : "Not set up"}</Pill></>}>
            {envKeys && <p className="hint-box" style={{ marginTop: 0 }}>Keys are set in the server’s .env file, which overrides the values below.</p>}
            <AForm action={savePayments} className="fgrid">
              <div className="field full"><label htmlFor="rz-k">Key ID</label><input id="rz-k" name="razorpayKeyId" className="input" defaultValue={s.payments.razorpayKeyId} placeholder="rzp_live_…" autoComplete="off" /></div>
              <div className="field"><label htmlFor="rz-s">Key secret <span className="muted">({mask(s.payments.razorpayKeySecret)})</span></label><input id="rz-s" name="razorpayKeySecret" type="password" className="input" placeholder="Leave blank to keep" autoComplete="new-password" /></div>
              <div className="field"><label htmlFor="rz-w">Webhook secret <span className="muted">({mask(s.payments.razorpayWebhookSecret)})</span></label><input id="rz-w" name="razorpayWebhookSecret" type="password" className="input" placeholder="Leave blank to keep" autoComplete="new-password" /></div>
              <label className="check full"><input type="checkbox" name="clearKeys" />Remove saved keys</label>
              <div><Submit>Save Razorpay settings</Submit></div>
            </AForm>
            <AForm action={testRazorpay} style={{ marginTop: 12 }}><Submit className="btn sm" pendingText="Checking…">Test connection</Submit></AForm>
          </Card>
          <Card title="UPI direct to bank (YouPI)" sub={<>Status: <Pill tone={yp.enabled && !ypMissing.length ? "good" : yp.enabled ? "warn" : "neutral"}>{yp.enabled && !ypMissing.length ? "Offered at checkout" : yp.enabled ? `Needs ${ypMissing.join(", ")}` : "Off"}</Pill></>}>
            <p className="hint-box" style={{ marginTop: 0 }}>Customers pay by UPI straight into your bank account through your own YouPI gateway server, with no gateway fee. YouPI is an experimental open-source project: keep amounts and volumes small, and always check your bank app before shipping. Bank alerts are not proof of payment on their own.</p>
            {ypEnv && <p className="hint-box">Some YouPI values are set as server environment variables, which override the values below.</p>}
            <AForm action={saveYoupi} className="fgrid">
              <label className="check full"><input type="checkbox" name="youpiEnabled" defaultChecked={yp.enabled} />Offer UPI at checkout</label>
              <div className="field full"><label htmlFor="yp-u">Gateway address</label><input id="yp-u" name="youpiApiUrl" className="input" defaultValue={yp.apiUrl} placeholder="https://pay.velmont.in" autoComplete="off" /><span className="hint">The public address of your YouPI server (its payment API / checkout portal).</span></div>
              <div className="field"><label htmlFor="yp-m">Merchant ID</label><input id="yp-m" name="youpiMerchantId" className="input" defaultValue={yp.merchantId} autoComplete="off" /></div>
              <div className="field"><label htmlFor="yp-k">Merchant API key <span className="muted">({mask(yp.apiKey)})</span></label><input id="yp-k" name="youpiApiKey" type="password" className="input" placeholder="Leave blank to keep" autoComplete="new-password" /></div>
              <div className="field"><label htmlFor="yp-w">Webhook secret <span className="muted">({mask(yp.webhookSecret)})</span></label><input id="yp-w" name="youpiWebhookSecret" type="password" className="input" placeholder="Leave blank to keep" autoComplete="new-password" /></div>
              <div className="field"><label htmlFor="yp-mode">How payments are matched</label>
                <select id="yp-mode" name="youpiMode" className="select" defaultValue={yp.mode}>
                  <option value="auto">Bank alerts (falls back to UTR when alerts are offline)</option>
                  <option value="manual">Customer types the UTR</option>
                </select></div>
              <label className="check full"><input type="checkbox" name="youpiTrustBankAlerts" defaultChecked={yp.trustBankAlerts} />Confirm orders on a bank alert alone, without me checking the bank <span className="muted">(not recommended: alerts can be late, duplicated or spoofed)</span></label>
              <label className="check full"><input type="checkbox" name="clearYoupi" />Remove saved YouPI details</label>
              <div><Submit>Save UPI settings</Submit></div>
            </AForm>
            <AForm action={testYoupi} style={{ marginTop: 12 }}><Submit className="btn sm" pendingText="Checking…">Test connection</Submit></AForm>
            <ol style={{ margin: "16px 0 0", paddingLeft: 18, display: "grid", gap: 6, fontSize: ".9rem" }}>
              <li>On the YouPI server set <code>YOUPI_ALLOWED_RETURN_ORIGINS={siteOrigin}</code> so customers can come back to your store after paying.</li>
              <li>In YouPI Merchant Admin set the webhook URL to <code>{SITE_URL}/api/payments/youpi</code> and copy its webhook secret above.</li>
              <li>Add an active UPI receiving account (a business/current account is safest) and connect a bank-alert observer if you use “Bank alerts”.</li>
              <li>Orders paid this way wait under <Link href="/admin/orders?tab=verify">Orders → UPI to verify</Link> until you confirm the money in your bank app.</li>
            </ol>
          </Card>
          <Card title="Razorpay webhook setup">
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
