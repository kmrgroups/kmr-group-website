"use client";
import { useState } from "react";

type Business = "software" | "shop" | "training" | "import_export" | "trading" | "distribution" | "general";

/** One enquiry / request-for-quote form for every business; it reaches KMR Console › Enquiries. */
export default function EnquiryForm({ business, productName, productCode, askQuantity, askCompany = true, title, submitLabel = "Send enquiry" }: {
  business: Business; productName?: string; productCode?: string; askQuantity?: boolean; askCompany?: boolean; title?: string; submitLabel?: string;
}) {
  const [f, setF] = useState({ name: "", company: "", email: "", phone: "", country: "India", quantity: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const input = "w-full border border-line px-3 py-2 text-sm bg-white";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg({});
    const r = await fetch("/api/enquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, business, productName, productCode }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg({ error: j.error || "Could not send. Please email info@kmr-groups.com." }); return; }
    setMsg({ ok: "Thank you — we have your enquiry and will get back to you within one working day." });
    setF({ ...f, quantity: "", message: "" });
  }

  if (msg.ok) return <div className="plate bg-white p-5 text-sm text-signal">{msg.ok}</div>;
  return (
    <form onSubmit={submit} className="plate bg-white p-5 grid sm:grid-cols-2 gap-3">
      {title && <h3 className="font-display text-xl sm:col-span-2">{title}</h3>}
      {productName && <p className="sm:col-span-2 text-sm text-slate">About: <b className="text-ink">{productName}</b></p>}
      <input className={input} placeholder="Your name *" required minLength={2} value={f.name} onChange={set("name")} />
      {askCompany && <input className={input} placeholder="Company" value={f.company} onChange={set("company")} />}
      <input className={input} type="email" placeholder="Email *" required value={f.email} onChange={set("email")} />
      <input className={input} placeholder="Phone / WhatsApp" value={f.phone} onChange={set("phone")} />
      <input className={input} placeholder="Country" value={f.country} onChange={set("country")} />
      {askQuantity && <input className={input} placeholder="Quantity (e.g. 5 tonnes, 200 pcs)" value={f.quantity} onChange={set("quantity")} />}
      <textarea className={`${input} sm:col-span-2`} rows={3} placeholder={business === "import_export" ? "What you need, destination / origin, delivery terms (FOB / CIF)…" : "Your requirement or question"} value={f.message} onChange={set("message")} />
      <input tabIndex={-1} autoComplete="off" className="hidden" value={f.website} onChange={set("website")} aria-hidden="true" />
      <div className="sm:col-span-2 flex items-center gap-3">
        <button disabled={busy} className="bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-5 py-2.5 disabled:opacity-60">{busy ? "Sending…" : submitLabel}</button>
        {msg.error && <p className="text-sm text-red-600">{msg.error}</p>}
      </div>
    </form>
  );
}
