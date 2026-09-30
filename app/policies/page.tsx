import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { PageHero } from "@/components/Blocks";
import { IconArrow, IconFile } from "@/components/Icons";
import type { LegalPage } from "@/lib/types";

export const revalidate = 60;
export const metadata = { title: "Company policies" };

export default async function PoliciesPage() {
  const { data } = await supabase.from("legal_pages").select("slug,title,summary,updated_at,is_active").order("sort_order");
  const pages = ((data as (LegalPage & { is_active?: boolean })[]) || []).filter((p) => p.is_active !== false);
  return (
    <>
      <PageHero eyebrow="Policies" title="Company policies" intro="How we sell, deliver, refund, protect your data and handle grievances." />
      <section className="py-14">
        <div className="wrap grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {pages.map((p) => (
            <Link key={p.slug} href={`/policies/${p.slug}`} className="card-hover group flex flex-col p-7">
              <IconFile className="h-9 w-9 text-gold" />
              <h2 className="mt-5 font-display text-xl font-semibold text-navy">{p.title}</h2>
              {p.summary && <p className="mt-2 text-sm leading-relaxed text-muted">{p.summary}</p>}
              <span className="mt-auto flex items-center justify-between pt-6 text-xs text-muted">
                Updated {new Date(p.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                <IconArrow className="h-4 w-4 text-gold-dark transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
