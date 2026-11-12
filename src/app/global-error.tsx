"use client";
// Last-resort page when the root layout itself fails. Keeps the message visible instead of a blank error screen.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#F6F3EE", color: "#1C1714", fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 10px" }}>Something went wrong</h1>
          <p style={{ lineHeight: 1.5, margin: "0 0 16px" }}>Please reload the page. If you are using browser translation, switch it off for this site and try again.</p>
          {error.digest && <p style={{ fontSize: 13, opacity: 0.7, margin: "0 0 16px" }}>Reference: {error.digest}</p>}
          <button onClick={() => reset()} style={{ padding: "10px 18px", background: "#1C1714", color: "#fff", border: 0, borderRadius: 4, cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
