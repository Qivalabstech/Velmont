"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

export type ActionState = { ok?: string; error?: string; at?: number } | null;
type Act = (s: ActionState, fd: FormData) => Promise<ActionState>;

/** Page-level toast. Lives in the admin shell so messages survive when the form that sent them re-renders away. */
export function ToastHost() {
  const [t, setT] = useState<{ text: string; bad: boolean; id: number } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ text: string; bad: boolean }>).detail;
      setT({ ...d, id: Date.now() });
      clearTimeout(timer);
      timer = setTimeout(() => setT(null), d.bad ? 7000 : 4500);
    };
    window.addEventListener("vm-toast", on);
    return () => { window.removeEventListener("vm-toast", on); clearTimeout(timer); };
  }, []);
  if (!t) return null;
  return <div key={t.id} className={`toastx${t.bad ? " bad" : ""}`} role="status" aria-live="polite">{t.text}</div>;
}

export function showToast(text: string, bad = false) {
  window.dispatchEvent(new CustomEvent("vm-toast", { detail: { text, bad } }));
}

/** A form that runs an admin server action and shows the result as a toast. */
export function AForm({ action, children, className, style, reset, refresh = true, id, onOk }: {
  action: Act; children: React.ReactNode; className?: string; style?: React.CSSProperties; reset?: boolean; refresh?: boolean; id?: string; onOk?: () => void;
}) {
  // Toast from the action's own promise: the form may be gone after the server re-renders (e.g. an approved review leaves the list).
  const [state, act] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await action(prev, fd);
    if (r?.ok || r?.error) showToast((r.ok || r.error)!, !!r.error);
    return r;
  }, null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      if (reset) ref.current?.reset();
      if (refresh) router.refresh();
      onOk?.();
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form ref={ref} action={act} className={className} style={style} id={id}>
      {children}
      {state?.error && <div className="err" role="alert" style={{ gridColumn: "1/-1" }}>{state.error}</div>}
    </form>
  );
}

/** React form actions do not include the clicked button's name/value, so copy it into a hidden field first. */
function carrySubmitter(e: React.MouseEvent<HTMLButtonElement>, name?: string, value?: string) {
  const form = e.currentTarget.form;
  if (!form || !name) return;
  let h = form.querySelector<HTMLInputElement>(`input[type=hidden][data-submitter="${name}"]`);
  if (!h) { h = document.createElement("input"); h.type = "hidden"; h.name = name; h.dataset.submitter = name; form.appendChild(h); }
  h.value = value ?? "";
}

export function Submit({ children, className = "btn solid", pendingText = "Saving…", disabled, name, value }: {
  children: React.ReactNode; className?: string; pendingText?: string; disabled?: boolean; name?: string; value?: string;
}) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending || disabled} onClick={(e) => carrySubmitter(e, name, value)}>{pending ? pendingText : children}</button>;
}

/** Two-step button for destructive actions; the page cannot use confirm() dialogs reliably on all devices. */
export function ConfirmSubmit({ children, confirmText = "Click again to confirm", className = "btn danger sm", name, value }: {
  children: React.ReactNode; confirmText?: string; className?: string; name?: string; value?: string;
}) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  // Separate keys give two different DOM buttons, so the arming click can never submit the form.
  if (!armed) return <button key="arm" type="button" className={className} onClick={(e) => { e.preventDefault(); setArmed(true); }}>{children}</button>;
  return <button key="confirm" type="submit" className={className} disabled={pending} onClick={(e) => carrySubmitter(e, name, value)} style={{ background: "var(--bad)", color: "#fff" }} autoFocus>{pending ? "Working…" : confirmText}</button>;
}
