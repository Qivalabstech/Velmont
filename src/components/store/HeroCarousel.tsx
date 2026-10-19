"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { inr } from "@/lib/money";

type Slide = { name: string; slug: string; price: number; mrp: number; image: string; alt: string };
const DUR = 5200;

export function HeroCarousel({ slides, storeName }: { slides: Slide[]; storeName: string }) {
  const [cur, setCur] = useState(0);
  const [out, setOut] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  const go = useCallback((n: number) => {
    setCur((c) => { if (c !== n) { setOut(c); setTimeout(() => setOut(null), 1100); } return n; });
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (slides.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => go((cur + 1) % slides.length), DUR);
    return () => clearTimeout(t);
  }, [cur, tick, go, slides.length]);

  useEffect(() => {
    const el = stage.current, sl = inner.current;
    if (!el || !sl || !matchMedia("(hover:hover)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      sl.style.transform = `translate(${x * -18}px,${y * -14}px) rotate(${x * 3}deg)`;
    };
    const leave = () => { sl.style.transform = ""; };
    el.addEventListener("pointermove", move); el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
  }, []);

  const s = slides[cur];
  if (!s) return null;
  return (
    <div className="stage" ref={stage}>
      <svg className="stamp" viewBox="0 0 400 400" aria-hidden="true">
        <defs><path id="circ" d="M200,200 m-176,0 a176,176 0 1,1 352,0 a176,176 0 1,1 -352,0" /></defs>
        <circle cx="200" cy="200" r="190" fill="none" stroke="currentColor" strokeOpacity=".25" strokeDasharray="2 6" />
        <text><textPath href="#circ">{`${storeName} · Hand-tooled · Full-grain leather · Carved · Beaded · Stitched · `}</textPath></text>
      </svg>
      <div className="disc" />
      <div className="slides" ref={inner}>
        {slides.map((sl, i) => (
          <div key={sl.slug} className={`slide${i === cur ? " on" : ""}${i === out ? " out" : ""}`} aria-hidden={i !== cur}>
            <Image src={sl.image} alt={sl.alt} width={980} height={420} priority={i === 0} sizes="(max-width:860px) 100vw, 60vw" />
          </div>
        ))}
      </div>
      <Link className="hero-tag" href={`/products/${s.slug}`} aria-live="polite">
        <div className="swap" key={cur}>
          <div className="mono muted">Featured · {String(cur + 1).padStart(2, "0")}/{String(slides.length).padStart(2, "0")}</div>
          <div className="nm">{s.name}</div>
          <div className="pr">{inr(s.price)}{s.mrp > s.price && <s>{inr(s.mrp)}</s>}</div>
        </div>
      </Link>
      <div className="dots" role="tablist" aria-label="Featured belts" style={{ ["--dur" as string]: `${DUR}ms` }}>
        {slides.map((sl, i) => (
          <button key={`${sl.slug}-${i === cur ? tick : 0}`} role="tab" aria-selected={i === cur} aria-label={`Show ${sl.name}`}
            className={i === cur ? "on" : i < cur ? "done" : ""} onClick={() => go(i)}><i /></button>
        ))}
      </div>
    </div>
  );
}
