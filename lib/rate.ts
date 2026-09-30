import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const ipOf = (req: NextRequest | Request) =>
  (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim().slice(0, 60);

/** true = allowed. Uses the shared database limiter (Console › System health shows blocks). Fails open. */
export async function rateOk(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin().rpc("kmr_rate_ok", { p_key: key, p_max: max, p_window_seconds: windowSeconds });
    return error ? true : data !== false;
  } catch { return true; }
}
export const tooMany = () => Response.json({ error: "Too many attempts from your connection. Please try again in a while, or email info@kmr-groups.com." }, { status: 429 });
