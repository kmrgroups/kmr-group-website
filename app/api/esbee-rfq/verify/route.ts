import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ipOf, rateOk, tooMany } from "@/lib/rate";
import { OTP_MINUTES, hashCode, sameHash } from "@/lib/esbeeOtp";

// Step 2: check the e-mail code (and the WhatsApp code when one was sent). Max 5 tries per code.
export async function POST(req: NextRequest) {
  if (!(await rateOk(`esbee-verify:${ipOf(req)}`, 30, 3600))) return tooMany();
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const id = String(b.id ?? ""), ec = String(b.emailCode ?? "").trim(), wc = String(b.waCode ?? "").trim();
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Please request a new code." }, { status: 400 });
  const db = supabaseAdmin().schema("console");
  const { data: o } = await db.from("esbee_otps").select("*").eq("id", id).maybeSingle();
  if (!o || o.used_at || Date.now() - new Date(o.created_at).getTime() > OTP_MINUTES * 60_000 || o.attempts >= 5)
    return NextResponse.json({ error: "This code has expired. Please request a new code." }, { status: 400 });
  await db.from("esbee_otps").update({ attempts: o.attempts + 1 }).eq("id", id);
  const emailOk = sameHash(hashCode(id, "e", ec), o.email_hash);
  const waOk = o.wa_sent ? !!o.wa_hash && sameHash(hashCode(id, "w", wc), o.wa_hash) : false;
  if (!emailOk) return NextResponse.json({ error: "The email code is not correct." }, { status: 400 });
  if (o.wa_sent && !waOk) return NextResponse.json({ error: "The WhatsApp code is not correct." }, { status: 400 });
  await db.from("esbee_otps").update({ verified_at: new Date().toISOString(), email_ok: true, wa_ok: waOk }).eq("id", id);
  return NextResponse.json({ ok: true });
}
