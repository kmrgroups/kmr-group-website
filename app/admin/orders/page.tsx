"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PermissionGate from "@/components/PermissionGate";
import { useAdminAccess } from "@/lib/AdminAccessContext";
import type { Order } from "@/lib/types";

type Status = Order["status"];
const LABEL: Record<Status, string> = {
  awaiting_payment: "awaiting payment", payment_reported: "payment reported", paid: "paid", cancelled: "cancelled", failed: "failed", created: "created"
};
const COLOR: Record<Status, string> = {
  paid: "text-signal", payment_reported: "text-copper", awaiting_payment: "text-slate", created: "text-slate", cancelled: "text-red-600", failed: "text-red-600"
};
const METHODS: [string, string][] = [["neft", "NEFT"], ["imps", "IMPS"], ["rtgs", "RTGS"], ["upi", "UPI"], ["cheque", "Cheque"], ["other", "Other"]];
const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

function OrdersContent() {
  const { can } = useAdminAccess();
  const canUpdate = can("orders", "update");
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ id?: string; text: string; error?: boolean } | null>(null);
  const [open, setOpen] = useState<{ id: string; kind: "reject" | "paid" | "cancel" } | null>(null);
  const [form, setForm] = useState({ reason: "", method: "neft", reference: "", paidOn: new Date().toISOString().slice(0, 10) });

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders((data as Order[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function act(o: Order, fn: string, args: Record<string, unknown>, done: string) {
    setMsg(null);
    const { error } = await supabase.rpc(fn, { p_order: o.id, ...args });
    if (error) { setMsg({ id: o.id, text: error.message, error: true }); return; }
    setOpen(null); setForm({ ...form, reason: "", reference: "" });
    setMsg({ id: o.id, text: done });
    await load();
  }

  const counts = (s: Status) => orders.filter((o) => o.status === s).length;
  const visible = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const paidTotal = orders.filter((o) => o.status === "paid").reduce((sum, o) => sum + Number(o.amount), 0);
  const input = "border border-line px-3 py-2 text-sm bg-white";

  return (
    <div>
      <p className="eyebrow text-steel mb-2">Sales</p>
      <h1 className="font-display text-4xl mb-2">Orders</h1>
      <p className="text-sm text-slate mb-6 font-mono">
        Collected (paid orders): {inr(paidTotal)} · Customers pay by bank transfer / UPI into the account set in the KMR Console → Prices &amp; invoices → Seller details.
      </p>

      {counts("payment_reported") > 0 && (
        <p className="plate bg-copper/10 border-copper p-3 text-sm mb-4">
          <b>{counts("payment_reported")} payment{counts("payment_reported") > 1 ? "s" : ""} reported</b> — find the UTR / amount in your bank statement, then Confirm or Reject.
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {(["all", "payment_reported", "awaiting_payment", "paid", "cancelled"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 text-sm border ${filter === s ? "border-copper text-copper" : "border-line text-slate"}`}>
            {s === "all" ? "all" : LABEL[s]}{s !== "all" && counts(s) ? ` (${counts(s)})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate font-mono">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-slate font-mono">No orders here.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((o) => {
            const unpaid = o.status === "awaiting_payment" || o.status === "payment_reported" || o.status === "created";
            const diff = o.paid_amount != null ? Number(o.paid_amount) - Number(o.amount) : 0;
            return (
              <div key={o.id} className={`plate bg-white p-4 ${o.status === "payment_reported" ? "border-copper" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="font-medium">
                    <span className="font-mono text-sm mr-2">{o.order_no || o.razorpay_order_id}</span>
                    {o.product_name} <span className="text-xs text-slate font-mono">× {o.quantity}</span>
                  </p>
                  <span className={`text-xs font-mono uppercase ${COLOR[o.status]}`}>{LABEL[o.status]}</span>
                </div>
                <p className="text-sm text-slate">
                  {inr(o.amount)} · {o.customer_name} · {o.customer_phone}{o.customer_email ? ` · ${o.customer_email}` : ""}
                </p>
                <p className="text-xs text-slate mt-1 whitespace-pre-line">{o.shipping_address}</p>
                {o.pay_reference && (
                  <p className="text-sm mt-2">
                    Payment: <b>{o.pay_method?.toUpperCase()}</b> · <span className="font-mono">{o.pay_reference}</span>
                    {o.paid_amount != null && <> · {inr(o.paid_amount)}</>} · {o.paid_on}{o.payer_name ? ` · from ${o.payer_name}` : ""}
                    {diff !== 0 && <span className="text-copper"> — {diff < 0 ? `${inr(-diff)} less` : `${inr(diff)} more`} than the order</span>}
                  </p>
                )}
                {o.reject_reason && unpaid && <p className="text-xs text-red-600 mt-1">Last report rejected: {o.reject_reason}</p>}
                {o.admin_note && <p className="text-xs text-slate mt-1">Note: {o.admin_note}</p>}
                <p className="text-xs text-slate font-mono mt-1">
                  {new Date(o.created_at).toLocaleString("en-IN")}{o.confirmed_at ? ` · confirmed ${new Date(o.confirmed_at).toLocaleString("en-IN")}${o.confirmed_by ? ` by ${o.confirmed_by}` : ""}` : ""}
                </p>

                {canUpdate && unpaid && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {o.status === "payment_reported" && (
                      <button onClick={() => { if (confirm(`Is ${inr(o.paid_amount ?? o.amount)} with reference ${o.pay_reference} in your bank account? The order becomes paid and stock is reduced.`)) act(o, "shop_confirm_payment", {}, "Payment confirmed — order paid, stock reduced."); }}
                        className="bg-copper hover:bg-copper-light text-ink text-sm font-medium px-4 py-1.5">Confirm — money received</button>
                    )}
                    {o.status === "payment_reported" && <button onClick={() => setOpen({ id: o.id, kind: "reject" })} className="border border-line text-sm px-4 py-1.5">Reject</button>}
                    {o.status !== "payment_reported" && <button onClick={() => setOpen({ id: o.id, kind: "paid" })} className="border border-line text-sm px-4 py-1.5">Mark as paid</button>}
                    <button onClick={() => setOpen({ id: o.id, kind: "cancel" })} className="text-sm text-red-600 underline px-2">Cancel order</button>
                  </div>
                )}
                {open?.id === o.id && open.kind === "reject" && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <input className={`${input} flex-1 min-w-[240px]`} placeholder="Reason — the customer sees it" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                    <button onClick={() => act(o, "shop_reject_payment", { p_reason: form.reason }, "Report rejected — the customer sees the reason on their order page.")} className="bg-red-600 text-white text-sm px-4 py-2">Reject report</button>
                  </div>
                )}
                {open?.id === o.id && open.kind === "paid" && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <select className={input} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>{METHODS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <input className={`${input} flex-1 min-w-[180px]`} placeholder="UTR / cheque no." value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                    <input className={input} type="date" value={form.paidOn} onChange={(e) => setForm({ ...form, paidOn: e.target.value })} />
                    <button onClick={() => act(o, "shop_confirm_payment", { p_method: form.method, p_reference: form.reference, p_paid_on: form.paidOn }, "Marked paid — stock reduced.")} className="bg-copper text-ink text-sm font-medium px-4 py-2">Record payment</button>
                  </div>
                )}
                {open?.id === o.id && open.kind === "cancel" && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <input className={`${input} flex-1 min-w-[240px]`} placeholder="Reason (optional)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                    <button onClick={() => act(o, "shop_cancel_order", { p_reason: form.reason }, "Order cancelled.")} className="bg-red-600 text-white text-sm px-4 py-2">Cancel order</button>
                  </div>
                )}
                {msg?.id === o.id && <p className={`text-sm mt-2 ${msg.error ? "text-red-600" : "text-signal"}`}>{msg.text}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <PermissionGate resource="orders">
      <OrdersContent />
    </PermissionGate>
  );
}
