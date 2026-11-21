import Image from "next/image";
import EsbeeRfq from "./EsbeeRfq";

// Esbee Precision Industries — corporate website, served on nerigroup.in (see lib/esbee.ts, next.config.js).
const RED = "#C8102E";
const NAVY = "#0A1F44";

const PHONE = "+91 99942 69441";
const PHONE_LINK = "tel:+919994269441";
const EMAIL = "rajavelu@nerigroup.in";

const NAV = [["About", "#about"], ["Capabilities", "#capabilities"], ["Products", "#products"], ["Quality", "#quality"], ["Plants", "#plants"], ["Customers", "#customers"], ["Contact", "#rfq"]];

const STATS: [string, string][] = [["3", "Manufacturing units in Bengaluru"], ["75+", "Machines on the shop floor"], ["5", "Key automotive and industrial customers"], ["GST", "Registered since 2017"]];

const CAPS: { t: string; d: string; icon: string }[] = [
  { t: "CNC turning", d: "Shafts, plungers, sleeves, bushings and nuts turned to close tolerances in steel, stainless steel, brass and aluminium.", icon: "M12 3v18M5 7l7-4 7 4M5 17l7 4 7-4M5 7v10M19 7v10" },
  { t: "VMC / HMC machining", d: "Housings, covers, end shields and bodies machined on vertical and horizontal machining centres, with fixtures built for repeatability.", icon: "M4 4h16v16H4zM4 9h16M9 4v16" },
  { t: "Pressure die casting", d: "Aluminium pressure die casting in-house, followed by full machining, so the casting and the finished part are controlled by one team.", icon: "M12 2c3 4 6 6 6 10a6 6 0 0 1-12 0c0-4 3-6 6-10z" },
  { t: "CNC drilling and special machines", d: "Multi-hole drilling, tapping and special-purpose operations for high-volume, tight-position components.", icon: "M12 3v10M8 13h8l-4 8zM6 3h12" },
  { t: "Gauging and inspection", d: "Dedicated gauge room and final inspection with calibrated gauges and measurement-system studies on critical characteristics.", icon: "M3 17l6-6 4 4 8-8M3 21h18" },
  { t: "Washing, packing and dispatch", d: "Cleaning, customer-specific packing and scheduled dispatch against customer call-offs.", icon: "M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10" },
];

const PRODUCTS = ["Pump plungers", "Drive shafts", "Bushings and guide bushes", "Control and regulating sleeves", "Machined rotors", "Drive end shields", "Pump housings and covers", "Connector bodies", "Nozzle retaining nuts", "Adapters, studs and threaded rings"];

const QUALITY: [string, string][] = [
  ["APQP and PPAP", "New parts are launched through planned, documented product and process approval before the first supply."],
  ["FMEA and Control Plan", "Process risks are analysed and every critical characteristic has a defined control method and reaction plan."],
  ["MSA and SPC", "Gauges are studied for repeatability and reproducibility, and critical dimensions are tracked with statistical process control."],
  ["Customer complaint handling", "Every complaint is logged, contained and closed with root cause and corrective action, reviewed with the customer."],
];

const PLANTS: { n: string; role: string; a: string }[] = [
  { n: "Unit I", role: "Registered office · machining", a: "No. C-35, 3rd Main Road, Rajaji Nagar Industrial Estate, Bengaluru 560044" },
  { n: "Unit II", role: "Pressure die casting · machining", a: "Plot No. 51, 4th Phase, Bommasandra Industrial Area, Bengaluru 560099" },
  { n: "Unit III", role: "Machining", a: "C-21, 3rd Main Road, Rajaji Nagar Industrial Estate, Bengaluru 560044" },
];

const CUSTOMERS = ["BOSCH", "SEG AUTOMOTIVE", "ADVIK AUTO", "PARKER", "JK MAINI"];

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

