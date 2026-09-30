import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ipOf, rateOk, tooMany } from "@/lib/rate";
import { mailEnquiry } from "@/lib/notify";

// Enquiries from every business section → KMR Console › Enquiries (console.leads). Server only; honeypot + daily limit.
const BUSINESSES = ["software", "shop", "training", "import_export", "trading", "distribution", "general"];
const SOFTWARE = ["hrm", "balloon", "pd", "capacity"];

export async function POST(req: NextRequest) {
  if (!(await rateOk(`enquiry:${ipOf(req)}`, 10, 3600))) return tooMany();
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (b.website) return NextResponse.json({ ok: true });
  const s = (k: string, max: number) => String(b[k] ?? "").trim().slice(0, max);
  const name = s("name", 100), company = s("company", 150), email = s("email", 150).toLowerCase(), phone = s("phone", 30), country = s("country", 60);
  const message = s("message", 1500), quantity = s("quantity", 60), productName = s("productName", 200), productCode = s("productCode", 40);
  const business = BUSINESSES.includes(String(b.business)) ? String(b.business) : "general";
  if (name.length < 2) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  if (!message && !productName) return NextResponse.json({ error: "Please tell us what you need." }, { status: 400 });

  const db = supabaseAdmin().schema("console");
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await db.from("leads").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", since);
  if ((count ?? 0) >= 5) return NextResponse.json({ ok: true });
  const { error } = await db.from("leads").insert({
    name, company: company.length >= 2 ? company : null, email, phone: phone || null, country: country || null, message: message || null,
    business, product_name: productName || null, quantity: quantity || null, products: SOFTWARE.includes(productCode) ? [productCode] : [],
    source: "website",
  });
  if (error) {
    console.error("[enquiry]", error.message);
    return NextResponse.json({ error: "Could not send right now. Please email info@kmr-groups.com." }, { status: 500 });
  }
  await mailEnquiry({ name, email, phone, company, country, business, about: productName, quantity, message });
  return NextResponse.json({ ok: true });
}
