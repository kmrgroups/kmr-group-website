import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ipOf, rateOk, tooMany } from "@/lib/rate";
import { mailApplication } from "@/lib/notify";

// Job applications → public.job_applications (read only in KMR Console); résumé → private bucket "kmr-careers".
const TYPES: Record<string, string> = {
  "application/pdf": "pdf", "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export async function POST(req: NextRequest) {
  if (!(await rateOk(`apply:${ipOf(req)}`, 6, 3600))) return tooMany();
  let fd: FormData;
  try { fd = await req.formData(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (String(fd.get("website") ?? "")) return NextResponse.json({ ok: true });                // honeypot
  const s = (k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);
  const name = s("name", 120), email = s("email", 160).toLowerCase(), phone = s("phone", 20);
  if (name.length < 2) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  if (phone.replace(/\D/g, "").length < 8) return NextResponse.json({ error: "Please enter your phone number." }, { status: 400 });
  const file = fd.get("resume");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Please attach your résumé." }, { status: 400 });
  const ext = TYPES[file.type] ?? (/\.(pdf|docx?)$/i.exec(file.name)?.[1]?.toLowerCase());
  if (!ext) return NextResponse.json({ error: "The résumé must be a PDF or Word file." }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "The résumé must be under 4 MB." }, { status: 400 });

  const db = supabaseAdmin();
  const jobIdRaw = s("job_id", 40);
  let jobId: string | null = null, jobTitle = "General application";
  if (/^[0-9a-f-]{36}$/.test(jobIdRaw)) {
    const { data: job } = await db.from("job_openings").select("id,title,is_active,closes_on").eq("id", jobIdRaw).maybeSingle();
    if (!job || !job.is_active || (job.closes_on && job.closes_on < new Date().toISOString().slice(0, 10))) return NextResponse.json({ error: "This opening is closed." }, { status: 400 });
    jobId = job.id; jobTitle = job.title;
  }
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await db.from("job_applications").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", since);
  if ((count ?? 0) >= 3) return NextResponse.json({ ok: true });

  const path = `${new Date().toISOString().slice(0, 7)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await db.storage.from("kmr-careers").upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (upErr) { console.error("[careers] upload", upErr.message); return NextResponse.json({ error: "Could not upload the résumé. Please try again." }, { status: 500 }); }
  const linkedin = s("linkedin_url", 200);
  const { error } = await db.from("job_applications").insert({
    job_id: jobId, job_title: jobTitle, name, email, phone, location: s("location", 80) || null, experience: s("experience", 40) || null,
    current_company: s("current_company", 120) || null, linkedin_url: linkedin ? (/^https?:\/\//.test(linkedin) ? linkedin : `https://${linkedin}`) : null,
    resume_path: path, cover_note: s("cover_note", 2000) || null,
  });
  if (error) { console.error("[careers]", error.message); return NextResponse.json({ error: "Could not send your application. Please try again." }, { status: 500 }); }
  await mailApplication({ name, email, phone, job: jobTitle, experience: s("experience", 40), location: s("location", 80) });
  return NextResponse.json({ ok: true });
}
