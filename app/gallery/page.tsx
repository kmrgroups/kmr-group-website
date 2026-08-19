import { supabase } from "@/lib/supabaseClient";
import type { GalleryItem } from "@/lib/types";

export const revalidate = 60;

export default async function GalleryPage() {
  const { data } = await supabase.from("gallery_items").select("*").order("sort_order");
  const items = (data as GalleryItem[]) || [];

  return (
    <div className="mx-auto max-w-6xl px-5 py-20">
      <p className="eyebrow text-steel mb-3">In the Field</p>
      <h1 className="font-display text-5xl mb-12">Gallery</h1>

      {items.length === 0 ? (
        <p className="text-sm text-slate font-mono">No photos or videos added yet — add them from Admin → Gallery.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((g) => (
            <div key={g.id} className="plate bg-white overflow-hidden">
              <div className="aspect-video bg-line/40">
                {g.media_type === "video" ? (
                  <video src={g.media_url} controls poster={g.thumbnail_url} className="w-full h-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.media_url} alt={g.title || "Gallery item"} className="w-full h-full object-cover" />
                )}
              </div>
              {g.title && <p className="p-3 text-sm font-medium">{g.title}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
