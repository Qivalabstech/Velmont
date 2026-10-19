"use client";
import { useRouter, useSearchParams } from "next/navigation";

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  return (
    <div>
      <label htmlFor="sort" className="sr-only">Sort by</label>
      <select id="sort" className="select" value={value} onChange={(e) => {
        const p = new URLSearchParams(sp.toString());
        if (e.target.value) p.set("sort", e.target.value); else p.delete("sort");
        router.push(`/shop${p.toString() ? `?${p}` : ""}`);
      }}>
        <option value="">Sort: Featured</option>
        <option value="new">Newest</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
      </select>
    </div>
  );
}
