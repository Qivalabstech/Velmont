"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "../actions";

const L = [
  { href: "/account", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/settings", label: "Profile & password" },
];
export function AccountNav() {
  const p = usePathname();
  return (
    <nav className="acct-nav" aria-label="Account">
      {L.map((l) => <Link key={l.href} href={l.href} aria-current={(l.href === "/account" ? p === "/account" || p.startsWith("/account/orders") : p.startsWith(l.href)) ? "page" : undefined}>{l.label}</Link>)}
      <form action={logout}><button type="submit">Sign out</button></form>
    </nav>
  );
}
