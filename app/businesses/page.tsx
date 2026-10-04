import Link from "next/link";
import FitImage from "@/components/FitImage";
import { verticalArt } from "@/lib/art";
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
      <section className="py-14">
        <div className="wrap grid gap-6 md:grid-cols-2">
          {verticals.length === 0 && <p className="text-muted">Coming soon.</p>}
          {verticals.map((v, i) => {
            const Icon = ICONS[v.slug ?? ""] ?? IconBriefcase;
            const href = verticalHref(v);
            return (
              <article key={v.id} className="card flex flex-col overflow-hidden">
                <FitImage src={verticalArt(v)} alt={v.title} className="aspect-[16/9] w-full border-b border-line" fill={v.image_url ? "blur" : "none"} imgClassName={v.image_url ? "" : "object-cover"} />
                <div className="flex flex-1 flex-col p-6 md:p-8">
                  <div className="flex items-center gap-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center bg-navy text-gold-light"><Icon className="h-6 w-6" /></span>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-dark">{String(i + 1).padStart(2, "0")} · {v.code || "Business"}</p>
                      <h2 className="font-display text-xl font-semibold text-navy md:text-2xl">{v.title}</h2>
                    </div>
                  </div>
                  <p className="mt-4 flex-1 leading-relaxed text-ink/75">{v.description}</p>
                  <Link href={href} className="btn-navy mt-6 self-start">
                    {href.startsWith("/trade") ? "Request a quote" : href === "/shop" ? "Shop now" : href === "/software" ? "Explore solutions" : href === "/training" ? "View programmes" : "Talk to us"} <IconArrow className="h-4 w-4" />
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
