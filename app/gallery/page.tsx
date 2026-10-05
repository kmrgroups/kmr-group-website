import { supabase } from "@/lib/supabaseClient";
import { PageHero } from "@/components/Blocks";
import type { GalleryItem } from "@/lib/types";
import CardMedia from "@/components/CardMedia";

export const revalidate = 60;
export const metadata = { title: "Gallery" };

export default async function GalleryPage() {
  const { data } = await supabase.from("gallery_items").select("*").order("sort_order");
  const items = ((data as (GalleryItem & { is_active?: boolean })[]) || []).filter((g) => g.is_active !== false);
  return (
    <>
      <PageHero eyebrow="Gallery" title="Moments & milestones" intro="Our people, facilities, events, work and product videos." />
      <section className="py-14">
        <div className="wrap">
          {items.length === 0 ? <p className="text-muted">Photos of our work, events and facilities will appear here soon. Meanwhile, see <a href="/about" className="link-gold">About us</a>.</p> : (
            <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 [&>*]:mb-5">
              {items.map((g) => (
                <figure key={g.id} className="group relative break-inside-avoid overflow-hidden bg-navy">
                  {g.media_type === "video"
                    ? <CardMedia image={g.thumbnail_url || ""} video={g.media_url} poster={g.thumbnail_url} alt={g.title || "Video"} className="aspect-[9/16] w-full" />   /* reels: thumbnail + ▶, plays full height */
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={g.media_url} alt={g.title || "Gallery photo"} className="w-full transition duration-700 group-hover:scale-[1.03]" loading="lazy" />}
                  {g.title && <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/90 to-transparent px-5 pb-4 pt-10 text-sm font-medium text-white opacity-0 transition group-hover:opacity-100">{g.title}</figcaption>}
                </figure>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
