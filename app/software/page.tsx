import { supabase } from "@/lib/supabaseClient";
import EnquiryForm from "@/components/EnquiryForm";

export const revalidate = 60;
export const metadata = { title: "Software · KMR Group of Companies", description: "KMR Apps for manufacturers: HRM, Balloon Inspector, Process Documents and Capacity Planner." };

type App = { code: string; name: string; description: string | null; app_path: string | null; seat_label: string; version: string | null; prices: { period: string; amount: number; min: number }[] };
const FEATURES: Record<string, string[]> = {
  hrm: ["Self-onboarding, ID cards, biometric attendance", "Leave, shifts and payroll-ready registers", "IATF 16949 / ISO 9001 HR records"],
  balloon: ["Balloon drawings (PDF, DXF, STEP) in minutes", "Inspection reports and FAI", "Shares data with Process Documents"],
  pd: ["APQP / PPAP documents from the ballooned drawing", "Process flow, PFMEA, control plan", "Inspection formats and CNC set-up sheets"],
  capacity: ["Monthly plan and machine loading", "Takt time, levelling and alternate machines", "Uses your Operations Master and HRM holidays"],
};
const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export default async function SoftwarePage() {
  const { data } = await supabase.rpc("kmr_software_catalog");
  const apps = ((data as App[]) || []).filter((a) => a.code !== "console");

  return (
    <div className="mx-auto max-w-7xl px-5 py-20">
      <p className="eyebrow text-steel mb-3">Software & AI Solutions</p>
      <h1 className="font-display text-5xl mb-4">KMR Apps</h1>
      <p className="text-slate max-w-2xl mb-12">Cloud software built by manufacturing people for manufacturers — one login for every app, your data in India, start with a free trial.</p>

      <div className="grid md:grid-cols-2 gap-6 mb-16">
        {apps.map((a) => {
          const m = a.prices.find((x) => x.period === "month"), y = a.prices.find((x) => x.period === "year");
          const unit = a.seat_label.replace(/s$/, "");
          return (
            <div key={a.code} className="plate bg-white p-7 flex flex-col">
              <p className="eyebrow text-steel mb-2">{a.version ? `v${a.version}` : "Cloud app"}</p>
              <h2 className="font-display text-3xl mb-2">{a.name}</h2>
              <p className="text-slate mb-4">{a.description}</p>
              {FEATURES[a.code] && <ul className="text-sm text-slate space-y-1 mb-5 list-disc pl-5">{FEATURES[a.code].map((f) => <li key={f}>{f}</li>)}</ul>}
              <div className="mt-auto">
                {m || y ? (
                  <p className="mb-4"><span className="font-display text-2xl text-copper">{inr((m ?? y)!.amount)}</span>
                    <span className="text-sm text-slate"> per {unit} / {m ? "month" : "year"} + GST</span>
                    {m && y && <span className="block text-xs text-slate">or {inr(y.amount)} per {unit} / year · minimum {(m ?? y)!.min} {a.seat_label}</span>}
                    {!(m && y) && <span className="block text-xs text-slate">minimum {(m ?? y)!.min} {a.seat_label}</span>}</p>
                ) : <p className="mb-4 text-sm text-slate">Pricing on request</p>}
                <div className="flex flex-wrap gap-3">
                  <a href="#trial" className="bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-5 py-2.5">Start a free trial</a>
                  <a href="/it/" className="border border-line hover:border-copper px-5 py-2.5 text-sm font-medium">Explore the app</a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        <div>
          <h2 className="font-display text-3xl mb-3">Try it with your team</h2>
          <p className="text-slate mb-4">Tell us which apps you need. We set up your company, your first administrator login and sample data — usually the same day. Already a customer? Sign in to your KMR Apps portal from the link we sent you.</p>
          <ul className="text-sm text-slate space-y-1">{apps.map((a) => <li key={a.code}>• {a.name}</li>)}</ul>
        </div>
        <div id="trial" className="scroll-mt-24"><EnquiryForm business="software" title="Request a free trial / demo" productName="KMR Apps" submitLabel="Request trial" /></div>
      </div>
    </div>
  );
}
