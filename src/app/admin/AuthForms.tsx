"use client";
import Link from "next/link";
import { useActionState } from "react";
import { adminLogin } from "./auth-actions";
import { forgot, resetPassword } from "@/app/(store)/account/actions";

const Msg = ({ s }: { s: { error?: string; ok?: string } | null }) =>
  s?.error ? <div className="alert bad" role="alert">{s.error}</div> : s?.ok ? <div className="alert good">{s.ok}</div> : null;

export function AdminLoginForm() {
  const [s, a, p] = useActionState(adminLogin, null);
  return (
    <form action={a}>
      <div className="field"><label htmlFor="al-email">Staff email</label><input id="al-email" name="email" type="email" className="input" autoComplete="username" required autoFocus /></div>
      <div className="field"><label htmlFor="al-pw">Password</label><input id="al-pw" name="password" type="password" className="input" autoComplete="current-password" required /></div>
      <Msg s={s} />
      <button className="btn solid" disabled={p}>{p ? "Signing in…" : "Sign in"}</button>
      <Link href="/admin/forgot" style={{ fontSize: ".88rem", color: "var(--muted)" }}>Forgot your password?</Link>
    </form>
  );
}

export function AdminForgotForm() {
  const [s, a, p] = useActionState(forgot, null);
  return (
    <form action={a}>
      <div className="field"><label htmlFor="af-email">Staff email</label><input id="af-email" name="email" type="email" className="input" required /></div>
      <Msg s={s} />
      <button className="btn solid" disabled={p}>Send reset link</button>
      <Link href="/admin/login" style={{ fontSize: ".88rem", color: "var(--muted)" }}>Back to sign in</Link>
    </form>
  );
}

export function AdminResetForm({ token }: { token: string }) {
  const [s, a, p] = useActionState(resetPassword, null);
  if (s?.ok) return <><Msg s={s} /><Link className="btn solid" href="/admin/login">Sign in</Link></>;
  return (
    <form action={a}>
      <input type="hidden" name="token" value={token} />
      <div className="field"><label htmlFor="ar-pw">New password</label><input id="ar-pw" name="password" type="password" className="input" autoComplete="new-password" minLength={8} required /></div>
      <Msg s={s} />
      <button className="btn solid" disabled={p}>Save new password</button>
    </form>
  );
}
