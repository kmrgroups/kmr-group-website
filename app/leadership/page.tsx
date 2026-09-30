import { supabase } from "@/lib/supabaseClient";
import { PageHero, CtaBand } from "@/components/Blocks";
import { IconLinkedIn } from "@/components/Icons";
import type { Leader } from "@/lib/types";

export const revalidate = 60;
export const metadata = { title: "Leadership" };

export default async function LeadershipPage() {
  const { data } = await supabase.from("leaders").select("*").order("sort_order");
  const leaders = ((data as (Leader & { is_active?: boolean })[]) || []).filter((l) => l.is_active !== false);
  return (
    <>
      <PageHero eyebrow="Leadership" title="The people behind KMR" intro="Experience from the shop floor to the boardroom, focused on doing things right." crumbs={[["About", "/about"], ["Leadership"]]} />
      <section className="py-20">
        <div className="wrap space-y-10">
          {leaders.length === 0 && <p className="text-muted">Profiles are coming soon.</p>}
          {leaders.map((l, i) => (
            <article key={l.id} className={`card grid items-stretch overflow-hidden ${i % 2 ? "md:grid-cols-[1fr_320px]" : "md:grid-cols-[320px_1fr]"}`}>
              <div className={`aspect-[4/5] bg-sand md:aspect-auto ${i % 2 ? "md:order-2" : ""}`}>
                {l.photo_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={l.photo_url} alt={l.name} className="h-full w-full object-cover" />
                  : <div className="pattern-navy grid h-full min-h-[280px] place-items-center font-display text-6xl text-gold/60">{l.name.slice(0, 1)}</div>}
              </div>
              <div className="flex flex-col justify-center p-8 md:p-12">
                <p className="eyebrow mb-3">{l.designation}</p>
                <h2 className="h-display text-3xl text-navy">{l.name}</h2>
                {l.bio && <p className="mt-5 whitespace-pre-line leading-[1.8] text-ink/80">{l.bio}</p>}
                {l.linkedin_url && <a href={l.linkedin_url} target="_blank" rel="noopener noreferrer" className="link-gold mt-6 inline-flex items-center gap-2 text-sm"><IconLinkedIn className="h-4 w-4" /> LinkedIn profile</a>}
              </div>
            </article>
          ))}
        </div>
      </section>
      <CtaBand title="Join a team that cares about quality" primary={["See open positions", "/careers"]} secondary={["About us", "/about"]} />
    </>
  );
}
