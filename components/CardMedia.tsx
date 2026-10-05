"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The picture at the top of a card: a promo video (Instagram-reel size, 9:16) with its thumbnail and a ▶ button,
 * or a photo, or — only when nothing was uploaded — the built-in illustration. The video opens full height in a player.
 */
export default function CardMedia({ image, video, poster, alt = "", className = "", hover = true }: {
  image: string; video?: string | null; poster?: string | null; alt?: string; className?: string; hover?: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open]);
  const zoom = hover ? "transition-transform duration-500 group-hover:scale-[1.03]" : "";
  const play = (e: React.MouseEvent | React.KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); setOpen(true); };

  return (
    <div className={`relative overflow-hidden bg-navy-950 ${className}`}>
      {video ? (
        <>
          {poster
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={poster} alt={alt} loading="lazy" className={`h-full w-full object-cover ${zoom}`} />
            : <video src={`${video}#t=0.5`} muted playsInline preload="metadata" className={`h-full w-full object-cover ${zoom}`} />}
          <span role="button" tabIndex={0} aria-label={`Play video: ${alt}`} onClick={play} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && play(e)}
            className="absolute inset-0 grid cursor-pointer place-items-center bg-gradient-to-t from-black/45 via-black/5 to-transparent">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-white/90 shadow-lg ring-4 ring-white/30 transition-transform hover:scale-110">
              <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 fill-navy" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            </span>
            <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">▶ Watch</span>
          </span>
        </>
        // eslint-disable-next-line @next/next/no-img-element
      ) : <img src={image} alt={alt} loading="lazy" className={`h-full w-full object-cover ${zoom}`} />}

      {open && video && createPortal(
        <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="relative h-[min(88vh,960px)] aspect-[9/16] max-w-full overflow-hidden rounded-2xl bg-black shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <video src={video} poster={poster ?? undefined} controls autoPlay playsInline className="h-full w-full object-contain" />
            <button type="button" aria-label="Close video" onClick={() => setOpen(false)}
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-xl leading-none text-white hover:bg-black/80">×</button>
          </div>
        </div>, document.body)}
    </div>
  );
}
