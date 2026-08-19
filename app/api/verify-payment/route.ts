import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Verifies the payment signature Razorpay sends back after checkout.
// This is the step that actually confirms money was received — never
// mark an order "paid" just because the browser says checkout succeeded.
export async function POST(req: NextRequest) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET as string)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isValid = expectedSignature === razorpay_signature;

    const admin = supabaseAdmin();

    if (!isValid) {
      await admin
        .from("orders")
        .update({ status: "failed" })
        .eq("razorpay_order_id", razorpay_order_id);
      return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
    }

    // Fetch the order so we know which product/quantity to decrement stock for.
    const { data: order } = await admin
      .from("orders")
      .select("*")
      .eq("razorpay_order_id", razorpay_order_id)
      .maybeSingle();

    await admin
      .from("orders")
      .update({ status: "paid", razorpay_payment_id })
      .eq("razorpay_order_id", razorpay_order_id);

    if (order?.product_id) {
      const { data: product } = await admin
        .from("products")
        .select("stock_quantity")
        .eq("id", order.product_id)
        .maybeSingle();
      if (product) {
        const newStock = Math.max(0, product.stock_quantity - order.quantity);
        await admin.from("products").update({ stock_quantity: newStock }).eq("id", order.product_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Something went wrong." }, { status: 500 });
  }
}
