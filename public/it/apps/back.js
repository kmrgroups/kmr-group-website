/* KMR Apps — shared helper for every tool page:
   • "← KMR Apps" button back to the customer's own portal (remembered when the portal was opened)
   • in sample-data mode (?demo=1): a banner, and "Use my company's data" opens the subscription screen */
(function () {
  "use strict";
  let portal = null; try { portal = JSON.parse(localStorage.getItem("kmr-portal") || "null"); } catch (e) {}
  const demo = /[?&]demo=1(&|$)/.test(location.search);
  const tool = /balloon/.test(location.pathname) ? "balloon" : /pd\.html/.test(location.pathname) ? "pd" : "";
  const css = document.createElement("style");
  css.textContent = `.kmr-back{position:fixed;left:14px;bottom:14px;z-index:9000;display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border-radius:999px;background:linear-gradient(90deg,#7C3AED,#DB2777);color:#fff;font:700 13.5px "Segoe UI",Arial;text-decoration:none;box-shadow:0 10px 26px -8px rgba(124,58,237,.6)}
  .kmr-demo{position:sticky;top:0;z-index:8999;display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;padding:8px 14px;background:linear-gradient(90deg,#1e1b4b,#4c1d95);color:#fff;font:600 13.5px "Segoe UI",Arial}
  .kmr-demo button{border:0;border-radius:999px;padding:6px 14px;font:700 13px "Segoe UI",Arial;cursor:pointer;color:#1a1305;background:linear-gradient(180deg,#ffe08a,#f3c55a 45%,#c9962b)}
  .kmr-veil{position:fixed;inset:0;z-index:9100;background:rgba(10,7,32,.55);display:grid;place-items:center;padding:20px}
  .kmr-dlg{background:#fff;color:#16233A;border-radius:18px;max-width:430px;padding:26px;box-shadow:0 30px 80px rgba(0,0,0,.35);font:15px/1.5 "Segoe UI",Arial;border-top:4px solid #7C3AED}
  .kmr-dlg h3{margin:0 0 8px;font-size:21px}.kmr-dlg p{color:#5E6B7E;margin:0 0 18px}
  .kmr-dlg a,.kmr-dlg button{display:inline-block;margin-right:8px;border-radius:12px;padding:11px 18px;font:700 14px "Segoe UI",Arial;text-decoration:none;cursor:pointer;border:1px solid #E3E8EF;background:#fff;color:#16233A}
  .kmr-dlg a.go{border:0;color:#fff;background:linear-gradient(90deg,#7C3AED,#DB2777,#F59E0B)}`;
  document.head.append(css);
  document.addEventListener("DOMContentLoaded", function () {
    if (portal && portal.slug) {
      const a = document.createElement("a"); a.className = "kmr-back"; a.href = "/it/app/" + encodeURIComponent(portal.slug);
      a.textContent = "← " + (portal.name ? portal.name + " · " : "") + "KMR Apps"; document.body.append(a);
    }
    if (demo) {
      const b = document.createElement("div"); b.className = "kmr-demo";
      b.innerHTML = '<span>Sample data only — nothing you do here is saved for your company.</span><button type="button">Use my company\'s data</button>';
      b.querySelector("button").onclick = function () {
        const v = document.createElement("div"); v.className = "kmr-veil";
        const buy = "/it/?buy=" + tool + (portal && portal.slug ? "&c=" + encodeURIComponent(portal.slug) : "") + "#pilot";
        v.innerHTML = '<div class="kmr-dlg"><h3>Subscription needed</h3><p>To work with your company\'s real data in this app, take a subscription. Your team gets its own secure workspace.</p><a class="go" href="' + buy + '">Buy subscription</a><button type="button">Keep exploring</button></div>';
        v.onclick = function (e) { if (e.target === v || e.target.tagName === "BUTTON") v.remove(); };
        document.body.append(v);
      };
      document.body.prepend(b);
    }
  });
})();
