import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ipOf, rateOk, tooMany } from "@/lib/rate";
import { alertEmail, sendAll } from "@/lib/mail";
import { fileOk } from "@/lib/esbeeOtp";

// Request for quotation from the Esbee Precision Industries website (nerigroup.in) → console.esbee_rfqs. Server only; honeypot + hourly limit.
export async function POST(req: NextRequest) {
  if (!(await rateOk(`esbee-rfq:${ipOf(req)}`, 8, 3600))) return tooMany();
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (b.website) return NextResponse.json({ ok: true });
  const id = String(b.id ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Please verify your email first." }, { status: 400 });
  const s = (k: string, max: number) => String(b[k] ?? "").trim().slice(0, max);
  const name = s("name", 100), company = s("company", 150), email = s("email", 150).toLowerCase(), phone = s("phone", 30);
  const part = s("part", 200), process = s("process", 80), material = s("material", 120), qty = s("qty", 80), message = s("message", 2000);
  if (name.length < 2) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  if (!part && !message) return NextResponse.json({ error: "Please tell us the part or what you need." }, { status: 400 });

  const db = supabaseAdmin().schema("console");
  const { data: o } = await db.from("esbee_otps").select("email,verified_at,used_at,email_ok,wa_ok").eq("id", id).maybeSingle();
  if (!o?.verified_at || o.used_at || !o.email_ok || o.email !== email || Date.now() - new Date(o.verified_at).getTime() > 30 * 60_000)
    return NextResponse.json({ error: "Verification expired. Please verify your email again." }, { status: 400 });
  await db.from("esbee_otps").update({ used_at: new Date().toISOString() }).eq("id", id);
  const files = (Array.isArray(b.files) ? b.files : []).map((x) => String(x)).filter((x) => x.startsWith(`${id}/`) && fileOk(x)).slice(0, 5);
  const links: string[] = [];
  for (const f of files) {
    const { data: u } = await supabaseAdmin().storage.from("esbee-rfq").createSignedUrl(f, 30 * 24 * 3600);
    if (u?.signedUrl) links.push(`${f.split("/").pop()!.replace(/^\d+-/, "")}: ${u.signedUrl}`);
  }
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await db.from("esbee_rfqs").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", since);
  if ((count ?? 0) >= 5) return NextResponse.json({ ok: true });
  const { error } = await db.from("esbee_rfqs").insert({
    name, company: company || null, email, phone: phone || null, part_name: part || null, process: process || null, material: material || null, annual_qty: qty || null, message: message || null,
    attachments: files.length ? files : null, verified_email: true, verified_whatsapp: !!o.wa_ok,
  });
  if (error) {
    console.error("[esbee-rfq]", error.message);
    return NextResponse.json({ error: "Could not send right now. Please call or email us." }, { status: 500 });
  }
  const rows = ([["Name", name], ["Company", company], ["Email", email], ["Phone", phone], ["Part / drawing no.", part], ["Process", process], ["Material", material], ["Annual quantity", qty], ["Message", message], ["Drawings (links valid 30 days)", links.join("\n")], ["Verified by", o.wa_ok ? "Email and WhatsApp code" : "Email code"]] as [string, string][]).filter(([, v]) => v);
  await sendAll(
    { kind: "esbee_rfq", ref: email, to: await alertEmail(), replyTo: email, subject: `Esbee RFQ — ${name}${company ? ` (${company})` : ""}`, heading: "New request for quotation (nerigroup.in)",
      paragraphs: ["Reply to this email to answer the customer directly."], rows },
    { kind: "esbee_rfq_ack", ref: email, to: email, subject: "Esbee Precision Industries — we have your request", heading: "Thank you for your request for quotation",
      paragraphs: [`Dear ${name},`, "Esbee Precision Industries has received your request and our team will reply within one working day.", "If it is urgent, simply reply to this email."], rows: rows.filter(([k]) => ["Part / drawing no.", "Process", "Annual quantity"].includes(k)) },
  );
  return NextResponse.json({ ok: true });
}
