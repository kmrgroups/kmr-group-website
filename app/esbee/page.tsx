import Image from "next/image";
import EsbeeRfq from "./EsbeeRfq";
import EsbeeGallery, { type GalleryItem } from "./EsbeeGallery";

// Esbee Precision Industries — corporate website, served on nerigroup.in (see lib/esbee.ts, next.config.js).
const RED = "#C8102E";
const NAVY = "#0A1F44";

const PHONE = "+91 99942 69441";
const PHONE_LINK = "tel:+919994269441";
const EMAIL = "rajavelu@nerigroup.in";

const NAV = [["About", "#about"], ["Leadership", "#leadership"], ["Capabilities", "#capabilities"], ["Products", "#products"], ["How we work", "#process"], ["Quality", "#quality"], ["Awards", "#awards"], ["Plants", "#plants"], ["Customers", "#customers"], ["Contact", "#rfq"]];

const STATS: [string, string][] = [["90+", "CNC machines across three owned units"], ["2 × 400 t", "In-house pressure die casting"], ["1998", "Supplying Bosch since"], ["IATF", "16949 automotive quality system"]];

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

const PLANTS: { n: string; role: string; a: string; img?: string }[] = [
  { n: "Rajaji Nagar · C-35", img: "rajajinagar-a", role: "Registered office · machining", a: "No. C-35, 3rd Main Road, Rajaji Nagar Industrial Estate, Bengaluru 560044" },
  { n: "Rajaji Nagar · C-21", img: "rajajinagar-c21", role: "Machining", a: "C-21, 3rd Main Road, Rajaji Nagar Industrial Estate, Bengaluru 560044" },
  { n: "Bommasandra", img: "bommasandra-hangar", role: "Pressure die casting · machining · new hangar", a: "Plot No. 51, 4th Phase, Bommasandra Industrial Area, Bengaluru 560099" },
];

const LEADERS: [string, string, string, string][] = [
  ["Mr. Shyam B Baglani", "Founder", "shyam", "Founded Esbee Precision Industries and built it into a Bengaluru manufacturer of precision machined and die cast components. His focus on dependable quality and long customer relationships is the reason Esbee has supplied Bosch since 1998."],
  ["Mr. Sunil Baglani", "Co-Founder", "sunil", "Co-founder of Esbee Precision Industries. Together with the founder he has helped grow the company from a single unit to three company-owned plants, keeping the shop floor, tooling and supply commitments running to customer expectations."],
  ["Mr. Rishab Baglani", "Managing Director", "rishab", "Leads the company as Managing Director, driving quality systems, new-part launches and the digital tracking of production and reports across all three units, so customers get consistent quality and transparent delivery."],
];

const CUSTOMERS: [string, string, number, number][] = [["Bosch", "bosch", 600, 137], ["Magna", "magna", 600, 130], ["SEG Automotive", "seg", 600, 179], ["Bosch Rexroth", "rexroth", 188, 86], ["Parker", "parker", 200, 87], ["Maini", "maini", 138, 138]];

const MACHINES: [string, string][] = [["CNC turn-mill centres", "cnc-turn-mill"], ["Horizontal and vertical machining centres", "hmc-vmc"], ["Multi-spindle automats", "multi-spindle"], ["Deep hole (gun) drilling", "deep-hole-drilling"], ["Centreless grinding", "centreless-grinder"], ["Cylindrical grinding", "cylindrical-grinder"], ["Spline and thread rolling", "spline-roller"], ["Pressure die casting · Bühler, 400 t, parts up to 2.5 kg", "pdc-buhler"], ["Pressure die casting · Suzhou Sanji, 400 t, parts up to 2.5 kg", "pdc-suzhou"]];

const QUAL_EQ: [string, string][] = [["Co-ordinate measuring machine", "cmm"], ["Roundness tester", "roundness"], ["Profile projector", "profile-projector"], ["Hardness tester", "hardness"], ["Height gauge", "height-gauge"], ["Surface roughness tester", "surface-tester"], ["Delta Vision measuring system", "delta-vision"]];

