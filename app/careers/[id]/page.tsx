import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { lines } from "@/lib/site";
import { PageHero, RichText } from "@/components/Blocks";
import ApplyForm from "@/components/ApplyForm";
import { IconBriefcase, IconCheck, IconClock, IconPin } from "@/components/Icons";
import type { JobOpening } from "@/lib/types";

export const revalidate = 60;

async function load(id: string): Promise<JobOpening | null> {
  if (id === "general") return { id: "general", title: "General application", summary: "Tell us about yourself — we will contact you when a suitable role opens.", posted_on: "" };
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await supabase.from("job_openings").select("*").eq("id", id).maybeSingle();
  return data as JobOpening | null;
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const j = await load((await params).id);
  return { title: j ? `${j.title} — Careers` : "Careers" };
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const j = await load(id);
  if (!j) notFound();
  const facts = ([["Department", j.department], ["Location", j.location], ["Type", j.employment_type], ["Experience", j.experience], ["Salary", j.salary_range],
    ["Apply by", j.closes_on ? new Date(j.closes_on).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : undefined]] as [string, string | undefined][]).filter(([, v]) => v);
  const reqs = lines(j.requirements);

  return (
    <>
      <PageHero eyebrow={j.department || "Careers"} title={j.title} intro={j.summary} crumbs={[["Careers", "/careers"], [j.title]]}>
        <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70">
          {j.location && <span className="flex items-center gap-1.5"><IconPin className="h-4 w-4 text-gold" />{j.location}</span>}
          {j.employment_type && <span className="flex items-center gap-1.5"><IconBriefcase className="h-4 w-4 text-gold" />{j.employment_type}</span>}
          {j.experience && <span className="flex items-center gap-1.5"><IconClock className="h-4 w-4 text-gold" />{j.experience}</span>}
        </p>
      </PageHero>
      <section className="py-16">
        <div className="wrap grid gap-12 lg:grid-cols-[1fr_440px]">
          <div>
            {j.description && <><h2 className="h-display mb-4 text-2xl text-navy">About the role</h2><RichText text={j.description} /></>}
            {reqs.length > 0 && <>
              <h2 className="h-display mb-4 mt-10 text-2xl text-navy">What we are looking for</h2>
              <ul className="space-y-3">{reqs.map((r) => <li key={r} className="flex gap-3 text-ink/80"><IconCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold" />{r}</li>)}</ul>
            </>}
            {facts.length > 0 && <dl className="card mt-10 grid gap-px bg-line sm:grid-cols-2">{facts.map(([k, v]) => <div key={k} className="bg-white p-5"><dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{k}</dt><dd className="mt-1 font-medium text-navy">{v}</dd></div>)}</dl>}
            <Link href="/careers#openings" className="link-gold mt-10 inline-block text-sm">← All openings</Link>
          </div>
          <div id="apply" className="lg:sticky lg:top-28 lg:self-start"><ApplyForm jobId={j.id === "general" ? null : j.id} jobTitle={j.title} /></div>
        </div>
      </section>
    </>
  );
}
