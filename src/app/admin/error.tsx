"use client";
// Shown instead of Next's blank "Application error" screen, with the actual message so the problem can be fixed.
import { useEffect } from "react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[admin]", error); }, [error]);
  return (
    <div translate="no" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#1C1714" }}>
      <div style={{ background: "#F6F3EE", color: "#1C1714", maxWidth: 520, width: "100%", padding: 28, borderRadius: 6, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>Something went wrong in the admin</h1>
        <p style={{ margin: "0 0 14px", lineHeight: 1.5 }}>
          Try again first. If your browser is translating this page (for example to Hindi), turn translation off for this site and reload. Browser extensions that change pages can also cause this.
        </p>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#EAE4DA", padding: 12, fontSize: 13, margin: "0 0 16px", borderRadius: 4 }}>
          {error.message || "Unknown error"}{error.digest ? `\nReference: ${error.digest}` : ""}
        </pre>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => reset()} style={{ padding: "10px 16px", background: "#1C1714", color: "#fff", border: 0, borderRadius: 4, cursor: "pointer" }}>Try again</button>
          <a href="/admin/login" style={{ padding: "10px 16px", border: "1px solid #1C1714", borderRadius: 4, color: "#1C1714", textDecoration: "none" }}>Back to sign in</a>
        </div>
      </div>
    </div>
  );
}
