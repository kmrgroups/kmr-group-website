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

/**
 * Map for the Contact page and footer. Accepts whatever was pasted in the CMS: the Google Maps "Embed a map" code
 * (<iframe …>), its src link, or an ordinary share link (maps.app.goo.gl / google.com/maps/place/…).
 * Share links cannot be shown inside a page, so they become the "Open in Google Maps" link and the embedded map
 * is built from the coordinates or the address.
 */
export function mapLinks(c: Partial<CompanyInfo>) {
  const raw = (c.map_embed_url ?? "").trim();
  const src = raw.match(/src=["']([^"']+)["']/i)?.[1] ?? raw;
  const pasted = /^https?:\/\//i.test(src) ? src : "";
  const isEmbed = /google\.[a-z.]+\/maps\/embed|output=embed/i.test(pasted);
  const lat = c.map_lat != null && String(c.map_lat) !== "" ? Number(c.map_lat) : NaN, lng = c.map_lng != null && String(c.map_lng) !== "" ? Number(c.map_lng) : NaN;
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  const query = hasPoint ? `${lat},${lng}` : [companyName(c), fullAddress(c)].filter(Boolean).join(", ") || "Puducherry, India";
  const embed = isEmbed ? pasted : `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=${hasPoint ? 16 : 14}&output=embed`;
  const open = pasted && !isEmbed ? pasted : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  return { embed, open };
}