const PARTS: [string, string][] = [["Pump plunger", "plunger"], ["Control sleeve", "control-sleeve"], ["Sleeve gear", "sleeve-gear"], ["Bushing", "bushing"], ["Drive shafts", "drive-shafts"], ["Aluminium die casting", "srec-casting"], ["Aluminium die casting", "def-casting"], ["End shield", "end-shield"], ["Rotor", "rotor"], ["Pump housing", "pump-housing"], ["Studs", "ic-studs"], ["Nozzle retaining nut", "nr-nut"], ["Precision turned part", "bosch-1"], ["Threaded fitting", "bosch-2"], ["Slotted bush", "bosch-3"]];

const AWARDS: [string, string, string][] = [["SEG Automotive", "Overall performance award, 2018", "seg-2018-trophy"], ["Tyco Electronics", "Zero PPM supplier award, 2008", "tyco-2008"], ["Bosch / MICO", "Excellence award, 2003–04", "bosch-plaque"], ["CII–Bosch", "Cluster recognition", "cii-bosch-cluster"]];


const AWARD_ITEMS: GalleryItem[] = [
  { src: "/esbee/awards/seg-2018-trophy.jpg", title: "SEG Automotive", note: "Overall performance award, 2018", w: 532, h: 513 },
  { src: "/esbee/awards/seg-2018-presentation.jpg", title: "SEG Automotive", note: "Award presentation, 2018", w: 800, h: 453 },
  { src: "/esbee/awards/seg-2018-certificate.jpg", title: "SEG Automotive", note: "Award certificate, 2018", w: 637, h: 383 },
  { src: "/esbee/awards/tyco-2008.jpg", title: "Tyco Electronics", note: "Zero PPM supplier award, 2008", w: 800, h: 451 },
  { src: "/esbee/awards/tyco-green-channel.jpg", title: "Tyco Electronics", note: "Green Channel Supplier certificate of appreciation", w: 1000, h: 753 },
  { src: "/esbee/awards/mico-bosch-2005.jpg", title: "MICO / Bosch", note: "Excellence through Partnership, August 2005", w: 1400, h: 1054 },
  { src: "/esbee/awards/bosch-plaque.jpg", title: "MICO / Bosch", note: "Excellence in performance plaque, 2003–04", w: 304, h: 235 },
  { src: "/esbee/awards/power-partners.jpg", title: "Bosch Power Partners Meet", note: "Supplier recognition event", w: 1400, h: 1054 },
  { src: "/esbee/awards/info-session-2009.jpg", title: "Bosch partners information session", note: "Bangalore plant, 10 March 2009", w: 1400, h: 1054 },
  { src: "/esbee/awards/cert-presentation.jpg", title: "Certificate presentation", note: "Bosch supplier programme", w: 1400, h: 1054 },
  { src: "/esbee/awards/cii-bosch-cluster.jpg", title: "CII – Bosch Vendor Advance Cluster", note: "Participation certificate, Dec 2010 – May 2011", w: 753, h: 1000 },
  { src: "/esbee/awards/amtex-2003.jpg", title: "AMTEX 2003", note: "Exhibition recognition, Bangalore", w: 1054, h: 1400 },
  { src: "/esbee/awards/display-1.jpg", title: "Awards display", note: "Customer trophies and plaques", w: 1000, h: 590 },
  { src: "/esbee/awards/display-2.jpg", title: "Awards and parts display", note: "Trophies with machined and cast components", w: 1000, h: 637 },
];

const COMMUNITY_ITEMS: GalleryItem[] = [
  { src: "/esbee/awards/rotary-president.jpg", title: "Rotary Bangalore Vijayanagar", note: "Appreciation as President, Mr. Sunil Baglani", w: 1054, h: 1400 },
  { src: "/esbee/awards/rotary-gift-a-life.jpg", title: "Rotary Gift-a-Life project", note: "Acknowledgement of contribution, District 3190", w: 1400, h: 1054 },
  { src: "/esbee/awards/rotary-governor.jpg", title: "Rotary District 3190", note: "Governor's recognition", w: 1400, h: 1054 },
  { src: "/esbee/awards/rotary-momento.jpg", title: "Rotary Bangalore Vijayanagar", note: "Momento of appreciation", w: 1054, h: 1400 },
  { src: "/esbee/awards/ifmr-recognition.jpg", title: "IFMR Bangalore", note: "Recognition for a long solo ride, 2011–12", w: 1400, h: 1054 },
];

