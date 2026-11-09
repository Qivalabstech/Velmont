"use client";
// Browser side of Cashfree checkout. Needs <Script src="https://sdk.cashfree.com/js/v3/cashfree.js" /> on the page.
type CashfreeSDK = { checkout: (o: { paymentSessionId: string; redirectTarget?: "_self" | "_blank" | "_top" | "_modal" }) => Promise<{ error?: { message?: string } } | undefined> };
declare global { interface Window { Cashfree?: (o: { mode: "production" | "sandbox" }) => CashfreeSDK } }

/** Opens Cashfree's hosted checkout in the same tab. Cashfree sends the customer back to our return URL. */
export async function openCashfree(sessionId: string, mode: "production" | "sandbox") {
  for (let i = 0; i < 40 && !window.Cashfree; i++) await new Promise((r) => setTimeout(r, 150));
  if (!window.Cashfree) throw new Error("The payment window did not load. Check your connection and try again.");
  const r = await window.Cashfree({ mode }).checkout({ paymentSessionId: sessionId, redirectTarget: "_self" });
  if (r?.error) throw new Error(r.error.message || "The payment could not be started.");
}
