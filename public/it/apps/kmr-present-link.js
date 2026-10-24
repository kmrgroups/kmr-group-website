/* Adds the "Presentation" screen link to every KMR app (the screen itself is /it/present.html, one shared engine). */
(function () {
  "use strict";
  var MAP = { sales: "sales", calibration: "calibration", apqp: "apqp", ppap: "ppap", rmp: "rmp", mmd: "mmd", mnt: "mnt", msa: "msa", crm: "crm", d8: "d8", office: "off", aud: "aud", spc: "spc", tasks: "tsk", mom: "mom", cad: "cad" };
  var m = location.pathname.match(/\/it\/([a-z0-9]+)\.html/), key = m && MAP[m[1]];
  if (!key || /[?&]demo=1(&|$)/.test(location.search)) return;
  function add() {
    if (document.getElementById("kp-link")) return true;
    var slug = (window.QP && QP.slug) || new URLSearchParams(location.search).get("co"); if (!slug) return false;
    var href = "/it/present.html?app=" + key + "&kmr=1&co=" + encodeURIComponent(slug), tabs = document.querySelector(".tabs"), a = document.createElement("a");
    a.id = "kp-link"; a.href = href;
    a.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); location.href = href; }, true);
    if (tabs) { a.className = "tab"; a.textContent = "Presentation"; tabs.appendChild(a); }
    else { a.textContent = "Presentation"; a.style.cssText = "position:fixed;right:14px;bottom:40px;z-index:8990;background:#1e3a8a;color:#fff;padding:7px 14px;border-radius:999px;font:600 13px 'Segoe UI',Arial;text-decoration:none;box-shadow:0 2px 10px #0004"; document.body.appendChild(a); }
    return true;
  }
  var n = 0, t = setInterval(function () { if (add() || ++n > 40) clearInterval(t); }, 500);
})();
