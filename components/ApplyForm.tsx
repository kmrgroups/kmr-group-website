"use client";
import { useState } from "react";
import { IconCheck, IconFile } from "./Icons";

/** Job application with résumé upload → KMR Console › Website CMS › Applications (résumé stored privately). */
export default function ApplyForm({ jobId, jobTitle }: { jobId: string | null; jobTitle: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [file, setFile] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr("");
    const fd = new FormData(e.currentTarget);
    const f = fd.get("resume");
    if (f instanceof File && f.size > 4 * 1024 * 1024) { setErr("The résumé must be under 4 MB."); return; }
    setBusy(true);
    const r = await fetch("/api/careers/apply", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error || "Could not send your application. Please try again."); return; }
    setDone(true);
  }

  if (done) return (
    <div className="card p-8" role="status">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-success/10 text-success"><IconCheck /></span>
      <h3 className="mt-5 font-display text-2xl font-semibold text-navy">Application received</h3>
      <p className="mt-2 text-muted">Thank you for applying for <b className="text-navy">{jobTitle}</b>. Our team reviews every application and will contact you if your profile matches.</p>
    </div>
  );
  return (
    <form onSubmit={submit} className="card space-y-4 p-7 md:p-8">
      <div><p className="eyebrow mb-2">Apply now</p><h3 className="font-display text-2xl font-semibold text-navy">{jobTitle}</h3></div>
      <input type="hidden" name="job_id" value={jobId ?? ""} />
      <input type="hidden" name="job_title" value={jobTitle} />
      <div><label className="label" htmlFor="a-name">Full name *</label><input id="a-name" name="name" required minLength={2} maxLength={120} className="field" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="a-email">Email *</label><input id="a-email" name="email" type="email" required className="field" /></div>
        <div><label className="label" htmlFor="a-phone">Phone *</label><input id="a-phone" name="phone" required minLength={8} maxLength={20} className="field" /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="a-loc">Current location</label><input id="a-loc" name="location" maxLength={80} className="field" /></div>
        <div><label className="label" htmlFor="a-exp">Experience</label><input id="a-exp" name="experience" maxLength={40} placeholder="e.g. 4 years" className="field" /></div>
      </div>
      <div><label className="label" htmlFor="a-co">Current company</label><input id="a-co" name="current_company" maxLength={120} className="field" /></div>
      <div><label className="label" htmlFor="a-li">LinkedIn profile</label><input id="a-li" name="linkedin_url" maxLength={200} placeholder="https://linkedin.com/in/…" className="field" /></div>
      <div>
        <span className="label">Résumé * (PDF or Word, up to 4 MB)</span>
        <label className="flex cursor-pointer items-center gap-3 border border-dashed border-gold/60 bg-gold-pale/40 px-4 py-4 text-sm text-navy hover:bg-gold-pale">
          <IconFile className="h-6 w-6 shrink-0 text-gold-dark" />
          <span className="truncate">{file || "Choose a file…"}</span>
          <input name="resume" type="file" required accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")} />
        </label>
      </div>
      <div><label className="label" htmlFor="a-note">Why this role? (optional)</label><textarea id="a-note" name="cover_note" rows={4} maxLength={2000} className="field" /></div>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="flex gap-2 text-xs text-muted"><input type="checkbox" required className="mt-0.5" /> I agree that KMR may store my application to consider me for this and future roles.</label>
      {err && <p className="text-sm text-danger">{err}</p>}
      <button disabled={busy} className="btn-gold w-full">{busy ? "Sending…" : "Submit application"}</button>
    </form>
  );
}
