"use client";
import { useState } from "react";
import { AForm, Submit, ConfirmSubmit } from "@/components/admin/Form";
import { saveCoupon, deleteCoupon } from "./actions";

type C = { id: string; code: string; description: string; type: string; value: number; minSubtotal: number; maxDiscount: number | null; usageLimit: number | null; perCustomerLimit: number | null; startsAt: string; endsAt: string; active: boolean };

export function CouponForm({ c }: { c?: C }) {
  const [type, setType] = useState(c?.type || "PERCENT");
  const k = c?.id || "new";
  return (
    <>
      <AForm action={saveCoupon} reset={!c} className="fgrid three">
        {c && <input type="hidden" name="id" value={c.id} />}
        <div className="field"><label htmlFor={`cc-${k}`}>Code</label><input id={`cc-${k}`} name="code" className="input" defaultValue={c?.code} style={{ textTransform: "uppercase" }} required /></div>
        <div className="field"><label htmlFor={`ct-${k}`}>Type</label>
          <select id={`ct-${k}`} name="type" className="select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="PERCENT">Percent off</option><option value="FIXED">Rupees off</option><option value="FREE_SHIPPING">Free shipping</option></select></div>
        {type !== "FREE_SHIPPING" && <div className="field"><label htmlFor={`cv-${k}`}>{type === "PERCENT" ? "Percent" : "Amount (₹)"}</label>
          <input id={`cv-${k}`} name="value" type="number" step={type === "PERCENT" ? 1 : 0.01} className="input" defaultValue={c ? (c.type === "FIXED" ? c.value / 100 : c.value) : ""} /></div>}
        <div className="field full"><label htmlFor={`cd-${k}`}>Note for staff</label><input id={`cd-${k}`} name="description" className="input" defaultValue={c?.description} placeholder="e.g. Instagram launch offer" /></div>
        <div className="field"><label htmlFor={`cm-${k}`}>Minimum order (₹)</label><input id={`cm-${k}`} name="minSubtotal" type="number" className="input" defaultValue={c ? c.minSubtotal / 100 : 0} /></div>
        {type === "PERCENT" && <div className="field"><label htmlFor={`cx-${k}`}>Maximum off (₹)</label><input id={`cx-${k}`} name="maxDiscount" type="number" className="input" defaultValue={c?.maxDiscount != null ? c.maxDiscount / 100 : ""} /></div>}
        <div className="field"><label htmlFor={`cu-${k}`}>Total uses</label><input id={`cu-${k}`} name="usageLimit" type="number" className="input" defaultValue={c?.usageLimit ?? ""} placeholder="Unlimited" /></div>
        <div className="field"><label htmlFor={`cp-${k}`}>Uses per customer</label><input id={`cp-${k}`} name="perCustomerLimit" type="number" className="input" defaultValue={c?.perCustomerLimit ?? ""} placeholder="Unlimited" /></div>
        <div className="field"><label htmlFor={`cs-${k}`}>Starts</label><input id={`cs-${k}`} name="startsAt" type="date" className="input" defaultValue={c?.startsAt} /></div>
        <div className="field"><label htmlFor={`ce-${k}`}>Ends</label><input id={`ce-${k}`} name="endsAt" type="date" className="input" defaultValue={c?.endsAt} /></div>
        <label className="check full"><input type="checkbox" name="active" defaultChecked={c?.active ?? true} />Active</label>
        <div><Submit>{c ? "Save code" : "Create code"}</Submit></div>
      </AForm>
      {c && <AForm action={deleteCoupon} style={{ marginTop: 10 }}><input type="hidden" name="id" value={c.id} /><ConfirmSubmit>Delete code</ConfirmSubmit></AForm>}
    </>
  );
}
