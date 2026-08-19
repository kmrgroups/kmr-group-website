import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { CompanyInfo } from "@/lib/types";

export default async function Footer() {
  const { data } = await supabase.from("company_info").select("logo_url, brand_name").limit(1).maybeSingle();
  const c = data as Pick<CompanyInfo, "logo_url" | "brand_name"> | null;

  return (
    <footer className="blueprint-bg text-warehouse mt-24 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-5 py-14 grid gap-10 md:grid-cols-4">
        <div>
          <div className="mb-3">
            {c?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.logo_url} alt={c.brand_name || "KMR Group"} className="h-10 w-auto object-contain" />
            ) : (
              <span className="border border-copper/70 px-2 py-0.5 text-copper-light font-display text-2xl">KMR</span>
            )}
          </div>
          <p className="text-sm text-slate-light max-w-xs">
            A multi-vertical group of companies engineering reliable products and services
            across manufacturing, trading and technology.
          </p>
        </div>

        <div>
          <p className="eyebrow text-copper-light mb-4">Company</p>
          <ul className="space-y-2 text-sm text-slate-light">
            <li><Link href="/about">About Us</Link></li>
            <li><Link href="/leadership">Leadership</Link></li>
            <li><Link href="/verticals">Business Verticals</Link></li>
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
            <li><Link href="/admin/login" className="text-slate">Admin login</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-slate font-mono">
        © {new Date().getFullYear()} KMR Group of Companies. All rights reserved.
      </div>
    </footer>
  );
}
