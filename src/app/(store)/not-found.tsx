import Link from "next/link";
export default function NotFound() {
  return (
    <div className="wrap" style={{ paddingBlock: "80px 120px", display: "grid", gap: 18, justifyItems: "start" }}>
      <div className="eyebrow mono">Error 404</div>
      <h1 className="display" style={{ fontSize: "clamp(3rem,10vw,7rem)" }}>Page not found</h1>
      <p className="muted" style={{ maxWidth: "48ch" }}>The page may have moved, or the link may be wrong. Try the shop or search for a belt.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><Link className="btn solid" href="/shop">Shop belts</Link><Link className="btn" href="/">Home</Link></div>
    </div>
  );
}
