import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ipOf, rateOk, tooMany } from "@/lib/rate";

// PPAP › Generate from drawings: reads one engineering drawing (a JPEG of the sheet) with Claude and returns the
// part details, characteristics and operation data as JSON. Signed-in KMR users only; the API key stays on the server.
export const maxDuration = 120;

const PROMPT = (kind: string, opHint: string) => `You are a quality engineer reading an engineering drawing for a PPAP (Production Part Approval Process) submission.
Drawing type: ${kind === "process" ? "PROCESS / OPERATION drawing (one manufacturing operation)" : "CUSTOMER part drawing"}.${opHint ? " File name hint: " + opHint : ""}
Return ONLY one JSON object, no other text, in this shape:
{"header":{"partNo":"customer part number","supplierPartNo":"supplier's own part number if shown","partName":"","drawingNo":"","rev":"revision / date","customer":"","material":"","weight":""},
 "operation":{"opNo":"number only","opName":"short name e.g. Sawing, Turning, Drilling, Final inspection","machine":"machine / equipment","fixture":"work holding / fixture if shown"},
 "characteristics":[{"desc":"what is measured, e.g. Overall length, Outer diameter, Hole diameter, Surface finish","kind":"dia|lin|ra|thr|ang|gdt|other","nom":number or null,"tolUpper":number or null,"tolLower":number or null,"text":"as written on the drawing","cls":"KC|SC|CC|-","method":"suitable inspection instrument","op":"operation number that produces it, if known"}]}
Rules: use null or "" when something is not on the drawing - never guess. tolUpper / tolLower are signed offsets from nominal (e.g. 37 +-0.3 gives 0.3 and -0.3; 12.5 +0.1/-0 gives 0.1 and 0). Include every toleranced dimension, diameter, thread, surface finish and GD&T callout once; skip reference dimensions in brackets and general notes. For a customer drawing, leave "operation" values empty. For a process drawing fill "operation" and list only the dimensions that operation produces or checks.`;

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { data: u } = await supabaseAdmin().auth.getUser(token);
  if (!u?.user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!(await rateOk(`ppapread:${u.user.id}`, 40, 3600))) return tooMany();
  let b: { kind?: string; data?: string; hint?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!b.data || b.data.length > 6_000_000) return NextResponse.json({ error: "Drawing image is missing or too large." }, { status: 400 });
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.PPAP_READ_MODEL || "claude-sonnet-5-5", max_tokens: 4096,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b.data } },
        { type: "text", text: PROMPT(b.kind === "process" ? "process" : "customer", String(b.hint || "").slice(0, 120)) }] }],
    }),
  });
  if (!r.ok) return NextResponse.json({ error: "The AI reader is busy. Please try again." }, { status: 502 });
  const j = await r.json();
  const text: string = (j.content || []).map((c: { text?: string }) => c.text || "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return NextResponse.json({ error: "The AI reader returned no result." }, { status: 502 });
  try { return NextResponse.json({ ok: true, result: JSON.parse(m[0]) }); }
  catch { return NextResponse.json({ error: "The AI reader returned an unreadable result." }, { status: 502 }); }
}
