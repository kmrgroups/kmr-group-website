import { supabase } from "@/lib/supabaseClient";
import type { CompanyInfo } from "@/lib/types";

export const revalidate = 60;

export default async function AboutPage() {
  const { data } = await supabase.from("company_info").select("*").limit(1).maybeSingle();
  const c = data as CompanyInfo | null;

  return (
    <div className="mx-auto max-w-5xl px-5 py-20">
      <p className="eyebrow text-steel mb-3">About Us</p>
      <h1 className="font-display text-5xl mb-10">
        {c?.brand_name || "KMR Group of Companies"}
      </h1>

      <div className="grid md:grid-cols-2 gap-8 mb-16">
        <div className="plate bg-white p-7">
          <p className="eyebrow text-steel mb-3">Vision</p>
          <p className="text-slate leading-relaxed">
            To be a trusted, multi-vertical group recognised for engineering discipline,
            product quality and long-term value delivered to every customer and partner
            we serve. (Edit this from Admin → Company Info once that section is added,
            or update directly in the code for now.)
          </p>
        </div>
        <div className="plate bg-white p-7">
          <p className="eyebrow text-steel mb-3">Mission</p>
          <p className="text-slate leading-relaxed">
            To build and operate businesses across manufacturing, trading and technology
            with the same process rigor and customer focus that built the group —
            expanding responsibly, vertical by vertical.
          </p>
        </div>
      </div>

      <div className="plate-dark blueprint-bg text-warehouse p-8">
        <p className="eyebrow text-copper-light mb-3">Company Record</p>
        <dl className="grid sm:grid-cols-2 gap-4 font-mono text-sm">
          <div>
            <dt className="text-slate-light">Legal Name</dt>
            <dd>{c?.legal_name || "KMR Group of Companies"}</dd>
          </div>
          <div>
            <dt className="text-slate-light">Founded</dt>
            <dd>{c?.founded_year || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-light">CIN</dt>
            <dd>{c?.cin || "Add in Admin → Company Info"}</dd>
          </div>
          <div>
            <dt className="text-slate-light">GSTIN</dt>
            <dd>{c?.gstin || "Add in Admin → Company Info"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
