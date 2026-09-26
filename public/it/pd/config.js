/* =====================================================================
   Process Documents – app settings.
   The database and company name come from ../company-config.js
   (the one file that changes per company). Nothing here needs editing.
   ===================================================================== */
(function(){
  var C = window.COMPANY_CONFIG || {};
  window.PD_CONFIG = {
    supabaseUrl:     C.supabaseUrl || "",      // empty = demo mode (saved in this browser only)
    supabaseAnonKey: C.supabaseAnonKey || "",
    poweredBy:       C.poweredBy === undefined ? null : C.poweredBy,

    appName:    "Process Documents",
    balloonUrl: "balloon.html"          // link back to Balloon Inspector
  };
})();
