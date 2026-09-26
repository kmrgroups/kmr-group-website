/* =====================================================================
   COMPANY SETTINGS  –  the ONLY file that is different for each company.
   ---------------------------------------------------------------------
   Every company gets the same tool files. Only this file changes:
   put in that company's own Supabase project (database) and name.
   Supabase → Project Settings → API (or API Keys):
     supabaseUrl      = "Project URL"
     supabaseAnonKey  = the "anon public" / "publishable" key
   NEVER paste the "service_role" / "secret" key here.
   ===================================================================== */
window.COMPANY_CONFIG = {
  supabaseUrl:     "https://dehlcusptkzfhqvpfyjh.supabase.co",
  supabaseAnonKey: "sb_publishable_ukWZLiTOXfUZsNAyn5BM7Q_YjSFcUus",

  suiteTitle: "Quality Suite",            // heading on the tools home page (index.html)
  poweredBy:  { name: "KMR Group of Companies", url: "https://www.kmr-groups.com" }   // footer text; set to null to hide
};
