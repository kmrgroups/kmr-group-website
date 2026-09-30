import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { captureRazorpayPayment, checkoutSignatureOk, fetchRazorpayPayment, razorpayConfigured } from "@/lib/razorpay";

// After checkout: the signature proves the response came from Razorpay; the payment is then fetched from Razorpay
// itself (order, amount, status) before the order is marked paid. The browser's word alone is never trusted.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const orderId = String(b.razorpay_order_id ?? ""), paymentId = String(b.razorpay_payment_id ?? ""), sig = String(b.razorpay_signature ?? "");
    if (!razorpayConfigured() || !orderId || !paymentId || !sig) return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
    if (!checkoutSignatureOk(orderId, paymentId, sig)) return NextResponse.json({ error: "Payment could not be verified." }, { status: 400 });
    let pay = await fetchRazorpayPayment(paymentId);
    if (pay.order_id !== orderId || pay.currency !== "INR") return NextResponse.json({ error: "Payment does not belong to this order." }, { status: 400 });
    if (pay.status === "authorized") pay = await captureRazorpayPayment(paymentId, pay.amount);
    if (pay.status !== "captured") return NextResponse.json({ error: `Payment is ${pay.status}. If money was deducted, it will be refunded by your bank automatically.` }, { status: 400 });
    const { data, error } = await supabaseAdmin().rpc("shop_gateway_paid", { p_gateway_order: orderId, p_payment: paymentId, p_amount_paise: pay.amount });
    if (error) { console.error("[pay/verify]", error.message); return NextResponse.json({ error: "Payment received but the order could not be updated — we will confirm it manually." }, { status: 500 }); }
    return NextResponse.json({ ok: true, result: data });
  } catch (e) {
    console.error("[pay/verify]", (e as Error).message);
    return NextResponse.json({ error: "Could not verify the payment. If money was deducted, we will confirm your order shortly." }, { status: 500 });
  }
}
