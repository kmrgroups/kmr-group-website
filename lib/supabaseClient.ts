import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Keep the module importable when a preview is missing its project variables.
 * Supabase data requests will return empty fallbacks until the variables are
 * configured, rather than crashing the entire app during module evaluation.
 */
const fallbackSupabaseUrl = "https://supabase-preview.invalid";
const fallbackSupabaseKey = "preview-not-configured";

export const supabase = createClient(
  supabaseUrl || fallbackSupabaseUrl,
  supabaseAnonKey || fallbackSupabaseKey
);

// Storage bucket used for all uploaded media (banner, leadership photos,
// gallery photos/videos, product images). Created by supabase/schema.sql.
export const MEDIA_BUCKET = "media";

export function publicUrlFor(path: string) {
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
