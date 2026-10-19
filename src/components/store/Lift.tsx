"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Gives below-the-fold .lift elements a gentle rise as they scroll in. Content is always visible. */
export function Lift() {
  const path = usePathname();
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.remove("pre"); io.unobserve(e.target); }
    }), { rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll<HTMLElement>(".lift:not([data-armed])").forEach((el, i) => {
      el.dataset.armed = "1";
      if (el.getBoundingClientRect().top > innerHeight) {
        el.classList.add("pre");
        el.style.transitionDelay = el.classList.contains("card") ? `${(i % 4) * 0.06}s` : "0s";
        io.observe(el);
      }
    });
    return () => io.disconnect();
  }, [path]);
  return null;
}
