"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { adminLogout } from "@/app/admin/auth-actions";
import { ToastHost } from "./Form";

type Item = { href: string; label: string; group: string; badge?: number };

export function Shell({ items, me, storeName, children }: {
  items: Item[]; me: { name: string; role: string }; storeName: string; children: React.ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const groups = [...new Set(items.map((i) => i.group))];
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));
  const current = items.find((i) => active(i.href));
  return (
    <div className="adm">
      <div className="adm-top">
        <button aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>☰</button>
        <span className="t">{current?.label || storeName}</span>
        <Link href="/" target="_blank" style={{ color: "var(--on-dark-muted)", fontSize: ".8rem" }}>View store ↗</Link>
      </div>
      {open && <div className="adm-scrim" onClick={() => setOpen(false)} />}
      <aside className={`adm-side${open ? " on" : ""}`} aria-label="Admin navigation">
        <Link className="adm-brand" href="/admin"><span className="patch">{storeName[0]}</span><span><span className="word">{storeName}</span><small>Admin</small></span></Link>
        <nav className="adm-nav">
          {groups.map((g) => (
            <div key={g} style={{ display: "contents" }}>
              <div className="grp">{g}</div>
              {items.filter((i) => i.group === g).map((i) => (
                <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined}>
                  <span>{i.label}</span>{i.badge ? <span className="badge">{i.badge}</span> : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="adm-me">
          <span className="who">{me.name}</span>
          <span className="role">{me.role}</span>
          <div className="links">
            <Link href="/admin/me">My account</Link>
            <Link href="/" target="_blank">View store ↗</Link>
            <form action={adminLogout}><button type="submit">Sign out</button></form>
          </div>
        </div>
      </aside>
      <main className="adm-main">{children}</main>
      <ToastHost />
    </div>
  );
}
