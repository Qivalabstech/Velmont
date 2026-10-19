import Link from "next/link";
import type { Tone } from "@/lib/order-status";

export function PageHead({ title, sub, back, actions }: { title: string; sub?: React.ReactNode; back?: { href: string; label: string }; actions?: React.ReactNode }) {
  return (
    <header className="ph">
      <div>
        {back && <Link className="crumb" href={back.href}>← {back.label}</Link>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="acts">{actions}</div>}
    </header>
  );
}

export function Card({ title, sub, actions, children, flush, id }: { title?: string; sub?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; flush?: boolean; id?: string }) {
  return (
    <section className="cardx" id={id}>
      {(title || actions) && <div className="hd"><div><h2>{title}</h2>{sub && <div className="sub">{sub}</div>}</div>{actions}</div>}
      <div className={`bd${flush ? " flush" : ""}`}>{children}</div>
    </section>
  );
}

export const Pill = ({ tone, children }: { tone: Tone; children: React.ReactNode }) => <span className={`pill ${tone}`}>{children}</span>;

export function Kpi({ label, value, delta, tone, href }: { label: string; value: React.ReactNode; delta?: React.ReactNode; tone?: "up" | "down" | ""; href?: string }) {
  const inner = (<><span className="l">{label}</span><span className="v">{value}</span>{delta && <span className={`d ${tone || ""}`}>{delta}</span>}</>);
  return href ? <Link className="kpi" href={href} style={{ textDecoration: "none" }}>{inner}</Link> : <div className="kpi">{inner}</div>;
}

export function Pager({ page, total, per, base }: { page: number; total: number; per: number; base: string }) {
  const pages = Math.max(1, Math.ceil(total / per));
  const sep = base.includes("?") ? "&" : "?";
  return (
    <div className="pager">
      <span>{total ? `${(page - 1) * per + 1}–${Math.min(page * per, total)} of ${total}` : "0 results"}</span>
      <span style={{ display: "flex", gap: 8 }}>
        {page > 1 ? <Link className="btn sm" href={`${base}${sep}page=${page - 1}`}>Previous</Link> : <span className="btn sm" aria-disabled="true">Previous</span>}
        {page < pages ? <Link className="btn sm" href={`${base}${sep}page=${page + 1}`}>Next</Link> : <span className="btn sm" aria-disabled="true">Next</span>}
      </span>
    </div>
  );
}
