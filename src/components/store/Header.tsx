"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart } from "./CartProvider";
import { BagIcon, SearchIcon, UserIcon } from "./Icons";

const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/#craft", label: "The craft" },
  { href: "/size-guide", label: "Size guide" },
  { href: "/track", label: "Track order" },
];

export function Header({ storeName, announcements, signedIn }: { storeName: string; announcements: string[]; signedIn: boolean }) {
  const { cart, setOpen } = useCart();
  const path = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [bump, setBump] = useState(false);
  const prev = useRef(cart.count);
  useEffect(() => {
    if (cart.count > prev.current) { setBump(true); setTimeout(() => setBump(false), 600); }
    prev.current = cart.count;
  }, [cart.count]);
  useEffect(() => { setMenu(false); setSearch(false); }, [path]);
  const items = announcements.length ? announcements : ["Hand-tooled leather belts"];
  const one = items.flatMap((m, i) => [<span key={`m${i}`}>{m}</span>, <span key={`s${i}`} className="star" aria-hidden="true">✦</span>]);

  return (
    <>
      <div className="announce" aria-label="Store announcements">
        <div className="track">{one}{one}{one}{one}</div>
      </div>
      <header className="site-head">
        <div className="wrap bar">
          <Link className="brand" href="/" aria-label={`${storeName} home`}>
            <span className="patch">{storeName[0]}</span><span className="word">{storeName}</span>
          </Link>
          <nav aria-label="Main">
            <ul className="main-nav">
              {NAV.map((n) => (
                <li key={n.href}><Link href={n.href} aria-current={path === n.href ? "page" : undefined}>{n.label}</Link></li>
              ))}
            </ul>
          </nav>
          <div className="head-actions">
            <button className="icon-btn" aria-label="Search" aria-expanded={search} onClick={() => setSearch((v) => !v)}><SearchIcon /></button>
            <Link className="icon-btn hide-sm" href={signedIn ? "/account" : "/account/login"} aria-label={signedIn ? "Your account" : "Sign in"}><UserIcon /></Link>
            <button className="icon-btn bag-btn" onClick={() => setOpen(true)} aria-label={`Open bag, ${cart.count} items`}>
              <BagIcon /><span className="bag-label">Bag</span>
              <span className={`bag-count${bump ? " bump" : ""}`}>{cart.count}</span>
            </button>
            <button className={`menu-btn${menu ? " on" : ""}`} aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu} aria-controls="mnav" onClick={() => setMenu((v) => !v)}>
              <span></span><span></span>
            </button>
          </div>
        </div>
        {search && (
          <div className="search-pop">
            <form className="wrap" role="search" onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q");
              router.push(`/shop?q=${encodeURIComponent(String(q || ""))}`);
            }}>
              <label htmlFor="site-q" className="sr-only">Search belts</label>
              <input id="site-q" name="q" className="input" placeholder="Search belts, e.g. black, beaded, tan" autoFocus />
              <button className="btn solid" type="submit">Search</button>
            </form>
          </div>
        )}
        <nav className={`mnav${menu ? " on" : ""}`} id="mnav" aria-label="Mobile">
          {NAV.map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
          <Link className="small" href={signedIn ? "/account" : "/account/login"}>{signedIn ? "My account" : "Sign in or create account"}</Link>
          <Link className="small" href="/contact">Contact us</Link>
        </nav>
      </header>
    </>
  );
}
