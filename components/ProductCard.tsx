import Link from "next/link";
import FitImage from "@/components/FitImage";
import type { Product } from "@/lib/types";
import { inr } from "@/lib/site";
import { productArt } from "@/lib/art";
import { IconArrow } from "./Icons";

export { inr };
export const canBuy = (p: Product) => !p.enquiry_only && ["shop", "training"].includes(p.business ?? "shop") && Number(p.price) > 0;

/** Catalogue card for every business: shop goods, courses, software solutions and trade items. */
export default function ProductCard({ p }: { p: Product }) {
  const buy = canBuy(p);
  const off = p.mrp && p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;
  return (
    <Link href={`/products/${p.id}`} className="card-hover group flex flex-col overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden border-b border-line bg-white">
        <FitImage src={productArt(p)} alt={p.name} className="h-full w-full" fill={p.image_url ? "plain" : "none"} imgClassName={`${p.image_url ? "p-1.5" : "object-cover"} transition-transform duration-500 group-hover:scale-[1.03]`} />
        {off > 0 && buy && <span className="absolute left-3 top-3 bg-gold px-2 py-1 text-[11px] font-bold text-navy-950">{off}% OFF</span>}
        {p.featured && <span className="absolute right-3 top-3 bg-navy/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gold-light">Featured</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-dark">{p.category || (p.kind === "course" ? "Programme" : p.business === "software" ? "Solution" : "Product")}</p>
        <h3 className="font-display text-[17px] font-semibold leading-snug text-navy">{p.name}</h3>
        {p.details?.duration && <p className="mt-1 text-sm text-muted">{p.details.duration}{p.details.mode ? ` · ${p.details.mode}` : ""}</p>}
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          {buy ? (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-navy">{inr(p.price)}</span>
                {off > 0 && <span className="text-sm text-muted line-through">{inr(p.mrp!)}</span>}
              </div>
              {p.kind === "goods" && <span className={`text-xs font-medium ${p.stock_quantity > 0 ? "text-success" : "text-danger"}`}>{p.stock_quantity > 0 ? "In stock" : "Out of stock"}</span>}
            </div>
          ) : <span className="text-sm font-semibold text-gold-dark">{Number(p.price) > 0 ? `From ${inr(p.price)}${p.unit ? ` / ${p.unit}` : ""}` : "Price on request"}</span>}
          <span className="grid h-9 w-9 shrink-0 place-items-center border border-line text-navy transition-colors group-hover:border-gold group-hover:bg-gold group-hover:text-navy-950"><IconArrow className="h-4 w-4" /></span>
        </div>
      </div>
    </Link>
  );
}
