"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconChevron, IconClose, IconMenu } from "./Icons";

export type NavVertical = { title: string; href: string; code?: string };

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/businesses", label: "Businesses", menu: true },
  { href: "/shop", label: "Shop" },
  { href: "/software", label: "Software" },
  { href: "/training", label: "Training" },
  { href: "/careers", label: "Careers" },
  { href: "/contact", label: "Contact" },
];

/** Main navigation: logo, links (with a Businesses menu), call-to-action; a full-screen menu on phones. */
export default function NavBar({ logo, name, verticals, cta }: { logo?: string; name: string; verticals: NavVertical[]; cta: { label: string; href: string } }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => { setOpen(false); }, [path]);
  const active = (href: string) => path === href || path.startsWith(href + "/") || (href === "/businesses" && path.startsWith("/trade"));

  return (
    <header className={`sticky top-0 z-50 border-b bg-white/90 backdrop-blur-xl transition-all duration-300 ${scrolled ? "border-line shadow-[0_12px_36px_-20px_rgba(11,28,58,.5)]" : "border-transparent"}`}>
      <div className="wrap flex h-16 items-center justify-between gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label={`${name} — home`}>
          {logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logo} alt={name} className="h-10 w-auto max-w-[150px] object-contain" />
            : <span className="border-2 border-gold px-2.5 py-0.5 font-display text-2xl font-bold tracking-wide text-navy">KMR</span>}
          <span className="hidden flex-col leading-tight lg:flex">
            <span className="font-display text-[17px] font-semibold text-navy">{name.replace(/ of Companies$/i, "")}</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-dark">{/of companies/i.test(name) ? "of Companies" : "Est. in India"}</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 xl:flex" aria-label="Main">
          {LINKS.map((l) => l.menu ? (
            <div key={l.href} className="group relative">
              <Link href={l.href} className={`flex items-center gap-1 px-3 py-2 text-[14px] font-medium transition-colors ${active(l.href) ? "text-gold-dark" : "text-navy hover:text-gold-dark"}`}>
                {l.label}<IconChevron className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
              </Link>
              <div className="invisible absolute left-1/2 top-full w-[340px] -translate-x-1/2 pt-3 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
                <div className="border border-line bg-white p-2 shadow-lift">
                  {verticals.map((v) => (
                    <Link key={v.title} href={v.href} className="block px-4 py-2.5 hover:bg-ivory">
                      <span className="block text-[14px] font-semibold text-navy">{v.title}</span>
                      {v.code && <span className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-gold-dark">{v.code}</span>}
                    </Link>
                  ))}
                  <Link href="/businesses" className="mt-1 block border-t border-line px-4 py-2.5 text-[13px] font-semibold text-gold-dark">All businesses →</Link>
                </div>
              </div>
            </div>
          ) : (
            <Link key={l.href} href={l.href} className={`relative px-3 py-2 text-[14px] font-medium transition-colors ${active(l.href) ? "text-gold-dark" : "text-navy hover:text-gold-dark"}`}>
              {l.label}{active(l.href) && <span className="absolute inset-x-3 -bottom-[3px] h-[2px] bg-gold" />}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href={cta.href} className="btn-gold hidden sm:inline-flex">{cta.label}</Link>
          <button className="grid h-11 w-11 place-items-center text-navy xl:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <IconClose className="h-6 w-6" /> : <IconMenu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="max-h-[calc(100vh-64px)] overflow-y-auto border-t border-line bg-white xl:hidden">
          <nav className="wrap flex flex-col py-4" aria-label="Mobile">
            {LINKS.map((l) => (
              <div key={l.href}>
                <Link href={l.href} className={`block border-b border-line/70 py-3.5 text-[16px] font-medium ${active(l.href) ? "text-gold-dark" : "text-navy"}`}>{l.label}</Link>
                {l.menu && <div className="border-b border-line/70 py-2 pl-4">{verticals.map((v) => <Link key={v.title} href={v.href} className="block py-2 text-[14px] text-muted">{v.title}</Link>)}</div>}
              </div>
            ))}
            <Link href={cta.href} className="btn-gold mt-5">{cta.label}</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
