import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ipOf, rateOk, tooMany } from "@/lib/rate";
import { alertEmail, sendAll } from "@/lib/mail";

// Request for quotation from the Esbee Precision Industries website (nerigroup.in) → console.esbee_rfqs. Server only; honeypot + hourly limit.
export async function POST(req: NextRequest) {
  if (!(await rateOk(`esbee-rfq:${ipOf(req)}`, 8, 3600))) return tooMany();
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (b.website) return NextResponse.json({ ok: true });
  const s = (k: string, max: number) => String(b[k] ?? "").trim().slice(0, max);
  const name = s("name", 100), company = s("company", 150), email = s("email", 150).toLowerCase(), phone = s("phone", 30);
  const part = s("part", 200), process = s("process", 80), material = s("material", 120), qty = s("qty", 80), message = s("message", 2000);
  if (name.length < 2) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  if (!part && !message) return NextResponse.json({ error: "Please tell us the part or what you need." }, { status: 400 });

  const db = supabaseAdmin().schema("console");
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await db.from("esbee_rfqs").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", since);
  if ((count ?? 0) >= 5) return NextResponse.json({ ok: true });
  const { error } = await db.from("esbee_rfqs").insert({
    name, company: company || null, email, phone: phone || null, part_name: part || null, process: process || null, material: material || null, annual_qty: qty || null, message: message || null,
  });
  if (error) {
    console.error("[esbee-rfq]", error.message);
    return NextResponse.json({ error: "Could not send right now. Please call or email us." }, { status: 500 });
  }
  const rows = ([["Name", name], ["Company", company], ["Email", email], ["Phone", phone], ["Part / drawing no.", part], ["Process", process], ["Material", material], ["Annual quantity", qty], ["Message", message]] as [string, string][]).filter(([, v]) => v);
  await sendAll(
    { kind: "esbee_rfq", ref: email, to: await alertEmail(), replyTo: email, subject: `Esbee RFQ — ${name}${company ? ` (${company})` : ""}`, heading: "New request for quotation (nerigroup.in)",
      paragraphs: ["Reply to this email to answer the customer directly."], rows },
    { kind: "esbee_rfq_ack", ref: email, to: email, subject: "Esbee Precision Industries — we have your request", heading: "Thank you for your request for quotation",
      paragraphs: [`Dear ${name},`, "Esbee Precision Industries has received your request and our team will reply within one working day.", "If it is urgent, simply reply to this email."], rows: rows.filter(([k]) => ["Part / drawing no.", "Process", "Annual quantity"].includes(k)) },
  );
  return NextResponse.json({ ok: true });
}
