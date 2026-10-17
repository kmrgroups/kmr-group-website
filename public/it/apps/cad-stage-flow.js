/* KMR CAD Draft — process-stage drawings.
   Instead of the finished drawing with red / grey dimensions, each operation of the route gets the part as it is
   at that stage:
     Raw material  the bar as bought, with all its data
     Sawing        the sawn blank with its dimensions and allowances
     CNC turning   one side held in the chuck (clamping area), the other side turned to profile, dimensions, datum,
                   work zero, tool path lines and the tools
     Next turning  held on the finished side, the other end turned
     Machining     the finished turned part with the hole pattern / features made at that operation
     Heat treat, grinding, deburring … the part with what is done at that operation
   The shape comes from the drawing (silhouette around the centre line) or from the numbers typed in "Part shape".
   Everything is drawn as real CAD objects (lines, dimensions, text, tables) so the sheets can be edited. */
(function (K) {
  "use strict";
  const G = K.geom, esc = K.esc, TAU = Math.PI * 2, F = (K.stageFlow = {});
  const PW = 420, PH = 297, RED = "#e11d48", GREY = "#9aa3ad", BLUE = "#0369a1", AMBER = "#b45309", INK = "#111111";
  const DA = { x0: 14, y0: 46, x1: 296, y1: 283 }, TB = { x0: 300, y0: 46, x1: 406, y1: 283 };
  const r2 = (v) => Math.round(v * 100) / 100, num = (s) => { const m = String(s == null ? "" : s).replace(/,/g, ".").match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };
  const BARS = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 30, 32, 35, 38, 40, 42, 45, 48, 50, 55, 60, 63, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 130, 140, 150, 160, 170, 180, 190, 200, 220, 250, 280, 300, 350, 400];
  const stockFor = (od) => BARS.find((b) => b >= od + 0.3) || Math.ceil(od + 1);
  let mctx = null; const wOf = (s, h) => { if (!mctx) { mctx = document.createElement("canvas").getContext("2d"); mctx.font = "100px Arial, Helvetica, sans-serif"; } return (mctx.measureText(s).width / 100) * (h / 0.716); };
  const fit = (s, h, w) => { s = String(s == null ? "" : s); if (wOf(s, h) <= w) return s; while (s.length > 1 && wOf(s + "…", h) > w) s = s.slice(0, -1); return s.trimEnd() + "…"; };
  const SYMW = { "⌖": "POS", "⊥": "PERP", "↗": "RUNOUT", "⌰": "T.RUNOUT", "∥": "PARL", "⏥": "FLAT", "○": "ROUND", "⌭": "CYL", "◎": "CONC", "⌒": "PROF", "⌓": "PROF", "∠": "ANG", "⌯": "SYM", "⏤": "STRT", "◆": "CC", "▼": "SC", "◇": "KC" };
  const plain = (s) => String(s == null ? "" : s).replace(/[⌖⊥↗⌰∥⏥○⌭◎⌒⌓∠⌯⏤◆▼◇]/g, (c) => SYMW[c] + " ").replace(/[⌀∅]/g, "Ø").replace(/[–—−]/g, "-").replace(/[^\x20-\x7E -ÿͰ-Ͽ°±Ø]/g, "").replace(/\s+/g, " ").trim();

  /* =============================================================== the part's shape =============================================================== */
  /** steps from the left end: [{d, l}] ; bore {d, depth, end:"L"|"R"|"T"} ; from the lines of a drawing (silhouette around the axis) */
  F.silhouette = (doc) => {
    const skipL = /dim|hatch|text|title|border|frame|defpoint|centre|center|note|symbol|balloon|table/i;
    const hs = [], vs = [], hid = [];
    const lt = (e) => String(e.lt || (doc.layers.find((l) => l.name === e.layer) || {}).lt || "").toUpperCase();
    for (const e of doc.ents) {
      if (!["line", "pline", "arc", "circle"].includes(e.t) || skipL.test(e.layer || "")) continue; const t = lt(e); if (/CENTER|PHANTOM|DASHDOT/.test(t)) continue;
      let segs; try { segs = K.segs(e, doc); } catch (er) { continue; } const hidden = /HIDDEN|DASH/.test(t);
      for (const s of segs) {
        if (s.k !== "s") continue; const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], L = Math.hypot(dx, dy); if (L < 1e-6) continue;
        if (Math.abs(dy) <= 1e-3 * L + 1e-6) (hidden ? hid : hs).push({ y: (s.a[1] + s.b[1]) / 2, x0: Math.min(s.a[0], s.b[0]), x1: Math.max(s.a[0], s.b[0]) });
        else if (Math.abs(dx) <= 1e-3 * L + 1e-6) (hidden ? [] : vs).push({ x: (s.a[0] + s.b[0]) / 2, y0: Math.min(s.a[1], s.b[1]), y1: Math.max(s.a[1], s.b[1]) });
      }
    }
    const tryAxis = (H, flip) => {
      // pairs of horizontal lines that mirror each other about an axis
      const votes = new Map(); const q = (v) => Math.round(v * 20) / 20;
      for (let i = 0; i < H.length; i++) for (let j = i + 1; j < H.length; j++) {
        const a = H[i], b = H[j], lo = Math.max(a.x0, b.x0), hi = Math.min(a.x1, b.x1); if (hi - lo < 1) continue; const ax = (a.y + b.y) / 2, r = Math.abs(a.y - b.y) / 2; if (r < 0.4) continue;
        const k = q(ax); const v = votes.get(k) || { ax, w: 0, pairs: [] }; v.w += hi - lo; v.pairs.push({ x0: lo, x1: hi, r }); votes.set(k, v);
      }
      let best = null; for (const v of votes.values()) if (!best || v.w > best.w) best = v; return best;
    };
    let best = tryAxis(hs), horiz = true;
    if (!best || best.pairs.length < 2) {
      // a part drawn standing up: turn the vertical lines the same way
      const V2 = vs.map((v) => ({ y: v.x, x0: v.y0, x1: v.y1 })); const b2 = tryAxis(V2); if (b2 && (!best || b2.w > best.w)) { best = b2; horiz = false; }
    }
    if (!best || best.pairs.length < 2) return null;
    const P = best.pairs.filter((p) => p.x1 - p.x0 >= 0.8); if (P.length < 2) return null;
    const xs = [...new Set(P.flatMap((p) => [p.x0, p.x1]).map((v) => Math.round(v * 100) / 100))].sort((a, b) => a - b); if (xs.length < 2) return null;
    // outer radius over each interval = the largest pair that covers it; a smaller pair touching an end is a bore
    const out = []; for (let i = 0; i + 1 < xs.length; i++) { const a = xs[i], b = xs[i + 1], m = (a + b) / 2; const cov = P.filter((p) => p.x0 <= m && p.x1 >= m).map((p) => p.r).sort((u, v) => v - u); if (!cov.length) continue; out.push({ x0: a, x1: b, r: cov[0], inner: cov.slice(1) }); }
    if (!out.length) return null;
    const merged = []; for (const s of out) { const l = merged[merged.length - 1]; if (l && Math.abs(l.r - s.r) < 0.02 && Math.abs(l.x1 - s.x0) < 0.05) { l.x1 = s.x1; l.inner = l.inner.length ? l.inner : s.inner; } else merged.push(Object.assign({}, s)); }
    // keep the largest connected run (the body), drop stray pieces
    const body = []; let cur = []; for (const s of merged) { if (cur.length && Math.abs(cur[cur.length - 1].x1 - s.x0) > 0.05) { body.push(cur); cur = []; } cur.push(s); } if (cur.length) body.push(cur);
    body.sort((a, b) => b.reduce((t, s) => t + (s.x1 - s.x0), 0) - a.reduce((t, s) => t + (s.x1 - s.x0), 0)); const steps = body[0]; if (!steps || steps.reduce((t, s) => t + (s.x1 - s.x0), 0) < 3) return null;
    const x0 = steps[0].x0, xe = steps[steps.length - 1].x1;
    // a bore: a smaller pair (continuous or hidden) that starts at an end face
    let bore = null;
    for (const end of ["L", "R"]) {
      const edge = end === "L" ? x0 : xe, near = P.filter((p) => (end === "L" ? Math.abs(p.x0 - edge) < 0.3 : Math.abs(p.x1 - edge) < 0.3) && p.r < (end === "L" ? steps[0].r : steps[steps.length - 1].r) - 0.4);
      if (near.length) { const p = near.sort((u, v) => v.r - u.r)[0]; const depth = end === "L" ? p.x1 - edge : edge - p.x0; if (depth > 1) { bore = { d: r2(p.r * 2), depth: r2(depth), end }; break; } }
    }
    if (!bore) for (const h of hid) { if (Math.abs(h.y - best.ax) > 1e-9) { const r = Math.abs(h.y - best.ax); if (r > 0.8 && r < steps[0].r && (Math.abs(h.x0 - x0) < 0.3 || Math.abs(h.x1 - xe) < 0.3)) { const left = Math.abs(h.x0 - x0) < 0.3; bore = { d: r2(r * 2), depth: r2(h.x1 - h.x0), end: left ? "L" : "R" }; break; } } }
    return { steps: steps.map((s) => ({ d: r2(s.r * 2), l: r2(s.x1 - s.x0) })), bore, L: r2(xe - x0), source: "drawing", horiz, ax: best.ax, x0, rmax: Math.max(...steps.map((s) => s.r)) };
  };

  /** from the numbers in the plan when no drawing geometry can be used: one cylinder, the user corrects it in "Part shape" */
  F.fromPlan = (P) => {
    const ci = P.ctxInfo || {}, chars = P.chars || [], dia = chars.filter((c) => c.type === "Diameter" && num(c.nominal != null ? c.nominal : c.spec) > 0).map((c) => num(c.nominal != null ? c.nominal : c.spec)).filter((v) => !/PCD/i.test("")), od = ci.maxOD || (dia.length ? Math.max(...dia) : 50), len = ci.length || Math.max(1.5 * od, 40);
    return { steps: [{ d: r2(od), l: r2(len) }], bore: null, L: r2(len), source: "plan" };
  };
  /** one number string for a tolerance-labelled value */
  const dtxt = (c, d, dia) => { const s = c && plain(c.spec || c.text || ""); if (s && num(s) != null && Math.abs(num(s.replace(/^\d+\s*X\s*/i, "")) - d) < 0.011) return s; return (dia ? "Ø" : "") + String(r2(d)); };

  /* what the sketch needs, from the profile and the plan */
  F.defaults = (P, prof) => {
    const L = prof.steps.reduce((t, s) => t + s.l, 0), maxD = Math.max(...prof.steps.map((s) => s.d)), D0 = stockFor(maxD), fa = 1.5;
    // the end that loses more material is turned first (the other end stays in the jaws as bar) …
    let rl = 0, rr = 0, x = 0; for (const s of prof.steps) { const m = x + s.l / 2, v = (D0 * D0 - s.d * s.d) * s.l; if (m < L / 2) rl += v; else rr += v; x += s.l; }
    let first = rr > rl * 1.05 ? "R" : "L";
    // … unless the plan says which diameters / bore the first turning operation makes
    try {
      const t1 = (P.ops || []).find((o) => o.key === "TURN1" || o.key === "TURN"); const map = (P.freeze && P.freeze.map) || {};
      if (t1) {
        const mm = matchChars(P, { steps: prof.steps, bore: prof.bore || null, L }, P.chars || [], null), xs = []; let a = 0; for (const s of prof.steps) { xs.push([a, a + s.l]); a += s.l; }
        let sum = 0, n = 0; for (const no of map[String(t1.opNo)] || []) { const m = mm.get(+no); if (!m) continue; if (m.kind === "dia") { sum += (xs[m.i][0] + xs[m.i][1]) / 2; n++; } else if (m.kind === "bore" && prof.bore) { sum += prof.bore.end === "L" ? prof.bore.depth / 2 : L - prof.bore.depth / 2; n++; } }
        if (n && Math.abs(sum / n - L / 2) > 0.5) first = sum / n < L / 2 ? "L" : "R";
      }
    } catch (e) { /* keep the material rule */ }
    const clampMax = Math.max(8, Math.floor(((L + 2 * fa) * 0.4) / 5) * 5);
    return { D0, fa, clamp: Math.max(8, Math.min(40, Math.round(D0 * 0.5 / 5) * 5, clampMax)), first, L, maxD, bar: { len: "3000 – 6000 mm", tol: D0 > 25 ? "h11" : "h10", cond: "Hot rolled, annealed / as per purchase order", cert: "EN 10204 type 3.1 mill test certificate" } };
  };

  /* =============================================================== the stages =============================================================== */
  const DRAW_OPS = new Set(["RMI", "CUT", "TURN1", "TURN2", "TURN", "VMC", "DRILL", "HOB", "BROACH", "DEBURR", "HT", "CGRIND", "IGRIND", "SGRIND", "HONE"]);
  F.stages = (P, map, chars) => {
    const hasChars = (o) => (map[String(o.opNo)] || []).some((n) => { const c = chars.get(+n); return c && c.type !== "Material" && c.type !== "Note"; });
    return (P.ops || []).filter((o) => DRAW_OPS.has(o.key) || hasChars(o));
  };
  const KIND = { RMI: "raw", CUT: "saw", TURN1: "turn1", TURN2: "turn2", TURN: "turn", VMC: "feat", DRILL: "feat", HOB: "feat", BROACH: "feat", DEBURR: "deburr", HT: "ht", CGRIND: "grind", IGRIND: "grind", SGRIND: "grind", HONE: "grind" };
  F.kindOf = (o) => KIND[o.key] || "feat";

  /** the part (zones along the axis) at a stage: [{x0, x1, r, role: this|before|stock|allow}] in part coordinates, x = 0 at the first turned face */
  function zones(model, kind, mine) {
    const { steps, D0, fa, clamp } = model, R0 = D0 / 2, L = model.L, Z = []; let x = 0; const fin = steps.map((s) => { const z = { x0: x, x1: x + s.l, r: s.d / 2 }; x += s.l; return z; });
    const cut = (zs, a, b, role) => zs.map((z) => ({ x0: Math.max(z.x0, a), x1: Math.min(z.x1, b), r: z.r, role, i: z.i })).filter((z) => z.x1 - z.x0 > 1e-6);
    fin.forEach((z, i) => (z.i = i));
    // the first side is turned as far as a whole step allows while the rest of the blank stays in the jaws
    const ends = fin.map((z) => z.x1).filter((v) => v < L - 1e-6), avail = L + fa - clamp - 1.5;
    let xt = ends.filter((v) => v <= avail + 1e-6).pop(); if (xt == null) xt = ends.length ? ends[0] : Math.max(Math.min(L, avail), 0.35 * L);
    if (kind === "raw") return { zs: [{ x0: -fa, x1: L + fa, r: R0, role: "stock" }], xt: L + fa };
    if (kind === "saw") return { zs: [{ x0: -fa, x1: L + fa, r: R0, role: "this" }], xt: L + fa };
    if (kind === "turn1") { const c0 = Math.min(Math.max(L + fa - clamp, xt + 1.5), L + fa - 5); Z.push(...cut(fin, 0, xt, "this"), { x0: xt, x1: L + fa, r: R0, role: "stock" }); return { zs: Z, xt, clamp: [c0, L + fa] }; }
    if (kind === "turn2") { Z.push(...cut(fin, 0, xt, "before"), ...cut(fin, xt, L, "this")); const c2 = Math.min(clamp, fin[0].x1 - fin[0].x0); return { zs: Z, xt, clamp: [0, c2], clampR: fin[0].r }; }
    if (kind === "turn") { Z.push(...cut(fin, 0, L, "this"), { x0: L, x1: L + fa + 4 + clamp, r: R0, role: "stock" }); return { zs: Z, xt: L, clamp: [L + fa + 4, L + fa + 4 + clamp] }; }
    // later stages: the finished turned part; steps made here are highlighted
    Z.push(...fin.map((z) => ({ x0: z.x0, x1: z.x1, r: z.r, role: mine && mine.has(z.i) ? "this" : "before", i: z.i }))); return { zs: Z, xt: L };
  }

  /* chars → features of the sketch (diameters of steps, lengths between faces, the bore) */
  function matchChars(P, model, chars, mineNos) {
    const out = new Map(); const steps = model.steps; let x = 0; const xs = steps.map((s) => { const a = x; x += s.l; return [a, x]; });
    for (const c of chars) {
      const n = num(c.nominal != null && c.nominal !== "" ? c.nominal : c.spec); if (n == null || c.type === "Note" || c.type === "Material") continue;
      if (c.type === "Diameter" && !/PCD|THRU|^\d+\s*X/i.test(c.text || c.spec || "")) { const i = steps.findIndex((s) => Math.abs(s.d - n) < 0.011); if (i >= 0) { out.set(+c.no, { kind: "dia", i }); continue; } if (model.bore && Math.abs(model.bore.d - n) < 0.011) out.set(+c.no, { kind: "bore" }); }
      else if (c.type === "Linear" && !/DEEP/i.test(c.text || "")) {
        const i = steps.findIndex((s) => Math.abs(s.l - n) < 0.011); if (i >= 0) { out.set(+c.no, { kind: "len", a: xs[i][0], b: xs[i][1] }); continue; }
        if (Math.abs(model.L - n) < 0.011) { out.set(+c.no, { kind: "len", a: 0, b: model.L }); continue; }
        const j = xs.findIndex((p) => Math.abs(p[1] - n) < 0.011); if (j >= 0) out.set(+c.no, { kind: "len", a: 0, b: xs[j][1] });
      }
    }
    return out;
  }

  /* =============================================================== drawing =============================================================== */
  const U = (o) => Object.assign({ id: K.uid(), color: null, lt: null, lw: null }, o);
  /** draw one stage sheet into doc; returns {dims, balloons, missing} */
  F.sheet = (doc, P, st, ctx) => {
    const { ox, model, chars, map, sopSec, co, H, pageNo, pages, mach } = ctx, op = st.op, kind = st.kind, mineNos = (map[String(op.opNo)] || []).map(Number), mineSet = new Set(mineNos);
    const E2 = [], add = (e) => { E2.push(U(e)); return e; };
    const X0 = ox, P0 = (x, y) => [X0 + x, y];
    const T = (x, y, h, s, ha = 0, layer = "STG-FRAME", va = 0, extra = {}) => add(Object.assign({ t: "text", layer, p: P0(x, y), h, s: String(s == null ? "" : s), rot: 0, ha, va }, extra));
    const L = (x0, y0, x1, y1, layer = "STG-FRAME", extra = {}) => add(Object.assign({ t: "line", layer, a: P0(x0, y0), b: P0(x1, y1) }, extra));
    const style = { this: { color: RED, lw: 0.6, stg: "this" }, before: { color: null, lw: 0.35, stg: "model" }, stock: { color: null, lw: 0.25, stg: "stock" }, allow: { color: GREY, lt: "DASHED", lw: 0.18, stg: "done" }, tool: { color: BLUE, lw: 0.3, stg: "tool" }, clamp: { color: AMBER, lw: 0.35, stg: "clamp" }, dim: { color: null, stg: "model" } };
    const rep = { dims: 0, balloons: 0, missing: [] };

    /* ---- the frame and title block (same as the other stage sheets) ---- */
    add({ t: "pline", layer: "STG-FRAME", closed: true, lw: 0.7, pts: [P0(10, 10), P0(410, 10), P0(410, 287), P0(10, 287)].map((p) => [p[0], p[1], 0]) });
    L(10, 42, 410, 42); L(298, 42, 298, 287); L(100, 10, 100, 42); L(100, 26, 410, 26); for (let i = 1; i < 4; i++) L(100 + i * 77.5, 10, 100 + i * 77.5, 42);
    T(14, 33, 5.2, "STAGE DRAWING"); T(14, 24.5, 3.4, fit(plain(`OP ${op.opNo} · ${String(op.name || "").toUpperCase()}`), 3.4, 83)); T(14, 15, 2.4, fit(plain(co), 2.4, 83));
    const sec = sopSec.get(String(op.opNo)), stgNo = `${(sec && sec.docNo) || "STG-" + (P.part_no || "")}${sec && sec.docNo ? "-STG" : "-" + op.opNo}`;
    const cells = [["Part no.", P.part_no || H.partNo], ["Part name", P.part_name || H.partName], ["Drawing no. / rev", [H.drawingNo || P.drawing_no, H.drawingRev || P.rev].filter(Boolean).join(" / rev ")], ["Customer", P.customer || H.customer],
      ["Machine", op.machine || "—"], ["Stage drawing no.", stgNo], ["Dimensions frozen", `rev ${P.freeze.rev} · ${ctx.dmy(P.freeze.at)}`], ["Sheet", `Op ${op.opNo} · sheet ${(ctx.sub || { k: 1 }).k} of ${(ctx.sub || { n: 1 }).n}`]];
    cells.forEach(([lab, val], i) => { const cx = 100 + (i % 4) * 77.5, cy = i < 4 ? 26 : 10; T(cx + 2, cy + 12, 1.9, lab); T(cx + 2, cy + 3.6, 3, fit(plain(val || "—"), 3, 73)); });

    /* ---- geometry of this stage ---- */
    const isTurn = kind === "turn1" || kind === "turn2" || kind === "turn", R0 = model.D0 / 2, fa = model.fa, bore = model.bore;
    const Z = zones(model, kind), zs = Z.zs.slice(), cz = Z.clamp;
    const NICE = [5, 4, 2.5, 2, 1.5, 1, 0.8, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1, 0.075, 0.05, 0.04, 0.025, 0.02, 0.01], xmin0 = Math.min(...zs.map((z) => z.x0)); let xmax0 = Math.max(...zs.map((z) => z.x1));
    const Rmax = Math.max(...zs.map((z) => z.r), R0);
    const chuckRight = !!(isTurn && cz && (cz[0] + cz[1]) / 2 > (xmin0 + xmax0) / 2), dimLeft = isTurn && chuckRight;
    const boreOn = !!bore && (kind === "turn1" ? bore.end === "L" : kind === "turn" || ["turn2", "feat", "ht", "grind", "deburr"].includes(kind));
    const turnedZ = (isTurn ? zs.filter((z) => z.role === "this") : zs.filter((z) => z.role !== "stock")).filter((z, i, a) => a.findIndex((q) => Math.abs(q.r - z.r) < 1e-6) === i);
    turnedZ.forEach((z) => { if (z.i == null) z.i = model.steps.findIndex((s) => Math.abs(s.d / 2 - z.r) < 1e-6); });
    const labelFor = (i) => { const n = [...ctx.match.entries()].find(([no, m]) => m.kind === "dia" && m.i === i && mineSet.has(no)); return n ? { c: chars.get(n[0]), no: n[0] } : null; };
    // vertical (diameter) dimensions, smallest nearest the part
    const vd = [];
    if (kind === "raw" || kind === "saw") vd.push({ r: R0, txt: `Ø${model.D0}${kind === "raw" ? " " + model.bar.tol : ""}`, red: kind === "saw", xf: xmax0 });
    else {
      for (const z of turnedZ) { const lab = labelFor(z.i), c = lab && lab.c; vd.push({ r: z.r, txt: dtxt(c, z.r * 2, true), red: !!lab || isTurn, no: lab && lab.no, xf: dimLeft ? z.x0 : z.x1 }); }
      const bm = boreOn && [...ctx.match.entries()].find(([no, m]) => m.kind === "bore" && mineSet.has(no));
      if (bm) vd.push({ r: bore.d / 2, txt: dtxt(chars.get(bm[0]), bore.d, true), red: true, no: bm[0], xf: bore.end === "L" ? 0 : model.L });
    }
    vd.sort((a, b) => a.r - b.r);
    if (kind === "raw") { const k0 = NICE.find((v) => v <= Math.min(112 / (2 * Rmax), 5)) || 1; zs[0].x1 = zs[0].x0 + 120 / k0; xmax0 = zs[0].x1; vd[0].xf = xmax0; }   // the bar is long: show a stretch of it between two break lines
    const nd = vd.length, dimsW = nd ? nd * 11 + 8 : 0, sawPad = kind === "saw" ? 44 : 0;
    const padL = (dimLeft ? dimsW : 0) + (isTurn ? (chuckRight ? 14 : 20) : 8) + sawPad, padR = (!dimLeft ? dimsW : 0) + (isTurn ? (chuckRight ? 20 : 14) : 8);
    const VW = 176, ah = 112, ext0 = Math.max(xmax0 - xmin0, 1e-6);
    let k = Math.min(Math.max(60, VW - padL - padR) / ext0, ah / (2 * Rmax + 1e-6), 5); k = NICE.find((v) => v <= k) || k;
    const scTxt = k >= 1 ? `${k}:1` : `1:${r2(1 / k)}`;
    const yc = 196, partL = X0 + DA.x0 + 6 + padL + Math.max(0, (VW - padL - padR - ext0 * k) / 2);
    const X = (x) => partL + (x - xmin0) * k, Y = (r) => yc + r * k;
    if (kind === "saw") zs.unshift({ x0: xmin0 - 40 / k, x1: xmin0, r: R0, role: "stock" });
    const rAt = (x) => { const v = zs.filter((z) => z.x0 - 1e-6 <= x && z.x1 + 1e-6 >= x).map((z) => z.r); return v.length ? Math.max(...v) : Rmax; };
    // small drawing helpers (absolute sheet coordinates)
    const seg = (a, b, st, layer = "STG-GEO") => add(Object.assign({ t: "line", layer, a, b }, st));
    const poly = (pts, st, closed = false, layer = "STG-GEO") => add(Object.assign({ t: "pline", layer, closed, pts: pts.map((p) => [p[0], p[1], 0]) }, st));
    const txt = (x, y, h, s, ha, st, layer = "STG-GEO", va = 0) => add({ t: "text", layer, p: [x, y], h, s: String(s), rot: 0, ha, va, color: (st && st.color) || null, stg: (st && st.stg) || "model" });
    const arrow = (x, y, dx, dy, col, stg) => { const s = 1.9, nx = -dy, ny = dx; add({ t: "hatch", layer: "STG-GEO", solid: true, loops: [[[x, y], [x - dx * s * 2 + nx * s * 0.8, y - dy * s * 2 + ny * s * 0.8], [x - dx * s * 2 - nx * s * 0.8, y - dy * s * 2 - ny * s * 0.8]]], color: col, stg }); };
    const dim = (d, red) => { rep.dims++; add(Object.assign({ t: "dim", layer: "STG-DIM", kind: "lin" }, d, red ? { color: RED, stg: "this" } : { stg: "model" })); };
    const BR = 3.6, balled = new Set();
    const bl = (no, c, a) => {
      const cc = chars.get(no); if (!cc || balled.has(no)) return; balled.add(no);
      add({ t: "circle", layer: "STG-BALLOON", c, r: BR, stg: "balloon", no }); add({ t: "text", layer: "STG-BALLOON", p: c, h: no >= 100 ? 2.5 : 3, s: String(no), rot: 0, ha: 1, va: 2, stg: "balloon", no });
      const d = Math.hypot(a[0] - c[0], a[1] - c[1]) || 1; add({ t: "line", layer: "STG-BALLOON", a: [c[0] + (a[0] - c[0]) * BR / d, c[1] + (a[1] - c[1]) * BR / d], b: a, stg: "balloon", no });
      if (cc.cls) add({ t: "text", layer: "STG-BALLOON", p: [c[0], c[1] + BR + 0.9], h: 2.2, s: String(cc.cls), rot: 0, ha: 1, va: 0, stg: "balloon", no });
      rep.balloons++;
    };
    const callouts = [];      // text in the column on the right, joined to the feature by a thin leader

    /* ---- the part: outlines, walls, end faces / break lines ---- */
    const S = (z) => (z.role === "this" ? style.this : z.role === "stock" ? style.stock : style.before);
    for (let i = 0; i < zs.length; i++) {
      const z = zs[i], s = S(z); seg([X(z.x0), Y(z.r)], [X(z.x1), Y(z.r)], s); seg([X(z.x0), Y(-z.r)], [X(z.x1), Y(-z.r)], s);
      const n = zs[i + 1]; if (n && Math.abs(n.x0 - z.x1) < 1e-6 && Math.abs(z.r - n.r) > 1e-6) { const lo = Math.min(z.r, n.r), hi = Math.max(z.r, n.r), w = S(z.r > n.r ? z : n); seg([X(z.x1), Y(lo)], [X(z.x1), Y(hi)], w); seg([X(z.x1), Y(-lo)], [X(z.x1), Y(-hi)], w); }
    }
    const brk = (x, r, s) => poly([[X(x), Y(-r)], [X(x) + 2, Y(-r * 0.55)], [X(x) - 2, Y(-r * 0.2)], [X(x) + 2, Y(r * 0.2)], [X(x) - 2, Y(r * 0.55)], [X(x), Y(r)]], s);
    const zf = zs[0], zl = zs[zs.length - 1], face = (z, x, s) => seg([X(x), Y(-z.r)], [X(x), Y(z.r)], s);
    if (kind === "raw") { brk(zf.x0, zf.r, S(zf)); brk(zl.x1, zl.r, S(zl)); }
    else if (kind === "saw") { brk(zf.x0, zf.r, S(zf)); face(zl, zl.x1, S(zl)); face(zl, xmin0, style.this); }
    else { face(zf, zf.x0, S(zf)); face(zl, zl.x1, S(zl)); }
    // bore (hidden lines), drawn from the end it is made
    if (boreOn) { const a = bore.end === "L" ? 0 : model.L - bore.depth, b = bore.end === "L" ? bore.depth : model.L, hid = { lt: "HIDDEN", lw: 0.25, color: null, stg: "model" }; for (const sg of [1, -1]) seg([X(a), Y(sg * bore.d / 2)], [X(b), Y(sg * bore.d / 2)], hid); seg([X(bore.end === "L" ? b : a), Y(-bore.d / 2)], [X(bore.end === "L" ? b : a), Y(bore.d / 2)], hid); }
    seg([X(xmin0) - 8, yc], [X(xmax0) + 8, yc], { lt: "CENTER", lw: 0.18, color: null, stg: "stock" });
    // stock still to be removed at this operation (grey dashes)
    const dash = style.allow;
    if (kind === "turn1" || kind === "turn") { poly([[X(0), Y(-R0)], [X(-fa), Y(-R0)], [X(-fa), Y(R0)], [X(0), Y(R0)]], dash); for (const z of zs) if (z.role === "this" && z.r < R0 - 0.01) for (const sg of [1, -1]) seg([X(z.x0), Y(sg * R0)], [X(z.x1), Y(sg * R0)], dash); }
    if (kind === "turn2") poly([[X(model.L), Y(-zl.r)], [X(model.L + fa), Y(-R0)], [X(model.L + fa), Y(R0)], [X(model.L), Y(zl.r)]], dash);

    /* ---- clamping, datum, work zero, tool path ---- */
    const JH = 13;
    const jawsAt = (a, b, rr, bodyRight, body) => {
      const x1 = X(a), x2 = X(b), yT = Y(rr), yB = Y(-rr), cl = style.clamp;
      for (const sg of [1, -1]) { const y0 = sg > 0 ? yT : yB, y1 = y0 + sg * JH; poly([[x1, y0], [x2, y0], [x2, y1], [x1, y1]], cl, true); for (let xx = x1 + 2; xx < x2 - 0.5; xx += 2.2) seg([xx, y0], [Math.min(xx + 2.4, x2), y0 + sg * JH], Object.assign({}, cl, { lw: 0.13 })); }
      let edge = [x2, yT + JH / 2];
      if (body) { const bx = bodyRight ? x2 : x1, cx = bx + (bodyRight ? 16 : -16); poly([[bx, yT + JH + 6], [cx, yT + JH + 6], [cx, yB - JH - 6], [bx, yB - JH - 6]], cl); seg([bx, yT], [bx, yT + JH + 6], cl); seg([bx, yB], [bx, yB - JH - 6], cl); edge = [cx, yT + JH / 2]; }
      return { x1, x2, yT, yB, edge, top: [(x1 + x2) / 2, yT + JH] };
    };
    const datum = (px, py, letter) => {      // triangle touching the feature at (px,py), stem up to a framed letter
      add({ t: "hatch", layer: "STG-GEO", solid: true, loops: [[[px, py], [px - 1.9, py + 3.6], [px + 1.9, py + 3.6]]], color: null, stg: "model" });
      seg([px, py + 3.6], [px, py + 7], { lw: 0.25, stg: "model" }); poly([[px - 3, py + 7], [px + 3, py + 7], [px + 3, py + 13], [px - 3, py + 13]], { lw: 0.35, stg: "model" }, true); txt(px, py + 10, 3.4, letter, 1, { stg: "model" }, "STG-GEO", 2);
    };
    let clampTxt = "", datumTxt = "", clampDim = null, axRows = 0;
    if (isTurn) {
      const rr = Z.clampR || R0, soft = kind === "turn2", j = jawsAt(cz[0], cz[1], rr, chuckRight, true), clen = r2(cz[1] - cz[0]);
      clampTxt = `${soft ? "Soft jaws on Ø" + r2(rr * 2) + " (finished)" : "3-jaw chuck on Ø" + model.D0 + " (bar)"} · clamp length ${clen} mm`;
      callouts.push({ s: (soft ? "SOFT JAWS" : "3-JAW CHUCK") + " — CLAMPING AREA", a: chuckRight ? j.edge : [j.x2, j.yT + JH / 2], st: style.clamp, y: j.yT + JH / 2 });
      // clamp length under the jaws
      clampDim = () => dim({ dir: "h", p1: [j.x1, j.yB - JH], p2: [j.x2, j.yB - JH], loc: [(j.x1 + j.x2) / 2, j.yB - JH - 11], txt: String(clen), color: AMBER, stg: "clamp" });
      // datum A = the clamped diameter (above the jaws), datum B = the machined face (turn 1) / the face seated on the jaws (turn 2)
      datum(j.x1 + (j.x2 - j.x1) * 0.25, j.yT + JH, "A");
      const bx = kind === "turn2" ? cz[1] : 0, bTop = Y(Rmax) + 12; seg([X(bx), Y(rAt(bx))], [X(bx), bTop], { lw: 0.2, stg: "model" }); datum(X(bx), bTop, "B");
      datumTxt = `Datum A = clamped diameter (axis) · Datum B = ${kind === "turn2" ? "shoulder seated on the jaws" : "first finished face (Z0)"}`;
      // work zero on the free end face
      const fx = kind === "turn2" ? model.L : 0, zx = X(fx);
      add({ t: "circle", layer: "STG-GEO", c: [zx, yc], r: 2.2, stg: "model", lw: 0.25 }); seg([zx - 4, yc], [zx + 4, yc], { stg: "model", lw: 0.25 }); seg([zx, yc - 4], [zx, yc + 4], { stg: "model", lw: 0.25 });
      txt(zx + (kind === "turn2" ? -3.5 : 3.5), yc - 5.5, 2.2, "G54 · Z0 X0", kind === "turn2" ? 2 : 0, { stg: "model" });
      // tool path: rough passes (dash-dot), finish pass, facing and the approach
      const dirR = kind === "turn2" ? -1 : 1, seq = turnedZ.slice().sort((a, b) => (dirR > 0 ? a.x0 - b.x0 : b.x0 - a.x0));
      const path = (off) => { const pts = []; for (const z of seq) { const a = dirR > 0 ? z.x0 : z.x1, b = dirR > 0 ? z.x1 : z.x0; pts.push([X(a), Y(z.r) + off, 0], [X(b), Y(z.r) + off, 0]); } return pts; };
      if (seq.length) {
        const pr = path(1.6), pf = path(0.7); poly(pr, Object.assign({}, style.tool, { lt: "DASHDOT" }), false, "STG-TOOL"); poly(pf, style.tool, false, "STG-TOOL");
        const st0 = pf[0], en = pf[pf.length - 1]; seg([st0[0] - dirR * 12, st0[1] + 9], [st0[0], st0[1]], Object.assign({}, style.tool, { lt: "DASHED" }), "STG-TOOL"); arrow(st0[0], st0[1], dirR * 0.8, -0.6, BLUE, "tool"); arrow(en[0], en[1], dirR, 0, BLUE, "tool");
        const fxx = kind === "turn2" ? X(model.L + fa) + 3 : X(-fa) - 3; seg([fxx, Y(R0) + 4], [fxx, yc], Object.assign({}, style.tool, { lt: "DASHDOT" }), "STG-TOOL"); arrow(fxx, yc, 0, -1, BLUE, "tool");
      }
      if (kind === "turn") { const px = X(model.L + 0.5 * fa); seg([px, Y(R0) + 8], [px, yc], Object.assign({}, style.tool, { lt: "DASHDOT" }), "STG-TOOL"); arrow(px, yc, 0, -1, BLUE, "tool"); txt(px + 2, Y(R0) + 9, 2.2, "T03 PART-OFF", 0, style.tool, "STG-TOOL"); }
    } else if (kind === "saw") {
      const cx = X(-fa); seg([cx, Y(R0) + 10], [cx, Y(-R0) - 10], Object.assign({}, style.tool, { lt: "DASHDOT" }), "STG-TOOL");
      callouts.push({ s: "SAW CUT", a: [cx, Y(R0) + 10], st: style.tool, y: Y(R0) + 10 });
      const j = jawsAt(-fa - 36 / k, -fa - 12 / k, R0, false, false); callouts.push({ s: "VICE JAWS — BAR HELD HERE", a: j.top, st: style.clamp, y: j.top[1] });
      clampTxt = "Bar held in the saw vice, clear of the cut"; datumTxt = "Datum: cut face (square to the bar axis)";
    }

    /* ---- dimensions (diameters in columns beside the part, lengths in rows under it) ---- */
    vd.forEach((d, j) => {
      const col = dimLeft ? X(xmin0) - 14 - j * 11 : X(xmax0) + 14 + j * 11;
      dim({ dir: "v", p1: [X(d.xf), Y(-d.r)], p2: [X(d.xf), Y(d.r)], loc: [col, yc], txt: d.txt }, d.red);
      if (d.no != null) bl(d.no, [col, Y(d.r) + 9], [col, Y(d.r) + 0.4]);
    });
    if (kind === "raw") dim({ dir: "h", p1: [X(zf.x0), Y(-R0)], p2: [X(zl.x1), Y(-R0)], loc: [(X(zf.x0) + X(zl.x1)) / 2, Y(-R0) - 14], txt: `${model.bar.len} (supplied)` }, false);
    else if (kind === "saw") {
      const r0 = Y(-R0) - 14, r1 = Y(-R0) - 26;
      dim({ dir: "h", p1: [X(-fa), Y(-R0)], p2: [X(0), Y(-R0)], loc: [(X(-fa) + X(0)) / 2, r0], txt: String(fa) }, false);
      dim({ dir: "h", p1: [X(0), Y(-R0)], p2: [X(model.L), Y(-R0)], loc: [(X(0) + X(model.L)) / 2, r0], txt: String(r2(model.L)) }, false);
      dim({ dir: "h", p1: [X(model.L), Y(-R0)], p2: [X(model.L + fa), Y(-R0)], loc: [(X(model.L) + X(model.L + fa)) / 2, r0], txt: String(fa) }, false);
      dim({ dir: "h", p1: [X(-fa), Y(-R0)], p2: [X(model.L + fa), Y(-R0)], loc: [(X(-fa) + X(model.L + fa)) / 2, r1], txt: `${r2(model.L + 2 * fa)} ±1 (sawn length)` }, true);
    } else {
      const faceX = kind === "turn2" ? model.L : 0, dirx = kind === "turn2" ? -1 : 1, marks = new Set(), addMark = (v) => { v = r2(v); if (Math.abs(v - faceX) > 0.01) marks.add(v); };
      for (const z of turnedZ) addMark(kind === "turn2" ? z.x0 : z.x1); if (kind === "turn2") addMark(0); else if (!isTurn) addMark(model.L);
      const list = [...marks].sort((a, b) => Math.abs(a - faceX) - Math.abs(b - faceX)).slice(0, 3), base = isTurn ? 36 : 14; axRows = list.length;
      list.forEach((v, i) => {
        const m = [...ctx.match.entries()].find(([no, mm]) => mm.kind === "len" && mineSet.has(no) && Math.abs(Math.abs(mm.b - mm.a) - Math.abs(v - faceX)) < 0.011), c = m && chars.get(m[0]), ry = Y(-Rmax) - base - i * 10;
        dim({ dir: "h", p1: [X(faceX), Y(-rAt(faceX))], p2: [X(v), Y(-rAt(v))], loc: [(X(faceX) + X(v)) / 2, ry], txt: c ? plain(c.spec) || String(r2(Math.abs(v - faceX))) : String(r2(Math.abs(v - faceX))) }, !!m);
        if (m) bl(m[0], [X(faceX) - dirx * 8, ry], [X(faceX) - dirx * 1.4, ry]);
      });
    }

    if (clampDim) clampDim();

    /* ---- end view (round bar section / hole pattern) ---- */
    if (["raw", "saw", "feat", "deburr", "grind", "ht"].includes(kind)) {
      const D = kind === "raw" || kind === "saw" ? model.D0 : model.maxD, ex = X0 + DA.x1 - 38, ey = 152, kk = Math.min(40 / D, 1.2);
      add({ t: "circle", layer: "STG-GEO", c: [ex, ey], r: D / 2 * kk, stg: kind === "raw" || kind === "saw" ? "stock" : "model", lw: 0.35, color: kind === "saw" ? RED : null });
      if (kind === "feat" || kind === "deburr" || kind === "grind" || kind === "ht") {
        if (model.bore) add({ t: "circle", layer: "STG-GEO", c: [ex, ey], r: model.bore.d / 2 * kk, stg: "model", lw: 0.35, lt: "HIDDEN" });
        const all = [...chars.values()], pc = all.find((c) => /PCD\s*[Ø⌀]?\s*\d/i.test((c.text || "") + " " + (c.spec || ""))), hole = all.find((c) => /^\s*\d+\s*X\s*[Ø⌀]/i.test(c.text || "") && !/M\d/i.test(c.text || ""));
        const pm = pc && String((pc.text || "") + " " + (pc.spec || "")).match(/PCD\s*[Ø⌀]?\s*(\d+(?:[.,]\d+)?)/i);
        if (pm && hole) { const pcd = num(pm[1]), n = +String(hole.text).match(/(\d+)\s*X/i)[1], hd = num(hole.nominal != null ? hole.nominal : hole.text.replace(/^\d+\s*X/i, ""));
          if (pcd > 0 && n > 0 && hd > 0) { const mine = mineSet.has(+hole.no), hs = mine ? { color: RED, lw: 0.6, stg: "this" } : { color: null, lw: 0.35, stg: "model" };
            add({ t: "circle", layer: "STG-GEO", c: [ex, ey], r: pcd / 2 * kk, lt: "CENTER", stg: "stock", lw: 0.18 });
            for (let i = 0; i < n; i++) { const an = Math.PI / 2 + (i * TAU) / n; add(Object.assign({ t: "circle", layer: "STG-GEO", c: [ex + Math.cos(an) * pcd / 2 * kk, ey + Math.sin(an) * pcd / 2 * kk], r: hd / 2 * kk }, hs)); }
            txt(ex, ey - D / 2 * kk - 6, 2.4, `${n} × Ø${r2(hd)}  on PCD ${r2(pcd)}`, 1, hs);
            if (mine) bl(+hole.no, [ex + hd * kk / 2 + 14, ey + pcd / 2 * kk + 4], [ex + hd * kk / 2, ey + pcd / 2 * kk]); } }
      }
      txt(ex, ey + D / 2 * kk + 5, 2.2, kind === "raw" || kind === "saw" ? "SECTION — ROUND BAR" : "END VIEW", 1, { stg: "model" });
    }
    // anything of this operation not drawn on the sketch stays in the table only
    for (const no of mineNos) { const c = chars.get(no); if (c && c.type !== "Material" && c.type !== "Note" && !balled.has(no)) rep.missing.push(no); }

    /* ---- callouts in the column on the right ---- */
    callouts.sort((a, b) => b.y - a.y).forEach((c, i) => { const cx = X0 + DA.x0 + 6 + VW + 8, ty = 270 - i * 8.5; seg([cx, ty + 0.8], c.a, { color: (c.st && c.st.color) || null, lw: 0.2, stg: (c.st && c.st.stg) || "model" }); txt(cx + 2, ty, 2.5, c.s, 0, c.st); });

    /* ---- bottom strip: legend and set-up notes ---- */
    const ly = DA.y0 + 30; T(DA.x0, DA.y0 + 40, 2.6, kind === "raw" ? "RAW MATERIAL — AS RECEIVED" : kind === "saw" ? "SAWN BLANK" : st.title, 0, "STG-FRAME", 0);
    const note = (i, s, colr) => T(DA.x0, ly - i * 5.4, 2.3, fit(plain(s), 2.3, 150), 0, "STG-FRAME", 0, colr ? { color: colr, stg: colr === RED ? "this" : colr === BLUE ? "tool" : "clamp" } : {});
    let ni = 0; if (clampTxt) note(ni++, "Work holding: " + clampTxt, AMBER); if (datumTxt) note(ni++, datumTxt); if (isTurn) note(ni++, "Work zero (G54): " + (kind === "turn2" ? "finished length face, axis" : "first finished face, axis"));
    st.notes.forEach((s) => note(ni++, s)); void ni;
    const lg = DA.x0 + 160; let lj = 0; const lgl = (col, lt, label, stg) => { const yy = DA.y0 + 34 - lj * 6; add({ t: "line", layer: "STG-FRAME", a: P0(lg, yy), b: P0(lg + 14, yy), color: col, lt: lt || null, lw: 0.5, stg }); T(lg + 17, yy - 0.9, 2.2, label, 0, "STG-FRAME"); lj++; };
    if (kind !== "raw" && kind !== "deburr") lgl(RED, null, kind === "saw" ? "Made at this operation" : "Made at this operation (red)", "this"); if (isTurn) lgl(GREY, "DASHED", "Material removed at this operation", "done"); if (isTurn) { lgl(BLUE, "DASHDOT", "Tool path: facing / rough (T01)", "tool"); lgl(BLUE, null, "Tool path: finish (T02)", "tool"); lgl(AMBER, null, "Clamping area / jaws", "clamp"); }
    T(DA.x1 - 4, DA.y0 + 2, 2.2, `Scale ${scTxt}`, 2, "STG-FRAME", 0);

    /* ---- right panel: data and the characteristics ---- */
    const kv = st.data.slice(0, 12); const rowsKV = [["STAGE DATA"], ...kv.map(([a, b]) => [fit(plain(a), 2.2, 30), fit(plain(b), 2.2, 66)])];
    add({ t: "table", layer: "STG-TABLE", p: P0(TB.x0, TB.y1), h: 2.2, rh: 5.4, cw: [34, 72], rows: rowsKV, title: true, hdr: false, al: ["l", "l"], rot: 0 });
    const ty = TB.y1 - 5.4 * rowsKV.length - 6, list = mineNos.slice().sort((a, b) => a - b).map((n) => chars.get(n)).filter(Boolean);
    const rows = [[st.charsTitle], ["No.", "Specification", "LSL", "USL", "Class", "Gauge"]], max = Math.max(4, Math.floor((ty - TB.y0 - 14) / 5.6));
    for (const c of list.slice(0, max)) { const ck = sec && (sec.checks || []).find((x) => String(x.charNo) === String(c.no)); rows.push([String(c.no), fit(plain(c.spec || c.text || c.label || ""), 2.2, 34 - 2.4), c.lsl == null || c.lsl === "" ? "" : String(c.lsl), c.usl == null || c.usl === "" ? "" : String(c.usl), c.cls || "", fit(plain((ck && ck.gauge) || ctx.gName.get(c.gauge) || c.balloonInstr || ""), 2.2, 30 - 2.4)]); }
    if (list.length > max) rows.push(["", `… ${list.length - max} more — see the SOP`, "", "", "", ""]);
    if (list.length) add({ t: "table", layer: "STG-TABLE", p: P0(TB.x0, ty), h: 2.2, rh: 5.6, cw: [8, 34, 12.5, 12.5, 9, 30], rows, title: true, hdr: true, al: ["c", "l", "r", "r", "c", "l"], rot: 0 });
    else T(TB.x0 + 2, ty - 4, 2.4, "No characteristic of the drawing is made at this operation.", 0, "STG-TABLE");
    if (st.tools && st.tools.length) { const tr = [["TOOLS"], ...st.tools.slice(0, 7).map((t, i) => ["T" + String(i + 1).padStart(2, "0"), fit(plain(t), 2.2, 92)])]; add({ t: "table", layer: "STG-TABLE", p: P0(TB.x0, TB.y0 + 5.4 * tr.length + 2), h: 2.2, rh: 5.4, cw: [12, 94], rows: tr, title: true, hdr: false, al: ["l", "l"], rot: 0 }); }
    if (rep.missing.length && ctx.sub && ctx.sub.n > 1) T(DA.x0, DA.y1 - 3, 2.6, `${rep.missing.length} more dimension${rep.missing.length > 1 ? "s" : ""} of this operation (balloons ${rep.missing.join(", ")}) are drawn on sheet 2.`, 0, "STG-FRAME", 0, { color: RED, stg: "this" });
    return { ents: E2, rep };
  };

  /* =============================================================== sheet 2: every other dimension of the operation =============================================================== */
  /** the dimensions of an operation the part sketch cannot show (they are not a step of the part): each is drafted as a dimension
      in its own small detail view with its balloon, so that every dimension of the table is drawn. Detail views are schematic. */
  F.detail = (doc, P, st, ctx, nos) => {
    const { ox, chars, sopSec, co, H } = ctx, op = st.op, sub = ctx.sub || { k: 2, n: 2 };
    const E2 = [], add = (e) => { E2.push(U(e)); return e; }, A = (x, y) => [ox + x, y];
    const T = (x, y, h, s, ha = 0, layer = "STG-FRAME", va = 0, extra = {}) => add(Object.assign({ t: "text", layer, p: A(x, y), h, s: String(s == null ? "" : s), rot: 0, ha, va }, extra));
    const L = (x0, y0, x1, y1, layer = "STG-FRAME", extra = {}) => add(Object.assign({ t: "line", layer, a: A(x0, y0), b: A(x1, y1) }, extra));
    add({ t: "pline", layer: "STG-FRAME", closed: true, lw: 0.7, pts: [A(10, 10), A(410, 10), A(410, 287), A(10, 287)].map((p) => [p[0], p[1], 0]) });
    L(10, 42, 410, 42); L(298, 42, 298, 287); L(100, 10, 100, 42); L(100, 26, 410, 26); for (let i = 1; i < 4; i++) L(100 + i * 77.5, 10, 100 + i * 77.5, 42);
    T(14, 33, 5.2, "STAGE DRAWING"); T(14, 24.5, 3.4, fit(plain(`OP ${op.opNo} · ${String(op.name || "").toUpperCase()}`), 3.4, 83)); T(14, 15, 2.4, fit(plain(co), 2.4, 83));
    const sec = sopSec.get(String(op.opNo)), stgNo = `${(sec && sec.docNo) || "STG-" + (P.part_no || "")}${sec && sec.docNo ? "-STG" : "-" + op.opNo}-D`;
    const cells = [["Part no.", P.part_no || H.partNo], ["Part name", P.part_name || H.partName], ["Drawing no. / rev", [H.drawingNo || P.drawing_no, H.drawingRev || P.rev].filter(Boolean).join(" / rev ")], ["Customer", P.customer || H.customer],
      ["Machine", op.machine || "—"], ["Stage drawing no.", stgNo], ["Dimensions frozen", `rev ${P.freeze.rev} · ${ctx.dmy(P.freeze.at)}`], ["Sheet", `Op ${op.opNo} · sheet ${sub.k} of ${sub.n}`]];
    cells.forEach(([lab, val], i) => { const cx = 100 + (i % 4) * 77.5, cy = i < 4 ? 26 : 10; T(cx + 2, cy + 12, 1.9, lab); T(cx + 2, cy + 3.6, 3, fit(plain(val || "—"), 3, 73)); });
    T(DA.x0, DA.y1 - 3, 3, "DIMENSIONS MADE AT THIS OPERATION — DETAIL VIEWS", 0, "STG-FRAME", 0);
    T(DA.x0, DA.y1 - 9, 2.2, "Each dimension of the table, drafted with its balloon. Detail views are schematic (not to scale); the value shown is the drawing value.", 0, "STG-FRAME", 0);
    const red = { color: RED, lw: 0.5, stg: "this" }, thin = { color: null, lw: 0.2, stg: "model" };
    const seg = (a, b, s2, layer = "STG-GEO") => add(Object.assign({ t: "line", layer, a: A(a[0], a[1]), b: A(b[0], b[1]) }, s2));
    const poly = (pts, s2, closed = false) => add(Object.assign({ t: "pline", layer: "STG-GEO", closed, pts: pts.map((p) => { const q = A(p[0], p[1]); return [q[0], q[1], 0]; }) }, s2));
    const dim = (d) => add(Object.assign({ t: "dim", layer: "STG-DIM", kind: "lin" }, d, { color: RED, stg: "this" }));
    const bal = (no, c, a) => {
      const cc = chars.get(no), C = A(c[0], c[1]), Q = A(a[0], a[1]), d = Math.hypot(Q[0] - C[0], Q[1] - C[1]) || 1;
      add({ t: "circle", layer: "STG-BALLOON", c: C, r: 3.6, stg: "balloon", no }); add({ t: "text", layer: "STG-BALLOON", p: C, h: no >= 100 ? 2.5 : 3, s: String(no), rot: 0, ha: 1, va: 2, stg: "balloon", no });
      add({ t: "line", layer: "STG-BALLOON", a: [C[0] + (Q[0] - C[0]) * 3.6 / d, C[1] + (Q[1] - C[1]) * 3.6 / d], b: Q, stg: "balloon", no });
      if (cc && cc.cls) add({ t: "text", layer: "STG-BALLOON", p: [C[0], C[1] + 4.5], h: 2.2, s: String(cc.cls), rot: 0, ha: 1, va: 0, stg: "balloon", no });
    };
    const items = nos.map((n) => chars.get(n)).filter(Boolean), n = items.length, cols = n <= 2 ? Math.max(1, n) : n <= 6 ? 3 : n <= 16 ? 4 : n <= 25 ? 5 : 6, rows = Math.ceil(n / cols);
    const AW = DA.x1 - DA.x0, TOP = DA.y1 - 14, AH = TOP - DA.y0, cw = AW / cols, ch = Math.min(64, AH / rows), D2R = Math.PI / 180;
    items.forEach((c, i) => {
      const col = i % cols, row = Math.floor(i / cols), x = DA.x0 + col * cw, y0 = TOP - (row + 1) * ch, no = +c.no;
      poly([[x + 1, y0 + 1], [x + cw - 1, y0 + 1], [x + cw - 1, y0 + ch - 1], [x + 1, y0 + ch - 1]], { lw: 0.13, color: GREY, stg: "done" }, true);
      const t = c.type, s = plain(c.spec || c.text || c.label || ""), cx = x + cw / 2 + 3, cy = y0 + ch / 2 - 1, hw = Math.max(5, Math.min(cw - 34, 40) / 2), hh = Math.max(4, Math.min(ch - 26, 24) / 2), V = (a, b) => [a, b];
      T(x + cw - 3, y0 + ch - 5, 2, fit(plain(c.label || t || ""), 2, cw - 16), 2, "STG-FRAME", 0);
      const lim = [c.lsl != null && c.lsl !== "" ? "LSL " + c.lsl : "", c.usl != null && c.usl !== "" ? "USL " + c.usl : ""].filter(Boolean).join("   "); if (lim) T(x + 3, y0 + 3, 2, lim, 0, "STG-FRAME", 0);
      let anchor = V(cx - hw, cy + hh); const nm = parseFloat(String(c.nominal != null && c.nominal !== "" ? c.nominal : (s.match(/-?\d+(?:\.\d+)?/) || [])[0]));
      if (t === "Diameter" || t === "Thread") {
        const r = Math.max(3, Math.min(hh, 10)), Cx = x + cw * 0.34, Cy = cy;
        add(Object.assign({ t: "circle", layer: "STG-GEO", c: A(Cx, Cy), r }, red)); seg([Cx - r - 3, Cy], [Cx + r + 3, Cy], { lt: "CENTER", lw: 0.15, color: null, stg: "stock" }); seg([Cx, Cy - r - 3], [Cx, Cy + r + 3], { lt: "CENTER", lw: 0.15, color: null, stg: "stock" });
        if (t === "Thread") add(Object.assign({ t: "arc", layer: "STG-GEO", c: A(Cx, Cy), r: r * 0.82, a0: 0, a1: Math.PI * 1.5 }, thin));
        add({ t: "dim", layer: "STG-DIM", kind: "dia", c: A(Cx, Cy), r, loc: A(Cx + Math.cos(0.6) * (r + 9), Cy + Math.sin(0.6) * (r + 9)), txt: s, color: RED, stg: "this" }); anchor = V(Cx - r * 0.7, Cy + r * 0.7);
      } else if (t === "Angle" && nm > 0 && nm < 170) {
        const Vx = cx - hw, Vy = cy - hh * 0.6, l1 = hw * 1.7, l2 = hw * 1.5, p1 = V(Vx + l1, Vy), p2 = V(Vx + Math.cos(nm * D2R) * l2, Vy + Math.sin(nm * D2R) * l2);
        seg(V(Vx, Vy), p1, red); seg(V(Vx, Vy), p2, red);
        const r = Math.min(l1, l2) * 0.7; add({ t: "dim", layer: "STG-DIM", kind: "ang", c: A(Vx, Vy), p1: A(p1[0], p1[1]), p2: A(p2[0], p2[1]), loc: A(Vx + Math.cos(nm / 2 * D2R) * r, Vy + Math.sin(nm / 2 * D2R) * r), txt: s, color: RED, stg: "this" }); anchor = p2;
      } else if (t === "Radius") {
        const Cx = cx - hw * 0.3, Cy = cy - hh * 0.3, r = Math.min(Math.max(hh * 1.3, 5), 10);
        add(Object.assign({ t: "arc", layer: "STG-GEO", c: A(Cx, Cy), r, a0: 0, a1: Math.PI / 2 }, red)); seg([Cx + r, Cy], [Cx + r, Cy - 7], red); seg([Cx, Cy + r], [Cx - 9, Cy + r], red);
        add({ t: "dim", layer: "STG-DIM", kind: "rad", c: A(Cx, Cy), r, loc: A(Cx + Math.cos(Math.PI / 4) * (r + 9), Cy + Math.sin(Math.PI / 4) * (r + 9)), txt: s, color: RED, stg: "this" }); anchor = V(Cx + Math.cos(Math.PI / 4) * r, Cy + Math.sin(Math.PI / 4) * r);
      } else if (t === "Chamfer") {
        const k = Math.min(hh, 8), a = V(cx - hw, cy - k), b = V(cx, cy - k), c2 = V(cx + k * 0.8, cy - k + k * 0.8), d = V(cx + k * 0.8, cy + k);
        poly([a, b, c2, d], red); const m = V((b[0] + c2[0]) / 2, (b[1] + c2[1]) / 2);
        add({ t: "dim", layer: "STG-DIM", kind: "ali", p1: A(b[0], b[1]), p2: A(c2[0], c2[1]), loc: A(m[0] + 6, m[1] - 6), txt: s, color: RED, stg: "this" }); anchor = m;
      } else if (t === "Linear") {
        seg([cx - hw, cy - 6], [cx - hw, cy + 6], red); seg([cx + hw, cy - 6], [cx + hw, cy + 6], red); seg([cx - hw - 3, cy - 6], [cx + hw + 3, cy - 6], thin);
        dim({ dir: "h", p1: A(cx - hw, cy + 6), p2: A(cx + hw, cy + 6), loc: A(cx, cy + 11), txt: s }); anchor = V(cx - hw, cy + 6);
      } else if (t === "Surface finish") {
        poly([V(cx - 8, cy), V(cx - 4, cy - 6), V(cx + 3, cy + 7), V(cx + 16, cy + 7)], red); T(cx + 4, cy + 8.5, 2.6, fit(s, 2.6, cw * 0.5), 0, "STG-GEO", 0, { color: RED, stg: "this" }); anchor = V(cx - 4, cy - 6);
      } else {
        const tx = fit(s, 2.6, cw - 24), w2 = wOf(tx, 2.6) + 5; poly([V(cx - w2 / 2, cy - 4.5), V(cx + w2 / 2, cy - 4.5), V(cx + w2 / 2, cy + 4.5), V(cx - w2 / 2, cy + 4.5)], red, true); T(cx, cy, 2.6, tx, 1, "STG-GEO", 2, { color: RED, stg: "this" }); anchor = V(cx - w2 / 2, cy + 4.5);
      }
      bal(no, V(x + 8, y0 + ch - 8), anchor);
    });
    // the characteristics table (same as sheet 1)
    const list = nos.slice().sort((a, b) => a - b).map((k) => chars.get(k)).filter(Boolean), rowsT = [["MADE AT THIS OPERATION — CHECK AS PER THE SOP"], ["No.", "Specification", "LSL", "USL", "Class", "Gauge"]], max = Math.floor((TB.y1 - TB.y0 - 14) / 5.6);
    for (const c of list.slice(0, max)) { const ck = sec && (sec.checks || []).find((x) => String(x.charNo) === String(c.no)); rowsT.push([String(c.no), fit(plain(c.spec || c.text || c.label || ""), 2.2, 34 - 2.4), c.lsl == null || c.lsl === "" ? "" : String(c.lsl), c.usl == null || c.usl === "" ? "" : String(c.usl), c.cls || "", fit(plain((ck && ck.gauge) || ctx.gName.get(c.gauge) || c.balloonInstr || ""), 2.2, 30 - 2.4)]); }
    if (list.length > max) rowsT.push(["", `… ${list.length - max} more — see the SOP`, "", "", "", ""]);
    add({ t: "table", layer: "STG-TABLE", p: A(TB.x0, TB.y1), h: 2.2, rh: 5.6, cw: [8, 34, 12.5, 12.5, 9, 30], rows: rowsT, title: true, hdr: true, al: ["c", "l", "r", "r", "c", "l"], rot: 0 });
    return { ents: E2, rep: { balloons: items.length } };
  };

  /* =============================================================== the set =============================================================== */
  /** build the stage drawings of a plan: returns {doc, sheets, report} (same shape as the finished-drawing sets) */
  F.build = (P, model, opt) => {
    const doc = K.newDoc(false);
    for (const [n, c, lw, lt] of [["STG-FRAME", "#ffffff", 0.5], ["STG-TABLE", "#ffffff", 0.25], ["STG-BALLOON", RED, 0.35], ["STG-GEO", "#ffffff", 0.35], ["STG-DIM", "#00ffff", 0.18], ["STG-TOOL", BLUE, 0.3]]) doc.layers.push({ name: n, color: c, lt: lt || "CONTINUOUS", lw, on: true, frozen: false, lock: false });
    doc.dim = Object.assign({}, doc.dim, { th: 2.5, as: 2.5, dec: 2, scale: 1, gap: 0.8 });
    const chars = new Map((P.chars || []).map((c) => [+c.no, c])), map = (P.freeze && P.freeze.map) || {}, ctx0 = opt.ctx || {};
    const stages = F.stages(P, map, chars), sopSec = new Map(((P.sop && P.sop.sections) || []).map((s) => [String(s.opNo), s]));
    const gName = new Map((P.gauges || []).map((g) => [g.id, [g.name, g.range].filter(Boolean).join(" ")]));
    const H = P.header || {}, co = (window.QP && QP.ctx && QP.ctx.company) || H.supplier || "", sheets = [], rep = { balloons: 0, linked: 0, missing: [], stages: 0 };
    const match = matchChars(P, model, [...chars.values()], null);
    const mat = H.material || "As per drawing", fam = P.family || (H.family) || "rotational";
    let ox = 0, pageNo = 0, first = null; const nTurn = (P.ops || []).filter((o) => /^TURN/.test(o.key)).length;
    stages.forEach((op, idx) => {
      let kind = F.kindOf(op); if (kind === "turn" && (P.ops || []).some((o) => o.key === "TURN2")) kind = "turn1"; const turnIdx = kind === "turn1" || kind === "turn" ? 1 : kind === "turn2" ? 2 : 0;
      const tools = (op.tools || []).map((t) => [t.desc, t.spec].filter(Boolean).join(" — "));
      const data = [], notes = [];
      const mnos = (map[String(op.opNo)] || []).map(Number), mine = mnos.map((n) => chars.get(n)).filter(Boolean);
      const add = (a, b) => data.push([a, b]);
      add("Operation", `${op.opNo} · ${op.name}`); add("Machine", op.machine || "—");
      let title = op.name, charsTitle = "MADE AT THIS OPERATION — CHECK AS PER THE SOP";
      if (kind === "raw") {
        title = "RAW MATERIAL"; charsTitle = "GENERAL REQUIREMENTS — INCOMING INSPECTION";
        add("Material", mat); add("Material class", H.materialClass || ""); add("Form", fam === "rotational" ? "Round bar" : "Plate / block / casting"); add("Bar size", `Ø${model.D0} ${model.bar.tol} (for finished Ø${r2(model.maxD)})`); add("Supply length", model.bar.len); add("Condition", model.bar.cond);
        add("Certificate", model.bar.cert); add("Traceability", "Heat / lot no. on tag and in the SOP record"); add("Cut length", `${r2(model.L + 2 * model.fa)} mm (sawing op)`); add("Finished length", `${r2(model.L)} mm`);
        if ((P.notes || {}).hardness) add("Hardness", String((P.notes || {}).hardness)); notes.push("Check: grade and heat no. against the certificate, bar diameter, straightness, surface defects (cracks, laps, rust).", "Material ID tag stays with the lot through every operation.");
        const gen = (P.chars || []).filter((c) => c.type === "Material" || c.type === "Note").map((c) => +c.no); mine.push(...gen.map((n) => chars.get(n)).filter((c) => c && !mine.includes(c)));
      } else if (kind === "saw") { title = "SAWING — SAWN BLANK"; add("Blank", `Ø${model.D0} × ${r2(model.L + 2 * model.fa)} ±1 mm`); add("Allowance", `${model.fa} mm each end for facing`); add("Material", mat); add("Saw", op.machine || "Bandsaw"); notes.push(`Allowance: ${model.fa} mm each end for facing; ${r2(model.L)} mm = finished length.`, "Cut square to the axis; deburr the sawn faces; mark the heat / lot no. on the blank.", `Blank weight ≈ ${(Math.PI * Math.pow(model.D0 / 20, 2) * ((model.L + 2 * model.fa) / 10) * 7.85 / 1000).toFixed(2)} kg (steel).`); }
      else if (kind === "turn1" || kind === "turn") { title = nTurn > 1 ? "CNC TURNING 1 — FIRST SIDE" : "CNC TURNING"; const zc = zones(model, "turn1").clamp, cl1 = r2(zc[1] - zc[0]); add("Held", `3-jaw chuck on bar Ø${model.D0}, clamp ${cl1} mm`); add("Stick-out", `${r2(zc[0] + model.fa)} mm from the chuck face`); add("Datum", "A = clamped Ø (axis) · B = first finished face"); add("Facing allowance", `${model.fa} mm`); add("Turned", `Ø${r2(model.maxD)} max × ${r2(model.L)}`); notes.push("Face, rough and finish turn the profile in red. Part-off or release after the profile is complete.", "Check first piece with the SOP gauges before running the batch."); }
      else if (kind === "turn2") { title = "CNC TURNING 2 — SECOND SIDE"; add("Held", `Soft jaws on finished Ø${r2(model.steps[0].d)}, clamp ${r2(Math.min(model.clamp, model.steps[0].l))} mm`); add("Datum", "A = clamped Ø (axis) · B = first-side face"); add("Facing", `to finished length ${r2(model.L)} mm`); notes.push("Seat the part against the jaw stop; do not clamp on the threads or ground surfaces.", "Check the total length and the runout to datum A at the first piece."); }
      else if (kind === "feat") { title = op.name; add("Fixture", "Chuck / vice with soft jaws (per set-up sheet)"); notes.push("Features made here are in red; position from the datums on the SOP."); }
      else if (kind === "ht") { title = "HEAT TREATMENT"; if ((P.notes || {}).hardness) add("Hardness", String((P.notes || {}).hardness)); if ((P.notes || {}).htType) add("Process", String((P.notes || {}).htType)); if ((P.notes || {}).caseDepth) add("Case depth", String((P.notes || {}).caseDepth)); notes.push("Sub-contract: send with the process card; verify hardness on return."); }
      else if (kind === "grind") { title = op.name; add("Stock left for grinding", "0.2 – 0.4 mm on diameter (as per route)"); notes.push("Ground surfaces are in red; hold between centres or in the soft chuck as per the SOP."); }
      else if (kind === "deburr") { title = "DEBURRING"; notes.push("Break all sharp edges 0.2 – 0.5 mm unless the drawing says otherwise."); }
      if (kind !== "raw") add("Tolerance class", H.generalTol || "As per drawing");
      pageNo++; const stg = { op, kind, title, charsTitle, data, notes, tools: tools.length ? tools : null };
      const ctx = { ox, model, chars: new Map([...chars].filter(([n]) => true)), map: Object.assign({}, map, kind === "raw" ? { [String(op.opNo)]: mine.map((c) => +c.no) } : {}), sopSec, co, H, pageNo, pages: stages.length, mach: op.machine, match, gName, dmy: (t) => { if (!t) return ""; const d = new Date(t); return isNaN(d) ? String(t) : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); } };
      let R = F.sheet(doc, P, stg, ctx), extra = R.rep.missing.slice();
      if (extra.length) { ctx.sub = { k: 1, n: 2 }; R = F.sheet(doc, P, stg, ctx); }
      doc.ents.push(...R.ents); rep.balloons += R.rep.balloons; rep.stages++;
      sheets.push({ opNo: op.opNo, opName: op.name, sheet: 1, of: extra.length ? 2 : 1, kind, box: { x0: ox, y0: 0, x1: ox + PW, y1: PH } }); ox += PW * 1.08; void idx; void turnIdx; void first;
      if (extra.length) {
        ctx.ox = ox; ctx.sub = { k: 2, n: 2 }; const D = F.detail(doc, P, stg, ctx, extra); doc.ents.push(...D.ents); rep.balloons += D.rep.balloons;
        sheets.push({ opNo: op.opNo, opName: op.name, sheet: 2, of: 2, kind, box: { x0: ox, y0: 0, x1: ox + PW, y1: PH } }); ox += PW * 1.08;
      }
    });
    rep.linked = match.size; return { doc, sheets, report: rep };
  };

  /* =============================================================== "Part shape" dialog =============================================================== */
  /** let the user check or type the shape: steps (Ø × length), bore, bar size, allowance, clamp, which end first */
  F.dialog = async (E, P, model, srcNote) => {
    const stepRow = (s, i) => `<tr><td>${i + 1}</td><td><input data-k="d" value="${s.d}" type="number" step="any" min="0.1"></td><td><input data-k="l" value="${s.l}" type="number" step="any" min="0.1"></td><td><button class="cx-b o" data-del="${i}" type="button">✕</button></td></tr>`;
    const prev = (m) => { const D = Math.max(...m.steps.map((s) => s.d)), L = m.steps.reduce((t, s) => t + s.l, 0), W = 300, kk = Math.min((W - 20) / L, 90 / D), pad = 10, x0 = pad, yc = 55; let x = x0, p = ""; const top = [], bot = []; for (const s of m.steps) { top.push([x, yc - s.d / 2 * kk], [x + s.l * kk, yc - s.d / 2 * kk]); bot.push([x, yc + s.d / 2 * kk], [x + s.l * kk, yc + s.d / 2 * kk]); x += s.l * kk; } p = top.map((q) => q.join(",")).join(" ") + " " + bot.slice().reverse().map((q) => q.join(",")).join(" "); return `<svg viewBox="0 0 ${W} 110" style="width:100%;background:#fff;border-radius:8px"><polygon points="${p}" fill="#eef2f7" stroke="#0f172a" stroke-width="1.2"/><line x1="${x0 - 6}" x2="${x + 6}" y1="${yc}" y2="${yc}" stroke="#e11d48" stroke-dasharray="6 2 1 2" stroke-width=".7"/></svg>`; };
    const html = (m) => `<p class="cx-note">${srcNote}</p><div id="sfPrev">${prev(m)}</div>
      <h4>Steps of the finished part, from the left end</h4><table class="cx-tbl" style="min-width:0"><thead><tr><th>#</th><th>Ø (mm)</th><th>Length (mm)</th><th></th></tr></thead><tbody id="sfSteps">${m.steps.map(stepRow).join("")}</tbody></table>
      <p><button class="cx-b o" id="sfAdd" type="button">+ Add a step</button></p>
      <div class="cx-frm"><label>Bore Ø (0 = none)<input id="sfBd" type="number" step="any" min="0" value="${m.bore ? m.bore.d : 0}"></label><label>Bore depth<input id="sfBl" type="number" step="any" min="0" value="${m.bore ? m.bore.depth : 0}"></label><label>Bore from<select id="sfBe"><option value="L"${m.bore && m.bore.end === "R" ? "" : " selected"}>left end</option><option value="R"${m.bore && m.bore.end === "R" ? " selected" : ""}>right end</option></select></label></div>
      <h4>Raw material and set-up</h4><div class="cx-frm"><label>Bar Ø (mm)<input id="sfD0" type="number" step="any" min="1" value="${m.D0}"></label><label>Facing allowance each end (mm)<input id="sfFa" type="number" step="any" min="0" value="${m.fa}"></label><label>Chuck clamp length (mm)<input id="sfCl" type="number" step="any" min="5" value="${m.clamp}"></label>
      <label>First turning side (OP 1)<select id="sfFi"><option value="L"${m.first === "L" ? " selected" : ""}>Left end as shown</option><option value="R"${m.first === "R" ? " selected" : ""}>Right end as shown</option></select></label><label>Bar supply length<input id="sfBL" value="${esc(m.bar.len)}"></label><label>Bar tolerance<input id="sfBT" value="${esc(m.bar.tol)}"></label></div>
      <label>Condition<input id="sfCo" value="${esc(m.bar.cond)}"></label><label>Certificate<input id="sfCe" value="${esc(m.bar.cert)}"></label>`;
    return E.dialog("Part shape for the stage drawings", html(model), (b) => {
      const g = (id) => b.querySelector("#" + id), steps = [...b.querySelectorAll("#sfSteps tr")].map((tr) => ({ d: +tr.querySelector('[data-k="d"]').value, l: +tr.querySelector('[data-k="l"]').value }));
      if (!steps.length || steps.some((s) => !(s.d > 0) || !(s.l > 0))) throw new Error("Every step needs a diameter and a length above 0.");
      const bd = +g("sfBd").value, m = Object.assign({}, model, { steps, L: steps.reduce((t, s) => t + s.l, 0), maxD: Math.max(...steps.map((s) => s.d)), bore: bd > 0 && +g("sfBl").value > 0 ? { d: bd, depth: +g("sfBl").value, end: g("sfBe").value } : null, D0: +g("sfD0").value, fa: Math.max(0, +g("sfFa").value || 0), clamp: Math.max(5, +g("sfCl").value || 20), first: g("sfFi").value, bar: { len: g("sfBL").value, tol: g("sfBT").value, cond: g("sfCo").value, cert: g("sfCe").value } });
      if (m.D0 < m.maxD + 0.5) throw new Error("The bar must be larger than the largest diameter (" + m.maxD + " mm).");
      return m;
    }, { width: "min(720px,96vw)", ok: "Make the stage drawings", init: (b) => {
      const redo = () => { const steps = [...b.querySelectorAll("#sfSteps tr")].map((tr) => ({ d: +tr.querySelector('[data-k="d"]').value || 1, l: +tr.querySelector('[data-k="l"]').value || 1 })); b.querySelector("#sfPrev").innerHTML = prev({ steps }); };
      const wire = () => { b.querySelectorAll("#sfSteps input").forEach((i) => (i.oninput = redo)); b.querySelectorAll("[data-del]").forEach((x) => (x.onclick = () => { if (b.querySelectorAll("#sfSteps tr").length > 1) { x.closest("tr").remove(); redo(); } })); };
      wire(); b.querySelector("#sfAdd").onclick = () => { const t = b.querySelector("#sfSteps"), n = t.querySelectorAll("tr").length; t.insertAdjacentHTML("beforeend", stepRow({ d: 20, l: 10 }, n)); wire(); redo(); };
    } });
  };
  F.PW = PW; F.PH = PH; F.RED = RED; F.plain = plain; F.fit = fit;
})((window.KCAD = window.KCAD || {}));
