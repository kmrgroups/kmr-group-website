import crypto from "crypto";

// Razorpay (server only). Keys come from the website's environment — never from the browser or the database.
// Money settles into the bank account registered in the Razorpay dashboard: it must be KMR's own account.
const cfg = () => ({
  keyId: process.env.RAZORPAY_KEY_ID ?? "",
  secret: process.env.RAZORPAY_KEY_SECRET ?? "",
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  base: (process.env.RAZORPAY_API_BASE || "https://api.razorpay.com/v1").replace(/\/+$/, ""),
});
export const razorpayConfigured = () => { const c = cfg(); return Boolean(c.keyId && c.secret); };
export const razorpayKeyId = () => cfg().keyId;
export const razorpayStatus = () => {
  const c = cfg();
  return { configured: razorpayConfigured(), mode: c.keyId.startsWith("rzp_live_") ? "live" : "test", key: c.keyId ? `${c.keyId.slice(0, 9)}••••${c.keyId.slice(-4)}` : undefined, webhook: Boolean(c.webhookSecret) };
};

async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const c = cfg();
  const r = await fetch(`${c.base}${path}`, {
    method: init?.method ?? "GET", cache: "no-store",
    headers: { Authorization: `Basic ${Buffer.from(`${c.keyId}:${c.secret}`).toString("base64")}`, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.description || `Razorpay error ${r.status}`);
  return j as T;
}

export type RzpOrder = { id: string; amount: number; currency: string; status: string };
export type RzpPayment = { id: string; order_id: string; amount: number; currency: string; status: string; method?: string };

export const createRazorpayOrder = (amountPaise: number, receipt: string, notes: Record<string, string>) =>
  api<RzpOrder>("/orders", { method: "POST", body: { amount: amountPaise, currency: "INR", receipt: receipt.slice(0, 40), notes, payment_capture: 1 } });
export const fetchRazorpayPayment = (id: string) => api<RzpPayment>(`/payments/${encodeURIComponent(id)}`);
export const captureRazorpayPayment = (id: string, amountPaise: number) =>
  api<RzpPayment>(`/payments/${encodeURIComponent(id)}/capture`, { method: "POST", body: { amount: amountPaise, currency: "INR" } });

const safeEqual = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
/** Checkout callback: HMAC-SHA256(order_id|payment_id, key secret). */
export const checkoutSignatureOk = (orderId: string, paymentId: string, signature: string) =>
  safeEqual(crypto.createHmac("sha256", cfg().secret).update(`${orderId}|${paymentId}`).digest("hex"), signature);
/** Webhook: HMAC-SHA256(raw body, webhook secret). */
export const webhookSignatureOk = (raw: string, signature: string) => {
  const s = cfg().webhookSecret;
  return Boolean(s) && safeEqual(crypto.createHmac("sha256", s).update(raw).digest("hex"), signature);
};
