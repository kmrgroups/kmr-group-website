import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { CompanyInfo } from "@/lib/types";

export default async function Footer() {
  const { data } = await supabase.from("company_info").select("logo_url, brand_name, trade_name, tagline, slogan, short_about, gstin, udyam_number").limit(1).maybeSingle();
  const c = data as Pick<CompanyInfo, "logo_url" | "brand_name" | "trade_name" | "tagline" | "slogan" | "short_about" | "gstin" | "udyam_number"> | null;
  const name = c?.trade_name || "KMR Group of Companies";

  return (
    <footer className="blueprint-bg text-warehouse mt-24 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-5 py-14 grid gap-10 md:grid-cols-5">
        <div>
          <div className="mb-3">
            {c?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.logo_url} alt={c.brand_name || "KMR Group"} className="h-10 w-auto object-contain" />
            ) : (
              <span className="border border-copper/70 px-2 py-0.5 text-copper-light font-display text-2xl">KMR</span>
            )}
          </div>
          {c?.tagline && <p className="eyebrow text-copper-light mb-2">{c.tagline}</p>}
          <p className="text-sm text-slate-light max-w-xs whitespace-pre-line">
            {c?.short_about || "A multi-vertical group of companies delivering reliable products and services across trading, technology and training."}
          </p>
        </div>

        <div>
          <p className="eyebrow text-copper-light mb-4">Businesses</p>
          <ul className="space-y-2 text-sm text-slate-light">
            <li><Link href="/shop">Online Shop</Link></li>
            <li><Link href="/software">Software (KMR Apps)</Link></li>
            <li><Link href="/training">Training & Education</Link></li>
            <li><Link href="/trade">Import, Export & Trading</Link></li>
          </ul>
        </div>

        <div>
          <p className="eyebrow text-copper-light mb-4">Company</p>
          <ul className="space-y-2 text-sm text-slate-light">
            <li><Link href="/about">About Us</Link></li>
            <li><Link href="/leadership">Leadership</Link></li>
            <li><Link href="/verticals">Our Businesses</Link></li>
            <li><Link href="/gallery">Gallery</Link></li>
          </ul>
        </div>

        <div>
          <p className="eyebrow text-copper-light mb-4">Legal</p>
          <ul className="space-y-2 text-sm text-slate-light">
            <li><Link href="/legal/terms">Terms & Conditions</Link></li>
            <li><Link href="/legal/privacy">Privacy Policy</Link></li>
            <li><Link href="/legal/refund">Refund & Cancellation</Link></li>
            <li><Link href="/legal/shipping">Shipping & Delivery</Link></li>
            <li><Link href="/legal/grievance">Grievance Redressal</Link></li>
          </ul>
        </div>

        <div>
          <p className="eyebrow text-copper-light mb-4">Contact</p>
          <ul className="space-y-2 text-sm text-slate-light">
            <li><Link href="/contact">Get in touch</Link></li>
            <li><Link href="/trade#distribution">Become a distributor</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-slate font-mono space-y-1 px-5">
        {c?.slogan && <p className="text-copper-light">{c.slogan}</p>}
        <p>© {new Date().getFullYear()} {name}. All rights reserved.{c?.gstin ? ` · GSTIN ${c.gstin}` : ""}{c?.udyam_number ? ` · ${c.udyam_number}` : ""}</p>
      </div>
    </footer>
  );
}
