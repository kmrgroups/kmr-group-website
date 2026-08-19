import { supabase } from "@/lib/supabaseClient";
import SpecPlate from "@/components/SpecPlate";
import type { Leader } from "@/lib/types";

export const revalidate = 60;

export default async function LeadershipPage() {
  const { data } = await supabase.from("leaders").select("*").order("sort_order");
  const leaders = (data as Leader[]) || [];

  return (
    <div className="mx-auto max-w-6xl px-5 py-20">
      <p className="eyebrow text-steel mb-3">Our People</p>
      <h1 className="font-display text-5xl mb-12">Leadership Team</h1>

      {leaders.length === 0 ? (
        <p className="text-sm text-slate font-mono">No leadership profiles added yet — add them from Admin → Leadership.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {leaders.map((l) => (
            <div key={l.id} className="plate bg-white overflow-hidden">
              <div className="aspect-[4/3] bg-line/40">
                {l.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.photo_url} alt={l.name} className="w-full h-full object-cover object-top" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate font-mono">NO PHOTO</div>
                )}
              </div>
              <div className="p-5">
                <p className="eyebrow text-copper mb-1">{l.designation}</p>
                <h3 className="font-display text-2xl mb-2">{l.name}</h3>
                <p className="text-sm text-slate leading-relaxed">{l.bio}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
