import Link from "next/link";
import type { Product } from "@/lib/types";

export const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

/** A catalogue card for any business: shop goods, courses and trade items (enquiry only). */
export default function ProductCard({ p }: { p: Product }) {
  const enquiry = p.enquiry_only || !["shop", "training"].includes(p.business ?? "shop") || Number(p.price) <= 0;
  return (
    <Link href={`/products/${p.id}`} className="plate bg-white block group">
      <div className="aspect-square bg-line/40 overflow-hidden">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-slate font-mono">{p.kind === "course" ? "COURSE" : "NO IMAGE"}</div>
        )}
      </div>
      <div className="p-4">
        <p className="font-mono text-xs text-slate mb-1">{[p.sku, p.category].filter(Boolean).join(" · ")}</p>
        <h3 className="font-display text-xl mb-1 leading-snug">{p.name}</h3>
        {enquiry ? (
          <p className="text-sm text-copper font-medium">{Number(p.price) > 0 ? `From ${inr(p.price)}${p.unit ? ` / ${p.unit}` : ""} · ` : ""}Request a quote</p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <p className="text-copper font-semibold">{inr(p.price)}</p>
              {p.mrp && p.mrp > p.price && <p className="text-xs text-slate line-through">{inr(p.mrp)}</p>}
            </div>
            {p.kind === "goods" ? (
              <p className={`text-xs mt-1 ${p.stock_quantity > 0 ? "text-signal" : "text-red-600"}`}>{p.stock_quantity > 0 ? "In stock" : "Out of stock"}</p>
            ) : p.details?.duration ? <p className="text-xs mt-1 text-slate">{p.details.duration}{p.details.mode ? ` · ${p.details.mode}` : ""}</p> : null}
          </>
        )}
      </div>
    </Link>
  );
}
