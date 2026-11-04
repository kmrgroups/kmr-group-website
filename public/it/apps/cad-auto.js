/* KMR CAD Draft — automatic dimensions, standard layer colours, value-driven dimensions and unit conversion.
   1. Dimension size follows the drawing size (K.autoDimK) so text and arrows are always readable.
   2. Every drawn object gets its dimensions straight away (AutoDim on the status bar).
   3. New objects land on a standard layer with a fixed colour: outline, hidden, centre, dimensions, text, hatch ...
   4. Change a dimension's value (double-click it, the Properties panel or DV) and the drawing is redrawn to match.
   5. Units: pick a unit and the whole drawing (objects, blocks, dimension sizes, grid, viewports) is converted. */
(function (K) {
  "use strict";
  const G = K.geom, cmd = K.cmd, isP = Array.isArray, esc = K.esc;
  const TAU = Math.PI * 2;

  /* =============================== 1. dimension size follows the drawing =============================== */
  const NICE = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
  const nice = (x) => { if (!(x > 0) || !isFinite(x)) return 1; const p = Math.pow(10, Math.floor(Math.log10(x))), m = x / p; let b = NICE[0]; for (const n of NICE) if (n <= m * 1.0001) b = n; return b * p; };
  const SKIP = ["dim", "text", "mtext", "leader", "hatch", "point", "fcf", "table", "attdef", "xline", "vport"];
  const memo = new WeakMap(); let busy = false;
  /** factor that makes dimension text / arrows about 3 % of the drawing's larger side (stepped, so it does not jitter) */
  K.autoDimK = (doc) => {
    if (doc._active && doc._active !== "model") return 1;
    const arr = doc.ents, th = doc.dim.th || 2.5; let m = memo.get(arr);
    if (m && m.th === th && m.u === doc.units) return m.k;
    if (busy) return 1;
    busy = true; let k = 1;
    try {
      let b = null;
      for (const e of arr) { if (SKIP.includes(e.t)) continue; const L = K.layer(doc, e.layer); if (L.on === false || L.frozen) continue; b = G.mergeBounds(b, K.bbox(e, doc)); }
      if (b) { const side = Math.max(b.x1 - b.x0, b.y1 - b.y0); if (side > 0 && isFinite(side)) k = nice((side * 0.03) / th); }
    } finally { busy = false; }
    memo.set(arr, { k, th, u: doc.units });
    return k;
  };
  const baseDimStyle = K.dimStyle;
  K.dimStyle = (e, doc) => {
    const D = baseDimStyle(e, doc);
    if (D.auto === false || (e && e.st && e.st.scale != null)) return D;
    const root = Object.assign({}, doc.dim, (doc.dimstyles || {})[e && e.sty] || {});
    D.scale = (root.scale || 1) * K.autoDimK(doc);
    return D;
  };
  cmd("DIMAUTO", { a: ["DAUTO"], d: "Switch automatic dimension size (follows the drawing size) on or off", fn: async (E) => {
    E.tx("auto dimension size", () => { E.doc.dim = Object.assign({}, E.doc.dim, { auto: E.doc.dim.auto === false }); });
    E.msg(`Automatic dimension size ${E.doc.dim.auto === false ? "off — the Dim style sizes are used as set" : "on — dimension text and arrows follow the drawing size"}.`, "ok"); E.redraw();
  } });

  /* =============================== 2. standard layers and colours =============================== */
  K.STDLAYERS = [
    { name: "Outline", color: "#ffffff", lt: "CONTINUOUS", lw: 0.5, d: "Object (visible) lines" },
    { name: "Hidden", color: "#ffff00", lt: "HIDDEN", lw: 0.25, d: "Hidden lines" },
    { name: "Centre", color: "#ff0000", lt: "CENTER", lw: 0.18, d: "Centre lines" },
    { name: "Dimensions", color: "#00ffff", lt: "CONTINUOUS", lw: 0.18, d: "Dimensions" },
    { name: "Text", color: "#00ff00", lt: "CONTINUOUS", lw: 0.25, d: "Notes and text" },
    { name: "Hatch", color: "#808080", lt: "CONTINUOUS", lw: 0.13, d: "Section hatching" },
    { name: "Section", color: "#ff00ff", lt: "PHANTOM", lw: 0.25, d: "Cutting plane lines" },
    { name: "Construction", color: "#0080ff", lt: "DASHED", lw: 0.13, d: "Construction lines" },
  ];
  const stdLt = (n) => (K.LT && K.LT[n] ? n : "CONTINUOUS");
  /** make sure a standard layer exists (with its fixed colour) and return its name */
  K.stdLayer = (doc, name) => {
    if (!doc.layers.find((l) => l.name === name)) { const s = K.STDLAYERS.find((x) => x.name === name); if (s) doc.layers = doc.layers.concat([{ name, color: s.color, lt: stdLt(s.lt), lw: s.lw, on: true, frozen: false, lock: false }]); }
    return name;
  };
  const baseNew = K.newDoc;
  K.newDoc = (withLayers = true) => { const d = baseNew(withLayers); d.dim = Object.assign({}, d.dim, { auto: true }); if (withLayers) { for (const s of K.STDLAYERS) K.stdLayer(d, s.name); d.cur = "Outline"; } return d; };
  cmd("LAYSTD", { a: ["STDLAYERS"], d: "Restore the standard layers and their fixed colours (outline, hidden, centre, dimensions, text, hatch ...)", fn: async (E) => {
    E.tx("standard layers", () => {
      const L = E.doc.layers.map((l) => { const s = K.STDLAYERS.find((x) => x.name === l.name); return s ? Object.assign({}, l, { color: s.color, lt: stdLt(s.lt), lw: s.lw }) : l; });
      E.doc.layers = L; for (const s of K.STDLAYERS) K.stdLayer(E.doc, s.name);
    });
    E.msg("Standard layers restored: " + K.STDLAYERS.map((s) => s.name).join(", ") + ".", "ok"); E.redraw(); if (E.refreshLayers) E.refreshLayers();
  } });
  /* new objects are filed on their standard layer unless the user chose another layer on purpose */
  const LT_LAYER = { HIDDEN: "Hidden", HIDDEN2: "Hidden", CENTER: "Centre", CENTER2: "Centre", PHANTOM: "Section" };
  K.onAdd = K.onAdd || [];
  const STDSET = new Set(["0", ...K.STDLAYERS.map((x) => x.name)]), LINEWORK = new Set(["Hidden", "Centre", "Section", "Construction"]);
  const GEOM = ["line", "pline", "circle", "arc", "ellipse", "spline"];
  K.onAdd.push((E, e) => {
    const doc = E.doc, cur = e.layer || "0";
    if (e.stg || !STDSET.has(cur)) return; // a layer the user made themselves is respected
    let to = null;
    if (GEOM.includes(e.t)) {
      const lt = e.lt && LT_LAYER[String(e.lt).toUpperCase()];
      if (lt) { to = lt; e.lt = null; } else if (!LINEWORK.has(cur)) to = "Outline";
    } else if (e.t === "dim") to = "Dimensions";
    else if (["text", "mtext", "leader", "fcf", "table"].includes(e.t)) to = "Text";
    else if (e.t === "hatch" && !e.solid) to = "Hatch";
    if (to && to !== cur) { K.stdLayer(doc, to); e.layer = to; }
  });
  /* an opened drawing starts on the Outline layer (never on Dimensions / Text / Hatch left over from last time) */
  K.editorHooks = K.editorHooks || [];
  K.editorHooks.push((E) => {
    const load = E.load;
    E.load = (doc, info) => { try { if (doc && Array.isArray(doc.layers) && (!doc.cur || ["0", "Dimensions", "Text", "Hatch"].includes(doc.cur))) { K.stdLayer(doc, "Outline"); doc.cur = "Outline"; } } catch (er) { /* keep going */ } return load(doc, info); };
  });

  /* =============================== 3. automatic dimensions for new drawings =============================== */
  const dimBase = (E) => { const D = K.dimStyle({}, E.doc), th = D.th * (D.scale || 1); return { th, off: th * 3.2 }; };
  const pl = (e) => (e.pts || []).map((p) => [p[0], p[1], p[2] || 0]);
  const lenOf = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const orient = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return Math.abs(dy) <= 1e-7 * L ? "h" : Math.abs(dx) <= 1e-7 * L ? "v" : "a"; };
  /** one dimension for the straight side a→b, drawn on the outside (away from `inside`) */
  const sideDim = (a, b, inside, off) => {
    const o = orient(a, b), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (o === "h") { const s = m[1] >= inside[1] ? 1 : -1; return { kind: "lin", dir: "h", p1: a, p2: b, loc: [m[0], m[1] + s * off] }; }
    if (o === "v") { const s = m[0] >= inside[0] ? 1 : -1; return { kind: "lin", dir: "v", p1: a, p2: b, loc: [m[0] + s * off, m[1]] }; }
    const u = G.unit(G.sub(b, a)); let n = [-u[1], u[0]]; if (G.dot(n, G.sub(m, inside)) < 0) n = [-n[0], -n[1]];
    return { kind: "ali", p1: a, p2: b, loc: G.add(m, G.mul(n, off)) };
  };
  /** the dimensions a new object should come with */
  K.autoDimsFor = (E, e) => {
    const { off } = dimBase(E), out = [];
    switch (e.t) {
      case "line": {
        if (lenOf(e.a, e.b) < 1e-9) return [];
        const m = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2], o = orient(e.a, e.b);
        const inside = o === "h" ? [m[0], m[1] + 1] : o === "v" ? [m[0] - 1, m[1]] : (() => { const u = G.unit(G.sub(e.b, e.a)); const n = [u[1], -u[0]]; return G.add(m, G.mul(n, 1)); })();
        out.push(sideDim(e.a, e.b, inside, off)); break;
      }
      case "circle": out.push({ kind: "dia", c: e.c, r: e.r, loc: G.polar(e.c, Math.PI / 4, e.r + off) }); break;
      case "arc": { const sw = G.sweep(e.a0, e.a1); out.push({ kind: "rad", c: e.c, r: e.r, loc: G.polar(e.c, e.a0 + sw / 2, e.r + off * 0.8) }); break; }
      case "ellipse": {
        if (e.a1 != null || Math.abs(Math.sin(e.rot || 0)) > 1e-9 || Math.abs(Math.cos(e.rot || 0)) < 1 - 1e-9) break;
        out.push({ kind: "lin", dir: "h", p1: [e.c[0] - e.rx, e.c[1]], p2: [e.c[0] + e.rx, e.c[1]], loc: [e.c[0], e.c[1] - e.ry - off] });
        out.push({ kind: "lin", dir: "v", p1: [e.c[0], e.c[1] - e.ry], p2: [e.c[0], e.c[1] + e.ry], loc: [e.c[0] + e.rx + off, e.c[1]] }); break;
      }
      case "pline": {
        const P = pl(e); if (P.length < 2) return [];
        const n = P.length, closed = !!e.closed, segs = closed ? n : n - 1, bul = P.some((p, i) => (closed || i < n - 1) && Math.abs(p[2]) > 1e-9);
        const cen = [P.reduce((s, p) => s + p[0], 0) / n, P.reduce((s, p) => s + p[1], 0) / n];
        if (bul || segs > 12) { // rounded / long outlines: overall width and height from the extreme vertices
          let iMinX = 0, iMaxX = 0, iMinY = 0, iMaxY = 0; P.forEach((p, i) => { if (p[0] < P[iMinX][0]) iMinX = i; if (p[0] > P[iMaxX][0]) iMaxX = i; if (p[1] < P[iMinY][1]) iMinY = i; if (p[1] > P[iMaxY][1]) iMaxY = i; });
          if (P[iMaxX][0] - P[iMinX][0] > 1e-9) out.push({ kind: "lin", dir: "h", p1: P[iMinX], p2: P[iMaxX], loc: [(P[iMinX][0] + P[iMaxX][0]) / 2, P[iMinY][1] - off] });
          if (P[iMaxY][1] - P[iMinY][1] > 1e-9) out.push({ kind: "lin", dir: "v", p1: P[iMinY], p2: P[iMaxY], loc: [P[iMaxX][0] + off, (P[iMinY][1] + P[iMaxY][1]) / 2] });
          break;
        }
        const sides = []; for (let i = 0; i < segs; i++) sides.push([P[i], P[(i + 1) % n]]);
        const rect = closed && n === 4 && sides.every(([a, b], i) => { const [c, d] = sides[(i + 1) % 4]; return Math.abs(G.dot(G.unit(G.sub(b, a)), G.unit(G.sub(d, c)))) < 1e-6; });
        const lens = sides.map(([a, b]) => lenOf(a, b)), equal = lens.every((l) => Math.abs(l - lens[0]) < 1e-6 * Math.max(1, lens[0]));
        const pick = rect ? [0, 1] : closed && n > 4 && equal ? [0] : sides.map((_, i) => i);
        for (const i of pick) if (lens[i] > 1e-9) out.push(sideDim(sides[i][0], sides[i][1], cen, off));
        break;
      }
      default: break;
    }
    return out;
  };
  const AUTO_CMDS = ["LINE", "PLINE", "CIRCLE", "ARC", "RECTANG", "POLYGON", "ELLIPSE"], PRIMARY = ["line", "pline", "circle", "arc", "ellipse"];
  for (const name of AUTO_CMDS) {
    const C = K.CMDS[name]; if (!C) continue; const orig = C.fn;
    C.fn = async (E, args) => {
      const before = new Set(E.doc.ents.map((x) => x.id)); let opened = false;
      try { E.begin(name.toLowerCase()); opened = true; await orig(E, args); }
      finally {
        try {
          if (E.set.autodim !== false && E.doc._active === "model" && (!E.space || !E.space.lay || E.space.ms)) {
            const made = E.doc.ents.filter((x) => !before.has(x.id) && PRIMARY.includes(x.t) && !x.auto && !x.stg);
            if (made.length) { const lay = K.stdLayer(E.doc, "Dimensions"); let n = 0; for (const x of made) for (const d of K.autoDimsFor(E, x)) { E.add(Object.assign({ t: "dim", layer: lay, auto: 1 }, d)); n++; } if (n) E.msg(`${n} dimension${n > 1 ? "s" : ""} added automatically (AutoDim). Double-click a dimension to change its value.`, "mu"); }
          }
        } catch (er) { console.error(er); }
        if (opened) E.end();
      }
    };
  }
  cmd("AUTODIM", { a: ["ADIM"], d: "Switch automatic dimensions for new drawings on or off", fn: async (E) => {
    E.set.autodim = E.set.autodim === false; try { localStorage.setItem("kcad-prefs", JSON.stringify(E.set)); } catch (e) { /* ignore */ }
    E.msg(`AutoDim ${E.set.autodim === false ? "off" : "on"}.`, "ok"); if (E.drawStatus) E.drawStatus();
  } });
  cmd("DIMALL", { a: ["DIMSEL"], d: "Add dimensions to the selected objects (lines, polylines, circles, arcs)", fn: async (E) => {
    let ids = E.sel.slice(); if (!ids.length) ids = await E.getSel("Select objects to dimension:", { filter: (x) => PRIMARY.includes(x.t) });
    if (!ids || !ids.length) return;
    E.tx("auto dimension", () => { const lay = K.stdLayer(E.doc, "Dimensions"); let n = 0; for (const id of ids) { const x = E.byId(id); if (x && PRIMARY.includes(x.t)) for (const d of K.autoDimsFor(E, x)) { E.add(Object.assign({ t: "dim", layer: lay, auto: 1 }, d)); n++; } } E.msg(`${n} dimension${n === 1 ? "" : "s"} added.`, "ok"); });
  } });

  /* =============================== 4. a dimension value redraws the drawing =============================== */
  const DRIVEN = ["lin", "ali", "rad", "dia"];
  K.dimMeasure = (e) => (e.kind === "rad" ? e.r : e.kind === "dia" ? e.r * 2 : Math.abs(G.dot(G.sub(e.p2, e.p1), K.dimDir(e))));
  const rebuildArc = (e, P, Q) => {
    const sw = G.sweep(e.a0, e.a1), ch = G.dist(P, Q); if (ch < 1e-12) return e;
    const r = ch / (2 * Math.sin(sw / 2)), mid = G.mid(P, Q), n = G.unit([-(Q[1] - P[1]), Q[0] - P[0]]), h = r * Math.cos(sw / 2), c = [mid[0] + n[0] * h, mid[1] + n[1] * h];
    return Object.assign({}, e, { c, r: Math.abs(r), a0: G.ang(c, P), a1: G.ang(c, Q) });
  };
  const arcEnds = (e) => [G.polar(e.c, e.a0, e.r), G.polar(e.c, e.a1, e.r)];
  const isGeom = (e) => e.t === "line" || e.t === "pline" || e.t === "arc";
  const vertsOf = (e) => (e.t === "line" ? [e.a, e.b] : e.t === "pline" ? e.pts : e.t === "arc" ? arcEnds(e) : []);
  /** change a dimension to `val`: the connected figure is stretched, other dimensions follow */
  K.driveDim = (E, d, val) => {
    if (!DRIVEN.includes(d.kind)) throw new Error("Only linear, aligned, radius and diameter dimensions can drive the drawing.");
    if (!(val > 0) || !isFinite(val)) throw new Error("The value must be above zero.");
    const cur = K.dimMeasure(d), ents = E.doc.ents, ed = (e) => E.editable(e);
    let moved = 0;
    if (d.kind === "rad" || d.kind === "dia") {
      const nr = d.kind === "rad" ? val : val / 2, dr = nr - d.r, tol = Math.max(1e-6, d.r * 1e-6);
      const ci = ents.findIndex((e) => (e.t === "circle" || e.t === "arc") && G.dist(e.c, d.c) <= tol && Math.abs(e.r - d.r) <= tol && ed(e));
      E.tx("dimension value", () => {
        E.doc.ents = ents.map((e) => {
          if (e === ents[ci]) { moved++; return Object.assign({}, e, { r: nr }); }
          if (e.t === "dim" && e.id === d.id) { const u = G.unit(G.sub(e.loc, e.c)); return Object.assign({}, e, { r: nr, loc: G.add(e.c, G.mul(u, Math.max(G.dist(e.loc, e.c) + dr, nr * 0.2))) }); }
          return e;
        }); E.reindex();
      });
      return moved ? "Circle / arc redrawn." : "No circle or arc is attached to this dimension, so only the dimension changed.";
    }
    const u = K.dimDir(d), s = G.dot(G.sub(d.p2, d.p1), u) >= 0 ? 1 : -1, delta = val - cur, mv = G.mul(u, s * delta);
    const tol = Math.max(1e-6, cur * 1e-6), t = (p) => s * G.dot(G.sub(p, d.p1), u), w = (p) => Math.max(0, Math.min(1, t(p) / cur));
    const near = (p, q) => Math.abs(p[0] - q[0]) <= tol && Math.abs(p[1] - q[1]) <= tol;
    /* connected figure: every drawing object linked to the dimension's two points through shared end points */
    const geo = []; ents.forEach((e, i) => { if (isGeom(e) && E.visible(e)) geo.push(i); });
    const cell = tol * 4, key = (x, y) => Math.round(x / cell) + "|" + Math.round(y / cell), grid = new Map();
    const reg = (i) => { for (const v of vertsOf(ents[i])) { const k = key(v[0], v[1]); (grid.get(k) || grid.set(k, []).get(k)).push({ i, p: v }); } };
    geo.forEach(reg);
    const hits = (p) => { const out = []; const cx = Math.round(p[0] / cell), cy = Math.round(p[1] / cell); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const h of grid.get(cx + a + "|" + (cy + b)) || []) if (near(h.p, p)) out.push(h.i); return out; };
    const comp = new Set(), queue = [...hits(d.p1), ...hits(d.p2)]; queue.forEach((i) => comp.add(i));
    while (queue.length) { const i = queue.pop(); for (const v of vertsOf(ents[i])) for (const j of hits(v)) if (!comp.has(j)) { comp.add(j); queue.push(j); } }
    for (const i of [...comp]) if (!ed(ents[i])) comp.delete(i);
    if (!comp.size) { // nothing attached: only the dimension itself
      E.tx("dimension value", () => { E.doc.ents = ents.map((e) => (e.id === d.id ? Object.assign({}, e, { p2: G.add(e.p2, mv), loc: G.add(e.loc, G.mul(mv, 0.5)) }) : e)); E.reindex(); });
      return "No drawing object is attached to the end points of this dimension, so only the dimension changed.";
    }
    let bb = null; for (const i of comp) bb = G.mergeBounds(bb, K.bbox(ents[i], E.doc));
    const inBox = (p) => p[0] >= bb.x0 - tol && p[0] <= bb.x1 + tol && p[1] >= bb.y0 - tol && p[1] <= bb.y1 + tol;
    const mp = (p) => { const k = w(p); return k ? [p[0] + mv[0] * k, p[1] + mv[1] * k] : p; };
    const out = ents.map((e, i) => {
      if (comp.has(i)) {
        if (e.t === "line") return Object.assign({}, e, { a: mp(e.a), b: mp(e.b) });
        if (e.t === "pline") return Object.assign({}, e, { pts: e.pts.map((p) => { const q = mp(p); return [q[0], q[1], p[2] || 0]; }) });
        if (e.t === "arc") { const [P, Q] = arcEnds(e); return rebuildArc(e, mp(P), mp(Q)); }
      }
      if (e.t === "dim") {
        const keys = ["p1", "p2", "c"].filter((k) => isP(e[k])); if (!keys.some((k) => inBox(e[k]))) return e;
        const n = Object.assign({}, e); for (const k of [...keys, "loc"]) if (isP(e[k])) n[k] = mp(e[k]); return n;
      }
      if (!ed(e) || comp.has(i)) return e;
      if (e.t === "circle" || e.t === "point" || e.t === "text" || e.t === "mtext" || e.t === "insert") { const a = e.c || e.p; if (a && inBox(a)) { const q = mp(a); return Object.assign({}, e, e.c ? { c: q } : { p: q }); } }
      if (e.t === "ellipse" && inBox(e.c)) return Object.assign({}, e, { c: mp(e.c) });
      if (e.t === "hatch" && e.loops && e.loops.every((l) => l.every(inBox))) return Object.assign({}, e, { loops: e.loops.map((l) => l.map(mp)) });
      return e;
    });
    E.tx("dimension value", () => { E.doc.ents = out; E.reindex(); });
    moved = comp.size;
    return `${moved} connected object${moved > 1 ? "s" : ""} redrawn. Dimensions on them were updated too.`;
  };
  const fmtVal = (v) => String(+(+v).toFixed(6));
  const valueDlg = async (E, d) => {
    const meas = K.dimMeasure(d), lab = d.kind === "rad" ? "Radius" : d.kind === "dia" ? "Diameter" : "Length";
    const r = await E.dialog("Change dimension value", `<p class="cx-note">${lab} now: <b>${esc(fmtVal(meas))} ${esc(E.doc.units)}</b>. Type the new value and the drawing is redrawn to match.</p><div class="cx-frm"><label>New ${lab.toLowerCase()} (${esc(E.doc.units)})<input id="dv" type="number" step="any" min="0" value="${esc(fmtVal(meas))}"></label><label>Dimension text (optional — use &lt;&gt; for the value)<input id="dt" value="${esc(d.txt || "")}"></label></div>`,
      (b) => { const v = +b.querySelector("#dv").value; if (!(v > 0)) throw new Error("The value must be above zero."); return { v, t: b.querySelector("#dt").value }; }, { init: (b) => { const i = b.querySelector("#dv"); i.focus(); i.select(); } });
    if (!r) return;
    let msg = "";
    if (Math.abs(r.v - meas) > Math.max(1e-9, meas * 1e-9)) msg = K.driveDim(E, E.byId(d.id), r.v);
    const cur = E.byId(d.id), txt = r.t ? K.sym(r.t) : null; if ((cur.txt || null) !== txt) E.tx("dimension text", () => E.replace(d.id, Object.assign({}, cur, { txt })));
    if (msg) E.msg(msg, "ok");
  };
  K.dimValueDlg = valueDlg;
  cmd("DIMVALUE", { a: ["DV", "DIMEDITVALUE"], d: "Change a dimension's value — the drawing is redrawn to the new size", fn: async (E, args) => {
    let d = args && args.id ? E.byId(args.id) : null;
    if (!d || d.t !== "dim") { const v = await E.getEnt("Select the dimension to change:", { filter: (x) => x.t === "dim" && DRIVEN.includes(x.kind) }); if (!v) return; d = v.e; }
    await valueDlg(E, d);
  } });
  const TE = K.CMDS.TEXTEDIT, origTE = TE && TE.fn;
  if (TE) TE.fn = async (E, args) => { const e = args && args.id ? E.byId(args.id) : null; if (e && e.t === "dim" && DRIVEN.includes(e.kind)) return valueDlg(E, e); return origTE(E, args); };
  /* Properties panel: the value of the single selected dimension */
  K.propsHooks = K.propsHooks || [];
  K.propsHooks.push((E, el, ents) => {
    if (ents.length !== 1 || ents[0].t !== "dim" || !DRIVEN.includes(ents[0].kind) || E.readOnly) return;
    const d = ents[0], box = document.createElement("div"), lab = d.kind === "rad" ? "Radius" : d.kind === "dia" ? "Diameter" : "Length";
    box.innerHTML = `<h4>Dimension value</h4><div class="cx-pg"><label class="cx-w">${lab} (${esc(E.doc.units)})<input data-dval type="number" step="any" min="0" value="${esc(fmtVal(K.dimMeasure(d)))}"></label><button class="cx-b" data-dgo type="button">Redraw to this value</button></div><p class="cx-note">The connected drawing is stretched to the new value.</p>`;
    el.insertBefore(box, el.firstChild);
    const go = () => { const v = +box.querySelector("[data-dval]").value; try { E.msg(K.driveDim(E, E.byId(d.id), v), "ok"); } catch (er) { E.err(er.message); } };
    box.querySelector("[data-dgo]").onclick = go; box.querySelector("[data-dval]").addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); go(); } });
  });

  /* =============================== 5. units: the whole drawing converts =============================== */
  K.UNITNAMES = { mm: "Millimetres (mm)", cm: "Centimetres (cm)", m: "Metres (m)", in: "Inches (in)", ft: "Feet (ft)" };
  const UNIT_DEC = { mm: 2, cm: 3, m: 4, in: 3, ft: 4 };
  /** convert the open drawing to another unit (k = old unit in mm / new unit in mm) */
  K.convertUnits = (E, to, opts) => {
    const doc = E.doc, from = doc.units, UM = K.UNITMM;
    if (!UM[to]) throw new Error("Unknown unit " + to);
    if (from === to) return;
    if (doc._active && doc._active !== "model") throw new Error("Go back to the Model tab before converting units.");
    const k = UM[from] / UM[to], m = K.M.scale([0, 0], k);
    const sc = (arr) => (arr || []).map((e) => K.xform(e, m));
    E.tx("units " + from + " → " + to, () => {
      doc.ents = sc(doc.ents);
      if (doc.modelEnts) doc.modelEnts = sc(doc.modelEnts);
      /* block definitions stay as they are: every insert is scaled by k, which scales what it shows */
      const ds = {}; for (const key of ["th", "as", "exo", "exe", "gap", "dli"]) ds[key] = +(doc.dim[key] * k).toPrecision(8);
      doc.dim = Object.assign({}, doc.dim, ds, { dec: opts && opts.dec != null ? opts.dec : UNIT_DEC[to] || doc.dim.dec });
      if (doc.dimstyles) { const o = {}; for (const n of Object.keys(doc.dimstyles)) { const s = Object.assign({}, doc.dimstyles[n]); for (const key of ["th", "as", "exo", "exe", "gap", "dli"]) if (typeof s[key] === "number") s[key] = +(s[key] * k).toPrecision(8); o[n] = s; } doc.dimstyles = o; }
      doc.text = Object.assign({}, doc.text, { h: +(doc.text.h * k).toPrecision(8) });
      if (doc.pdsize > 0) doc.pdsize = +(doc.pdsize * k).toPrecision(8);
      doc.ltscale = +(doc.ltscale * k).toPrecision(8);
      doc.layouts = (doc.layouts || []).map((l) => Object.assign({}, l, { ents: (l.ents || []).map((e) => (e.t === "vport" ? Object.assign({}, e, { cx: e.cx * k, cy: e.cy * k, sc: e.sc / k }) : e)) }));
      doc.units = to;
    });
    E.set.gridUnit = +(E.set.gridUnit * k).toPrecision(8); E.set.snapUnit = +(E.set.snapUnit * k).toPrecision(8);
    try { localStorage.setItem("kcad-prefs", JSON.stringify(E.set)); } catch (e) { /* ignore */ }
    if (E.zoomExt) E.zoomExt(); if (E.drawStatus) E.drawStatus();
    const extra = (doc.solids && doc.solids.length) || (doc.cons && doc.cons.length) ? " 3D solids and parametric constraints are not converted." : "";
    E.msg(`Drawing converted from ${from} to ${to} (× ${+k.toPrecision(6)}).${extra}`, "ok");
  };
  /* the UNITS command: choose the unit, tick "convert" to rescale the whole drawing */
  const UC = K.CMDS.UNITS;
  if (UC) UC.fn = async (E) => {
    const D = E.doc.dim, opt = Object.entries(K.UNITNAMES).map(([k, n]) => `<option value="${k}"${k === E.doc.units ? " selected" : ""}>${n}</option>`).join("");
    const r = await E.dialog("Drawing units", `<div class="cx-frm"><label>Unit<select id="uu">${opt}</select></label><label class="cx-chk"><input id="uc" type="checkbox" checked> Convert the whole drawing to this unit (objects, dimensions, text size, grid)</label><label>Length precision (decimals)<input id="ud" type="number" min="0" max="8" value="${D.dec}"></label><label>Angle precision (decimals)<input id="ua" type="number" min="0" max="6" value="${D.adec}"></label></div><p class="cx-note">Convert on: the drawing keeps its real size — a 100 mm part becomes 0.1 m. Convert off: only the unit label changes and the numbers stay the same.</p>`,
      (b) => ({ u: b.querySelector("#uu").value, c: b.querySelector("#uc").checked, d: Math.max(0, Math.min(8, +b.querySelector("#ud").value | 0)), a: Math.max(0, Math.min(6, +b.querySelector("#ua").value | 0)) }));
    if (!r) return;
    E.begin("units");
    try {
      if (r.c && r.u !== E.doc.units) { K.convertUnits(E, r.u, { dec: r.d }); E.doc.dim = Object.assign({}, E.doc.dim, { dec: r.d, adec: r.a }); }
      else { E.doc.units = r.u; E.doc.dim = Object.assign({}, E.doc.dim, { dec: r.d, adec: r.a }); }
    } finally { E.end(); }
    if (E.drawStatus) E.drawStatus(); E.redraw();
  };
  cmd("UNITCONVERT", { a: ["UC"], d: "Convert the whole drawing to another unit (mm, cm, m, in, ft)", fn: async (E, args) => { const u = args && args.unit; if (u) { K.convertUnits(E, u); return; } return UC.fn(E); } });

  /* ribbon buttons */
  const rib = (K.RIBBON || []).find((t) => t.t === "Annotate");
  if (rib) {
    const dims = rib.g.find((g) => g.n === "Dimensions");
    if (dims) dims.b.push(["DIMVALUE", "Edit value", "dimlin"], ["DIMALL", "Auto dims", "dimali"], ["DIMAUTO", "Auto size", "dimstyle"]);
    const man = (K.RIBBON || []).find((t) => t.t === "Manage"), set = man && man.g.find((g) => g.n === "Settings");
    if (set) set.b.push(["UNITCONVERT", "Convert units", "units"], ["LAYSTD", "Std layers", "layer"]);
  }
  const st = document.createElement("style"); st.textContent = ".cx-unit{background:transparent;color:inherit;border:1px solid rgba(128,128,128,.5);border-radius:4px;font:inherit;padding:0 2px;margin-right:4px;cursor:pointer}.cx-unit option{color:#111}"; document.head.appendChild(st);
  /* each editor: the unit picker on the status bar */
  K.editorHooks = K.editorHooks || [];
  K.editorHooks.push((E) => {
    if (E.set.autodim === undefined) E.set.autodim = true;
  });
})((window.KCAD = window.KCAD || {}));
