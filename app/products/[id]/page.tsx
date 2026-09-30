import { supabase } from "@/lib/supabaseClient";
import type { Product } from "@/lib/types";
import { notFound } from "next/navigation";
import BuyNowButton from "@/components/BuyNowButton";

export const revalidate = 30;

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;   // Next.js 15+: params is a Promise
  const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  const product = data as Product | null;
  if (!product) return notFound();

  const waLink = `https://wa.me/?text=${encodeURIComponent(
    `Hi, I'm interested in ${product.name} (SKU: ${product.sku}) listed on the KMR Group website.`
  )}`;

  return (
    <div className="mx-auto max-w-5xl px-5 py-20 grid md:grid-cols-2 gap-10">
      <div className="plate bg-white overflow-hidden aspect-square">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-slate font-mono">NO IMAGE</div>
        )}
      </div>

      <div>
        <p className="font-mono text-xs text-slate mb-2">{product.sku} · {product.category}</p>
        <h1 className="font-display text-4xl mb-4">{product.name}</h1>
        <div className="flex items-baseline gap-3 mb-4">
          <p className="text-copper text-2xl font-semibold">₹{Number(product.price).toLocaleString("en-IN")}</p>
          {product.mrp && product.mrp > product.price && (
            <p className="text-slate line-through">₹{Number(product.mrp).toLocaleString("en-IN")}</p>
          )}
        </div>
        <p className={`text-sm mb-6 ${product.stock_quantity > 0 ? "text-signal" : "text-red-600"}`}>
          {product.stock_quantity > 0 ? `In Stock (${product.stock_quantity} available)` : "Out of Stock"}
        </p>
        <p className="text-slate leading-relaxed mb-8 whitespace-pre-line">{product.description}</p>

        <div className="flex flex-wrap items-start gap-4">
          <BuyNowButton product={product} />
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block border border-line hover:border-copper hover:text-copper transition-colors font-medium px-6 py-3"
          >
            Ask on WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
