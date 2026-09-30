import { notFound } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CopyButton, ReportPaymentForm } from "@/components/OrderPayment";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your order · KMR Group of Companies", robots: { index: false, follow: false } };

type ShopOrder = {
  order_no: string; product_name: string; quantity: number; amount: number; currency: string; customer_name: string; shipping_address: string;
  status: "awaiting_payment" | "payment_reported" | "paid" | "cancelled" | "failed" | "created";
  pay_method: string | null; pay_reference: string | null; paid_on: string | null; paid_amount: number | null; reject_reason: string | null; created_at: string;
};
type Payee = { name?: string; account_name?: string; account_no?: string; ifsc?: string; bank?: string; branch?: string; account_type?: string; upi_id?: string; notes?: string };

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (d: string | null) => (d ? new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

/** The customer's order: its status, how to pay (bank transfer or UPI into KMR's account) and "I've paid". */
export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{20,64}$/.test(token)) notFound();
  const db = supabaseAdmin();
  const [{ data: order }, { data: payee }] = await Promise.all([db.rpc("shop_order_for_token", { p_token: token }), db.rpc("shop_payee")]);
  if (!order) notFound();
  const o = order as ShopOrder, p = (payee ?? {}) as Payee;
  const amount = Number(o.amount).toFixed(2);
  const payable = o.status === "awaiting_payment";

  let qr: string | null = null;
  if (payable && p.upi_id) {
    const upi = `upi://pay?pa=${encodeURIComponent(p.upi_id)}&pn=${encodeURIComponent(p.account_name || p.name || "KMR")}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Order ${o.order_no}`)}`;
    qr = await QRCode.toString(upi, { type: "svg", margin: 1, width: 180, errorCorrectionLevel: "M" });
  }
  const rows: [string, string | undefined, boolean?][] = [
    ["Account name", p.account_name], ["Account number", p.account_no, true], ["IFSC", p.ifsc, true],
    ["Bank", [p.bank, p.branch].filter(Boolean).join(", ") || undefined], ["Account type", p.account_type],
    ["Amount", inr(o.amount)], ["Remarks", `Order ${o.order_no}`, true],
  ];
  const badge: Record<ShopOrder["status"], [string, string]> = {
    awaiting_payment: ["Waiting for your payment", "text-copper"], payment_reported: ["Payment reported — we are confirming it", "text-copper"],
    paid: ["Paid — we will dispatch soon", "text-signal"], cancelled: ["Cancelled", "text-red-600"], failed: ["Payment failed", "text-red-600"], created: ["Created", "text-slate"],
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-16 space-y-6">
      <div>
        <p className="eyebrow text-steel mb-2">Your Order</p>
        <h1 className="font-display text-4xl mb-1">{o.order_no}</h1>
        <p className={`font-mono text-sm uppercase ${badge[o.status][1]}`}>{badge[o.status][0]}</p>
      </div>

      <div className="plate bg-white p-6 grid sm:grid-cols-2 gap-4 text-sm">
        <div><p className="eyebrow text-steel mb-1">Item</p><p>{o.product_name} × {o.quantity}</p></div>
        <div><p className="eyebrow text-steel mb-1">Amount</p><p className="font-display text-2xl">{inr(o.amount)}</p></div>
        <div><p className="eyebrow text-steel mb-1">Ship to</p><p className="whitespace-pre-line">{o.customer_name}{"\n"}{o.shipping_address}</p></div>
        <div><p className="eyebrow text-steel mb-1">Placed</p><p>{date(o.created_at)}</p>
          {o.pay_reference && <p className="mt-2 text-slate">Payment: {o.pay_method?.toUpperCase()} · <span className="font-mono">{o.pay_reference}</span>{o.paid_amount ? ` · ${inr(o.paid_amount)}` : ""} · {date(o.paid_on)}</p>}</div>
      </div>

      {o.reject_reason && payable && (
        <div className="plate border-red-300 bg-red-50 p-4 text-sm text-red-700">We could not confirm your earlier payment: {o.reject_reason}. Please check the UTR and send it again below.</div>
      )}

      {payable && (
        <div className="plate bg-white p-6 space-y-5">
          <h2 className="font-display text-2xl">How to pay</h2>
          {!p.account_no && !p.upi_id ? (
            <p className="text-sm text-slate">Our payment details are being updated — please contact us to complete your payment.</p>
          ) : (
            <div className="grid md:grid-cols-[1fr_200px] gap-6 items-start">
              {p.account_no && (
                <div>
                  <p className="eyebrow text-steel mb-2">Bank transfer — NEFT / IMPS / RTGS</p>
                  <table className="text-sm"><tbody>
                    {rows.filter(([, v]) => v).map(([k, v, copy]) => (
                      <tr key={k}><td className="pr-4 py-1 text-slate align-top">{k}</td><td className="py-1"><b className={copy ? "font-mono" : ""}>{v}</b>{copy && <CopyButton value={String(v)} />}</td></tr>))}
                  </tbody></table>
                </div>
              )}
              {qr && (
                <div className="text-center">
                  <p className="eyebrow text-steel mb-2">Scan with any UPI app</p>
                  <div className="w-44 h-44 mx-auto [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: qr }} />
                  <p className="text-sm mt-1 font-mono">{p.upi_id}<CopyButton value={p.upi_id!} /></p>
                  <p className="text-xs text-slate">{inr(o.amount)} and the order number are filled in</p>
                </div>
              )}
            </div>
          )}
          {p.notes && <p className="text-sm text-slate whitespace-pre-line">{p.notes}</p>}
          <div className="border-t border-line pt-5">
            <h3 className="font-display text-xl mb-1">Already paid? Tell us</h3>
            <p className="text-sm text-slate mb-3">Send the UTR / reference so we can match it in our bank statement. Your order is dispatched once the payment is confirmed.</p>
            <ReportPaymentForm token={token} amount={amount} />
          </div>
        </div>
      )}

      <p className="text-sm text-slate">Keep this page&apos;s link to check your order. Questions? <Link href="/contact" className="text-copper underline">Contact us</Link> with your order number.</p>
    </div>
  );
}
