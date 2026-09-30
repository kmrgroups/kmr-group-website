import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getSite } from "@/lib/site";
import ProductCard from "@/components/ProductCard";
import { PageHero } from "@/components/Blocks";
import { IconLock, IconShield, IconTruck } from "@/components/Icons";
import type { Product } from "@/lib/types";

export const revalidate = 30;
export const metadata = { title: "Online shop", description: "Order online — pay by UPI, card, net banking or bank transfer directly to the company account." };

const SORTS: [string, string][] = [["", "Featured"], ["new", "Newest"], ["low", "Price: low to high"], ["high", "Price: high to low"]];

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ c?: string; q?: string; s?: string }> }) {
  const { c, q, s } = await searchParams;
  const [{ settings }, { data }] = await Promise.all([getSite(), supabase.from("products").select("*").eq("is_active", true).eq("business", "shop").order("sort_order").order("created_at", { ascending: false })]);
  const all = (data as Product[]) || [];
  const categories = [...new Set(all.map((p) => p.category).filter(Boolean))] as string[];
  const term = (q ?? "").toLowerCase().trim();
  let products = all.filter((p) => (!c || p.category === c) && (!term || [p.name, p.sku, p.category, p.description].join(" ").toLowerCase().includes(term)));
  if (s === "low") products = [...products].sort((a, b) => a.price - b.price);
  if (s === "high") products = [...products].sort((a, b) => b.price - a.price);
  if (s === "new") products = [...products].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const link = (x: Record<string, string | undefined>) => "/shop?" + new URLSearchParams(Object.entries({ c, q, s, ...x }).filter(([, v]) => v) as [string, string][]).toString();
  const pay = [settings.online_payment && "UPI, cards & net banking", settings.bank_transfer !== false && "bank transfer"].filter(Boolean).join(" or ");

  return (
    <>
      <PageHero eyebrow="Online shop" title="Shop with confidence" intro="Genuine products, GST invoices, and secure payment straight to our registered company account." />
      <div className="border-b border-line bg-white">
        <div className="wrap grid gap-4 py-5 text-sm text-navy sm:grid-cols-3">
          <p className="flex items-center gap-3"><IconLock className="h-5 w-5 text-gold" />Pay by {pay || "bank transfer"}</p>
          <p className="flex items-center gap-3"><IconShield className="h-5 w-5 text-gold" />GST invoice with every order</p>
          <p className="flex items-center gap-3"><IconTruck className="h-5 w-5 text-gold" />Dispatched once payment is confirmed</p>
        </div>
      </div>

      <section className="py-14">
        <div className="wrap grid gap-10 lg:grid-cols-[250px_1fr]">
          <aside className="space-y-8 lg:sticky lg:top-28 lg:self-start">
            <form action="/shop">
              <label className="label" htmlFor="shop-q">Search</label>
              <input id="shop-q" name="q" defaultValue={q ?? ""} placeholder="Product, code…" className="field" />
              {c && <input type="hidden" name="c" value={c} />}{s && <input type="hidden" name="s" value={s} />}
            </form>
            {categories.length > 0 && (
              <div>
                <p className="label">Categories</p>
                <ul className="card divide-y divide-line">
                  <li><Link href={link({ c: undefined })} className={`flex justify-between px-4 py-3 text-sm ${!c ? "font-semibold text-gold-dark" : "text-navy hover:bg-ivory"}`}>All products <span className="text-muted">{all.length}</span></Link></li>
                  {categories.map((x) => <li key={x}><Link href={link({ c: x })} className={`flex justify-between px-4 py-3 text-sm ${c === x ? "font-semibold text-gold-dark" : "text-navy hover:bg-ivory"}`}>{x}<span className="text-muted">{all.filter((p) => p.category === x).length}</span></Link></li>)}
                </ul>
              </div>
            )}
          </aside>

          <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">{products.length} product{products.length === 1 ? "" : "s"}{c ? ` in ${c}` : ""}{term ? ` matching “${q}”` : ""}</p>
              <div className="flex flex-wrap gap-1.5 text-sm">{SORTS.map(([k, l]) => <Link key={k} href={link({ s: k || undefined })} className={`border px-3 py-1.5 ${(s ?? "") === k ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-gold"}`}>{l}</Link>)}</div>
            </div>
            {products.length === 0 ? (
              <div className="card p-10 text-center"><p className="font-display text-xl text-navy">{all.length ? "Nothing matches your search." : "New products are on their way."}</p><p className="mt-2 text-muted">Looking for something specific? <Link href="/contact" className="link-gold">Send us an enquiry</Link>.</p></div>
            ) : <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>}
          </div>
        </div>
      </section>
    </>
  );
}
