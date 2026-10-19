"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { login, register, forgot, resetPassword, updateProfile, changePassword, saveAddress } from "./actions";
import { INDIAN_STATES } from "@/lib/utils";

function Msg({ s }: { s: { error?: string; ok?: string } | null }) {
  if (!s) return null;
  return s.error ? <div className="alert bad" role="alert">{s.error}</div> : s.ok ? <div className="alert good" role="status">{s.ok}</div> : null;
}

export function LoginForm({ next }: { next: string }) {
  const [s, a, p] = useActionState(login, null);
  return (
    <form action={a}>
      <input type="hidden" name="next" value={next} />
      <div className="field"><label htmlFor="l-email">Email</label><input id="l-email" name="email" type="email" className="input" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="l-pw">Password</label><input id="l-pw" name="password" type="password" className="input" autoComplete="current-password" required /></div>
      <Msg s={s} />
      <button className="btn solid" disabled={p}>{p ? "Signing in…" : "Sign in"}</button>
      <Link href="/account/forgot" className="alt">Forgot your password?</Link>
    </form>
  );
}

export function RegisterForm({ next, email }: { next: string; email: string }) {
  const [s, a, p] = useActionState(register, null);
  return (
    <form action={a}>
      <input type="hidden" name="next" value={next} />
      <div className="field"><label htmlFor="r-name">Full name</label><input id="r-name" name="name" className="input" autoComplete="name" required /></div>
      <div className="field"><label htmlFor="r-email">Email</label><input id="r-email" name="email" type="email" className="input" autoComplete="email" defaultValue={email} required /></div>
      <div className="field"><label htmlFor="r-phone">Mobile <span className="muted">(optional)</span></label><input id="r-phone" name="phone" type="tel" inputMode="numeric" className="input" autoComplete="tel" /></div>
      <div className="field"><label htmlFor="r-pw">Password</label><input id="r-pw" name="password" type="password" className="input" autoComplete="new-password" minLength={8} required /><span className="hint">At least 8 characters with a letter and a number.</span></div>
      <label className="check"><input type="checkbox" name="optin" />Email me when new belts launch</label>
      <Msg s={s} />
      <button className="btn solid" disabled={p}>{p ? "Creating account…" : "Create account"}</button>
    </form>
  );
}

export function ForgotForm() {
  const [s, a, p] = useActionState(forgot, null);
  return (
    <form action={a}>
      <div className="field"><label htmlFor="f-email">Email</label><input id="f-email" name="email" type="email" className="input" autoComplete="email" required /></div>
      <Msg s={s} />
      <button className="btn solid" disabled={p}>Send reset link</button>
    </form>
  );
}

export function ResetForm({ token, signInHref }: { token: string; signInHref: string }) {
  const [s, a, p] = useActionState(resetPassword, null);
  if (s?.ok) return <><Msg s={s} /><Link className="btn solid" href={signInHref}>Sign in</Link></>;
  return (
    <form action={a}>
      <input type="hidden" name="token" value={token} />
      <div className="field"><label htmlFor="n-pw">New password</label><input id="n-pw" name="password" type="password" className="input" autoComplete="new-password" minLength={8} required /><span className="hint">At least 8 characters with a letter and a number.</span></div>
      <Msg s={s} />
      <button className="btn solid" disabled={p}>Save new password</button>
    </form>
  );
}

export function ProfileForm({ name, phone, email, optin }: { name: string; phone: string; email: string; optin: boolean }) {
  const [s, a, p] = useActionState(updateProfile, null);
  return (
    <form action={a} className="panel" style={{ display: "grid", gap: 14 }}>
      <h2>Profile</h2>
      <div className="form-grid">
        <div className="field"><label htmlFor="p-name">Full name</label><input id="p-name" name="name" className="input" defaultValue={name} required /></div>
        <div className="field"><label htmlFor="p-phone">Mobile</label><input id="p-phone" name="phone" className="input" defaultValue={phone} inputMode="numeric" /></div>
        <div className="field full"><span className="lbl">Email</span><div className="muted">{email}</div></div>
        <label className="check full"><input type="checkbox" name="optin" defaultChecked={optin} />Email me when new belts launch</label>
      </div>
      <Msg s={s} />
      <div><button className="btn solid" disabled={p}>Save profile</button></div>
    </form>
  );
}

