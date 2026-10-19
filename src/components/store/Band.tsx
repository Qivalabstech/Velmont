"use client";
import Image from "next/image";
import { useEffect, useRef } from "react";

export function Band({ rowOne, rowTwo, image, caption }: { rowOne: string[]; rowTwo: string[]; image: string; caption: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const band = ref.current;
    if (!band || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rows = Array.from(band.querySelectorAll<HTMLElement>(".row"));
    const belt = band.querySelector<HTMLElement>(".belt");
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = band.getBoundingClientRect(), vh = innerHeight;
        if (r.bottom < 0 || r.top > vh) return;
        const t = (vh - r.top) / (vh + r.height);
        rows.forEach((el, i) => { el.style.transform = `translateX(${i === 0 ? -t * 30 : t * 30 - 25}%)`; });
        if (belt) belt.style.transform = `translate(calc(-50% + ${(t - 0.5) * -40}vw),-50%) rotate(${-8 + (t - 0.5) * 14}deg)`;
      });
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => removeEventListener("scroll", onScroll);
  }, []);
  const cls = (i: number) => (i % 4 === 1 ? "o" : i % 4 === 3 ? "t" : "");
  const rep = (a: string[]) => [...a, ...a, ...a].slice(0, 8);
  return (
    <section className="band" ref={ref} aria-label="How VELMONT belts are made">
      <div className="rows" aria-hidden="true">
        <div className="row">{rep(rowOne).map((w, i) => <span key={i} className={cls(i)}>{w}</span>)}</div>
        <div className="row">{rep(rowTwo).map((w, i) => <span key={i} className={cls(i + 1)}>{w}</span>)}</div>
      </div>
      <Image className="belt" src={image} alt="" width={1122} height={938} sizes="(max-width:640px) 135vw, 780px" />
      <div className="cap mono">{caption}</div>
    </section>
  );
}
