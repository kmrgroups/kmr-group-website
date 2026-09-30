"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconLock } from "./Icons";

export function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="ml-2 text-xs font-semibold text-gold-dark underline-offset-2 hover:underline">{done ? "Copied" : "Copy"}</button>
  );
}

type RzpOptions = Record<string, unknown> & { handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void };
declare global { interface Window { Razorpay?: new (o: RzpOptions) => { open: () => void; on: (e: string, f: (r: { error?: { description?: string } }) => void) => void } } }

function loadCheckout(): Promise<boolean> {
  return new Promise((ok) => {
    if (window.Razorpay) return ok(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => ok(true); s.onerror = () => ok(false);
    document.body.appendChild(s);
  });
}

/** Pay online: Razorpay checkout (UPI, cards, net banking, wallets). The server verifies the payment before the order is marked paid. */
export function PayOnlineButton({ token, amountLabel }: { token: string; amountLabel: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});

  async function pay() {
    setBusy(true); setMsg({});
    const r = await fetch("/api/pay/razorpay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    const o = await r.json().catch(() => ({}));
    if (!r.ok) { setBusy(false); setMsg({ error: o.error || "Could not start the payment." }); return; }
    if (!(await loadCheckout()) || !window.Razorpay) { setBusy(false); setMsg({ error: "The payment window could not load. Check your connection, or pay by bank transfer / UPI below." }); return; }
    const rzp = new window.Razorpay({
      key: o.key, order_id: o.order_id, amount: o.amount, currency: o.currency, name: o.name, image: o.image, description: o.description, prefill: o.prefill,
      theme: { color: "#0B1C3A" },
      modal: { ondismiss: () => setBusy(false) },
      handler: async (resp) => {
        setMsg({ ok: "Payment received — confirming with Razorpay…" });
        const v = await fetch("/api/pay/razorpay/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(resp) });
        const j = await v.json().catch(() => ({}));
        setBusy(false);
        if (!v.ok) { setMsg({ error: j.error || "We could not confirm the payment yet — we will check and update your order." }); return; }
        setMsg({ ok: "Payment successful. Thank you!" });
        router.refresh();
      },
    });
    rzp.on("payment.failed", (e) => setMsg({ error: e.error?.description || "Payment failed. You can try again." }));
    rzp.open();
  }

  return (
    <div>
      <button onClick={pay} disabled={busy} className="btn-gold w-full py-4 text-base"><IconLock className="h-4 w-4" />{busy ? "Opening secure payment…" : `Pay ${amountLabel} securely`}</button>
      {msg.error && <p className="mt-3 text-sm text-danger" role="alert">{msg.error}</p>}
      {msg.ok && <p className="mt-3 text-sm text-success" role="status">{msg.ok}</p>}
    </div>
  );
}

const METHODS: [string, string][] = [["upi", "UPI"], ["neft", "NEFT"], ["imps", "IMPS"], ["rtgs", "RTGS"], ["cheque", "Cheque"], ["other", "Other"]];

/** "I've paid": the customer sends the UTR so KMR can match it in the bank statement. */
export function ReportPaymentForm({ token, amount }: { token: string; amount: string }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ method: "upi", reference: "", paidOn: today, amount, payer: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg({});
    const r = await fetch("/api/report-payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ...f }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg({ error: j.error || "Could not send. Please try again." }); setBusy(false); return; }
    setMsg({ ok: "Thank you — we have your payment details. We will confirm once it reaches our bank account (usually within one working day)." });
    setTimeout(() => router.refresh(), 1500);
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <label className="block"><span className="label">Paid by</span>
        <select className="field" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{METHODS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="block"><span className="label">UTR / transaction reference</span>
        <input className="field" required minLength={4} maxLength={60} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="From your bank or UPI app" /></label>
      <label className="block"><span className="label">Date paid</span>
        <input className="field" type="date" required max={today} value={f.paidOn} onChange={(e) => setF({ ...f, paidOn: e.target.value })} /></label>
      <label className="block"><span className="label">Amount paid (₹)</span>
        <input className="field" inputMode="decimal" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
      <label className="block sm:col-span-2"><span className="label">Paid from (name on the account, optional)</span>
        <input className="field" maxLength={120} value={f.payer} onChange={(e) => setF({ ...f, payer: e.target.value })} /></label>
      <div className="sm:col-span-2"><button disabled={busy} className="btn-navy">{busy ? "Sending…" : "Send payment details"}</button></div>
      {msg.error && <p className="text-sm text-danger sm:col-span-2">{msg.error}</p>}
      {msg.ok && <p className="text-sm text-success sm:col-span-2">{msg.ok}</p>}
    </form>
  );
}
