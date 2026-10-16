/* KMR CAD Draft — property pickers like AutoCAD: colour palette (ACI 1–255 + true colour), linetype list with a preview
   of each pattern, lineweight list with a sample of each thickness. The buttons show what the selected objects have
   ("*Varies*" when they differ) and what new objects will get when nothing is selected. */
(function (K) {
  "use strict";
  const P = (K.pd = {}), esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  const hsv = (h, s, v) => { const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return "#" + hex2(f(5) * 255) + hex2(f(3) * 255) + hex2(f(1) * 255); };
  /** AutoCAD colour index: 1–9 named, 10–249 = 24 hues × 10 shades, 250–255 greys */
  const ACI = [null, "#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ffffff", "#414141", "#808080"];
  const SH = [[1, 1], [0.5, 1], [1, 0.65], [0.5, 0.65], [1, 0.5], [0.5, 0.5], [1, 0.3], [0.5, 0.3], [1, 0.15], [0.5, 0.15]];
  for (let i = 10; i < 250; i++) { const h = Math.floor((i - 10) / 10) * 15, k = (i - 10) % 10; ACI[i] = hsv(h, SH[k][0], SH[k][1]); }
  [51, 91, 132, 173, 214, 255].forEach((g, j) => (ACI[250 + j] = "#" + hex2(g) + hex2(g) + hex2(g)));
  P.ACI = ACI;
  const NAMES = { "#ff0000": "Red", "#ffff00": "Yellow", "#00ff00": "Green", "#00ffff": "Cyan", "#0000ff": "Blue", "#ff00ff": "Magenta", "#ffffff": "White", "#808080": "Grey" };
  P.colName = (v) => (v == null || v === "" ? "ByLayer" : v === "byblock" ? "ByBlock" : NAMES[String(v).toLowerCase()] || String(v).toUpperCase());
  P.lwName = (v) => (v == null ? "ByLayer" : v === 0 ? "0.00 mm" : (+v).toFixed(2) + " mm");
  const ltSvg = (name, w = 56, sw = 1.6) => { const d = K.LT[name]; const arr = d && d.p.length ? d.p.map((v) => Math.max(v === 0 ? 1 : 2, Math.abs(v) * 0.55)) : null; return `<svg class="cx-ltp" width="${w}" height="10" viewBox="0 0 ${w} 10"><line x1="0" y1="5" x2="${w}" y2="5" stroke="currentColor" stroke-width="${sw}"${arr ? ` stroke-dasharray="${arr.map((v) => v.toFixed(1)).join(" ")}"` : ""}/></svg>`; };
  /** the text shown on the three buttons; `layer` gives the colour / linetype / weight "ByLayer" resolves to */
  P.colHtml = (v, layer, varies) => varies ? `<i class="cx-sw cx-swv"></i><span>*Varies*</span>` : `<i class="cx-sw" style="background:${v == null || v === "" ? (layer && layer.color) || "#fff" : v === "byblock" ? "#9aa3ad" : v}"></i><span>${esc(P.colName(v))}</span>`;
  P.ltHtml = (v, layer, varies) => varies ? `<span>*Varies*</span>` : `${ltSvg(v || (layer && layer.lt) || "CONTINUOUS")}<span>${esc(v || "ByLayer")}</span>`;
  P.lwHtml = (v, layer, varies) => varies ? `<span>*Varies*</span>` : `<svg class="cx-ltp" width="30" height="12" viewBox="0 0 30 12"><line x1="0" y1="6" x2="30" y2="6" stroke="currentColor" stroke-width="${Math.max(1, Math.min(10, ((v == null ? (layer && layer.lw) || 0.25 : v) * 4)))}"/></svg><span>${esc(P.lwName(v))}</span>`;

  let pop = null;
  const close = () => { if (pop) { pop.remove(); pop = null; document.removeEventListener("pointerdown", away, true); document.removeEventListener("keydown", esc2, true); } };
  const away = (e) => { if (pop && !pop.contains(e.target) && !e.target.closest(".cx-pdb")) close(); };
  const esc2 = (e) => { if (e.key === "Escape") close(); };
  const open = (anchor, html, wire) => {
    close(); pop = document.createElement("div"); pop.className = "cx-pop"; pop.innerHTML = html; document.body.append(pop);
    const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight; pop.style.left = Math.max(6, Math.min(r.left, innerWidth - w - 6)) + "px"; pop.style.top = (r.bottom + 4 + h > innerHeight ? Math.max(6, r.top - h - 4) : r.bottom + 4) + "px";
    wire(pop); setTimeout(() => { document.addEventListener("pointerdown", away, true); document.addEventListener("keydown", esc2, true); }, 0);
  };
  P.close = close;
  /** colour palette: ByLayer / ByBlock, standard colours, the 240-colour index palette, greys, any true colour */
  P.colorPop = (anchor, cur, cb) => {
    const cell = (i) => `<button type="button" class="cx-asw" data-v="${ACI[i]}" title="Colour ${i} · ${ACI[i]}" style="background:${ACI[i]}"></button>`;
    let g = ""; for (let k = 0; k < 10; k++) for (let h = 0; h < 24; h++) g += cell(10 + h * 10 + k);
    open(anchor, `<div class="cx-pph">Colour</div><div class="cx-ppr"><button type="button" data-v="">ByLayer</button><button type="button" data-v="byblock">ByBlock</button></div>
      <div class="cx-pps">Standard colours</div><div class="cx-acs">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(cell).join("")}</div>
      <div class="cx-pps">Index colours</div><div class="cx-acg">${g}</div><div class="cx-pps">Greys</div><div class="cx-acs">${[250, 251, 252, 253, 254, 255].map(cell).join("")}</div>
      <div class="cx-ppr"><label>True colour <input type="color" value="${cur && /^#/.test(cur) ? cur : "#ffffff"}"></label><label>Hex <input type="text" size="8" maxlength="7" placeholder="#rrggbb" value="${cur && /^#/.test(cur) ? cur : ""}"></label></div>`, (el) => {
      el.addEventListener("click", (e) => { const b = e.target.closest("button[data-v]"); if (!b) return; close(); cb(b.dataset.v === "" ? null : b.dataset.v); });
      el.querySelector('input[type=color]').addEventListener("change", (e) => { close(); cb(e.target.value); });
      el.querySelector('input[type=text]').addEventListener("keydown", (e) => { if (e.key === "Enter") { const v = e.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) { close(); cb(v.toLowerCase()); } } });
    });
  };
  P.ltPop = (anchor, cur, cb) => open(anchor, `<div class="cx-pph">Linetype</div><div class="cx-ppl">${[["", "ByLayer", "CONTINUOUS"], ...Object.keys(K.LT).map((n) => [n, n, n])].map(([v, n, pv]) => `<button type="button" data-v="${v}" class="${(cur || "") === v ? "on" : ""}">${ltSvg(pv, 90)}<span>${esc(n)}</span><small>${esc((K.LT[pv] || {}).d || "Linetype of the layer")}</small></button>`).join("")}</div>`, (el) => el.addEventListener("click", (e) => { const b = e.target.closest("button[data-v]"); if (!b) return; close(); cb(b.dataset.v === "" ? null : b.dataset.v); }));
  P.lwPop = (anchor, cur, cb) => open(anchor, `<div class="cx-pph">Lineweight</div><div class="cx-ppl">${[null, ...K.LW].map((v) => `<button type="button" data-v="${v == null ? "" : v}" class="${(cur == null ? null : +cur) === v ? "on" : ""}"><svg class="cx-ltp" width="70" height="12" viewBox="0 0 70 12"><line x1="0" y1="6" x2="70" y2="6" stroke="currentColor" stroke-width="${Math.max(1, Math.min(10, (v == null ? 0.25 : v) * 4))}"/></svg><span>${esc(P.lwName(v))}</span></button>`).join("")}</div>`, (el) => el.addEventListener("click", (e) => { const b = e.target.closest("button[data-v]"); if (!b) return; close(); cb(b.dataset.v === "" ? null : +b.dataset.v); }));
})((window.KCAD = window.KCAD || {}));
