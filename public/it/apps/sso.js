/* KMR single sign-in for the tools. There is no separate tool login: the customer signs in once on their
   KMR Apps page (www.kmr-groups.com/it/app/<customer>) and every tool uses that same session.
   Loaded first on every tool page. */
(function () {
  "use strict";
  var q = location.search;
  var demo = /[?&]demo=1(&|$)/.test(q), direct = /[?&]direct=1(&|$)/.test(q), fromPortal = /[?&]kmr=1(&|$)/.test(q);
  var tool = /balloon/.test(location.pathname) ? "balloon" : /pd\.html/.test(location.pathname) ? "pd" : /capacity/.test(location.pathname) ? "capacity" : "tool";
  function portal() { var p = null; try { p = JSON.parse(localStorage.getItem("kmr-portal") || "null"); } catch (e) {} return p; }
  function portalUrl() { var p = portal(); return (p && p.slug ? "/it/app/" + encodeURIComponent(p.slug) : "/it/apps.html") + "?open=" + tool; }
  function hasSession() {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (/^sb-.+-auth-token$/.test(k)) { try { var v = JSON.parse(localStorage.getItem(k)); if (v && (v.refresh_token || (v.currentSession && v.currentSession.refresh_token))) return true; } catch (e) {} }
    }
    return false;
  }
  window.KMR_SSO = {
    active: !demo && !direct,
    /** Called instead of the tool's own login screen */
    toPortal: function (msg) {
      if (fromPortal) {                       // came from the portal and still not signed in: explain, don't bounce back
        var p = portal();
        var v = document.createElement("div");
        v.setAttribute("style", "position:fixed;inset:0;z-index:9500;display:grid;place-items:center;background:rgba(10,7,32,.6);padding:20px;font:15px/1.5 Segoe UI,Arial,sans-serif");
        v.innerHTML = '<div style="background:#fff;border-radius:18px;max-width:430px;padding:26px;border-top:4px solid #7C3AED;color:#16233A"><h3 style="margin:0 0 8px;font-size:21px">Can\'t open this app</h3><p style="color:#5E6B7E;margin:0 0 18px">' +
          (msg ? String(msg).replace(/[<>&]/g, "") + " " : "") + 'Your login has not been added to this app yet. Please ask your company\'s administrator.</p><a href="' +
          (p && p.slug ? "/it/app/" + encodeURIComponent(p.slug) : "/it/apps.html") + '" style="display:inline-block;border-radius:12px;padding:11px 18px;font-weight:700;color:#fff;text-decoration:none;background:linear-gradient(90deg,#7C3AED,#DB2777)">← Back to KMR Apps</a></div>';
        (document.body || document.documentElement).append(v);
        return;
      }
      location.replace(portalUrl());
    },
  };
  // Not signed in at all → straight to the KMR Apps sign-in (then back to this tool)
  if (window.KMR_SSO.active && !hasSession() && !fromPortal) location.replace(portalUrl());
})();
