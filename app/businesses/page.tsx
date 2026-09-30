import Link from "next/link";
import { getSite, verticalHref } from "@/lib/site";
import { PageHero, CtaBand } from "@/components/Blocks";
import { IconArrow, IconBag, IconBriefcase, IconCap, IconChart, IconCode, IconGlobe, IconTruck } from "@/components/Icons";

export const revalidate = 60;
export const metadata = { title: "Our businesses" };
const ICONS: Record<string, typeof IconBag> = { shop: IconBag, software: IconCode, training: IconCap, import_export: IconGlobe, trading: IconTruck, distribution: IconTruck, investment: IconChart };

export default async function BusinessesPage() {
  const { verticals } = await getSite();
  return (
    <>
      <PageHero eyebrow="Our businesses" title="Business verticals" intro="Each business runs on its own strengths and shares the group’s standards: clear pricing, registered billing and people who answer." />
      <section className="py-20">
        <div className="wrap space-y-8">
          {verticals.length === 0 && <p className="text-muted">Coming soon.</p>}
          {verticals.map((v, i) => {
            const Icon = ICONS[v.slug ?? ""] ?? IconBriefcase;
            return (
              <article key={v.id} className="card grid overflow-hidden md:grid-cols-2">
                <div className={`relative min-h-[260px] bg-navy ${i % 2 ? "md:order-2" : ""}`}>
                  {v.image_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={v.image_url} alt={v.title} className="absolute inset-0 h-full w-full object-cover" />
                    : <div className="pattern-navy absolute inset-0 grid place-items-center"><Icon className="h-20 w-20 text-gold/50" /></div>}
                  <span className="absolute left-6 top-6 bg-gold px-3 py-1 font-display text-lg font-bold text-navy-950">0{i + 1}</span>
                </div>
                <div className="flex flex-col justify-center p-8 md:p-14">
                  {v.code && <p className="eyebrow mb-3">{v.code}</p>}
                  <h2 className="h-display text-3xl text-navy md:text-4xl">{v.title}</h2>
                  <p className="mt-4 leading-[1.8] text-ink/75">{v.description}</p>
                  <Link href={verticalHref(v)} className="btn-navy mt-8 self-start">
                    {verticalHref(v).startsWith("/trade") ? "Request a quote" : verticalHref(v) === "/shop" ? "Shop now" : verticalHref(v) === "/software" ? "Explore solutions" : verticalHref(v) === "/training" ? "View programmes" : "Talk to us"} <IconArrow className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <CtaBand title="Not sure which business fits your need?" text="Tell us what you are looking for — we will connect you with the right team." primary={["Contact us", "/contact"]} />
    </>
  );
}
