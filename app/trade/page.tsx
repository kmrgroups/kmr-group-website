import { supabase } from "@/lib/supabaseClient";
import ProductCard from "@/components/ProductCard";
import EnquiryForm from "@/components/EnquiryForm";
import type { Product, Vertical } from "@/lib/types";

export const revalidate = 30;
export const metadata = { title: "Import, Export & Trading · KMR Group of Companies", description: "Import & export, trading and distribution — request a quote." };

const LINES: { key: "import_export" | "trading" | "distribution"; title: string; text: string }[] = [
  { key: "import_export", title: "Import & Export", text: "Sourcing and export of industrial and consumer goods, with documentation handled end to end. Tell us the product, quantity, destination or origin and delivery terms." },
  { key: "trading", title: "Trading & Retail", text: "Wholesale and retail supply of materials and finished goods with dependable delivery." },
  { key: "distribution", title: "Distribution", text: "Distribution partnerships for brands entering or growing in South India." },
];

export default async function TradePage() {
  const [{ data: items }, { data: vs }] = await Promise.all([
    supabase.from("products").select("*").eq("is_active", true).in("business", LINES.map((l) => l.key)).order("sort_order"),
    supabase.from("verticals").select("slug,description"),
  ]);
  const products = (items as Product[]) || [];
  const desc = Object.fromEntries(((vs as Vertical[]) || []).filter((v) => v.slug).map((v) => [v.slug!, v.description]));

  return (
    <div className="mx-auto max-w-7xl px-5 py-20">
      <p className="eyebrow text-steel mb-3">Trade</p>
      <h1 className="font-display text-5xl mb-4">Import, Export & Trading</h1>
      <p className="text-slate max-w-2xl mb-6">Every order is quoted for you — send a request and we reply within one working day with price, lead time and terms.</p>
      <nav className="flex flex-wrap gap-2 mb-14">{LINES.map((l) => <a key={l.key} href={`#${l.key}`} className="px-3 py-1.5 text-sm border border-line hover:border-copper">{l.title}</a>)}</nav>

      {LINES.map((l) => {
        const list = products.filter((p) => p.business === l.key);
        return (
          <section key={l.key} id={l.key} className="mb-20 scroll-mt-24">
            <h2 className="font-display text-4xl mb-2">{l.title}</h2>
            <p className="text-slate max-w-3xl mb-8">{desc[l.key] || l.text}</p>
            {list.length > 0 && <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>}
            <div className="max-w-3xl"><EnquiryForm business={l.key} title={`Request a quote — ${l.title}`} askQuantity submitLabel="Request quote" /></div>
          </section>
        );
      })}
    </div>
  );
}
