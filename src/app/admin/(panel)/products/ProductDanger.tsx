"use client";
import { AForm, ConfirmSubmit, Submit } from "@/components/admin/Form";
import { Card } from "@/components/admin/ui";
import { deleteProduct, duplicateProduct } from "./actions";

export function ProductDanger({ id }: { id: string }) {
  return (
    <div style={{ marginTop: 16 }}>
      <Card title="More actions">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <AForm action={duplicateProduct}><input type="hidden" name="id" value={id} /><Submit className="btn sm" pendingText="Copying…">Duplicate as draft</Submit></AForm>
          <AForm action={deleteProduct}><input type="hidden" name="id" value={id} /><ConfirmSubmit confirmText="Click again to delete">Delete product</ConfirmSubmit></AForm>
        </div>
        <p className="muted" style={{ fontSize: ".82rem", margin: "10px 0 0" }}>Products with past orders are archived instead of deleted, so invoices and order history stay intact.</p>
      </Card>
    </div>
  );
}
