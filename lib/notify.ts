import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { alertEmail, careersEmail, sendAll, SITE_URL } from "@/lib/mail";
import { inr } from "@/lib/site";

/** Website emails: customer + KMR. Best-effort — a failed email never undoes the order, enquiry or application. */
const CONSOLE = `${SITE_URL}/it/console`;
type Order = { order_no: string; amount: number; name: string; email: string | null; phone: string | null; product?: string; qty?: number };

async function order(token: string): Promise<Order | null> {
  const { data } = await supabaseAdmin().from("orders").select("order_no,amount,customer_name,customer_email,customer_phone,product_name,quantity").eq("order_token", token).maybeSingle();
  return data ? { order_no: data.order_no, amount: Number(data.amount), name: data.customer_name, email: data.customer_email, phone: data.customer_phone, product: data.product_name, qty: data.quantity } : null;
}
const orderRows = (o: Order): [string, string][] => [["Order", o.order_no], ...(o.product ? [["Product", `${o.product}${o.qty ? ` × ${o.qty}` : ""}`] as [string, string]] : []), ["Amount", inr(o.amount)]];

export async function mailOrderPlaced(token: string) {
  const o = await order(token); if (!o) return;
  const url = `${SITE_URL}/order/${token}`;
  await sendAll(
    { kind: "order_placed", ref: o.order_no, to: o.email ?? "", subject: `Order ${o.order_no} received — how to pay`, heading: "Thank you for your order",
      paragraphs: [`Dear ${o.name},`, "We have your order. Open your order page to pay online or by bank transfer / UPI. Keep this email — the link is your order page."],
      rows: orderRows(o), button: { label: "Pay and track your order", url } },
    { kind: "order_new", ref: o.order_no, to: await alertEmail(), subject: `New shop order ${o.order_no} — ${inr(o.amount)}`, heading: "New shop order",
      paragraphs: ["A customer placed an order on the website. It is waiting for payment."], rows: [...orderRows(o), ["Customer", o.name], ["Phone", o.phone || "—"], ["Email", o.email || "—"]],
      button: { label: "Open Orders in the Console", url: `${CONSOLE}/cms/orders` } },
  );
}

export async function mailOrderPaymentReported(token: string, amount: number, reference: string) {
  const o = await order(token); if (!o) return;
  await sendAll({ kind: "order_payment_reported", ref: o.order_no, to: await alertEmail(), subject: `Payment reported — order ${o.order_no} (${inr(amount)})`, heading: "A customer reported a payment",
    paragraphs: ["Check the bank statement, then confirm or reject it in Website CMS › Orders & payments."],
    rows: [...orderRows(o), ["Reported amount", inr(amount)], ["Reference (UTR)", reference], ["Customer", o.name]], button: { label: "Open Orders in the Console", url: `${CONSOLE}/cms/orders` } });
}

export async function mailOrderPaidOnline(gatewayOrder: string) {
  const { data } = await supabaseAdmin().from("orders").select("order_token").eq("razorpay_order_id", gatewayOrder).maybeSingle();
  if (!data?.order_token) return;
  const o = await order(data.order_token); if (!o) return;
  await sendAll(
    { kind: "order_paid", ref: o.order_no, to: o.email ?? "", subject: `Payment received — order ${o.order_no}`, heading: "Thank you — your order is confirmed",
      paragraphs: [`Dear ${o.name},`, "We have received your online payment. We will be in touch about delivery."], rows: orderRows(o),
      button: { label: "View your order", url: `${SITE_URL}/order/${data.order_token}` } },
    { kind: "order_paid_alert", ref: o.order_no, to: await alertEmail(), subject: `Paid online — order ${o.order_no} (${inr(o.amount)})`, heading: "An order was paid online",
      paragraphs: ["Razorpay confirmed the payment. Please arrange delivery."], rows: [...orderRows(o), ["Customer", o.name], ["Phone", o.phone || "—"]],
      button: { label: "Open Orders in the Console", url: `${CONSOLE}/cms/orders` } },
  );
}

export async function mailEnquiry(e: { name: string; email: string; phone?: string; company?: string; country?: string; business: string; about?: string; quantity?: string; message?: string; pilot?: boolean }) {
  const rows: [string, string][] = ([["Name", e.name], ["Company", e.company], ["Email", e.email], ["Phone", e.phone], ["Country", e.country], ["Business", e.business.replace("_", " / ")],
    ["About", e.about], ["Quantity", e.quantity], ["Message", e.message]] as [string, string | undefined][]).filter(([, v]) => v) as [string, string][];
  await sendAll(
    { kind: e.pilot ? "pilot_request" : "enquiry", ref: e.email, to: await alertEmail(), replyTo: e.email,
      subject: `${e.pilot ? "Pilot request" : "New enquiry"} — ${e.name}${e.company ? ` (${e.company})` : ""}`, heading: e.pilot ? "New pilot / demo request" : "New website enquiry",
      paragraphs: ["Reply to this email to answer the customer directly. It is also in Console › Enquiries."], rows, button: { label: "Open Enquiries", url: `${CONSOLE}/leads` } },
    { kind: "enquiry_ack", ref: e.email, to: e.email, subject: "We have your enquiry", heading: "Thank you for contacting us",
      paragraphs: [`Dear ${e.name},`, "We have received your enquiry and will reply within one working day.", "If it is urgent, simply reply to this email."], rows: rows.filter(([k]) => ["About", "Quantity", "Message"].includes(k)) },
  );
}

export async function mailApplication(a: { name: string; email: string; phone: string; job: string; experience?: string | null; location?: string | null }) {
  await sendAll(
    { kind: "job_application", ref: a.job, to: await careersEmail(), replyTo: a.email, subject: `Application: ${a.job} — ${a.name}`, heading: "New job application",
      paragraphs: ["The résumé is in Website CMS › Applications."], rows: [["Opening", a.job], ["Name", a.name], ["Email", a.email], ["Phone", a.phone], ["Experience", a.experience || "—"], ["Location", a.location || "—"]],
      button: { label: "Open Applications", url: `${CONSOLE}/cms/applications` } },
    { kind: "application_ack", ref: a.job, to: a.email, subject: `We received your application — ${a.job}`, heading: "Thank you for applying",
      paragraphs: [`Dear ${a.name},`, `We have received your application for “${a.job}”. Our team reviews every application; if your profile matches, we will contact you.`] },
  );
}
