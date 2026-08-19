import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Creates a Razorpay order server-side (required — Razorpay does not allow
// creating orders directly from the browser) and logs it in our own
// `orders` table with status "created" before the customer even pays.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productId, quantity, customerName, customerEmail, customerPhone, shippingAddress } = body;

    if (!productId || !customerName || !customerPhone || !shippingAddress) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // Always re-fetch price/stock from the database — never trust a price
    // sent from the browser.
    const { data: product, error: productError } = await admin
      .from("products")
      .select("*")
      .eq("id", productId)
      .maybeSingle();

    if (productError || !product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    if (!product.is_active) {
      return NextResponse.json({ error: "This product is not currently available." }, { status: 400 });
    }
    const qty = Math.max(1, Number(quantity) || 1);
    if (product.stock_quantity < qty) {
      return NextResponse.json({ error: "Not enough stock available." }, { status: 400 });
    }

    const amountInPaise = Math.round(Number(product.price) * qty * 100);

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID as string,
      key_secret: process.env.RAZORPAY_KEY_SECRET as string
    });

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `kmr_${Date.now()}`
    });

    const { error: insertError } = await admin.from("orders").insert({
      razorpay_order_id: razorpayOrder.id,
      product_id: product.id,
      product_name: product.name,
      quantity: qty,
      amount: amountInPaise / 100,
      currency: "INR",
      customer_name: customerName,
      customer_email: customerEmail || null,
      customer_phone: customerPhone,
      shipping_address: shippingAddress,
      status: "created"
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      orderId: razorpayOrder.id,
      amount: amountInPaise,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      productName: product.name
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Something went wrong." }, { status: 500 });
  }
}
