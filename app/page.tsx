import Link from "next/link";
import FitImage from "@/components/FitImage";
import { supabase } from "@/lib/supabaseClient";
import { getSite, companyName, paragraphs, verticalHref } from "@/lib/site";
import HeroSlider from "@/components/HeroSlider";
import ProductCard from "@/components/ProductCard";
import { SectionHead } from "@/components/Blocks";
import { IconArrow, IconBag, IconBriefcase, IconCap, IconChart, IconCode, IconGlobe, IconQuote, IconShield, IconTruck } from "@/components/Icons";
import type { HeroContent, HeroSlide, Product, SiteStat, Vertical } from "@/lib/types";

export const revalidate = 60;

type App = { code: string; name: string; description: string | null };
const ICONS: Record<string, typeof IconBag> = { shop: IconBag, software: IconCode, training: IconCap, import_export: IconGlobe, trading: IconTruck, distribution: IconTruck, investment: IconChart };

export default async function HomePage() {
  const site = await getSite();
  const c = site.company;
  const [{ data: slides }, { data: hero }, { data: stats }, { data: featured }, { data: latest }, { data: courses }, { data: apps }, { count: jobs }] = await Promise.all([
    supabase.from("hero_slides").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("hero_content").select("*").limit(1).maybeSingle(),
    supabase.from("site_stats").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("products").select("*").eq("is_active", true).eq("featured", true).in("business", ["shop", "training", "software"]).order("sort_order").limit(8),
    supabase.from("products").select("*").eq("is_active", true).eq("business", "shop").order("created_at", { ascending: false }).limit(4),
    supabase.from("products").select("*").eq("is_active", true).eq("business", "training").order("sort_order").limit(3),
    supabase.rpc("kmr_software_catalog"),
    supabase.from("job_openings").select("id", { count: "exact", head: true }),
  ]);
  const h = hero as HeroContent | null;
  const heroSlides: HeroSlide[] = (slides as HeroSlide[])?.length ? (slides as HeroSlide[]) : [{
    id: "h", sort_order: 0, eyebrow: companyName(c), title: h?.headline || "One Vision. Multiple Solutions. Global Impact.",
    subtitle: h?.subheadline, image_url: h?.banner_image_url, cta_label: h?.cta_label || "Explore our businesses", cta_link: h?.cta_link || "/businesses", cta2_label: "Contact us", cta2_link: "/contact",
  }];
  const products = ((featured as Product[])?.length ? (featured as Product[]) : ((latest as Product[]) || [])).slice(0, 8);
  const programmes = (courses as Product[]) || [];
  const software = ((apps as App[]) || []).filter((a) => a.code !== "console").slice(0, 4);
  const founderIntro = paragraphs(c.founder_message)[0];
  const values = (c.core_values ?? "").split("\n").map((v) => v.trim()).filter(Boolean).slice(0, 4);

  return (
    <>
      <HeroSlider slides={heroSlides} />

      {/* Highlights */}
      {(stats as SiteStat[])?.length ? (
        <section className="relative z-10 -mt-14">
          <div className="wrap">
            <div className="grid grid-cols-2 bg-white shadow-lift md:grid-cols-4">
              {(stats as SiteStat[]).slice(0, 4).map((s, i) => (
                <div key={s.id} className={`border-line px-6 py-8 text-center md:px-8 ${i % 2 ? "border-l" : ""} ${i > 1 ? "border-t md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`}>
                  <p className="font-display text-3xl font-semibold text-navy">{s.value}</p>
                  <p className="mt-2 text-[13px] leading-snug text-muted">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* About */}
      <section className="py-16">
        <div className="wrap grid items-center gap-16 lg:grid-cols-2">
          <div className="corner order-2 lg:order-1">
            <div className="pattern-navy relative aspect-[5/4] overflow-hidden">
              {c.about_image_url || c.logo_url
                ? <FitImage src={(c.about_image_url || c.logo_url)!} alt={companyName(c)} className="h-full w-full" fill={c.about_image_url ? "blur" : "plain"} imgClassName={c.about_image_url ? "" : "p-12"} />
                : <div className="grid h-full place-items-center"><span className="border-2 border-gold px-6 py-2 font-display text-6xl font-bold text-white">KMR</span></div>}
            </div>
            {c.founded_year && <div className="absolute -bottom-6 right-6 bg-gold px-6 py-4 text-navy-950 shadow-lift"><p className="text-[11px] font-semibold uppercase tracking-widest">Established</p><p className="font-display text-3xl font-bold">{c.founded_year}</p></div>}
          </div>
          <div className="order-1 lg:order-2">
            <p className="eyebrow mb-4">About {companyName(c).replace(/ of Companies$/i, "")}</p>
            <h2 className="h-display text-2xl text-navy md:text-[32px]">{c.tagline || "Built on trust, driven by precision"}</h2>
            <p className="lead mt-6">{c.short_about || "A multi-business group bringing manufacturing know-how to trading, software, training and supply."}</p>
            {(c.vision || c.mission) && (
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {c.vision && <div className="border-l-2 border-gold bg-white p-5"><p className="text-[11px] font-semibold uppercase tracking-widest text-gold-dark">Vision</p><p className="mt-2 line-clamp-4 text-sm leading-relaxed text-ink/80">{c.vision}</p></div>}
                {c.mission && <div className="border-l-2 border-gold bg-white p-5"><p className="text-[11px] font-semibold uppercase tracking-widest text-gold-dark">Mission</p><p className="mt-2 line-clamp-4 text-sm leading-relaxed text-ink/80">{c.mission}</p></div>}
              </div>
            )}
            {values.length > 0 && <ul className="mt-6 grid gap-2 sm:grid-cols-2">{values.map((v) => <li key={v} className="flex items-center gap-2 text-sm font-medium text-navy"><IconShield className="h-4 w-4 text-gold" />{v.split(/\s[—–-]\s/)[0]}</li>)}</ul>}
            <Link href="/about" className="btn-navy mt-10">Discover our story <IconArrow className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      {/* Businesses */}
      {site.verticals.length > 0 && (
        <section className="bg-white py-16">
          <div className="wrap">
            <SectionHead eyebrow="What we do" title="Our business verticals" intro="Independent businesses, one standard of quality — each backed by the whole group." center />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {site.verticals.map((v: Vertical) => {
                const Icon = ICONS[v.slug ?? ""] ?? IconBriefcase;
                return (
                  <Link key={v.id} href={verticalHref(v)} className="group relative flex min-h-[300px] flex-col justify-end overflow-hidden bg-navy p-8 text-white">
                    {v.image_url
                      ? <FitImage src={v.image_url} className="absolute inset-0 opacity-60 transition duration-500 group-hover:opacity-45" />
                      : <div className="pattern-navy absolute inset-0" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/60 to-transparent" />
                    <div className="relative">
                      <span className="mb-5 grid h-12 w-12 place-items-center border border-gold/50 text-gold-light transition-colors group-hover:bg-gold group-hover:text-navy-950">
                        {v.icon_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={v.icon_url} alt="" className="h-7 w-7 object-contain" /> : <Icon className="h-6 w-6" />}
                      </span>
                      {v.code && <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-light">{v.code}</p>}
                      <h3 className="mt-1 font-display text-2xl font-semibold">{v.title}</h3>
                      <p className="mt-2 line-clamp-2 text-sm text-white/70">{v.description}</p>
                      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gold-light">Explore <IconArrow className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Founder */}
      {founderIntro && (
        <section className="pattern-navy py-16 text-white">
          <div className="wrap grid items-center gap-14 lg:grid-cols-[380px_1fr]">
            <div className="corner mx-auto w-full max-w-[380px]">
              <div className="aspect-[4/5] overflow-hidden bg-navy-800">
                {c.founder_photo_url
                  ? <FitImage src={c.founder_photo_url} alt={c.founder_name || "Founder"} className="h-full w-full" />
                  : <div className="grid h-full place-items-center font-display text-6xl text-gold/60">{(c.founder_name || "K").slice(0, 1)}</div>}
              </div>
            </div>
            <div>
              <p className="eyebrow eyebrow-light mb-6">Founder’s message</p>
              <IconQuote className="h-12 w-12 text-gold" />
              <blockquote className="mt-4 font-display text-xl leading-relaxed text-white/90 md:text-2xl">{founderIntro}</blockquote>
              <div className="mt-8 flex flex-wrap items-center gap-6">
                {c.founder_signature_url
                  // eslint-disable-next-line @next/next/no-img-element
                  && <img src={c.founder_signature_url} alt="" className="h-14 w-auto opacity-90 invert" />}
                <div>
                  <p className="font-display text-xl text-gold-light">{c.founder_name || c.proprietor_name}</p>
                  <p className="text-sm text-white/60">{c.founder_title || c.proprietor_title}</p>
                </div>
              </div>
              <Link href="/about#founder" className="btn-outline-light mt-10">Read the full message</Link>
            </div>
          </div>
        </section>
      )}

      {/* Software */}
      {software.length > 0 && (
        <section className="py-16">
          <div className="wrap">
            <SectionHead eyebrow="Software solutions" title="Run your plant on KMR Apps" intro="Cloud software built by manufacturing people — one login, your data in India, a free pilot to start."
              action={<Link href="/software" className="btn-outline shrink-0">All solutions <IconArrow className="h-4 w-4" /></Link>} />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {software.map((a, i) => (
                <Link key={a.code} href="/software" className="card-hover group p-7">
                  <span className="font-display text-sm font-semibold text-gold-dark">0{i + 1}</span>
                  <span className="mt-4 grid h-12 w-12 place-items-center bg-navy text-gold-light transition-colors group-hover:bg-gold group-hover:text-navy-950"><IconCode className="h-6 w-6" /></span>
                  <h3 className="mt-5 font-display text-xl font-semibold text-navy">{a.name}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{a.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Shop */}
      {products.length > 0 && (
        <section className="bg-sand/60 py-16">
          <div className="wrap">
            <SectionHead eyebrow="Online shop" title="Featured from our catalogue" intro="Order online and pay securely — UPI, cards, net banking or bank transfer, straight to our company account."
              action={<Link href="/shop" className="btn-outline shrink-0">Visit the shop <IconArrow className="h-4 w-4" /></Link>} />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          </div>
        </section>
      )}

      {/* Training */}
      {programmes.length > 0 && (
        <section className="bg-white py-16">
          <div className="wrap">
            <SectionHead eyebrow="Training & development" title="Programmes that build capability" action={<Link href="/training" className="btn-outline shrink-0">All programmes <IconArrow className="h-4 w-4" /></Link>} />
            <div className="grid gap-6 md:grid-cols-3">{programmes.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          </div>
        </section>
      )}

      {/* Careers + contact */}
      <section className="py-16">
        <div className="wrap grid gap-6 md:grid-cols-2">
          <div className="card flex flex-col p-10">
            <IconBriefcase className="h-10 w-10 text-gold" />
            <h3 className="mt-5 font-display text-2xl font-semibold text-navy">Build your career with us</h3>
            <p className="mt-3 text-muted">We look for people who take ownership and care about quality. {jobs ? `${jobs} open position${jobs === 1 ? "" : "s"} right now.` : "Send us your profile for future openings."}</p>
            <Link href="/careers" className="btn-navy mt-8 self-start">View careers <IconArrow className="h-4 w-4" /></Link>
          </div>
          <div className="pattern-navy flex flex-col p-10 text-white">
            <IconGlobe className="h-10 w-10 text-gold" />
            <h3 className="mt-5 font-display text-2xl font-semibold">Let’s work together</h3>
            <p className="mt-3 text-white/70">Products, software, training or a trade enquiry — tell us what you need and we reply within one working day.</p>
            <Link href="/contact" className="btn-gold mt-8 self-start">Contact us <IconArrow className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
