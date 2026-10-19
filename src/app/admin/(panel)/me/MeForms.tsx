"use client";
import { useActionState } from "react";
import { changeOwnPassword, updateOwnProfile } from "../../auth-actions";
import { Card } from "@/components/admin/ui";

const Msg = ({ s }: { s: { error?: string; ok?: string } | null }) =>
  s?.error ? <div className="alert bad">{s.error}</div> : s?.ok ? <div className="alert good">{s.ok}</div> : null;

export function MeForms({ name, phone }: { name: string; phone: string }) {
  const [s1, a1, p1] = useActionState(updateOwnProfile, null);
  const [s2, a2, p2] = useActionState(changeOwnPassword, null);
  return (
    <>
      <Card title="Profile">
        <form action={a1} className="fgrid">
          <div className="field"><label htmlFor="me-n">Name</label><input id="me-n" name="name" className="input" defaultValue={name} /></div>
          <div className="field"><label htmlFor="me-p">Phone</label><input id="me-p" name="phone" className="input" defaultValue={phone} /></div>
          <div className="full"><Msg s={s1} /></div>
          <div><button className="btn solid" disabled={p1}>Save</button></div>
        </form>
      </Card>
      <Card title="Change password">
        <form action={a2} className="fgrid">
          <div className="field"><label htmlFor="me-c">Current password</label><input id="me-c" name="current" type="password" className="input" autoComplete="current-password" /></div>
          <div className="field"><label htmlFor="me-w">New password</label><input id="me-w" name="password" type="password" className="input" autoComplete="new-password" /></div>
          <div className="full"><Msg s={s2} /></div>
          <div><button className="btn solid" disabled={p2}>Change password</button></div>
        </form>
      </Card>
    </>
  );
}
