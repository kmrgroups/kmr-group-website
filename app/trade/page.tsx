import { supabase } from "@/lib/supabaseClient";
import ProductCard from "@/components/ProductCard";
import EnquiryForm from "@/components/EnquiryForm";
import { PageHero } from "@/components/Blocks";
import { IconGlobe, IconTruck, IconBag } from "@/components/Icons";
import type { Product, Vertical } from "@/lib/types";

export const revalidate = 30;
export const metadata = { title: "Import, export & trading", description: "Import & export, trading and distribution — request a quote." };

const LINES = [
  { key: "import_export" as const, icon: IconGlobe, title: "Import & Export", text: "Sourcing and export of industrial and consumer goods, with documentation handled end to end. Tell us the product, quantity, destination or origin and delivery terms." },
  { key: "trading" as const, icon: IconBag, title: "Trading & Retail", text: "Wholesale and retail supply of materials and finished goods with dependable delivery." },
  { key: "distribution" as const, icon: IconTruck, title: "Distribution", text: "Distribution partnerships for brands entering or growing in South India." },
];

export default async function TradePage() {
  const [{ data: items }, { data: vs }] = await Promise.all([
    supabase.from("products").select("*").eq("is_active", true).in("business", LINES.map((l) => l.key)).order("sort_order"),
    supabase.from("verticals").select("slug,title,description,image_url,is_active"),
  ]);
  const products = (items as Product[]) || [];
  const v = Object.fromEntries(((vs as Vertical[]) || []).filter((x) => x.slug && x.is_active !== false).map((x) => [x.slug!, x]));

  return (
    <>
      <PageHero eyebrow="Trade" title="Import, export & trading" intro="Every order is quoted for you — send a request and we reply within one working day with price, lead time and terms.">
        <div className="mt-8 flex flex-wrap gap-3">{LINES.map((l) => <a key={l.key} href={`#${l.key}`} className="btn-outline-light">{v[l.key]?.title || l.title}</a>)}</div>
      </PageHero>
      {LINES.map((l, i) => {
        const list = products.filter((p) => p.business === l.key);
        const Icon = l.icon;
        return (
          <section key={l.key} id={l.key} className={`scroll-mt-24 py-20 ${i % 2 ? "bg-white" : ""}`}>
            <div className="wrap">
              <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
                <div>
                  <span className="grid h-14 w-14 place-items-center bg-navy text-gold-light"><Icon className="h-7 w-7" /></span>
                  <h2 className="h-display mt-6 text-3xl text-navy md:text-[44px]">{v[l.key]?.title || l.title}</h2>
                  <p className="lead mt-4">{v[l.key]?.description || l.text}</p>
                  {v[l.key]?.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v[l.key].image_url} alt="" className="mt-8 aspect-[16/9] w-full object-cover" />
                  )}
                </div>
                <EnquiryForm business={l.key} title={`Request a quote — ${v[l.key]?.title || l.title}`} askQuantity submitLabel="Request quote" />
              </div>
              {list.length > 0 && <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>}
            </div>
          </section>
        );
      })}
    </>
  );
}
