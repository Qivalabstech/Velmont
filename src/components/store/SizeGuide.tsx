"use client";
import { useState } from "react";

const SIZES = [30, 32, 34, 36, 38, 40];

export function SizeGuide({ compact = false }: { compact?: boolean }) {
  const [w, setW] = useState(32);
  let s = w + 2; if (s % 2) s += 1;
  const size = Math.min(40, Math.max(30, s));
  const note = s > 40 ? "Above our largest size. Size 40 fits up to a 39 in waist on its last hole."
    : s < 30 ? "Below our smallest size. Size 30 fits down to a 27 in waist on its first hole."
    : (w + 2) % 2 ? "Between sizes, so we round up. You will sit one hole tighter than centre."
    : "Fits on the centre of five holes, with an inch of room either way.";
  return (
    <div className="sizer">
      <div className="calc">
        <label className="mono" htmlFor={`waist${compact ? "-c" : ""}`}>Your trouser waist (inches)</label>
        <div className="in">
          <input type="range" id={`waist${compact ? "-c" : ""}`} min={26} max={40} step={1} value={w}
            onChange={(e) => setW(Number(e.target.value))} aria-describedby="size-res" />
          <span className="waist" aria-hidden="true">{w}</span>
        </div>
        <div className="res" id="size-res" aria-live="polite"><span className="mono">Order size</span><b>{size}</b></div>
        <p className="note">{note}</p>
      </div>
      <div>
        <div className="table-wrap">
          <table className="table size-table">
            <thead><tr><th>Belt size</th><th>Trouser waist</th><th>Centre hole</th><th>Overall length</th></tr></thead>
            <tbody>
              {SIZES.map((n) => (
                <tr key={n} className={n === size ? "hit" : ""}>
                  <td>{n}</td><td>{n - 3}–{n - 1} in</td><td>{n} in · {Math.round(n * 2.54)} cm</td><td>{n + 5} in</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: ".92rem", marginTop: 14 }}>
          No trousers handy? Lay a belt you already own flat and measure from the fold of the buckle to the hole you use most. That number in inches is your size.
        </p>
      </div>
    </div>
  );
}
