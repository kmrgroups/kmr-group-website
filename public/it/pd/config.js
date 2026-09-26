/* =====================================================================
   Process Documents – connection settings.  THE ONLY FILE YOU EDIT.
   Use the SAME Supabase project as Balloon Inspector ("Ballooning
   Drawing") so both tools share sign-ins and can pass data to each other.
   Supabase → Project Settings → API → copy "Project URL" and the
   "anon public" / publishable key. NEVER paste the service_role key.
   Leave both empty to run in demo mode (saved in this browser only).
   ===================================================================== */
window.PD_CONFIG = {
  supabaseUrl:     "https://owuxnzonixpwooimaizm.supabase.co",
  supabaseAnonKey: "sb_publishable_Lo4P1cqPXDotnAzArPq-UA_HXyio04I",

  appName:      "Process Documents",
  balloonUrl:   "balloon.html",           // link back to Balloon Inspector
  poweredBy:    { name: "KMR Group of Companies", url: "https://www.kmr-groups.com" }
};
