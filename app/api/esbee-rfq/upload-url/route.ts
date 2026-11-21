import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ipOf, rateOk, tooMany } from "@/lib/rate";
import { fileOk, safeName } from "@/lib/esbeeOtp";

export const MAX_FILES = 5, MAX_BYTES = 25 * 1024 * 1024;

// Step 3: after the codes are verified, hand out a one-file upload link into the private esbee-rfq bucket (drawings go straight to storage).
export async function POST(req: NextRequest) {
  if (!(await rateOk(`esbee-upl:${ipOf(req)}`, 40, 3600))) return tooMany();
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const id = String(b.id ?? ""), name = String(b.name ?? ""), size = Number(b.size ?? 0);
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Please verify again." }, { status: 400 });
  if (!name || !fileOk(name)) return NextResponse.json({ error: "This file type is not accepted. Please send drawings as PDF, DWG, DXF, STEP, IGES, image, Office or ZIP files." }, { status: 400 });
  if (!(size > 0) || size > MAX_BYTES) return NextResponse.json({ error: "Each file can be up to 25 MB." }, { status: 400 });
  const db = supabaseAdmin().schema("console");
  const { data: o } = await db.from("esbee_otps").select("verified_at,used_at").eq("id", id).maybeSingle();
  if (!o?.verified_at || o.used_at || Date.now() - new Date(o.verified_at).getTime() > 30 * 60_000) return NextResponse.json({ error: "Please verify again." }, { status: 400 });
  const path = `${id}/${Date.now()}-${safeName(name)}`;
  const { data, error } = await supabaseAdmin().storage.from("esbee-rfq").createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: "Could not prepare the upload." }, { status: 500 });
  return NextResponse.json({ ok: true, path, token: data.token });
}
