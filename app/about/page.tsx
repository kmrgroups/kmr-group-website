import { supabase } from "@/lib/supabaseClient";
import type { CompanyInfo } from "@/lib/types";

export const revalidate = 60;

export default async function AboutPage() {
  const { data } = await supabase.from("company_info").select("*").limit(1).maybeSingle();
  const c = data as CompanyInfo | null;
  const name = c?.trade_name || c?.brand_name || "KMR Group of Companies";
  const record = ([
    ["Trade Name", c?.trade_name],
    ["Legal Name", c?.legal_name],
    ["Constitution", c?.constitution],
    [c?.proprietor_title || "Proprietor", c?.proprietor_name],
    ["GSTIN", c?.gstin],
    ["Udyam (MSME)", c?.udyam_number ? `${c.udyam_number}${c.msme_category ? ` · ${c.msme_category}` : ""}` : null],
    ["CIN", c?.cin],
    ["Trademark", c?.trademark_status],
    ["Founded", c?.founded_year ? String(c.founded_year) : null],
  ] as [string, string | null | undefined][]).filter(([, v]) => v) as [string, string][];

  return (
    <div className="mx-auto max-w-5xl px-5 py-20">
      <p className="eyebrow text-steel mb-3">About Us</p>
      <h1 className="font-display text-5xl mb-10">
        {name}
      </h1>
      {c?.tagline && <p className="eyebrow text-copper mb-10 -mt-6">{c.tagline}</p>}

      {c?.logo_full_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.logo_full_url} alt={name} className="w-full max-w-md mx-auto mb-12 object-contain" />
      )}

      <div className="grid md:grid-cols-2 gap-8 mb-16">
        <div className="plate bg-white p-7">
          <p className="eyebrow text-steel mb-3">Vision</p>
          <p className="text-slate leading-relaxed whitespace-pre-line">
            {c?.vision || "To be a trusted, multi-vertical group recognised for discipline, quality and long-term value delivered to every customer and partner we serve."}
          </p>
        </div>
        <div className="plate bg-white p-7">
          <p className="eyebrow text-steel mb-3">Mission</p>
          <p className="text-slate leading-relaxed whitespace-pre-line">
            {c?.mission || "To build and operate businesses across trading, technology and services with process rigour and customer focus — expanding responsibly, vertical by vertical."}
          </p>
        </div>
      </div>

      <div className="plate-dark blueprint-bg text-warehouse p-8">
        <p className="eyebrow text-copper-light mb-3">Company Record</p>
        <dl className="grid sm:grid-cols-2 gap-4 font-mono text-sm">
          {record.map(([k, v]) => (
            <div key={k}>
              <dt className="text-slate-light">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
