"use client";
import { useState } from "react";
import { AForm, Submit, ConfirmSubmit } from "@/components/admin/Form";
import { changeStatus, addNote, refund, editAddress, saveInternalNote, markCodCollected, updateTracking } from "../actions";
import { STATUS_LABEL } from "@/lib/order-status";
import { INDIAN_STATES } from "@/lib/utils";
import type { OrderStatus, ShippingAddress } from "@/db/schema";

function TrackingFields({ couriers, courier, awb, trackingUrl }: { couriers: string[]; courier: string; awb: string; trackingUrl: string }) {
  return (
    <>
      <div className="field"><label htmlFor="o-courier">Courier</label>
        <select id="o-courier" name="courier" className="select" defaultValue={courier || couriers[0]}>{couriers.map((c) => <option key={c}>{c}</option>)}</select></div>
      <div className="field"><label htmlFor="o-awb">Tracking number (AWB)</label><input id="o-awb" name="awb" className="input" defaultValue={awb} /></div>
      <div className="field full"><label htmlFor="o-turl">Tracking link <span className="muted">(filled automatically for known couriers)</span></label><input id="o-turl" name="trackingUrl" className="input" defaultValue={trackingUrl} placeholder="https://" /></div>
    </>
  );
}

export function StatusForm({ id, current, next, couriers, courier, awb, trackingUrl }: { id: string; current: OrderStatus; next: OrderStatus[]; couriers: string[]; courier: string; awb: string; trackingUrl: string }) {
  const [status, setStatus] = useState<OrderStatus>(next[0]);
  return (
    <AForm action={changeStatus} className="fgrid">
      <input type="hidden" name="id" value={id} />
      <div className="field full"><span className="lbl">Move from “{STATUS_LABEL[current]}” to</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {next.map((s) => (
            <label key={s} className={`btn sm${status === s ? " solid" : ""}`} style={s === "CANCELLED" ? { borderColor: "var(--bad)", color: status === s ? "#fff" : "var(--bad)", background: status === s ? "var(--bad)" : undefined } : undefined}>
              <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} className="sr-only" />{STATUS_LABEL[s]}
            </label>
          ))}
        </div>
      </div>
      {status === "SHIPPED" && <TrackingFields couriers={couriers} courier={courier} awb={awb} trackingUrl={trackingUrl} />}
      <div className="field full"><label htmlFor="o-note">Message to the customer <span className="muted">(optional)</span></label>
        <input id="o-note" name="note" className="input" placeholder={status === "SHIPPED" ? "e.g. Your belt is on its way!" : ""} /></div>
      {status === "CANCELLED" && <label className="check full"><input type="checkbox" name="restock" defaultChecked />Put the items back in stock</label>}
      <label className="check full"><input type="checkbox" name="notify" defaultChecked />Notify customer by email</label>
      <div className="full">{status === "CANCELLED" ? <ConfirmSubmit className="btn danger" confirmText="Click again to cancel the order">Cancel order</ConfirmSubmit> : <Submit>Update to {STATUS_LABEL[status].toLowerCase()}</Submit>}</div>
    </AForm>
  );
}

export function TrackingForm(p: { id: string; couriers: string[]; courier: string; awb: string; trackingUrl: string }) {
  return (
    <AForm action={updateTracking} className="fgrid">
      <input type="hidden" name="id" value={p.id} />
      <TrackingFields {...p} />
      <div><Submit className="btn sm">Save tracking</Submit></div>
    </AForm>
  );
}

export function NoteForm({ id }: { id: string }) {
  return (
    <AForm action={addNote} reset className="fgrid" style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
      <input type="hidden" name="id" value={id} />
      <div className="field full"><label htmlFor="n-note">Add to timeline</label><textarea id="n-note" name="note" className="textarea" style={{ minHeight: 70 }} /></div>
      <label className="check"><input type="checkbox" name="visible" />Show on the customer’s tracking page</label>
      <div style={{ justifySelf: "end" }}><Submit className="btn sm">Add note</Submit></div>
    </AForm>
  );
}

export function RefundForm({ id, max, online }: { id: string; max: number; online: boolean }) {
  return (
    <AForm action={refund} className="fgrid">
      <input type="hidden" name="id" value={id} />
      <div className="field"><label htmlFor="r-amt">Amount (₹)</label><input id="r-amt" name="amount" type="number" step="0.01" min="1" max={max} defaultValue={max} className="input" /></div>
      <div className="field"><label htmlFor="r-mode">How</label>
        <select id="r-mode" name="mode" className="select" defaultValue={online ? "gateway" : "manual"}>
          {online && <option value="gateway">Refund through Razorpay</option>}
          <option value="manual">Already refunded (bank / UPI)</option>
        </select></div>
      <div className="field full"><label htmlFor="r-why">Reason</label><input id="r-why" name="reason" className="input" placeholder="e.g. Size exchange not possible" /></div>
      <div className="full"><ConfirmSubmit className="btn danger" confirmText="Click again to refund">Issue refund</ConfirmSubmit></div>
    </AForm>
  );
}

export function AddressForm({ id, a }: { id: string; a: ShippingAddress }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button className="btn sm" onClick={() => setOpen(true)}>Edit address</button>;
  return (
    <AForm action={editAddress} className="fgrid" onOk={() => setOpen(false)}>
      <input type="hidden" name="id" value={id} />
      <div className="field"><label htmlFor="ea-n">Name</label><input id="ea-n" name="name" className="input sm" defaultValue={a.name} /></div>
      <div className="field"><label htmlFor="ea-p">Phone</label><input id="ea-p" name="phone" className="input sm" defaultValue={a.phone} /></div>
      <div className="field full"><label htmlFor="ea-1">Street</label><input id="ea-1" name="line1" className="input sm" defaultValue={a.line1} /></div>
      <div className="field full"><label htmlFor="ea-2">Area</label><input id="ea-2" name="line2" className="input sm" defaultValue={a.line2} /></div>
      <div className="field"><label htmlFor="ea-c">City</label><input id="ea-c" name="city" className="input sm" defaultValue={a.city} /></div>
      <div className="field"><label htmlFor="ea-z">Pincode</label><input id="ea-z" name="pincode" className="input sm" defaultValue={a.pincode} /></div>
      <div className="field full"><label htmlFor="ea-s">State</label><select id="ea-s" name="state" className="select sm" defaultValue={a.state}>{INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}</select></div>
      <div className="full" style={{ display: "flex", gap: 8 }}><Submit className="btn sm solid">Save</Submit><button type="button" className="btn sm" onClick={() => setOpen(false)}>Cancel</button></div>
    </AForm>
  );
}

export function InternalNote({ id, value }: { id: string; value: string }) {
  return (
    <AForm action={saveInternalNote} style={{ display: "grid", gap: 10 }}>
      <input type="hidden" name="id" value={id} />
      <label htmlFor="in-note" className="sr-only">Staff note</label>
      <textarea id="in-note" name="internalNote" className="textarea" defaultValue={value} style={{ minHeight: 80 }} />
      <div><Submit className="btn sm">Save note</Submit></div>
    </AForm>
  );
}

export function CodForm({ id }: { id: string }) {
  return (
    <AForm action={markCodCollected} style={{ marginTop: 12 }}>
      <input type="hidden" name="id" value={id} />
      <Submit className="btn sm">Mark cash collected</Submit>
    </AForm>
  );
}
