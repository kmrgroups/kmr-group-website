import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getSite, companyName, verticalHref, inr, telHref } from "@/lib/site";
import HeroSlider from "@/components/HeroSlider";
import ProductCard from "@/components/ProductCard";
import ProductRow from "@/components/ProductRow";
import FitImage from "@/components/FitImage";
import BenefitTabs, { type Benefit } from "@/components/BenefitTabs";
import { SectionHead } from "@/components/Blocks";
import {
  IconArrow, IconBag, IconBriefcase, IconCap, IconChart, IconCheck, IconClock, IconCode, IconFile, IconGlobe, IconLock,
  IconPhone, IconShield, IconTruck, IconUsers, IconWhatsApp,
} from "@/components/Icons";
import type { HeroContent, HeroSlide, Product, SiteStat, Vertical } from "@/lib/types";

export const revalidate = 60;

type App = { code: string; name: string; description: string | null; seat_label: string; prices: { period: string; amount: number; min: number }[] };
type Point = { id: string; section: string; title: string; text?: string; icon?: string; link?: string; link_label?: string };

const VICON: Record<string, typeof IconBag> = { shop: IconBag, software: IconCode, training: IconCap, import_export: IconGlobe, trading: IconTruck, distribution: IconTruck, investment: IconChart };
const PICON: Record<string, typeof IconBag> = {
  bag: IconBag, code: IconCode, cap: IconCap, globe: IconGlobe, truck: IconTruck, shield: IconShield, lock: IconLock, users: IconUsers,
  clock: IconClock, chart: IconChart, briefcase: IconBriefcase, file: IconFile, check: IconCheck,
};

/**
 * Home page, in the order a customer thinks:
 * what you offer me → who you are (briefly) → your businesses → your products → is it for me? → why you →
 * what it does for my productivity, quality, cost and delivery → how buying works → can I trust you → let's talk.
 */
