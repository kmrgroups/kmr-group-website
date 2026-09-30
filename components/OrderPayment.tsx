"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="ml-2 text-xs text-copper underline">{done ? "Copied" : "Copy"}</button>
  );
}

const METHODS: [string, string][] = [["neft", "NEFT"], ["imps", "IMPS"], ["rtgs", "RTGS"], ["upi", "UPI"], ["cheque", "Cheque"], ["other", "Other"]];

/** "I've paid": the customer sends the UTR so KMR can match it in the bank statement. */
export function ReportPaymentForm({ token, amount }: { token: string; amount: string }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ method: "upi", reference: "", paidOn: today, amount, payer: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const input = "w-full border border-line px-3 py-2 text-sm bg-white";

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg({});
    const r = await fetch("/api/report-payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ...f }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg({ error: j.error || "Could not send. Please try again." }); setBusy(false); return; }
    setMsg({ ok: "Thank you — we have your payment details. We will confirm once it reaches our bank account (usually within one working day)." });
    setTimeout(() => router.refresh(), 1500);
  }

  return (
    <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
      <label className="text-sm">Paid by
        <select className={input} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{METHODS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="text-sm">UTR / transaction reference
        <input className={input} required minLength={4} maxLength={60} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="From your bank or UPI app" /></label>
      <label className="text-sm">Date paid
        <input className={input} type="date" required max={today} value={f.paidOn} onChange={(e) => setF({ ...f, paidOn: e.target.value })} /></label>
      <label className="text-sm">Amount paid (₹)
        <input className={input} inputMode="decimal" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
      <label className="text-sm sm:col-span-2">Paid from (name on the account, optional)
        <input className={input} maxLength={120} value={f.payer} onChange={(e) => setF({ ...f, payer: e.target.value })} /></label>
      <div className="sm:col-span-2">
        <button disabled={busy} className="bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-5 py-2 disabled:opacity-60">{busy ? "Sending…" : "Send payment details"}</button>
      </div>
      {msg.error && <p className="sm:col-span-2 text-sm text-red-600">{msg.error}</p>}
      {msg.ok && <p className="sm:col-span-2 text-sm text-signal">{msg.ok}</p>}
    </form>
  );
}
