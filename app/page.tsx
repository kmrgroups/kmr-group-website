import { supabase } from "@/lib/supabaseClient";
import SpecPlate from "@/components/SpecPlate";
import Link from "next/link";
import type { HeroContent, Vertical, Product } from "@/lib/types";

export const revalidate = 60;

export default async function HomePage() {
  const [{ data: hero }, { data: verticals }, { data: products }] = await Promise.all([
    supabase.from("hero_content").select("*").limit(1).maybeSingle(),
    supabase.from("verticals").select("*").order("sort_order").limit(4),
    supabase.from("products").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(4)
  ]);

  const h = hero as HeroContent | null;
  const v = (verticals as Vertical[]) || [];
  const p = (products as Product[]) || [];

  return (
    <div>
      {/* HERO BANNER — image only, fitted to width, nothing overlaid */}
      <section className="w-full bg-ink">
        {h?.banner_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={h.banner_image_url}
            alt={h?.headline || "KMR Group of Companies"}
            className="w-full h-auto max-h-[70vh] object-cover"
          />
        ) : (
          <div className="w-full aspect-[21/9] blueprint-bg" />
        )}
      </section>

      {/* HERO CONTENT — sits below the banner, on the normal page background */}
      <section className="w-full mx-auto max-w-7xl px-5 py-16 md:py-20">
        <p className="eyebrow text-steel mb-4">KMR Group of Companies</p>
        <h1 className="font-display text-4xl md:text-6xl leading-[1.05] mb-6 max-w-3xl">
          {h?.headline || "Engineering Growth Across Industries"}
        </h1>
        <p className="text-slate max-w-xl mb-8 leading-relaxed text-lg">
          {h?.subheadline ||
            "A multi-vertical group of companies building manufacturing, trading and technology ventures on precision and trust."}
        </p>
        <Link
          href={h?.cta_link || "/verticals"}
          className="inline-block bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-7 py-3.5"
        >
          {h?.cta_label || "Explore Our Verticals"}
        </Link>
      </section>

      {/* VERTICALS PREVIEW */}
      <section className="mx-auto max-w-7xl px-5 py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="eyebrow text-steel mb-2">What We Run</p>
            <h2 className="font-display text-4xl">Business Verticals</h2>
          </div>
          <Link href="/verticals" className="text-sm text-steel hover:text-copper font-medium">
            View all →
          </Link>
        </div>
        {v.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {v.map((item) => (
              <SpecPlate key={item.id} eyebrow={item.code || "VERTICAL"} title={item.title}>
                <p className="text-sm text-slate leading-relaxed">{item.description}</p>
              </SpecPlate>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate font-mono">No verticals added yet — add them from Admin → Verticals.</p>
        )}
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="bg-warehouse py-20">
        <div className="mx-auto max-w-7xl px-5">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="eyebrow text-steel mb-2">Marketplace</p>
              <h2 className="font-display text-4xl">Featured Products</h2>
            </div>
            <Link href="/products" className="text-sm text-steel hover:text-copper font-medium">
              Shop all →
            </Link>
          </div>
          {p.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {p.map((prod) => (
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
                    <p className="font-mono text-xs text-slate mb-1">{prod.sku}</p>
                    <h3 className="font-display text-xl mb-1">{prod.name}</h3>
                    <p className="text-copper font-semibold">₹{Number(prod.price).toLocaleString("en-IN")}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate font-mono">No products listed yet — add them from Admin → Products.</p>
          )}
        </div>
      </section>
    </div>
  );
}
