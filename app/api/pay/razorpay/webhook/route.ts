import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { webhookSignatureOk } from "@/lib/razorpay";

// Razorpay › Webhooks (events payment.captured and order.paid): marks the shop order paid even if the customer closed the page.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!webhookSignatureOk(raw, req.headers.get("x-razorpay-signature") ?? "")) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  let ev: { event?: string; payload?: { payment?: { entity?: { id: string; order_id: string; amount: number; currency: string; status: string } } } };
  try { ev = JSON.parse(raw); } catch { return NextResponse.json({ error: "Bad payload." }, { status: 400 }); }
  const p = ev.payload?.payment?.entity;
  if (!["payment.captured", "order.paid"].includes(ev.event ?? "") || !p?.order_id || p.status !== "captured" || p.currency !== "INR") return NextResponse.json({ ok: true, ignored: true });
  const { data, error } = await supabaseAdmin().rpc("shop_gateway_paid", { p_gateway_order: p.order_id, p_payment: p.id, p_amount_paise: p.amount });
  if (error) {
    if (/Order not found/.test(error.message)) return NextResponse.json({ ok: true, ignored: "not a shop order" });   // other Razorpay payments on the same account
    console.error("[pay/webhook]", error.message);
    return NextResponse.json({ error: "Could not update the order." }, { status: 500 });                                 // Razorpay retries
  }
  return NextResponse.json({ ok: true, result: data });
}
