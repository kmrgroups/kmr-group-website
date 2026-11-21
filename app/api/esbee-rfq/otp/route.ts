import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ipOf, rateOk, tooMany } from "@/lib/rate";
import { sendMail } from "@/lib/mail";
import { OTP_MINUTES, hashCode, newCode, waNumber, waOtpSend } from "@/lib/esbeeOtp";

// Step 1 of the Esbee RFQ form: send a 6-digit code to the customer's e-mail (and WhatsApp when the WhatsApp code template is switched on).
export async function POST(req: NextRequest) {
  if (!(await rateOk(`esbee-otp:${ipOf(req)}`, 10, 3600))) return tooMany();
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (b.website) return NextResponse.json({ error: "Could not verify." }, { status: 400 });
  const email = String(b.email ?? "").trim().toLowerCase().slice(0, 150), phone = String(b.phone ?? "").trim().slice(0, 30);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  if (!(await rateOk(`esbee-otp-mail:${email}`, 4, 3600))) return tooMany();

  const db = supabaseAdmin().schema("console");
  const ec = newCode(), wc = newCode(), wa = waNumber(phone);
  const { data: row, error } = await db.from("esbee_otps").insert({ email, phone: phone || null, email_hash: "x" }).select("id").single();
  if (error || !row) return NextResponse.json({ error: "Could not send the code right now. Please call or email us." }, { status: 500 });
  const id = row.id as string;
  const sent = await sendMail({ kind: "esbee_otp", ref: email, to: email, subject: `Your Esbee verification code: ${ec}`, heading: "Confirm your request",
    paragraphs: [`Your verification code is ${ec}.`, `It is valid for ${OTP_MINUTES} minutes. If you did not request a quotation from Esbee Precision Industries, please ignore this email.`] });
  if (sent !== "sent") return NextResponse.json({ error: "We could not email the code. Please check the address or call us." }, { status: 502 });
  const waSent = wa ? await waOtpSend(wa, wc) : false;
  await db.from("esbee_otps").update({ email_hash: hashCode(id, "e", ec), wa_hash: waSent ? hashCode(id, "w", wc) : null, wa_sent: waSent }).eq("id", id);
  return NextResponse.json({ ok: true, id, whatsapp: waSent });
}
