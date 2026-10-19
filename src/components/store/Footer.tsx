"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { subscribe } from "@/app/(store)/actions";

export function Footer({ storeName, legalName, email, phone, address }: { storeName: string; legalName: string; email: string; phone: string; address: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <footer className="site-foot">
      <div className="wrap">
        <div className="ft">
          <div className="news">
            <h2>First look at<br />new carvings</h2>
            {msg ? <div className="msg">{msg}</div> : (
              <form onSubmit={(e) => {
                e.preventDefault();
                const v = String(new FormData(e.currentTarget).get("email") || "");
                start(async () => {
                  const r = await subscribe(v);
                  if (r.ok) { setMsg("You're on the list. New belts reach your inbox first."); setErr(null); } else setErr(r.error!);
                });
              }}>
                <label htmlFor="news-email" className="sr-only">Email address</label>
                <input id="news-email" name="email" type="email" placeholder="Your email address" autoComplete="email" required />
                <button type="submit" disabled={pending}>{pending ? "…" : "Join →"}</button>
              </form>
            )}
            {err && <div className="msg" style={{ color: "#f0a59c" }}>{err}</div>}
            <p style={{ color: "var(--on-dark-muted)", fontSize: ".88rem", marginTop: 20 }}>{email} · {phone}<br />{address}</p>
          </div>
          <div><h3>Shop</h3><ul>
            <li><Link href="/shop">All belts</Link></li>
            <li><Link href="/shop?tag=beaded">Beaded</Link></li>
            <li><Link href="/shop?tag=painted">Hand-painted</Link></li>
            <li><Link href="/size-guide">Size guide</Link></li>
          </ul></div>
          <div><h3>Help</h3><ul>
            <li><Link href="/track">Track order</Link></li>
            <li><Link href="/pages/shipping">Shipping</Link></li>
            <li><Link href="/pages/returns">Exchanges</Link></li>
            <li><Link href="/faq">FAQ</Link></li>
            <li><Link href="/contact">Contact</Link></li>
          </ul></div>
          <div><h3>Company</h3><ul>
            <li><Link href="/pages/about">About</Link></li>
            <li><Link href="/pages/care">Leather care</Link></li>
            <li><Link href="/pages/privacy">Privacy</Link></li>
            <li><Link href="/pages/terms">Terms</Link></li>
          </ul></div>
        </div>
        <div className="foot-word" aria-hidden="true">{storeName}</div>
        <div className="legal mono">
          <span>© {new Date().getFullYear()} {legalName}</span>
          <div className="pay-icons" aria-label="Payment methods"><span>UPI</span><span>Cards</span><span>Netbanking</span><span>COD</span></div>
        </div>
      </div>
    </footer>
  );
}
