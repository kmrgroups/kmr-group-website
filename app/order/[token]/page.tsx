import { notFound } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { razorpayConfigured } from "@/lib/razorpay";
import { CopyButton, PayOnlineButton, ReportPaymentForm } from "@/components/OrderPayment";
import { IconCheck, IconClock, IconLock, IconShield } from "@/components/Icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your order", robots: { index: false, follow: false } };

type ShopOrder = {
  order_no: string; product_name: string; quantity: number; amount: number; currency: string; customer_name: string; shipping_address: string;
  status: "awaiting_payment" | "payment_reported" | "paid" | "cancelled" | "failed" | "created";
  pay_method: string | null; pay_reference: string | null; paid_on: string | null; paid_amount: number | null; reject_reason: string | null; created_at: string;
};
type Payee = { name?: string; account_name?: string; account_no?: string; ifsc?: string; bank?: string; branch?: string; account_type?: string; upi_id?: string; notes?: string };

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (d: string | null) => (d ? new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const STEPS = ["Order placed", "Payment", "Confirmed", "Dispatched"];

/** The customer's order: status, and how to pay — online (Razorpay) and/or bank transfer / UPI into KMR's own account. */
export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{20,64}$/.test(token)) notFound();
  const db = supabaseAdmin();
  const [{ data: order }, { data: payee }, { data: settings }] = await Promise.all([
    db.rpc("shop_order_for_token", { p_token: token }), db.rpc("shop_payee"), db.from("site_settings").select("online_payment,bank_transfer").maybeSingle(),
  ]);
  if (!order) notFound();
  const o = order as ShopOrder, p = (payee ?? {}) as Payee;
  const amount = Number(o.amount).toFixed(2);
  const open = o.status === "awaiting_payment" || o.status === "payment_reported";
  const online = Boolean(settings?.online_payment) && razorpayConfigured();
  const bank = settings?.bank_transfer !== false || !online;
  const payable = o.status === "awaiting_payment";

  let qr: string | null = null;
  if (payable && bank && p.upi_id) {
    const upi = `upi://pay?pa=${encodeURIComponent(p.upi_id)}&pn=${encodeURIComponent(p.account_name || p.name || "KMR")}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Order ${o.order_no}`)}`;
    qr = await QRCode.toString(upi, { type: "svg", margin: 1, width: 200, errorCorrectionLevel: "M", color: { dark: "#0B1C3A", light: "#FFFFFF" } });
  }
  const rows: [string, string | undefined, boolean?][] = [
    ["Account name", p.account_name], ["Account number", p.account_no, true], ["IFSC", p.ifsc, true],
    ["Bank", [p.bank, p.branch].filter(Boolean).join(", ") || undefined], ["Account type", p.account_type],
    ["Amount", inr(o.amount)], ["Remarks", `Order ${o.order_no}`, true],
  ];
  const state: Record<ShopOrder["status"], [string, string, number]> = {
    awaiting_payment: ["Waiting for your payment", "bg-gold-pale text-gold-dark", 1], payment_reported: ["Payment reported — we are confirming it", "bg-gold-pale text-gold-dark", 1],
    paid: ["Paid — thank you! We will dispatch soon", "bg-success/10 text-success", 2], cancelled: ["Cancelled", "bg-danger/10 text-danger", 0],
    failed: ["Payment failed", "bg-danger/10 text-danger", 0], created: ["Created", "bg-sand text-muted", 0],
  };
  const [label, tone, step] = state[o.status];

  return (
    <section className="py-14">
      <div className="wrap max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div><p className="eyebrow mb-2">Your order</p><h1 className="h-display text-4xl text-navy">{o.order_no}</h1></div>
          <span className={`self-start px-4 py-2 text-sm font-semibold ${tone}`}>{label}</span>
        </div>

        {o.status !== "cancelled" && o.status !== "failed" && (
          <ol className="card grid grid-cols-4 p-5 text-center text-[12px] sm:text-sm">
            {STEPS.map((s, i) => (
              <li key={s} className="relative">
                <span className={`mx-auto grid h-9 w-9 place-items-center rounded-full border-2 ${i <= step ? "border-gold bg-gold text-navy-950" : "border-line bg-white text-muted"}`}>{i < step || (i === step && o.status === "paid") ? <IconCheck className="h-4 w-4" /> : i + 1}</span>
                <span className={`mt-2 block ${i <= step ? "font-semibold text-navy" : "text-muted"}`}>{s}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="card grid gap-6 p-7 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="label">Item</p><p className="text-navy">{o.product_name} × {o.quantity}</p></div>
          <div><p className="label">Amount</p><p className="font-display text-2xl font-semibold text-navy">{inr(o.amount)}</p></div>
          <div><p className="label">Deliver to</p><p className="whitespace-pre-line text-navy">{o.customer_name}{"\n"}{o.shipping_address}</p></div>
          <div><p className="label">Placed</p><p className="text-navy">{date(o.created_at)}</p>
            {o.pay_reference && <p className="mt-2 text-muted">Paid by {o.pay_method === "razorpay" ? "online payment" : o.pay_method?.toUpperCase()} · <span className="font-mono">{o.pay_reference}</span>{o.paid_on ? ` · ${date(o.paid_on)}` : ""}</p>}</div>
        </div>

        {o.reject_reason && payable && <div className="border border-danger/30 bg-danger/5 p-4 text-sm text-danger">We could not confirm your earlier payment: {o.reject_reason}. Please check the UTR and send it again, or pay online.</div>}

        {open && online && (
          <div className="pattern-navy grid items-center gap-6 p-8 text-white md:grid-cols-[1fr_320px]">
            <div>
              <p className="eyebrow eyebrow-light mb-3">Fastest — pay online</p>
              <h2 className="font-display text-2xl font-semibold">UPI, cards, net banking or wallets</h2>
              <p className="mt-2 text-sm text-white/70">Secure checkout by Razorpay. Your order is confirmed instantly and the money goes to {p.name || "our"} company account.</p>
            </div>
            <PayOnlineButton token={token} amountLabel={inr(o.amount)} />
          </div>
        )}

        {payable && bank && (
          <div className="card space-y-6 p-7 md:p-8">
            <div><p className="eyebrow mb-2">{online ? "Or pay by bank transfer / UPI" : "How to pay"}</p><h2 className="font-display text-2xl font-semibold text-navy">Pay directly to our bank account</h2></div>
            {!p.account_no && !p.upi_id ? <p className="text-sm text-muted">Our payment details are being updated — please contact us to complete your payment.</p> : (
              <div className="grid items-start gap-8 md:grid-cols-[1fr_230px]">
                {p.account_no && (
                  <div>
                    <p className="label">Bank transfer — NEFT / IMPS / RTGS</p>
                    <table className="w-full text-sm"><tbody>
                      {rows.filter(([, v]) => v).map(([k, v, copy]) => (
                        <tr key={k} className="border-b border-line last:border-0"><td className="py-2.5 pr-4 align-top text-muted">{k}</td><td className="py-2.5"><b className={`text-navy ${copy ? "font-mono" : ""}`}>{v}</b>{copy && <CopyButton value={String(v)} />}</td></tr>))}
                    </tbody></table>
                  </div>
                )}
                {qr && (
                  <div className="border border-line bg-ivory p-4 text-center">
                    <p className="label">Scan with any UPI app</p>
                    <div className="mx-auto h-48 w-48 bg-white p-1 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
                    <p className="mt-2 font-mono text-sm text-navy">{p.upi_id}<CopyButton value={p.upi_id!} /></p>
                    <p className="text-xs text-muted">{inr(o.amount)} and the order number are filled in</p>
                  </div>
                )}
              </div>
            )}
            {p.notes && <p className="whitespace-pre-line text-sm text-muted">{p.notes}</p>}
            <div className="border-t border-line pt-6">
              <h3 className="font-display text-xl font-semibold text-navy">Already paid? Tell us</h3>
              <p className="mb-4 mt-1 text-sm text-muted">Send the UTR / reference so we can match it in our bank statement. Your order is confirmed once the payment reaches our account.</p>
              <ReportPaymentForm token={token} amount={amount} />
            </div>
          </div>
        )}

        {o.status === "payment_reported" && <div className="card flex items-start gap-4 p-6 text-sm"><IconClock className="h-6 w-6 shrink-0 text-gold" /><p className="text-muted">We have your payment details (<span className="font-mono text-navy">{o.pay_reference}</span>) and are matching them with our bank statement — usually within one working day.</p></div>}

        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-muted">
          <span className="flex items-center gap-2"><IconShield className="h-4 w-4 text-gold" />Payments go only to our registered company account</span>
          <span className="flex items-center gap-2"><IconLock className="h-4 w-4 text-gold" />Keep this page’s link to track your order</span>
          <span>Questions? <Link href="/contact" className="link-gold">Contact us</Link> with your order number.</span>
        </div>
      </div>
    </section>
  );
}
