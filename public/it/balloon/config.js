/* =====================================================================
   Balloon Inspector – app settings.
   The database and company name come from ../company-config.js
   (the one file that changes per company). Nothing here needs editing.
   ===================================================================== */
(function(){
  var C = window.COMPANY_CONFIG || {};
  window.BI_CONFIG = {
    supabaseUrl:     C.supabaseUrl || "",      // empty = offline mode (nothing saved)
    supabaseAnonKey: C.supabaseAnonKey || "",
    poweredBy:       C.poweredBy === undefined ? null : C.poweredBy,

    appName:    "Balloon Inspector",   // shown in the header and browser tab
    engineBase: "balloon/engines/",     // where the DWG/STEP/OCR engine files live
    aiFunction: "bi-ai-read",           // Supabase Edge Function that reads photos/scans with AI ("" = off)
    pdUrl:      "pd.html"               // Process Documents page for "Send to Process Documents" ("" = hide the button)
  };
})();
