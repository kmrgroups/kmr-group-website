import { cache } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { CompanyInfo, LegalPage, SiteSettings, Vertical } from "@/lib/types";

export type Site = {
  company: Partial<CompanyInfo>;
  settings: Partial<SiteSettings>;
  verticals: Vertical[];
  policies: Pick<LegalPage, "slug" | "title" | "show_in_footer">[];
};

/** Company profile, settings, businesses and policies — used by the header, footer and most pages (one fetch per request). */
export const getSite = cache(async (): Promise<Site> => {
  const [{ data: company }, { data: settings }, { data: verticals }, { data: policies }] = await Promise.all([
    supabase.from("company_info").select("*").limit(1).maybeSingle(),
    supabase.from("site_settings").select("*").maybeSingle(),
    supabase.from("verticals").select("*").order("sort_order"),
    supabase.from("legal_pages").select("slug,title,show_in_footer,is_active,sort_order").order("sort_order"),
  ]);
  return {
    company: (company ?? {}) as Partial<CompanyInfo>,
    settings: (settings ?? {}) as Partial<SiteSettings>,
    verticals: ((verticals ?? []) as Vertical[]).filter((v) => v.is_active !== false),
    policies: ((policies ?? []) as (LegalPage & { is_active?: boolean })[]).filter((p) => p.is_active !== false),
  };
});

export const companyName = (c: Partial<CompanyInfo>) => c.trade_name || c.brand_name || "KMR Group of Companies";
export const fullAddress = (c: Partial<CompanyInfo>) =>
  [c.registered_address, [c.city, c.state].filter(Boolean).join(", "), c.postal_code].filter(Boolean).join(", ");
export const telHref = (n?: string) => (n ? `tel:${n.replace(/[^\d+]/g, "")}` : undefined);
export const paragraphs = (t?: string | null) => (t ?? "").split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
export const lines = (t?: string | null) => (t ?? "").split("\n").map((x) => x.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
export const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Where a business card links to, from its key when no link was set. */
export const verticalHref = (v: Vertical) => v.link || ({ shop: "/shop", software: "/software", training: "/training", import_export: "/trade#import_export", trading: "/trade#trading", distribution: "/trade#distribution" } as Record<string, string>)[v.slug ?? ""] || "/contact";
