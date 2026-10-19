"use client";
import { useActionState } from "react";
import { sendContact } from "../actions";

export function ContactForm({ order }: { order: string }) {
  const [s, a, p] = useActionState(sendContact, null);
  if (s?.ok) return <div className="alert good">Thanks. Your message is with our team and we will reply by email.</div>;
  return (
    <form action={a} className="panel" style={{ display: "grid", gap: 14 }}>
      <div className="form-grid">
        <div className="field"><label htmlFor="c-name">Name</label><input id="c-name" name="name" className="input" autoComplete="name" required /></div>
        <div className="field"><label htmlFor="c-email">Email</label><input id="c-email" name="email" type="email" className="input" autoComplete="email" required /></div>
        <div className="field"><label htmlFor="c-phone">Mobile <span className="muted">(optional)</span></label><input id="c-phone" name="phone" className="input" inputMode="numeric" /></div>
        <div className="field"><label htmlFor="c-order">Order number <span className="muted">(optional)</span></label><input id="c-order" name="order" className="input" defaultValue={order} /></div>
        <div className="field full"><label htmlFor="c-msg">Message</label><textarea id="c-msg" name="message" className="textarea" required minLength={10} /></div>
        <input name="company" tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: -9999 }} aria-hidden="true" />
      </div>
      {s?.error && <div className="alert bad">{s.error}</div>}
      <div><button className="btn solid" disabled={p}>{p ? "Sending…" : "Send message"}</button></div>
    </form>
  );
}
