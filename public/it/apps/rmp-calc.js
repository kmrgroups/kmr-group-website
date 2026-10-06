/* Raw Material Planning — the calculation, kept apart from the screen so it can be tested.
   plan(data, month) → { lines: [per material], problems: [text] }
   kg for a part   = parts to start × kg per part × (1 + loss %)
   kg per part     = the bill-of-material line (part + material) if there is one, else the part master's weight for its own material
   covered         = orders already planned or placed (not yet received — received kg is already in stock)
   short (simple)  = max(0, needed − in stock − covered)
   net  (full)     = max(0, needed + safety stock − in stock − covered)
   order           = net rounded up to the MOQ, then to a whole number of packs
   order-by        = needed-by date − lead days */
(function () {
  "use strict";
  const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
  const addDays = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const DEF = { density: 7.85, face_mm: 1.5, part_mm: 3, remnant_mm: 100, forge_pct: 20, cast_yield_pct: 70 };
  const settings = (o) => { const r = Object.assign({}, DEF); Object.keys(DEF).forEach((k) => { if (o && o[k] != null && o[k] !== "" && isFinite(Number(o[k])) && Number(o[k]) > 0) r[k] = Number(o[k]); }); return r; };
  const formOf = (m) => { const f = String((m && m.form) || "").toLowerCase(); if (/bar|rod|round/.test(f)) return "bar"; if (/forg/.test(f)) return "forging"; if (/cast/.test(f)) return "casting"; return /^\s*Ø/.test(String((m && m.size) || "")) ? "bar" : ""; };
  const sizeOf = (m) => { const t = String((m && m.size) || ""), d = t.match(/Ø\s*(\d+(?:\.\d+)?)/), l = t.match(/[×x]\s*(\d+(?:\.\d+)?)\s*(m|mm)\b/i); return { dia: d ? Number(d[1]) : 0, len: l ? Number(l[1]) * (l[2].toLowerCase() === "m" ? 1000 : 1) : 0 }; };
  const fx = (n, d) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: d == null ? 1 : d });
  /* the raw material one piece needs, worked out from the ballooned drawing and the type of blank:
       BAR      cut length = longest length on the drawing + facing both ends + parting-off width; kg per part = bar weight ÷ pieces per bar (bar-end remnant is lost)
       FORGING  forged blank = finished weight × (1 + allowance %)
       CASTING  pour weight  = finished weight ÷ yield %
     returns null when there is not enough to go on (then the part weight from the Operations Master is used) */
  function blank(part, mat, dwg, set) {
    const form = formOf(mat), w = Number(part.weight_kg) || 0, warn = [];
    if (!mat || !form) return null;
    if (form === "bar") {
      const sz = sizeOf(mat); if (!dwg || !dwg.len || !sz.dia) return null;
      const cut = dwg.len + 2 * set.face_mm + set.part_mm, area = Math.PI / 4 * sz.dia * sz.dia;
      if (dwg.od && sz.dia < dwg.od + 1 - 1e-9) warn.push("Bar Ø" + sz.dia + " is too small for the Ø" + dwg.od + " on the drawing — choose a larger bar in Operations Master › Parts.");
      let kg, txt;
      if (sz.len) { const pcs = Math.floor((sz.len - set.remnant_mm) / cut); if (pcs < 1) { warn.push("Cut length " + fx(cut) + " mm does not fit the bar."); return { kg: 0, form, text: "", warn }; }
        kg = area * sz.len * set.density * 1e-6 / pcs; txt = "Bar Ø" + sz.dia + " · cut " + fx(cut) + " mm (drawing " + fx(dwg.len) + " + allowances) · " + pcs + " pcs per " + fx(sz.len / 1000) + " m bar"; }
      else { kg = area * cut * set.density * 1e-6; txt = "Bar Ø" + sz.dia + " · cut " + fx(cut) + " mm (drawing " + fx(dwg.len) + " + allowances)"; }
      return { kg: r3(kg), form, text: txt, warn };
    }
    let fin = w, est = false;
    if (!fin && dwg && dwg.od && dwg.len) { fin = Math.PI / 4 * dwg.od * dwg.od * dwg.len * set.density * 1e-6 * 0.6; est = true; warn.push("No finished weight in the Operations Master — estimated from the drawing envelope (Ø" + dwg.od + " × " + dwg.len + "); enter the part weight for an exact figure."); }
    if (!fin) return null;
    if (form === "forging") return { kg: r3(fin * (1 + set.forge_pct / 100)), form, text: "Forging blank · finished " + fx(fin, 3) + " kg + " + set.forge_pct + "% allowance", warn };
    return { kg: r3(fin / (set.cast_yield_pct / 100)), form, text: "Casting · finished " + fx(fin, 3) + " kg ÷ " + set.cast_yield_pct + "% yield", warn };
  }
  function plan(data, month) {
    const set = settings(data.settings), dw = Object.fromEntries((data.drawings || []).map((d) => [d.part_code, d]));
    const mats0 = Object.fromEntries((data.materials || []).map((m) => [m.code, m]));
    // the materials of one part: a bill-of-material line with kg wins, else the drawing + blank type, else the part weight
    const partLines = (p) => {
      const bl = (data.bom || []).filter((b) => b.part_code === p.code), dwg = dw[p.code] || null, out = [];
      let own = p.material, sug = false;
      if (!own && dwg && dwg.od) { const c = (data.materials || []).filter((m) => formOf(m) === "bar" && sizeOf(m).dia >= dwg.od + 1 - 1e-9).sort((a, b) => sizeOf(a).dia - sizeOf(b).dia)[0]; if (c) { own = c.code; sug = true; } }
      bl.forEach((b) => { const loss = num(b.loss_pct);
        if (b.rm_kg != null && b.rm_kg !== "") out.push({ material: b.material_code, kg: num(b.rm_kg), loss, source: "bom", text: "Bill of material", warn: [] });
        else { const r = b.material_code === own ? blank(p, mats0[b.material_code], dwg, set) : null; out.push(r ? { material: b.material_code, kg: r.kg, loss, source: "drawing", text: r.text, warn: r.warn } : { material: b.material_code, kg: num(p.weight_kg), loss, source: "weight", text: "Part weight", warn: [] }); } });
      if (own && !out.some((l) => l.material === own)) { const r = blank(p, mats0[own], dwg, set);
        out.unshift(r ? { material: own, kg: r.kg, loss: 0, source: "drawing", text: (sug ? "Suggested " : "") + r.text, warn: r.warn, suggested: sug } : { material: own, kg: num(p.weight_kg), loss: 0, source: "weight", text: "Part weight", warn: [] }); }
      out.forEach((l) => { if (l.source === "drawing" && dwg && formOf(mats0[l.material]) === "bar") { const cur = sizeOf(mats0[l.material]).dia, sm = (data.materials || []).filter((m) => formOf(m) === "bar" && sizeOf(m).dia >= dwg.od + 1 - 1e-9 && sizeOf(m).dia < cur).sort((x, y) => sizeOf(y).dia - sizeOf(x).dia)[0];
        if (sm) { const r2 = blank(p, sm, dwg, set); if (r2 && r2.kg && r2.kg < l.kg * 0.9) l.warn.push("Tip: bar " + sm.code + " (Ø" + sizeOf(sm).dia + ") would use " + fx(r2.kg, 3) + " kg per part instead of " + fx(l.kg, 3) + "."); } } });
      return out;
    };
    const basis = {}; (data.parts || []).forEach((p) => { basis[p.code] = { lines: partLines(p), drawing: dw[p.code] || null }; });
    const parts = Object.fromEntries((data.parts || []).map((p) => [p.code, p]));
    const mats = mats0;
    const stock = Object.fromEntries((data.stock || []).map((s) => [s.material_code, s]));
    const today = String(data.today || "").slice(0, 10);
    const cov = {};
    (data.orders || []).forEach((o) => { if (o.status === "planned" || o.status === "ordered") cov[o.material_code] = (cov[o.material_code] || 0) + num(o.qty_kg); });
    const dmd = new Set((data.demand || []).filter((d) => num(d.start_qty) > 0).map((d) => d.part_code)); const need = {}, problems = [], noWeight = new Set(), noMat = new Set();
    (data.demand || []).forEach((d) => {
      const qty = num(d.start_qty); if (qty <= 0) return;
      const p = parts[d.part_code]; if (!p) { problems.push("Part " + d.part_code + " is not in the Operations Master."); return; }
      const lines = basis[d.part_code].lines;
      if (!lines.length) noMat.add(d.part_code);
      lines.forEach((l) => {
        if (!l.kg) { noWeight.add(d.part_code); return; }
        const k = qty * l.kg * (1 + l.loss / 100), n = need[l.material] || (need[l.material] = { code: l.material, gross: 0, needBy: null, parts: [] });
        n.gross += k; n.parts.push({ part: d.part_code, qty, kg: r3(k) });
        if (d.need_by && (!n.needBy || d.need_by < n.needBy)) n.needBy = String(d.need_by).slice(0, 10);
      });
    });
    if (noMat.size) problems.push("No material set for part(s): " + [...noMat].join(", ") + " — set it in Operations Master › Parts.");
    if (noWeight.size) problems.push("No weight (kg per part) for: " + [...noWeight].join(", ") + " — set it in Operations Master › Parts or add a bill-of-material line.");
    const out = Object.values(need).map((n) => {
      const s = stock[n.code] || {}, m = mats[n.code] || {}, onHand = num(s.on_hand_kg), safety = num(s.safety_kg), covered = cov[n.code] || 0;
      const gross = r3(n.gross), short = r3(Math.max(0, gross - onHand - covered)), net = r3(Math.max(0, gross + safety - onHand - covered));
      const moq = num(s.moq_kg), pack = num(s.pack_kg), lead = s.lead_days == null || s.lead_days === "" ? null : num(s.lead_days);
      let order = net; if (order > 0) { if (moq > order) order = moq; if (pack > 0) order = Math.ceil(order / pack - 1e-9) * pack; } order = r3(order);
      const orderBy = n.needBy && lead != null ? addDays(n.needBy, -lead) : null, rate = num(m.rate_per_kg);
      return { code: n.code, gross, onHand, covered, safety, short, net, moq, pack, lead, order, orderBy, late: !!(order > 0 && orderBy && today && orderBy < today), rate, value: Math.round(order * rate), supplier: m.supplier || "", needBy: n.needBy, parts: n.parts };
    }).sort((a, b) => a.code.localeCompare(b.code));
    const warns = []; Object.keys(basis).forEach((k) => basis[k].lines.forEach((l) => l.warn.forEach((w) => { if (dmd.has(k) && !/^Tip:/.test(w)) warns.push(k + ": " + w); })));
    return { lines: out, problems: problems.concat(warns), basis, settings: set };
  }
  const API = { plan, addDays, blank, settings, DEF }; if (typeof window !== "undefined") window.RMPCalc = API;
  if (typeof module !== "undefined") module.exports = API;
})();
