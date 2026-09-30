"use client";
import FitImage from "@/components/FitImage";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { HeroSlide } from "@/lib/types";

/** Full-width rotating banner. Pauses on hover; arrows and dots; respects reduced motion. */
export default function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;
  const go = useCallback((d: number) => setI((x) => (x + d + n) % n), [n]);
  useEffect(() => {
    if (n < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => go(1), 7000);
    return () => clearInterval(t);
  }, [n, paused, go]);
  if (!n) return null;

  return (
    <section className="relative isolate overflow-hidden bg-navy-950 text-white" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-roledescription="carousel">
      <div className="relative min-h-[440px] md:min-h-[540px]">
        {slides.map((s, k) => (
          <div key={s.id} className={`absolute inset-0 transition-opacity duration-1000 ${k === i ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={k !== i}>
            {s.image_url
              ? <FitImage src={s.image_url} className="absolute inset-0" eager={k === 0} />
              : <div className="pattern-navy absolute inset-0" />}
            <div className="absolute inset-0 bg-gradient-to-r from-navy-950/95 via-navy-950/75 to-navy-950/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 via-transparent to-transparent" />
            <div className="wrap relative flex min-h-[620px] items-center md:min-h-[680px]">
              <div key={k === i ? `on-${i}` : "off"} className="max-w-2xl pb-28 pt-12">
                {s.eyebrow && <p className="eyebrow eyebrow-light mb-6 animate-fadeUp">{s.eyebrow}</p>}
                <h1 className="h-display animate-fadeUp text-3xl [animation-delay:.1s] sm:text-4xl lg:text-[52px]">{s.title}</h1>
                {s.subtitle && <p className="mt-5 max-w-2xl animate-fadeUp text-base leading-relaxed text-white/80 [animation-delay:.2s] md:text-lg">{s.subtitle}</p>}
                <div className="mt-8 flex animate-fadeUp flex-wrap gap-4 [animation-delay:.3s]">
                  {s.cta_label && s.cta_link && <Link href={s.cta_link} className="btn-gold" tabIndex={k === i ? 0 : -1}>{s.cta_label}</Link>}
                  {s.cta2_label && s.cta2_link && <Link href={s.cta2_link} className="btn-outline-light" tabIndex={k === i ? 0 : -1}>{s.cta2_label}</Link>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {n > 1 && (
        <div className="wrap absolute inset-x-0 bottom-20 flex items-center justify-end gap-6">
          <div className="flex gap-2">
            {slides.map((s, k) => (
              <button key={s.id} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} aria-current={k === i}
                className={`h-[3px] transition-all duration-500 ${k === i ? "w-12 bg-gold" : "w-6 bg-white/35 hover:bg-white/60"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => go(-1)} aria-label="Previous slide" className="grid h-11 w-11 place-items-center border border-white/25 text-white/80 transition hover:border-gold hover:text-gold-light">‹</button>
            <button onClick={() => go(1)} aria-label="Next slide" className="grid h-11 w-11 place-items-center border border-white/25 text-white/80 transition hover:border-gold hover:text-gold-light">›</button>
          </div>
        </div>
      )}
    </section>
  );
}
