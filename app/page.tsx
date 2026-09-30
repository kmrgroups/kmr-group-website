import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import type { HeroContent, Vertical, Product } from "@/lib/types";

export const revalidate = 60;

export default async function HomePage() {
  const [{ data: hero }, { data: verticals }, { data: featured }, { data: latest }] = await Promise.all([
    supabase.from("hero_content").select("*").limit(1).maybeSingle(),
    supabase.from("verticals").select("*").order("sort_order"),
    supabase.from("products").select("*").eq("is_active", true).eq("featured", true).order("sort_order").limit(8),
    supabase.from("products").select("*").eq("is_active", true).eq("business", "shop").order("created_at", { ascending: false }).limit(4),
  ]);
  const h = hero as HeroContent | null;
  const v = ((verticals as Vertical[]) || []).filter((x) => x.is_active !== false);
  const f = (featured as Product[])?.length ? (featured as Product[]) : ((latest as Product[]) || []);

  return (
    <div>
      {/* HERO BANNER — image only, fitted to width */}
      <section className="w-full bg-ink">
        {h?.banner_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={h.banner_image_url} alt={h?.headline || "KMR Group of Companies"} className="w-full h-auto max-h-[70vh] object-cover" />
        ) : (
          <div className="w-full aspect-[21/9] blueprint-bg" />
        )}
      </section>

      <section className="w-full mx-auto max-w-7xl px-5 py-16 md:py-20">
        <p className="eyebrow text-steel mb-4">KMR Group of Companies</p>
        <h1 className="font-display text-4xl md:text-6xl leading-[1.05] mb-6 max-w-3xl">{h?.headline || "One Vision. Multiple Solutions. Global Impact."}</h1>
        <p className="text-slate max-w-xl mb-8 leading-relaxed text-lg">
          {h?.subheadline || "Shop online, run your plant on KMR Apps, train your team, or source and trade goods — one trusted group behind every business."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={h?.cta_link || "/shop"} className="inline-block bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-7 py-3.5">{h?.cta_label || "Visit the shop"}</Link>
          <Link href="/software" className="inline-block border border-line hover:border-copper px-7 py-3.5 font-medium">KMR Apps</Link>
        </div>
      </section>

      {/* BUSINESSES */}
      <section className="mx-auto max-w-7xl px-5 pb-20">
        <div className="flex items-end justify-between mb-10">
          <div><p className="eyebrow text-steel mb-2">What We Do</p><h2 className="font-display text-4xl">Our Businesses</h2></div>
          <Link href="/verticals" className="text-sm text-steel hover:text-copper font-medium">All businesses →</Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {v.map((item) => (
            <Link key={item.id} href={item.link || "/contact"} className="plate bg-white p-6 block group hover:border-copper transition-colors">
              {item.icon_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.icon_url} alt="" className="h-10 w-10 object-contain mb-3" />
              )}
              <p className="eyebrow text-steel mb-2">{item.code || "BUSINESS"}</p>
              <h3 className="font-display text-2xl leading-tight mb-2 group-hover:text-copper transition-colors">{item.title}</h3>
              <p className="text-sm text-slate leading-relaxed">{item.description}</p>
              <p className="text-sm text-copper font-medium mt-3">{item.link?.startsWith("/trade") ? "Request a quote →" : item.link === "/software" ? "See the apps →" : item.link === "/training" ? "View courses →" : item.link === "/shop" ? "Shop now →" : "Get in touch →"}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      {f.length > 0 && (
        <section className="bg-warehouse py-20">
          <div className="mx-auto max-w-7xl px-5">
            <div className="flex items-end justify-between mb-10">
              <div><p className="eyebrow text-steel mb-2">Featured</p><h2 className="font-display text-4xl">From Our Catalogue</h2></div>
              <Link href="/shop" className="text-sm text-steel hover:text-copper font-medium">Shop all →</Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">{f.slice(0, 8).map((p) => <ProductCard key={p.id} p={p} />)}</div>
          </div>
        </section>
      )}

      {/* SOFTWARE BAND */}
      <section className="blueprint-bg text-warehouse py-20">
        <div className="mx-auto max-w-7xl px-5 grid md:grid-cols-[1.4fr_1fr] gap-10 items-center">
          <div>
            <p className="eyebrow text-copper-light mb-2">Software & AI Solutions</p>
            <h2 className="font-display text-4xl mb-4">Run your plant on KMR Apps</h2>
            <p className="text-slate-light max-w-xl">HRM with biometric attendance, Balloon Inspector, Process Documents (APQP / PPAP) and Capacity Planner — one login, built for manufacturers.</p>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <Link href="/software" className="bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-6 py-3">See plans &amp; pricing</Link>
            <Link href="/software#trial" className="border border-white/30 hover:border-copper-light px-6 py-3 font-medium">Free trial</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
