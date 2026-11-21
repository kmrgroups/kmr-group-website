"use client";
import { useState } from "react";

const PROCESSES = ["CNC turning", "CNC / VMC machining", "Pressure die casting + machining", "Multi-spindle / special machine", "Not sure — need advice"];

/** Request-for-quotation form of the Esbee website; saved in the Console and mailed to the sales inbox. */
export default function EsbeeRfq() {
  const [f, setF] = useState({ name: "", company: "", email: "", phone: "", part: "", process: PROCESSES[0], material: "", qty: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg({});
    const r = await fetch("/api/esbee-rfq", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg({ error: j.error || "Could not send. Please call or email us." }); return; }
    setMsg({ ok: "Thank you — we have your request. Our team will reply within one working day." });
    setF({ ...f, part: "", material: "", qty: "", message: "" });
  }

  const input = "w-full rounded-sm border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/15";
  const label = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500";
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div><label className={label}>Your name *</label><input className={input} required value={f.name} onChange={set("name")} autoComplete="name" /></div>
      <div><label className={label}>Company</label><input className={input} value={f.company} onChange={set("company")} autoComplete="organization" /></div>
      <div><label className={label}>Email *</label><input className={input} type="email" required value={f.email} onChange={set("email")} autoComplete="email" /></div>
      <div><label className={label}>Phone</label><input className={input} value={f.phone} onChange={set("phone")} autoComplete="tel" /></div>
      <div className="sm:col-span-2"><label className={label}>Part name / drawing number *</label><input className={input} value={f.part} onChange={set("part")} placeholder="e.g. Pump plunger, drawing no. …" /></div>
      <div><label className={label}>Process</label><select className={input} value={f.process} onChange={set("process")}>{PROCESSES.map((p) => <option key={p}>{p}</option>)}</select></div>
      <div><label className={label}>Material</label><input className={input} value={f.material} onChange={set("material")} placeholder="e.g. Aluminium, steel grade" /></div>
      <div className="sm:col-span-2"><label className={label}>Annual quantity</label><input className={input} value={f.qty} onChange={set("qty")} placeholder="e.g. 60,000 nos / year" /></div>
      <div className="sm:col-span-2"><label className={label}>Message</label><textarea className={input} rows={4} value={f.message} onChange={set("message")} placeholder="Tolerances, finish, packing, delivery schedule, anything else we should know. You can send the drawing by reply to our acknowledgement email." /></div>
      <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={f.website} onChange={set("website")} name="website" />
      <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
        <button disabled={busy} className="rounded-sm bg-[#C8102E] px-7 py-3 text-sm font-semibold tracking-wide text-white shadow-lg shadow-[#C8102E]/25 transition hover:bg-[#a30d26] disabled:opacity-60">{busy ? "Sending…" : "Request a quotation"}</button>
        {msg.ok && <p className="text-sm font-medium text-emerald-700">{msg.ok}</p>}
        {msg.error && <p className="text-sm font-medium text-red-700">{msg.error}</p>}
      </div>
    </form>
  );
}
