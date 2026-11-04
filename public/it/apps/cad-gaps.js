/* KMR CAD Draft — clearance (gap) dimensions for layouts.
   LAYGAPS marks the distance wall → machine and machine → machine on all four sides of every machine / object.
   Every gap dimension stays tied to its two objects: move a machine and the numbers follow;
   double-click a gap, type a new distance, and the machine moves to it (with its label). */
(function (K) {
  "use strict";
  const G = K.geom, cmd = K.cmd, esc = K.esc;
  const LAYER = "Clearance";
  const SKIP_LAYER = /wall|aisle|zone|annot|dim|text|hatch|cent|hidden|constr|section|clearance|title|border|frame/i;
  const NICE = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
  const nice = (x) => { if (!(x > 0) || !isFinite(x)) return 1; const p = Math.pow(10, Math.floor(Math.log10(x))), m = x / p; let b = NICE[0]; for (const n of NICE) if (n <= m * 1.0001) b = n; return b * p; };

  /** axis-aligned box of a rectangle-like object (closed 4-point polyline, or a circle) — null for anything else */
  const boxOf = (e, doc) => {
    if (e.t === "pline" && e.closed && e.pts && e.pts.length === 4 && e.pts.every((p) => !p[2])) {
      const xs = e.pts.map((p) => p[0]), ys = e.pts.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), tol = 1e-6 * Math.max(1, x1 - x0, y1 - y0);
      const ok = e.pts.every((p) => (Math.abs(p[0] - x0) < tol || Math.abs(p[0] - x1) < tol) && (Math.abs(p[1] - y0) < tol || Math.abs(p[1] - y1) < tol));
      return ok && x1 - x0 > 0 && y1 - y0 > 0 ? { x0, y0, x1, y1 } : null;
    }
    if (e.t === "circle") return { x0: e.c[0] - e.r, y0: e.c[1] - e.r, x1: e.c[0] + e.r, y1: e.c[1] + e.r };
    return null;
  };
  const inside = (a, b, t) => a.x0 >= b.x0 - t && a.x1 <= b.x1 + t && a.y0 >= b.y0 - t && a.y1 <= b.y1 + t;
  const area = (b) => (b.x1 - b.x0) * (b.y1 - b.y0);

  /** the wall, the machines / objects and (for naming) a label of each */
  const scan = (E) => {
    const doc = E.doc, cand = [];
    for (const e of doc.ents) { if (e.t === "dim") continue; const L = K.layer(doc, e.layer); if (L.on === false || L.frozen) continue; const b = boxOf(e, doc); if (b) cand.push({ e, b, layer: e.layer || "0" }); }
    if (!cand.length) return null;
    let all = null; for (const c of cand) all = G.mergeBounds(all, c.b);
    const tol = 1e-6 * Math.max(1, all.x1 - all.x0, all.y1 - all.y0);
    for (const c of cand) c.contains = cand.some((o) => o !== c && area(o.b) < area(c.b) * 0.9999 && inside(o.b, c.b, tol));
    let wall = cand.filter((c) => /wall/i.test(c.layer)).sort((a, b) => area(b.b) - area(a.b))[0];
    if (!wall) wall = cand.filter((c) => c.contains).sort((a, b) => area(b.b) - area(a.b))[0];
    const objs = cand.filter((c) => c !== wall && !c.contains && !SKIP_LAYER.test(c.layer) && (!wall || inside(c.b, wall.b, tol)));
    return { wall: wall || null, objs, tol, all };
  };

  const hasGap = (doc) => doc.ents.some((e) => e.t === "dim" && e.gap);
  const refBox = (doc, id) => { const e = doc.ents.find((x) => x.id === id); return e ? boxOf(e, doc) : null; };
  const labelOf = (doc, id) => {
    const o = refBox(doc, id); if (!o) return "object";
    const t = doc.ents.find((e) => (e.t === "text" || e.t === "mtext") && e.p && e.p[0] >= o.x0 && e.p[0] <= o.x1 && e.p[1] >= o.y0 && e.p[1] <= o.y1);
    return t ? String(t.s || t.txt || "").slice(0, 40) || "object" : "object";
  };

  /** geometry of one gap dimension from the current position of its two objects (null when it cannot be resolved) */
  const resolve = (doc, d) => {
    const g = d.gap, A = refBox(doc, g.a), B = refBox(doc, g.b); if (!A || !B) return null;
    const x = g.ax === "x", lo = x ? "x0" : "y0", hi = x ? "x1" : "y1", plo = x ? "y0" : "x0", phi = x ? "y1" : "x1";
    const ea = g.wa ? A[lo] : A[hi], eb = g.wb ? B[hi] : B[lo];
    const l = Math.max(A[plo], B[plo]), h = Math.min(A[phi], B[phi]);
    const mid = h > l ? (l + h) / 2 : g.mid != null ? g.mid : (A[plo] + A[phi]) / 2;
    const p1 = x ? [ea, mid] : [mid, ea], p2 = x ? [eb, mid] : [mid, eb], loc = x ? [(ea + eb) / 2, mid] : [mid, (ea + eb) / 2];
    return { p1, p2, loc, mid, len: eb - ea };
  };
  const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];

  /** the machine that moves when the gap is edited, and which direction is "more gap" */
  const mover = (g) => (g.wa ? { id: g.b, sgn: 1 } : g.wb ? { id: g.a, sgn: -1 } : g.mv === "a" ? { id: g.a, sgn: -1 } : { id: g.b, sgn: 1 });

  /* ---------- keep gap dimensions in step with the drawing after every edit ---------- */
  K.editorHooks = K.editorHooks || [];
  K.editorHooks.push((E) => {
    const prev = E.txEndHook;
    E.txEndHook = (snap) => {
      if (prev) prev(snap);
      const doc = E.doc; if (!hasGap(doc)) return;
      const gone = [], upd = [];
      for (const d of doc.ents) {
        if (d.t !== "dim" || !d.gap) continue;
        const r = resolve(doc, d);
        if (!r) { gone.push(d.id); continue; }
        if (!same(r.p1, d.p1) || !same(r.p2, d.p2) || !same(r.loc, d.loc)) upd.push([d, r]);
      }
      for (const [d, r] of upd) E.replace(d.id, Object.assign({}, d, { p1: r.p1, p2: r.p2, loc: r.loc, gap: Object.assign({}, d.gap, { mid: r.mid }) }));
      for (const id of gone) E.remove(id);
    };
  });

  /* ---------- LAYGAPS: mark the distances ---------- */
  const ensureLayer = (doc) => { if (!doc.layers.find((l) => l.name === LAYER)) doc.layers = doc.layers.concat([{ name: LAYER, color: "#00ffff", lt: "CONTINUOUS", lw: 0.18, on: true, frozen: false, lock: false }]); };
  K.markGaps = (E) => {
    const doc = E.doc, S = scan(E); if (!S || !S.objs.length) return { n: 0, objs: 0 };
    const { wall, objs, tol } = S, W = wall ? wall.b : null, side = Math.max((W || S.all).x1 - (W || S.all).x0, (W || S.all).y1 - (W || S.all).y0);
    const dirs = [{ ax: "x", s: 1 }, { ax: "x", s: -1 }, { ax: "y", s: 1 }, { ax: "y", s: -1 }];
    const pairs = new Map();
    for (const o of objs) {
      for (const d of dirs) {
        const x = d.ax === "x", lo = x ? "x0" : "y0", hi = x ? "x1" : "y1", plo = x ? "y0" : "x0", phi = x ? "y1" : "x1"; let best = null;
        for (const n of objs) {
          if (n === o) continue;
          const ov = Math.min(o.b[phi], n.b[phi]) - Math.max(o.b[plo], n.b[plo]); if (ov <= Math.max(tol, 0.1 * Math.min(o.b[phi] - o.b[plo], n.b[phi] - n.b[plo]))) continue;
          const gap = d.s > 0 ? n.b[lo] - o.b[hi] : o.b[lo] - n.b[hi]; if (gap <= tol) continue;
          if (!best || gap < best.gap) best = { gap, n, wall: false };
        }
        if (W) { const gap = d.s > 0 ? W[hi] - o.b[hi] : o.b[lo] - W[lo]; if (gap > tol && (!best || gap < best.gap)) best = { gap, n: wall, wall: true }; }
        if (!best) continue;
        const lowObj = d.s > 0 ? o : best.n, highObj = d.s > 0 ? best.n : o;
        const g = { a: lowObj.e.id, b: highObj.e.id, ax: d.ax }; if (best.wall) { if (d.s > 0) g.wb = 1; else g.wa = 1; }
        const key = g.a + "|" + g.b + "|" + g.ax + (g.wa ? "|wa" : "") + (g.wb ? "|wb" : "");
        if (!pairs.has(key)) pairs.set(key, { g, gap: best.gap });
      }
    }
    const gaps = Array.from(pairs.values()).map((p) => p.gap).sort((a, b) => a - b), med = gaps.length ? gaps[gaps.length >> 1] : side * 0.02;
    const th = doc.dim.th || 2.5, scale = nice(Math.min(side * 0.006, med * 0.25) / th);
    E.begin("mark gaps");
    let n = 0;
    try {
      ensureLayer(doc);
      for (const d of doc.ents.filter((e) => e.t === "dim" && e.gap)) E.remove(d.id);
      for (const { g } of pairs.values()) {
        const d = { t: "dim", kind: "lin", dir: g.ax === "x" ? "h" : "v", layer: LAYER, gap: g, st: { scale }, p1: [0, 0], p2: [0, 0], loc: [0, 0] };
        const r = resolve({ ents: doc.ents }, d); if (!r) continue;
        d.p1 = r.p1; d.p2 = r.p2; d.loc = r.loc; d.gap = Object.assign({}, g, { mid: r.mid, mv: "b" });
        E.add(d, true); n++;
      }
    } finally { E.end(); }
    return { n, objs: objs.length };
  };
  cmd("LAYGAPS", { a: ["GAPS", "MARKGAPS", "CLEARANCE"], d: "Mark the distance wall → machine and machine → machine on all four sides of every machine; edit a distance and the machine moves", fn: async (E, args) => {
    const r = K.markGaps(E);
    if (!r.objs) { if (!(args && args.quiet)) E.msg("No machines or objects found (closed rectangles inside the wall).", "err"); return; }
    if (E.zoomExt && !(args && args.quiet)) E.redraw();
    E.msg(`${r.n} distance${r.n === 1 ? "" : "s"} marked for ${r.objs} machine${r.objs === 1 ? "" : "s"} / objects. Double-click a distance to change it — that machine moves.`, "ok");
  } });
  cmd("DELGAPS", { a: ["CLEARGAPS"], d: "Remove all clearance (gap) dimensions", fn: async (E) => { const ids = E.doc.ents.filter((e) => e.t === "dim" && e.gap).map((e) => e.id); if (!ids.length) return E.msg("No gap dimensions to remove."); E.tx("remove gaps", () => { for (const id of ids) E.remove(id); }); E.msg(`${ids.length} gap dimensions removed.`, "ok"); } });

  /* ---------- editing a gap moves the machine ---------- */
  const bbOf = (e, doc) => { try { return K.bbox(e, doc); } catch (er) { return null; } };
  const baseMeasure = K.dimMeasure, baseDrive = K.driveDim;
  K.dimMeasure = (e) => (e && e.gap && e.p1 && e.p2 ? Math.abs(e.gap.ax === "x" ? e.p2[0] - e.p1[0] : e.p2[1] - e.p1[1]) : baseMeasure(e));
  K.driveDim = (E, d, val) => {
    if (!d || !d.gap) return baseDrive(E, d, val);
    if (!(val >= 0) || !isFinite(val)) throw new Error("The value must be zero or more.");
    const doc = E.doc, g = d.gap, r = resolve(doc, d); if (!r) throw new Error("This distance lost one of its objects.");
    const cur = Math.abs(r.len), delta = val - cur; if (Math.abs(delta) < 1e-9) return "The distance is already " + +val.toFixed(6) + ".";
    const m = mover(g), mvE = doc.ents.find((e) => e.id === m.id), mb = mvE && boxOf(mvE, doc);
    if (!mb) throw new Error("The object to move was not found.");
    if (!E.editable(mvE)) throw new Error("That object is on a locked or frozen layer.");
    const refIds = new Set(); for (const e of doc.ents) if (e.t === "dim" && e.gap) { refIds.add(e.gap.a); refIds.add(e.gap.b); }
    const t = 1e-6 * Math.max(1, mb.x1 - mb.x0, mb.y1 - mb.y0), sh = m.sgn * delta, mv = g.ax === "x" ? K.M.move(sh, 0) : K.M.move(0, sh), label = labelOf(doc, m.id);
    /* the machine, its label / marks inside it, and ordinary dimensions that sit on it */
    const move = [];
    for (const e of doc.ents) {
      if (e.id === m.id) { move.push(e); continue; }
      if (e.t === "dim") { if (e.gap || e.kind === "rad" || e.kind === "dia" || !e.p1 || !e.p2) continue; const a = { x0: Math.min(e.p1[0], e.p2[0]), x1: Math.max(e.p1[0], e.p2[0]), y0: Math.min(e.p1[1], e.p2[1]), y1: Math.max(e.p1[1], e.p2[1]) }; if (inside(a, mb, t)) move.push(e); continue; }
      if (refIds.has(e.id)) continue; const b = bbOf(e, doc); if (b && inside(b, mb, t)) move.push(e);
    }
    E.tx("gap distance", () => { for (const e of move) E.replace(e.id, Object.assign(K.xform(e, mv), { id: e.id })); });
    /* warn when the machine now overlaps another one */
    const nb = boxOf(E.byId(m.id), doc); let hit = "";
    if (nb) { const S = scan(E); if (S) for (const o of S.objs) { if (o.e.id === m.id) continue; if (Math.min(nb.x1, o.b.x1) - Math.max(nb.x0, o.b.x0) > t && Math.min(nb.y1, o.b.y1) - Math.max(nb.y0, o.b.y0) > t) { hit = ` Warning: it now overlaps ${labelOf(doc, o.e.id)}.`; break; } } }
    return `${label} moved ${+Math.abs(sh).toFixed(6)} ${doc.units}; the distance is now ${+val.toFixed(6)} ${doc.units}.${hit}`;
  };

  /* Properties panel: which object moves when this distance is edited */
  K.propsHooks = K.propsHooks || [];
  K.propsHooks.push((E, el, ents) => {
    if (ents.length !== 1 || ents[0].t !== "dim" || !ents[0].gap || E.readOnly) return;
    const d = ents[0], g = d.gap; if (g.wa || g.wb) return; // against a wall the machine always moves
    const box = document.createElement("div");
    box.innerHTML = `<h4>Object that moves</h4><div class="cx-pg"><label class="cx-w">When this distance is changed, move<select data-gmv><option value="b"${g.mv !== "a" ? " selected" : ""}>${esc(labelOf(E.doc, g.b))} (right / upper)</option><option value="a"${g.mv === "a" ? " selected" : ""}>${esc(labelOf(E.doc, g.a))} (left / lower)</option></select></label></div>`;
    el.insertBefore(box, el.firstChild);
    box.querySelector("[data-gmv]").onchange = (ev) => { const v = ev.target.value; E.tx("gap mover", () => E.replace(d.id, Object.assign({}, E.byId(d.id), { gap: Object.assign({}, E.byId(d.id).gap, { mv: v }) }))); };
  });

  /* ribbon */
  const rib = (K.RIBBON || []).find((t) => t.t === "Annotate");
  if (rib) { const dims = rib.g.find((g) => g.n === "Dimensions"); if (dims) dims.b.push(["LAYGAPS", "Mark gaps", "dimlin"]); }
})(window.KCAD);
