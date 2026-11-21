const NAVY = "#0A1F44";
const RED = "#C8102E";

const FLOW: { t: string; app: string; d: string }[] = [
  { t: "RFQ", app: "Sales Flow", d: "Enquiry and drawing arrive online; quote, follow-up and customer history in one place." },
  { t: "Drawing review", app: "Balloon Inspector", d: "Reads the customer drawing, numbers every characteristic and builds the inspection list." },
  { t: "Process documents", app: "Process Documents", d: "Process flow, FMEA, control plan and inspection plan fill themselves from the drawing data." },
  { t: "Planning", app: "Capacity", d: "Machine loading and takt time show what can be delivered and when." },
  { t: "Production", app: "Production tracking", d: "Shop-floor output, rejections and downtime are captured as they happen." },
  { t: "Quality", app: "SPC, MSA, Calibration Hub", d: "Measurements, gauge studies and calibration due dates stay live and traceable." },
  { t: "Dispatch and invoice", app: "Invoicing and GST", d: "Packing, delivery and the tax invoice follow from the same order data." },
];

const DOCS = ["Process flow", "PFMEA (process failure mode and effects analysis)", "Control plan", "Inspection report", "PPAP (production part approval process) file"];

const POINTS: [string, string][] = [
  ["Cloud access", "Authorised people see live data from any plant, office or phone."],
  ["One data source", "An item is entered once and reused in every document and report."],
  ["Auto-populated documents", "Drawing data feeds the process documents, so there is no re-typing."],
  ["Traceability", "Every lot links back to its drawing, inspection data and invoice."],
];

export default function EsbeeDigital() {
  return (
    <section id="digital" className="bg-[#07152F] py-20 text-white">
      <div className="mx-auto max-w-[2400px] px-4 sm:px-6 lg:px-8 2xl:px-12">
        <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.24em]" style={{ color: "#FF6B81" }}>Digital manufacturing</p>
        <h2 className="font-display text-3xl font-semibold sm:text-4xl">From RFQ to invoice, one connected system.</h2>
        <p className="mt-4 max-w-3xl text-[15.5px] leading-relaxed text-white/70">RFQ means request for quotation. Every step of an order runs on our own cloud apps and shares one set of data, so documents, reports and invoices are built from the customer drawing instead of being typed again.</p>

        {/* main flow */}
        <div className="relative mt-14">
          <div className="esb-track absolute left-0 right-0 top-[22px] hidden h-[3px] rounded bg-white/15 xl:block"><span className="esb-pulse" /><span className="esb-pulse esb-pulse2" /></div>
          <ol className="relative grid gap-6 sm:grid-cols-2 xl:grid-cols-7">
            {FLOW.map((s, i) => (
              <li key={s.t} className="esb-rise relative" style={{ animationDelay: `${i * 0.15}s` }}>
                <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/30 bg-[#0A1F44] font-display text-lg font-semibold esb-node" style={{ animationDelay: `${i * 0.5}s` }}>{i + 1}</div>
                <div className="mt-4 h-[calc(100%-3.75rem)] border border-white/10 bg-white/[0.04] p-5">
                  <h3 className="text-[15.5px] font-semibold">{s.t}</h3>
                  <div className="mt-1 text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: "#FF6B81" }}>{s.app}</div>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-white/70">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* drawing to documents */}
        <div className="mt-16 border border-white/10 bg-white/[0.03] p-6 sm:p-10">
          <h3 className="font-display text-2xl font-semibold">One customer drawing fills the process documents</h3>
          <div className="mt-8 flex flex-col items-stretch gap-4 lg:flex-row lg:items-center">
            <div className="border border-white/20 bg-[#0A1F44] px-6 py-5 text-center lg:w-56"><div className="text-[11.5px] uppercase tracking-wider text-white/60">Input</div><div className="mt-1 font-semibold">Customer drawing</div><div className="mt-1 text-[12.5px] text-white/60">PDF or image</div></div>
            <div className="esb-arrow relative h-8 w-1 self-center lg:h-1 lg:w-16"><span /></div>
            <div className="border px-6 py-5 text-center lg:w-64 esb-glow" style={{ borderColor: "#FF6B81", background: "#0A1F44" }}><div className="text-[11.5px] uppercase tracking-wider text-white/60">Reads and numbers</div><div className="mt-1 font-semibold">Balloon Inspector</div><div className="mt-1 text-[12.5px] text-white/60">dimensions, tolerances, notes</div></div>
            <div className="esb-arrow relative h-8 w-1 self-center lg:h-1 lg:w-16"><span /></div>
            <ul className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {DOCS.map((d, i) => (
                <li key={d} className="esb-rise flex items-center gap-3 border border-white/15 bg-white/[0.05] px-4 py-3 text-[13.5px]" style={{ animationDelay: `${i * 0.2}s` }}><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: RED }} />{d}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* cloud layer */}
        <div className="esb-shimmer mt-8 border border-white/15 px-6 py-5 text-center text-[13px] font-semibold uppercase tracking-[0.2em]" style={{ background: NAVY }}>Secure cloud database · shared by every app · access from anywhere</div>

        <div className="mt-8 grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map(([t, d]) => (
            <div key={t} className="bg-[#0A1F44] p-6"><h3 className="text-[15.5px] font-semibold">{t}</h3><p className="mt-2 text-[13.5px] leading-relaxed text-white/70">{d}</p></div>
          ))}
        </div>
      </div>
    </section>
  );
}
