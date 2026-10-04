"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { HeroSlide } from "@/lib/types";

/**
 * Home banner. Text sits on its own navy panel (always readable); the slide's photo is shown whole beside it,
 * never behind the text and never cropped. Pauses on hover; arrows and dots; respects reduced motion.
 */
export default function HeroSlider({ slides, fallback }: { slides: HeroSlide[]; fallback?: React.ReactNode }) {
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
  const s = slides[i];

  return (
    <section className="pattern-navy relative overflow-hidden text-white" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-roledescription="carousel">
      <div className="wrap grid items-center gap-10 py-12 lg:min-h-[500px] lg:grid-cols-[1fr_1.05fr] lg:py-14">
        <div key={`t-${i}`} className="animate-fadeUp">
          {s.eyebrow && <p className="eyebrow eyebrow-light mb-5">{s.eyebrow}</p>}
          {i === 0
            ? <h1 className="h-display text-[30px] leading-[1.12] sm:text-4xl lg:text-[44px]">{s.title}</h1>
            : <h2 className="h-display text-[30px] leading-[1.12] sm:text-4xl lg:text-[44px]">{s.title}</h2>}
          {s.subtitle && <p className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-white/75">{s.subtitle}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            {s.cta_label && s.cta_link && <Link href={s.cta_link} className="btn-gold">{s.cta_label}</Link>}
            {s.cta2_label && s.cta2_link && <Link href={s.cta2_link} className="btn-outline-light">{s.cta2_label}</Link>}
          </div>
          {n > 1 && (
            <div className="mt-10 flex items-center gap-4">
              <button onClick={() => go(-1)} aria-label="Previous slide" className="grid h-9 w-9 place-items-center border border-white/25 text-white/80 transition hover:border-gold hover:text-gold-light">‹</button>
              <div className="flex gap-2">
                {slides.map((x, k) => (
                  <button key={x.id} onClick={() => setI(k)} aria-label={`Slide ${k + 1}: ${x.title}`} aria-current={k === i}
                    className={`h-[3px] transition-all duration-500 ${k === i ? "w-10 bg-gold" : "w-5 bg-white/30 hover:bg-white/60"}`} />
                ))}
              </div>
              <button onClick={() => go(1)} aria-label="Next slide" className="grid h-9 w-9 place-items-center border border-white/25 text-white/80 transition hover:border-gold hover:text-gold-light">›</button>
            </div>
          )}
        </div>
        <div key={`p-${i}`} className="animate-fadeUp [animation-delay:.1s]">
          {s.image_url ? (
            <div className="rounded-sm bg-white/[0.04] p-2 ring-1 ring-white/10">
              {/\.(mp4|webm)(\?|$)/i.test(s.image_url)
                ? <video src={s.image_url} className="mx-auto max-h-[420px] w-full object-contain" muted autoPlay loop playsInline />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={s.image_url} alt="" className="mx-auto max-h-[420px] w-full object-contain" loading={i === 0 ? "eager" : "lazy"} />}
            </div>
          ) : fallback}
        </div>
      </div>
    </section>
  );
}
