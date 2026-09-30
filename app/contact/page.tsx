import { supabase } from "@/lib/supabaseClient";
import type { CompanyInfo } from "@/lib/types";

export const revalidate = 60;

export default async function ContactPage() {
  const { data } = await supabase.from("company_info").select("*").limit(1).maybeSingle();
  const c = data as CompanyInfo | null;
  const address = [c?.registered_address, [c?.city, c?.state].filter(Boolean).join(", "), c?.postal_code].filter(Boolean).join(", ");
  // The map uses the coordinates from Admin → Company Info, or else finds the address itself
  const mapQuery = c?.map_lat != null && c?.map_lng != null ? `${c.map_lat},${c.map_lng}` : encodeURIComponent(address || "Puducherry");

  const social = [
    { label: "Facebook", url: c?.facebook_url },
    { label: "Instagram", url: c?.instagram_url },
    { label: "LinkedIn", url: c?.linkedin_url },
    { label: "YouTube", url: c?.youtube_url },
    { label: "X / Twitter", url: c?.twitter_url },
    { label: "WhatsApp", url: c?.whatsapp_number ? `https://wa.me/${c.whatsapp_number}` : undefined }
  ].filter((s) => s.url);

  return (
    <div className="mx-auto max-w-6xl px-5 py-20">
      <p className="eyebrow text-steel mb-3">Reach Us</p>
      <h1 className="font-display text-5xl mb-12">Contact</h1>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="plate bg-white p-7 space-y-5">
          <div>
            <p className="eyebrow text-steel mb-1">Registered Address</p>
            <p className="text-slate">{c?.trade_name && <><b className="text-ink">{c.trade_name}</b><br /></>}{address || "Add address from Admin → Company Info"}</p>
          </div>
          <div>
            <p className="eyebrow text-steel mb-1">Email</p>
            <p className="text-slate">{c?.email || "Add email from Admin → Company Info"}</p>
          </div>
          <div>
            <p className="eyebrow text-steel mb-1">Phone</p>
            <p className="text-slate">{c?.phone || "Add phone from Admin → Company Info"}</p>
          </div>
          {c?.gstin && (
            <div>
              <p className="eyebrow text-steel mb-1">GSTIN</p>
              <p className="text-slate font-mono">{c.gstin}</p>
            </div>
          )}
          {social.length > 0 && (
            <div>
              <p className="eyebrow text-steel mb-2">Follow Us</p>
              <div className="flex flex-wrap gap-3">
                {social.map((s) => (
                  <a
                    key={s.label}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm border border-line px-3 py-1.5 hover:border-copper hover:text-copper transition-colors"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="plate overflow-hidden h-80 md:h-auto">
          <iframe
            title="Business location map"
            className="w-full h-full min-h-[320px] border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps?q=${mapQuery}&z=15&output=embed`}
          />
        </div>
      </div>
    </div>
  );
}
