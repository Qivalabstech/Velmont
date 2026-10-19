export type Status = "pass" | "warn" | "fail" | "info";
export type Check = { id: string; label: string; status: Status; value?: string; fix?: string; weight?: number };
export type Section = { score: number; checks: Check[] };

export function score(checks: Check[]) {
  const counted = checks.filter((c) => c.status !== "info");
  const total = counted.reduce((a, c) => a + (c.weight ?? 1), 0);
  if (!total) return 100;
  const got = counted.reduce((a, c) => a + (c.weight ?? 1) * (c.status === "pass" ? 1 : c.status === "warn" ? 0.5 : 0), 0);
  return Math.round((got / total) * 100);
}

export const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 100);
export const grade = (ok: number, total: number, warnAt = 0.8): Status => (total === 0 || ok === total ? "pass" : ok / total >= warnAt ? "warn" : "fail");