const WHY: [string, string][] = [
  ["Whole chain under one roof", "Die casting, CNC and VMC machining, grinding, deburring, assembly, washing, gauging and dispatch are managed by one team, so the part is controlled from casting to carton."],
  ["Trusted by Bosch since 1998", "More than two decades of supply to Bosch, with supplier awards from Bosch, SEG Automotive and Tyco Electronics for quality and delivery."],
  ["Zero-PPM mindset", "Defect rates are tracked in parts per million. Zero-PPM recognitions in 2005 and 2008 reflect how every lot is controlled and inspected."],
  ["Own plants, own control", "All three manufacturing units are company-owned, with 90+ CNC machines and two 400-tonne pressure die casting machines running under direct supervision."],
  ["Digital production tracking", "Production, inspection and dispatch data are captured in our own digital systems, so customers receive clear traceability and timely reports."],
  ["Engineering support", "Our team reviews drawings for manufacturability, suggests fixtures and process routes, and launches new parts through APQP and PPAP."],
];

const STEPS: [string, string][] = [
  ["Enquiry and drawing review", "You send the drawing, material, volumes and delivery needs through the quotation form."],
  ["Feasibility and quotation", "We study tolerances, tooling and process route, then reply with a clear quotation within one working day."],
  ["Tooling, fixtures and gauges", "Fixtures, cutting tools and gauges are designed and built for repeatable accuracy."],
  ["APQP and PPAP launch", "Control plan, process flow, FMEA and measurement-system studies are completed, and samples are submitted for approval."],
  ["Production", "Machining and pressure die casting run on defined parameters with in-process checks at every critical operation."],
  ["Inspection and traceability", "Final inspection on CMM, projector and gauges, with lot traceability and documented results."],
  ["Delivery and review", "Customer-specific packing, scheduled dispatch and regular performance reviews with feedback loops."],
];

const INDUSTRIES: [string, string][] = [
  ["Automotive fuel systems", "Plungers, sleeves, nozzle nuts, studs and precision turned parts for fuel-injection applications."],
  ["Automotive electrical", "Aluminium die cast end shields and housings, machined to size, for alternators and starter motors."],
  ["Hydraulics", "Steel-turned hydraulic components for valve and pump manufacturers."],
  ["Industrial and electrical", "Connector bodies, bushes, shafts and adapters for industrial and electrical products."],
];

const MILESTONES: [string, string][] = [
  ["1998", "Begins supplying Bosch, which remains a core customer today."],
  ["2003–04", "Excellence in performance award from MICO / Bosch."],
  ["2005", "Zero-PPM recognition for turned parts; MICO / Bosch “Excellence through Partnership”."],
  ["2008", "Zero-PPM supplier award from Tyco Electronics."],
  ["2009", "Second position in the CII – Bosch SME Cluster Quality Circle competition."],
  ["2010–11", "Completes the CII – Bosch Vendor Advance Cluster programme."],
  ["2018", "Overall performance award from SEG Automotive."],
  ["2026", "New manufacturing hangar completed at Bommasandra."],
];

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

