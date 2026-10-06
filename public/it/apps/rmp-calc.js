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
  function plan(data, month) {
    const parts = Object.fromEntries((data.parts || []).map((p) => [p.code, p]));
    const mats = Object.fromEntries((data.materials || []).map((m) => [m.code, m]));
    const stock = Object.fromEntries((data.stock || []).map((s) => [s.material_code, s]));
    const today = String(data.today || "").slice(0, 10);
    const cov = {};
    (data.orders || []).forEach((o) => { if (o.status === "planned" || o.status === "ordered") cov[o.material_code] = (cov[o.material_code] || 0) + num(o.qty_kg); });
    const need = {}, problems = [], noWeight = new Set(), noMat = new Set();
    (data.demand || []).forEach((d) => {
      const qty = num(d.start_qty); if (qty <= 0) return;
      const p = parts[d.part_code]; if (!p) { problems.push("Part " + d.part_code + " is not in the Operations Master."); return; }
      const lines = (data.bom || []).filter((b) => b.part_code === d.part_code).map((b) => ({ material: b.material_code, kg: b.rm_kg == null || b.rm_kg === "" ? num(p.weight_kg) : num(b.rm_kg), loss: num(b.loss_pct) }));
      if (p.material && !lines.some((l) => l.material === p.material)) lines.unshift({ material: p.material, kg: num(p.weight_kg), loss: 0 });
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
    return { lines: out, problems };
  }
  const API = { plan, addDays }; if (typeof window !== "undefined") window.RMPCalc = API;
  if (typeof module !== "undefined") module.exports = API;
})();
