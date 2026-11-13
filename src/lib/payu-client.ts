"use client";
/** Sends the customer to PayU's hosted checkout by posting the signed form. PayU posts back to our return URL. */
export function submitPayu(form: { action: string; fields: Record<string, string> }) {
  const f = document.createElement("form");
  f.method = "POST"; f.action = form.action; f.style.display = "none";
  for (const [k, v] of Object.entries(form.fields)) {
    const i = document.createElement("input");
    i.type = "hidden"; i.name = k; i.value = v; f.appendChild(i);
  }
  document.body.appendChild(f);
  f.submit();
}
