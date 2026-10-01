/* =====================================================================
   Balloon Inspector – app settings.
   The database and company name come from ../company-config.js
   (the one file that changes per company). Nothing here needs editing.
   ===================================================================== */
(function(){
  var C = window.COMPANY_CONFIG || {};
  // ?demo=1 (from the KMR Apps portal, for apps not in the customer's plan): sample data only, nothing saved online
  var DEMO = /[?&]demo=1(&|$)/.test(location.search);
  window.BI_CONFIG = {
    supabaseUrl:     DEMO ? "" : (C.supabaseUrl || ""),      // empty = offline mode (nothing saved)
    supabaseAnonKey: DEMO ? "" : (C.supabaseAnonKey || ""),
    poweredBy:       C.poweredBy === undefined ? null : C.poweredBy,

    appName:    "Balloon Inspector",   // shown in the header and browser tab
    engineBase: "balloon/engines/",     // where the DWG/STEP/OCR engine files live
    aiFunction: "",                     // off: drawings are read by the free smart reader in the browser (no paid AI service)
    pdUrl:      "pd.html"               // Process Documents page for "Send to Process Documents" ("" = hide the button)
  };
})();
