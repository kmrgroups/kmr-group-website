import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ipOf, rateOk, tooMany } from "@/lib/rate";
import { mailOrderPlaced } from "@/lib/notify";

// Places a shop order. The customer then pays by bank transfer / UPI into KMR's account using the details on
// the order's own page, and reports the UTR there. Price and stock always come from the database.
export async function POST(req: NextRequest) {
  if (!(await rateOk(`order:${ipOf(req)}`, 10, 3600))) return tooMany();
  try {
    const { productId, quantity, customerName, customerEmail, customerPhone, shippingAddress } = await req.json();
    if (!productId || !customerName || !customerPhone || !shippingAddress) {
      return NextResponse.json({ error: "Please fill in your name, phone number and shipping address." }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin().rpc("shop_place_order", {
      p_product: productId, p_qty: Number(quantity) || 1, p_name: String(customerName), p_email: String(customerEmail || ""),
      p_phone: String(customerPhone), p_address: String(shippingAddress),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await mailOrderPlaced(data.token);
    return NextResponse.json({ orderNo: data.order_no, token: data.token });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message || "Something went wrong." }, { status: 500 });
  }
}
