"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** A thin bar at the top that appears the moment a link is clicked, so every tap feels answered. */
export function NavProgress() {
  const path = usePathname();
  const search = useSearchParams();
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(false); }, [path, search]);
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      setOn(true);
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);
  useEffect(() => {
    if (!on) return;
    const t = setTimeout(() => setOn(false), 10_000);
    return () => clearTimeout(t);
  }, [on]);
  return <div className={`nav-progress${on ? " on" : ""}`} aria-hidden="true" />;
}
