/* KMR CAD Draft — sample data for the demo (?demo=1). Same rules and messages as the database functions. */
(function () {
  "use strict";
  const K = window.KCAD, G = K.geom, D2R = Math.PI / 180;
  let n = 0; const id = () => "d" + (++n).toString(36) + Math.random().toString(36).slice(2, 7);
  const now = () => new Date().toISOString(), ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
  const err = (m) => { throw new Error(m); };
  const U = (e) => Object.assign({ id: K.uid(), color: null, lt: null, lw: null }, e);

  /* ---------- sample geometry ---------- */
  function flange() {
    const d = K.newDoc(), E = d.ents, c = [0, 0];
    E.push(U({ t: "circle", layer: "Outline", c, r: 60 }), U({ t: "circle", layer: "Outline", c, r: 20 }), U({ t: "circle", layer: "Centre", c, r: 45 }));
    for (let i = 0; i < 6; i++) { const p = G.polar(c, (90 + i * 60) * D2R, 45); E.push(U({ t: "circle", layer: "Outline", c: p, r: 5.5 })); E.push(U({ t: "line", layer: "Centre", a: G.polar(p, (90 + i * 60) * D2R, -8), b: G.polar(p, (90 + i * 60) * D2R, 8) })); }
    E.push(U({ t: "line", layer: "Centre", a: [-68, 0], b: [68, 0] }), U({ t: "line", layer: "Centre", a: [0, -68], b: [0, 68] }));
    // keyway
    E.push(U({ t: "pline", layer: "Outline", closed: false, pts: [[-4, 19.6, 0], [-4, 23.3, 0], [4, 23.3, 0], [4, 19.6, 0]] }));
    // section view
    const x = 110, P = (pts) => U({ t: "pline", layer: "Outline", closed: true, pts: pts.map((p) => [p[0] + x, p[1], 0]) });
    E.push(P([[0, -60], [20, -60], [20, -30], [35, -30], [35, -20], [0, -20]]), P([[0, 20], [35, 20], [35, 30], [20, 30], [20, 60], [0, 60]]));
    E.push(U({ t: "hatch", layer: "Hatch", pat: "ANSI31", sc: 1.5, ang: 0, loops: [[[x, -60], [x + 20, -60], [x + 20, -30], [x + 35, -30], [x + 35, -20], [x, -20]]] }), U({ t: "hatch", layer: "Hatch", pat: "ANSI31", sc: 1.5, ang: 0, loops: [[[x, 20], [x + 35, 20], [x + 35, 30], [x + 20, 30], [x + 20, 60], [x, 60]]] }));
    E.push(U({ t: "line", layer: "Outline", a: [x, -20], b: [x, 20] }), U({ t: "line", layer: "Outline", a: [x + 35, -20], b: [x + 35, 20] }), U({ t: "line", layer: "Centre", a: [x - 6, 0], b: [x + 41, 0] }), U({ t: "line", layer: "Centre", a: [x - 6, 45], b: [x + 26, 45] }), U({ t: "line", layer: "Centre", a: [x - 6, -45], b: [x + 26, -45] }));
    E.push(U({ t: "line", layer: "Hidden", a: [x, 39.5], b: [x + 20, 39.5] }), U({ t: "line", layer: "Hidden", a: [x, 50.5], b: [x + 20, 50.5] }));
    // dimensions
    E.push(U({ t: "dim", layer: "Dimensions", kind: "dia", c, r: 60, loc: G.polar(c, 40 * D2R, 82) }), U({ t: "dim", layer: "Dimensions", kind: "dia", c, r: 20, loc: G.polar(c, 225 * D2R, 52) }));
    E.push(U({ t: "dim", layer: "Dimensions", kind: "lin", dir: "h", p1: [x, -60], p2: [x + 20, -60], loc: [x + 10, -72] }), U({ t: "dim", layer: "Dimensions", kind: "lin", dir: "h", p1: [x, -20], p2: [x + 35, -20], loc: [x + 17, -82] }));
    E.push(U({ t: "dim", layer: "Dimensions", kind: "lin", dir: "v", p1: [x + 35, -30], p2: [x + 35, 30], loc: [x + 52, 0], txt: "Ø<> h7" }), U({ t: "dim", layer: "Dimensions", kind: "lin", dir: "v", p1: [x + 20, -60], p2: [x + 20, 60], loc: [x + 66, 0], txt: "Ø<>" }));
    E.push(U({ t: "leader", layer: "Dimensions", pts: [G.polar(G.polar(c, 150 * D2R, 45), 150 * D2R, 5.5), [-62, 52], [-72, 52]], s: "6x Ø11 THRU\nEQ. SP. ON PCD Ø90", h: 2.5 }));
    E.push(U({ t: "text", layer: "Text", p: [0, -80], h: 3.5, s: "FRONT VIEW", rot: 0, ha: 1, va: 0 }), U({ t: "text", layer: "Text", p: [x + 17, -95], h: 3.5, s: "SECTION A-A", rot: 0, ha: 1, va: 0 }));
    E.push(U({ t: "mtext", layer: "Text", p: [-70, -105], h: 2.5, w: 120, ap: 1, rot: 0, s: "NOTES:\n1. MATERIAL: EN8 (080M40).\n2. GENERAL TOLERANCE ISO 2768-m.\n3. REMOVE ALL BURRS AND SHARP EDGES 0.5 x 45°." }));
    return d;
  }
  function bracket(rev) {
    const d = K.newDoc(), E = d.ents, t = 8, H = rev === "B" ? 70 : 60;
    E.push(U({ t: "pline", layer: "Outline", closed: true, pts: [[0, 0, 0], [100, 0, 0], [100, t, 0], [t + 6, t, -Math.tan(Math.PI / 8)], [t, t + 6, 0], [t, H, 0], [0, H, 0]] }));
    // plan view of the base with holes
    const y0 = -70; E.push(U({ t: "pline", layer: "Outline", closed: true, pts: [[0, y0, 0], [100, y0, 0], [100, y0 + 50, 0], [0, y0 + 50, 0]] }));
    for (const xx of [30, 75]) { E.push(U({ t: "circle", layer: "Outline", c: [xx, y0 + 25], r: 4.5 })); E.push(U({ t: "line", layer: "Centre", a: [xx - 8, y0 + 25], b: [xx + 8, y0 + 25] }), U({ t: "line", layer: "Centre", a: [xx, y0 + 17], b: [xx, y0 + 33] })); E.push(U({ t: "line", layer: "Hidden", a: [xx - 4.5, 0], b: [xx - 4.5, t] }), U({ t: "line", layer: "Hidden", a: [xx + 4.5, 0], b: [xx + 4.5, t] })); }
    E.push(U({ t: "dim", layer: "Dimensions", kind: "lin", dir: "h", p1: [0, 0], p2: [100, 0], loc: [50, -10] }), U({ t: "dim", layer: "Dimensions", kind: "lin", dir: "v", p1: [0, 0], p2: [0, H], loc: [-12, H / 2] }), U({ t: "dim", layer: "Dimensions", kind: "lin", dir: "v", p1: [100, 0], p2: [100, t], loc: [110, 4] }));
    E.push(U({ t: "dim", layer: "Dimensions", kind: "lin", dir: "h", p1: [0, y0 + 25], p2: [30, y0 + 25], loc: [15, y0 - 10] }), U({ t: "dim", layer: "Dimensions", kind: "lin", dir: "h", p1: [30, y0 + 25], p2: [75, y0 + 25], loc: [52, y0 - 10] }), U({ t: "dim", layer: "Dimensions", kind: "dia", c: [75, y0 + 25], r: 4.5, loc: [92, y0 + 42] }));
    E.push(U({ t: "dim", layer: "Dimensions", kind: "rad", c: [t + 6, t + 6], r: 6, loc: [t + 24, t + 26] }));
    E.push(U({ t: "text", layer: "Text", p: [50, y0 - 24], h: 3, s: "MOUNTING BRACKET — 2 OFF PER ASSEMBLY", rot: 0, ha: 1, va: 0 }));
    return d;
  }
  const thumb = () => null;
  const D = [];
  const add = (o) => { const r = Object.assign({ id: id(), status: "draft", notes: "", sample: true, updated_by: "Ravi Kumar", history: [] }, o); r.ents = r.data.ents.length; D.push(r); return r; };
  add({ number: "DRG-2609-0001", title: "Drive flange", rev: "C", part_no: "DP-1101", customer: "Deccan Motors Ltd", units: "mm", data: flange(), status: "released", updated_at: ago(12), history: [{ rev: "A", status: "released", at: ago(140), by: "Ravi Kumar", note: "First release" }, { rev: "B", status: "released", at: ago(60), by: "Ravi Kumar", note: "Bore tolerance changed to h7 (customer ECN 2241)" }, { rev: "C", status: "released", at: ago(12), by: "Ravi Kumar", note: "Keyway added" }], revs: 3 });
  add({ number: "DRG-2609-0002", title: "Mounting bracket", rev: "A", part_no: "DP-1205", customer: "Southern Auto Components", units: "mm", data: bracket("A"), status: "superseded", updated_at: ago(30), history: [{ rev: "A", status: "released", at: ago(45), by: "Karthik Rao", note: "First release" }, { rev: "A", status: "superseded", at: ago(30), by: "Karthik Rao", note: "Replaced by rev B" }], revs: 2 });
  add({ number: "DRG-2609-0002", title: "Mounting bracket", rev: "B", part_no: "DP-1205", customer: "Southern Auto Components", units: "mm", data: bracket("B"), status: "review", updated_at: ago(2), history: [{ rev: "B", status: "draft", at: ago(30), by: "Karthik Rao", note: "Height 60 → 70 for the new harness clip" }, { rev: "B", status: "review", at: ago(2), by: "Karthik Rao", note: "Sent to quality for review" }], revs: 2 });
  void thumb;
  let seq = 3;
  const get = (pid) => D.find((d) => d.id === pid) || err("Drawing not found.");
  const lock = (d) => { if (["released", "superseded", "obsolete"].includes(d.status)) err(`Drawing ${d.number} rev ${d.rev} is ${d.status} and locked. Make a new revision to change it.`); };
  const thumbs = {};
  /* ---------- Process Documents in the sample: one frozen project for the drive flange above, plus the projects
     made in Process Documents' own sample in this browser (stage drawings are written back there) ---------- */
  const PDKEY = "pd_projects@local";
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(PDKEY) || "[]") || []; } catch (e) { return []; } };
  const lsSet = (L) => { try { localStorage.setItem(PDKEY, JSON.stringify(L)); } catch (e) { err("This browser's storage is full, so the stage drawings could not be kept. Clear some sample data and try again."); } };
  const pdSample = (() => {
    const C = (no, type, text, spec, nominal, lsl, usl, cls, gauge) => ({ no, type, text, label: type, spec, nominal, upper: usl != null && nominal != null ? +(usl - nominal).toFixed(4) : null, lower: lsl != null && nominal != null ? +(lsl - nominal).toFixed(4) : null, lsl, usl, cls: cls || "", gauge: gauge || "" });
    const chars = [C(1, "Diameter", "Ø120", "Ø120 ±0.1", 120, 119.9, 120.1, "", "G-001"), C(2, "Diameter", "Ø40", "Ø40 +0.025/0", 40, 40, 40.025, "SC", "G-002"), C(3, "Diameter", "Ø60 h7", "Ø60 h7 (0/-0.030)", 60, 59.97, 60, "CC", "G-003"),
      C(4, "Linear", "20", "20 ±0.1", 20, 19.9, 20.1, "", "G-004"), C(5, "Linear", "35", "35 ±0.1", 35, 34.9, 35.1, "", "G-004"), C(6, "Diameter", "6x Ø11 THRU", "6x Ø11 THRU on PCD Ø90", 11, 11, 11.2, "", "G-005"),
      C(7, "Note", "REMOVE ALL BURRS AND SHARP EDGES 0.5 x 45°", "Remove all burrs and sharp edges 0.5 x 45°", null, null, null, "", "")];
    const ops = [{ opNo: 10, key: "RMI", name: "Raw material receiving & inspection", machine: "Inspection table & surface plate", chars: [7], tools: [] }, { opNo: 20, key: "CUT", name: "Bar cutting / sawing", machine: "Bandsaw BS-01", chars: [], tools: [] },
      { opNo: 30, key: "TURN1", name: "CNC turning – OP 1 (first side)", machine: "CNC lathe LT-01", chars: [1, 2, 4], tools: [{ desc: "OD turning tool", spec: "CNMG 120408" }, { desc: "OD finish tool", spec: "VNMG 160404" }, { desc: "Boring bar", spec: "CCMT 09T304" }, { desc: "Parting / grooving", spec: "3 mm blade" }] },
      { opNo: 40, key: "TURN2", name: "CNC turning – OP 2 (second side)", machine: "CNC lathe LT-02", chars: [3, 5], tools: [{ desc: "OD turning tool", spec: "CNMG 120408" }, { desc: "OD finish tool", spec: "VNMG 160404" }] },
      { opNo: 50, key: "VMC", name: "VMC – drilling", machine: "VMC-01", chars: [6], tools: [{ desc: "Drill Ø11", spec: "Carbide drill" }] }, { opNo: 60, key: "DEBURR", name: "Deburring", machine: "Deburring bench", chars: [], tools: [] }, { opNo: 70, key: "FINAL", name: "Final inspection", machine: "Inspection table", chars: [], tools: [] }];
    const gauges = [{ id: "G-001", name: "Outside micrometer", range: "100–125 mm" }, { id: "G-002", name: "Bore gauge", range: "35–50 mm" }, { id: "G-003", name: "Outside micrometer", range: "50–75 mm" }, { id: "G-004", name: "Digital vernier caliper", range: "0–150 mm" }, { id: "G-005", name: "Pin gauge", range: "Ø11.0 / Ø11.2" }];
    const gn = (id) => { const g = gauges.find((x) => x.id === id); return g ? g.id + " " + g.name : ""; };
    const map = {}, spec = {}; ops.forEach((o) => { if (o.chars.length) map[String(o.opNo)] = o.chars.slice(); }); chars.forEach((c) => { spec[String(c.no)] = [c.type, c.spec, c.cls].join(" | "); });
    return { id: "pd-sample-dp1101", part_no: "DP-1101", part_name: "Drive flange", rev: "C", drawing_no: "DRG-2609-0001", customer: "Deccan Motors Ltd", status: "approved", sample: true,
      header: { partNo: "DP-1101", partName: "Drive flange", drawingNo: "DRG-2609-0001", drawingRev: "C", customer: "Deccan Motors Ltd", material: "EN8 (080M40)", supplier: "Sample Engineering Pvt Ltd" },
      freeze: { rev: 1, at: ago(3), by: "Ravi Kumar", note: "Route agreed in the CFT review", map, spec }, chars, ops, gauges, family: "rotational", ctxInfo: { maxOD: 120, length: 35 }, notes: {},
      sop: { docNo: "SOP-DP1101", sections: ops.filter((o) => o.chars.length).map((o) => ({ opNo: o.opNo, docNo: "SOP-DP1101/" + o.opNo, checks: o.chars.map((n) => { const c = chars.find((x) => x.no === n); return { charNo: n, gauge: gn(c.gauge), freq: c.cls === "CC" ? "100%" : "5 pcs / 2 hrs" }; }) })) },
      source: { fileName: "", items: [] }, bi: null, stages: null };
  })();
  const pdShape = (r) => { const pl = (r.doc && r.doc.plan) || {}, sp = (r.doc && r.doc.docs && r.doc.docs.sop) || {};
    return { id: r.id, part_no: r.part_no, part_name: r.part_name, rev: r.rev, drawing_no: r.drawing_no, customer: r.customer, status: r.status, header: pl.header || {}, freeze: pl.freeze || null, chars: pl.chars || [],
      ops: (pl.ops || []).map((o) => ({ opNo: o.opNo, key: o.key, name: o.name, machine: o.machine, chars: o.chars, tools: o.tools })), family: pl.family, ctxInfo: pl.ctxInfo, notes: pl.notes, gauges: (pl.gauges || []).map((g) => ({ id: g.id, name: g.name, range: g.range })),
      sop: { docNo: sp.docNo, rev: sp.rev, sections: (sp.sections || []).map((s) => ({ opNo: s.opNo, docNo: s.docNo, checks: s.checks })) },
      source: { fileName: (r.source || {}).fileName, items: (r.source || {}).items || [], sheets: (r.source || {}).sheets, desk: (r.source || {}).desk, manual: (r.source || {}).manual }, bi: null,
      stages: r.stages ? { at: r.stages.at, by: r.stages.by, freezeRev: String(r.stages.freezeRev) } : null }; };
  const pdRow = (p) => ({ id: p.id, part_no: p.part_no, part_name: p.part_name, rev: p.rev, drawing_no: p.drawing_no, customer: p.customer, status: p.status, updated_at: p.updated_at || now(),
    freeze: p.freeze ? { rev: p.freeze.rev, at: p.freeze.at, by: p.freeze.by, note: p.freeze.note } : null, ops: (p.ops || []).length, chars: (p.chars || []).length, stages_at: p.stages && p.stages.at, stages_rev: p.stages && String(p.stages.freezeRev), bi: false });
  window.QP_DEMO = {
    kmr_cad_list: () => D.map((d) => Object.assign({}, d, { data: undefined, thumb: thumbs[d.id] || (thumbs[d.id] = mkThumb(d.data)), revs: D.filter((x) => x.number === d.number).length })),
    kmr_cad_get: (a) => JSON.parse(JSON.stringify(get(a.p_id))),
    kmr_cad_save: (a) => {
      const p = a.p || {};
      if (p.id) {
        const d = get(p.id); lock(d);
        for (const k of ["title", "rev", "part_no", "customer", "notes", "units", "data", "ents"]) if (p[k] !== undefined) d[k] = p[k];
        if (p.thumb) thumbs[d.id] = p.thumb; d.updated_at = now(); d.updated_by = "You (demo)"; return { id: d.id, number: d.number, rev: d.rev, updated_at: d.updated_at };
      }
      if (!String(p.title || "").trim()) err("Enter a title.");
      const number = String(p.number || "").trim() || "DRG-" + new Date().toISOString().slice(2, 7).replace("-", "") + "-" + String(++seq).padStart(4, "0");
      if (D.some((d) => d.number === number && d.rev === (p.rev || "A")) && !p.restore) err(`Drawing ${number} rev ${p.rev || "A"} already exists.`);
      const d = { id: id(), number, title: p.title, rev: p.rev || "A", part_no: p.part_no || "", customer: p.customer || "", notes: p.notes || "", units: p.units || "mm", data: p.data || K.newDoc(), ents: p.ents || 0, status: p.status || "draft", sample: false, updated_at: now(), updated_by: "You (demo)", history: p.history || [{ rev: p.rev || "A", status: "draft", at: now(), by: "You (demo)", note: "Created" }] };
      if (p.thumb) thumbs[d.id] = p.thumb; D.push(d); return { id: d.id, number: d.number, rev: d.rev, updated_at: d.updated_at };
    },
    kmr_cad_status: (a) => {
      const d = get(a.p_id), to = a.p_status, ok = { draft: ["review", "released"], review: ["released", "draft"], released: ["obsolete"], obsolete: ["draft"] }[d.status] || [];
      if (!ok.includes(to)) err(`A ${d.status} drawing cannot be set to ${to}.`);
      if (to === "released") for (const o of D) if (o !== d && o.number === d.number && o.status === "released") { o.status = "superseded"; o.history.push({ rev: o.rev, status: "superseded", at: now(), by: "You (demo)", note: "Replaced by rev " + d.rev }); }
      d.status = to; d.updated_at = now(); d.history.push({ rev: d.rev, status: to, at: now(), by: "You (demo)", note: a.p_note || "" }); return null;
    },
    kmr_cad_revise: (a) => {
      const d = get(a.p_id); if (d.status !== "released") err("Only a released drawing can be revised.");
      if (D.some((o) => o.number === d.number && o.rev === a.p_rev)) err(`Revision ${a.p_rev} already exists.`);
      if (D.some((o) => o.number === d.number && ["draft", "review"].includes(o.status))) err(`Revision ${D.find((o) => o.number === d.number && ["draft", "review"].includes(o.status)).rev} of ${d.number} is already being prepared.`);
      const n2 = Object.assign(JSON.parse(JSON.stringify(d)), { id: id(), rev: a.p_rev, status: "draft", sample: false, updated_at: now(), updated_by: "You (demo)" }); n2.history = d.history.concat([{ rev: a.p_rev, status: "draft", at: now(), by: "You (demo)", note: a.p_note }]);
      D.push(n2); return { id: n2.id, rev: n2.rev };
    },
    kmr_cad_pd_list: () => [pdRow(pdSample)].concat(lsGet().filter((r) => r.doc && r.doc.plan).map((r) => Object.assign(pdRow(pdShape(r)), { updated_at: r.updated_at }))),
    kmr_cad_pd_get: (a) => { if (a.p_id === pdSample.id) return JSON.parse(JSON.stringify(pdSample)); const r = lsGet().find((x) => x.id === a.p_id); if (!r) err("Process Documents project not found."); return pdShape(r); },
    kmr_cad_pd_stages: (a) => {
      const st = a.p_stages || {}; if (!st.ops || typeof st.ops !== "object") err("The stage drawings are not valid.");
      const at = now(), full = Object.assign({}, st, { at, by: "You (demo)" });
      if (a.p_id === pdSample.id) { if (String(st.freezeRev) !== String(pdSample.freeze.rev) || (st.freezeAt && st.freezeAt !== pdSample.freeze.at)) err(`The dimensions are now frozen as rev ${pdSample.freeze.rev} in Process Documents. Make the stage drawings again.`); pdSample.stages = full; return { at, ops: Object.keys(st.ops).length }; }
      const L = lsGet(), r = L.find((x) => x.id === a.p_id); if (!r) err("Process Documents project not found.");
      const fz = r.doc && r.doc.plan && r.doc.plan.freeze; if (!fz) err("Freeze the dimensions in Process Documents first (Process plan › Freeze dimensions).");
      if (String(st.freezeRev) !== String(fz.rev) || (st.freezeAt && st.freezeAt !== fz.at)) err(`The dimensions are now frozen as rev ${fz.rev} in Process Documents. Make the stage drawings again.`);
      r.stages = full; lsSet(L); return { at, ops: Object.keys(st.ops).length };
    },
    kmr_cad_delete: (a) => { const d = get(a.p_id); if (d.status === "released") err("A released drawing cannot be deleted — mark it obsolete."); D.splice(D.indexOf(d), 1); return null; },
  };
  function mkThumb(doc) {
    try { const b = K.extents(doc), W = 360, H = 240, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, W, H); const w = b.x1 - b.x0, h = b.y1 - b.y0, s = Math.min(W / w, H / h) * 0.9; const P = K.canvasPainter(x, { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, s, W, H }, { fg: "#000", light: true }); for (const e of doc.ents) K.paint(P, e, doc); return c.toDataURL("image/png"); } catch (e) { return null; }
  }
})();
