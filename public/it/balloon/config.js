/* =====================================================================
   Balloon Inspector – connection settings.  THE ONLY FILE YOU EDIT.
   ---------------------------------------------------------------------
   1. Supabase → your project → Project Settings → API
   2. Copy "Project URL" into supabaseUrl
   3. Copy the "anon public" key into supabaseAnonKey
      (the anon key is meant to be public – your data is protected by the
       row-level-security rules in supabase/schema.sql. NEVER paste the
       "service_role" key here.)
   Leave both empty to run in offline mode (nothing is saved).
   ===================================================================== */
window.BI_CONFIG = {
  supabaseUrl:     "https://dehlcusptkzfhqvpfyjh.supabase.co",   // e.g. "https://abcdefghijkl.supabase.co"
  supabaseAnonKey: "sb_publishable_ukWZLiTOXfUZsNAyn5BM7Q_YjSFcUus",   // e.g. "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

  appName:    "Balloon Inspector",   // shown in the header and browser tab
  engineBase: "balloon/engines/",     // where the DWG/STEP/OCR engine files live
  aiFunction: "bi-ai-read",           // Supabase Edge Function that reads photos/scans with AI ("" = off)
  pdUrl:      "pd.html"               // Process Documents page for "Send to Process Documents" ("" = hide the button)
};
