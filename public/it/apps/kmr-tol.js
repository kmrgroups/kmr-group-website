/* KMRTol - tolerance entry shared by KMR apps. The user picks how the drawing states the tolerance (drop-down), types the nominal and the tolerance value(s),
   and the lower / upper limits and the tolerance symbol are worked out automatically.
   KMRTol.html(prefix, tol)   -> markup (one block of fields + a live result line)
   KMRTol.wire(prefix, onChange) ; KMRTol.read(prefix) -> {type,n,a,b,lsl,usl,symbol,tolerance,target}
   KMRTol.calc(tol) -> same, from a saved {type,n,a,b,lsl,usl} */
(function () {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TYPES = [
    ["sym", "± equal  (nominal ± t)", "Most common: 20.00 ±0.10", ["Nominal", "± Tolerance"]],
    ["uneq", "+ / − unequal  (nominal +a / −b)", "e.g. 20.00 +0.15 / −0.05", ["Nominal", "+ Upper", "− Lower"]],
    ["upper", "+ only  (nominal +a / −0)", "e.g. 20.00 +0.10 / −0", ["Nominal", "+ Upper"]],
    ["lower", "− only  (nominal +0 / −b)", "e.g. 20.00 +0 / −0.10", ["Nominal", "− Lower"]],
    ["max", "Maximum  (not more than)", "e.g. ≤ 0.05 (run-out, burr height, roughness)", ["Maximum value"]],
    ["min", "Minimum  (not less than)", "e.g. ≥ 45 (hardness, strength)", ["Minimum value"]],
    ["geo", "Geometric  (form / position, 0 to t)", "e.g. flatness, position, concentricity 0.05", ["Tolerance zone t"]],
    ["limits", "Lower and upper limit given", "e.g. 19.90 to 20.10", ["Lower limit (LSL)", "Upper limit (USL)"]]
  ];
  const r6 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1e6) / 1e6);
  const n = (v) => { const x = Number(String(v == null ? "" : v).trim()); return String(v == null ? "" : v).trim() !== "" && Number.isFinite(x) ? x : null; };
  const dp = (...v) => Math.min(5, Math.max(2, ...v.map((x) => (x == null ? 0 : (String(r6(x)).split(".")[1] || "").length))));
  function calc(t) {
    t = t || {}; const ty = t.type || (t.lsl != null || t.usl != null ? "limits" : "sym"), N = n(t.n), a = n(t.a), b = n(t.b);
    const o = { type: ty, n: N, a, b, lsl: null, usl: null, symbol: "", tolerance: null, target: null, ok: false };
    const f = (v, d) => Number(v).toFixed(d);
    if (ty === "sym" && N != null && a != null) { o.lsl = N - Math.abs(a); o.usl = N + Math.abs(a); o.target = N; const d = dp(N, a); o.symbol = `${f(N, d)} ±${f(Math.abs(a), d)}`; }
    else if (ty === "uneq" && N != null && a != null && b != null) { o.usl = N + Math.abs(a); o.lsl = N - Math.abs(b); o.target = N; const d = dp(N, a, b); o.symbol = `${f(N, d)} +${f(Math.abs(a), d)} / −${f(Math.abs(b), d)}`; }
    else if (ty === "upper" && N != null && a != null) { o.usl = N + Math.abs(a); o.lsl = N; o.target = N + Math.abs(a) / 2; const d = dp(N, a); o.symbol = `${f(N, d)} +${f(Math.abs(a), d)} / −0`; }
    else if (ty === "lower" && N != null && b != null) { o.lsl = N - Math.abs(b); o.usl = N; o.target = N - Math.abs(b) / 2; const d = dp(N, b); o.symbol = `${f(N, d)} +0 / −${f(Math.abs(b), d)}`; }
    else if (ty === "max" && N != null) { o.usl = N; const d = dp(N); o.symbol = `≤ ${f(N, d)}`; }
    else if (ty === "min" && N != null) { o.lsl = N; const d = dp(N); o.symbol = `≥ ${f(N, d)}`; }
    else if (ty === "geo" && N != null) { o.usl = Math.abs(N); o.lsl = null; const d = dp(N); o.symbol = `0 – ${f(Math.abs(N), d)}`; }
    else if (ty === "limits" && (n(t.lsl) != null || n(t.usl) != null)) { o.lsl = n(t.lsl); o.usl = n(t.usl); if (o.lsl != null && o.usl != null) o.target = (o.lsl + o.usl) / 2; const d = dp(o.lsl, o.usl); o.symbol = o.lsl != null && o.usl != null ? `${f(o.lsl, d)} to ${f(o.usl, d)}` : o.usl != null ? `≤ ${f(o.usl, d)}` : `≥ ${f(o.lsl, d)}`; }
    o.lsl = r6(o.lsl); o.usl = r6(o.usl); o.target = r6(o.target); o.ok = o.lsl != null || o.usl != null;
    if (o.lsl != null && o.usl != null) { if (o.usl <= o.lsl) o.ok = false; else o.tolerance = r6(o.usl - o.lsl); }
    return o;
  }
  const lbl = (ty) => (TYPES.find((x) => x[0] === ty) || TYPES[0]);
  function html(p, tol) {
    tol = tol || {}; const ty = tol.type || "sym";
    return `<div class="tolbox"><div class="frm"><div class="w"><label>How is the tolerance written on the drawing? *</label><select id="${p}_type">${TYPES.map((x) => `<option value="${x[0]}"${x[0] === ty ? " selected" : ""}>${esc(x[1])}</option>`).join("")}</select><div class="mut" id="${p}_eg" style="font-size:12.5px;margin-top:3px"></div></div>
      <div><label id="${p}_l1"></label><input id="${p}_n" inputmode="decimal" value="${esc(ty === "limits" ? tol.lsl ?? "" : tol.n ?? "")}"></div>
      <div><label id="${p}_l2"></label><input id="${p}_a" inputmode="decimal" value="${esc(ty === "limits" ? tol.usl ?? "" : ty === "lower" ? tol.b ?? "" : tol.a ?? "")}"></div>
      <div><label id="${p}_l3"></label><input id="${p}_b" inputmode="decimal" value="${esc(tol.b ?? "")}"></div></div>
      <div id="${p}_out" class="tolout"></div></div>`;
  }
  function read(p) {
    const g = (s) => document.getElementById(p + "_" + s), ty = g("type").value, v1 = g("n").value, v2 = g("a").value, v3 = g("b").value;
    if (ty === "limits") return calc({ type: ty, lsl: v1, usl: v2 });
    if (ty === "lower") return calc({ type: ty, n: v1, b: v2 });
    return calc({ type: ty, n: v1, a: v2, b: v3 });
  }
  function wire(p, cb) {
    const g = (s) => document.getElementById(p + "_" + s);
    const upd = () => {
      const x = lbl(g("type").value), L = x[3]; g("eg").textContent = x[2];
      [1, 2, 3].forEach((i) => { const on = i <= L.length; g("l" + i).textContent = on ? L[i - 1] : ""; const inp = g(["n", "a", "b"][i - 1]); inp.parentElement.style.display = on ? "" : "none"; });
      const o = read(p), out = g("out");
      out.innerHTML = o.ok ? `<b>Limits worked out:</b> ${o.lsl != null ? "LSL <b>" + o.lsl + "</b>" : "no lower limit"} · ${o.usl != null ? "USL <b>" + o.usl + "</b>" : "no upper limit"}${o.tolerance != null ? " · tolerance (USL − LSL) <b>" + o.tolerance + "</b>" : ""}${o.symbol ? " · written as <b>" + esc(o.symbol) + "</b>" : ""}` : '<span class="mut">Enter the values above and the limits are worked out for you.</span>';
      if (cb) cb(o);
    };
    ["type", "n", "a", "b"].forEach((s) => g(s).addEventListener(s === "type" ? "change" : "input", upd)); upd();
  }
  window.KMRTol = { TYPES, calc, html, read, wire };
})();
