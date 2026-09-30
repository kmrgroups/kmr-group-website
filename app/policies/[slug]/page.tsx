import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PageHero, RichText } from "@/components/Blocks";
import type { LegalPage } from "@/lib/types";

export const revalidate = 60;

async function load(slug: string) {
  const { data } = await supabase.from("legal_pages").select("*").eq("slug", slug).maybeSingle();
  const p = data as (LegalPage & { is_active?: boolean }) | null;
  return p && p.is_active !== false ? p : null;
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const p = await load((await params).slug);
  return { title: p?.title ?? "Policy" };
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) notFound();
  const { data: others } = await supabase.from("legal_pages").select("slug,title,is_active").order("sort_order");
  return (
    <>
      <PageHero eyebrow="Policy" title={page.title} intro={page.summary} crumbs={[["Policies", "/policies"], [page.title]]} />
      <section className="py-16">
        <div className="wrap grid gap-12 lg:grid-cols-[1fr_280px]">
          <article className="card p-8 md:p-12">
            <p className="mb-8 text-xs uppercase tracking-wider text-muted">Last updated {new Date(page.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
            <RichText text={page.content} />
          </article>
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-dark">All policies</p>
            <ul className="card divide-y divide-line">
              {((others as { slug: string; title: string; is_active?: boolean }[]) || []).filter((o) => o.is_active !== false).map((o) => (
                <li key={o.slug}><Link href={`/policies/${o.slug}`} className={`block px-5 py-3 text-sm ${o.slug === slug ? "bg-ivory font-semibold text-gold-dark" : "text-navy hover:bg-ivory"}`}>{o.title}</Link></li>
              ))}
            </ul>
          </aside>
        </div>
      </section>
    </>
  );
}