export function PasswordForm() {
  const [s, a, p] = useActionState(changePassword, null);
  return (
    <form action={a} className="panel" style={{ display: "grid", gap: 14 }}>
      <h2>Password</h2>
      <div className="form-grid">
        <div className="field"><label htmlFor="c-cur">Current password</label><input id="c-cur" name="current" type="password" className="input" autoComplete="current-password" required /></div>
        <div className="field"><label htmlFor="c-new">New password</label><input id="c-new" name="password" type="password" className="input" autoComplete="new-password" minLength={8} required /></div>
      </div>
      <Msg s={s} />
      <div><button className="btn" disabled={p}>Change password</button></div>
    </form>
  );
}

type Addr = { id?: string; name?: string; phone?: string; line1?: string; line2?: string; city?: string; state?: string; pincode?: string; isDefault?: boolean };
export function AddressForm({ a, onDone }: { a?: Addr; onDone?: () => void }) {
  const [s, act, p] = useActionState(async (prev: { error?: string; ok?: string } | null, fd: FormData) => {
    const r = await saveAddress(prev, fd);
    if (r?.ok) onDone?.();
    return r;
  }, null);
  const k = a?.id || "new";
  return (
    <form action={act} className="panel" style={{ display: "grid", gap: 14 }}>
      {a?.id && <input type="hidden" name="id" value={a.id} />}
      <div className="form-grid">
        <div className="field"><label htmlFor={`a-name-${k}`}>Full name</label><input id={`a-name-${k}`} name="name" className="input" defaultValue={a?.name} required /></div>
        <div className="field"><label htmlFor={`a-phone-${k}`}>Mobile</label><input id={`a-phone-${k}`} name="phone" className="input" inputMode="numeric" defaultValue={a?.phone} required /></div>
        <div className="field full"><label htmlFor={`a-l1-${k}`}>House number and street</label><input id={`a-l1-${k}`} name="line1" className="input" defaultValue={a?.line1} required /></div>
        <div className="field full"><label htmlFor={`a-l2-${k}`}>Area, landmark</label><input id={`a-l2-${k}`} name="line2" className="input" defaultValue={a?.line2} /></div>
        <div className="field"><label htmlFor={`a-pin-${k}`}>Pincode</label><input id={`a-pin-${k}`} name="pincode" className="input" inputMode="numeric" maxLength={6} defaultValue={a?.pincode} required /></div>
        <div className="field"><label htmlFor={`a-city-${k}`}>City</label><input id={`a-city-${k}`} name="city" className="input" defaultValue={a?.city} required /></div>
        <div className="field full"><label htmlFor={`a-state-${k}`}>State</label>
          <select id={`a-state-${k}`} name="state" className="select" defaultValue={a?.state || ""} required><option value="">Choose state</option>{INDIAN_STATES.map((x) => <option key={x}>{x}</option>)}</select></div>
        <label className="check full"><input type="checkbox" name="isDefault" defaultChecked={a?.isDefault} />Use as my default address</label>
      </div>
      <Msg s={s} />
      <div style={{ display: "flex", gap: 10 }}><button className="btn solid" disabled={p}>Save address</button>{onDone && <button type="button" className="btn" onClick={onDone}>Cancel</button>}</div>
    </form>
  );
}

export function AddressEditor({ a }: { a: Addr }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button className="link-btn" onClick={() => setOpen(true)}>Edit</button>;
  return <div style={{ gridColumn: "1/-1" }}><AddressForm a={a} onDone={() => setOpen(false)} /></div>;
}

export function NewAddress() {
  const [open, setOpen] = useState(false);
  if (!open) return <button className="btn" onClick={() => setOpen(true)}>Add an address</button>;
  return <AddressForm onDone={() => setOpen(false)} />;
}
