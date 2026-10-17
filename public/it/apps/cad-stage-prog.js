/* KMR CAD Draft — progressive stage drawings, ONE sheet per operation (K.stageProg).
   The part is drawn the way it really is after each operation, from the customer's own drawing:
     contour   outer outline + bore(s) of the finished part read from the drawing's thick lines (half section or full view)
     features  every dimension of the frozen table is found on that outline (diameters, lengths, chamfers, angles, radii,
               threads, finish, GD&T) so an operation machines exactly the pieces its own dimensions belong to
     sheets    raw bar → sawn blank → turning (full section, chuck and datum, G54) → finished-part views for the other operations
   Drawing rules (ISO 129-1 / ASME Y14.5 practice, all sizes from one text height so they scale with the sheet):
     red = cutting surface of this operation · dark grey = not cut here · dashed = hidden · blue = chuck / vice · phantom = stock removed
     one sheet per operation, dimensions outside the part in rows / columns (shortest nearest), inside the void for bores. */
(function (K) {
  "use strict";
  const G = K.geom, SP = (K.stageProg = {});
  const RED = "#e11d48", DG = "#374151", BLUE = "#0369a1", INK = "#111111", PHG = "#6b7280";
  const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
  const numOf = (s) => { const m = String(s == null ? "" : s).replace(/,/g, ".").match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };
  const D2R = Math.PI / 180;

  /* ================================================================ A. the outline of the part from the drawing ================================================================ */
  /** outer outline and bore chains of the finished part: points [x, r] (x from the left end, r ≥ 0), in drawing units.
      sil = K.stageFlow.silhouette(doc) (axis, window). Uses the thick lines only; picks the half of the drawing that is a section. */
  SP.contour = (doc) => {
    const skipL = /dim|hatch|text|title|border|frame|defpoint|centre|center|note|symbol|balloon|table/i;
    const lt = (e) => String(e.lt || (doc.layers.find((l) => l.name === e.layer) || {}).lt || "").toUpperCase();
    let all = [];
    for (const e of doc.ents) {
      if (!["line", "pline", "arc", "circle"].includes(e.t) || skipL.test(e.layer || "")) continue;
      if (/CENTER|PHANTOM|DASHDOT|HIDDEN|DASH/.test(lt(e))) continue;
      let segs; try { segs = K.segs(e, doc); } catch (er) { continue; }
      for (const s of segs) {
        const pts = s.k === "s" ? [s.a, s.b] : G.arcPoints(s.c, s.r, s.a0, s.a1, 0.02);
        for (let i = 0; i + 1 < pts.length; i++) all.push({ x0: pts[i][0], y0: pts[i][1], x1: pts[i + 1][0], y1: pts[i + 1][1], lw: e.lw || 0 });
      }
    }
    if (all.length < 8) return null;
    // thick lines only; very long lines are the sheet border
    let ext = null; for (const s of all) ext = G.mergeBounds(ext, { x0: Math.min(s.x0, s.x1), y0: Math.min(s.y0, s.y1), x1: Math.max(s.x0, s.x1), y1: Math.max(s.y0, s.y1) });
    const big = 0.45 * Math.max(ext.x1 - ext.x0, ext.y1 - ext.y0); all = all.filter((s) => Math.hypot(s.x1 - s.x0, s.y1 - s.y0) < big);
    const mx0 = Math.max(0, ...all.map((s) => s.lw)); if (mx0 > 0) all = all.filter((s) => s.lw >= 0.7 * mx0);
    // the axis: horizontal (or vertical) lines that mirror each other about a line
    const vote = (H) => {
      const V = new Map(), q = (v) => Math.round(v * 20) / 20;
      for (let i = 0; i < H.length; i++) for (let j = i + 1; j < H.length; j++) {
        const a = H[i], b = H[j], lo = Math.max(a.a, b.a), hi = Math.min(a.b, b.b); if (hi - lo < 0.5) continue; const r = Math.abs(a.y - b.y) / 2; if (r < 0.4) continue;
        const k = q((a.y + b.y) / 2), v = V.get(k) || { ax: (a.y + b.y) / 2, w: 0, lo: 1e9, hi: -1e9, r: 0 }; v.w += hi - lo; v.lo = Math.min(v.lo, lo); v.hi = Math.max(v.hi, hi); v.r = Math.max(v.r, r); V.set(k, v);
      }
      let best = null; for (const v of V.values()) if (!best || v.w > best.w) best = v; return best;
    };
    const hz = [], vt = [];
    for (const s of all) { const dx = s.x1 - s.x0, dy = s.y1 - s.y0, L = Math.hypot(dx, dy); if (L < 0.3) continue; if (Math.abs(dy) <= 1e-3 * L + 1e-6) hz.push({ y: (s.y0 + s.y1) / 2, a: Math.min(s.x0, s.x1), b: Math.max(s.x0, s.x1) }); else if (Math.abs(dx) <= 1e-3 * L + 1e-6) vt.push({ y: (s.x0 + s.x1) / 2, a: Math.min(s.y0, s.y1), b: Math.max(s.y0, s.y1) }); }
    const bh = vote(hz), bv = vote(vt); let horiz = true, best = bh; if (bv && (!bh || bv.w > bh.w * 1.2)) { best = bv; horiz = false; }
    if (!best || best.hi - best.lo < 3) return null;
    const ax = best.ax, rmax = best.r, mp0 = (p) => (horiz ? [p[0], p[1] - ax] : [p[1], p[0] - ax]);
    // the part's length: grow the window over thick lines that touch it (chamfered ends are not mirrored pairs)
    let lo = best.lo, hi = best.hi; const near = all.map((s) => { const a = mp0([s.x0, s.y0]), b = mp0([s.x1, s.y1]); return [Math.min(a[0], b[0]), Math.max(a[0], b[0]), Math.max(Math.abs(a[1]), Math.abs(b[1]))]; }).filter((t) => t[2] <= 1.05 * rmax);
    for (let it = 0; it < 6; it++) { const d = 0.04 * (hi - lo); let l2 = lo, h2 = hi; for (const t of near) if (t[1] >= lo - d && t[0] <= hi + d) { l2 = Math.min(l2, t[0]); h2 = Math.max(h2, t[1]); } if (l2 === lo && h2 === hi) break; lo = l2; hi = h2; }
    const x0 = lo, L = hi - lo, mp = (p) => { const q = mp0(p); return [q[0] - x0, q[1]]; };
    let raw = all.map((s) => { const a = mp([s.x0, s.y0]), b = mp([s.x1, s.y1]); return { u0: a[0], w0: a[1], u1: b[0], w1: b[1] }; });
    raw = raw.filter((s) => Math.min(s.u0, s.u1) > -0.01 * L && Math.max(s.u0, s.u1) < 1.01 * L && Math.abs(s.w0) < 1.05 * rmax && Math.abs(s.w1) < 1.05 * rmax);
    const eps = 0.03 * rmax, half = (h) => raw.map((s) => ({ u0: s.u0, w0: h * s.w0, u1: s.u1, w1: h * s.w1 })).filter((s) => Math.min(s.w0, s.w1) > -1e-6 && Math.max(s.w0, s.w1) > eps);
    const env = (segs) => {
      const tol = 0.0016 * L, raw0 = [...new Set(segs.flatMap((s) => [s.u0, s.u1]).map((v) => Math.round(v * 1000) / 1000))].sort((a, b) => a - b), U = []; for (const v of raw0) { if (U.length && v - U[U.length - 1] < tol) continue; U.push(v); }
      const sn = (v) => { let b = U[0], d = Infinity; for (const u of U) { const e = Math.abs(u - v); if (e < d) { d = e; b = u; } } return b; };
      segs = segs.map((s) => { const a = sn(s.u0), b = sn(s.u1); return a === s.u0 && b === s.u1 ? s : { u0: a, w0: s.w0, u1: b, w1: s.w1 }; }).filter((s) => Math.abs(s.u1 - s.u0) > 1e-6);
      const outer = [], inner = []; let chain = null;
      const push = (arr, u, w) => { const l = arr[arr.length - 1]; if (l && Math.abs(l[0] - u) < 1e-3 && Math.abs(l[1] - w) < 1e-3) return; arr.push([u, w]); };
      for (let i = 0; i + 1 < U.length; i++) {
        const a = U[i], b = U[i + 1]; if (b - a < 2e-3) continue; const m = (a + b) / 2, cand = [];
        for (const s of segs) { const lo = Math.min(s.u0, s.u1), hi = Math.max(s.u0, s.u1); if (hi - lo < 1e-4 || lo > m || hi < m) continue; const f = (u) => s.w0 + ((s.w1 - s.w0) * (u - s.u0)) / (s.u1 - s.u0); cand.push({ wm: f(m), wa: f(a), wb: f(b) }); }
        if (!cand.length) { chain = null; continue; }
        cand.sort((p, q) => q.wm - p.wm); const o = cand[0]; push(outer, a, o.wa); push(outer, b, o.wb);
        const ins = cand.filter((c) => c.wm > eps && c.wm < o.wm - 0.08 * rmax); const n = ins.length ? ins[ins.length - 1] : null;
        if (n) { if (!chain) { chain = []; inner.push(chain); } push(chain, a, n.wa); push(chain, b, n.wb); } else chain = null;
      }
      return { outer, inner: inner.filter((c) => c.length > 1) };
    };
    const E = [env(half(1)), env(half(-1))], span = (r) => r.inner.reduce((t, c) => t + (c[c.length - 1][0] - c[0][0]), 0);
    let pick = E[0]; if (span(E[1]) > span(E[0]) * 1.05 || (!E[0].outer.length && E[1].outer.length)) pick = E[1];
    if (!pick.outer.length) return null;
    const simp = (pts) => { const o = []; for (const p of pts) { const n = o.length; if (n && Math.abs(o[n - 1][0] - p[0]) < 1e-3 && Math.abs(o[n - 1][1] - p[1]) < 1e-3) continue; if (n > 1) { const a = o[n - 2], b = o[n - 1], cr = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]), ln = Math.hypot(p[0] - a[0], p[1] - a[1]); if (Math.abs(cr) / (ln || 1) < 2e-3 * rmax) { o[n - 1] = p; continue; } } o.push(p); } return o; };
    return { outer: simp(pick.outer), inner: pick.inner.map(simp), L, rmax, tf: { ax, x0, horiz } };
  };

  /** scale and snap a drawing-unit contour to mm: k from calibrate (table diameters), r snapped to table diameters */
  SP.scaleContour = (c, k, dias) => {
    const snap = (r) => { const d = 2 * r * k; let b = null, e = 1e9; for (const v of dias) { const x = Math.abs(d - v); if (x < e) { e = x; b = v; } } return b != null && e <= Math.max(0.03, b * 0.0025) ? b / 2 : r3(r * k); };
    const f = (pts) => simplify(pts.map(([x, r]) => [r2(x * k), snap(r)]));
    return { outer: f(c.outer), inner: c.inner.map(f), L: r2(c.L * k), rmax: r3(c.rmax * k), tf: c.tf, k };
  };
  const simplify = (pts) => { const o = []; for (const p of pts) { const n = o.length; if (n && Math.abs(o[n - 1][0] - p[0]) < 1e-3 && Math.abs(o[n - 1][1] - p[1]) < 1e-3) continue; if (n > 1) { const a = o[n - 2], b = o[n - 1], cr = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]), ln = Math.hypot(p[0] - a[0], p[1] - a[1]); if (Math.abs(cr) / (ln || 1) < 4e-3) { o[n - 1] = p; continue; } } o.push(p); } return o; };
  /** a contour from steps (a typed part shape): flat steps + optional bore from one end */
  SP.fromSteps = (steps, bore) => {
    const outer = []; let x = 0; for (const s of steps) { outer.push([r2(x), s.d / 2], [r2(x + s.l), s.d / 2]); x += s.l; }
    const L = r2(x), inner = [];
    if (bore && bore.d > 0 && bore.depth > 0) inner.push(bore.end === "R" ? [[r2(L - bore.depth), bore.d / 2], [L, bore.d / 2]] : [[0, bore.d / 2], [r2(bore.depth), bore.d / 2]]);
    return { outer, inner, L, rmax: Math.max(...steps.map((s) => s.d)) / 2 };
  };
  /** mirror the part end for end (first turned end is drawn at the left) */
  SP.flip = (c) => { const L = c.L, f = (pts) => pts.map(([x, r]) => [r2(L - x), r]).reverse(); return { outer: f(c.outer), inner: c.inner.map(f).reverse(), L, rmax: c.rmax }; };
  /** steps (flat runs) of the outline, for the old model fields */
  SP.stepsOf = (c) => { const xs = [...new Set(c.outer.map((p) => p[0]))].sort((a, b) => a - b), out = []; for (let i = 0; i + 1 < xs.length; i++) { const m = (xs[i] + xs[i + 1]) / 2, r = rAt(c.outer, m); if (r == null) continue; const l = xs[i + 1] - xs[i], p = out[out.length - 1]; if (p && Math.abs(p.d - 2 * r) < 0.02) p.l = r2(p.l + l); else out.push({ d: r2(2 * r), l: r2(l) }); } return out; };
  /** radius of a polyline [x,r] at x (the largest where there is a shoulder) */
  function rAt(pts, x) { let best = null; for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1], lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]); if (x < lo - 1e-6 || x > hi + 1e-6 || hi - lo < 1e-6) continue; const r = a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]); if (best == null || r > best) best = r; } return best; }
  SP.rAt = rAt;
  const insideAt = (chains, x) => { let best = null; for (const ch of chains) { const r = rAt(ch, x); if (r != null && (best == null || r < best)) best = r; } return best; };
  SP.insideAt = insideAt;

  /* ================================================================ B. calibration and features ================================================================ */
  const plainTxt = (c) => String(c.spec || c.text || c.label || "");
  const isDia = (c) => (c.type === "Diameter" && !/PCD|THRU|^\s*\d+\s*X/i.test(c.text || c.spec || "")) || (c.type === "Thread" && numOf(c.nominal != null && c.nominal !== "" ? c.nominal : c.spec) > 0);
  const nomOf = (c) => numOf(c.nominal != null && c.nominal !== "" ? c.nominal : plainTxt(c).replace(/^\s*\d+\s*X\s*/i, ""));
  SP.nomOf = nomOf; SP.isDia = isDia;
  /** the scale (drawing units → mm) that makes the contour match the diameters and lengths of the table */
  SP.calibrate = (c, chars) => {
    const dias = [...new Set(chars.filter(isDia).map(nomOf).filter((v) => v > 0))], lins = chars.filter((c2) => c2.type === "Linear" && !/DEEP|DEPTH/i.test(plainTxt(c2))).map(nomOf).filter((v) => v > 0);
    const flats = []; const addF = (pts) => { for (let i = 0; i + 1 < pts.length; i++) if (Math.abs(pts[i][1] - pts[i + 1][1]) < 1e-3 * c.rmax) flats.push(2 * pts[i][1]); for (const p of pts) flats.push(2 * p[1]); };
    addF(c.outer); c.inner.forEach(addF);
    const xs = [...new Set([0, c.L, ...c.outer.map((p) => p[0]), ...c.inner.flatMap((ch) => ch.map((p) => p[0]))].map((v) => Math.round(v * 1000) / 1000))].sort((a, b) => a - b);
    const hit = (d, v) => Math.abs(d - v) <= Math.max(0.02, v * 0.006), score = (k) => dias.filter((v) => flats.some((d) => hit(d * k, v))).length * 2 + lins.filter((n) => { for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) if (hit((xs[j] - xs[i]) * k, n)) return true; return false; }).length;
    const cand = new Set([1]); for (const v of dias) for (const d of flats) if (d > 0.5) cand.add(r3(v / d));
    let best = { k: 1, s: score(1) }; for (const k of cand) { if (k < 0.01 || k > 100) continue; const sc = score(k); if (sc > best.s || (sc === best.s && Math.abs(Math.log(k)) < Math.abs(Math.log(best.k)))) best = { k, s: sc }; }
    // least squares on the diameters that hit, so the scale is exact rather than the first candidate that scored best
    let k = best.k; for (let it = 0; it < 3; it++) { let sn = 0, sd = 0; for (const v of dias) { let bd = null, be = 1e9; for (const d of flats) { const e = Math.abs(d * k - v); if (e < be) { be = e; bd = d; } } if (bd != null && be <= Math.max(0.05, v * 0.01)) { sn += v * bd; sd += bd * bd; } } if (sd > 0) k = sn / sd; }
    return { k, score: best.s, of: dias.length * 2 + lins.length, dias };
  };

  /** edges, arcs and break points of the outline and bores, in mm */
  SP.analyse = (m) => {
    const edges = [], pts = { o: [], i: [] }; let id = 0;
    const chains = [{ side: "o", pts: m.outer, ci: 0 }, ...m.inner.map((p, ci) => ({ side: "i", pts: p, ci }))];
    for (const ch of chains) {
      const p = ch.pts; for (const q of p) pts[ch.side].push(q);
      const e0 = edges.length;
      for (let i = 0; i + 1 < p.length; i++) {
        const a = p[i], b = p[i + 1], dx = b[0] - a[0], dr = b[1] - a[1], len = Math.hypot(dx, dr); if (len < 1e-6) continue;
        const kind = Math.abs(dr) <= 0.015 && Math.abs(dr) < 0.12 * Math.abs(dx) ? "flat" : Math.abs(dx) <= 0.02 && Math.abs(dx) < 0.12 * Math.abs(dr) ? "shoulder" : "slope";
        edges.push({ id: id++, side: ch.side, ci: ch.ci, i, a, b, dx, dr, len, kind, ang: Math.atan2(Math.abs(dr), Math.abs(dx)) / D2R, dirn: Math.atan2(dr, dx) });
      }
      // arcs: a run of short edges that keep turning the same way
      const E = edges.slice(e0); let i = 0;
      while (i < E.length) {
        let j = i, turn = 0, s = E[i].len, sg = 0;
        while (j + 1 < E.length && E[j + 1].len <= 1.2 && E[j].len <= 1.2) { let d = E[j + 1].dirn - E[j].dirn; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; if (Math.abs(d) < 0.01) { j++; s += E[j].len; continue; } if (sg && Math.sign(d) !== sg) break; sg = sg || Math.sign(d); if (Math.abs(d) > 1.1) break; turn += Math.abs(d); j++; s += E[j].len; }
        let i2 = i, j2 = j; const axis = (e) => e.kind === "flat" || e.kind === "shoulder";
        while (i2 < j2 && axis(E[i2]) && j2 - i2 >= 2) i2++; while (j2 > i2 && axis(E[j2]) && j2 - i2 >= 2) j2--;
        if (j2 - i2 >= 2 && turn >= 25 * D2R) { const R = s / turn, g = { R: r2(R), turn: turn / D2R }; for (let q = i2; q <= j2; q++) { E[q].arc = g; E[q].kind = "arc"; } }
        i = Math.max(j, i) + 1;
      }
    }
    const ux = (arr) => [...new Set(arr.map((q) => Math.round(q[0] * 1000) / 1000))].sort((a, b) => a - b);
    return { edges, pts, xo: ux(m.outer), xi: ux(m.inner.flat()), L: m.L };
  };

  /** where on the outline each characteristic of the table is. opSide(c): x (mm) the operation of c works near (null = no preference);
      anchorFn(c): the balloon's anchor on the drawing in part coordinates [x, r] (null = unknown) */
  SP.match = (m, A, chars, opOf, anchorFn, opSide) => {
    const out = new Map(), used = new Set(), usedPair = new Set(), L = m.L;
    const tolD = (v) => Math.max(0.011, v * 0.004), tolL = (v) => 0.02 + v * 0.03;
    const txt = (c) => plainTxt(c).toUpperCase(), mid = (e) => [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
    const ordered = chars.slice().sort((a, b) => (opOf(a) - opOf(b)) || a.no - b.no);
    const nearestEdge = (pt) => { let best = null; for (const e of A.edges) { const d = G.distTo(pt, { k: "s", a: e.a, b: e.b }); if (!best || d < best.d) best = { d, e }; } return best && best.e; };
    const near = (c, x, pt) => { const t = opSide ? opSide(c) : null, an = anchorFn ? anchorFn(c) : null; let v = 0; if (t) { if (x < t[0] - 0.05 || x > t[1] + 0.05) v -= 3; } if (an) v -= (4 * Math.hypot(an[0] - (pt ? pt[0] : x), pt ? an[1] - pt[1] : 0)) / L; return v; };
    const terrOf = (c) => (opSide ? opSide(c) : null), okX = (c, x) => { const t = terrOf(c); return !t || (x >= t[0] - 0.05 && x <= t[1] + 0.05); };
    const inT = (c, list, xOf, strict) => { const f = list.filter((q) => okX(c, xOf(q))); return f.length || strict ? f : list; };
    const best = (list, sc) => { let b = null, bs = -1e9; for (const q of list) { const v = sc(q); if (v > bs) { bs = v; b = q; } } return b; };
    const atFace = (e) => [e.a, e.b].some((q) => Math.abs(q[0]) < 0.02 || Math.abs(q[0] - L) < 0.02);
    const angDelta = (e, a) => Math.min(Math.abs(e.ang - a), Math.abs(90 - e.ang - a));
    // 1. diameters (and threads)
    for (const c of ordered) {
      const n = nomOf(c); if (!isDia(c) || !(n > 0)) continue;
      const flats = inT(c, A.edges.filter((e) => e.kind === "flat" && Math.abs(2 * e.a[1] - n) <= tolD(n) && e.len >= 0.4 && !used.has(e.id)), (e) => (e.a[0] + e.b[0]) / 2, true);
      const e = best(flats, (q) => -Math.abs(q.len) * 0 + near(c, (q.a[0] + q.b[0]) / 2, mid(q)) - (q.side === "i" ? 0.15 : 0));
      if (e) { used.add(e.id); out.set(c.no, { kind: "dia", side: e.side, e, x0: e.a[0], x1: e.b[0], r: e.a[1] }); continue; }
      const bp = []; for (const s2 of ["o", "i"]) for (const q of A.pts[s2]) if (Math.abs(2 * q[1] - n) <= tolD(n) && !used.has(s2 + q)) bp.push({ side: s2, q });
      const b2 = best(inT(c, bp, (z) => z.q[0], true), (z) => near(c, z.q[0], z.q) + (Math.abs(z.q[0]) < 1e-3 || Math.abs(z.q[0] - L) < 1e-3 ? 0.6 : 0));
      if (b2) { used.add(b2.side + b2.q); out.set(c.no, { kind: "dia", side: b2.side, pt: b2.q, x0: b2.q[0], x1: b2.q[0], r: b2.q[1] }); continue; }
      const fl = A.edges.filter((e3) => e3.kind === "flat" && Math.abs(2 * e3.a[1] - n) <= tolD(n)); const e2 = fl.find((q) => !used.has(q.id)) || fl[0];
      if (e2) { used.add(e2.id); out.set(c.no, { kind: "dia", side: e2.side, e: e2, x0: e2.a[0], x1: e2.b[0], r: e2.a[1] }); }
    }
    // 2. lengths: the pair of break points that is n apart, on the side of the part this operation works on
    for (const c of ordered) {
      if (c.type !== "Linear") continue; if (/\bHEX\b|E\s*MIN|ACROSS|A\/F/i.test(plainTxt(c))) { out.set(c.no, { kind: "hex" }); continue; }
      const n = nomOf(c); if (!(n > 0) || (/DEEP|DEPTH/i.test(plainTxt(c)) && n < 1)) continue;
      const xs = [...new Set([0, L, ...A.xo, ...A.xi])].sort((a, b) => a - b), cand = [];
      for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) {
        const d = xs[j] - xs[i]; if (Math.abs(d - n) > tolL(n)) continue; const key = xs[i] + "|" + xs[j]; if (usedPair.has(key)) continue;
        const ao = xs[i] === 0 || A.xo.some((v) => Math.abs(v - xs[i]) < 1e-3), bo = xs[j] === L || A.xo.some((v) => Math.abs(v - xs[j]) < 1e-3);
        cand.push({ a: xs[i], b: xs[j], outer: ao && bo, key, d, adj: j === i + 1, face: xs[i] === 0 || xs[j] === L });
      }
      const w = best(inT(c, cand, (q) => (q.a + q.b) / 2, true).filter((q) => okX(c, q.a) || okX(c, q.b)), (q) => (q.face ? 1.2 : 0) + (q.adj ? 0.8 : 0) + (q.outer ? 1 : 0) - (Math.abs(q.d - n) / Math.max(n, 1)) * 40 + near(c, (q.a + q.b) / 2, null) + (/BORE|DEPTH|DEEP/i.test(plainTxt(c)) && !q.outer ? 2 : 0));
      if (w) { usedPair.add(w.key); out.set(c.no, { kind: "len", a: w.a, b: w.b, outer: w.outer }); }
    }
    // 3. chamfers, angles, radii, finish, GD&T
    const arcs = [], seen = new Set(); for (const e of A.edges) if (e.arc && !seen.has(e.arc)) { seen.add(e.arc); e.arc.edges = A.edges.filter((q) => q.arc === e.arc); arcs.push(e.arc); }
    for (const g of arcs) { const es = g.edges, p0 = es[0].a, p1 = es[Math.floor(es.length / 2)].a, p2 = es[es.length - 1].b, a = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), b = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), cc = Math.hypot(p2[0] - p0[0], p2[1] - p0[1]), ar = Math.abs((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1])) / 2; if (ar > 1e-6) g.R = r2((a * b * cc) / (4 * ar)); }
    const spanOf = (c) => (c.usl != null && c.lsl != null && c.usl !== "" && c.lsl !== "" ? +c.usl - +c.lsl : 1e3);
    const rest = ordered.filter((c) => !out.has(c.no)).sort((a, b) => ((a.type === "Angle" ? 0 : 1) - (b.type === "Angle" ? 0 : 1)) || (a.type === "Angle" && b.type === "Angle" ? spanOf(a) - spanOf(b) : 0) || (opOf(a) - opOf(b)) || a.no - b.no);
    for (const c of rest) {
      if (out.has(c.no)) continue; const t = c.type, n = nomOf(c), T = txt(c);
      const ang = (() => { const mm = T.match(/(\d+(?:\.\d+)?)\s*°/); return mm ? parseFloat(mm[1]) : t === "Angle" ? n : null; })();
      const sl = A.edges.filter((e) => e.kind === "slope");
      if (t === "Chamfer" || (t === "Angle" && /CHAMFER/.test(T) && !/HEX/.test(T))) {
        const a = ang != null ? ang : 45, leg = (() => { const mm = T.replace(/°/g, "").match(/(\d+(?:\.\d+)?)\s*X/); return mm ? parseFloat(mm[1]) : null; })();
        const e = best(inT(c, sl, (q) => (q.a[0] + q.b[0]) / 2, true).filter((q) => angDelta(q, a) <= 2.5 && (leg == null || Math.abs(q.dx - leg) <= 0.15 * Math.max(leg, 1))), (q) => -angDelta(q, a) * 2 + (atFace(q) ? 2 : 0) - (used.has(q.id) ? 6 : 0) + near(c, (q.a[0] + q.b[0]) / 2, mid(q)) * 2);
        if (e) { used.add(e.id); out.set(c.no, { kind: "edge", e, p: mid(e), side: e.side }); continue; }
      }
      if (t === "Angle" && ang != null && ang > 0 && ang < 90) {
        const e = best(inT(c, sl, (q) => (q.a[0] + q.b[0]) / 2, true).filter((q) => !used.has(q.id) && angDelta(q, ang) <= 2.5), (q) => -angDelta(q, ang) * 2 + near(c, (q.a[0] + q.b[0]) / 2, mid(q)));
        if (e) { used.add(e.id); out.set(c.no, { kind: "edge", e, p: mid(e), side: e.side }); continue; }
      }
      if (t === "Radius" && n > 0) {
        const g = best(inT(c, arcs.filter((q) => !q.used && g_ok(q, n)), (q) => (q.edges[0].a[0] + q.edges[q.edges.length - 1].b[0]) / 2, true), (q) => -Math.abs(q.R - n) / n * 4 + near(c, (q.edges[0].a[0] + q.edges[q.edges.length - 1].b[0]) / 2, null));
        if (g) { g.used = true; const es = g.edges, e = es[Math.floor(es.length / 2)]; es.forEach((q) => used.add(q.id)); out.set(c.no, { kind: "edge", e, p: [e.a[0], e.a[1]], side: e.side, arc: g }); continue; }
      }
      // 4. no feature of exactly this size (semi-finished / in-process size): the nearest feature of the same kind in the working area of the operation
      {
        const midx = (e) => (e.a[0] + e.b[0]) / 2;
        if (isDia(c) && n > 0) {
          const pool = inT(c, A.edges.filter((e) => e.kind === "flat" && e.len >= 0.4), midx, true), e = best(pool, (q) => -Math.abs(2 * q.a[1] - n) / n * 10 - (used.has(q.id) ? 0.3 : 0));
          if (e && Math.abs(2 * e.a[1] - n) / n <= 0.7) { out.set(c.no, { kind: "dia", side: e.side, e, x0: e.a[0], x1: e.b[0], r: n / 2, semi: true }); continue; }
        }
        if (t === "Linear" && n > 0 && !/\bHEX\b|E\s*MIN|ACROSS|A\/F/i.test(plainTxt(c))) {
          const xs = [...new Set([0, L, ...A.xo, ...A.xi])].sort((a, b) => a - b), cand = [];
          for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) {
            const d = xs[j] - xs[i], key = xs[i] + "|" + xs[j], ao = xs[i] === 0 || A.xo.some((v) => Math.abs(v - xs[i]) < 1e-3), bo = xs[j] === L || A.xo.some((v) => Math.abs(v - xs[j]) < 1e-3);
            cand.push({ a: xs[i], b: xs[j], outer: ao && bo, key, d, adj: j === i + 1, face: xs[i] === 0 || xs[j] === L });
          }
          const bore = /BORE|DEPTH|DEEP/i.test(plainTxt(c)), ok2 = cand.filter((q) => okX(c, q.a) || okX(c, q.b)), pool = ok2;
          const w = best(pool, (q) => -Math.abs(q.d - n) / Math.max(n, 0.5) * 10 + (q.adj ? 0.6 : 0) + (q.outer ? 0.4 : 0) + (q.face ? 0.4 : 0) - (usedPair.has(q.key) ? 1.5 : 0) + (bore && !q.outer ? 2 : 0));
          if (w && Math.abs(w.d - n) / Math.max(n, 0.5) <= 0.9) { usedPair.add(w.key); out.set(c.no, { kind: "len", a: w.a, b: w.b, outer: w.outer, semi: true }); continue; }
        }
        if ((t === "Angle" || t === "Chamfer") && sl.length) {
          const a = ang != null ? ang : 45, pool = inT(c, sl, midx, true), e = best(pool, (q) => -angDelta(q, a) - (used.has(q.id) ? 4 : 0));
          if (e && angDelta(e, a) <= 25) { used.add(e.id); out.set(c.no, { kind: "edge", e, p: mid(e), side: e.side, semi: true }); continue; }
        }
        if (t === "Radius" && n > 0 && arcs.length) {
          const g = best(inT(c, arcs.filter((q) => !q.used), (q) => (q.edges[0].a[0] + q.edges[q.edges.length - 1].b[0]) / 2, true), (q) => -Math.abs((q.R || 0) - n));
          if (g) { g.used = true; const es = g.edges, e = es[Math.floor(es.length / 2)]; es.forEach((q) => used.add(q.id)); out.set(c.no, { kind: "edge", e, p: [e.a[0], e.a[1]], side: e.side, arc: g, semi: true }); continue; }
        }
      }
      const an = anchorFn ? anchorFn(c) : null;
      if (t === "Surface finish" || t === "GD&T") {
        let e = an ? nearestEdge(an) : null;
        if (!e) {
          const sc = (q) => near(c, (q.a[0] + q.b[0]) / 2, null) + q.len / L;
          if (t === "GD&T" && /[⊥∥]|PERP|PARAL|FLAT/i.test(T + " " + (c.gdt || ""))) e = best(A.edges.filter((q) => q.kind === "shoulder" && q.side === "o" && q.len > 0.8), sc);
          if (!e && /BORE|\bID\b|INNER/.test(T)) e = best(A.edges.filter((q) => q.side === "i" && q.kind === "flat"), sc);
          if (!e) e = best(A.edges.filter((q) => q.side === "o" && q.kind === "flat"), sc);
        }
        if (e) { out.set(c.no, { kind: t === "GD&T" ? "gdt" : "ra", e, p: mid(e), side: e.side }); continue; }
      }
      if (an) { const e = nearestEdge(an); if (e) { out.set(c.no, { kind: "free", e, p: mid(e), side: e.side }); continue; } }
      out.set(c.no, { kind: "free" });
    }
    return out;
  };
  /** x range (mm) each turning operation works in: the first turned side up to the last whole shoulder the jaws leave free */
  SP.territory = (m, A, fa, clamp) => {
    const avail = m.L + fa - clamp - 1.5, sh = A.edges.filter((e) => e.kind === "shoulder" && e.side === "o" && e.a[0] > 0.3 && e.a[0] < m.L - 0.3).map((e) => e.a[0]).filter((x) => x <= avail + 1e-6);
    const xt = sh.length ? Math.max(...sh) : Math.max(Math.min(m.L, avail), 0.35 * m.L);
    return { xt, first: [0, xt], second: [xt, m.L] };
  };
  const g_ok = (g, n) => g.R != null && Math.abs(g.R - n) <= Math.max(0.12, 0.45 * n);

  /* ================================================================ C. drawing kit (all sizes from one text height h) ================================================================ */
  let mctx = null; const wOf = (s, h) => { if (!mctx) { mctx = document.createElement("canvas").getContext("2d"); mctx.font = "100px Arial, Helvetica, sans-serif"; } return (mctx.measureText(String(s)).width / 100) * (h / 0.716); };
  const fitTxt = (s, h, w) => { s = String(s == null ? "" : s); if (wOf(s, h) <= w) return s; while (s.length > 1 && wOf(s + "…", h) > w) s = s.slice(0, -1); return s.trimEnd() + "…"; };
  const U = (o) => Object.assign({ id: K.uid(), color: null, lt: null, lw: null }, o);
  /** role → entity style. this = cutting (red), model = not cut here (dark grey), ph = stock removed (phantom), clamp = fixture (blue) */
  const ST = {
    this: { color: RED, lw: 0.6, stg: "this" }, model: { color: null, lw: 0.5, stg: "model" },
    hid: { color: null, lw: 0.3, lt: "HIDDEN", stg: "model" }, hidr: { color: RED, lw: 0.3, lt: "HIDDEN", stg: "this" },
    ph: { color: PHG, lw: 0.18, lt: "PHANTOM", stg: "ph" }, clamp: { color: "#38bdf8", lw: 0.4, stg: "clamp" }, hatch: { color: "#9ca3af", lw: 0.13, stg: "hatch" },
    dimr: { color: RED, lw: 0.22, stg: "dimr" }, diml: { color: null, lw: 0.22, stg: "dimg" }, ctr: { color: null, lw: 0.18, lt: "CENTER", stg: "ph" },
  };
  SP.ST = ST;
  /** the drawing kit: every size comes from h (dimension text height) so arrows, gaps and balloons scale with the sheet */
  function kit(add, h) {
    const AL = h * 1.05, AW = h * 0.33, gap = h * 0.35, os = h * 0.65, br = h * 0.9, fs = h;
    const K2 = { h, AL, AW, gap, os, br, fs };
    K2.L = (a, b, st, lw) => add(Object.assign({ t: "line", layer: "STG-GEO", a, b }, st, lw ? { lw } : {}));
    K2.P = (pts, st, closed) => add(Object.assign({ t: "pline", layer: "STG-GEO", closed: !!closed, pts: pts.map((p) => [p[0], p[1], 0]) }, st));
    K2.T = (x, y, s, ha, st, rot, hh) => add(Object.assign({ t: "text", layer: "STG-GEO", p: [x, y], h: hh || fs, s: String(s), rot: rot || 0, ha: ha || 0, va: 0 }, { color: st.color, stg: st.stg }));
    K2.arrow = (x, y, dx, dy, st) => { const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n; const px = -dy, py = dx; add({ t: "hatch", layer: "STG-GEO", solid: true, loops: [[[x, y], [x - dx * AL + px * AW, y - dy * AL + py * AW], [x - dx * AL - px * AW, y - dy * AL - py * AW]]], color: st.color, stg: st.stg }); };
    K2.bal = (no, x, y, st) => { add({ t: "circle", layer: "STG-BALLOON", c: [x, y], r: br, stg: "balloon", no, color: RED }); add({ t: "text", layer: "STG-BALLOON", p: [x, y], h: /^\d+$/.test(String(no)) ? (no >= 100 ? fs * 0.78 : fs * 0.9) : fs * 0.7, s: String(no), rot: 0, ha: 1, va: 2, stg: "balloon", no, color: RED }); };
    K2.tw = (s) => wOf(s, fs);
    /** horizontal dimension between x1, x2 at height y; f1, f2 = y of the feature points (extension lines run from there) */
    K2.dimh = (x1, x2, y, f1, f2, txt, no, st, avoid) => {
      const d = y >= Math.max(f1, f2) ? 1 : -1; for (const [x, f] of [[x1, f1], [x2, f2]]) K2.L([x, f + d * gap], [x, y + d * os], st);
      const a = Math.min(x1, x2), b = Math.max(x1, x2), tw = K2.tw(txt), w = tw + (no ? 2 * br + 2 : 0) + 2, fitsIn = b - a >= w + 2 * AL, av = avoid || [];
      const clash = (lo, hi) => av.some((v) => v > lo - 0.6 && v < hi + 0.6);
      let place = "in", off = 0;
      if (!(fitsIn && !clash(a + AL, b - AL))) {
        let ro = 0, lo = 0; while (ro < 60 && clash(b + AL * 2 + 1 + ro, b + AL * 2 + 3 + w + ro)) ro += 1; while (lo < 60 && clash(a - AL * 2 - 3 - w - lo, a - AL * 2 - 1 - lo)) lo += 1;
        if (ro <= lo) { place = "r"; off = ro; } else { place = "l"; off = lo; }
      }
      const rightBox = [b + AL * 2 + 1 + off, b + AL * 2 + 3 + w + off], leftBox = [a - AL * 2 - 3 - w - off, a - AL * 2 - 1 - off];
      if (place === "in") { K2.L([a, y], [b, y], st); K2.arrow(a, y, 1, 0, st); K2.arrow(b, y, -1, 0, st); }
      else { K2.L([a - AL * 2 - (place === "l" ? off : 0), y], [b + AL * 2 + (place === "r" ? off : 0), y], st); K2.arrow(a, y, -1, 0, st); K2.arrow(b, y, 1, 0, st); if (b - a > 2 * AL) K2.L([a, y], [b, y], st); }
      if (place === "in") { const cx = (a + b) / 2; K2.T(cx + (no ? br + 1 : 0), y + h * 0.3, txt, 1, st); if (no) K2.bal(no, cx - tw / 2 - 0.5, y + h * 0.3 + br * 0.6, st); }
      else if (place === "r") { const tx = b + AL * 2 + 2 + off; K2.T(tx, y - h * 0.3, txt, 0, st); if (no) K2.bal(no, tx + tw + br + 1.5, y, st); }
      else { const tx = a - AL * 2 - 2 - off; K2.T(tx, y - h * 0.3, txt, 2, st); if (no) K2.bal(no, tx - tw - br - 1.5, y, st); }
      return { x0: place === "l" ? leftBox[0] : a - (place === "in" ? 0 : AL * 2), x1: place === "in" ? b : place === "r" ? rightBox[1] : b + AL * 2 };
    };
    /** vertical dimension between y1, y2 at x; f1, f2 = x of the feature points (null = no extension lines: inside a void) */
    K2.dimv = (y1, y2, x, f, txt, no, st, bin) => {
      if (f != null) { const d = x < f ? -1 : 1; for (const y of [y1, y2]) K2.L([f + d * gap, y], [x + d * os, y], st); }
      const a = Math.min(y1, y2), b = Math.max(y1, y2); K2.L([x, a], [x, b], st); K2.arrow(x, a, 0, -1, st); K2.arrow(x, b, 0, 1, st);
      K2.T(x - h * 0.3, (a + b) / 2, txt, 1, st, Math.PI / 2);
      if (no) K2.bal(no, x, bin ? b - AL - br - 1 : b + br + 1.5, st);
    };
    /** oblique leader from the feature (fx, fy) to (ex, ey), horizontal shoulder, balloon, text; side +1 text to the right, -1 to the left. Returns the far end x */
    K2.lead = (fx, fy, ex, ey, txt, no, side, st) => {
      K2.L([fx, fy], [ex, ey], st); K2.arrow(fx, fy, fx - ex, fy - ey, st);
      const sx = ex + side * 3; K2.L([ex, ey], [sx, ey], st); let tx;
      if (no) { const bx = sx + side * (1 + br); K2.bal(no, bx, ey, st); tx = bx + side * (br + 1.5); } else tx = sx + side;
      K2.T(tx, ey - h * 0.3, txt, side > 0 ? 0 : 2, st); return tx + side * K2.tw(txt);
    };
    /** surface texture symbol (ISO 1302) with value, drawn at (x, y) pointing right/left; base line at y */
    K2.rough = (x, y, txt, side, st) => {
      const w = h * 1.1, hv = h * 1.5, e = x + side * (w * 1.5 + K2.tw(txt) + 1.5); K2.P([[x, y + hv * 0.6], [x + side * w * 0.5, y], [x + side * w * 1.5, y + hv]], st); K2.L([x + side * w * 1.5, y + hv], [e, y + hv], st);
      K2.T(x + side * (w * 1.5 + 0.8), y + hv + 0.6, txt, side > 0 ? 0 : 2, st); return e;
    };
    /** feature control frame at (x, y) (left edge for side +1, right edge for -1); returns {x0, x1} */
    K2.fcf = (x, y, sym, tol, dat, side, st) => {
      const hh = h * 1.8, cells = [{ w: hh, k: "sym" }, { w: Math.max(hh * 1.4, K2.tw(tol) + 2.4), k: "tol" }].concat(dat ? [{ w: Math.max(hh, K2.tw(dat) + 2.4), k: "dat" }] : []), W = cells.reduce((t, c) => t + c.w, 0), x0 = side > 0 ? x : x - W; let xx = x0;
      for (const c of cells) { add(Object.assign({ t: "pline", layer: "STG-GEO", closed: true, pts: [[xx, y - hh / 2, 0], [xx + c.w, y - hh / 2, 0], [xx + c.w, y + hh / 2, 0], [xx, y + hh / 2, 0]] }, st)); if (c.k === "sym") GD(K2, xx + c.w / 2, y, hh, sym, st); else K2.T(xx + c.w / 2, y - h * 0.32, c.k === "tol" ? tol : dat, 1, st); xx += c.w; }
      return { x0, x1: x0 + W };
    };
    return K2;
  }
  /** geometric characteristic symbols drawn as lines (the font may not have them) */
  function GD(K2, cx, cy, hh, sym, st) {
    const s = hh * 0.3, L = (a, b, c, d) => K2.L([cx + a, cy + b], [cx + c, cy + d], st), arc = (r) => { const n = 16, pts = []; for (let i = 0; i <= n; i++) pts.push([cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r]); K2.P(pts, st, true); };
    switch (sym) {
      case "perp": L(-s, -s * 0.9, s, -s * 0.9); L(0, -s * 0.9, 0, s); break;
      case "run": case "trun": L(-s * 0.8, -s * 0.8, s * 0.5, s * 0.5); K2.arrow(cx + s * 0.8, cy + s * 0.8, 1, 1, st); if (sym === "trun") K2.arrow(cx - s * 0.2, cy - s * 0.2, -1, -1, st); break;
      case "par": L(-s, -s * 0.6, s * 0.6, s * 0.9); L(-s * 0.6, -s * 0.9, s, s * 0.6); break;
      case "conc": arc(s * 0.4); arc(s * 0.9); break;
      case "pos": arc(s * 0.7); L(-s * 1.15, 0, s * 1.15, 0); L(0, -s * 1.15, 0, s * 1.15); break;
      case "flat": L(-s, -s * 0.5, s * 0.6, s * 0.6); L(-s * 0.6, -s * 0.9, s, s * 0.2); break;
      case "round": arc(s); break;
      case "cyl": arc(s * 0.7); L(-s * 1.2, -s * 0.5, -s * 0.5, s * 0.8); L(s * 0.5, -s * 0.8, s * 1.2, s * 0.5); break;
      case "straight": L(-s, 0, s, 0); break;
      case "ang": L(-s, -s * 0.8, s, -s * 0.8); L(-s, -s * 0.8, s * 0.7, s * 0.9); break;
      case "sym": L(-s, s * 0.6, s, s * 0.6); L(-s, -s * 0.6, s, -s * 0.6); L(-s, 0, s, 0); break;
      default: K2.T(cx, cy - K2.h * 0.3, "?", 1, st);
    }
  }
  const gdKey = (c) => { const t = String(c.spec || c.text || "") + " " + String(c.gdt || ""); if (/⊥|perp/i.test(t)) return "perp"; if (/⌰|total/i.test(t) && /run/i.test(t)) return "trun"; if (/↗|run/i.test(t)) return "run"; if (/∥|parall/i.test(t)) return "par"; if (/◎|concen|coax/i.test(t)) return "conc"; if (/⌖|posit/i.test(t)) return "pos"; if (/⏥|flatn/i.test(t)) return "flat"; if (/○|roundn|circul/i.test(t)) return "round"; if (/⌭|cylind/i.test(t)) return "cyl"; if (/⏤|straight/i.test(t)) return "straight"; if (/∠|angul/i.test(t)) return "ang"; if (/⌯|symm/i.test(t)) return "sym"; return "pos"; };
  const gdTol = (c) => { const t = String(c.spec || c.text || ""), m = t.replace(/[⊥↗⌰∥⏥○⌭◎⌒⌓∠⌯⏤⌖]/g, " ").match(/(Ø\s*)?(\d+(?:[.,]\d+)?)/); return m ? (m[1] ? "Ø" : "") + m[2].replace(",", ".") : String(c.usl != null && c.usl !== "" ? c.usl : ""); };
  const gdDat = (c) => { const t = String(c.spec || c.text || ""), m = t.match(/\d(?:[.,]\d+)?\s*([A-Z](?:\s*[-|]?\s*[A-Z])*)\s*$/); return m ? m[1].replace(/[\s|-]+/g, "") : ""; };
  SP.gdKey = gdKey;

  /* ================================================================ D. what each operation makes, and the set-up ================================================================ */
  /** everything the sheets need that is not drawing: contour model, edges, matches, owners (which turning operation cuts which edge) */
  SP.prepare = (P, model, opt) => {
    const F = K.stageFlow, chars = new Map((P.chars || []).map((c) => [+c.no, c])), map = (P.freeze && P.freeze.map) || {};
    const stages = F.stages(P, map, chars);
    const kinds = stages.map((op) => { let k = F.kindOf(op); if (k === "turn" && (P.ops || []).some((o) => o.key === "TURN2")) k = "turn1"; return k; });
    const rankOfStage = new Map(); let nT = 0; stages.forEach((op, i) => { if (/^turn/.test(kinds[i])) rankOfStage.set(i, nT++); });
    const m = { outer: model.outer, inner: model.inner || [], L: model.L, rmax: model.rmax || Math.max(...model.outer.map((p) => p[1])) };
    const A = SP.analyse(m), stageOfChar = new Map(); stages.forEach((op, i) => (map[String(op.opNo)] || []).forEach((n) => stageOfChar.set(+n, i)));
    const rankOfChar = (no) => (stageOfChar.has(+no) && rankOfStage.has(stageOfChar.get(+no)) ? rankOfStage.get(stageOfChar.get(+no)) : null);
    const fa = model.fa, clamp = model.clamp, terr = SP.territory(m, A, fa, clamp);
    const opSide = (c) => { const r = rankOfChar(c.no); if (r == null || nT < 2) return null; return r === 0 ? terr.first : r === nT - 1 ? terr.second : null; };
    const frozen = [...stageOfChar.keys()].map((n) => chars.get(n)).filter(Boolean);
    const M = SP.match(m, A, frozen, (c) => (stageOfChar.has(+c.no) ? stageOfChar.get(+c.no) : 99), opt && opt.anchor ? opt.anchor : null, opSide);
    // which turning operation cuts which edge: the one whose characteristic sits on it; the rest follow their neighbours
    const own = new Map(), last = Math.max(0, nT - 1);
    if (nT) {
      for (const [no, f] of M) { const rk = rankOfChar(no); if (rk == null) continue; if (nT >= 2 && (rk === 0 || rk === last)) { const t = rk === 0 ? terr.first : terr.second, x = f.e ? (f.e.a[0] + f.e.b[0]) / 2 : f.arc ? f.arc.edges[0].a[0] : null; if (x != null && (x < t[0] - 0.3 || x > t[1] + 0.3)) continue; } const es = f.arc ? f.arc.edges : f.e && (f.kind === "dia" || f.kind === "edge") ? [f.e] : []; for (const e of es) if (!own.has(e.id)) own.set(e.id, rk); }
      const groups = new Map();
      for (const e of A.edges) { const k = e.side + e.ci; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
      const rmid = (e) => (e.a[1] + e.b[1]) / 2;
      for (const ch of groups.values()) for (let pass = 0; pass < 8; pass++) {
        let any = false;
        ch.forEach((e, i) => {
          if (own.has(e.id)) return;
          const nb = [ch[i - 1], ch[i + 1]].filter((q) => q && own.has(q.id));
          if (!nb.length) return;
          nb.sort((p, q) => (e.side === "o" ? rmid(p) - rmid(q) : rmid(q) - rmid(p)));
          own.set(e.id, own.get(nb[0].id)); any = true;
        });
        if (!any) break;
      }
      for (const e of A.edges) if (!own.has(e.id)) own.set(e.id, nT < 2 ? 0 : (e.a[0] + e.b[0]) / 2 <= terr.xt ? 0 : last);
    }
    return { P, F, chars, map, stages, kinds, rankOfStage, nT, m, A, M, own, terr, rankOfChar, model, stageOfChar };
  };

  /** best place for soft jaws: a run of constant outer radius, not a thread, not the hex, with a face that stops the part */
  SP.clampZone = (cx, rank) => {
    const { A, M, own, chars } = cx, oe = A.edges.filter((e) => e.side === "o"), zones = [];
    for (const e of oe) {
      if (e.kind !== "flat") continue;
      const z = zones.slice(-3).reverse().find((q) => Math.abs(q.r - e.a[1]) < 0.01 && e.a[0] - q.x1 < 1.6);
      if (z) { z.x1 = e.b[0]; while (zones.length && zones[zones.length - 1] !== z && zones[zones.length - 1].x0 >= z.x0) zones.pop(); } else zones.push({ x0: e.a[0], x1: e.b[0], r: e.a[1], e });
    }
    const thread = new Set();
    for (const [no, f] of M) { const c = chars.get(+no); if (c && c.type === "Thread" && f.e) thread.add(f.e.id); }
    const eMin = [...chars.values()].filter((c) => c.type === "Linear").map((c) => (/E\s*MIN/i.test(plainTxt(c)) ? nomOf(c) : /\bHEX\s*\d/i.test(plainTxt(c)) ? nomOf(c) * 1.1547 : null)).filter((v) => v > 0);
    const ok = zones.filter((z) => z.x1 - z.x0 >= 2 && !thread.has(z.e.id) && (!eMin.length || !eMin.some((v) => Math.abs(2 * z.r - v) < 1.2)) && (own.get(z.e.id) == null || own.get(z.e.id) < rank));
    ok.forEach((z) => { z.stop = !!oe.find((e) => Math.abs(e.a[0] - z.x1) < 0.02 && e !== z.e && (e.kind === "slope" || e.kind === "shoulder") && e.b[1] > z.r + 0.05); });
    ok.sort((a, b) => (b.stop - a.stop) || b.r - a.r);
    return ok[0] || null;
  };

  /* ================================================================ E. the part at a stage ================================================================ */
  const PW = 420, PH = 297, DA = { x0: 14, y0: 46, x1: 296, y1: 283 }, TB = { x0: 300, y0: 46, x1: 406, y1: 283 };
  const FL = () => K.stageFlow;
  const plain = (s) => FL().plain(s), fit = (s, h, w) => FL().fit(s, h, w);
  const NICE = [20, 10, 8, 6, 5, 4, 3, 2.5, 2, 1.5, 1, 0.8, 0.5, 0.4, 0.25, 0.2, 0.1, 0.05];
  const niceScale = (k) => NICE.find((v) => v <= k + 1e-9) || k;
  const scTxt = (k) => (k >= 1 ? `${r2(k)}:1` : `1:${r2(1 / k)}`);
  const wrapTxt = (s, h, w) => { const out = []; let cur = ""; for (const wd of String(s).split(/\s+/)) { const t = cur ? cur + " " + wd : wd; if (wOf(t, h) <= w || !cur) cur = t; else { out.push(cur); cur = wd; } } if (cur) out.push(cur); return out; };
  const shiftEnt = (e, dx) => {
    const m = (p) => [p[0] + dx, p[1]].concat(p.slice(2));
    if (e.a) e.a = m(e.a); if (e.b) e.b = m(e.b); if (e.c) e.c = m(e.c); if (e.p) e.p = m(e.p); if (e.pts) e.pts = e.pts.map(m); if (e.loops) e.loops = e.loops.map((l) => l.map(m));
    return e;
  };

  /** the part after turning operation `rank` (−1 = sawn blank; a big number = finished):
      outline pieces with their role (this = cut by this operation, model = already there), bores, end faces */
  SP.state = (cx, rank) => {
    const { A, own, m, model, nT } = cx, R0 = model.D0 / 2, fa = model.fa, L = m.L, last = nT - 1, single = nT === 1;
    const finished = (e) => { if (rank < 0) return false; const o = own.get(e.id); return o == null ? true : o <= rank; };
    const roleOf = (e) => (own.get(e.id) === rank ? "this" : "model");
    const xl = rank < 0 ? -fa : 0, xr = rank < 0 ? L + fa : single ? L + fa + 4 + model.clamp : rank >= last ? L : L + fa;
    const oe = A.edges.filter((e) => e.side === "o").sort((a, b) => a.i - b.i), segs = [], pts = [];
    let prev = null; const put = (q, role) => { if (!prev) { prev = q; pts.push(q); return; } if (Math.abs(prev[0] - q[0]) > 1e-9 || Math.abs(prev[1] - q[1]) > 1e-9) { segs.push({ a: prev, b: q, role }); pts.push(q); prev = q; } };
    let stock = false, lastRole = "model";
    for (const e of oe) {
      if (finished(e)) {
        if (!prev) put([xl, e.a[1]], "model");
        if (stock) { put([e.a[0], R0], "model"); stock = false; }
        put(e.a, roleOf(e)); put(e.b, roleOf(e)); lastRole = roleOf(e);
      } else {
        if (!prev) put([xl, R0], "model");
        if (!stock) { if (Math.abs(prev[1] - R0) > 1e-9) put([prev[0], R0], lastRole); stock = true; }
      }
    }
    if (!prev) put([xl, R0], "model");
    if (prev[0] < xr - 1e-9) { if (Math.abs(prev[1] - R0) > 1e-9) put([prev[0], R0], lastRole); put([xr, R0], "model"); }
    // bores: a run of finished edges from the left face and/or from the right face (or all of it)
    const voids = [], chains = new Map(); for (const e of A.edges) if (e.side === "i") { if (!chains.has(e.ci)) chains.set(e.ci, []); chains.get(e.ci).push(e); }
    for (const es of chains.values()) {
      if (rank < 0) continue; es.sort((a, b) => a.i - b.i); const f = es.map(finished);
      const run = (arr, from) => { const p = [arr[0].a].concat(arr.map((e) => e.b)), roles = arr.map(roleOf); const v = { pts: p, roles, from, role: roles[roles.length - 1] }; return v; };
      if (f.every(Boolean)) { voids.push(Object.assign(run(es, "L"), { all: true })); continue; }
      let a = 0; while (a < es.length && f[a]) a++;
      if (a > 0 && es[0].a[0] < 0.05) voids.push(run(es.slice(0, a), "L"));
      let b = es.length; while (b > 0 && f[b - 1]) b--;
      if (b < es.length && es[es.length - 1].b[0] > L - 0.05) { const v = run(es.slice(b), "R"); v.pts.reverse(); v.roles.reverse(); voids.push(v); }
    }
    // a bore that stops short ends in the drill point (118°)
    for (const v of voids) {
      v.role = v.roles[v.roles.length - 1]; v.tip = null; const q = v.pts[v.pts.length - 1];
      if (!v.all && q[1] > 0.02) { v.tip = [q[0] + (v.from === "L" ? 1 : -1) * q[1] * 0.6, 0]; }
      if (v.all) { const q0 = v.pts[0], q1 = v.pts[v.pts.length - 1]; v.thruL = q0[0] < 0.05; v.thruR = q1[0] > L - 0.05; if (q1[1] > 0.02 && !v.thruR) v.tip = [q1[0] + q1[1] * 0.6, 0]; }
    }
    const rIn = (side) => { const v = voids.find((q) => (side === "L" ? q.pts[0][0] < 0.05 && q.from === "L" : q.pts[0][0] > L - 0.05 || (q.all && q.pts[q.pts.length - 1][0] > L - 0.05))); if (!v) return 0; return side === "L" ? v.pts[0][1] : (v.all ? v.pts[v.pts.length - 1][1] : v.pts[0][1]); };
    const faces = [{ a: [xl, rIn("L")], b: [xl, pts[0][1]], role: rank === 0 ? "this" : "model" }, { a: [xr, rIn("R")], b: [xr, pts[pts.length - 1][1]], role: rank >= last && !single ? "this" : "model" }];
    const rOut = (x) => { let r = 0; for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1]; if (x < Math.min(a[0], b[0]) - 1e-9 || x > Math.max(a[0], b[0]) + 1e-9) continue; if (Math.abs(b[0] - a[0]) < 1e-9) r = Math.max(r, a[1], b[1]); else r = Math.max(r, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])); } return r; };
    const rVoid = (x) => { let r = null; for (const v of voids) for (let i = 0; i + 1 < v.pts.length; i++) { const a = v.pts[i], b = v.pts[i + 1]; if (x < Math.min(a[0], b[0]) - 1e-9 || x > Math.max(a[0], b[0]) + 1e-9) continue; const q = Math.abs(b[0] - a[0]) < 1e-9 ? Math.min(a[1], b[1]) : a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]); r = r == null ? q : Math.min(r, q); } return r; };
    // solid section loops (outline minus bores) for the half above the axis
    const loops = [[[xl, 0]].concat(pts, [[xr, 0]])];
    for (const v of voids) {
      if (v.all) { const p = v.pts.slice(); loops.push([[p[0][0], 0]].concat(p, v.tip ? [v.tip] : [[p[p.length - 1][0], 0]])); }
      else if (v.from === "L") loops.push([[v.pts[0][0], 0]].concat(v.pts, v.tip ? [v.tip] : []));
      else loops.push([[v.pts[0][0], 0]].concat(v.pts, v.tip ? [v.tip] : []));
    }
    return { xl, xr, segs, pts, voids, faces, loops, R0, rOut, rVoid, rmax: Math.max(...pts.map((p) => p[1])) };
  };

  /** jaw polygons (part coordinates, upper half; mirror for the lower) for the operation */
  SP.jaws = (cx, S, rank) => {
    const { model, nT } = cx, R0 = S.R0;
    if (rank <= 0 || nT === 1) {   // chuck on the bar end that is still stock, stepped jaws stop the bar end
      const cl = Math.min(model.clamp, S.xr - S.xl - 1), x0 = S.xr - cl, t = 0.25 * R0, lip = 0.46 * R0;
      return { poly: [[x0, R0], [S.xr, R0], [S.xr, 0.6 * R0], [S.xr + lip, 0.6 * R0], [S.xr + lip, R0 + t], [x0, R0 + t]], name: "CHUCK JAW (step)", stopX: S.xr, stopSide: 1, x0, grip: cl, r: R0, top: R0 + t, lip, stockEnd: true };
    }
    const z = SP.clampZone(cx, rank), L = cx.m.L;
    let zr, zx0, zx1;
    if (z) { zr = z.r; zx1 = z.x1; zx0 = Math.max(z.x0, z.x1 - model.clamp); } else { zr = S.rOut(Math.min(L * 0.2, 5)); zx0 = 0; zx1 = Math.min(model.clamp, L * 0.4); }
    const t = Math.max(2.5, 0.35 * zr), rel = Math.min(1.2, 0.14 * zr), poly = [];
    if (zx0 > 0.6) poly.push([zx0 - 3, zr + rel], [zx0, zr + rel]);
    poly.push([zx0, zr], [zx1, zr], [zx1, zr + t]); if (zx0 > 0.6) poly.push([zx0 - 3, zr + t]); else poly.push([zx0, zr + t]);
    const left = (zx0 + zx1) / 2 < L / 2;
    return { poly, name: "SOFT JAW (step)", stopX: zx1, stopSide: 1, x0: zx0, grip: zx1 - zx0, r: zr, top: zr + t, lip: 0, stockEnd: false, left };
  };

  /* ================================================================ F. one sheet: frame, panel, symbols ================================================================ */
  const INKS = { color: null, lw: 0.25, stg: "dimg" }, GS = { color: null, lw: 0.25, stg: "dimg" };
  const ITB = [[3, 0.040, 0.060], [6, 0.048, 0.075], [10, 0.058, 0.090], [18, 0.070, 0.110], [30, 0.084, 0.130], [50, 0.100, 0.160], [80, 0.120, 0.190], [120, 0.140, 0.220], [180, 0.160, 0.250], [250, 0.185, 0.290], [315, 0.210, 0.320]];
  const hTol = (d, g) => { const row = ITB.find((q) => d <= q[0]) || ITB[ITB.length - 1]; return g === "h11" ? row[2] : row[1]; };

  function newSheet() {
    const ents = [], add = (e) => { const u = U(e); ents.push(u); return u; };
    return { ents, add, K2: kit(add, 2.6), rep: { dims: 0, balloons: 0, missing: [] } };
  }
  function datumSym(sh, x, y, dx, dy, letter, st) {
    const K2 = sh.K2, h = K2.h, Lt = h * 1.3, px = -dy, py = dx;
    sh.add(Object.assign({ t: "hatch", layer: "STG-GEO", solid: true, loops: [[[x, y], [x + dx * Lt * 1.3 + px * Lt * 0.6, y + dy * Lt * 1.3 + py * Lt * 0.6], [x + dx * Lt * 1.3 - px * Lt * 0.6, y + dy * Lt * 1.3 - py * Lt * 0.6]]] }, st));
    const ex = x + dx * (Lt * 1.3 + 2), ey = y + dy * (Lt * 1.3 + 2); K2.L([x + dx * Lt * 1.3, y + dy * Lt * 1.3], [ex, ey], st);
    const bx = ex + dx * h * 0.9, by = ey + dy * h * 0.9, q = h * 0.9;
    K2.P([[bx - q, by - q], [bx + q, by - q], [bx + q, by + q], [bx - q, by + q]], st, true); K2.T(bx, by - h * 0.34, letter, 1, st);
  }
  function g54(sh, x, y, side) {
    const K2 = sh.K2; sh.add(Object.assign({ t: "circle", layer: "STG-GEO", c: [x, y], r: 2 }, INKS)); K2.L([x - 3, y], [x + 3, y], INKS); K2.L([x, y - 3], [x, y + 3], INKS);
    K2.T(x + side * 2.8, y - 4.4, "G54  X0 Z0", side > 0 ? 0 : 2, INKS, 0, K2.h * 0.75);
  }
  /** frame, title block (same as the other KMR sheets) */
  function frame(sh, cx, op, ctx, sheetNo, sheetOf) {
    const { add } = sh, P = cx.P, H = ctx.H, T = (x, y, h, s, ha, extra) => add(Object.assign({ t: "text", layer: "STG-FRAME", p: [x, y], h, s: String(s == null ? "" : s), rot: 0, ha: ha || 0, va: 0 }, extra || {}));
    const L = (x0, y0, x1, y1) => add({ t: "line", layer: "STG-FRAME", a: [x0, y0], b: [x1, y1] });
    add({ t: "pline", layer: "STG-FRAME", closed: true, lw: 0.7, pts: [[10, 10, 0], [410, 10, 0], [410, 287, 0], [10, 287, 0]] });
    L(10, 42, 410, 42); L(298, 42, 298, 287); L(100, 10, 100, 42); L(100, 26, 410, 26); for (let i = 1; i < 4; i++) L(100 + i * 77.5, 10, 100 + i * 77.5, 42);
    T(14, 33, 5.2, "STAGE DRAWING"); T(14, 24.5, 3.4, fit(plain(`OP ${op.opNo} · ${String(op.name || "").toUpperCase()}`), 3.4, 83)); T(14, 15, 2.4, fit(plain(ctx.co), 2.4, 83));
    const sec = ctx.sopSec.get(String(op.opNo)), stgNo = `${(sec && sec.docNo) || "STG-" + (P.part_no || "")}${sec && sec.docNo ? "-STG" : "-" + op.opNo}`;
    const cells = [["Part no.", P.part_no || H.partNo], ["Part name", P.part_name || H.partName], ["Drawing no. / rev", [H.drawingNo || P.drawing_no, H.drawingRev || P.rev].filter(Boolean).join(" / rev ")], ["Customer", P.customer || H.customer],
      ["Machine", op.machine || "—"], ["Stage drawing no.", stgNo], ["Dimensions frozen", `rev ${P.freeze.rev} · ${ctx.dmy(P.freeze.at)}`], ["Sheet", `${sheetNo} of ${sheetOf} · Op ${op.opNo}`]];
    cells.forEach(([lab, val], i) => { const x = 100 + (i % 4) * 77.5, y = i < 4 ? 26 : 10; T(x + 2, y + 12, 1.9, lab); T(x + 2, y + 3.6, 3, fit(plain(val || "—"), 3, 73)); });
  }
  /** right-hand panel: stage data, the characteristics of this operation, legend and notes */
  function panel(sh, cx, op, info, ctx, rows, legend) {
    const { add } = sh, T = (x, y, h, s, ha, extra) => add(Object.assign({ t: "text", layer: "STG-TABLE", p: [x, y], h, s: String(s == null ? "" : s), rot: 0, ha: ha || 0, va: 0 }, extra || {}));
    const kv = info.data.slice(0, 10), rowsKV = [["STAGE DATA"], ...kv.map(([a, b]) => [fit(plain(a), 2.2, 30), fit(plain(b), 2.2, 66)])];
    add({ t: "table", layer: "STG-TABLE", p: [TB.x0, TB.y1], h: 2.2, rh: 5, cw: [34, 72], rows: rowsKV, title: true, hdr: false, al: ["l", "l"], rot: 0 });
    // legend + notes are packed at the bottom; the table takes what is between
    const lg = legend || [], notes = (info.notes || []).flatMap((s) => wrapTxt(plain(s), 2.2, 100).map((t, i) => (i ? "   " : "• ") + t)).slice(0, 7);
    const lgH = lg.length * 5 + 8, noteH = Math.min(notes.length, 7) * 4.4 + 8, bottom = TB.y0 + 2 + lgH + noteH;
    const ty = TB.y1 - 5 * rowsKV.length - 6; let RH = 5, max = Math.max(3, Math.floor((ty - bottom - 8) / RH) - 3); for (const t of [4.5, 4.1, 3.8]) { if (rows.length <= max) break; RH = t; max = Math.max(3, Math.floor((ty - bottom - 8) / RH) - 3); }
    const head = [[info.charsTitle], ["No.", "Specification", "LSL", "USL", "Class", "Gauge"]], body = rows.slice(0, max);
    const R = head.concat(body);
    if (rows.length > max) R.push(["", `… ${rows.length - max} more — see the SOP`, "", "", "", ""]);
    if (rows.length) add({ t: "table", layer: "STG-TABLE", p: [TB.x0, ty], h: RH < 4.2 ? 1.7 : RH < 4.8 ? 1.9 : 2.2, rh: RH, cw: [8, 34, 12.5, 12.5, 9, 30], rows: R, title: true, hdr: true, al: ["c", "l", "r", "r", "c", "l"], rot: 0 });
    else T(TB.x0 + 2, ty - 4, 2.4, "No characteristic of the drawing is made at this operation.");
    let y = TB.y0 + 2 + noteH + lgH - 4;
    T(TB.x0 + 1, y + 1.5, 2.3, "LEGEND", 0, { color: null, stg: "dimg" }); y -= 2;
    for (const [st, label] of lg) { y -= 5; add(Object.assign({ t: "line", layer: "STG-TABLE", a: [TB.x0 + 1, y + 0.9], b: [TB.x0 + 15, y + 0.9] }, st, { lw: st.lw > 0.3 ? 0.5 : st.lw })); T(TB.x0 + 18, y, 2.2, label); }
    let ny = TB.y0 + noteH - 4; T(TB.x0 + 1, ny + 0.5, 2.3, "NOTES", 0, { color: null, stg: "dimg" });
    notes.forEach((s, i) => T(TB.x0 + 1, TB.y0 + noteH - 9 - i * 4.4, 2.2, s));
  }
  const LEG = {
    this: [Object.assign({}, ST.this), "Cutting surface — made at this operation (red)"],
    model: [Object.assign({}, ST.model), "Not cut at this operation (dark grey)"],
    hid: [Object.assign({}, ST.hid), "Hidden edge (dashed)"],
    ph: [Object.assign({}, ST.ph), "Stock removed at this operation (phantom)"],
    clamp: [Object.assign({}, ST.clamp), "Chuck / vice / jaw / stop (blue)"],
  };

  /* ================================================================ G. the profile sheet (turning: full section; other operations: finished part, external view) ================================================================ */
  const midE = (e) => [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
  const sameSeg = (s, e) => { const eq = (p, q) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6; return (eq(s.a, e.a) && eq(s.b, e.b)) || (eq(s.a, e.b) && eq(s.b, e.a)); };

  function profileSheet(cx, op, kind, rank, info, ctx) {
    const sh = newSheet(), { add, K2 } = sh, h = K2.h, { A, M, chars, map, model } = cx;
    const mine = (map[String(op.opNo)] || []).map(Number).sort((a, b) => a - b), isTurn = /^turn/.test(kind);
    const S = SP.state(cx, isTurn ? rank : 999), jaws = isTurn ? SP.jaws(cx, S, rank) : null, S0 = isTurn ? SP.state(cx, rank - 1) : null;
    const colRight = !!(jaws && !jaws.stockEnd && jaws.left);
    // --- what the characteristics of this operation are on the outline
    const usedG = new Set(), grooveEdge = () => { const oe = A.edges.filter((e) => e.side === "o"); for (let i = 1; i + 1 < oe.length; i++) { const e = oe[i]; if (e.kind === "flat" && e.len <= 3 && !usedG.has(e.id) && oe[i - 1].a[1] > e.a[1] + 0.05 && oe[i + 1].b[1] > e.a[1] + 0.05 && (!isTurn || cx.own.get(e.id) === rank)) return e; } return null; };
    const vd = [], hd = [], ld = [], loose = [], hexC = [], mineEdges = new Set();
    for (const no of mine) {
      const c = chars.get(no); if (!c || c.type === "Material" || c.type === "Note") continue;
      const f = M.get(no), txt = plain(c.spec || c.text || c.label || "");
      if (!f) { loose.push({ no, txt }); continue; }
      if (f.kind === "dia") { vd.push({ no, txt, r: f.r, x0: f.x0, x1: f.x1, bore: f.side === "i" && !!f.e && f.e.len >= 1, red: true, semi: !!f.semi }); if (f.e) mineEdges.add(f.e.id); }
      else if (f.kind === "len") hd.push({ no, txt, a: f.a, b: f.b, outer: f.outer, red: true });
      else if (f.kind === "hex") hexC.push({ no, c, txt });
      else if (f.e && (f.kind === "edge" || f.kind === "ra" || f.kind === "gdt" || f.kind === "free")) { ld.push({ no, c, f, txt, kind: f.kind, p: f.p || midE(f.e) }); if (f.kind === "edge") (f.arc ? f.arc.edges : [f.e]).forEach((e) => mineEdges.add(e.id)); }
      else { const ge = /GROOVE|DEPTH|DEEP/i.test(txt) ? grooveEdge() : null; if (ge) { usedG.add(ge.id); ld.push({ no, c, f, txt, kind: "free", p: midE(ge) }); } else loose.push({ no, txt }); }
    }
    // flats made at this operation that the table does not number: shown as reference sizes in brackets
    const refD = (r) => vd.some((d) => Math.abs(d.r - r) < 1e-6);
    for (const e of A.edges) {
      if (e.side !== "o" || e.kind !== "flat" || e.len < 0.5 || refD(e.a[1])) continue;
      if (isTurn ? cx.own.get(e.id) !== rank : false) continue; if (!isTurn) continue;
      vd.push({ no: null, txt: `(Ø${r2(2 * e.a[1])})`, r: e.a[1], x0: e.a[0], x1: e.b[0], bore: false, red: false });
    }
    if (isTurn && rank === cx.nT - 1 && !hd.some((q) => q.outer && Math.abs(q.a) < 1e-6 && Math.abs(q.b - cx.m.L) < 1e-3)) hd.push({ no: null, txt: `(${r2(cx.m.L)})`, a: 0, b: cx.m.L, outer: true, red: false });
    // hex flats (milling): the flat whose corner diameter is the "E min" size, its length is a reference
    let hexEdge = null;
    if (hexC.length) { const em = hexC.map((q) => (/E\s*MIN/i.test(q.txt) ? nomOf(q.c) : 0)).find((v) => v > 0); const cand = A.edges.filter((e) => e.side === "o" && e.kind === "flat" && e.len > 0.8); if (em) hexEdge = cand.sort((a, b) => Math.abs(2 * a.a[1] - em) - Math.abs(2 * b.a[1] - em))[0]; if (hexEdge) { mineEdges.add(hexEdge.id); hd.push({ no: null, txt: `(${r2(hexEdge.len)})`, a: hexEdge.a[0], b: hexEdge.b[0], outer: true, red: false }); } }
    const redSeg = (s) => A.edges.some((e) => mineEdges.has(e.id) && sameSeg(s, e));
    const hexAF = hexC.find((q) => !/E\s*MIN/i.test(q.txt)), hexEM = hexC.find((q) => /E\s*MIN/i.test(q.txt));
    // --- end view (hex / hole pattern)
    const all = [...chars.values()], pc = all.find((c) => /PCD\s*[Ø⌀]?\s*\d/i.test((c.text || "") + " " + (c.spec || ""))), hole = all.find((c) => /^\s*\d+\s*X\s*[Ø⌀]/i.test(c.text || "") && !/M\d/i.test(c.text || ""));
    const pm = pc && String((pc.text || "") + " " + (pc.spec || "")).match(/PCD\s*[Ø⌀]?\s*(\d+(?:[.,]\d+)?)/i);
    const holeMine = !isTurn && pm && hole && mine.includes(+hole.no);
    const endView = !isTurn && (hexC.length > 0 || holeMine);
    const Dmax = 2 * S.rmax, Rend = hexEM ? nomOf(hexEM.c) / 2 : Dmax / 2, kk = Math.min(4.4, 42 / Math.max(Rend, 1));
    // --- layout
    const Rtop = Math.max(S.rmax, jaws ? jaws.top : 0), Rj = Rtop, xmin = S.xl, xmax = S.xr + (jaws ? jaws.lip : 0), PITCH = 7.6, forceSide = endView ? -1 : 0, evH = endView ? 2 * Rend * kk + 36 : 0;
    let cols, rows, boreLens, nrow, topH, fanH, looseH, botH, colsW, Wav, Hav, k, pw, X0, yc;
    const lay = () => {
      cols = vd.filter((d) => !d.bore).sort((a, b) => a.r - b.r); rows = hd.filter((q) => q.outer).sort((a, b) => (a.b - a.a) - (b.b - b.a)); boreLens = hd.filter((q) => !q.outer); nrow = forceSide ? ld.length : Math.ceil(ld.length / 2);
      topH = rows.length ? rows.length * 7.5 + 12 : 10; fanH = ld.length ? nrow * PITCH + 13 : 6; looseH = loose.length * 6 + (loose.length ? 4 : 0); botH = Math.max(fanH, evH) + looseH; colsW = cols.length ? cols.length * 9.5 + 12 : 8;
      Wav = DA.x1 - DA.x0 - colsW - 18; Hav = DA.y1 - DA.y0 - topH - botH - 8;
      k = niceScale(Math.min(Wav / Math.max(xmax - xmin, 1e-6), Hav / (2 * Rj + 1e-6), 10));
      pw = (xmax - xmin) * k; X0 = DA.x0 + (colRight ? 8 : colsW) + Math.max(0, (Wav - pw) / 2); yc = DA.y0 + botH + 4 + Rj * k + Math.max(0, (Hav - 2 * Rj * k) / 2);
    };
    lay();
    // a bore too small for its balloon inside is called out with a leader instead
    const bad = vd.filter((d) => d.bore && d.no != null && 2 * d.r * k < K2.tw(d.txt) + 4 * K2.br + 2 * K2.AL + 4);
    if (bad.length) { for (const d of bad) { vd.splice(vd.indexOf(d), 1); ld.push({ no: d.no, c: chars.get(d.no), f: {}, txt: d.txt, kind: "free", p: [(d.x0 + d.x1) / 2, d.r] }); } lay(); }
    const xmid = (S.xl + S.xr) / 2; void xmid;
    const X = (x) => X0 + (x - xmin) * k, Y = (r) => yc + r * k;
    const both = (f) => { f(1); f(-1); };
    const seg = (p, q, st) => both((sg) => K2.L([X(p[0]), Y(sg * p[1])], [X(q[0]), Y(sg * q[1])], st));
    const stOf = (role, hidden) => (hidden ? (role === "this" ? ST.hidr : ST.hid) : role === "this" ? ST.this : ST.model);
    // 1. stock that this operation removed (phantom), 2. section, 3. outline
    if (isTurn) {
      const dash = (S1) => { for (let i = 0; i + 1 < S1.pts.length; i++) seg(S1.pts[i], S1.pts[i + 1], ST.ph); for (const f of S1.faces) seg(f.a, f.b, ST.ph); };
      dash(S0);
      both((sg) => sh.add(Object.assign({ t: "hatch", layer: "STG-GEO", pat: "ANSI31", sc: 0.55, ang: 0, solid: false, loops: S.loops.map((lp) => lp.map((p) => [X(p[0]), Y(sg * p[1])])) }, ST.hatch)));
    }
    for (const s of S.segs) seg(s.a, s.b, stOf(isTurn ? s.role : redSeg(s) ? "this" : "model", false));
    for (const f of S.faces) seg(f.a, f.b, stOf(isTurn ? f.role : "model", false));
    for (const v of S.voids) {
      for (let i = 0; i + 1 < v.pts.length; i++) seg(v.pts[i], v.pts[i + 1], stOf(isTurn ? v.roles[i] : "model", !isTurn));
      if (v.tip) seg(v.pts[v.pts.length - 1], v.tip, stOf(isTurn ? v.roles[v.roles.length - 1] : "model", !isTurn));
    }
    // centre line
    K2.L([X(xmin) - 8, Y(0)], [X(xmax) + 8, Y(0)], ST.ctr);
    // work holding
    let datumTxt = "", holdTxt = "", zeroSide = 1;
    if (jaws) {
      both((sg) => { const poly = jaws.poly.map((p) => [X(p[0]), Y(sg * p[1])]); K2.P(poly, ST.clamp, true); sh.add(Object.assign({ t: "hatch", layer: "STG-GEO", pat: "ANSI31", sc: 0.45, ang: 90, solid: false, loops: [poly] }, { color: "#38bdf8", lw: 0.13, stg: "clamp" })); });
      const cxJ = X(jaws.stockEnd ? jaws.x0 + jaws.grip / 2 : jaws.x0 + (jaws.stopX - jaws.x0) / 2); K2.T(cxJ, Y(jaws.top) + 3, jaws.name, 1, ST.clamp, 0, h * 0.78);
      if (jaws.stockEnd) { datumSym(sh, X(S.xr), Y(0.3 * S.R0), 1, 0, "B", INKS); datumTxt = "blank end face seated on the jaw step"; holdTxt = "3-jaw chuck, stepped hard jaws"; zeroSide = 1; g54(sh, X(S.xl), Y(0), 1); }
      else {
        const xb = X(jaws.stopX), y0 = Y(-jaws.top) - 1, y1 = y0 - 15; K2.L([xb, y0], [xb, y1], INKS);
        sh.add(Object.assign({ t: "hatch", layer: "STG-GEO", solid: true, loops: [[[xb, y1], [xb - 1.9, y1 + 3.4], [xb + 1.9, y1 + 3.4]]] }, INKS)); K2.L([xb, y1], [xb, y1 - 3.2], INKS);
        K2.P([[xb - 2.7, y1 - 8.6], [xb + 2.7, y1 - 8.6], [xb + 2.7, y1 - 3.2], [xb - 2.7, y1 - 3.2]], INKS, true); K2.T(xb, y1 - 7.2, "B", 1, INKS);
        datumTxt = "shoulder face seated on the jaw step (axial stop)"; holdTxt = `soft jaws on Ø${r2(2 * jaws.r)}`; const right = jaws.left; g54(sh, X(right ? S.xr : S.xl), Y(0), right ? -1 : 1);
      }
    }
    // --- diameters: columns (outside the part, smallest nearest) and inside the void (bores)
    const base = colRight ? X(S.xr) + 14 : X(S.xl) - 10;
    cols.forEach((d, i) => { const xc = base + (colRight ? 1 : -1) * i * 11; K2.dimv(Y(-d.r), Y(d.r), xc, X(colRight ? d.x1 : d.x0), d.txt, d.no, d.red ? ST.dimr : ST.diml); sh.rep.dims++; });
    for (const d of vd.filter((q) => q.bore)) { K2.dimv(Y(-d.r), Y(d.r), X(d.x0 + (d.x1 - d.x0) * 0.78), null, d.txt, d.no, ST.dimr, true); sh.rep.dims++; }
    // semi-finished sizes (in-process, no finished feature of that size): the surface is shown as a phantom line
    both((sg) => { for (const d of vd) if (d.semi && d.x1 > d.x0) K2.L([X(d.x0), Y(sg * d.r)], [X(d.x1), Y(sg * d.r)], ST.ph); });
    // --- lengths: rows above the part, shortest nearest
    rows.forEach((q, i) => { const y = Y(Rtop) + 9 + i * 7.5, av = []; for (let j = i + 1; j < rows.length; j++) av.push(X(rows[j].a), X(rows[j].b)); K2.dimh(X(q.a), X(q.b), y, Y(S.rOut(q.a)), Y(S.rOut(q.b)), q.txt, q.no, q.red ? ST.dimr : ST.diml, av); sh.rep.dims++; });
    for (const q of boreLens) { const ra = S.rVoid(q.a), rb = S.rVoid(q.b); if (ra == null && rb == null) { loose.push({ no: q.no, txt: q.txt }); continue; } const rm = Math.min(ra == null ? 1e9 : ra, rb == null ? 1e9 : rb); K2.dimh(X(q.a), X(q.b), Y(rm * 0.3), Y(ra == null ? rm : ra), Y(rb == null ? rm : rb), q.txt, q.no, ST.dimr); sh.rep.dims++; }
    // --- leaders in a fan below the part: chamfers, angles, radii, finish, GD&T
    const rowTop = Y(-Rj) - 10, tw = (q) => K2.tw(q.kind === "gdt" ? "00.00 AB" : q.txt) + 2 * K2.br + 14 + (q.kind === "gdt" ? 3 * h * 1.8 : 0);
    const place = [], byX = ld.slice().sort((a, b) => a.p[0] - b.p[0]), half = Math.ceil(byX.length / 2);
    byX.forEach((q, i) => place.push({ q, fx: X(q.p[0]), fy: Y(-q.p[1]), side: forceSide || (i < half ? -1 : 1) }));
    for (const g of place) { const worst = Math.max(0, (g.fy - (rowTop - (nrow - 1) * PITCH)) / 1.732); if (g.side < 0 && g.fx - worst - tw(g.q) < DA.x0 + 2) g.side = 1; else if (g.side > 0 && g.fx + worst + tw(g.q) > DA.x1 - 2 && !forceSide) g.side = -1; }
    for (const side of [-1, 1]) {
      const grp = place.filter((g) => g.side === side).sort((a, b) => (side < 0 ? a.fx - b.fx : b.fx - a.fx));
      grp.forEach((g, j) => {
        const row = rowTop - j * PITCH, ex = g.fx + side * (g.fy - row) / 1.732, st = ST.dimr, q = g.q, c = q.c;
        if (q.kind === "gdt") {
          K2.L([g.fx, g.fy], [ex, row], st); K2.arrow(g.fx, g.fy, g.fx - ex, g.fy - row, st); const sx = ex + side * 3; K2.L([ex, row], [sx, row], st);
          const fr = K2.fcf(sx, row, gdKey(c), gdTol(c), gdDat(c), side, st); K2.bal(q.no, side > 0 ? fr.x1 + K2.br + 1 : fr.x0 - K2.br - 1, row, st);
        } else if (q.kind === "ra") {
          K2.L([g.fx, g.fy], [ex, row], st); K2.arrow(g.fx, g.fy, g.fx - ex, g.fy - row, st); const sx = ex + side * 3; K2.L([ex, row], [sx, row], st);
          const val = /Ra/i.test(q.txt) ? q.txt : "Ra " + q.txt, en = K2.rough(sx + side * 0.5, row - h * 1.5 - 0.3, val, side, st); K2.bal(q.no, en + side * (K2.br + 1.5), row, st);
        } else K2.lead(g.fx, g.fy, ex, row, q.txt, q.no, side, st);
        sh.rep.dims++;
      });
    }
    // anything not placed on the part is listed under it with its balloon
    loose.forEach((q, i) => { const y = DA.y0 + 4 + (loose.length - 1 - i) * 6; K2.bal(q.no, DA.x0 + 5, y + 1, ST.dimr); K2.T(DA.x0 + 5 + K2.br + 2, y - 0.2, fit(q.txt, h, 150), 0, ST.dimr); sh.rep.missing.push(q.no); });
    // --- end view
    if (endView) {
      const ex = DA.x1 - 62, ey = DA.y0 + 8 + evH / 2, R = Rend * kk;
      if (hexC.length) {
        const af = hexAF ? nomOf(hexAF.c) : null, corner = Rend, n = 6, pts = []; for (let a = 0; a < n; a++) pts.push([ex + Math.sin((a * Math.PI) / 3) * corner * kk, ey + Math.cos((a * Math.PI) / 3) * corner * kk]);
        sh.add(Object.assign({ t: "circle", layer: "STG-GEO", c: [ex, ey], r: S.rmax * kk }, ST.hid)); K2.P(pts, ST.this, true); sh.add(Object.assign({ t: "circle", layer: "STG-GEO", c: [ex, ey], r: (S.voids.length ? Math.min(...S.voids.map((v) => Math.min(...v.pts.map((p) => p[1])))) : 0) * kk }, ST.hid));
        K2.L([ex - R - 8, ey], [ex + R + 8, ey], ST.ctr); K2.L([ex, ey - R - 8], [ex, ey + R + 8], ST.ctr);
        if (af) { const y = ey - R - 9, hh = (af / 2) * kk; K2.dimh(ex - hh, ex + hh, y, ey - R * 0.5, ey - R * 0.5, hexAF.txt, hexAF.no, ST.dimr); sh.rep.dims++; }
        if (hexEM) { K2.dimv(ey - R, ey + R, ex + (af ? af / 2 * kk : R) + 12, ex, hexEM.txt, hexEM.no, ST.dimr); sh.rep.dims++; }
        K2.T(ex, ey + R + 9, "END VIEW (from the hex side)", 1, ST.diml, 0, h * 0.8);
      } else if (holeMine) {
        const pcd = numOf(pm[1]), n = +String(hole.text).match(/(\d+)\s*X/i)[1], hd2 = nomOf(hole), Rb = (Dmax / 2) * kk;
        sh.add(Object.assign({ t: "circle", layer: "STG-GEO", c: [ex, ey], r: Rb }, ST.model)); sh.add(Object.assign({ t: "circle", layer: "STG-GEO", c: [ex, ey], r: (pcd / 2) * kk }, ST.ctr));
        for (let i = 0; i < n; i++) { const an = Math.PI / 2 + (i * 2 * Math.PI) / n; sh.add(Object.assign({ t: "circle", layer: "STG-GEO", c: [ex + Math.cos(an) * (pcd / 2) * kk, ey + Math.sin(an) * (pcd / 2) * kk], r: (hd2 / 2) * kk }, ST.this)); }
        K2.T(ex, ey - Rb - 6, `${n} × Ø${r2(hd2)} on PCD ${r2(pcd)}`, 1, ST.dimr, 0, h * 0.8); K2.bal(+hole.no, ex + Rb + 8, ey, ST.dimr);
        K2.T(ex, ey + Rb + 6, "END VIEW", 1, ST.diml, 0, h * 0.8);
      }
    }
    K2.T(DA.x1 - 4, DA.y0 + 2, `Scale ${scTxt(k)}`, 2, ST.diml, 0, h * 0.75);
    return { sh, S, jaws, datumTxt, holdTxt, mine, rows: mine.map((n) => chars.get(n)).filter(Boolean), legend: [LEG.this, LEG.model].concat(isTurn ? [LEG.ph, LEG.clamp] : [LEG.hid]) };
  }

  /* ================================================================ H. raw bar, sawing, and the whole set ================================================================ */
  function breakLine(sh, x, yc, R0, k, sgn) {
    const t = yc + R0 * k, b = yc - R0 * k, f = (v) => yc + v * R0 * k;
    sh.K2.P([[x, t], [x + 2.4 * sgn, f(0.55)], [x - 2.4 * sgn, f(0.2)], [x + 2.4 * sgn, f(-0.2)], [x - 2.4 * sgn, f(-0.55)], [x, b]], ST.model);
  }
  function rawSheet(cx, op, info, ctx) {
    const sh = newSheet(), { K2 } = sh, h = K2.h, model = cx.model, R0 = model.D0 / 2, k = niceScale(Math.min(6, 50 / R0)), x0 = DA.x0 + 50, Lp = 105, yc = 178, top = yc + R0 * k, bot = yc - R0 * k;
    K2.L([x0, top], [x0 + Lp, top], ST.model); K2.L([x0, bot], [x0 + Lp, bot], ST.model); breakLine(sh, x0, yc, R0, k, 1); breakLine(sh, x0 + Lp, yc, R0, k, 1);
    K2.L([x0 - 8, yc], [x0 + Lp + 8, yc], ST.ctr);
    K2.dimv(bot, top, x0 - 14, x0, `Ø${model.D0} ${model.bar.tol}`, "R1", ST.diml);
    K2.dimh(x0, x0 + Lp, bot - 14, bot, bot, `${model.bar.len} (supplied length)`, "R2", ST.diml);
    const ex = x0 + Lp + 52, r = R0 * k * 0.55;
    sh.add(Object.assign({ t: "circle", layer: "STG-GEO", c: [ex, yc], r }, ST.model)); K2.L([ex - r - 8, yc], [ex + r + 8, yc], ST.ctr); K2.L([ex, yc - r - 8], [ex, yc + r + 8], ST.ctr);
    K2.T(ex, yc + r + 12, "END VIEW", 1, ST.diml, 0, h * 0.8); K2.lead(ex - r * 0.707, yc + r * 0.707, ex - r * 0.707 - 8, yc + r * 0.707 + 10, `Ø${model.D0} ${model.bar.tol}`, "R1", -1, ST.diml);
    K2.T(DA.x1 - 4, DA.y0 + 2, `Scale ${scTxt(k)}`, 2, ST.diml, 0, h * 0.75);
    return { sh, legend: [LEG.model], rows: null };
  }
  function sawSheet(cx, op, info, ctx) {
    const sh = newSheet(), { K2 } = sh, h = K2.h, model = cx.model, R0 = model.D0 / 2, Lb0 = cx.m.L + 2 * model.fa, k = niceScale(Math.min(6.2, 150 / Lb0, 50 / R0)), Lb = Lb0 * k, yc = 186, top = yc + R0 * k, bot = yc - R0 * k, kerf = 2.2;
    const xb = DA.x0 + 100, xs = xb - kerf - 66, sx = xb + Lb;
    K2.L([xs, top], [xb - kerf, top], ST.model); K2.L([xs, bot], [xb - kerf, bot], ST.model); breakLine(sh, xs, yc, R0, k, 1);
    K2.L([xb, top], [xb + Lb, top], ST.model); K2.L([xb, bot], [xb + Lb, bot], ST.model); K2.L([sx, top], [sx, bot], ST.model);
    K2.L([xs - 8, yc], [sx + 26, yc], ST.ctr);
    K2.P([[xb - kerf, top + 14], [xb, top + 14], [xb, bot - 14], [xb - kerf, bot - 14]], ST.ph, true); K2.L([xb - kerf, top], [xb - kerf, bot], ST.this); K2.L([xb, top], [xb, bot], ST.this);
    K2.T(xb - kerf / 2, top + 17, "SAW BLADE (kerf 2.2)", 1, ST.diml, 0, h * 0.75);
    for (const [y0, sg] of [[top, 1], [bot, -1]]) { const poly = [[xs + 12, y0], [xs + 38, y0], [xs + 38, y0 + sg * 16], [xs + 12, y0 + sg * 16]]; K2.P(poly, ST.clamp, true); sh.add(Object.assign({ t: "hatch", layer: "STG-GEO", pat: "ANSI31", sc: 0.45, ang: 90, solid: false, loops: [poly] }, { color: "#38bdf8", lw: 0.13, stg: "clamp" })); }
    K2.T(xs + 25, top + 20, "VICE JAWS", 1, ST.clamp, 0, h * 0.78);
    const stop = [[sx, bot - 16], [sx + 16, bot - 16], [sx + 16, top + 16], [sx, top + 16]]; K2.P(stop, ST.clamp, true); sh.add(Object.assign({ t: "hatch", layer: "STG-GEO", pat: "ANSI31", sc: 0.45, ang: 90, solid: false, loops: [stop] }, { color: "#38bdf8", lw: 0.13, stg: "clamp" }));
    K2.T(sx + 8, top + 20, "LENGTH STOP", 1, ST.clamp, 0, h * 0.78);
    const y0 = bot - 16, y1 = bot - 34; K2.L([sx, y0 - 0.5], [sx, y1], INKS); sh.add(Object.assign({ t: "hatch", layer: "STG-GEO", solid: true, loops: [[[sx, y1], [sx - 1.9, y1 + 3.4], [sx + 1.9, y1 + 3.4]]] }, INKS)); K2.L([sx, y1], [sx, y1 - 3.2], INKS);
    K2.P([[sx - 2.7, y1 - 8.6], [sx + 2.7, y1 - 8.6], [sx + 2.7, y1 - 3.2], [sx - 2.7, y1 - 3.2]], INKS, true); K2.T(sx, y1 - 7.2, "B", 1, INKS);
    K2.dimh(xb, sx, bot - 12, bot, bot, `${r2(Lb0)} ±1  (sawn length)`, "R1", ST.dimr);
    K2.dimv(bot, top, xs - 14, xs, `(Ø${model.D0})  bar size — reference`, null, ST.diml);
    K2.T(DA.x1 - 4, DA.y0 + 2, `Scale ${scTxt(k)}`, 2, ST.diml, 0, h * 0.75);
    return { sh, legend: [LEG.this, LEG.model, LEG.ph, LEG.clamp], rows: null };
  }

  const dmyOf = (t) => { if (!t) return ""; const d = new Date(t); return isNaN(d) ? String(t) : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); };
  const charRow = (cx, ctx, c) => {
    const sec = ctx.sopSec.get(String(ctx.opNo)), ck = sec && (sec.checks || []).find((x) => String(x.charNo) === String(c.no));
    return [String(c.no), fit(plain(c.spec || c.text || c.label || ""), 2.2, 34 - 2.4), c.lsl == null || c.lsl === "" ? "" : String(c.lsl), c.usl == null || c.usl === "" ? "" : String(c.usl), c.cls || "", fit(plain((ck && ck.gauge) || ctx.gName.get(c.gauge) || c.balloonInstr || ""), 2.2, 30 - 2.4)];
  };
  /** the stage data and notes of each kind of operation */
  function opInfo(cx, op, kind, ctx, pr) {
    const { P, model, chars, nT } = cx, H = ctx.H, data = [], notes = [], add = (a, b) => data.push([a, b]), L = cx.m.L, fa = model.fa, D0 = model.D0, mat = H.material || "As per drawing", fam = P.family || H.family || "rotational";
    const maxD = r2(2 * cx.m.rmax);
    add("Operation", `${op.opNo} · ${op.name}`); add("Machine", op.machine || "—");
    let title = op.name, charsTitle = "MADE AT THIS OPERATION — CHECK AS PER THE SOP";
    const hard = (P.notes || {}).hardness;
    if (kind === "raw") {
      title = "RAW MATERIAL"; charsTitle = "GENERAL REQUIREMENTS — INCOMING INSPECTION";
      add("Material", mat); add("Material class", H.materialClass || ""); add("Form", fam === "rotational" ? "Round bar" : "Plate / block / casting"); add("Bar size", `Ø${D0} ${model.bar.tol} (for finished Ø${maxD})`); add("Supply length", model.bar.len); add("Condition", model.bar.cond);
      add("Certificate", model.bar.cert); add("Traceability", "Heat / lot no. on tag and in the SOP record"); add("Cut length", `${r2(L + 2 * fa)} mm (sawing op)`); add("Finished length", `${r2(L)} mm`); if (hard) add("Hardness", String(hard));
      notes.push("Raw material as received: nothing is cut at this operation (all surfaces dark grey).", "Check: grade and heat no. against the certificate, bar diameter, straightness, surface defects (cracks, laps, rust).", "Material ID tag stays with the lot through every operation.");
    } else if (kind === "saw") {
      title = "SAWING — SAWN BLANK"; add("Work holding", "Bar in vice, fed to a length stop"); add("Datum B (axial)", "bar end on the length stop"); add("Blank", `Ø${D0} × ${r2(L + 2 * fa)} ±1 mm`); add("Allowance", `${fa} mm each end for facing`); add("Material", mat);
      notes.push(`Bar fed against the length stop, clamped in the vice, cut square to the axis; sawn face deburred; heat / lot no. marked on the blank.`, `Allowance ${fa} mm each end is removed by facing in the turning operations (${r2(L)} finished). Only the length is controlled here.`, "No hidden lines: the bar is solid, nothing inside it is machined at this operation.",
        `Blank weight ≈ ${(Math.PI * Math.pow(D0 / 20, 2) * ((L + 2 * fa) / 10) * 7.85 / 1000).toFixed(2)} kg (steel).`);
    } else if (/^turn/.test(kind)) {
      const first = pr.jaws && pr.jaws.stockEnd, th = [...chars.values()].find((c) => c.type === "Thread"), usesA = [...chars.values()].some((c) => /\bA\b/.test(gdDat(c) || ""));
      title = nT > 1 ? (first ? "CNC TURNING — 1ST SIDE" : "CNC TURNING — 2ND SIDE") : "CNC TURNING";
      add("Work holding", pr.holdTxt || "3-jaw chuck"); add("Datum B (axial)", pr.datumTxt || "face on the jaw step");
      if (first) add("Radial clamp", `Ø${D0} bar, ${r2(pr.jaws.grip)} mm grip`);
      add("Datum A (customer)", th && usesA ? `${plain(th.spec || th.text)} thread axis` : "axis of the clamped diameter");
      add("Program zero", `G54: X0 on axis, Z0 ${first ? "first finished face" : "finished length face"}`);
      add("Starts from", first ? `Sawn blank Ø${D0} × ${r2(L + 2 * fa)}` : "Part with the first side done"); add("Facing", first ? `${fa} mm off the face` : `to finished length ${r2(L)} mm`);
      notes.push(first ? "Face, rough and finish turn the profile in red. Release (or part off) when the profile is complete." : "Seat the part against the jaw stop; do not clamp on threads or ground surfaces.", "Check the first piece with the SOP gauges before running the batch.");
      if (!first) notes.push("What was made at the earlier turning operation is dark grey; the phantom lines show the stock removed here.");
    } else if (kind === "feat") { title = op.name; add("Fixture", "Soft jaws / vice per the set-up sheet"); notes.push("Features made here are red; the rest of the part is dark grey; hidden edges are dashed.", "Position from the datums on the SOP."); }
    else if (kind === "ht") { title = "HEAT TREATMENT"; if (hard) add("Hardness", String(hard)); if ((P.notes || {}).htType) add("Process", String(P.notes.htType)); if ((P.notes || {}).caseDepth) add("Case depth", String(P.notes.caseDepth)); notes.push("Sub-contract: send with the process card; verify hardness on return."); }
    else if (kind === "grind") { title = op.name; add("Stock left for grinding", "0.2 – 0.4 mm on diameter (as per route)"); notes.push("Ground surfaces are red; hold between centres or in the soft chuck as per the SOP."); }
    else if (kind === "deburr") { title = "DEBURRING"; notes.push("Break all sharp edges 0.2 – 0.5 mm unless the drawing says otherwise."); }
    if (kind !== "raw") add("Tolerance class", H.generalTol || "As per drawing");
    notes.push("( ) = reference size, not toleranced. Size marking per ISO 129-1 / ASME Y14.5.");
    return { title, charsTitle, data, notes, tools: (op.tools || []).map((t) => [t.desc, t.spec].filter(Boolean).join(" — ")) };
  }

  /** the whole set: one sheet per operation */
  SP.build = (P, model, opt) => {
    const doc = K.newDoc(false);
    for (const [n, c, lw] of [["STG-FRAME", "#ffffff", 0.5], ["STG-TABLE", "#ffffff", 0.25], ["STG-BALLOON", RED, 0.35], ["STG-GEO", "#ffffff", 0.35], ["STG-DIM", "#00ffff", 0.18], ["STG-TOOL", BLUE, 0.3]]) doc.layers.push({ name: n, color: c, lt: "CONTINUOUS", lw, on: true, frozen: false, lock: false });
    doc.dim = Object.assign({}, doc.dim, { th: 2.5, as: 2.5, dec: 2, scale: 1, gap: 0.8 });
    const cx = SP.prepare(P, model, opt || {}), H = P.header || {}, co = (window.QP && QP.ctx && QP.ctx.company) || H.supplier || "";
    const sopSec = new Map(((P.sop && P.sop.sections) || []).map((s) => [String(s.opNo), s])), gName = new Map((P.gauges || []).map((g) => [g.id, [g.name, g.range].filter(Boolean).join(" ")]));
    const sheets = [], rep = { balloons: 0, linked: 0, missing: [], noted: [], stages: 0 }; let ox = 0;
    cx.stages.forEach((op, idx) => {
      const kind = cx.kinds[idx], rank = cx.rankOfStage.has(idx) ? cx.rankOfStage.get(idx) : 99, ctx = { co, H, sopSec, gName, dmy: dmyOf, opNo: op.opNo };
      let pr, info;
      if (kind === "raw" || kind === "saw") { info = opInfo(cx, op, kind, ctx, {}); pr = kind === "raw" ? rawSheet(cx, op, info, ctx) : sawSheet(cx, op, info, ctx); }
      else { pr = profileSheet(cx, op, kind, rank, null, ctx); info = opInfo(cx, op, kind, ctx, pr); }
      let list = (cx.map[String(op.opNo)] || []).map(Number).sort((a, b) => a - b).map((n) => cx.chars.get(n)).filter(Boolean), rows;
      if (kind === "raw") {
        const bl = String(model.bar.len).match(/\d+(?:\.\d+)?/g) || [], d0 = model.D0, it = hTol(d0, model.bar.tol);
        rows = [["R1", `Ø${d0} ${model.bar.tol}`, String(r2(d0 - it)), String(d0), "Dia", "Micrometer"], ["R2", "Supplied length", bl[0] || "", bl[1] || "", "Linear", "Tape"], ["R3", "Material grade per certificate", "", "", "Note", "Certificate"], ["R4", "Straightness / surface defects", "", "", "Note", "Visual"]];
        rows = rows.concat((P.chars || []).filter((c) => c.type === "Material" || c.type === "Note").map((c) => charRow(cx, ctx, c)));
      } else if (kind === "saw") { const Ls = r2(cx.m.L + 2 * model.fa); rows = [["R1", `Sawn length ${Ls} ±1`, String(r2(Ls - 1)), String(r2(Ls + 1)), "Linear", "Steel rule / vernier"]]; }
      else rows = list.map((c) => charRow(cx, ctx, c));
      frame(pr.sh, cx, op, ctx, idx + 1, cx.stages.length); panel(pr.sh, cx, op, info, ctx, rows, pr.legend);
      pr.sh.ents.forEach((e) => shiftEnt(e, ox)); doc.ents.push(...pr.sh.ents);
      rep.balloons += pr.sh.ents.filter((e) => e.t === "circle" && e.stg === "balloon").length; for (const n of pr.sh.rep.missing) rep.noted.push(n);
      sheets.push({ opNo: op.opNo, opName: op.name, sheet: 1, of: 1, kind, box: { x0: ox, y0: 0, x1: ox + PW, y1: PH } }); ox += PW * 1.08; rep.stages++;
    });
    rep.linked = cx.M.size; return { doc, sheets, report: rep, cx };
  };

  /* ================================================================ I. "Part shape" dialog: check the outline read from the drawing, or type it ================================================================ */
  SP.dialog = async (E, P, model, srcNote) => {
    const esc = K.esc, fmt = (pts) => pts.map((p) => `${r2(p[0])}  ${r2(p[1])}`).join("\n"), outTxt = fmt(model.outer), boreTxt = model.inner.map(fmt).join("\n\n");
    const parse = (t) => t.split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.split(/[\s,;]+/).map(Number));
    const parseBores = (t) => t.split(/\n\s*\n/).map((blk) => parse(blk)).filter((c) => c.length);
    const okPts = (pts) => pts.length >= 2 && pts.every((p) => p.length === 2 && p.every(Number.isFinite) && p[1] >= 0);
    const prev = (outer, inner) => {
      try {
        if (!okPts(outer)) return "";
        const L = Math.max(...outer.map((p) => p[0])), Rm = Math.max(...outer.map((p) => p[1])), W = 340, Hh = 120, kk = Math.min((W - 20) / Math.max(L, 1e-6), (Hh - 16) / (2 * Math.max(Rm, 1e-6))), x0 = 10, yc = Hh / 2;
        const path = (pts, sg) => pts.map((p, i) => `${i ? "L" : "M"}${(x0 + p[0] * kk).toFixed(1)},${(yc - sg * p[1] * kk).toFixed(1)}`).join("");
        let d = ""; for (const sg of [1, -1]) { d += `<path d="${path(outer, sg)}" fill="none" stroke="#374151" stroke-width="1.4"/>`; for (const c of inner) if (okPts(c)) d += `<path d="${path(c, sg)}" fill="none" stroke="#374151" stroke-width="1" stroke-dasharray="4 3"/>`; }
        return `<svg viewBox="0 0 ${W} ${Hh}" width="100%" style="max-width:${W}px;background:#fff;border:1px solid #d1d5db;border-radius:6px"><line x1="4" y1="${yc}" x2="${W - 4}" y2="${yc}" stroke="#9ca3af" stroke-dasharray="8 2 2 2"/>${d}</svg>`;
      } catch (e) { return ""; }
    };
    const html = `<p class="cx-note">${srcNote}</p>
      <p style="font-size:14px;margin:6px 0"><b>Is this the shape of your finished part?</b> The line is the outside, the dashed line is the hole. If it looks right, just press <b>Make the stage drawings</b>.</p><div id="spPrev">${prev(model.outer, model.inner)}</div>
      <div class="cx-frm" style="margin-top:10px"><label>Raw bar diameter (mm)<input id="sfD0" type="number" step="any" min="1" value="${model.D0}"></label><label>Chuck grip length (mm)<input id="sfCl" type="number" step="any" min="3" value="${model.clamp}"></label></div>
      <details style="margin-top:10px"><summary style="cursor:pointer;color:#0369a1">The picture is wrong, or I want to change more (optional)</summary>
      <h4>Outside shape — one point per line: <i>length from the left end, radius</i> (mm)</h4>
      <textarea id="spOut" rows="8" style="width:100%;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px">${esc(outTxt)}</textarea>
      <h4>Hole — same way; blank line between separate holes; empty = no hole</h4>
      <textarea id="spBore" rows="4" style="width:100%;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px">${esc(boreTxt)}</textarea>
      <div class="cx-frm"><label>Facing allowance each end (mm)<input id="sfFa" type="number" step="any" min="0" value="${model.fa}"></label>
      <label>First turning side<select id="sfFi"><option value="L"${model.first === "L" ? " selected" : ""}>Left end as shown</option><option value="R"${model.first === "R" ? " selected" : ""}>Right end as shown</option></select></label><label>Bar supply length<input id="sfBL" value="${esc(model.bar.len)}"></label><label>Bar tolerance<input id="sfBT" value="${esc(model.bar.tol)}"></label></div>
      <label>Condition<input id="sfCo" value="${esc(model.bar.cond)}"></label><label>Certificate<input id="sfCe" value="${esc(model.bar.cert)}"></label></details>`;
    return E.dialog("Check the part shape", html, (b) => {
      const g = (id) => b.querySelector("#" + id), tO = g("spOut").value, tB = g("spBore").value;
      let outer = model.outer, inner = model.inner;
      if (tO.trim() !== outTxt.trim()) { outer = parse(tO); if (!okPts(outer)) throw new Error("The outline needs at least two lines, each with two numbers: length and radius."); outer = outer.slice().sort((a, c) => a[0] - c[0]); }
      if (tB.trim() !== boreTxt.trim()) { inner = parseBores(tB); if (inner.some((c) => !okPts(c))) throw new Error("Each bore line needs two numbers: length and radius."); inner = inner.map((c) => c.slice().sort((a, d) => a[0] - d[0])); }
      const L = Math.max(...outer.map((p) => p[0])), rmax = Math.max(...outer.map((p) => p[1])), D0 = +g("sfD0").value;
      if (!(D0 >= 2 * rmax + 0.1)) throw new Error("The bar must be larger than the largest diameter (" + r2(2 * rmax) + " mm).");
      return Object.assign({}, model, { outer, inner, L, rmax, D0, fa: Math.max(0, +g("sfFa").value || 0), clamp: Math.max(3, +g("sfCl").value || model.clamp), first: g("sfFi").value, bar: { len: g("sfBL").value, tol: g("sfBT").value, cond: g("sfCo").value, cert: g("sfCe").value } });
    }, { width: "min(720px,96vw)", ok: "Make the stage drawings", init: (b) => {
      const redo = () => { try { b.querySelector("#spPrev").innerHTML = prev(parse(b.querySelector("#spOut").value), parseBores(b.querySelector("#spBore").value)); } catch (e) { /* keep the last picture */ } };
      b.querySelector("#spOut").oninput = redo; b.querySelector("#spBore").oninput = redo;
    } });
  };

  /*@@END@@*/
})((window.KCAD = window.KCAD || {}));
