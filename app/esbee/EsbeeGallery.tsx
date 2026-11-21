"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

export type GalleryItem = { src: string; title: string; note?: string; w: number; h: number };

/** Photo grid with click-to-enlarge (full picture, nothing cropped). */
export default function EsbeeGallery({ items, cols = "lg:grid-cols-4" }: { items: GalleryItem[]; cols?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % items.length)); if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + items.length) % items.length)); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open, items.length]);
  const cur = open === null ? null : items[open];
  return (
    <>
      <div className={`grid grid-cols-2 gap-4 sm:grid-cols-3 ${cols}`}>
        {items.map((it, i) => (
          <button key={it.src} type="button" onClick={() => setOpen(i)} className="group overflow-hidden border border-slate-200 bg-white text-left shadow-sm transition hover:shadow-xl">
            <div className="relative aspect-[4/3] bg-slate-100"><Image src={it.src} alt={it.title} fill sizes="(min-width:1024px) 20vw, 50vw" className="object-contain p-1 transition group-hover:scale-[1.02]" /></div>
            <div className="border-t border-slate-100 px-3.5 py-3"><div className="text-[13.5px] font-semibold leading-snug text-[#0A1F44]">{it.title}</div>{it.note && <div className="mt-0.5 text-[12px] text-slate-500">{it.note}</div>}</div>
          </button>
        ))}
      </div>
      {cur && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <button type="button" aria-label="Close" className="absolute right-4 top-4 rounded-sm bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/20" onClick={() => setOpen(null)}>Close ✕</button>
          <button type="button" aria-label="Previous" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-sm bg-white/10 px-3 py-3 text-xl text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setOpen((open! - 1 + items.length) % items.length); }}>‹</button>
          <button type="button" aria-label="Next" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm bg-white/10 px-3 py-3 text-xl text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setOpen((open! + 1) % items.length); }}>›</button>
          <figure className="flex max-h-full max-w-5xl flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cur.src} alt={cur.title} className="max-h-[80vh] w-auto max-w-full object-contain" />
            <figcaption className="mt-3 text-center text-sm text-white"><span className="font-semibold">{cur.title}</span>{cur.note ? ` — ${cur.note}` : ""}</figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
