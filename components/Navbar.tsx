"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const links = [
  { href: "/shop", label: "Shop" },
  { href: "/software", label: "Software" },
  { href: "/training", label: "Training" },
  { href: "/trade", label: "Trade" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" }
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("KMR Group");

  useEffect(() => {
    supabase
      .from("company_info")
      .select("logo_url, brand_name")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.logo_url) setLogoUrl(data.logo_url);
        if (data?.brand_name) setBrandName(data.brand_name);
      });
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-ink text-warehouse border-b border-white/10">
      <div className="mx-auto max-w-7xl px-5 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brandName} className="h-12 w-auto max-w-[160px] object-contain" />
          ) : (
            <span className="border border-copper/70 px-2 py-0.5 text-copper-light font-display text-2xl tracking-wide">
              KMR
            </span>
          )}
          <span className="hidden sm:inline text-sm tracking-[0.2em] text-slate-light eyebrow">
            GROUP OF COMPANIES
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 font-body text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-copper-light transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>

        <button
          className="md:hidden text-warehouse"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="md:hidden border-t border-white/10 px-5 py-4 flex flex-col gap-4 font-body text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
