import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { liveStatus } from "@/lib/health/live";
import { latestRun, runHistory } from "@/lib/health/audit";
import { pagespeedAvailable } from "@/lib/health/pagespeed";
import type { Section, Check } from "@/lib/health/types";
import { formatDate, timeAgo } from "@/lib/utils";
import { SITE_URL } from "@/lib/env";
import { PageHead, Card, Pill } from "@/components/admin/ui";
import { Ring } from "@/components/admin/Charts";
import { AForm, Submit } from "@/components/admin/Form";
import { runAudit, runSpeed, pingNow } from "./actions";

export const metadata = { title: "Site health" };
export const maxDuration = 60; // the audit and PageSpeed run inside this page's actions

type Audit = { seo: Section; aeo: Section; geo: Section; pages: { path: string; status: number; ms: number; kb: number; title: string; words: number }[]; avgMs: number };
type Speed = {
  scores: { performance: number; seo: number; accessibility: number; bestPractices: number };
  lab: Record<string, string | undefined>; field: null | { lcp: { percentile?: number; category?: string }; inp: { percentile?: number; category?: string }; cls: { percentile?: number; category?: string }; overall?: string };
  opportunities: { title: string; savingsMs: number }[];
};

const ICON = { pass: "✓", warn: "!", fail: "✕", info: "i" } as const;
const verdict = (n: number | null) => (n == null ? "Not run yet" : n >= 90 ? "Good" : n >= 50 ? "Needs work" : "Poor");

