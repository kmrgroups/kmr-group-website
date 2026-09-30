import { supabase } from "@/lib/supabaseClient";
import type { Product } from "@/lib/types";
import { notFound } from "next/navigation";
import Link from "next/link";
import BuyNowButton from "@/components/BuyNowButton";
import EnquiryForm from "@/components/EnquiryForm";

export const revalidate = 30;

const SECTION: Record<string, [string, string]> = {
  shop: ["Shop", "/shop"], training: ["Training", "/training"], import_export: ["Import & Export", "/trade#import_export"],
  trading: ["Trading", "/trade#trading"], distribution: ["Distribution", "/trade#distribution"],
};
const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;   // Next.js 15+: params is a Promise
  if (!/^[0-9a-f-]{36}$/.test(id)) return notFound();
  const { data } = await supabase.from("products").select("*").eq("id", id).eq("is_active", true).maybeSingle();
  const product = data as Product | null;
  if (!product) return notFound();
  const business = product.business ?? "shop";
  const enquiry = product.enquiry_only || !["shop", "training"].includes(business) || Number(product.price) <= 0;
  const course = product.kind === "course";
  const [sectionLabel, sectionHref] = SECTION[business] ?? SECTION.shop;
  const waLink = `https://wa.me/?text=${encodeURIComponent(`Hi, I'm interested in ${product.name}${product.sku ? ` (${product.sku})` : ""} on the KMR Group website.`)}`;
  const facts = ([
    ["Duration", product.details?.duration], ["Mode", product.details?.mode], ["Next batch", product.details?.schedule],
    ["Unit", product.unit && !course ? product.unit : undefined], ["HSN / SAC", product.hsn_code],
  ] as [string, string | undefined][]).filter(([, v]) => v);

  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <p className="text-sm text-slate mb-6"><Link href={sectionHref} className="hover:text-copper">← {sectionLabel}</Link></p>
      <div className="grid md:grid-cols-2 gap-10">
        <div className="plate bg-white overflow-hidden aspect-square">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-slate font-mono">{course ? "COURSE" : "NO IMAGE"}</div>
          )}
        </div>

        <div>
          <p className="font-mono text-xs text-slate mb-2">{[product.sku, product.category].filter(Boolean).join(" · ")}</p>
          <h1 className="font-display text-4xl mb-4">{product.name}</h1>
          {!enquiry ? (
            <>
              <div className="flex items-baseline gap-3 mb-2">
                <p className="text-copper text-2xl font-semibold">{inr(product.price)}{course ? <span className="text-sm text-slate font-normal"> per participant</span> : null}</p>
                {product.mrp && product.mrp > product.price && <p className="text-slate line-through">{inr(product.mrp)}</p>}
              </div>
              {!course && (
                <p className={`text-sm mb-4 ${product.stock_quantity > 0 ? "text-signal" : "text-red-600"}`}>
                  {product.stock_quantity > 0 ? `In stock (${product.stock_quantity} available)` : "Out of stock"}
                </p>
              )}
            </>
          ) : (
            <p className="text-copper font-medium mb-4">{Number(product.price) > 0 ? `Indicative price ${inr(product.price)}${product.unit ? ` / ${product.unit}` : ""} · ` : ""}Priced on request</p>
          )}
          {facts.length > 0 && <dl className="grid grid-cols-2 gap-2 text-sm mb-4">{facts.map(([k, v]) => <div key={k}><dt className="text-slate">{k}</dt><dd>{v}</dd></div>)}</dl>}
          <p className="text-slate leading-relaxed mb-8 whitespace-pre-line">{product.description}</p>

          {!enquiry && (
            <div className="flex flex-wrap items-start gap-4 mb-8">
              <BuyNowButton product={product} mode={course ? "enrol" : "buy"} />
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="inline-block border border-line hover:border-copper hover:text-copper transition-colors font-medium px-6 py-3">Ask on WhatsApp</a>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mt-12">
        <EnquiryForm business={business as "shop"} productName={product.name} askQuantity={!course}
          title={enquiry ? "Request a quote" : course ? "Questions, or training for your whole team?" : "Bulk order or a question?"}
          submitLabel={enquiry ? "Request quote" : "Send enquiry"} />
      </div>
    </div>
  );
}
