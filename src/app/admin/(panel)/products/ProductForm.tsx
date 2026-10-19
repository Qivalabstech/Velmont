"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AForm, Submit } from "@/components/admin/Form";
import { Card } from "@/components/admin/ui";
import { saveProduct, saveProductSeo } from "./actions";
import { slugify } from "@/lib/utils";

type Img = { id?: string; url: string; alt: string };
type Var = { id?: string; size: string; sku: string; stock: number; active: boolean };
type P = {
  id: string; name: string; slug: string; tagline: string; description: string; price: number; mrp: number; status: string; featured: boolean;
  badge: string | null; categoryId: string | null; leather: string; buckle: string; width: string; care: string; colors: string[]; tags: string[];
  hsn: string; gstRate: number | null; seoTitle: string; seoDescription: string; sortOrder: number; images: Img[]; variants: Var[];
};

const STD = ["30", "32", "34", "36", "38", "40"];

export function ProductForm({ p, categories, readOnly = false, seoOnly = false }: { p?: P; categories: { id: string; name: string }[]; readOnly?: boolean; seoOnly?: boolean }) {
  const [name, setName] = useState(p?.name || "");
  const [slug, setSlug] = useState(p?.slug || "");
  const [slugTouched, setSlugTouched] = useState(!!p);
  const [imgs, setImgs] = useState<Img[]>(p?.images || []);
  const [pending, setPending] = useState<{ file: File; url: string; alt: string }[]>([]);
  const [vars, setVars] = useState<Var[]>(p?.variants || []);
  const [seoT, setSeoT] = useState(p?.seoTitle || "");
  const [seoD, setSeoD] = useState(p?.seoDescription || "");
  const [desc, setDesc] = useState(p?.description || "");
  const fileRef = useRef<HTMLInputElement>(null);
  // After a save the server sends fresh images and sizes; adopt them without remounting the form.
  const version = p ? JSON.stringify([p.images.map((i) => i.id), p.variants.map((v) => [v.id, v.stock])]) : "";
  useEffect(() => {
    if (!p) return;
    setImgs(p.images); setVars(p.variants); setPending([]);
    if (fileRef.current) fileRef.current.value = "";
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const lock = readOnly && !seoOnly;
  const off = readOnly; // general fields disabled when read-only or seo-only

  const code = useMemo(() => (slugify(name).replace(/^the-/, "").slice(0, 3) || "NEW").toUpperCase(), [name]);
  const syncFiles = (list: typeof pending) => {
    const dt = new DataTransfer();
    list.forEach((x) => dt.items.add(x.file));
    if (fileRef.current) fileRef.current.files = dt.files;
  };
  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next = [...pending, ...Array.from(files).filter((f) => f.type.startsWith("image/")).map((file) => ({ file, url: URL.createObjectURL(file), alt: name }))];
    setPending(next); syncFiles(next);
  };
  const move = (i: number, d: number) => setImgs((a) => { const b = [...a]; const j = i + d; if (j < 0 || j >= b.length) return a; [b[i], b[j]] = [b[j], b[i]]; return b; });
  const setVar = (i: number, patch: Partial<Var>) => setVars((a) => a.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const words = desc.trim().split(/\s+/).filter(Boolean).length;
  const previewTitle = (seoT || name || "Product name") + " | VELMONT";
  const previewDesc = seoD || p?.tagline || "Add a meta description so search results show a clear summary.";

  return (
    <AForm action={seoOnly ? saveProductSeo : saveProduct} refresh>
      {p && <input type="hidden" name="id" value={p.id} />}
      <input type="hidden" name="imagesJson" value={JSON.stringify(imgs)} />
      <input type="hidden" name="newAltsJson" value={JSON.stringify(pending.map((x) => x.alt))} />
      <input type="hidden" name="variantsJson" value={JSON.stringify(vars)} />
      <input ref={fileRef} type="file" name="newImages" multiple accept="image/*" hidden />
      {seoOnly && <div className="hint-box" style={{ marginBottom: 16 }}>Your role can edit the web address, SEO title, description and photo alt text. Other fields are read-only.</div>}
      <div className="cols">
        <div className="stack">
          <Card title="Details">
            <fieldset disabled={off} style={{ border: 0, padding: 0, margin: 0 }} className="fgrid">
              <div className="field full"><label htmlFor="p-name">Name</label>
                <input id="p-name" name="name" className="input" value={name} onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} required /></div>
              <div className="field full"><label htmlFor="p-tag">Tagline</label><input id="p-tag" name="tagline" className="input" defaultValue={p?.tagline} maxLength={160} placeholder="One line shown under the name" /></div>
              <div className="field full"><label htmlFor="p-desc">Description</label>
                <textarea id="p-desc" name="description" className="textarea" style={{ minHeight: 200 }} value={desc} onChange={(e) => setDesc(e.target.value)} />
                <span className="hint">{words} words. Leave a blank line between paragraphs. 80+ words helps search engines and AI assistants describe the belt.</span></div>
            </fieldset>
          </Card>

          <Card title="Photos" sub="The first photo is the cover. JPG, PNG or WebP up to 10 MB; we convert them to fast WebP.">
            <div className="imgs">
              {imgs.map((im, i) => (
                <div className="im" key={im.id || im.url}>
                  {i === 0 && <span className="pill good first">Cover</span>}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.url} alt="" />
                  <label className="sr-only" htmlFor={`alt-${i}`}>Alt text</label>
                  <input id={`alt-${i}`} className="input sm" value={im.alt} placeholder="Describe the photo" onChange={(e) => setImgs((a) => a.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} disabled={lock} />
                  {!off && <div className="row">
                    <button type="button" onClick={() => move(i, -1)} aria-label="Move left">←</button>
                    <button type="button" onClick={() => move(i, 1)} aria-label="Move right">→</button>
                    <button type="button" onClick={() => setImgs((a) => a.filter((_, j) => j !== i))} style={{ color: "var(--bad)" }}>Remove</button>
                  </div>}
                </div>
              ))}
              {pending.map((x, i) => (
                <div className="im" key={x.url}>
                  <span className="pill info first">New</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={x.url} alt="" />
                  <input className="input sm" value={x.alt} placeholder="Describe the photo" aria-label="Alt text" onChange={(e) => setPending((a) => a.map((y, j) => (j === i ? { ...y, alt: e.target.value } : y)))} />
                  <div className="row"><span /><button type="button" style={{ color: "var(--bad)" }} onClick={() => { const n = pending.filter((_, j) => j !== i); setPending(n); syncFiles(n); }}>Remove</button></div>
                </div>
              ))}
              {!off && (
                <label className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                  <span>＋ Add photos<br /><small>or drop them here</small></span>
                </label>
              )}
            </div>
          </Card>

          <Card title="Sizes and stock" actions={!off && (
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="btn sm" onClick={() => setVars((a) => { const have = new Set(a.map((v) => v.size)); return [...a, ...STD.filter((s) => !have.has(s)).map((s) => ({ size: s, sku: `VM-${code}-${s}`, stock: 0, active: true }))]; })}>Add sizes 30–40</button>
              <button type="button" className="btn sm" onClick={() => setVars((a) => [...a, { size: "", sku: `VM-${code}-`, stock: 0, active: true }])}>Add size</button>
            </div>)} flush>
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Size</th><th>SKU</th><th>Stock</th><th>On sale</th><th></th></tr></thead>
              <tbody>
                {vars.map((v, i) => (
                  <tr key={v.id || i}>
                    <td><input className="input sm" style={{ width: 70 }} value={v.size} onChange={(e) => setVar(i, { size: e.target.value })} aria-label="Size" disabled={off} /></td>
                    <td><input className="input sm" style={{ minWidth: 130 }} value={v.sku} onChange={(e) => setVar(i, { sku: e.target.value })} aria-label="SKU" disabled={off} /></td>
                    <td><input className="input sm num-in" type="number" min={0} value={v.stock} onChange={(e) => setVar(i, { stock: Number(e.target.value) })} aria-label={`Stock for size ${v.size}`} disabled={off} /></td>
                    <td><input type="checkbox" checked={v.active} onChange={(e) => setVar(i, { active: e.target.checked })} aria-label="On sale" style={{ width: 18, height: 18 }} disabled={off} /></td>
                    <td>{!off && <button type="button" className="link-btn" style={{ color: "var(--bad)", background: "none", border: 0 }} onClick={() => setVars((a) => a.filter((_, j) => j !== i))}>Remove</button>}</td>
                  </tr>
                ))}
                {!vars.length && <tr><td colSpan={5} className="empty">No sizes yet. Use “Add sizes 30–40”.</td></tr>}
              </tbody>
            </table></div>
          </Card>

          <Card title="Search and AI listing" sub="How this belt appears on Google and in AI answers.">
            <div className="fgrid">
              <div className="field full"><label htmlFor="p-slug">Web address</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span className="muted" style={{ fontSize: ".85rem" }}>/products/</span>
                  <input id="p-slug" name="slug" className="input" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} disabled={lock} /></div>
                {p && slug !== p.slug && <span className="hint" style={{ color: "var(--warn)" }}>Changing the address breaks old links. Add a redirect from /products/{p.slug} in SEO & AI search.</span>}</div>
              <div className="field full"><label htmlFor="p-st">SEO title <span className="muted">({seoT.length}/60)</span></label><input id="p-st" name="seoTitle" className="input" value={seoT} onChange={(e) => setSeoT(e.target.value)} placeholder={name} disabled={lock} /></div>
              <div className="field full"><label htmlFor="p-sd">Meta description <span className="muted">({seoD.length}/160)</span></label><textarea id="p-sd" name="seoDescription" className="textarea" style={{ minHeight: 70 }} value={seoD} onChange={(e) => setSeoD(e.target.value)} disabled={lock} /></div>
              <div className="full" style={{ background: "#fff", border: "1px solid var(--line)", padding: 14, borderRadius: 4 }}>
                <div style={{ fontSize: ".75rem", color: "#4d5156" }}>velmont.in › products › {slug || "…"}</div>
                <div style={{ color: "#1a0dab", fontSize: "1.1rem", margin: "2px 0" }}>{previewTitle.slice(0, 70)}{previewTitle.length > 70 ? "…" : ""}</div>
                <div style={{ fontSize: ".86rem", color: "#4d5156" }}>{previewDesc.slice(0, 160)}{previewDesc.length > 160 ? "…" : ""}</div>
              </div>
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Status">
            <fieldset disabled={off} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 12 }}>
              <div className="field"><label htmlFor="p-status">Visibility</label>
                <select id="p-status" name="status" className="select" defaultValue={p?.status || "DRAFT"}>
                  <option value="ACTIVE">Active: on sale</option><option value="DRAFT">Draft: hidden</option><option value="ARCHIVED">Archived: hidden</option>
                </select></div>
              <label className="check"><input type="checkbox" name="featured" defaultChecked={p?.featured ?? true} />Show in the homepage carousel</label>
              <div className="field"><label htmlFor="p-badge">Badge</label><input id="p-badge" name="badge" className="input" defaultValue={p?.badge || ""} placeholder="e.g. New, Bestseller" /></div>
              <div className="field"><label htmlFor="p-cat">Category</label>
                <select id="p-cat" name="categoryId" className="select" defaultValue={p?.categoryId || ""}><option value="">None</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="field"><label htmlFor="p-sort">Sort position</label><input id="p-sort" name="sortOrder" type="number" className="input" defaultValue={p?.sortOrder ?? 0} /><span className="hint">Lower numbers show first.</span></div>
            </fieldset>
          </Card>
          <Card title="Pricing" sub="Prices include GST.">
            <fieldset disabled={off} style={{ border: 0, padding: 0, margin: 0 }} className="fgrid">
              <div className="field"><label htmlFor="p-price">Selling price (₹)</label><input id="p-price" name="price" type="number" step="0.01" min="1" className="input" defaultValue={p ? p.price / 100 : ""} required /></div>
              <div className="field"><label htmlFor="p-mrp">MRP (₹)</label><input id="p-mrp" name="mrp" type="number" step="0.01" min="1" className="input" defaultValue={p ? p.mrp / 100 : ""} /></div>
              <div className="field"><label htmlFor="p-hsn">HSN code</label><input id="p-hsn" name="hsn" className="input" defaultValue={p?.hsn || "4203"} /></div>
              <div className="field"><label htmlFor="p-gst">GST % <span className="muted">(blank = store default)</span></label><input id="p-gst" name="gstRate" type="number" min={0} max={28} className="input" defaultValue={p?.gstRate ?? ""} /></div>
            </fieldset>
          </Card>
          <Card title="Materials">
            <fieldset disabled={off} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 12 }}>
              <div className="field"><label htmlFor="p-leather">Leather</label><input id="p-leather" name="leather" className="input" defaultValue={p?.leather} /></div>
              <div className="field"><label htmlFor="p-buckle">Buckle</label><input id="p-buckle" name="buckle" className="input" defaultValue={p?.buckle} /></div>
              <div className="field"><label htmlFor="p-width">Width</label><input id="p-width" name="width" className="input" defaultValue={p?.width || "1.5 in (38 mm)"} /></div>
              <div className="field"><label htmlFor="p-care">Care</label><textarea id="p-care" name="care" className="textarea" style={{ minHeight: 70 }} defaultValue={p?.care} /></div>
              <div className="field"><label htmlFor="p-colors">Colour dots</label><input id="p-colors" name="colors" className="input" defaultValue={p?.colors.join(", ")} placeholder="#3A2418, #E5B92B" /><span className="hint">Hex colours, comma separated.</span></div>
              <div className="field"><label htmlFor="p-tags">Filter tags</label><input id="p-tags" name="tags" className="input" defaultValue={p?.tags.join(", ")} placeholder="beaded, painted, dark" /><span className="hint">Used by shop filters: beaded, painted, dark.</span></div>
            </fieldset>
          </Card>
        </div>
      </div>
      {!(readOnly && !seoOnly) && (
        <div className="savebar">
          <Submit pendingText={pending.length ? "Uploading photos…" : "Saving…"}>{p ? "Save changes" : "Create product"}</Submit>
        </div>
      )}
    </AForm>
  );
}