function Checks({ checks }: { checks: Check[] }) {
  const order = { fail: 0, warn: 1, info: 2, pass: 3 } as const;
  return (
    <ul className="checks">
      {[...checks].sort((a, b) => order[a.status] - order[b.status]).map((c) => (
        <li key={c.id}>
          <span className={`ic ${c.status}`} aria-label={c.status}>{ICON[c.status]}</span>
          <div><div>{c.label}</div>{c.fix && c.status !== "pass" && <div className="fix">{c.fix}</div>}</div>
          <span className="val">{c.value}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function Health({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireStaff("health.view");
  const tab = (await searchParams).tab || "seo";
  const [live, auditRow, mobileRow, desktopRow, history] = await Promise.all([
    liveStatus(), latestRun("audit"), latestRun("pagespeed-mobile"), latestRun("pagespeed-desktop"), runHistory("audit", 10),
  ]);
  const audit = auditRow?.result as Audit | undefined;
  const mobile = mobileRow?.result as Speed | undefined;
  const desktop = desktopRow?.result as Speed | undefined;
  const psOk = pagespeedAvailable();
  const sslDays = live.sslExpires ? Math.round((live.sslExpires.getTime() - Date.now()) / 86400_000) : null;
  const backupDays = live.backup ? Math.round((Date.now() - live.backup.getTime()) / 86400_000) : null;
  const perf = mobile?.scores.performance ?? null;

  const liveChecks: Check[] = [
    { id: "db", label: "Database", status: live.dbOk ? (live.dbMs < 50 ? "pass" : "warn") : "fail", value: live.dbOk ? `${live.dbMs} ms` : "Not responding" },
    { id: "up", label: "Uptime, last 24 hours", status: live.uptimePct == null ? "info" : live.uptimePct >= 99.5 ? "pass" : live.uptimePct >= 97 ? "warn" : "fail", value: live.uptimePct == null ? "Collecting (every 5 min)" : `${live.uptimePct.toFixed(2)}% of ${live.checks} checks` },
    { id: "resp", label: "Homepage response time", status: live.avgLatency == null ? "info" : live.avgLatency < 600 ? "pass" : live.avgLatency < 1500 ? "warn" : "fail", value: live.avgLatency == null ? "—" : `${live.avgLatency} ms average` },
    { id: "pay", label: "Online payments (Razorpay)", status: live.payments === "live" ? "pass" : live.payments === "test" || live.payments === "mock" ? "warn" : "fail", value: { live: "Live keys", test: "Test keys: no real money", mock: "Simulated", off: "Not set up" }[live.payments], fix: live.payments !== "live" ? "Add live keys in Settings → Payments before launch." : undefined },
    { id: "mail", label: "Order emails", status: live.email ? "pass" : "warn", value: live.email ? "SMTP connected" : "Not set up", fix: !live.email ? "Customers will not get confirmations. Add SMTP details to the .env file." : undefined },
    { id: "ssl", label: "SSL certificate", status: !live.https ? "fail" : sslDays == null ? "warn" : sslDays > 14 ? "pass" : "fail", value: !live.https ? "Site is not on https" : sslDays == null ? "Could not read" : `Renews in ${sslDays} days`, fix: !live.https ? `SITE_URL is ${SITE_URL}. Point your domain to the server; Caddy issues the certificate automatically.` : undefined },
    live.vercel
      ? { id: "backup", label: "Database backup", status: "info", value: "Managed by your database host", fix: "Neon and Supabase keep restore points. Check your plan's history window in their dashboard." }
      : { id: "backup", label: "Database backup", status: backupDays == null ? "fail" : backupDays <= 1 ? "pass" : backupDays <= 7 ? "warn" : "fail", value: backupDays == null ? "None found" : `${backupDays === 0 ? "Today" : `${backupDays} days ago`}`, fix: backupDays == null || backupDays > 1 ? "The backup container saves one every night; check it is running (see README)." : undefined },
    { id: "err", label: "Errors in the last 24 hours", status: live.errors24h === 0 ? "pass" : live.errors24h < 5 ? "warn" : "fail", value: String(live.errors24h), fix: live.errors24h ? "See Activity log → Errors." : undefined },
    { id: "stuck", label: "Unpaid orders older than 3 hours", status: live.stuckPending ? "warn" : "pass", value: String(live.stuckPending), fix: live.stuckPending ? (live.vercel ? "They are cancelled at the next checkout, when staff open Orders, or by the daily job." : "These should auto-cancel; if they stay, the background scheduler is not running.") : undefined },
    { id: "disk", label: "Disk space", status: !live.disk ? "info" : live.disk.freeGb > 5 ? "pass" : live.disk.freeGb > 1 ? "warn" : "fail", value: live.disk ? `${live.disk.freeGb.toFixed(1)} GB free of ${live.disk.totalGb.toFixed(0)} GB` : "—" },
    { id: "mem", label: "App memory", status: live.vercel ? "info" : live.memMb < 700 ? "pass" : "warn", value: `${live.memMb} MB · up ${Math.floor(live.uptimeSec / 3600)}h ${Math.floor((live.uptimeSec % 3600) / 60)}m · Node ${live.node}` },
  ];

  const gauges: { k: string; title: string; n: number | null; sub: string }[] = [
    { k: "speed", title: "Page speed", n: perf, sub: mobile ? `${verdict(perf)} on mobile · ${timeAgo(mobileRow!.createdAt)}` : psOk ? "Run PageSpeed to score" : "Available once the site is live on https" },
    { k: "seo", title: "SEO", n: audit?.seo.score ?? null, sub: audit ? `${verdict(audit.seo.score)} · ${audit.seo.checks.filter((c) => c.status === "fail").length} to fix` : "Run the audit" },
    { k: "aeo", title: "Answer engines (AEO)", n: audit?.aeo.score ?? null, sub: audit ? "Google rich results, voice answers" : "Run the audit" },
    { k: "geo", title: "AI search (GEO)", n: audit?.geo.score ?? null, sub: audit ? "ChatGPT, Claude, Perplexity, Gemini" : "Run the audit" },
  ];

  return (
    <div style={{ maxWidth: 1180 }}>
      <PageHead title="Site health" sub={<>Live server status plus scheduled audits. The audit runs every night around 3 am; run it any time after changing products or pages. {auditRow && <>Last audit {formatDate(auditRow.createdAt, true)} ({auditRow.trigger}).</>}</>}
        actions={<>
          <AForm action={pingNow}><Submit className="btn sm" pendingText="Checking…">Check uptime now</Submit></AForm>
          <AForm action={runAudit}><Submit className="btn sm solid" pendingText="Auditing pages…">Run SEO / AEO / GEO audit</Submit></AForm>
        </>} />

      <div className="gauges">
        {gauges.map((g) => (
          <Link key={g.k} href={g.k === "speed" ? "/admin/health?tab=speed" : `/admin/health?tab=${g.k}`} className="gauge" style={{ textDecoration: "none" }}>
            <Ring score={g.n} /><div><h3>{g.title}</h3><p>{g.sub}</p></div>
          </Link>
        ))}
      </div>

      <div className="cols">
        <div className="stack">
          <nav className="tabs" style={{ marginBottom: 0 }}>
            {[["seo", "SEO"], ["aeo", "Answer engines"], ["geo", "AI search"], ["speed", "Page speed"], ["pages", "Pages crawled"]].map(([k, l]) => (
              <Link key={k} href={`/admin/health?tab=${k}`} aria-current={tab === k ? "page" : undefined}>{l}</Link>
            ))}
          </nav>
          {(tab === "seo" || tab === "aeo" || tab === "geo") && (
            audit ? (
              <Card title={{ seo: "Search engine optimisation", aeo: "Answer engine optimisation", geo: "Generative engine optimisation" }[tab]}
                sub={{ seo: "Can Google find, understand and rank every page?", aeo: "Can Google and voice assistants lift a direct answer or rich result from the store?", geo: "Will ChatGPT, Claude, Perplexity and Gemini read, trust and recommend VELMONT?" }[tab]} flush>
                <Checks checks={audit[tab as "seo" | "aeo" | "geo"].checks} />
              </Card>
            ) : <Card><p className="empty">No audit yet. Press “Run SEO / AEO / GEO audit”. It reads every page of the store and takes about a minute.</p></Card>
          )}
          {tab === "speed" && (
            <div className="stack">
              {!psOk && <div className="hint-box">PageSpeed Insights tests the live public site. It starts working once SITE_URL is your https:// domain. Meanwhile, server response times are measured by the audit (Pages crawled tab).</div>}
              <Card title="Google PageSpeed Insights" sub="Lighthouse lab test of the homepage, plus real-user Chrome data when Google has enough visits."
                actions={psOk && <div style={{ display: "flex", gap: 6 }}>
                  <AForm action={runSpeed}><input type="hidden" name="strategy" value="mobile" /><Submit className="btn sm solid" pendingText="Testing (≈30 s)…">Test mobile</Submit></AForm>
                  <AForm action={runSpeed}><input type="hidden" name="strategy" value="desktop" /><Submit className="btn sm" pendingText="Testing (≈30 s)…">Test desktop</Submit></AForm>
                </div>}>
                {[["Mobile", mobile, mobileRow?.createdAt], ["Desktop", desktop, desktopRow?.createdAt]].map(([label, r, at]) => {
                  const res = r as Speed | undefined;
                  return (
                    <div key={label as string} style={{ marginBottom: 18 }}>
                      <h3 style={{ margin: "0 0 10px", fontSize: ".95rem" }}>{label as string} {at ? <span className="muted" style={{ fontWeight: 400, fontSize: ".8rem" }}>· {formatDate(at as Date, true)}</span> : null}</h3>
                      {res ? (
                        <>
                          <div className="cwv" style={{ marginBottom: 10 }}>
                            {Object.entries({ Performance: res.scores.performance, SEO: res.scores.seo, Accessibility: res.scores.accessibility, "Best practices": res.scores.bestPractices }).map(([k, v]) => (
                              <div key={k}><b style={{ color: v >= 90 ? "var(--good)" : v >= 50 ? "var(--warn)" : "var(--bad)" }}>{v}</b><span>{k}</span></div>))}
                          </div>
                          <div className="cwv">
                            {Object.entries({ "Largest paint (LCP)": res.lab.lcp, "First paint": res.lab.fcp, "Blocking time": res.lab.tbt, "Layout shift (CLS)": res.lab.cls, "Speed index": res.lab.si, "Server response": res.lab.ttfb }).map(([k, v]) => <div key={k}><b>{v || "—"}</b><span>{k}</span></div>)}
                          </div>
                          {res.field && <p className="muted" style={{ fontSize: ".85rem" }}>Real visitors (28 days): LCP {res.field.lcp.percentile ? `${(res.field.lcp.percentile / 1000).toFixed(1)} s` : "—"} · INP {res.field.inp.percentile ?? "—"} ms · CLS {res.field.cls.percentile != null ? (res.field.cls.percentile / 100).toFixed(2) : "—"} · overall {res.field.overall?.toLowerCase() || "—"}</p>}
                          {res.opportunities.length > 0 && <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: ".86rem" }}>{res.opportunities.map((o) => <li key={o.title}>{o.title} <span className="muted">(saves ~{(o.savingsMs / 1000).toFixed(1)} s)</span></li>)}</ul>}
                        </>
                      ) : <p className="muted" style={{ margin: 0 }}>Not tested yet.</p>}
                    </div>
                  );
                })}
              </Card>
            </div>
          )}
          {tab === "pages" && (
            <Card title="Pages crawled in the last audit" sub={audit ? `Average server time ${audit.avgMs} ms` : undefined} flush>
              {audit ? <div className="tbl-wrap"><table className="tbl">
                <thead><tr><th>Page</th><th>Status</th><th className="r">Time</th><th className="r">Size</th><th className="r">Words</th></tr></thead>
                <tbody>{audit.pages.map((p) => (
                  <tr key={p.path}><td><a className="rowlink" href={p.path} target="_blank">{p.path}</a><div className="sub">{p.title}</div></td>
                    <td><Pill tone={p.status === 200 ? "good" : "bad"}>{p.status || "Failed"}</Pill></td>
                    <td className="r"><Pill tone={p.ms < 800 ? "good" : p.ms < 1800 ? "warn" : "bad"}>{p.ms} ms</Pill></td><td className="r">{p.kb} KB</td><td className="r">{p.words}</td></tr>
                ))}</tbody></table></div> : <p className="empty">Run the audit first.</p>}
            </Card>
          )}
          {history.length > 1 && (
            <Card title="Score history" flush>
              <div className="tbl-wrap"><table className="tbl">
                <thead><tr><th>When</th><th>By</th><th className="r">SEO</th><th className="r">AEO</th><th className="r">GEO</th></tr></thead>
                <tbody>{history.map((h) => { const r = h.result as Audit; return (
                  <tr key={h.id}><td>{formatDate(h.createdAt, true)}</td><td className="sub">{h.trigger}</td><td className="r">{r.seo.score}</td><td className="r">{r.aeo.score}</td><td className="r">{r.geo.score}</td></tr>); })}</tbody>
              </table></div>
            </Card>
          )}
        </div>

        <div className="stack">
          <Card title="Live status" sub={live.lastCheck ? `Last check ${timeAgo(live.lastCheck)}` : live.vercel ? "Add an uptime monitor (below) to fill this strip" : "Automatic checks run every 5 minutes"}>
            <div className="uptime-strip" aria-label="Uptime over the last 24 hours, 30-minute blocks">
              {live.buckets.map((b, i) => <i key={i} className={b === "ok" ? "" : b} title={b === "none" ? "No data" : b === "ok" ? "Up" : "Problem"} />)}
            </div>
            <div className="legend" style={{ marginTop: 6, justifyContent: "space-between" }}><span>24 h ago</span><span>{live.visitors24h} visitors today</span><span>Now</span></div>
          </Card>
          <Card flush><Checks checks={liveChecks} /></Card>
          <Card title="External monitoring">
            <p style={{ margin: 0, fontSize: ".86rem" }}>For alerts when the whole server is down, add <code>{SITE_URL}/api/health</code> to a free monitor such as UptimeRobot or Better Stack, checking every 5 minutes. It returns status 200 while the store and database respond{live.vercel ? ", and each check fills the uptime strip above" : ""}.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
