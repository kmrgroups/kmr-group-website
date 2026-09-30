import { supabase } from "@/lib/supabaseClient";
import EnquiryForm from "@/components/EnquiryForm";
import ProductCard from "@/components/ProductCard";
import { PageHero, SectionHead } from "@/components/Blocks";
import { IconCheck, IconCode, IconGlobe, IconLock, IconUsers } from "@/components/Icons";
import type { Product } from "@/lib/types";

export const revalidate = 60;
export const metadata = { title: "Software solutions", description: "KMR Apps for manufacturers — HRM, Balloon Inspector, Process Documents and Capacity Planner — and custom software solutions." };

type App = { code: string; name: string; description: string | null; app_path: string | null; seat_label: string; version: string | null; prices: { period: string; amount: number; min: number }[] };
const FEATURES: Record<string, string[]> = {
  hrm: ["Self-onboarding, ID cards, biometric attendance", "Leave, shifts and payroll-ready registers", "IATF 16949 / ISO 9001 HR records"],
  balloon: ["Balloon drawings (PDF, DXF, STEP) in minutes", "Inspection reports and FAI", "Shares data with Process Documents"],
  pd: ["APQP / PPAP documents from the ballooned drawing", "Process flow, PFMEA, control plan", "Inspection formats and CNC set-up sheets"],
  capacity: ["Monthly plan and machine loading", "Takt time, levelling and alternate machines", "Uses your Operations Master and HRM holidays"],
};
const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export default async function SoftwarePage() {
  const [{ data }, { data: sol }] = await Promise.all([
    supabase.rpc("kmr_software_catalog"),
    supabase.from("products").select("*").eq("is_active", true).eq("business", "software").order("sort_order"),
  ]);
  const apps = ((data as App[]) || []).filter((a) => a.code !== "console");
  const solutions = (sol as Product[]) || [];

  return (
    <>
      <PageHero eyebrow="Software & AI solutions" title="Software that runs the plant" intro="KMR Apps are cloud products built by manufacturing people for manufacturers — plus custom software and automation for your business." />
      <section className="border-b border-line bg-white">
        <div className="wrap grid gap-4 py-6 text-sm text-navy sm:grid-cols-3">
          <p className="flex items-center gap-3"><IconUsers className="h-5 w-5 text-gold" />One login for every app</p>
          <p className="flex items-center gap-3"><IconLock className="h-5 w-5 text-gold" />Your data hosted securely</p>
          <p className="flex items-center gap-3"><IconGlobe className="h-5 w-5 text-gold" />Free pilot before you buy</p>
        </div>
      </section>

      {apps.length > 0 && (
        <section className="py-20">
          <div className="wrap">
            <SectionHead eyebrow="KMR Apps" title="Products & plans" intro="Priced per user or per machine, billed monthly or yearly, GST extra." />
            <div className="grid gap-6 md:grid-cols-2">
              {apps.map((a) => {
                const m = a.prices.find((x) => x.period === "month"), y = a.prices.find((x) => x.period === "year");
                const unit = a.seat_label.replace(/s$/, "");
                return (
                  <div key={a.code} className="card flex flex-col p-8">
                    <div className="flex items-start justify-between gap-4">
                      <span className="grid h-14 w-14 place-items-center bg-navy text-gold-light"><IconCode className="h-7 w-7" /></span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{a.version ? `Version ${a.version}` : "Cloud app"}</span>
                    </div>
                    <h3 className="mt-6 font-display text-3xl font-semibold text-navy">{a.name}</h3>
                    <p className="mt-2 text-muted">{a.description}</p>
                    {FEATURES[a.code] && <ul className="mt-6 space-y-2">{FEATURES[a.code].map((f) => <li key={f} className="flex gap-3 text-sm text-ink/80"><IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold" />{f}</li>)}</ul>}
                    <div className="mt-8 border-t border-line pt-6">
                      {m || y ? (
                        <p><span className="font-display text-3xl font-semibold text-navy">{inr((m ?? y)!.amount)}</span><span className="text-sm text-muted"> / {unit} / {m ? "month" : "year"} + GST</span>
                          <span className="mt-1 block text-xs text-muted">{m && y ? `or ${inr(y.amount)} / ${unit} / year · ` : ""}minimum {(m ?? y)!.min} {a.seat_label}</span></p>
                      ) : <p className="text-sm font-semibold text-gold-dark">Pricing on request</p>}
                      <div className="mt-5 flex flex-wrap gap-3">
                        <a href="#demo" className="btn-gold">Book a free demo</a>
                        <a href="/it/" className="btn-outline">Explore the app</a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {solutions.length > 0 && (
        <section className="bg-white py-20">
          <div className="wrap">
            <SectionHead eyebrow="Solutions & services" title="Custom software for your business" intro="From ERP set-up to automation and AI — scoped, priced and delivered by our team." />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{solutions.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          </div>
        </section>
      )}

      <section id="demo" className="pattern-navy scroll-mt-24 py-20 text-white">
        <div className="wrap grid items-start gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow eyebrow-light mb-4">Free pilot</p>
            <h2 className="h-display text-3xl md:text-[44px]">Try it with your team</h2>
            <p className="mt-5 text-white/70">Tell us which apps you need. We set up your company, your first administrator login and sample data — usually the same day. Already a customer? Sign in from the link we sent you.</p>
            <ul className="mt-8 space-y-3 text-white/80">{apps.map((a) => <li key={a.code} className="flex gap-3"><IconCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold" />{a.name}</li>)}</ul>
          </div>
          <EnquiryForm business="software" dark title="Request a demo / pilot" productName="KMR Apps" submitLabel="Request demo" />
        </div>
      </section>
    </>
  );
}
