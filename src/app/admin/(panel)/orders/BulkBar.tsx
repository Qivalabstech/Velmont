"use client";
import { AForm, Submit } from "@/components/admin/Form";
import { bulkStatus } from "./actions";

export function BulkBar({ enabled, formId, children, shiprocket = false }: { enabled: boolean; formId: string; children: React.ReactNode; shiprocket?: boolean }) {
  if (!enabled) return <>{children}</>;
  return (
    <>
      <AForm action={bulkStatus} id={formId} className="toolbar" style={{ padding: "12px 14px", margin: 0, borderBottom: "1px solid var(--line)" }}>
        <span className="muted" style={{ fontSize: ".85rem" }}>With selected:</span>
        <Submit className="btn sm" name="status" value="CONFIRMED" pendingText="Updating…">Mark confirmed</Submit>
        <Submit className="btn sm" name="status" value="PACKED" pendingText="Updating…">Mark packed</Submit>
        {shiprocket && <Submit className="btn sm" name="status" value="SHIPROCKET" pendingText="Booking…">Ship with Shiprocket</Submit>}
      </AForm>
      {children}
    </>
  );
}
