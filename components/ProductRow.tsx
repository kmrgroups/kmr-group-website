import Link from "next/link";
import FitImage from "@/components/FitImage";
import type { Product } from "@/lib/types";
import { inr } from "@/lib/site";
import { productArt } from "@/lib/art";
import { canBuy } from "./ProductCard";
import { IconArrow } from "./Icons";

/** A wide, compact card for programmes and services — reads well whether there is one item or ten. */
export default function ProductRow({ p }: { p: Product }) {
  const buy = canBuy(p);
  const facts = [p.details?.duration, p.details?.mode, p.details?.schedule].filter(Boolean).join(" · ");
  const intro = (p.description ?? "").split(/\n\s*\n/)[0].replace(/^[-•*]\s+/gm, "").replace(/\s+/g, " ").trim();
  return (
    <Link href={`/products/${p.id}`} className={`card-hover group grid items-center gap-5 p-4 sm:p-5 sm:grid-cols-[160px_1fr_auto]`}>
      <div className="aspect-[16/10] overflow-hidden border border-line bg-white sm:aspect-[8/5]"><FitImage src={productArt(p)} alt={p.name} className="h-full w-full" fill={p.image_url ? "plain" : "none"} imgClassName={p.image_url ? "" : "object-cover"} /></div>
      <div className="min-w-0">
        {p.category && <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-dark">{p.category}</p>}
        <h3 className="mt-1 font-display text-lg font-semibold leading-snug text-navy">{p.name}</h3>
        {facts && <p className="mt-0.5 text-sm text-muted">{facts}</p>}
        {intro && <p className="mt-1.5 line-clamp-2 text-sm text-ink/70">{intro}</p>}
      </div>
      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
        <span className={`whitespace-nowrap text-sm font-semibold ${buy ? "text-navy" : "text-gold-dark"}`}>{buy ? inr(p.price) : Number(p.price) > 0 ? `From ${inr(p.price)}${p.unit ? ` / ${p.unit}` : ""}` : "Price on request"}</span>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-gold-dark">{buy ? (p.kind === "course" ? "Enrol" : "View") : "Enquire"} <IconArrow className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span>
      </div>
    </Link>
  );
}
