/* =====================================================================
   Process Documents – app settings.
   The database and company name come from ../company-config.js
   (the one file that changes per company). Nothing here needs editing.
   ===================================================================== */
(function(){
  var C = window.COMPANY_CONFIG || {};
  // ?demo=1 (from the KMR Apps portal, for apps not in the customer's plan): sample data only, nothing saved online
  var DEMO = /[?&]demo=1(&|$)/.test(location.search);
  window.PD_CONFIG = {
    supabaseUrl:     DEMO ? "" : (C.supabaseUrl || ""),      // empty = demo mode (saved in this browser only)
    supabaseAnonKey: DEMO ? "" : (C.supabaseAnonKey || ""),
    poweredBy:       C.poweredBy === undefined ? null : C.poweredBy,

    appName:    "Process Documents",
    balloonUrl: "balloon.html"          // link back to Balloon Inspector
  };
})();
