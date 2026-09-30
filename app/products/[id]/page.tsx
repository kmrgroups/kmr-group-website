import { supabase } from "@/lib/supabaseClient";
import FitImage from "@/components/FitImage";
import type { Product } from "@/lib/types";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSite, inr } from "@/lib/site";
import BuyNowButton from "@/components/BuyNowButton";
import EnquiryForm from "@/components/EnquiryForm";
import ProductCard, { canBuy } from "@/components/ProductCard";
import { RichText } from "@/components/Blocks";
import { IconBag, IconCap, IconCode, IconGlobe, IconLock, IconShield, IconTruck, IconWhatsApp } from "@/components/Icons";

export const revalidate = 30;

const SECTION: Record<string, [string, string]> = {
  shop: ["Shop", "/shop"], software: ["Software", "/software"], training: ["Training", "/training"], import_export: ["Import & Export", "/trade#import_export"],
  trading: ["Trading", "/trade#trading"], distribution: ["Distribution", "/trade#distribution"],
};

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await supabase.from("products").select("*").eq("id", id).eq("is_active", true).maybeSingle();
  return data as Product | null;
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const p = await load((await params).id);
  return p ? { title: p.name, description: (p.description ?? "").slice(0, 160), openGraph: { images: p.image_url ? [{ url: p.image_url }] : undefined } } : { title: "Product" };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await load(id);
  if (!product) notFound();
  const { company: c, settings } = await getSite();
  const business = product.business ?? "shop";
  const buy = canBuy(product);
  const course = product.kind === "course";
  const [sectionLabel, sectionHref] = SECTION[business] ?? SECTION.shop;
  const { data: rel } = await supabase.from("products").select("*").eq("is_active", true).eq("business", business).neq("id", product.id).order("sort_order").limit(4);
  const related = (rel as Product[]) || [];
  const wa = c.whatsapp_number ? `https://wa.me/${c.whatsapp_number.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, I'm interested in ${product.name}${product.sku ? ` (${product.sku})` : ""}.`)}` : null;
  const facts = ([
    ["Code", product.sku], ["Category", product.category], ["Duration", product.details?.duration], ["Mode", product.details?.mode], ["Next batch", product.details?.schedule],
    ["Unit", product.unit && !course ? product.unit : undefined], ["HSN / SAC", product.hsn_code],
  ] as [string, string | undefined][]).filter(([, v]) => v);
  const off = product.mrp && product.mrp > product.price ? Math.round((1 - product.price / product.mrp) * 100) : 0;
  const Fallback = business === "software" ? IconCode : course ? IconCap : business === "shop" ? IconBag : IconGlobe;
  const pay = [settings.online_payment && "UPI / cards / net banking", settings.bank_transfer !== false && "bank transfer"].filter(Boolean).join(" or ");

  return (
    <>
      <div className="border-b border-line bg-white">
        <nav className="wrap py-4 text-[13px] text-muted" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-gold-dark">Home</Link><span className="mx-2 text-gold">/</span>
          <Link href={sectionHref} className="hover:text-gold-dark">{sectionLabel}</Link><span className="mx-2 text-gold">/</span>
          <span className="text-navy">{product.name}</span>
        </nav>
      </div>
      <section className="py-14">
        <div className="wrap grid gap-12 lg:grid-cols-2">
          <div className="corner">
            <div className="aspect-square overflow-hidden bg-white shadow-card">
              {product.image_url
                ? <FitImage src={product.image_url} alt={product.name} className="h-full w-full" fill="plain" imgClassName="p-4" eager />
                : <div className="grid h-full w-full place-items-center bg-ivory"><span className="flex flex-col items-center gap-3 text-muted/70"><Fallback className="h-16 w-16 text-gold/60" /><span className="text-xs uppercase tracking-widest">Photo coming soon</span></span></div>}
            </div>
          </div>

          <div>
            {product.category && <p className="eyebrow mb-3">{product.category}</p>}
            <h1 className="h-display text-2xl text-navy md:text-[34px]">{product.name}</h1>
            <div className="mt-6 border-y border-line py-5">
              {buy ? (
                <>
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="font-display text-3xl font-semibold text-navy">{inr(product.price)}</span>
                    {off > 0 && <><span className="text-lg text-muted line-through">{inr(product.mrp!)}</span><span className="bg-gold px-2 py-0.5 text-xs font-bold text-navy-950">{off}% OFF</span></>}
                  </div>
                  <p className="mt-1 text-sm text-muted">{course ? "per participant · " : ""}inclusive of GST</p>
                  {product.kind === "goods" && <p className={`mt-3 text-sm font-semibold ${product.stock_quantity > 0 ? "text-success" : "text-danger"}`}>{product.stock_quantity > 0 ? `In stock — ${product.stock_quantity} available` : "Out of stock"}</p>}
                </>
              ) : <p className="font-display text-2xl text-gold-dark">{Number(product.price) > 0 ? `From ${inr(product.price)}${product.unit ? ` / ${product.unit}` : ""} · ` : ""}Price on request</p>}
            </div>

            {buy && (
              <div className="mt-6 space-y-4">
                <BuyNowButton product={product} mode={course ? "enrol" : "buy"} />
                <p className="flex items-center gap-2 text-xs text-muted"><IconLock className="h-4 w-4 text-gold" />Pay by {pay || "bank transfer"} — straight to our company account.</p>
              </div>
            )}
            {!buy && <a href="#enquiry" className="btn-gold mt-6">{business === "software" ? "Request a demo" : "Request a quote"}</a>}
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-outline ml-0 mt-3 sm:ml-3"><IconWhatsApp className="h-4 w-4" />Ask on WhatsApp</a>}

            {facts.length > 0 && <dl className="mt-8 grid grid-cols-2 gap-px bg-line">{facts.map(([k, v]) => <div key={k} className="bg-white px-4 py-3"><dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{k}</dt><dd className="mt-0.5 text-sm text-navy">{v}</dd></div>)}</dl>}

            <div className="mt-8 grid gap-3 text-sm text-navy sm:grid-cols-2">
              <p className="flex items-center gap-2"><IconShield className="h-4 w-4 text-gold" />GST invoice{c.gstin ? ` (GSTIN ${c.gstin})` : ""}</p>
              {business === "shop" && <p className="flex items-center gap-2"><IconTruck className="h-4 w-4 text-gold" />Dispatched after payment</p>}
            </div>
          </div>
        </div>
      </section>

      {product.description && (
        <section className="bg-white py-16">
          <div className="wrap max-w-4xl"><h2 className="h-display mb-5 text-2xl text-navy">Details</h2><RichText text={product.description} /></div>
        </section>
      )}

      <section id="enquiry" className="scroll-mt-24 py-16">
        <div className="wrap max-w-4xl">
          <EnquiryForm business={business as "shop"} productName={product.name} askQuantity={!course && business !== "software"}
            title={!buy ? (business === "software" ? "Request a demo" : "Request a quote") : course ? "Training for your whole team?" : "Bulk order or a question?"}
            submitLabel={!buy ? "Send request" : "Send enquiry"} />
        </div>
      </section>

      {related.length > 0 && (
        <section className="bg-sand/60 py-16">
          <div className="wrap"><h2 className="h-display mb-6 text-2xl text-navy">You may also like</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{related.map((p) => <ProductCard key={p.id} p={p} />)}</div></div>
        </section>
      )}
    </>
  );
}
