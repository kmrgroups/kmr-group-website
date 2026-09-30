"use client";
import Link from "next/link";
import { useState } from "react";

export type Benefit = { id: string; product: string; tagline?: string; link?: string; productivity?: string; quality?: string; cost?: string; delivery?: string };

const ROWS: { k: "productivity" | "quality" | "cost" | "delivery"; letter: string; label: string }[] = [
  { k: "productivity", letter: "P", label: "Productivity" },
  { k: "quality", letter: "Q", label: "Quality" },
  { k: "cost", letter: "C", label: "Cost" },
  { k: "delivery", letter: "D", label: "Delivery" },
];

/** Product-wise benefits: pick a product, see what it does for Productivity, Quality, Cost and Delivery. */
export default function BenefitTabs({ items }: { items: Benefit[] }) {
  const [i, setI] = useState(0);
  const b = items[i];
  if (!b) return null;
  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0" role="tablist" aria-label="Products">
        {items.map((x, k) => (
          <button key={x.id} role="tab" aria-selected={k === i} onClick={() => setI(k)}
            className={`shrink-0 border px-4 py-3 text-left transition-colors lg:w-full ${k === i ? "border-gold bg-navy text-white" : "border-line bg-white text-navy hover:border-gold"}`}>
            <span className="block text-[15px] font-semibold">{x.product}</span>
            {x.tagline && <span className={`mt-0.5 hidden text-xs lg:block ${k === i ? "text-white/65" : "text-muted"}`}>{x.tagline}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="card p-6 md:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div><p className="eyebrow mb-2">What it does for you</p><h3 className="font-display text-2xl font-semibold text-navy">{b.product}</h3></div>
          {b.link && <Link href={b.link} className="btn-outline">Learn more →</Link>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {ROWS.filter((r) => b[r.k]).map((r) => (
            <div key={r.k} className="flex gap-4 border border-line bg-ivory p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center bg-gold font-display text-xl font-bold text-navy-950">{r.letter}</span>
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-dark">{r.label}</p><p className="mt-1 text-sm leading-relaxed text-ink/80">{b[r.k]}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
