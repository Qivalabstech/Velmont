"use client";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { resumeCashfree } from "./actions";
import { openCashfree } from "@/lib/cashfree-client";

export function PayAgain({ number, token, label }: { number: string; token: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    setBusy(true); setErr("");
    const r = await resumeCashfree(number, token);
    if (!r.ok) { setErr(r.error); setBusy(false); return; }
    if ("paid" in r) { router.refresh(); return; }
    try { await openCashfree(r.sessionId, r.mode); }
    catch (e) { setErr(e instanceof Error ? e.message : "Payment did not start."); setBusy(false); }
  }
  return (
    <>
      <Script src="https://sdk.cashfree.com/js/v3/cashfree.js" strategy="afterInteractive" />
      <button className="btn solid" type="button" onClick={go} disabled={busy} style={{ minHeight: 52 }}>
        {busy ? <><span className="spinner" /> Opening payment…</> : label}
      </button>
      {err && <div className="alert bad" role="alert">{err}</div>}
    </>
  );
}
