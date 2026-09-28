/* KMR Apps — shared helper for every tool page:
   • "← KMR Apps" button back to the customer's own portal (remembered when the portal was opened)
   • in sample-data mode (?demo=1): a banner, and "Use my company's data" opens the subscription screen */
(function () {
  "use strict";
  let portal = null; try { portal = JSON.parse(localStorage.getItem("kmr-portal") || "null"); } catch (e) {}
  const demo = /[?&]demo=1(&|$)/.test(location.search);
  const tool = /balloon/.test(location.pathname) ? "balloon" : /pd\.html/.test(location.pathname) ? "pd" : /capacity/.test(location.pathname) ? "capacity" : "";
  const css = document.createElement("style");
  css.textContent = `body{padding-bottom:30px}
  .kmr-foot{position:fixed;left:0;right:0;bottom:0;z-index:8998;height:30px;display:flex;align-items:center;justify-content:center;gap:5px;background:rgba(255,255,255,.96);border-top:1px solid #E3E8EF;font:500 12.5px "Segoe UI",Arial,sans-serif;color:#6B788C}
  .kmr-foot{justify-content:space-between;padding:0 12px}.kmr-foot .kmr-slot{flex:1 1 0;min-width:0;display:flex}
  .kmr-foot a{color:#0B2A6F;font-weight:700;text-decoration:none}.kmr-foot a:hover{text-decoration:underline}
  .kmr-foot a.kmr-back{position:static;color:#fff;padding:3px 12px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;box-shadow:none;z-index:9000;display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border-radius:999px;background:linear-gradient(90deg,#7C3AED,#DB2777);color:#fff;font:700 13.5px "Segoe UI",Arial;text-decoration:none;box-shadow:0 10px 26px -8px rgba(124,58,237,.6)}
  .kmr-demo{position:sticky;top:0;z-index:8999;display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;padding:8px 14px;background:linear-gradient(90deg,#1e1b4b,#4c1d95);color:#fff;font:600 13.5px "Segoe UI",Arial}
  .kmr-demo button{border:0;border-radius:999px;padding:6px 14px;font:700 13px "Segoe UI",Arial;cursor:pointer;color:#1a1305;background:linear-gradient(180deg,#ffe08a,#f3c55a 45%,#c9962b)}
  .kmr-veil{position:fixed;inset:0;z-index:9100;background:rgba(10,7,32,.55);display:grid;place-items:center;padding:20px}
  .kmr-dlg{background:#fff;color:#16233A;border-radius:18px;max-width:430px;padding:26px;box-shadow:0 30px 80px rgba(0,0,0,.35);font:15px/1.5 "Segoe UI",Arial;border-top:4px solid #7C3AED}
  .kmr-dlg h3{margin:0 0 8px;font-size:21px}.kmr-dlg p{color:#5E6B7E;margin:0 0 18px}
  .kmr-dlg a,.kmr-dlg button{display:inline-block;margin-right:8px;border-radius:12px;padding:11px 18px;font:700 14px "Segoe UI",Arial;text-decoration:none;cursor:pointer;border:1px solid #E3E8EF;background:#fff;color:#16233A}
  .kmr-dlg a.go{border:0;color:#fff;background:linear-gradient(90deg,#7C3AED,#DB2777,#F59E0B)}`;
  document.head.append(css);
  // the customer's logo as the browser-tab icon (remembered by their KMR Apps page)
  if (portal && portal.logo) {
    const setIcon = () => {
      const cur = document.querySelectorAll('link[rel~="icon"]');
      if (cur.length === 1 && cur[0].href === portal.logo) return;
      cur.forEach((l) => l.remove());
      const ic = document.createElement("link"); ic.rel = "icon"; ic.href = portal.logo; document.head.append(ic);
    };
    setIcon();
    new MutationObserver(setIcon).observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });   // tools that set their own icon keep the customer's
  }
  document.addEventListener("DOMContentLoaded", function () {
    // the standard KMR footer on every tool
    if (!document.querySelector(".kmr-foot")) {
      const f = document.createElement("div"); f.className = "kmr-foot";
      const back = portal && portal.slug ? '<a class="kmr-back" href="/it/app/' + encodeURIComponent(portal.slug) + '">← ' + (portal.name ? String(portal.name).replace(/[<>&]/g, "") + " · " : "") + 'KMR Apps</a>' : "";
      f.innerHTML = '<span class="kmr-slot">' + back + '</span><span>Powered By : <a href="https://www.kmr-groups.com" target="_blank" rel="noopener">KMR Group of Companies</a></span><span class="kmr-slot"></span>';
      document.body.append(f);
    }
    if (demo) {
      // Sample-data mode: explore the sample only; real work (own files, import, export, new work) needs a subscription
      const ALLOW = /sample|keep exploring|close|kmr apps|use my company|fit|zoom|^[-+−]$|drawing \+ table|side by side|^table$|^drawing$|settings|report details|find dimensions|renumber|mark sc|german|english|next|back|previous|welcome|help/i;
      const BLOCK = /open drawing|choose file|upload|import|export|pdf|csv|excel|save|^new\b|\+ ?new|send to|open a project|^projects$|delete|rename|share|print|download|add balloon|sign in|log ?in/i;
      const gate = (e) => {
        const el = e.target.closest && e.target.closest("button, a, label, [role=button], input[type=file]");
        if (!el || el.closest(".kmr-demo, .kmr-veil, .kmr-back")) return;
        const txt = (el.innerText || el.value || el.getAttribute("aria-label") || el.title || "").trim().replace(/\s+/g, " ");
        if (["bOpen", "bNew", "bProjects", "bSave", "bExport"].includes(el.id)) { e.preventDefault(); e.stopImmediatePropagation(); subscribe(); return; }
        const isFile = el.matches("input[type=file], label") && (el.matches("input[type=file]") || el.querySelector("input[type=file]"));
        if (isFile || (BLOCK.test(txt) && !ALLOW.test(txt))) { e.preventDefault(); e.stopImmediatePropagation(); subscribe(); }
      };
      document.addEventListener("click", gate, true);
      document.addEventListener("change", (e) => { if (e.target.matches && e.target.matches("input[type=file]")) { e.target.value = ""; e.stopImmediatePropagation(); subscribe(); } }, true);
      ["dragover", "drop"].forEach((ev) => document.addEventListener(ev, (e) => { if (e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files")) { e.preventDefault(); e.stopImmediatePropagation(); if (ev === "drop") subscribe(); } }, true));
      document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && /^[sop]$/i.test(e.key)) { e.preventDefault(); subscribe(); } }, true);
      // hide the tools' internal "offline / demo mode" notes — the banner explains sample mode
      const hideNotes = () => document.querySelectorAll("span, div, small, p, em, b").forEach((n) => {
        const t = (n.textContent || "").trim();
        if (t.length < 140 && /^(offline mode|demo mode)\b/i.test(t) && !n.closest(".kmr-demo")) n.style.display = "none";
      });
      const hs = document.createElement("style"); hs.textContent = ".cl-offline{display:none!important}"; document.head.append(hs);
      hideNotes(); new MutationObserver(hideNotes).observe(document.body, { childList: true, subtree: true });
      const b = document.createElement("div"); b.className = "kmr-demo";
      b.innerHTML = '<span>Sample data only — explore the sample; your own drawings, imports and exports need a subscription.</span><button type="button">Use my company\'s data</button>';
      b.querySelector("button").onclick = subscribe;
      document.body.prepend(b);
    }
    function subscribe() {
      if (document.querySelector(".kmr-veil")) return;
      {
        const v = document.createElement("div"); v.className = "kmr-veil";
        const buy = "/it/?buy=" + tool + (portal && portal.slug ? "&c=" + encodeURIComponent(portal.slug) : "") + "#pilot";
        v.innerHTML = '<div class="kmr-dlg"><h3>Subscription needed</h3><p>To work with your company\'s real data in this app, take a subscription. Your team gets its own secure workspace.</p><a class="go" href="' + buy + '">Buy subscription</a><button type="button">Keep exploring</button></div>';
        v.onclick = function (e) { if (e.target === v || e.target.tagName === "BUTTON") v.remove(); };
        document.body.append(v);
      }
    }
  });
})();
