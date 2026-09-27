import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Pilot / demo requests from www.kmr-groups.com/it (KMR Apps page) → KMR Console "Pilot requests".
// Server-side only: validates the fields, ignores bots (hidden field) and limits repeats per email.
const PRODUCTS = ["hrm", "balloon", "pd"];

export async function POST(req: NextRequest) {
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (b.website) return NextResponse.json({ ok: true });            // honeypot: bots fill hidden fields
  const s = (k: string, max: number) => String(b[k] ?? "").trim().slice(0, max);
  const name = s("name", 100), company = s("company", 150), email = s("email", 150).toLowerCase(), phone = s("phone", 30), country = s("country", 60), message = s("message", 1500);
  const products = Array.isArray(b.products) ? (b.products as unknown[]).map(String).filter((p) => PRODUCTS.includes(p)) : [];
  if (name.length < 2 || company.length < 2) return NextResponse.json({ error: "Please enter your name and company." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });

  const db = supabaseAdmin().schema("console");
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await db.from("leads").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", since);
  if ((count ?? 0) >= 3) return NextResponse.json({ ok: true });   // already received today
  const { error } = await db.from("leads").insert({ name, company, email, phone: phone || null, country: country || null, products, message: message || null, source: "website" });
  if (error) {
    console.error("[pilot-request]", error.message);
    return NextResponse.json({ error: "Could not send right now. Please email info@kmr-groups.com." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
