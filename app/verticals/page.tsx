import { supabase } from "@/lib/supabaseClient";
import SpecPlate from "@/components/SpecPlate";
import type { Vertical } from "@/lib/types";

export const revalidate = 60;

export default async function VerticalsPage() {
  const { data } = await supabase.from("verticals").select("*").order("sort_order");
  const verticals = (data as Vertical[]) || [];

  return (
    <div className="mx-auto max-w-6xl px-5 py-20">
      <p className="eyebrow text-steel mb-3">What We Run</p>
      <h1 className="font-display text-5xl mb-12">Business Verticals</h1>

      {verticals.length === 0 ? (
        <p className="text-sm text-slate font-mono">No verticals added yet — add them from Admin → Verticals.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-6">
          {verticals.map((v) => (
            <SpecPlate key={v.id} eyebrow={v.code || "VERTICAL"} title={v.title}>
              <p className="text-sm text-slate leading-relaxed">{v.description}</p>
            </SpecPlate>
          ))}
        </div>
      )}
    </div>
  );
}
