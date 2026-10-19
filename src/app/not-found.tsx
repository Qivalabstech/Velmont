import Link from "next/link";
import "@/styles/store.css";
export default function NotFound() {
  return (
    <div className="wrap" style={{ paddingBlock: "80px 120px", display: "grid", gap: 18, justifyItems: "start" }}>
      <div className="eyebrow mono">Error 404</div>
      <h1 className="display" style={{ fontSize: "clamp(3rem,10vw,7rem)" }}>Page not found</h1>
      <div style={{ display: "flex", gap: 12 }}><Link className="btn solid" href="/shop">Shop belts</Link><Link className="btn" href="/">Home</Link></div>
    </div>
  );
}
