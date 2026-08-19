import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY client. Uses the Supabase service_role key, which bypasses
// Row Level Security — this is what lets our API routes write orders
// even though only authenticated admins can normally write to that table.
// NEVER import this file into a "use client" component; the service_role
// key must never reach the browser.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in your server environment."
    );
  }
  return createClient(url, serviceKey);
}
