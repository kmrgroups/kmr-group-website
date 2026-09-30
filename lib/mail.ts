import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { companyName, fullAddress } from "@/lib/site";
import type { CompanyInfo } from "@/lib/types";

/**
 * Website emails through Resend (same provider and keys as the Console and HRM): RESEND_API_KEY, EMAIL_FROM,
 * ALERT_EMAIL (KMR's inbox for new orders, enquiries and applications; defaults to the company email).
 * Without the keys nothing is sent; each attempt is logged in Console › System health. Never throws.
 */
export type Mail = { to: string; subject: string; heading: string; paragraphs: string[]; button?: { label: string; url: string }; rows?: [string, string][]; kind: string; ref?: string; replyTo?: string };

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.kmr-groups.com").replace(/\/+$/, "");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const isEmail = (s?: string | null) => !!s && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

let cache: { at: number; c: Partial<CompanyInfo> } | null = null;
async function company(): Promise<Partial<CompanyInfo>> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.c;
  const { data } = await supabaseAdmin().from("company_info").select("*").limit(1).maybeSingle();
  cache = { at: Date.now(), c: (data as Partial<CompanyInfo>) ?? {} };
  return cache.c;
}
export async function alertEmail() { return process.env.ALERT_EMAIL || (await company()).email || "info@kmr-groups.com"; }
export async function careersEmail() { const c = await company(); return process.env.ALERT_EMAIL || c.careers_email || c.email || "info@kmr-groups.com"; }

async function render(m: Mail) {
  const c = await company(), name = companyName(c), addr = fullAddress(c);
  const rows = m.rows?.length ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px">${m.rows.map(([k, v]) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#5e6778;width:40%">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #eee;color:#0b1c3a;font-weight:600;white-space:pre-line">${esc(v)}</td></tr>`).join("")}</table>` : "";
  const btn = m.button ? `<p style="margin:26px 0"><a href="${esc(m.button.url)}" style="background:#c6a15b;color:#0b1c3a;text-decoration:none;font-weight:700;padding:12px 22px;display:inline-block">${esc(m.button.label)}</a></p>` : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:Segoe UI,Arial,sans-serif;color:#101828">
<table role="presentation" width="100%" style="background:#f4f1ea;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:600px;background:#ffffff;border:1px solid #e6dfd1">
<tr><td style="background:#0b1c3a;padding:18px 26px;color:#ffffff;font-size:18px;font-weight:700;font-family:Georgia,serif">${esc(name)}<div style="height:2px;background:#c6a15b;margin-top:12px;width:56px"></div></td></tr>
<tr><td style="padding:26px"><h1 style="margin:0 0 14px;font-size:20px;color:#0b1c3a;font-family:Georgia,serif">${esc(m.heading)}</h1>
${m.paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">${esc(p)}</p>`).join("")}${rows}${btn}</td></tr>
<tr><td style="padding:16px 26px;border-top:1px solid #e6dfd1;font-size:12px;color:#5e6778;line-height:1.6">${esc(name)}${addr ? ` · ${esc(addr)}` : ""}<br>${esc(c.email || "")}${c.phone ? ` · ${esc(c.phone)}` : ""}${c.gstin ? ` · GSTIN ${esc(c.gstin)}` : ""}<br><a href="${SITE_URL}" style="color:#8a6d2f">${SITE_URL.replace(/^https?:\/\//, "")}</a></td></tr>
</table></td></tr></table></body></html>`;
}

async function log(m: Mail, status: "sent" | "skipped" | "failed", error?: string) {
  try {
    await supabaseAdmin().schema("console").from("email_log").insert({ app: "website", kind: m.kind, to_addr: m.to.slice(0, 200), subject: m.subject.slice(0, 200), status, error: error?.slice(0, 500) ?? null, ref: m.ref ?? null });
  } catch { /* ignore */ }
}

export async function sendMail(m: Mail): Promise<"sent" | "skipped" | "failed"> {
  try {
    if (!isEmail(m.to)) return "skipped";
    const key = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM;
    if (!key || !from) { await log(m, "skipped", "RESEND_API_KEY / EMAIL_FROM not set"); return "skipped"; }
    const r = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [m.to], subject: m.subject, html: await render(m), reply_to: m.replyTo || (await company()).email || undefined }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) { await log(m, "failed", `${r.status} ${await r.text().catch(() => "")}`); return "failed"; }
    await log(m, "sent"); return "sent";
  } catch (e) { await log(m, "failed", (e as Error).message); return "failed"; }
}
/** Several emails at once; never throws. */
export const sendAll = (...mails: Mail[]) => Promise.allSettled(mails.map(sendMail));
