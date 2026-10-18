/* MSA Studies - sample data for the demo (?demo=1). Same calls, rules and messages as the database functions (kmr_msa_*). Nothing here is real data. */
(function () {
  "use strict";
  const err = (m) => { throw new Error(m); }, T = (v) => String(v == null ? "" : v).trim();
  let uid = 0; const id = () => "m" + (++uid).toString(36).padStart(3, "0") + Math.random().toString(36).slice(2, 6);
  const J = (o) => JSON.parse(JSON.stringify(o));
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const nm = (v) => { const n = Number(String(v == null ? "" : v).trim()); return String(v == null ? "" : v).trim() !== "" && Number.isFinite(n) ? n : null; };
  const S = { rows: [], n: 0 };
  const A = [[.29, -.56, 1.34, .47, -.80, .02, .59, -.31, 2.26, -1.36], [.41, -.68, 1.17, .50, -.92, -.11, .75, -.20, 1.99, -1.25], [.64, -.58, 1.27, .64, -.84, -.21, .66, -.17, 2.01, -1.31]];
  const B = [[.08, -.47, 1.19, .01, -.56, -.20, .47, -.63, 1.80, -1.68], [.25, -1.22, .94, 1.03, -1.20, .22, .55, .08, 2.12, -1.62], [.07, -.68, 1.34, .20, -1.28, .06, .83, -.34, 2.19, -1.50]];
  const C = [[.04, -1.38, .88, .14, -1.46, -.29, .02, -.46, 1.77, -1.49], [-.11, -1.13, 1.09, .20, -1.07, -.67, .01, -.56, 1.45, -1.77], [-.15, -.96, .67, .11, -1.45, -.49, .21, -.49, 1.87, -2.16]];
  const grr = [A, B, C].map((X) => Array.from({ length: 10 }, (_, p) => X.map((t) => t[p])));
  function mk(o) { const s = Object.assign({ id: id(), no: "MSA-" + String(++S.n).padStart(4, "0"), title: null, gauge_id: null, gauge_name: null, characteristic: null, part_no: null, part_name: null, unit: null, lsl: null, usl: null, study_date: day(0), conducted_by: null, config: {}, data: {}, results: null, decision: null, notes: null, status: "draft", finalised_by: null, finalised_at: null, sample: true, updated_at: new Date().toISOString() }, o); S.rows.push(s); return s; }
  mk({ type: "grr", title: "Bore gauge BG-12 — Gage R&R", gauge_id: "BG-12", gauge_name: "Dial bore gauge", characteristic: "Bore diameter", unit: "mm", conducted_by: "Marco Silva", study_date: day(-20), part_no: "KMR-1001", part_name: "Sample part 1", config: { appraisers: ["A", "B", "C"], parts: 10, trials: 3, k: 6 }, data: { d: grr }, results: { headline: "%GRR 26.7% · 5 distinct categories" }, decision: "Conditional", status: "final", finalised_by: "you@demo.example", finalised_at: new Date().toISOString() });
  mk({ type: "bias", title: "Micrometer MC-04 — bias against master 6.000", gauge_id: "MC-04", gauge_name: "Outside micrometer 0-25", characteristic: "Shaft diameter", unit: "mm", conducted_by: "Priya Nair", study_date: day(-12), config: { reference: 6, tol: 0.1 }, data: { readings: [5.998, 6.002, 6.001, 5.999, 6.0, 6.003, 5.998, 6.001] }, results: { headline: "Bias 0.0003 mm · zero inside the 95% interval" }, decision: "Acceptable", status: "final", finalised_by: "you@demo.example", finalised_at: new Date().toISOString() });
  mk({ type: "linearity", title: "Height gauge HG-02 — linearity", gauge_id: "HG-02", gauge_name: "Digital height gauge", characteristic: "Height", unit: "mm", conducted_by: "Ravi Kumar", study_date: day(-8), config: { processVariation: 0.6 },
    data: { rows: [{ ref: 2, readings: [1.99, 2.01, 2.0, 1.98, 2.02] }, { ref: 4, readings: [3.97, 3.99, 3.98, 3.97, 3.99] }, { ref: 6, readings: [5.96, 5.95, 5.97, 5.96, 5.94] }, { ref: 8, readings: [7.93, 7.94, 7.92, 7.94, 7.93] }, { ref: 10, readings: [9.91, 9.92, 9.9, 9.92, 9.91] }] }, results: { headline: "Bias grows with size — linearity not acceptable" }, decision: "Not acceptable" });
  mk({ type: "attribute", title: "Go / no-go gauge GN-07 — attribute agreement", gauge_id: "GN-07", gauge_name: "Thread plug gauge", characteristic: "Thread fit", conducted_by: "Anil Shah", study_date: day(-4), config: { appraisers: ["A", "B", "C"], parts: 10, trials: 2, labels: ["Reject", "Accept"] },
    data: { ref: [1, 1, 0, 0, 1, 0, 1, 0, 1, 0], d: [[[1, 1], [1, 1], [0, 0], [0, 0], [1, 1], [0, 0], [1, 1], [0, 0], [1, 1], [0, 0]], [[1, 1], [1, 1], [0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 0], [1, 1], [0, 0]], [[1, 1], [1, 1], [0, 0], [0, 0], [1, 1], [0, 0], [1, 1], [0, 0], [1, 1], [0, 0]]] },
    results: { headline: "Effectiveness 95% to 100% · one miss in 10 checks of bad parts" }, decision: "Conditional" });
  mk({ type: "stability", title: "Master check on CMM — weekly stability", gauge_id: "CMM-01", gauge_name: "Coordinate measuring machine", characteristic: "Master ring 25.000", unit: "mm", conducted_by: "Marco Silva", study_date: day(-2), config: { reference: 25 },
    data: { readings: [25.001, 24.999, 25.0, 25.002, 24.998, 25.001, 25.0, 24.999, 25.001, 25.0, 25.002, 24.999, 25.0, 25.001, 24.998, 25.0] }, results: { headline: "In control — no signals over 16 weekly checks" }, decision: "Acceptable" });
  const light = (s) => ({ id: s.id, no: s.no, type: s.type, title: s.title, gauge_id: s.gauge_id, gauge_name: s.gauge_name, characteristic: s.characteristic, part_no: s.part_no, part_name: s.part_name, unit: s.unit, lsl: s.lsl, usl: s.usl, study_date: s.study_date, conducted_by: s.conducted_by, decision: s.decision, status: s.status, finalised_by: s.finalised_by, finalised_at: s.finalised_at, notes: s.notes, sample: s.sample, updated_at: s.updated_at, results: { headline: s.results && s.results.headline } });
  const find = (i) => S.rows.find((s) => s.id === i) || err("Study not found.");
  const FEAT = { grr: 1, bias: 1, linearity: 1, stability: 1, attribute: 1 };
  window.QP_DEMO = Object.assign(window.QP_DEMO || {}, {
    kmr_msa_enabled() { return true; },
    kmr_msa_list(a) {
      const p = a.p || {}, q = T(p.q).toLowerCase();
      return S.rows.filter((s) => (!p.type || s.type === p.type) && (!p.decision || s.decision === p.decision) && (!p.status || s.status === p.status) && (!q || (s.no + " " + (s.title || "") + " " + (s.gauge_id || "") + " " + (s.gauge_name || "") + " " + (s.characteristic || "") + " " + (s.part_no || "")).toLowerCase().includes(q)))
        .sort((x, y) => String(y.study_date).localeCompare(String(x.study_date))).map(light);
    },
    kmr_msa_get(a) { const s = find(a.p_id); return Object.assign(J(light(s)), { results: J(s.results), config: J(s.config), data: J(s.data), can_edit: true, is_admin: true }); },
    kmr_msa_save(a) {
      const p = a.p || {}; let s = p.id ? find(p.id) : null; const ty = s ? s.type : p.type; if (!FEAT[ty]) err("Choose the type of study.");
      if (s && s.status === "final") err("This study is final. Ask an administrator to reopen it.");
      const dec = ["Acceptable", "Conditional", "Not acceptable"].includes(p.decision) ? p.decision : null;
      const f = { title: T(p.title) || null, gauge_id: T(p.gauge_id) || null, gauge_name: T(p.gauge_name) || null, characteristic: T(p.characteristic) || null, part_no: T(p.part_no) || null, part_name: T(p.part_name) || null, unit: T(p.unit) || null, lsl: nm(p.lsl), usl: nm(p.usl), study_date: p.study_date || day(0), conducted_by: T(p.conducted_by) || null, notes: T(p.notes) || null, decision: dec };
      if (s) Object.assign(s, f, { config: p.config ? J(p.config) : s.config, data: p.data ? J(p.data) : s.data, results: p.results ? J(p.results) : s.results, updated_at: new Date().toISOString() });
      else s = mk(Object.assign(f, { type: ty, config: J(p.config || {}), data: J(p.data || {}), results: p.results ? J(p.results) : null, sample: false }));
      return Object.assign(J(light(s)), { results: J(s.results), config: J(s.config), data: J(s.data) });
    },
    kmr_msa_finalise(a) {
      const s = find(a.p_id); if (a.p_final === false) { s.status = "draft"; s.finalised_by = null; s.finalised_at = null; } else { if (!s.decision) err("Calculate the study and save it before finalising."); s.status = "final"; s.finalised_by = "you@demo.example"; s.finalised_at = new Date().toISOString(); } return light(s);
    },
    kmr_msa_delete(a) { find(a.p_id); S.rows = S.rows.filter((s) => s.id !== a.p_id); return null; },
    kmr_msa_dashboard() {
      const cnt = (f) => S.rows.reduce((o, s) => { const k = f(s); o[k] = (o[k] || 0) + 1; return o; }, {});
      return { total: S.rows.length, draft: S.rows.filter((s) => s.status === "draft").length, by_decision: cnt((s) => s.decision || "Not calculated"), by_type: cnt((s) => s.type), attention: S.rows.filter((s) => s.decision === "Not acceptable").map(light), recent: S.rows.slice().sort((x, y) => String(y.study_date).localeCompare(String(x.study_date))).slice(0, 8).map(light) };
    }
  });
})();