export default function EsbeeHome() {
  return (
    <div className="text-slate-800">
      {/* top bar */}
      <div style={{ background: NAVY }} className="text-[12.5px] text-white/80">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-2 sm:px-8">
          <span>Precision machined and die cast components · Bengaluru, India</span>
          <span className="flex flex-wrap gap-x-5"><a href={PHONE_LINK} className="hover:text-white">{PHONE}</a><a href={`mailto:${EMAIL}`} className="hover:text-white">{EMAIL}</a></span>
        </div>
      </div>

      {/* header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-6 px-5 py-3 sm:px-8">
          <a href="#top" aria-label="Esbee Precision Industries"><Image src="/esbee/logo.png" alt="Esbee Precision Industries" width={150} height={73} priority className="h-14 w-auto" /></a>
          <nav className="hidden items-center gap-7 text-[13.5px] font-medium text-slate-700 lg:flex">
            {NAV.slice(0, -1).map(([l, h]) => <a key={h} href={h} className="transition hover:text-[#C8102E]">{l}</a>)}
          </nav>
          <a href="#rfq" className="hidden rounded-sm px-5 py-2.5 text-[13px] font-semibold tracking-wide text-white transition hover:opacity-90 sm:inline-block" style={{ background: RED }}>Request a quotation</a>
          <details className="relative lg:hidden">
            <summary className="cursor-pointer list-none rounded-sm border border-slate-300 px-3 py-2 text-sm font-medium">Menu</summary>
            <div className="absolute right-0 mt-2 w-56 border border-slate-200 bg-white py-2 shadow-xl">
              {NAV.map(([l, h]) => <a key={h} href={h} className="block px-4 py-2 text-sm hover:bg-slate-50">{l}</a>)}
            </div>
          </details>
        </div>
      </header>

      <main id="top">
        {/* hero */}
        <section className="relative overflow-hidden text-white" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #12306B 100%)` }}>
          <svg className="pointer-events-none absolute -right-24 -top-24 h-[640px] w-[640px] opacity-[0.07]" viewBox="0 0 200 200" fill="none" stroke="#fff" strokeWidth="1.2">
            <circle cx="100" cy="100" r="90" /><circle cx="100" cy="100" r="62" /><polygon points="100,40 152,70 152,130 100,160 48,130 48,70" />
            {[0, 60, 120, 180, 240, 300].map((a) => <circle key={a} cx={100 + 76 * Math.cos((a * Math.PI) / 180)} cy={100 + 76 * Math.sin((a * Math.PI) / 180)} r="9" />)}
          </svg>
          <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.25fr_.75fr] lg:py-28">
            <div>
              <p className="mb-5 inline-flex items-center gap-3 text-[11.5px] font-semibold uppercase tracking-[0.26em] text-white/70"><span className="h-px w-9" style={{ background: RED }} />Precision engineering · Bengaluru</p>
              <h1 className="font-display text-4xl font-semibold leading-[1.1] sm:text-5xl lg:text-[3.4rem]">Precision components for the machines that move India.</h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/80">Esbee Precision Industries manufactures CNC machined and pressure die cast components for automotive, hydraulic and electrical applications, with in-house casting, machining, gauging and dispatch.</p>
              <div className="mt-9 flex flex-wrap gap-4">
                <a href="#rfq" className="rounded-sm px-7 py-3.5 text-sm font-semibold tracking-wide text-white shadow-lg transition hover:opacity-90" style={{ background: RED }}>Request a quotation</a>
                <a href="#capabilities" className="rounded-sm border border-white/35 px-7 py-3.5 text-sm font-semibold tracking-wide text-white transition hover:border-white">Our capabilities</a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px self-end bg-white/15">
              {STATS.map(([n, l]) => (
                <div key={l} className="bg-[#0F2A5C]/80 p-6">
                  <div className="font-display text-4xl font-semibold">{n}</div>
                  <div className="mt-2 text-[13px] leading-snug text-white/70">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* about */}
        <section id="about" className="mx-auto grid max-w-[1240px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.24em]" style={{ color: RED }}>About us</p>
            <h2 className="font-display text-3xl font-semibold leading-tight sm:text-4xl" style={{ color: NAVY }}>A partnership-run manufacturer built on repeatable quality.</h2>
          </div>
          <div className="space-y-4 text-[15.5px] leading-relaxed text-slate-600">
            <p>Esbee Precision Industries is a Bengaluru-based partnership firm making precision machined and aluminium pressure die cast components. We supply automotive fuel-system and electrical customers, as well as hydraulic and industrial customers, from three manufacturing units in Rajaji Nagar and Bommasandra.</p>
            <p>Our strength is the whole chain under one roof: die casting, CNC and VMC machining, washing, gauging, final inspection and dispatch. Production is planned and tracked in our own digital systems, so customers get consistent quality, clear traceability and dependable delivery.</p>
          </div>
        </section>

        {/* capabilities */}
        <section id="capabilities" className="bg-slate-50 py-20">
          <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
            <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.24em]" style={{ color: RED }}>Capabilities</p>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl" style={{ color: NAVY }}>From casting to finished, gauged component.</h2>
            <div className="mt-12 grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
              {CAPS.map((c) => (
                <div key={c.t} className="bg-white p-8 transition hover:shadow-xl">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center text-white" style={{ background: NAVY }}><Icon d={c.icon} /></div>
                  <h3 className="text-lg font-semibold" style={{ color: NAVY }}>{c.t}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">{c.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* products */}
        <section id="products" className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.24em]" style={{ color: RED }}>Products</p>
              <h2 className="font-display text-3xl font-semibold leading-tight sm:text-4xl" style={{ color: NAVY }}>Components we make every day.</h2>
              <p className="mt-5 text-[15.5px] leading-relaxed text-slate-600">Built to customer drawings. If your part is not listed, send us the drawing — we will tell you honestly whether and how we can make it.</p>
              <a href="#rfq" className="mt-7 inline-block rounded-sm px-6 py-3 text-sm font-semibold text-white" style={{ background: RED }}>Send a drawing</a>
            </div>
            <ul className="grid gap-px bg-slate-200 sm:grid-cols-2">
              {PRODUCTS.map((p) => (
                <li key={p} className="flex items-center gap-4 bg-white px-6 py-5 text-[15px] font-medium" style={{ color: NAVY }}>
                  <span className="h-2.5 w-2.5 shrink-0" style={{ background: RED }} />{p}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* quality */}
        <section id="quality" className="py-20 text-white" style={{ background: NAVY }}>
          <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
            <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.24em] text-white/60">Quality</p>
            <h2 className="max-w-3xl font-display text-3xl font-semibold leading-tight sm:text-4xl">Quality planned in, not inspected in.</h2>
            <p className="mt-5 max-w-3xl text-[15.5px] leading-relaxed text-white/75">Our quality practices follow the core tools of the automotive quality system, and our customers audit and review our results regularly.</p>
            <div className="mt-12 grid gap-px bg-white/15 sm:grid-cols-2">
              {QUALITY.map(([t, d]) => (
                <div key={t} className="p-8" style={{ background: "#0E2956" }}>
                  <div className="mb-3 h-0.5 w-10" style={{ background: RED }} />
                  <h3 className="text-lg font-semibold">{t}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-white/70">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* plants */}
        <section id="plants" className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8">
          <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.24em]" style={{ color: RED }}>Our plants</p>
          <h2 className="font-display text-3xl font-semibold sm:text-4xl" style={{ color: NAVY }}>Three units across Bengaluru.</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PLANTS.map((p) => (
              <div key={p.n} className="border border-slate-200 border-t-4 bg-white p-7 shadow-sm" style={{ borderTopColor: RED }}>
                <div className="font-display text-2xl font-semibold" style={{ color: NAVY }}>{p.n}</div>
                <div className="mt-1 text-[13px] font-semibold uppercase tracking-wider text-slate-500">{p.role}</div>
                <p className="mt-4 text-[14.5px] leading-relaxed text-slate-600">{p.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* customers */}
        <section id="customers" className="border-y border-slate-200 bg-slate-50 py-16">
          <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
            <p className="text-center text-[11.5px] font-semibold uppercase tracking-[0.24em] text-slate-500">Trusted by leading manufacturers</p>
            <div className="mt-9 grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-3 lg:grid-cols-5">
              {CUSTOMERS.map((c) => (
                <div key={c} className="flex h-28 items-center justify-center bg-white px-4 text-center font-display text-lg font-semibold tracking-[0.12em] text-slate-700">{c}</div>
              ))}
            </div>
          </div>
        </section>

        {/* RFQ */}
        <section id="rfq" className="mx-auto grid max-w-[1240px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.24em]" style={{ color: RED }}>Request for quotation</p>
            <h2 className="font-display text-3xl font-semibold leading-tight sm:text-4xl" style={{ color: NAVY }}>Tell us what you need made.</h2>
            <p className="mt-5 text-[15.5px] leading-relaxed text-slate-600">Share the part, process and yearly quantity. Our team will study it and reply within one working day.</p>
            <dl className="mt-8 space-y-5 text-[15px]">
              <div><dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Phone</dt><dd className="mt-1 font-medium" style={{ color: NAVY }}><a href={PHONE_LINK}>{PHONE}</a></dd></div>
              <div><dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Email</dt><dd className="mt-1 font-medium" style={{ color: NAVY }}><a href={`mailto:${EMAIL}`}>{EMAIL}</a></dd></div>
              <div><dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Registered office</dt><dd className="mt-1 leading-relaxed text-slate-600">Esbee Precision Industries<br />No. C-35, 3rd Main Road, Rajaji Nagar Industrial Estate<br />Bengaluru, Karnataka 560044</dd></div>
              <div><dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">GSTIN</dt><dd className="mt-1 font-medium text-slate-700">29AAAFE6725G1ZG</dd></div>
            </dl>
          </div>
          <div className="border border-slate-200 bg-white p-7 shadow-xl sm:p-9"><EsbeeRfq /></div>
        </section>
      </main>

      <footer className="text-white/70" style={{ background: "#071634" }}>
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-5 py-8 text-[13px] sm:px-8">
          <div className="flex items-center gap-4"><span className="rounded-sm bg-white p-1.5"><Image src="/esbee/emblem.png" alt="" width={36} height={36} className="h-9 w-9" /></span><span>© {new Date().getFullYear()} Esbee Precision Industries. All rights reserved.</span></div>
          <span>No. C-35, 3rd Main Road, Rajaji Nagar Industrial Estate, Bengaluru 560044 · GSTIN 29AAAFE6725G1ZG</span>
        </div>
      </footer>
    </div>
  );
}
