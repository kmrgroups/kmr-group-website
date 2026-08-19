import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // This will show clearly in the browser console instead of a silent failure
  console.warn(
    "Supabase env vars are missing. Copy .env.local.example to .env.local and fill in your project values."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Storage bucket used for all uploaded media (banner, leadership photos,
// gallery photos/videos, product images). Created by supabase/schema.sql.
export const MEDIA_BUCKET = "media";

export function publicUrlFor(path: string) {
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
