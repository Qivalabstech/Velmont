import { inr } from "@/lib/money";

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Daily bars. values are paise when money=true. */
export function Bars({ data, money = false, height = 220 }: { data: { label: string; value: number; title?: string }[]; money?: boolean; height?: number }) {
  const W = 760, H = height, padL = 56, padB = 26, padT = 10, padR = 6;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const bw = (W - padL - padR) / Math.max(data.length, 1);
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const fmt = (v: number) => (money ? (v >= 10000000 ? `₹${(v / 10000000).toFixed(1)}L` : v >= 100000 ? `₹${Math.round(v / 100000)}k` : inr(v)) : String(Math.round(v)));
  const every = Math.ceil(data.length / 10);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily chart">
      <g className="grid">{ticks.map((t) => <line key={t} x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />)}</g>
      {ticks.map((t) => <text key={t} x={padL - 8} y={y(t) + 3} textAnchor="end">{fmt(t)}</text>)}
      {data.map((d, i) => {
        const h = Math.max(d.value > 0 ? 2 : 0, H - padB - y(d.value));
        return (
          <g key={i}>
            <rect className={`bar${i === data.length - 1 ? " today" : ""}`} x={padL + i * bw + bw * 0.15} y={H - padB - h} width={bw * 0.7} height={h} rx={1.5}>
              <title>{d.title || `${d.label}: ${money ? inr(d.value) : d.value}`}</title>
            </rect>
            {i % every === 0 && <text x={padL + i * bw + bw / 2} y={H - 8} textAnchor="middle">{d.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function Ring({ score, size = 72 }: { score: number | null; size?: number }) {
  const r = 30, c = 2 * Math.PI * r;
  const color = score == null ? "var(--muted)" : score >= 90 ? "var(--good)" : score >= 50 ? "var(--warn)" : "var(--bad)";
  return (
    <svg viewBox="0 0 72 72" width={size} height={size} aria-label={score == null ? "Not run yet" : `Score ${score} out of 100`}>
      <circle className="ring-bg" cx="36" cy="36" r={r} fill="none" strokeWidth="6" />
      <circle className="ring" cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - (score ?? 0) / 100)} transform="rotate(-90 36 36)" />
      <text className="score" x="36" y="43" textAnchor="middle">{score ?? "–"}</text>
    </svg>
  );
}
