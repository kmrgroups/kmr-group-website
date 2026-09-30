import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createRazorpayOrder, razorpayConfigured, razorpayKeyId } from "@/lib/razorpay";

// Starts an online payment for a shop order: creates a Razorpay order for the exact amount in the database.
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!/^[a-f0-9]{20,64}$/.test(String(token ?? ""))) return NextResponse.json({ error: "Invalid order link." }, { status: 400 });
    const db = supabaseAdmin();
    const [{ data: settings }, { data: company }] = await Promise.all([
      db.from("site_settings").select("online_payment").maybeSingle(),
      db.from("company_info").select("trade_name,brand_name,logo_url").limit(1).maybeSingle(),
    ]);
    if (!settings?.online_payment || !razorpayConfigured()) return NextResponse.json({ error: "Online payment is not available right now — please pay by bank transfer / UPI." }, { status: 400 });
    const { data: o, error: oe } = await db.rpc("shop_order_for_token", { p_token: token });
    if (oe || !o) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (!["awaiting_payment", "payment_reported"].includes(o.status)) return NextResponse.json({ error: `This order is ${String(o.status).replace("_", " ")}.` }, { status: 400 });
    const paise = Math.round(Number(o.amount) * 100);
    const rzp = await createRazorpayOrder(paise, o.order_no, { order_no: o.order_no, source: "kmr-groups.com shop" });
    const { error } = await db.rpc("shop_gateway_attach", { p_token: token, p_gateway_order: rzp.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({
      key: razorpayKeyId(), order_id: rzp.id, amount: paise, currency: "INR",
      name: company?.trade_name || company?.brand_name || "KMR Group of Companies", image: company?.logo_url || undefined,
      description: `Order ${o.order_no}`, prefill: { name: o.customer_name, email: o.customer_email || undefined, contact: o.customer_phone || undefined },
    });
  } catch (e) {
    console.error("[pay/razorpay]", (e as Error).message);
    return NextResponse.json({ error: "Could not start the online payment. Please try again or pay by bank transfer / UPI." }, { status: 500 });
  }
}
