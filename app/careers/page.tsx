import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getSite, lines } from "@/lib/site";
import { PageHero, SectionHead } from "@/components/Blocks";
import { IconArrow, IconBriefcase, IconClock, IconPin, IconShield } from "@/components/Icons";
import type { JobOpening } from "@/lib/types";

export const revalidate = 60;
export const metadata = { title: "Careers", description: "Open positions at KMR Group of Companies." };

export default async function CareersPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams;
  const [{ company: c }, { data }] = await Promise.all([getSite(), supabase.from("job_openings").select("*").order("sort_order").order("posted_on", { ascending: false })]);
  const jobs = (data as JobOpening[]) || [];
  const depts = [...new Set(jobs.map((j) => j.department).filter(Boolean))] as string[];
  const shown = d ? jobs.filter((j) => j.department === d) : jobs;
  const values = lines(c.core_values).slice(0, 4).map((v) => v.split(/\s[—–-]\s/));
  const perks = values.length ? values : [["Ownership", "Real responsibility from day one."], ["Learning", "Training in quality, core tools and digital skills."], ["Growth", "A group of businesses means room to grow."], ["Integrity", "We do what we say."]];

  return (
    <>
      <PageHero eyebrow="Careers" title="Build what’s next with us" intro="Join a group that values precision, ownership and learning — across trading, software, training and supply." />

      <section className="bg-white py-14">
        <div className="wrap">
          <SectionHead eyebrow="Why KMR" title="Life at KMR" center />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {perks.map(([t, x]) => (
              <div key={t} className="border-t-2 border-gold bg-ivory p-7">
                <IconShield className="h-8 w-8 text-gold" />
                <h3 className="mt-4 font-display text-xl font-semibold text-navy">{t}</h3>
                {x && <p className="mt-2 text-sm leading-relaxed text-muted">{x}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="openings" className="scroll-mt-24 py-14">
        <div className="wrap">
          <SectionHead eyebrow="Open positions" title={jobs.length ? `${jobs.length} open role${jobs.length === 1 ? "" : "s"}` : "No openings right now"}
            intro={jobs.length ? "Find a role that fits and apply online — it takes two minutes." : "We are always glad to hear from good people. Send your profile and we will contact you when a suitable role opens."} />
          {depts.length > 1 && (
            <div className="mb-8 flex flex-wrap gap-2">
              <Link href="/careers#openings" className={`border px-4 py-2 text-sm ${!d ? "border-gold bg-gold text-navy-950" : "border-line bg-white text-navy hover:border-gold"}`}>All</Link>
              {depts.map((x) => <Link key={x} href={`/careers?d=${encodeURIComponent(x)}#openings`} className={`border px-4 py-2 text-sm ${d === x ? "border-gold bg-gold text-navy-950" : "border-line bg-white text-navy hover:border-gold"}`}>{x}</Link>)}
            </div>
          )}
          <div className="space-y-4">
            {shown.map((j) => (
              <Link key={j.id} href={`/careers/${j.id}`} className="card-hover group grid items-center gap-4 p-6 md:grid-cols-[1fr_auto] md:p-8">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {j.department && <span className="bg-gold-pale px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-gold-dark">{j.department}</span>}
                    {j.employment_type && <span className="border border-line px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{j.employment_type}</span>}
                  </div>
                  <h3 className="mt-3 font-display text-2xl font-semibold text-navy">{j.title}</h3>
                  {j.summary && <p className="mt-1 text-muted">{j.summary}</p>}
                  <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
                    {j.location && <span className="flex items-center gap-1.5"><IconPin className="h-4 w-4 text-gold" />{j.location}</span>}
                    {j.experience && <span className="flex items-center gap-1.5"><IconBriefcase className="h-4 w-4 text-gold" />{j.experience}</span>}
                    {j.closes_on && <span className="flex items-center gap-1.5"><IconClock className="h-4 w-4 text-gold" />Apply by {new Date(j.closes_on).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                  </p>
                </div>
                <span className="btn-outline group-hover:border-gold group-hover:bg-gold group-hover:text-navy-950">View & apply <IconArrow className="h-4 w-4" /></span>
              </Link>
            ))}
            <Link href="/careers/general" className="card-hover group flex flex-col items-start justify-between gap-4 border-dashed p-6 md:flex-row md:items-center md:p-8">
              <div><h3 className="font-display text-xl font-semibold text-navy">Don’t see the right role?</h3><p className="mt-1 text-muted">Send a general application{c.careers_email ? ` or write to ${c.careers_email}` : ""}.</p></div>
              <span className="btn-navy">Send your profile</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
