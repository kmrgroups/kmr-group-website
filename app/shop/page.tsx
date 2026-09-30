import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/types";

export const revalidate = 30;
export const metadata = { title: "Shop · KMR Group of Companies", description: "Order online from KMR Group of Companies — pay by bank transfer or UPI." };

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ c?: string; q?: string }> }) {
  const { c, q } = await searchParams;
  const { data } = await supabase.from("products").select("*").eq("is_active", true).eq("business", "shop").order("sort_order").order("created_at", { ascending: false });
  const all = (data as Product[]) || [];
  const categories = [...new Set(all.map((p) => p.category).filter(Boolean))] as string[];
  const term = (q ?? "").toLowerCase().trim();
  const products = all.filter((p) => (!c || p.category === c) && (!term || [p.name, p.sku, p.category, p.description].join(" ").toLowerCase().includes(term)));

  return (
    <div className="mx-auto max-w-7xl px-5 py-20">
      <p className="eyebrow text-steel mb-3">E-Commerce & Distribution</p>
      <h1 className="font-display text-5xl mb-4">Shop</h1>
      <p className="text-slate max-w-2xl mb-10">Order online and pay by bank transfer (NEFT / IMPS / RTGS) or UPI straight to KMR Group of Companies. We dispatch as soon as your payment is confirmed.</p>

      <form className="flex flex-wrap gap-3 mb-6">
        <input name="q" defaultValue={q ?? ""} placeholder="Search products…" className="border border-line px-3 py-2 text-sm bg-white min-w-[240px] flex-1 max-w-md" />
        {c && <input type="hidden" name="c" value={c} />}
        <button className="border border-line px-4 py-2 text-sm hover:border-copper">Search</button>
      </form>
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-10">
          <Link href="/shop" className={`px-3 py-1.5 text-sm border ${!c ? "border-copper text-copper" : "border-line text-slate"}`}>All</Link>
          {categories.map((x) => <Link key={x} href={`/shop?c=${encodeURIComponent(x)}`} className={`px-3 py-1.5 text-sm border ${c === x ? "border-copper text-copper" : "border-line text-slate"}`}>{x}</Link>)}
        </div>
      )}

      {products.length === 0 ? (
        <p className="text-sm text-slate font-mono">{all.length ? "Nothing matches your search." : "New products are on their way. Meanwhile, send us an enquiry from the Contact page."}</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      )}
    </div>
  );
}
