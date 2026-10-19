"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** First-party visit counter for the admin dashboard. No cookies from third parties. */
export function Analytics() {
  const path = usePathname();
  useEffect(() => {
    const body = JSON.stringify({ path, ref: document.referrer || "" });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon("/api/t", new Blob([body], { type: "application/json" }));
      else fetch("/api/t", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
    } catch {}
  }, [path]);
  return null;
}
