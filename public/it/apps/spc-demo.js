/* SPC Charts - sample data for the demo (?demo=1). Same calls, rules and messages as the database functions (kmr_spc_*). Nothing here is real data. */
(function () {
  "use strict";
  const err = (m) => { throw new Error(m); }, T = (v) => String(v == null ? "" : v).trim();
  let uid = 0; const id = () => "s" + (++uid).toString(36).padStart(3, "0") + Math.random().toString(36).slice(2, 6);
  const J = (o) => JSON.parse(JSON.stringify(o));
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(9, 0, 0, 0); return d.toISOString(); };
  const rnd = (() => { let s = 20261018; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; })();
  const nm = (v) => { const n = Number(String(v == null ? "" : v).trim()); return String(v == null ? "" : v).trim() !== "" && Number.isFinite(n) ? n : null; };
  const S = { charts: [], pts: {}, n: 0 };
  const FEAT = (t) => t;
  function mk(o) {
    const c = Object.assign({ id: id(), no: "SPC-" + String(++S.n).padStart(4, "0"), part_no: null, part_name: null, characteristic: null, process: null, unit: null, subgroup_size: 5, lsl: null, usl: null, target: null,
      rules: { rules: [1, 2, 3], run: 7, trend: 7 }, frozen: null, limits_from: null, status: "active", notes: null, summary: null, sample: true, updated_at: new Date().toISOString() }, o);
    S.charts.push(c); S.pts[c.id] = []; return c;
  }
  function pt(c, vals, label, extra) { const a = S.pts[c.id]; a.push(Object.assign({ id: id(), seq: a.length + 1, label, taken_at: day(-(30 - a.length)), vals, note: null, cause: null, action: null }, extra || {})); }
  const r3 = (v, d) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  const c1 = mk({ title: "Shaft diameter — turning", part_no: "KMR-2001", part_name: "Drive shaft", characteristic: "Diameter 20.00 ±0.10", process: "CNC turning", unit: "mm", chart_type: "xr", subgroup_size: 5, lsl: 19.9, usl: 20.1, target: 20 });
  for (let i = 1; i <= 25; i++) pt(c1, Array.from({ length: 5 }, () => r3(20 + 0.018 * (rnd() * 2 - 1) * 1.7 + (i === 17 ? 0.075 : 0), 3)), "S" + i, i === 17 ? { cause: "Insert replaced mid-shift; first part after the change ran large", action: "Offset corrected; next 5 parts checked" } : {});
  const c2 = mk({ title: "Tightening torque — station 3", part_no: "KMR-2002", part_name: "Housing bolt", characteristic: "Torque 45 ±5", process: "Assembly", unit: "Nm", chart_type: "imr", subgroup_size: 1, lsl: 40, usl: 50, target: 45 });
  for (let i = 1; i <= 24; i++) pt(c2, [r3(45 + 0.9 * (rnd() * 2 - 1) + (i > 17 ? (i - 17) * 0.35 : 0), 2)], "#" + i);
  const c3 = mk({ title: "Final inspection — daily rejection", part_no: "KMR-2003", part_name: "Cover plate", characteristic: "Rejected parts", process: "Final inspection", chart_type: "p", subgroup_size: 1 });
  for (let i = 1; i <= 20; i++) pt(c3, [2 + Math.floor(rnd() * 5), 100 + Math.floor(rnd() * 21)], "D" + i);
  c1.summary = { signals: 1, cpk: 1.21, cap: true, headline: "1 point beyond the limit at subgroup 17" }; c2.summary = { signals: 1, cpk: 1.52, cap: true, headline: "7 points rising at the end" }; c3.summary = { signals: 0, headline: "In control" };
  const view = (c) => { const p = S.pts[c.id] || []; return Object.assign(J({ id: c.id, no: c.no, title: c.title, part_no: c.part_no, part_name: c.part_name, characteristic: c.characteristic, process: c.process, unit: c.unit, chart_type: c.chart_type, subgroup_size: c.subgroup_size, lsl: c.lsl, usl: c.usl, target: c.target, status: c.status, summary: c.summary, sample: c.sample, updated_at: c.updated_at }), { points: p.length, last_at: p.length ? p[p.length - 1].taken_at : null }); };
  const find = (i) => S.charts.find((c) => c.id === i) || err("Chart not found.");
  const TYPES = ["xr", "xs", "imr", "p", "np", "c", "u"];
  window.QP_DEMO = Object.assign(window.QP_DEMO || {}, {
    kmr_spc_enabled() { return true; },
    kmr_spc_list(a) {
      const p = a.p || {}, q = T(p.q).toLowerCase();
      return S.charts.filter((c) => (!p.status || c.status === p.status) && (!p.chart_type || c.chart_type === p.chart_type) && (!q || (c.no + " " + c.title + " " + (c.part_no || "") + " " + (c.characteristic || "") + " " + (c.process || "")).toLowerCase().includes(q))).map(view);
    },
    kmr_spc_get(a) { const c = find(a.p_id); return Object.assign(view(c), { rules: J(c.rules), frozen: c.frozen, limits_from: c.limits_from, notes: c.notes, can_edit: true, rows: J(S.pts[c.id] || []) }); },
    kmr_spc_save(a) {
      const p = a.p || {}; let c = p.id ? find(p.id) : null, ty = p.chart_type || (c && c.chart_type);
      if (!TYPES.includes(ty)) err("Choose a chart type."); if (!T(p.title)) err("Give the chart a title.");
      const n = ty === "imr" ? 1 : ["xr", "xs"].includes(ty) ? Math.min(25, Math.max(2, nm(p.subgroup_size) || 5)) : Math.min(25, Math.max(1, nm(p.subgroup_size) || 1));
      const f = { title: T(p.title), part_no: T(p.part_no) || null, part_name: T(p.part_name) || null, characteristic: T(p.characteristic) || null, process: T(p.process) || null, unit: T(p.unit) || null, chart_type: ty, subgroup_size: n, lsl: nm(p.lsl), usl: nm(p.usl), target: nm(p.target), notes: T(p.notes) || null };
      if (c) { if (c.chart_type !== ty && (S.pts[c.id] || []).length) err("The chart type cannot change once readings are entered. Start a new chart."); Object.assign(c, f, { rules: p.rules || c.rules, limits_from: "limits_from" in p ? (nm(p.limits_from) || null) : c.limits_from, status: ["active", "closed"].includes(p.status) ? p.status : c.status, updated_at: new Date().toISOString() }); }
      else c = mk(Object.assign(f, { rules: p.rules || { rules: [1, 2, 3], run: 7, trend: 7 }, limits_from: nm(p.limits_from) || null, sample: false }));
      return Object.assign(view(c), { rules: J(c.rules), limits_from: c.limits_from, notes: c.notes });
    },
    kmr_spc_delete(a) { find(a.p_id); S.charts = S.charts.filter((c) => c.id !== a.p_id); return null; },
    kmr_spc_points_add(a) {
      const c = find(a.p_chart), rows = a.p_rows; if (c.status === "closed") err("This chart is closed. Reopen it to add readings.");
      if (!Array.isArray(rows) || !rows.length) err("There are no readings to add."); if (rows.length > 500) err("Add at most 500 rows at a time.");
      let k = 0; rows.forEach((r) => { if (!Array.isArray(r.vals) || !r.vals.length) return; pt(c, r.vals, T(r.label) || null, { note: T(r.note) || null, taken_at: r.taken_at || new Date().toISOString() }); k++; }); c.updated_at = new Date().toISOString(); return { added: k };
    },
    kmr_spc_point_save(a) {
      const p = a.p; let hit = null; S.charts.forEach((c) => (S.pts[c.id] || []).forEach((x) => { if (x.id === p.id) hit = { c, x }; })); if (!hit) err("Reading not found."); if (hit.c.status === "closed") err("This chart is closed. Reopen it to change readings.");
      const x = hit.x; if ("label" in p) x.label = T(p.label) || null; if (Array.isArray(p.vals) && p.vals.length) x.vals = p.vals; if ("note" in p) x.note = T(p.note) || null; if ("cause" in p) x.cause = T(p.cause) || null; if ("action" in p) x.action = T(p.action) || null; return null;
    },
    kmr_spc_point_delete(a) { let ok = false; S.charts.forEach((c) => { const i = (S.pts[c.id] || []).findIndex((x) => x.id === a.p_id); if (i >= 0) { if (c.status === "closed") err("This chart is closed. Reopen it to delete readings."); S.pts[c.id].splice(i, 1); ok = true; } }); if (!ok) err("Reading not found."); return null; },
    kmr_spc_summary(a) { find(a.p_chart).summary = a.p_summary; return null; },
    kmr_spc_dashboard() {
      const act = S.charts.filter((c) => c.status === "active"), sig = (c) => (c.summary && Number(c.summary.signals)) || 0, low = (c) => c.summary && c.summary.cpk != null && Number(c.summary.cpk) < 1.33;
      return { charts: S.charts.length, active: act.length, signals: act.filter((c) => sig(c) > 0).length, low_cpk: act.filter(low).length, attention: act.filter((c) => sig(c) > 0 || low(c)).map(view), recent: S.charts.slice().reverse().slice(0, 8).map(view) };
    }
  });
})();