export default async function HomePage() {
  const site = await getSite();
  const c = site.company;
  const [{ data: slides }, { data: hero }, { data: stats }, { data: shopData }, { data: courses }, { data: apps }, { data: pts }, { data: ben }] = await Promise.all([
    supabase.from("hero_slides").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("hero_content").select("*").limit(1).maybeSingle(),
    supabase.from("site_stats").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("products").select("*").eq("is_active", true).eq("business", "shop").order("featured", { ascending: false }).order("sort_order").limit(4),
    supabase.from("products").select("*").eq("is_active", true).eq("business", "training").order("featured", { ascending: false }).order("sort_order").limit(4),
    supabase.rpc("kmr_software_catalog"),
    supabase.from("home_points").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("product_benefits").select("*").eq("is_active", true).order("sort_order"),
  ]);
  const h = hero as HeroContent | null;
  const heroSlides: HeroSlide[] = (slides as HeroSlide[])?.length ? (slides as HeroSlide[]) : [{
    id: "h", sort_order: 0, eyebrow: "Products · Software · Training · Trade", title: h?.headline || "Everything your business needs, from one trusted partner",
    subtitle: h?.subheadline || "Industrial supplies, software for manufacturers, practical training and import–export — with clear prices and secure payment.",
    image_url: h?.banner_image_url, cta_label: "Explore products", cta_link: "/shop", cta2_label: "Get a quote", cta2_link: "/contact",
  }];
  const shop = (shopData as Product[]) || [];
  const programmes = (courses as Product[]) || [];
  const software = ((apps as App[]) || []).filter((a) => a.code !== "console").slice(0, 4);
  const points = (pts as Point[]) || [];
  const audience = points.filter((p) => p.section === "audience"), why = points.filter((p) => p.section === "why"), steps = points.filter((p) => p.section === "process");
  const benefits = (ben as Benefit[]) || [];
  const name = companyName(c);
  const wa = c.whatsapp_number ? `https://wa.me/${c.whatsapp_number.replace(/\D/g, "")}` : null;
  const trust = ([
    c.gstin && ["GST registered", `GSTIN ${c.gstin}`],
    c.udyam_number && ["Udyam-registered MSME", c.udyam_number],
    ["Secure payments", "Only to our company bank account"],
    ["Clear policies", "Returns, shipping & grievance"],
  ].filter(Boolean) as [string, string][]);
  const fromPrice = (a: App) => { const m = a.prices.find((x) => x.period === "month") ?? a.prices[0]; return m ? `From ${inr(m.amount)} / ${a.seat_label.replace(/s$/, "")} / ${m.period}` : "Free pilot available"; };

  return (
    <>
      {/* 1 · What we offer you */}
      <HeroSlider slides={heroSlides} fallback={
        <div className="grid grid-cols-2 gap-px bg-white/10 ring-1 ring-white/10">
          {site.verticals.slice(0, 6).map((v) => {
            const Icon = VICON[v.slug ?? ""] ?? IconBriefcase;
            return (
              <Link key={v.id} href={verticalHref(v)} className="group flex items-center gap-3 bg-navy/80 p-4 transition-colors hover:bg-navy-700 sm:p-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center border border-gold/40 text-gold-light group-hover:bg-gold group-hover:text-navy-950"><Icon className="h-5 w-5" /></span>
                <span className="text-sm font-semibold leading-snug text-white">{v.title}</span>
              </Link>
            );
          })}
        </div>} />

      {/* proof in numbers */}
      {(stats as SiteStat[])?.length ? (
        <section className="border-b border-line bg-white">
          <div className="wrap grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x">
            {(stats as SiteStat[]).slice(0, 4).map((s) => (
              <div key={s.id} className="px-4 py-6 text-center">
                <p className="font-display text-2xl font-semibold text-navy md:text-[28px]">{s.value}</p>
                <p className="mt-1 text-[13px] leading-snug text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 2 · Who we are — briefly */}
      <section className="py-14">
        <div className="wrap grid items-center gap-10 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="eyebrow mb-3">Welcome to {name}</p>
            <h2 className="h-display text-2xl text-navy md:text-[32px]">One group. Many ways to help your business grow.</h2>
            <p className="lead mt-4 max-w-2xl">{c.short_about || "A multi-business group bringing manufacturing discipline to e-commerce, software, training and trade — with clear prices, GST invoices and secure payment."}</p>
          </div>
          {c.about_image_url && !heroSlides.some((x) => x.image_url === c.about_image_url)
            ? <FitImage src={c.about_image_url} alt={name} className="card aspect-[16/10] w-full" />
            : (
              <ul className="card grid gap-4 p-6 sm:grid-cols-2">
                {trust.map(([t, d]) => <li key={t} className="flex gap-3"><IconCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold" /><span><b className="block text-sm text-navy">{t}</b><span className="text-xs text-muted">{d}</span></span></li>)}
              </ul>
            )}
        </div>
      </section>

      {/* 3 · Business verticals */}
      {site.verticals.length > 0 && (
        <section className="bg-white py-14">
          <div className="wrap">
            <SectionHead eyebrow="What we do" title="Our business verticals" intro="Choose the business you need — each backed by the whole group." center />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {site.verticals.map((v: Vertical) => {
                const Icon = VICON[v.slug ?? ""] ?? IconBriefcase;
                return (
                  <Link key={v.id} href={verticalHref(v)} className="card-hover group flex gap-4 p-6">
                    <span className="grid h-12 w-12 shrink-0 place-items-center bg-navy text-gold-light transition-colors group-hover:bg-gold group-hover:text-navy-950">
                      {v.icon_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={v.icon_url} alt="" className="h-7 w-7 object-contain" /> : <Icon className="h-6 w-6" />}
                    </span>
                    <span>
                      <span className="block font-display text-lg font-semibold text-navy">{v.title}</span>
                      <span className="mt-1 line-clamp-2 block text-sm text-muted">{v.description}</span>
                      <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-dark">Explore <IconArrow className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 4 · Our products */}
      {(shop.length > 0 || software.length > 0 || programmes.length > 0) && (
        <section id="products" className="scroll-mt-24 py-14">
          <div className="wrap space-y-12">
            <SectionHead eyebrow="Our products" title="Products & services you can buy today" intro="Order online, start a software pilot or enrol your team — prices are shown up front." center />
            {shop.length > 0 && (
              <div>
                <div className="mb-5 flex items-end justify-between"><h3 className="font-display text-xl font-semibold text-navy">From the online shop</h3><Link href="/shop" className="link-gold text-sm">Shop all →</Link></div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{shop.map((p) => <ProductCard key={p.id} p={p} />)}</div>
              </div>
            )}
            {software.length > 0 && (
              <div>
                <div className="mb-5 flex items-end justify-between"><h3 className="font-display text-xl font-semibold text-navy">Software for manufacturers — KMR Apps</h3><Link href="/software" className="link-gold text-sm">Plans & pricing →</Link></div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {software.map((a) => (
                    <Link key={a.code} href="/software" className="card-hover group flex flex-col p-6">
                      <span className="grid h-11 w-11 place-items-center bg-navy text-gold-light transition-colors group-hover:bg-gold group-hover:text-navy-950"><IconCode className="h-5 w-5" /></span>
                      <h4 className="mt-4 font-display text-lg font-semibold text-navy">{a.name}</h4>
                      <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted">{a.description}</p>
                      <p className="mt-4 text-sm font-semibold text-gold-dark">{fromPrice(a)}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {programmes.length > 0 && (
              <div>
                <div className="mb-5 flex items-end justify-between"><h3 className="font-display text-xl font-semibold text-navy">Training programmes</h3><Link href="/training" className="link-gold text-sm">All programmes →</Link></div>
                <div className="grid gap-4 lg:grid-cols-2">{programmes.map((p) => <ProductRow key={p.id} p={p} />)}</div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 5 · Is it for me? */}
      {audience.length > 0 && (
        <section id="who" className="scroll-mt-24 bg-white py-14">
          <div className="wrap">
            <SectionHead eyebrow="Who we serve" title="Who can use our products & services" intro="Find yourself below — and go straight to what fits you." center />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {audience.map((a) => {
                const Icon = PICON[a.icon ?? ""] ?? IconUsers;
                const body = (
                  <>
                    <Icon className="h-8 w-8 text-gold" />
                    <h3 className="mt-4 font-display text-lg font-semibold text-navy">{a.title}</h3>
                    {a.text && <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{a.text}</p>}
                    {a.link && <span className="mt-4 text-sm font-semibold text-gold-dark">{a.link_label || "Learn more"} →</span>}
                  </>
                );
                return a.link
                  ? <Link key={a.id} href={a.link} className="card-hover flex flex-col p-6">{body}</Link>
                  : <div key={a.id} className="card flex flex-col p-6">{body}</div>;
              })}
            </div>
          </div>
        </section>
      )}

      {/* 6 · Why KMR */}
      {why.length > 0 && (
        <section id="why" className="pattern-navy scroll-mt-24 py-14 text-white">
          <div className="wrap">
            <SectionHead eyebrow="Why KMR" title="Why customers choose KMR" intro="What you can count on every time you buy from us." center light />
            <div className="grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
              {why.map((w) => {
                const Icon = PICON[w.icon ?? ""] ?? IconShield;
                return (
                  <div key={w.id} className="bg-navy p-7">
                    <span className="grid h-11 w-11 place-items-center border border-gold/50 text-gold-light"><Icon className="h-5 w-5" /></span>
                    <h3 className="mt-4 font-display text-lg font-semibold">{w.title}</h3>
                    {w.text && <p className="mt-2 text-sm leading-relaxed text-white/70">{w.text}</p>}
                    {w.link && <Link href={w.link} className="mt-3 inline-block text-sm font-semibold text-gold-light hover:underline">{w.link_label || "Learn more"} →</Link>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 7 · What each product does for Productivity, Quality, Cost, Delivery */}
      {benefits.length > 0 && (
        <section id="benefits" className="scroll-mt-24 py-14">
          <div className="wrap">
            <SectionHead eyebrow="Product-wise benefits" title="What our products do for your productivity, quality, cost & delivery" intro="Pick a product to see the difference it makes." center />
            <BenefitTabs items={benefits} />
          </div>
        </section>
      )}

      {/* 8 · How buying works */}
      {steps.length > 0 && (
        <section id="how" className="scroll-mt-24 bg-white py-14">
          <div className="wrap">
            <SectionHead eyebrow="How it works" title="Simple from enquiry to delivery" center />
            <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, k) => {
                const Icon = PICON[s.icon ?? ""] ?? IconCheck;
                return (
                  <li key={s.id} className="relative border-t-2 border-gold bg-ivory p-6">
                    <span className="absolute -top-4 left-6 grid h-8 w-8 place-items-center rounded-full bg-navy font-display text-sm font-bold text-gold-light">{k + 1}</span>
                    <Icon className="mt-2 h-7 w-7 text-gold" />
                    <h3 className="mt-3 font-display text-lg font-semibold text-navy">{s.title}</h3>
                    {s.text && <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.text}</p>}
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      )}

      {/* 9 · Can I trust you? + 10 · Let's talk */}
      <section className="py-14">
        <div className="wrap">
          <div className="pattern-navy grid items-center gap-8 px-8 py-10 text-white md:grid-cols-[1.4fr_1fr] md:px-12">
            <div>
              <h2 className="h-display text-2xl md:text-[30px]">Tell us what you need — we reply within one working day</h2>
              <p className="mt-3 text-white/70">Products, software, training or a trade enquiry. A clear quote with price, lead time and terms.</p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link href="/contact" className="btn-gold">Get a quote</Link>
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-outline-light"><IconWhatsApp className="h-4 w-4" />WhatsApp</a>}
              {c.phone && <a href={telHref(c.phone)} className="btn-outline-light"><IconPhone className="h-4 w-4" />Call</a>}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
