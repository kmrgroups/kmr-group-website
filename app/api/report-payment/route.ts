import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// The customer tells us they paid (UTR / reference). Staff confirm it in Admin → Orders after checking the bank.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const token = String(b.token ?? "");
    if (!/^[a-f0-9]{20,64}$/.test(token)) return NextResponse.json({ error: "Invalid order link." }, { status: 400 });
    const amount = Number(String(b.amount ?? "").replace(/[, ]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Enter the amount you paid." }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.paidOn ?? ""))) return NextResponse.json({ error: "Enter the date you paid." }, { status: 400 });
    const { error } = await supabaseAdmin().rpc("shop_report_payment", {
      p_token: token, p_method: String(b.method ?? ""), p_reference: String(b.reference ?? "").slice(0, 80),
      p_paid_on: b.paidOn, p_amount: amount, p_payer: String(b.payer ?? "").slice(0, 120) || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message || "Something went wrong." }, { status: 500 });
  }
}
