import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import type { Product } from "@/lib/types";

export const revalidate = 30;

export default async function ProductsPage() {
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  const products = (data as Product[]) || [];

  return (
    <div className="mx-auto max-w-7xl px-5 py-20">
      <p className="eyebrow text-steel mb-3">Marketplace</p>
      <h1 className="font-display text-5xl mb-12">Shop Our Products</h1>

      {products.length === 0 ? (
        <p className="text-sm text-slate font-mono">No products listed yet — add them from Admin → Products.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {products.map((prod) => (
            <Link key={prod.id} href={`/products/${prod.id}`} className="plate bg-white block group">
              <div className="aspect-square bg-line/40 overflow-hidden">
                {prod.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate font-mono">NO IMAGE</div>
                )}
              </div>
              <div className="p-4">
                <p className="font-mono text-xs text-slate mb-1">{prod.sku} · {prod.category}</p>
                <h3 className="font-display text-xl mb-1">{prod.name}</h3>
                <div className="flex items-baseline gap-2">
                  <p className="text-copper font-semibold">₹{Number(prod.price).toLocaleString("en-IN")}</p>
                  {prod.mrp && prod.mrp > prod.price && (
                    <p className="text-xs text-slate line-through">₹{Number(prod.mrp).toLocaleString("en-IN")}</p>
                  )}
                </div>
                <p className={`text-xs mt-1 ${prod.stock_quantity > 0 ? "text-signal" : "text-red-600"}`}>
                  {prod.stock_quantity > 0 ? "In Stock" : "Out of Stock"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