export default function EsbeeHome() {
  return (
    <div className="text-slate-800">
      {/* top bar */}
      <div style={{ background: NAVY }} className="text-[12.5px] text-white/80">
        <div className="mx-auto flex max-w-[2000px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-2 sm:px-10 lg:px-14 2xl:px-20">
          <span>Precision machined and die cast components · Bengaluru, India</span>
          <span className="flex flex-wrap gap-x-5"><a href={PHONE_LINK} className="hover:text-white">{PHONE}</a><a href={`mailto:${EMAIL}`} className="hover:text-white">{EMAIL}</a></span>
        </div>
      </div>

      {/* header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[2000px] items-center justify-between gap-6 px-5 py-3 sm:px-10 lg:px-14 2xl:px-20">
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
          <div className="mx-auto grid max-w-[2000px] gap-12 px-5 py-20 sm:px-10 lg:px-14 2xl:px-20 lg:grid-cols-[1.25fr_.75fr] lg:py-28">
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
        <section id="about" className="mx-auto grid max-w-[2000px] gap-12 px-5 py-20 sm:px-10 lg:px-14 2xl:px-20 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.24em]" style={{ color: RED }}>About us</p>
            <h2 className="font-display text-3xl font-semibold leading-tight sm:text-4xl" style={{ color: NAVY }}>A partnership-run manufacturer built on repeatable quality.</h2>
          </div>
          <div className="space-y-4 text-[15.5px] leading-relaxed text-slate-600">
            <p>Esbee Precision Industries is a Bengaluru-based partnership firm making precision machined and aluminium pressure die cast components. We supply automotive fuel-system and electrical customers, as well as hydraulic and industrial customers, from three company-owned manufacturing units in Rajaji Nagar and Bommasandra, with Bosch as a core customer since 1998.</p>
            <p>Our strength is the whole chain under one roof: die casting, CNC and VMC machining, washing, gauging, final inspection and dispatch. Production is planned and tracked in our own digital systems, so customers get consistent quality, clear traceability and dependable delivery.</p>
          </div>
        </section>

        {/* why */}
        <section className="mx-auto max-w-[2000px] px-5 py-20 sm:px-10 lg:px-14 2xl:px-20">
          <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.24em]" style={{ color: RED }}>Why Esbee</p>
          <h2 className="font-display text-3xl font-semibold sm:text-4xl" style={{ color: NAVY }}>A supplier you can plan around.</h2>
          <div className="mt-12 grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
            {WHY.map(([t, d], i) => (
              <div key={t} className="bg-white p-8"><div className="font-display text-3xl font-semibold" style={{ color: RED }}>{String(i + 1).padStart(2, "0")}</div><h3 className="mt-3 text-lg font-semibold" style={{ color: NAVY }}>{t}</h3><p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">{d}</p></div>
            ))}
          </div>
        </section>

        {/* leadership */}
        <section id="leadership" className="bg-slate-50 py-20">
          <div className="mx-auto max-w-[2000px] px-5 sm:px-10 lg:px-14 2xl:px-20">
            <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.24em]" style={{ color: RED }}>Leadership</p>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl" style={{ color: NAVY }}>The people behind Esbee.</h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {LEADERS.map(([n, r, f, d]) => (
                <article key={f} className="overflow-hidden border border-slate-200 bg-white shadow-sm">
                  <div className="relative aspect-[4/3.4] bg-[#0A1F44]"><Image src={`/esbee/leaders/${f}.jpg`} alt={n} fill sizes="(min-width:768px) 33vw, 100vw" className="object-contain" /></div>
                  <div className="border-t-4 p-7" style={{ borderTopColor: RED }}>
                    <h3 className="font-display text-2xl font-semibold" style={{ color: NAVY }}>{n}</h3>
                    <div className="mt-1 text-[12.5px] font-semibold uppercase tracking-wider" style={{ color: RED }}>{r}</div>
                    <p className="mt-4 text-[14.5px] leading-relaxed text-slate-600">{d}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* journey */}
        <section className="py-20 text-white" style={{ background: NAVY }}>
          <div className="mx-auto max-w-[2000px] px-5 sm:px-10 lg:px-14 2xl:px-20">
            <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.24em] text-white/60">Our journey</p>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Milestones recognised by our customers.</h2>
            <ol className="mt-12 grid gap-px bg-white/15 sm:grid-cols-2 lg:grid-cols-4">
              {MILESTONES.map(([y, t]) => (
                <li key={y} className="p-7" style={{ background: "#0E2956" }}><div className="font-display text-3xl font-semibold">{y}</div><div className="mt-3 h-0.5 w-10" style={{ background: RED }} /><p className="mt-3 text-[14.5px] leading-relaxed text-white/75">{t}</p></li>
              ))}
            </ol>
          </div>
        </section>

        {/* industries */}
        <section className="mx-auto max-w-[2000px] px-5 py-20 sm:px-10 lg:px-14 2xl:px-20">
          <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.24em]" style={{ color: RED }}>Industries we serve</p>
          <h2 className="font-display text-3xl font-semibold sm:text-4xl" style={{ color: NAVY }}>Applications where precision matters.</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {INDUSTRIES.map(([t, d]) => (
              <div key={t} className="border border-slate-200 border-t-4 bg-white p-7 shadow-sm" style={{ borderTopColor: RED }}><h3 className="text-lg font-semibold" style={{ color: NAVY }}>{t}</h3><p className="mt-3 text-[14.5px] leading-relaxed text-slate-600">{d}</p></div>
            ))}
          </div>
        </section>

        {/* capabilities */}
        <section id="capabilities" className="bg-slate-50 py-20">
          <div className="mx-auto max-w-[2000px] px-5 sm:px-10 lg:px-14 2xl:px-20">
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
        <section id="products" className="mx-auto max-w-[2000px] px-5 py-20 sm:px-10 lg:px-14 2xl:px-20">
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

        {/* machines */}
        <section id="machines" className="mx-auto max-w-[2000px] px-5 py-20 sm:px-10 lg:px-14 2xl:px-20">
          <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.24em]" style={{ color: RED }}>Machines</p>
          <h2 className="font-display text-3xl font-semibold sm:text-4xl" style={{ color: NAVY }}>Equipment on our shop floor.</h2>
          <p className="mt-4 max-w-3xl text-[15.5px] leading-relaxed text-slate-600">Turning, machining, gear shaping, broaching, grinding, polygon milling, spline and thread rolling, pressure die casting, hydraulic and pneumatic assembly, ECM deburring and gun drilling. Plating and heat treatment are done with approved partners.</p>
          <ul className="mt-6 flex flex-wrap gap-3 text-[13px] font-medium" style={{ color: NAVY }}>{["90+ CNC machines", "10+ multi-spindle automats", "HMC and 8+ VMCs", "2 × 400 t pressure die casting", "2 cylindrical grinders + 1 centreless grinder"].map((t) => <li key={t} className="border border-slate-300 bg-white px-3.5 py-1.5">{t}</li>)}</ul>
          <div className="mt-10 grid grid-cols-2 gap-5 lg:grid-cols-3">
            {MACHINES.map(([n, f]) => (
              <figure key={f} className="overflow-hidden border border-slate-200 bg-white"><div className="relative aspect-[4/3] bg-slate-100"><Image src={`/esbee/machines/${f}.jpg`} alt={n} fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover" /></div><figcaption className="px-4 py-3 text-[13.5px] font-medium" style={{ color: NAVY }}>{n}</figcaption></figure>
            ))}
          </div>
        </section>

        {/* parts */}
        <section className="bg-slate-50 py-20">
          <div className="mx-auto max-w-[2000px] px-5 sm:px-10 lg:px-14 2xl:px-20">
            <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.24em]" style={{ color: RED }}>Parts we make</p>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl" style={{ color: NAVY }}>Machined and die cast components.</h2>
            <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
              {PARTS.map(([n, f]) => (
                <figure key={f} className="border border-slate-200 bg-white"><div className="relative aspect-square bg-white"><Image src={`/esbee/parts/${f}.jpg`} alt={n} fill sizes="(min-width:1024px) 20vw, 50vw" className="object-contain p-2" /></div><figcaption className="border-t border-slate-100 px-3 py-2 text-[12.5px] font-medium text-slate-600">{n}</figcaption></figure>
              ))}
            </div>
          </div>
        </section>

        {/* process */}
        <section id="process" className="bg-slate-50 py-20">
          <div className="mx-auto max-w-[2000px] px-5 sm:px-10 lg:px-14 2xl:px-20">
            <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.24em]" style={{ color: RED }}>How we work</p>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl" style={{ color: NAVY }}>From drawing to delivery in seven steps.</h2>
            <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(([t, d], i) => (
                <li key={t} className="relative border border-slate-200 bg-white p-6"><span className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center text-sm font-bold text-white" style={{ background: RED }}>{i + 1}</span><h3 className="mt-2 text-[16px] font-semibold" style={{ color: NAVY }}>{t}</h3><p className="mt-2 text-[14px] leading-relaxed text-slate-600">{d}</p></li>
              ))}
            </ol>
          </div>
        </section>

        {/* quality */}
        <section id="quality" className="py-20 text-white" style={{ background: NAVY }}>
          <div className="mx-auto max-w-[2000px] px-5 sm:px-10 lg:px-14 2xl:px-20">
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
            <h3 className="mt-16 text-lg font-semibold">Inspection equipment</h3>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
              {QUAL_EQ.map(([n, f]) => (
                <figure key={f} className="bg-white"><div className="relative aspect-square"><Image src={`/esbee/quality/${f}.jpg`} alt={n} fill sizes="(min-width:1024px) 14vw, 50vw" className="object-contain p-2" /></div><figcaption className="px-2 pb-2 text-center text-[12px] font-medium text-slate-700">{n}</figcaption></figure>
              ))}
            </div>
            <div className="mt-12 grid gap-px bg-white/15 sm:grid-cols-2"><div className="p-6" style={{ background: "#0E2956" }}><div className="font-display text-2xl font-semibold">IATF 16949:2016</div><div className="mt-1 text-[13.5px] text-white/70">Automotive quality management system</div></div><div className="p-6" style={{ background: "#0E2956" }}><div className="font-display text-2xl font-semibold">ISO 14001:2015</div><div className="mt-1 text-[13.5px] text-white/70">Environmental management system</div></div></div>
          </div>
        </section>

        {/* awards */}
        <section id="awards" className="mx-auto max-w-[2000px] px-5 py-20 sm:px-10 lg:px-14 2xl:px-20">
          <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.24em]" style={{ color: RED }}>Awards and recognition</p>
          <h2 className="font-display text-3xl font-semibold sm:text-4xl" style={{ color: NAVY }}>Appreciated by the customers we serve.</h2>
          <p className="mt-4 max-w-3xl text-[15.5px] leading-relaxed text-slate-600">Click any picture to see it in full.</p>
          <div className="mt-10"><EsbeeGallery items={AWARD_ITEMS} cols="lg:grid-cols-5" /></div>
          <h3 className="mt-16 font-display text-2xl font-semibold" style={{ color: NAVY }}>Community and leadership recognition</h3>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-slate-600">Our co-founder, Mr. Sunil Baglani, serves the community through Rotary and other fellowships.</p>
          <div className="mt-8"><EsbeeGallery items={COMMUNITY_ITEMS} cols="lg:grid-cols-5" /></div>
        </section>

        {/* plants */}
        <section id="plants" className="mx-auto max-w-[2000px] px-5 py-20 sm:px-10 lg:px-14 2xl:px-20">
          <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.24em]" style={{ color: RED }}>Our plants</p>
          <h2 className="font-display text-3xl font-semibold sm:text-4xl" style={{ color: NAVY }}>Three owned units across Bengaluru.</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PLANTS.map((p) => (
              <div key={p.n} className="border border-slate-200 border-t-4 bg-white shadow-sm" style={{ borderTopColor: RED }}>
                {p.img && <div className="relative aspect-[16/10]"><Image src={`/esbee/plants/${p.img}.jpg`} alt={p.n} fill sizes="(min-width:768px) 33vw, 100vw" className="object-cover" /></div>}
                <div className="p-7">
                  <div className="font-display text-2xl font-semibold" style={{ color: NAVY }}>{p.n}</div>
                  <div className="mt-1 text-[13px] font-semibold uppercase tracking-wider text-slate-500">{p.role}</div>
                  <p className="mt-4 text-[14.5px] leading-relaxed text-slate-600">{p.a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* customers */}
        <section id="customers" className="border-y border-slate-200 bg-slate-50 py-16">
          <div className="mx-auto max-w-[2000px] px-5 sm:px-10 lg:px-14 2xl:px-20">
            <p className="text-center text-[11.5px] font-semibold uppercase tracking-[0.24em] text-slate-500">Trusted by leading manufacturers</p>
            <div className="mt-9 grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-3 lg:grid-cols-6">
              {CUSTOMERS.map(([n, f, w, h]) => (
                <div key={f} className="flex h-28 items-center justify-center bg-white p-5"><Image src={`/esbee/logos/${f}.jpg`} alt={n} width={w} height={h} className="max-h-16 w-auto object-contain" /></div>
              ))}
            </div>
          </div>
        </section>

        {/* RFQ */}
        <section id="rfq" className="mx-auto grid max-w-[2000px] gap-12 px-5 py-20 sm:px-10 lg:px-14 2xl:px-20 lg:grid-cols-[.8fr_1.2fr]">
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
        <div className="mx-auto flex max-w-[2000px] flex-wrap items-center justify-between gap-4 px-5 py-8 text-[13px] sm:px-10 lg:px-14 2xl:px-20">
          <div className="flex items-center gap-4"><span className="rounded-sm bg-white p-1.5"><Image src="/esbee/emblem.png" alt="" width={36} height={36} className="h-9 w-9" /></span><span>© {new Date().getFullYear()} Esbee Precision Industries. All rights reserved.</span></div>
          <span>No. C-35, 3rd Main Road, Rajaji Nagar Industrial Estate, Bengaluru 560044 · GSTIN 29AAAFE6725G1ZG</span>
        </div>
      </footer>
    </div>
  );
}
