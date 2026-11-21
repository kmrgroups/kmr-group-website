import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** One-time codes for the Esbee RFQ form: 6 digits, stored only as an HMAC hash, valid 10 minutes. */
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
const secret = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "esbee";
export const hashCode = (id: string, kind: "e" | "w", code: string) => createHmac("sha256", secret()).update(`${id}:${kind}:${code}`).digest("hex");
export const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export const OTP_MINUTES = 10;

/** Indian mobile → 91XXXXXXXXXX, else null. */
export function waNumber(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(d)) return `91${d}`;
  if (/^91[6-9]\d{9}$/.test(d)) return d;
  if (/^0[6-9]\d{9}$/.test(d)) return `91${d.slice(1)}`;
  return null;
}

/** WhatsApp authentication template (env ESBEE_WA_OTP_TEMPLATE, 1 body variable + copy-code button). Without it WhatsApp codes are not offered. */
export async function waOtpSend(to: string, code: string): Promise<boolean> {
  const tpl = process.env.ESBEE_WA_OTP_TEMPLATE;
  if (!tpl) return false;
  try {
    const { data } = await supabaseAdmin().schema("public").rpc("kmr_wa_creds");
    const d = (data ?? {}) as { token?: string; phone_id?: string };
    const token = process.env.WA_TOKEN || d.token, phone = process.env.WA_PHONE_ID || d.phone_id;
    if (!token || !phone) return false;
    const r = await fetch(`https://graph.facebook.com/v21.0/${phone}/messages`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template: { name: tpl, language: { code: "en" }, components: [
        { type: "body", parameters: [{ type: "text", text: code }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] }] } }),
    });
    return r.ok;
  } catch { return false; }
}

const BLOCKED = /\.(exe|bat|cmd|com|scr|msi|dll|js|jse|vbs|vbe|wsf|ps1|sh|jar|apk|html?|svg|php|app|dmg|lnk|reg)$/i;
export const fileOk = (name: string) => !BLOCKED.test(name);
export const safeName = (name: string) => name.replace(/[^\w.\- ()]/g, "_").replace(/\s+/g, "_").slice(-90) || "file";
