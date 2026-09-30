import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabaseClient";
import { SITE_URL } from "@/lib/mail";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages = ["", "/about", "/businesses", "/shop", "/software", "/training", "/trade", "/careers", "/contact", "/policies", "/gallery"]
    .map((p) => ({ url: `${SITE_URL}${p}`, lastModified: now, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 }));
  const [products, jobs, policies] = await Promise.all([
    supabase.from("products").select("id,created_at").eq("is_active", true).limit(500),
    supabase.from("job_openings").select("id,updated_at,created_at,is_active").eq("is_active", true).limit(200),
    supabase.from("legal_pages").select("slug,updated_at,is_active").limit(50),
  ]);
  const at = (r: { updated_at?: string | null; created_at?: string | null }) => new Date(r.updated_at || r.created_at || now);
  return [
    ...pages,
    ...(products.data ?? []).map((r) => ({ url: `${SITE_URL}/products/${r.id}`, lastModified: at(r), priority: 0.6 })),
    ...(jobs.data ?? []).map((r) => ({ url: `${SITE_URL}/careers/${r.id}`, lastModified: at(r), priority: 0.5 })),
    ...(policies.data ?? []).filter((r) => r.is_active !== false).map((r) => ({ url: `${SITE_URL}/policies/${r.slug}`, lastModified: at(r), priority: 0.3 })),
  ];
}
