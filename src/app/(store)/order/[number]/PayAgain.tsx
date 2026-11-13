"use client";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { resumeOnline } from "./actions";
import { openCashfree } from "@/lib/cashfree-client";
import { submitPayu } from "@/lib/payu-client";

export function PayAgain({ number, token, label, gateway }: { number: string; token: string; label: string; gateway: "payu" | "cashfree" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    setBusy(true); setErr("");
    const r = await resumeOnline(number, token);
    if (!r.ok) { setErr(r.error); setBusy(false); return; }
    if ("paid" in r) { router.refresh(); return; }
    if ("form" in r) { submitPayu(r.form); return; }
    try { await openCashfree(r.sessionId, r.mode); }
    catch (e) { setErr(e instanceof Error ? e.message : "Payment did not start."); setBusy(false); }
  }
  return (
    <>
      {gateway === "cashfree" && <Script src="https://sdk.cashfree.com/js/v3/cashfree.js" strategy="afterInteractive" />}
      <button className="btn solid" type="button" onClick={go} disabled={busy} style={{ minHeight: 52 }}>
        {busy ? <><span className="spinner" /> Opening payment…</> : label}
      </button>
      {err && <div className="alert bad" role="alert">{err}</div>}
    </>
  );
}
