"use client";
import { useState } from "react";
import { IconCheck } from "./Icons";

type Business = "software" | "shop" | "training" | "import_export" | "trading" | "distribution" | "general";

/** One enquiry / request-for-quote form for every business; it reaches KMR Console › Enquiries. */
export default function EnquiryForm({ business, productName, productCode, askQuantity, askCompany = true, title, intro, submitLabel = "Send enquiry", dark }: {
  business: Business; productName?: string; productCode?: string; askQuantity?: boolean; askCompany?: boolean; title?: string; intro?: string; submitLabel?: string; dark?: boolean;
}) {
  const [f, setF] = useState({ name: "", company: "", email: "", phone: "", country: "India", quantity: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg({});
    const r = await fetch("/api/enquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, business, productName, productCode }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg({ error: j.error || "Could not send. Please email us instead." }); return; }
    setMsg({ ok: "Thank you — we have your enquiry and will get back to you within one working day." });
    setF({ ...f, quantity: "", message: "" });
  }

  const box = dark ? "border border-white/10 bg-white/[0.04] p-6 md:p-8 text-white" : "card p-6 md:p-8";
  if (msg.ok) return (
    <div className={`${box} flex items-start gap-4`} role="status">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success/10 text-success"><IconCheck /></span>
      <div><p className={`font-display text-xl ${dark ? "text-white" : "text-navy"}`}>Enquiry received</p><p className={`mt-1 text-sm ${dark ? "text-white/70" : "text-muted"}`}>{msg.ok}</p></div>
    </div>
  );
  const fld = dark ? "field border-white/15 bg-white/[0.06] text-white placeholder:text-white/45" : "field";
  return (
    <form onSubmit={submit} className={`${box} grid content-start gap-4 sm:grid-cols-2`}>
      {title && <h3 className={`font-display text-2xl font-semibold sm:col-span-2 ${dark ? "text-white" : "text-navy"}`}>{title}</h3>}
      {intro && <p className={`-mt-2 text-sm sm:col-span-2 ${dark ? "text-white/65" : "text-muted"}`}>{intro}</p>}
      {productName && <p className={`text-sm sm:col-span-2 ${dark ? "text-white/70" : "text-muted"}`}>About: <b className={dark ? "text-gold-light" : "text-navy"}>{productName}</b></p>}
      <input className={fld} placeholder="Your name *" required minLength={2} value={f.name} onChange={set("name")} aria-label="Your name" />
      {askCompany && <input className={fld} placeholder="Company" value={f.company} onChange={set("company")} aria-label="Company" />}
      <input className={fld} type="email" placeholder="Email *" required value={f.email} onChange={set("email")} aria-label="Email" />
      <input className={fld} placeholder="Phone / WhatsApp" value={f.phone} onChange={set("phone")} aria-label="Phone" />
      <input className={fld} placeholder="Country" value={f.country} onChange={set("country")} aria-label="Country" />
      {askQuantity && <input className={fld} placeholder={business === "training" ? "Number of participants" : "Quantity (e.g. 5 tonnes, 200 pcs)"} value={f.quantity} onChange={set("quantity")} aria-label="Quantity" />}
      <textarea className={`${fld} sm:col-span-2`} rows={4} placeholder={business === "import_export" ? "What you need, destination / origin, delivery terms (FOB / CIF)…" : "How can we help?"} value={f.message} onChange={set("message")} aria-label="Message" />
      <input tabIndex={-1} autoComplete="off" className="hidden" value={f.website} onChange={set("website")} aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button disabled={busy} className="btn-gold">{busy ? "Sending…" : submitLabel}</button>
        {msg.error ? <p className="text-sm text-danger">{msg.error}</p> : <p className={`text-xs ${dark ? "text-white/50" : "text-muted"}`}>We reply within one working day.</p>}
      </div>
    </form>
  );
}
