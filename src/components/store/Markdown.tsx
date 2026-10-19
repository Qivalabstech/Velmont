import React from "react";

/** Minimal Markdown for store pages: ## and ### headings, paragraphs, - lists, 1. lists, **bold**, [links](url). */
function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2]) out.push(<strong key={`${key}b${i++}`}>{m[2]}</strong>);
    else if (m[4]) {
      const href = /^(https?:|\/|mailto:|#)/.test(m[5]) ? m[5] : "#";
      out.push(<a key={`${key}a${i++}`} href={href}>{m[4]}</a>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className="prose">
      {blocks.map((b, i) => {
        const t = b.trim();
        if (!t) return null;
        if (t.startsWith("### ")) return <h3 key={i}>{inline(t.slice(4), `${i}`)}</h3>;
        if (t.startsWith("## ")) return <h2 key={i}>{inline(t.slice(3), `${i}`)}</h2>;
        const lines = t.split("\n");
        if (lines.every((l) => /^[-*] /.test(l)))
          return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.slice(2), `${i}-${j}`)}</li>)}</ul>;
        if (lines.every((l) => /^\d+\. /.test(l)))
          return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\d+\. /, ""), `${i}-${j}`)}</li>)}</ol>;
        return <p key={i}>{lines.map((l, j) => <React.Fragment key={j}>{j > 0 && <br />}{inline(l, `${i}-${j}`)}</React.Fragment>)}</p>;
      })}
    </div>
  );
}

export function plainText(md: string) {
  return md.replace(/^#+\s/gm, "").replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();
}
