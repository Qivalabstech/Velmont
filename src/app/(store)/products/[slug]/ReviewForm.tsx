"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { submitReview } from "@/app/(store)/actions";

export function ReviewForm({ productId, signedIn, slug }: { productId: string; signedIn: boolean; slug: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [state, action, pending] = useActionState(submitReview, null);
  if (!signedIn) return <p style={{ fontSize: ".9rem" }}><Link href={`/account/login?next=/products/${slug}%23reviews`}>Sign in to write a review</Link></p>;
  if (state?.ok) return <div className="alert good">Thanks. Your review will appear once our team has checked it.</div>;
  if (!open) return <button className="btn sm" onClick={() => setOpen(true)}>Write a review</button>;
  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating} />
      <div className="field">
        <span className="lbl">Your rating</span>
        <div role="radiogroup" aria-label="Rating" style={{ display: "flex", gap: 4 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setRating(n)} style={{ background: "none", border: 0, fontSize: "1.6rem", color: n <= rating ? "var(--saddle)" : "var(--line-strong)", padding: 2 }}>★</button>
          ))}
        </div>
      </div>
      <div className="field"><label htmlFor="rv-title">Headline</label><input id="rv-title" name="title" className="input" maxLength={120} /></div>
      <div className="field"><label htmlFor="rv-body">Your review</label><textarea id="rv-body" name="body" className="textarea" required minLength={20} placeholder="How is the fit, the leather, the finish?" /></div>
      {state?.error && <div className="err">{state.error}</div>}
      <button className="btn solid" disabled={pending}>{pending ? "Sending…" : "Submit review"}</button>
    </form>
  );
}
