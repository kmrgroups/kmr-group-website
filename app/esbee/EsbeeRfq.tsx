"use client";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const PROCESSES = ["CNC turning", "CNC / VMC machining", "Pressure die casting + machining", "Multi-spindle / special machine", "Not sure — need advice"];

/** Request-for-quotation form of the Esbee website; saved in the Console and mailed to the sales inbox. */
export default function EsbeeRfq() {
  const [f, setF] = useState({ name: "", company: "", email: "", phone: "", part: "", process: PROCESSES[0], material: "", qty: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [files, setFiles] = useState<File[]>([]);
  const [otp, setOtp] = useState<{ id: string; whatsapp: boolean } | null>(null);
  const [codes, setCodes] = useState({ email: "", wa: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const post = async (url: string, body: unknown) => { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { ok: r.ok, j: await r.json().catch(() => ({})) }; };

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = [...files, ...Array.from(e.target.files ?? [])].slice(0, 5);
    e.target.value = "";
    if (list.some((x) => x.size > 25 * 1024 * 1024)) { setMsg({ error: "Each file can be up to 25 MB." }); return; }
    setMsg({}); setFiles(list);
  }

  // step 1: send the verification code(s)
  async function sendCode(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg({});
    const { ok, j } = await post("/api/esbee-rfq/otp", { email: f.email, phone: f.phone, website: f.website });
    setBusy(false);
    if (!ok) { setMsg({ error: j.error || "Could not send the code. Please call or email us." }); return; }
    setOtp({ id: j.id, whatsapp: !!j.whatsapp }); setCodes({ email: "", wa: "" });
    setMsg({ ok: j.whatsapp ? "We sent a code to your email and another to your WhatsApp. Enter both below." : "We sent a 6-digit code to your email. Enter it below." });
  }

  // step 2: verify the code(s), upload the drawings, send the request
  async function confirm(e: React.FormEvent) {
    e.preventDefault(); if (!otp) return; setBusy(true); setMsg({});
    const v = await post("/api/esbee-rfq/verify", { id: otp.id, emailCode: codes.email, waCode: codes.wa });
    if (!v.ok) { setBusy(false); setMsg({ error: v.j.error || "The code is not correct." }); return; }
    const paths: string[] = [];
    for (const file of files) {
      const u = await post("/api/esbee-rfq/upload-url", { id: otp.id, name: file.name, size: file.size });
      if (!u.ok) { setBusy(false); setMsg({ error: `${file.name}: ${u.j.error || "could not be uploaded."}` }); return; }
      const up = await supabase.storage.from("esbee-rfq").uploadToSignedUrl(u.j.path, u.j.token, file);
      if (up.error) { setBusy(false); setMsg({ error: `${file.name} could not be uploaded. Please try again.` }); return; }
      paths.push(u.j.path);
    }
    const r = await post("/api/esbee-rfq", { ...f, id: otp.id, files: paths });
    setBusy(false);
    if (!r.ok) { setMsg({ error: r.j.error || "Could not send. Please call or email us." }); return; }
    setMsg({ ok: "Thank you — your request is verified and sent. Our team will reply within one working day." });
    setF({ ...f, part: "", material: "", qty: "", message: "" }); setFiles([]); setOtp(null);
  }

  const input = "w-full rounded-sm border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#C8102E] focus:ring-2 focus:ring-[#C8102E]/15";
  const label = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500";
  return (
    <form onSubmit={otp ? confirm : sendCode} className="grid gap-4 sm:grid-cols-2">
      <div><label className={label}>Your name *</label><input className={input} required value={f.name} onChange={set("name")} autoComplete="name" /></div>
      <div><label className={label}>Company</label><input className={input} value={f.company} onChange={set("company")} autoComplete="organization" /></div>
      <div><label className={label}>Email *</label><input className={input} type="email" required value={f.email} onChange={set("email")} autoComplete="email" /></div>
      <div><label className={label}>Phone</label><input className={input} value={f.phone} onChange={set("phone")} autoComplete="tel" /></div>
      <div className="sm:col-span-2"><label className={label}>Part name / drawing number *</label><input className={input} value={f.part} onChange={set("part")} placeholder="e.g. Pump plunger, drawing no. …" /></div>
      <div><label className={label}>Process</label><select className={input} value={f.process} onChange={set("process")}>{PROCESSES.map((p) => <option key={p}>{p}</option>)}</select></div>
      <div><label className={label}>Material</label><input className={input} value={f.material} onChange={set("material")} placeholder="e.g. Aluminium, steel grade" /></div>
      <div className="sm:col-span-2"><label className={label}>Annual quantity</label><input className={input} value={f.qty} onChange={set("qty")} placeholder="e.g. 60,000 nos / year" /></div>
      <div className="sm:col-span-2"><label className={label}>Message</label><textarea className={input} rows={4} value={f.message} onChange={set("message")} placeholder="Tolerances, finish, packing, delivery schedule, anything else we should know." /></div>
      <div className="sm:col-span-2">
        <label className={label}>Drawings / attachments (optional)</label>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={pick} />
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded-sm border border-dashed border-slate-400 px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-[#C8102E]">Attach files (PDF, DWG, DXF, STEP, images, Excel, ZIP…)</button>
        <p className="mt-1.5 text-xs text-slate-500">Up to 5 files, 25 MB each.</p>
        {files.length > 0 && <ul className="mt-2 space-y-1 text-sm text-slate-700">{files.map((x, i) => <li key={i} className="flex items-center justify-between gap-3 border border-slate-200 px-3 py-1.5"><span className="truncate">{x.name}</span><button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-xs font-semibold text-[#C8102E]">Remove</button></li>)}</ul>}
      </div>
      {otp && (
        <div className="sm:col-span-2 grid gap-4 border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
          <div><label className={label}>Code sent to your email *</label><input className={input} inputMode="numeric" maxLength={6} required value={codes.email} onChange={(e) => setCodes({ ...codes, email: e.target.value.replace(/\D/g, "") })} placeholder="6-digit code" /></div>
          {otp.whatsapp && <div><label className={label}>Code sent to your WhatsApp *</label><input className={input} inputMode="numeric" maxLength={6} required value={codes.wa} onChange={(e) => setCodes({ ...codes, wa: e.target.value.replace(/\D/g, "") })} placeholder="6-digit code" /></div>}
          <p className="text-xs text-slate-500 sm:col-span-2">Did not get it? Check spam, or <button type="button" className="font-semibold text-[#C8102E]" onClick={() => { setOtp(null); setMsg({}); }}>go back and send a new code</button>.</p>
        </div>
      )}
      <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={f.website} onChange={set("website")} name="website" />
      <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
        <button disabled={busy} className="rounded-sm bg-[#C8102E] px-7 py-3 text-sm font-semibold tracking-wide text-white shadow-lg shadow-[#C8102E]/25 transition hover:bg-[#a30d26] disabled:opacity-60">{busy ? "Please wait…" : otp ? "Verify and send request" : "Send verification code"}</button>
        {msg.ok && <p className="text-sm font-medium text-emerald-700">{msg.ok}</p>}
        {msg.error && <p className="text-sm font-medium text-red-700">{msg.error}</p>}
      </div>
    </form>
  );
}
