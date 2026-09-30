import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Vertical } from "@/lib/types";

export const revalidate = 60;
export const metadata = { title: "Our Businesses · KMR Group of Companies" };

export default async function VerticalsPage() {
  const { data } = await supabase.from("verticals").select("*").order("sort_order");
  const verticals = ((data as Vertical[]) || []).filter((v) => v.is_active !== false);

  return (
    <div className="mx-auto max-w-6xl px-5 py-20">
      <p className="eyebrow text-steel mb-3">What We Do</p>
      <h1 className="font-display text-5xl mb-12">Our Businesses</h1>
      {verticals.length === 0 ? (
        <p className="text-sm text-slate font-mono">Coming soon.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-6">
          {verticals.map((v) => (
            <Link key={v.id} href={v.link || "/contact"} className="plate bg-white p-6 block group hover:border-copper transition-colors">
              {v.icon_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.icon_url} alt="" className="h-12 w-12 object-contain mb-3" />
              )}
              <p className="eyebrow mb-2 text-steel">{v.code || "BUSINESS"}</p>
              <h2 className="font-display text-2xl leading-tight mb-2 group-hover:text-copper transition-colors">{v.title}</h2>
              <p className="text-sm text-slate leading-relaxed">{v.description}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
