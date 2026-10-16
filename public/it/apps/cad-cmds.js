/* KMR CAD Draft — commands: draw, modify, annotate (AutoCAD names and aliases, same prompts and options). */
(function (K) {
  "use strict";
  const G = K.geom, D2R = Math.PI / 180, TAU = G.TAU, cmd = K.cmd;
  const isP = (v) => Array.isArray(v);
  const pr = (msg, kws, dflt) => msg + (kws && kws.length ? " [" + kws.join("/") + "]" : "") + (dflt != null ? " <" + dflt + ">" : "") + ":";
  const mem = (E) => { if (!E.mem || !E.mem._d) E.mem = Object.assign({ r: 10, off: 10, fil: 0, cham: [5, 5], hatch: { pat: "ANSI31", sc: 1, ang: 0 }, poly: 6, polyI: "Inscribed", ttr: 10, filTrim: true, txtRot: 0, _d: true }, E.mem || {}); return E.mem; };
  const f = (v, E) => K.fmt(v, E.doc.dim.dec);
  const need = (v) => { if (v == null) throw K.CANCEL; return v; };
  const ccwLoop = (pts) => (G.area(pts) < 0 ? pts.slice().reverse() : pts);

  /* =============================== DRAW =============================== */
  cmd("LINE", { a: ["L"], d: "Draw straight line segments", fn: async (E) => {
    const first = await E.getPoint("Specify first point:"); if (!isP(first)) return;
    E.begin("line"); let p0 = first; const made = [];
    for (;;) {
      const kws = made.length >= 2 ? ["Close", "Undo"] : made.length ? ["Undo"] : [];
      const v = await E.getPoint(pr("Specify next point", kws), { base: p0, kws, preview: (q) => [{ t: "line", a: p0, b: q }] });
      if (v == null) break;
      if (v.kw === "Undo") { const id = made.pop(); if (id) { E.remove([id]); p0 = made.length ? E.byId(made[made.length - 1]).b : first; E.lastPt = p0; } continue; }
      if (v.kw === "Close") { E.add({ t: "line", a: p0, b: first }); break; }
      if (G.dist(p0, v) < 1e-12) continue;
      made.push(E.add({ t: "line", a: p0, b: v }).id); p0 = v;
    }
  } });

  cmd("PLINE", { a: ["PL"], d: "Polyline: connected lines and arcs as one object", fn: async (E) => {
    const first = await E.getPoint("Specify start point:"); if (!isP(first)) return;
    E.begin("polyline"); const pts = [[first[0], first[1], 0]]; let arc = false, w = mem(E).plw || 0, id = null, closed = false;
    const tanAt = () => { const n = pts.length; if (n < 2) return 0; const p = pts[n - 2], q = pts[n - 1], ch = G.ang(p, q), b = p[2] || 0; return ch + 2 * Math.atan(b); };
    const bulgeTo = (q) => { const p = pts[pts.length - 1], t = tanAt(); let h = G.ang(p, q) - t; h = Math.atan2(Math.sin(h), Math.cos(h)); return Math.tan(h / 2); };
    const ent = (extra) => { const P = pts.map((p) => p.slice()); if (extra) { P[P.length - 1][2] = extra.b; P.push([extra.q[0], extra.q[1], 0]); } return { t: "pline", pts: P, closed, w: w || undefined }; };
    const commit = () => { if (pts.length < 2) return; const e = ent(); if (id) E.replace(id, Object.assign({}, E.byId(id), e)); else id = E.add(e).id; };
    for (;;) {
      const last = pts[pts.length - 1], kws = arc ? ["Line", "Close", "Undo", "Width"] : ["Arc", "Close", "Undo", "Width", "Length"];
      const v = await E.getPoint(pr(arc ? "Specify endpoint of arc" : "Specify next point", pts.length > 2 ? kws : kws.filter((k) => k !== "Close")), { base: last, kws, preview: (q) => [ent({ q, b: arc ? bulgeTo(q) : 0 })] });
      if (v == null) break;
      if (v.kw === "Arc") { arc = true; continue; }
      if (v.kw === "Line") { arc = false; continue; }
      if (v.kw === "Width") { const ww = await E.getDist("Specify width", { dflt: f(w, E), base: last }); if (ww != null && !ww.kw) { w = +ww; mem(E).plw = w; commit(); } continue; }
      if (v.kw === "Length") { const L = await E.getDist("Specify length of line", { base: last }); if (typeof L === "number") { const q = G.polar(last, tanAt(), L); pts.push([q[0], q[1], 0]); commit(); } continue; }
      if (v.kw === "Undo") { if (pts.length > 1) { pts.pop(); pts[pts.length - 1][2] = 0; if (pts.length < 2 && id) { E.remove([id]); id = null; } else commit(); } continue; }
      if (v.kw === "Close") { if (arc) pts[pts.length - 1][2] = bulgeTo(first); closed = true; commit(); break; }
      if (G.dist(last, v) < 1e-12) continue;
      if (arc) pts[pts.length - 1][2] = bulgeTo(v);
      pts.push([v[0], v[1], 0]); commit();
    }
  } });

  const circleTTR = (E, a, b, r) => {
    const offs = (pr0) => pr0.k === "s" ? [G.offsetPrim(pr0, r, G.add(pr0.a, [-(pr0.b[1] - pr0.a[1]), pr0.b[0] - pr0.a[0]])), G.offsetPrim(pr0, r, G.sub(pr0.a, [-(pr0.b[1] - pr0.a[1]), pr0.b[0] - pr0.a[0]]))].filter(Boolean)
      : [{ k: "a", c: pr0.c, r: pr0.r + r, a0: 0, a1: TAU, full: true }, pr0.r > r ? { k: "a", c: pr0.c, r: pr0.r - r, a0: 0, a1: TAU, full: true } : { k: "a", c: pr0.c, r: r - pr0.r, a0: 0, a1: TAU, full: true }];
    const near = (ent, p) => { const ps = G.prims(ent.e); let best = ps[0], bd = Infinity; for (const q of ps) { const d = G.distTo(p, q); if (d < bd) { bd = d; best = q; } } return best; };
    const A = near(a, a.p), B = near(b, b.p); let best = null, bd = Infinity;
    for (const o1 of offs(A)) for (const o2 of offs(B)) for (const c of G.ix(o1, o2, true, true)) { const d = G.dist(c, a.p) + G.dist(c, b.p); if (d < bd) { bd = d; best = c; } }
    return best;
  };
  cmd("CIRCLE", { a: ["C"], d: "Circle by centre and radius / diameter, 2 points, 3 points or tangent-tangent-radius", fn: async (E) => {
    const M = mem(E);
    const v = await E.getPoint(pr("Specify center point for circle", ["3P", "2P", "Ttr"])); if (v == null) return;
    if (v.kw === "2P") { const a = need(await E.getPoint("Specify first end point of circle's diameter:")); const b = need(await E.getPoint("Specify second end point of circle's diameter:", { base: a, preview: (q) => [{ t: "circle", c: G.mid(a, q), r: G.dist(a, q) / 2 }] })); if (!isP(b)) return; E.add({ t: "circle", c: G.mid(a, b), r: G.dist(a, b) / 2 }); return; }
    if (v.kw === "3P") { const a = need(await E.getPoint("Specify first point on circle:")); const b = need(await E.getPoint("Specify second point on circle:", { base: a })); const c = need(await E.getPoint("Specify third point on circle:", { base: b, preview: (q) => { const C = G.circle3(a, b, q); return C ? [{ t: "circle", c: C.c, r: C.r }] : []; } })); const C = isP(c) && G.circle3(a, b, c); if (!C) return E.err("The three points are in a line."); E.add({ t: "circle", c: C.c, r: C.r }); return; }
    if (v.kw === "Ttr") {
      const flt = (e) => ["line", "circle", "arc", "pline"].includes(e.t);
      const a = need(await E.getEnt("Specify point on object for first tangent of circle:", { filter: flt })); const b = need(await E.getEnt("Specify point on object for second tangent of circle:", { filter: flt }));
      const r = need(await E.getDist("Specify radius of circle", { dflt: f(M.ttr, E) })); M.ttr = +r;
      const c = circleTTR(E, a, b, +r); if (!c) return E.err("Circle does not exist."); E.add({ t: "circle", c, r: +r }); return;
    }
    const c = v;
    let r = await E.getDist(pr("Specify radius of circle", ["Diameter"], f(M.r, E)), { base: c, kws: ["Diameter"], dflt: M.r, preview: (q) => [{ t: "circle", c, r: G.dist(c, q) }] });
    if (r && r.kw === "Diameter") { r = await E.getDist(pr("Specify diameter of circle", [], f(M.r * 2, E)), { base: c, dflt: M.r * 2, preview: (q) => [{ t: "circle", c, r: G.dist(c, q) / 2 }] }); if (typeof r === "number") r /= 2; }
    if (typeof r !== "number" || r <= 0) return; M.r = r; E.add({ t: "circle", c, r });
  } });

  const arcCSE = (c, s, q) => ({ t: "arc", c, r: G.dist(c, s), a0: G.ang(c, s), a1: G.ang(c, q) });
  cmd("ARC", { a: ["A"], d: "Arc: 3 points, start-centre-end, centre-start-end, start-end-radius", fn: async (E) => {
    const v = await E.getPoint(pr("Specify start point of arc", ["Center"])); if (v == null) return;
    const endFromCenter = async (c, s) => {
      const q = await E.getPoint(pr("Specify end point of arc", ["Angle", "chord Length"]), { base: c, kws: ["Angle", "chord Length"], preview: (p) => [arcCSE(c, s, p)] }); if (q == null) return;
      if (q.kw === "Angle") { const a = need(await E.getAngle("Specify included angle:", { base: c })); const a0 = G.ang(c, s); E.add({ t: "arc", c, r: G.dist(c, s), a0: a >= 0 ? a0 : a0 + a, a1: a >= 0 ? a0 + a : a0 }); return; }
      if (q.kw === "chord Length") { const L = need(await E.getDist("Specify length of chord:")); const r = G.dist(c, s); if (L > 2 * r) return E.err("The chord is longer than the diameter."); const a0 = G.ang(c, s); E.add({ t: "arc", c, r, a0, a1: a0 + 2 * Math.asin(L / (2 * r)) }); return; }
      E.add(arcCSE(c, s, q));
    };
    if (v.kw === "Center") { const c = need(await E.getPoint("Specify center point of arc:")); const s = need(await E.getPoint("Specify start point of arc:", { base: c })); return endFromCenter(c, s); }
    const s = v;
    const m = await E.getPoint(pr("Specify second point of arc", ["Center", "End"]), { base: s, kws: ["Center", "End"] }); if (m == null) return;
    if (m.kw === "Center") { const c = need(await E.getPoint("Specify center point of arc:", { base: s })); return endFromCenter(c, s); }
    if (m.kw === "End") {
      const e = need(await E.getPoint("Specify end point of arc:", { base: s }));
      const o = await E.getPoint(pr("Specify center point of arc", ["Radius"]), { base: e, kws: ["Radius"], preview: (c) => [arcCSE(c, s, e)] }); if (o == null) return;
      if (o.kw === "Radius") { const r = need(await E.getDist("Specify radius of arc:", { base: e })); const d = G.dist(s, e); if (2 * Math.abs(r) < d) return E.err("The radius is too small for these points."); const mm = G.mid(s, e), n = G.unit([-(e[1] - s[1]), e[0] - s[0]]), h = Math.sqrt(r * r - (d / 2) ** 2) * (r > 0 ? 1 : -1); const c = G.add(mm, G.mul(n, h)); E.add(arcCSE(c, s, e)); return; }
      E.add(arcCSE(o, s, e)); return;
    }
    const e = need(await E.getPoint("Specify end point of arc:", { base: m, preview: (q) => { const A = G.arc3(s, m, q); return A ? [Object.assign({ t: "arc" }, A)] : []; } }));
    const A = isP(e) && G.arc3(s, m, e); if (!A) return E.err("The three points are in a line."); E.add(Object.assign({ t: "arc" }, A));
  } });

  const rectPts = (p0, q, o) => {
    const rot = o.rot || 0, l = G.rotp(q, p0, -rot), dx = l[0] - p0[0], dy = l[1] - p0[1];
    let C = [[0, 0], [dx, 0], [dx, dy], [0, dy]]; const ccw = dx * dy > 0, out = [];
    const r = Math.min(o.fil || 0, Math.abs(dx) / 2, Math.abs(dy) / 2), ch = Math.min(o.ch || 0, Math.abs(dx) / 2, Math.abs(dy) / 2);
    if (r > 1e-9 || ch > 1e-9) {
      const d = r || ch, b = r ? Math.tan(Math.PI / 8) * (ccw ? 1 : -1) : 0;
      for (let i = 0; i < 4; i++) { const p = C[i], a = C[(i + 3) % 4], n = C[(i + 1) % 4], u1 = G.unit(G.sub(a, p)), u2 = G.unit(G.sub(n, p)); const t1 = G.add(p, G.mul(u1, d)), t2 = G.add(p, G.mul(u2, d)); out.push([t1[0], t1[1], b], [t2[0], t2[1], 0]); }
    } else for (const p of C) out.push([p[0], p[1], 0]);
    return out.map((p) => { const w = G.rotp([p[0] + p0[0], p[1] + p0[1]], p0, rot); return [w[0], w[1], p[2]]; });
  };
  cmd("RECTANG", { a: ["REC", "RECTANGLE"], d: "Rectangle (with fillet, chamfer, rotation or exact dimensions)", fn: async (E) => {
    const M = mem(E), o = { fil: M.rfil || 0, ch: M.rch || 0, rot: 0 };
    let p0;
    for (;;) {
      p0 = await E.getPoint(pr("Specify first corner point", ["Chamfer", "Fillet", "Width"]) + (o.fil ? ` (fillet ${f(o.fil, E)})` : o.ch ? ` (chamfer ${f(o.ch, E)})` : ""), { kws: ["Chamfer", "Fillet", "Width"] }); if (p0 == null) return;
      if (p0.kw === "Fillet") { const r = await E.getDist("Specify fillet radius for rectangles", { dflt: f(o.fil, E) }); if (typeof r === "number") { o.fil = M.rfil = r; o.ch = M.rch = 0; } continue; }
      if (p0.kw === "Chamfer") { const r = await E.getDist("Specify chamfer distance for rectangles", { dflt: f(o.ch, E) }); if (typeof r === "number") { o.ch = M.rch = r; o.fil = M.rfil = 0; } continue; }
      if (p0.kw === "Width") { const r = await E.getDist("Specify line width for rectangles", { dflt: f(M.rw || 0, E) }); if (typeof r === "number") M.rw = r; continue; }
      break;
    }
    const mk = (q) => ({ t: "pline", closed: true, pts: rectPts(p0, q, o), w: M.rw || undefined });
    for (;;) {
      const q = await E.getPoint(pr("Specify other corner point", ["Area", "Dimensions", "Rotation"]), { base: p0, noRubber: true, kws: ["Area", "Dimensions", "Rotation"], preview: (p) => [mk(p)] }); if (q == null) return;
      if (q.kw === "Rotation") { const a = await E.getAngle("Specify rotation angle", { base: p0, dflt: 0 }); if (typeof a === "number") o.rot = a; continue; }
      if (q.kw === "Dimensions" || q.kw === "Area") {
        let L, W;
        if (q.kw === "Area") { const A = need(await E.getNum("Enter area of rectangle in current units:", { positive: true })); L = need(await E.getDist("Enter rectangle length:", { dflt: f(M.rl || 10, E) })); W = A / L; }
        else { L = need(await E.getDist("Specify length for rectangles", { dflt: f(M.rl || 10, E) })); W = need(await E.getDist("Specify width for rectangles", { dflt: f(M.rww || 10, E) })); }
        M.rl = +L; M.rww = +W;
        const side = need(await E.getPoint("Specify other corner point (click the side):", { base: p0, preview: (p) => { const l = G.rotp(p, p0, -o.rot); return [mk(G.rotp([p0[0] + (l[0] >= p0[0] ? L : -L), p0[1] + (l[1] >= p0[1] ? W : -W)], p0, o.rot))]; } }));
        const l = G.rotp(side, p0, -o.rot); E.add(mk(G.rotp([p0[0] + (l[0] >= p0[0] ? L : -L), p0[1] + (l[1] >= p0[1] ? W : -W)], p0, o.rot))); return;
      }
      E.add(mk(q)); return;
    }
  } });

  const polyPts = (c, n, r, a0, circ) => { const R = circ ? r / Math.cos(Math.PI / n) : r, out = []; for (let i = 0; i < n; i++) { const p = G.polar(c, a0 + (TAU * i) / n, R); out.push([p[0], p[1], 0]); } return out; };
  cmd("POLYGON", { a: ["POL"], d: "Regular polygon (inscribed, circumscribed or by edge)", fn: async (E) => {
    const M = mem(E);
    const n = await E.getNum(pr("Enter number of sides", [], M.poly), { dflt: M.poly, int: true, min: 3 }); if (n == null) return; if (n < 3 || n > 1024) return E.err("Enter 3 to 1024 sides."); M.poly = n;
    const c = await E.getPoint(pr("Specify center of polygon", ["Edge"])); if (c == null) return;
    if (c.kw === "Edge") { const a = need(await E.getPoint("Specify first endpoint of edge:")); const b = need(await E.getPoint("Specify second endpoint of edge:", { base: a, preview: (q) => [edgePoly(a, q, n)] })); if (isP(b)) E.add(edgePoly(a, b, n)); return; }
    const io = await E.getKw(pr("Enter an option", ["Inscribed in circle", "Circumscribed about circle"], M.polyI === "Inscribed" ? "I" : "C"), ["Inscribed in circle", "Circumscribed about circle"], M.polyI); if (io === null) return;
    const circ = io && io.kw ? /^Circ/.test(io.kw) : M.polyI !== "Inscribed"; M.polyI = circ ? "Circumscribed" : "Inscribed";
    const ang = (q) => G.ang(c, q) + (circ ? Math.PI / n : 0);
    const r = await E.getDist("Specify radius of circle:", { base: c, preview: (q) => [{ t: "pline", closed: true, pts: polyPts(c, n, G.dist(c, q), ang(q), circ) }] });
    if (typeof r !== "number") return;
    const q = E.lastPt && G.dist(E.lastPt, c) > 1e-9 && Math.abs(G.dist(E.lastPt, c) - r) < 1e-6 ? E.lastPt : null;
    E.add({ t: "pline", closed: true, pts: polyPts(c, n, r, q ? ang(q) : -Math.PI / 2 + Math.PI / n, circ) });
  } });
  const edgePoly = (a, b, n) => { const L = G.dist(a, b), R = L / (2 * Math.sin(Math.PI / n)), m = G.mid(a, b), h = L / (2 * Math.tan(Math.PI / n)), nn = G.unit([-(b[1] - a[1]), b[0] - a[0]]), c = G.add(m, G.mul(nn, h)); return { t: "pline", closed: true, pts: polyPts(c, n, R, G.ang(c, a), false) }; };

  cmd("ELLIPSE", { a: ["EL"], d: "Ellipse or elliptical arc", fn: async (E) => {
    let v = await E.getPoint(pr("Specify axis endpoint of ellipse", ["Arc", "Center"])); if (v == null) return;
    let isArc = false; if (v.kw === "Arc") { isArc = true; v = need(await E.getPoint(pr("Specify axis endpoint of elliptical arc", ["Center"]))); }
    let c, p1;
    if (v.kw === "Center") { c = need(await E.getPoint("Specify center of ellipse:")); p1 = need(await E.getPoint("Specify endpoint of axis:", { base: c })); }
    else { const a = v, b = need(await E.getPoint("Specify other endpoint of axis:", { base: a })); c = G.mid(a, b); p1 = b; }
    const rx = G.dist(c, p1), rot = G.ang(c, p1);
    const mk = (ry) => { let e = { t: "ellipse", c, rx, ry: Math.max(1e-9, ry), rot }; if (e.ry > e.rx) e = { t: "ellipse", c, rx: e.ry, ry: e.rx, rot: rot + Math.PI / 2 }; return e; };
    const ry = await E.getDist(pr("Specify distance to other axis", ["Rotation"]), { base: c, kws: ["Rotation"], preview: (q) => [mk(Math.abs(G.dot(G.sub(q, c), [-Math.sin(rot), Math.cos(rot)])))] }); if (ry == null) return;
    let e;
    if (ry.kw === "Rotation") { const a = need(await E.getAngle("Specify rotation around major axis:", { base: c })); e = mk(rx * Math.abs(Math.cos(a))); }
    else e = mk(isP(ry) ? Math.abs(G.dot(G.sub(ry, c), [-Math.sin(rot), Math.cos(rot)])) : ry);
    if (isArc) {
      const par = (q) => { const l = G.rotp(q, e.c, -e.rot); return Math.atan2((l[1] - e.c[1]) / e.ry, (l[0] - e.c[0]) / e.rx); };
      const s = need(await E.getPoint("Specify start angle (point):", { base: c })); const a0 = par(s);
      const t = need(await E.getPoint("Specify end angle (point):", { base: c, preview: (q) => [Object.assign({}, e, { a0, a1: par(q) })] }));
      e.a0 = a0; e.a1 = par(t);
    }
    E.add(e);
  } });

  cmd("SPLINE", { a: ["SPL"], d: "Smooth curve through fit points", fn: async (E) => {
    const pts = [need(await E.getPoint("Specify first point:"))]; if (!isP(pts[0])) return;
    for (;;) {
      const kws = pts.length > 2 ? ["Close", "Undo"] : ["Undo"];
      const v = await E.getPoint(pr("Enter next point", kws), { base: pts[pts.length - 1], kws, preview: (q) => [{ t: "spline", pts: pts.concat([q]) }] });
      if (v == null) break; if (v.kw === "Undo") { if (pts.length > 1) pts.pop(); continue; }
      if (v.kw === "Close") { E.add({ t: "spline", pts, closed: true }); return; }
      pts.push(v);
    }
    if (pts.length > 1) E.add({ t: "spline", pts });
  } });

  cmd("POINT", { a: ["PO"], d: "Point objects (style: PTYPE)", fn: async (E) => { E.begin("point"); for (;;) { const p = await E.getPoint("Specify a point:"); if (!isP(p)) break; E.add({ t: "point", p }); } } });
  cmd("XLINE", { a: ["XL"], d: "Construction line (infinite)", fn: async (E) => {
    const v = await E.getPoint(pr("Specify a point", ["Hor", "Ver", "Ang"])); if (v == null) return; E.begin("xline");
    if (v.kw) { let dir = v.kw === "Hor" ? [1, 0] : [0, 1]; if (v.kw === "Ang") { const a = need(await E.getAngle("Enter angle of xline:")); dir = [Math.cos(a), Math.sin(a)]; } for (;;) { const p = await E.getPoint("Specify through point:", { preview: (q) => [{ t: "xline", p: q, dir }] }); if (!isP(p)) break; E.add({ t: "xline", p, dir }); } return; }
    for (;;) { const q = await E.getPoint("Specify through point:", { base: v, preview: (p) => (G.dist(p, v) > 1e-9 ? [{ t: "xline", p: v, dir: G.unit(G.sub(p, v)) }] : []) }); if (!isP(q)) break; if (G.dist(q, v) > 1e-9) E.add({ t: "xline", p: v, dir: G.unit(G.sub(q, v)) }); }
  } });
  cmd("RAY", { a: [], d: "Semi-infinite construction line", fn: async (E) => { const v = need(await E.getPoint("Specify start point:")); E.begin("ray"); for (;;) { const q = await E.getPoint("Specify through point:", { base: v, preview: (p) => (G.dist(p, v) > 1e-9 ? [{ t: "xline", ray: true, p: v, dir: G.unit(G.sub(p, v)) }] : []) }); if (!isP(q)) break; E.add({ t: "xline", ray: true, p: v, dir: G.unit(G.sub(q, v)) }); } } });
  cmd("DONUT", { a: ["DO", "DOUGHNUT"], d: "Filled ring or solid dot", fn: async (E) => {
    const M = mem(E); const di = await E.getDist("Specify inside diameter of donut", { dflt: f(M.di ?? 5, E) }); if (di == null) return; M.di = +(di ?? 5);
    const dd = await E.getDist("Specify outside diameter of donut", { dflt: f(M.dd ?? 10, E) }); if (dd == null) return; M.dd = +dd; if (M.dd <= M.di) return E.err("Outside diameter must be larger.");
    const w = (M.dd - M.di) / 2, r = (M.dd + M.di) / 4, mk = (c) => ({ t: "pline", closed: true, w, pts: [[c[0] - r, c[1], 1], [c[0] + r, c[1], 1]] });
    E.begin("donut"); for (;;) { const c = await E.getPoint("Specify center of donut:", { preview: (q) => [mk(q)] }); if (!isP(c)) break; E.add(mk(c)); }
  } });

  /* ---- divide / measure ---- */
  const placeAlong = async (E, byLen) => {
    const pick = need(await E.getEnt(byLen ? "Select object to measure:" : "Select object to divide:", { filter: (e) => !!K.path(e) }));
    const P = K.path(pick.e), L = K.pathLen(P);
    let pts = [];
    if (byLen) { const d = need(await E.getDist("Specify length of segment:")); if (d <= 0) return; const sp = K.pathParam(P, pick.p) > P.prims.length / 2; for (let x = d; x < L - 1e-9; x += d) pts.push(K.pathPoint(P, K.pathAtLen(P, sp ? L - x : x))); }
    else { const n = need(await E.getNum("Enter the number of segments:", { int: true, min: 2 })); if (n < 2) return; for (let i = 1; i < (P.closed ? n + 1 : n); i++) { if (P.closed && i === n) break; pts.push(K.pathPoint(P, K.pathAtLen(P, (L * i) / n))); } if (P.closed) pts.unshift(K.pathPoint(P, 0)); }
    E.tx(byLen ? "measure" : "divide", () => { for (const p of pts) E.add({ t: "point", p }); });
    E.msg(`${pts.length} point(s) placed. Set the point style with PTYPE if they are not visible.`);
  };
  cmd("DIVIDE", { a: ["DIV"], d: "Place points dividing an object into equal parts", fn: (E) => placeAlong(E, false) });
  cmd("MEASURE", { a: ["ME"], d: "Place points at a set distance along an object", fn: (E) => placeAlong(E, true) });

  /* =============================== TEXT =============================== */
  const JUST = { Left: [0, 0], Center: [1, 0], Right: [2, 0], Middle: [1, 2], TL: [0, 3], TC: [1, 3], TR: [2, 3], ML: [0, 2], MC: [1, 2], MR: [2, 2], BL: [0, 1], BC: [1, 1], BR: [2, 1] };
  K.sym = (s) => String(s).replace(/%%[cC]/g, "Ø").replace(/%%[dD]/g, "°").replace(/%%[pP]/g, "±");
  cmd("TEXT", { a: ["DT", "DTEXT"], d: "Single-line text", fn: async (E) => {
    const M = mem(E); let j = M.just || "Left";
    let p;
    for (;;) { p = await E.getPoint(pr("Specify start point of text", ["Justify"]) + ` (justify: ${j})`, { kws: ["Justify"] }); if (p == null) return; if (p.kw === "Justify") { const k = await E.getKw(pr("Enter an option", Object.keys(JUST)), Object.keys(JUST)); if (k && k.kw) j = M.just = k.kw; continue; } break; }
    const h = await E.getDist(pr("Specify height", [], f(E.doc.text.h, E)), { base: p, dflt: E.doc.text.h }); if (h == null) return; E.doc.text.h = +h;
    const rot = await E.getAngle(pr("Specify rotation angle of text", [], K.fmt(M.txtRot / D2R, 0)), { base: p, dflt: M.txtRot / D2R }); if (rot == null) return; M.txtRot = typeof rot === "number" ? rot : 0;
    E.begin("text"); let q = p; const [ha, va] = JUST[j];
    for (;;) {
      const s = await E.getText("Enter text (Enter on an empty line to finish):", { preview: () => [], base: null }); if (!s) break;
      E.add({ t: "text", p: q, h: +h, s: K.sym(s), rot: M.txtRot, ha, va }); q = G.add(q, G.rotp([0, -1.667 * h], [0, 0], M.txtRot));
    }
  } });
  const mtextDlg = (E, init) => E.dialog(init.id ? "Edit multiline text" : "Multiline text", `
    <div class="cx-frm"><label>Text height<input id="mh" type="number" step="any" min="0" value="${init.h}"></label><label>Width (0 = no wrap)<input id="mw" type="number" step="any" min="0" value="${init.w || 0}"></label>
    <label>Justify<select id="ma">${["Top left", "Top centre", "Top right", "Middle left", "Middle centre", "Middle right", "Bottom left", "Bottom centre", "Bottom right"].map((n, i) => `<option value="${i + 1}"${i + 1 === (init.ap || 1) ? " selected" : ""}>${n}</option>`).join("")}</select></label></div>
    <label>Text<textarea id="ms" rows="7" style="width:100%">${K.esc(init.s || "")}</textarea></label>
    <div class="cx-syms">Insert: ${["Ø", "°", "±", "≈", "≠", "²", "³", "µ", "⌀", "▽"].map((c) => `<button type="button" data-sym="${c}">${c}</button>`).join("")}</div>`,
    (b) => { const s = b.querySelector("#ms").value; if (!s.trim()) throw new Error("Type some text."); return { s, h: +b.querySelector("#mh").value || init.h, w: +b.querySelector("#mw").value || 0, ap: +b.querySelector("#ma").value }; },
    { init: (b) => b.querySelectorAll("[data-sym]").forEach((x) => (x.onclick = () => { const t = b.querySelector("#ms"), i = t.selectionStart; t.value = t.value.slice(0, i) + x.dataset.sym + t.value.slice(t.selectionEnd); t.focus(); t.selectionStart = t.selectionEnd = i + 1; })) });
  cmd("MTEXT", { a: ["MT", "T"], d: "Multiline text in a box (word-wrapped paragraph)", fn: async (E) => {
    const a = need(await E.getPoint("Specify first corner:")); if (!isP(a)) return;
    const b = need(await E.getPoint("Specify opposite corner:", { base: a, noRubber: true, preview: (q) => [{ t: "pline", closed: true, pts: [[a[0], a[1]], [q[0], a[1]], [q[0], q[1]], [a[0], q[1]]] }] })); if (!isP(b)) return;
    const r = await mtextDlg(E, { h: E.doc.text.h, w: Math.abs(b[0] - a[0]), ap: 1 }); if (!r) return;
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]), y0 = Math.min(a[1], b[1]), col = (r.ap - 1) % 3, row = Math.floor((r.ap - 1) / 3);
    E.add({ t: "mtext", p: [col === 0 ? x0 : col === 1 ? (x0 + x1) / 2 : x1, row === 0 ? y1 : row === 1 ? (y0 + y1) / 2 : y0], h: r.h, s: r.s, w: r.w, ap: r.ap, rot: 0 });
  } });
  cmd("TEXTEDIT", { a: ["ED", "DDEDIT"], d: "Edit text, multiline text, dimension text or leader text", fn: async (E, args) => {
    let e = args && args.id ? E.byId(args.id) : null;
    if (!e) { const v = need(await E.getEnt("Select an annotation object:", { filter: (x) => ["text", "mtext", "dim", "leader"].includes(x.t) })); e = v.e; }
    if (e.t === "mtext" || e.t === "leader") { const r = await mtextDlg(E, { id: e.id, s: e.s, h: e.h || E.doc.dim.th, w: e.w, ap: e.ap }); if (!r) return; E.replace(e.id, Object.assign({}, e, e.t === "mtext" ? r : { s: r.s, h: r.h })); return; }
    if (e.t === "text") { const r = await E.dialog("Edit text", `<label>Text<input id="ts" value="${K.esc(e.s)}"></label><label>Height<input id="th" type="number" step="any" value="${e.h}"></label>`, (b) => ({ s: b.querySelector("#ts").value, h: +b.querySelector("#th").value || e.h })); if (r && r.s) E.replace(e.id, Object.assign({}, e, { s: K.sym(r.s), h: r.h })); return; }
    const meas = K.dimText(Object.assign({}, e, { txt: null }), E.doc);
    const r = await E.dialog("Edit dimension text", `<p class="cx-note">Measured value: <b>${K.esc(meas)}</b>. Use &lt;&gt; for the measured value, e.g. <code>4x &lt;&gt; THRU</code> or <code>&lt;&gt; ±0.05</code>. Leave empty to show the measured value.</p><label>Dimension text<input id="dt" value="${K.esc(e.txt || "")}"></label>`, (b) => ({ t: b.querySelector("#dt").value }));
    if (r) E.replace(e.id, Object.assign({}, e, { txt: r.t ? K.sym(r.t) : null }));
  } });

  /* =============================== DIMENSIONS =============================== */
  const linDir = (p1, p2, q) => { const m = G.mid(p1, p2), dx = Math.abs(p2[0] - p1[0]), dy = Math.abs(p2[1] - p1[1]); return Math.abs(q[1] - m[1]) - dy / 2 > Math.abs(q[0] - m[0]) - dx / 2 ? "h" : "v"; };
  const dimOrigins = async (E) => {
    const v = await E.getPoint(pr("Specify first extension line origin or <select object>")); if (v == null) {
      const s = need(await E.getEnt("Select object to dimension:", { filter: (e) => ["line", "arc", "pline", "circle"].includes(e.t) }));
      const P = K.path(s.e), i = Math.min(P.prims.length - 1, Math.floor(K.pathParam(P, s.p))), pr0 = P.prims[i];
      if (s.e.t === "circle") { const c = s.e.c; return [G.sub(c, [s.e.r, 0]), G.add(c, [s.e.r, 0])]; }
      return [K.pAt(pr0, 0), K.pAt(pr0, 1)];
    }
    if (!isP(v)) return null; const p2 = need(await E.getPoint("Specify second extension line origin:", { base: v })); if (!isP(p2)) return null; return [v, p2];
  };
  const dimLoc = async (E, base) => {
    let txt = null, dir = base.kind === "lin" ? null : undefined, rot = 0;
    for (;;) {
      const kws = base.kind === "lin" ? ["Text", "Horizontal", "Vertical", "Rotated"] : ["Text"];
      const mk = (q) => Object.assign({ t: "dim", layer: dimLayer(E) }, base, { loc: q, txt, dir: base.kind === "lin" ? dir || linDir(base.p1, base.p2, q) : undefined, rot });
      const q = await E.getPoint(pr("Specify dimension line location", kws), { kws, preview: (p) => [mk(p)] }); if (q == null) return null;
      if (q.kw === "Text") { const t = await E.getText("Enter dimension text (<> = measured value):", { dflt: "<>" }); if (t != null) txt = t === "<>" ? null : K.sym(t); continue; }
      if (q.kw === "Horizontal") { dir = "h"; continue; } if (q.kw === "Vertical") { dir = "v"; continue; }
      if (q.kw === "Rotated") { const a = await E.getAngle("Specify angle of dimension line:", {}); if (typeof a === "number") { dir = "r"; rot = a; } continue; }
      const e = E.add(mk(q)); E.lastDim = e.id; E.msg("Dimension text = " + K.dimText(e, E.doc)); return e;
    }
  };
  const dimLayer = (E) => (E.doc.layers.find((l) => l.name === "Dimensions") && E.cur.layer === "0" ? "Dimensions" : E.cur.layer);
  cmd("DIMLINEAR", { a: ["DLI", "DIMLIN"], d: "Horizontal or vertical (or rotated) linear dimension", fn: async (E) => { const o = await dimOrigins(E); if (!o) return; await dimLoc(E, { kind: "lin", p1: o[0], p2: o[1] }); } });
  cmd("DIMALIGNED", { a: ["DAL", "DIMALI"], d: "Dimension aligned with the measured points", fn: async (E) => { const o = await dimOrigins(E); if (!o) return; await dimLoc(E, { kind: "ali", p1: o[0], p2: o[1] }); } });
  const dimCircle = async (E, kind) => {
    const s = need(await E.getEnt("Select arc or circle:", { filter: (e) => e.t === "circle" || e.t === "arc" || (e.t === "pline" && e.pts.some((p) => p[2])) }));
    let c = s.e.c, r = s.e.r; if (s.e.t === "pline") { const P = K.path(s.e), pr0 = P.prims[Math.min(P.prims.length - 1, Math.floor(K.pathParam(P, s.p)))]; if (pr0.k !== "a") return E.err("Pick an arc segment of the polyline."); c = pr0.c; r = pr0.r; }
    let txt = null;
    for (;;) {
      const mk = (q) => ({ t: "dim", kind, c, r, loc: q, txt, layer: dimLayer(E) });
      const q = await E.getPoint(pr("Specify dimension line location", ["Text"]), { kws: ["Text"], preview: (p) => [mk(p)] }); if (q == null) return;
      if (q.kw === "Text") { const t = await E.getText("Enter dimension text (<> = measured value):", { dflt: "<>" }); if (t != null) txt = t === "<>" ? null : K.sym(t); continue; }
      const e = E.add(mk(q)); E.msg("Dimension text = " + K.dimText(e, E.doc)); return;
    }
  };
  cmd("DIMRADIUS", { a: ["DRA", "DIMRAD"], d: "Radius dimension of an arc or circle", fn: (E) => dimCircle(E, "rad") });
  cmd("DIMDIAMETER", { a: ["DDI", "DIMDIA"], d: "Diameter dimension of a circle or arc", fn: (E) => dimCircle(E, "dia") });
  cmd("DIMANGULAR", { a: ["DAN", "DIMANG"], d: "Angle between two lines, of an arc, or by three points", fn: async (E) => {
    const s = await E.getEnt("Select arc, circle, line, or <specify vertex>:", { filter: (e) => ["line", "arc", "circle", "pline"].includes(e.t) });
    let c, p1, p2;
    if (s == null) { c = need(await E.getPoint("Specify angle vertex:")); p1 = need(await E.getPoint("Specify first angle endpoint:", { base: c })); p2 = need(await E.getPoint("Specify second angle endpoint:", { base: c })); }
    else if (s.e.t === "arc") { c = s.e.c; p1 = G.polar(c, s.e.a0, s.e.r); p2 = G.polar(c, s.e.a1, s.e.r); }
    else if (s.e.t === "circle") { c = s.e.c; p1 = G.closest(s.p, G.prims(s.e)[0]); p2 = need(await E.getPoint("Specify second angle endpoint:", { base: c })); }
    else {
      const segOf = (x) => { const P = K.path(x.e); const pr0 = P.prims[Math.min(P.prims.length - 1, Math.floor(K.pathParam(P, x.p)))]; return pr0.k === "s" ? pr0 : null; };
      const L1 = segOf(s); if (!L1) return E.err("Pick a straight segment.");
      const s2 = need(await E.getEnt("Select second line:", { filter: (e) => e.t === "line" || e.t === "pline" })), L2 = segOf(s2); if (!L2) return E.err("Pick a straight segment.");
      const X = G.ixSS(L1, L2, true, true)[0]; if (!X) return E.err("The lines are parallel.");
      const side = (L, p) => { const q = G.closestSeg(p, L.a, L.b); return G.dist(q, X) > 1e-9 ? q : G.dist(L.a, X) > G.dist(L.b, X) ? L.a : L.b; };
      c = X; p1 = side(L1, s.p); p2 = side(L2, s2.p);
    }
    let txt = null;
    for (;;) {
      const mk = (q) => ({ t: "dim", kind: "ang", c, p1, p2, loc: q, txt, layer: dimLayer(E) });
      const q = await E.getPoint(pr("Specify dimension arc line location", ["Text"]), { kws: ["Text"], preview: (p) => [mk(p)] }); if (q == null) return;
      if (q.kw === "Text") { const t = await E.getText("Enter dimension text:", { dflt: "<>" }); if (t != null) txt = t === "<>" ? null : K.sym(t); continue; }
      const e = E.add(mk(q)); E.msg("Dimension text = " + K.dimText(e, E.doc)); return;
    }
  } });
  const dimChain = async (E, baseline) => {
    let d = E.lastDim && E.byId(E.lastDim);
    if (!d || !(d.kind === "lin" || d.kind === "ali")) { const s = need(await E.getEnt("Select a linear dimension to continue from:", { filter: (e) => e.t === "dim" && (e.kind === "lin" || e.kind === "ali") })); d = s.e; }
    E.begin(baseline ? "baseline" : "continue");
    const u = K.dimDir(d), n = [-u[1], u[0]], off = G.dot(G.sub(d.loc, d.p1), n) >= 0 ? 1 : -1, step = (E.doc.dim.dli || 7) * (E.doc.dim.scale || 1);
    let prev = d;
    for (;;) {
      const mk = (q) => { const p1 = baseline ? d.p1 : prev.p2; const loc = baseline ? G.add(prev.loc, G.mul(n, step * off)) : prev.loc; return Object.assign({}, d, { id: undefined, p1, p2: q, loc, txt: null, tp: undefined }); };
      const q = await E.getPoint(pr("Specify a second extension line origin", ["Undo"]), { kws: ["Undo"], preview: (p) => [mk(p)] }); if (q == null) break;
      if (q.kw === "Undo") { if (prev !== d) { E.remove([prev.id]); prev = d; } continue; }
      const e = E.add(mk(q)); E.msg("Dimension text = " + K.dimText(e, E.doc)); prev = e; E.lastDim = e.id;
    }
  };
  cmd("DIMCONTINUE", { a: ["DCO", "DIMCONT"], d: "Chain dimensions from the last linear dimension", fn: (E) => dimChain(E, false) });
  cmd("DIMBASELINE", { a: ["DBA", "DIMBASE"], d: "Baseline dimensions from the first origin of the last dimension", fn: (E) => dimChain(E, true) });
  cmd("DIMORDINATE", { a: ["DOR", "DIMORD"], d: "Ordinate (X or Y datum) dimension", fn: async (E) => {
    const p = need(await E.getPoint("Specify feature location:")); if (!isP(p)) return;
    const mk = (q) => ({ t: "dim", kind: "ord", p1: p, loc: q, dir: Math.abs(q[0] - p[0]) < Math.abs(q[1] - p[1]) ? "x" : "y", o: E.ucsO || [0, 0], layer: dimLayer(E) });
    const q = need(await E.getPoint("Specify leader endpoint location:", { base: p, preview: (x) => [mk(x)] })); if (isP(q)) { const e = E.add(mk(q)); E.msg("Dimension text = " + K.dimText(e, E.doc)); }
  } });
  cmd("QLEADER", { a: ["LE", "LEADER", "MLEADER", "MLD"], d: "Leader with an arrow and a note", fn: async (E) => {
    const pts = [need(await E.getPoint("Specify leader arrowhead location:"))]; if (!isP(pts[0])) return;
    for (;;) { const v = await E.getPoint(pr("Specify next point", [], pts.length > 1 ? "text" : null), { base: pts[pts.length - 1], preview: (q) => [{ t: "leader", pts: pts.concat([q]), s: "" }] }); if (!isP(v)) break; pts.push(v); if (pts.length >= 3) break; }
    if (pts.length < 2) return;
    const lines = []; for (;;) { const s = await E.getText(lines.length ? "Enter next line of annotation text <finish>:" : "Enter first line of annotation text <none>:"); if (!s) break; lines.push(K.sym(s)); }
    E.add({ t: "leader", pts, s: lines.join("\n"), h: E.doc.dim.th * (E.doc.dim.scale || 1), layer: dimLayer(E) });
  } });

  /* =============================== HATCH (boundary detection) =============================== */
  K.findRegion = (E, p) => {
    const V = E.view, w0 = E.s2w([0, V.H]), w1 = E.s2w([V.W, 0]), diag = G.dist(w0, w1), prims = [];
    const flat = (e) => {
      if (["text", "mtext", "dim", "leader", "hatch", "point"].includes(e.t)) return;
      if (e.t === "insert") { for (const w of K.expand(e, E.doc)) flat(w); return; }
      if (e.t === "xline") { prims.push({ k: "s", a: e.ray ? e.p : G.add(e.p, G.mul(e.dir, -diag * 4)), b: G.add(e.p, G.mul(e.dir, diag * 4)) }); return; }
      for (const pr0 of G.prims(e)) if (pr0.k === "a" || G.dist(pr0.a, pr0.b) > 1e-12) prims.push(pr0);
    };
    for (const e of E.doc.ents) { if (!E.visible(e)) continue; const b = K.bbox(e, E.doc); if (b && (b.x1 < w0[0] || b.x0 > w1[0] || b.y1 < w0[1] || b.y0 > w1[1])) continue; flat(e); }
    if (prims.length > 30000) throw new Error("Too many objects on screen to find the boundary — zoom in closer to the area.");
    // exact intersections between the true lines / arcs (grid of bounding boxes)
    const cell = Math.max(diag / 40, 1e-9), grid = new Map(), cuts = prims.map(() => []), big = [];
    prims.forEach((q, k) => { const b = G.primBounds(q), i0 = Math.floor(b.x0 / cell), i1 = Math.floor(b.x1 / cell), j0 = Math.floor(b.y0 / cell), j1 = Math.floor(b.y1 / cell); if ((i1 - i0 + 1) * (j1 - j0 + 1) > 3000) { big.push(k); return; } for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const kk = i * 1000003 + j; let a = grid.get(kk); if (!a) grid.set(kk, (a = [])); a.push(k); } });
    const seen = new Set(), test = (a, b) => { if (a === b) return; const pk = a < b ? a * 1e6 + b : b * 1e6 + a; if (seen.has(pk)) return; seen.add(pk); for (const x of G.ix(prims[a], prims[b], false, false)) { cuts[a].push(x); cuts[b].push(x); } };
    for (const arr of grid.values()) for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) test(arr[i], arr[j]);
    for (const a of big) for (let b = 0; b < prims.length; b++) test(a, b);
    // flatten: lines split at the cut points, arcs sampled between the cut angles (cut points stay exact)
    const segs = [], atol = Math.max(diag * 2e-5, 1e-9);
    prims.forEach((q, k) => {
      if (q.k === "s") { const d = G.sub(q.b, q.a), l2 = G.dot(d, d) || 1, ts = [0, 1].concat(cuts[k].map((x) => G.dot(G.sub(x, q.a), d) / l2)).map((t) => Math.max(0, Math.min(1, t))).sort((u, v) => u - v); for (let i = 0; i < ts.length - 1; i++) if (ts[i + 1] - ts[i] > 1e-12) segs.push([G.lerp(q.a, q.b, ts[i]), G.lerp(q.a, q.b, ts[i + 1])]); return; }
      const a0 = q.full ? 0 : q.a0, sw = q.full ? G.TAU : G.sweep(q.a0, q.a1), fs = [0, 1].concat(cuts[k].map((x) => G.norm(G.ang(q.c, x) - a0) / sw).filter((f2) => f2 >= 0 && f2 <= 1)).sort((u, v) => u - v);
      for (let i = 0; i < fs.length - 1; i++) {
        if (fs[i + 1] - fs[i] < 1e-12) continue;
        const s0 = a0 + sw * fs[i], s1 = a0 + sw * fs[i + 1], pts = G.arcPoints(q.c, q.r, s0, s1, Math.max(q.r * 0.0015, atol));
        const first = i === 0 ? G.polar(q.c, s0, q.r) : cuts[k].reduce((m, x) => (G.dist(x, G.polar(q.c, s0, q.r)) < G.dist(m, G.polar(q.c, s0, q.r)) ? x : m), G.polar(q.c, s0, q.r));
        const last = cuts[k].reduce((m, x) => (G.dist(x, G.polar(q.c, s1, q.r)) < G.dist(m, G.polar(q.c, s1, q.r)) ? x : m), G.polar(q.c, s1, q.r));
        pts[0] = first; pts[pts.length - 1] = last;
        for (let j = 0; j < pts.length - 1; j++) segs.push([pts[j], pts[j + 1]]);
      }
    });
    const cutsT = segs.map(() => [0, 1]);
    // vertices
    const tol = diag * 1e-7 + 1e-9, vmap = new Map(), verts = [], vk = (x, y) => Math.round(x / tol) + "_" + Math.round(y / tol);
    const vid = (p) => { const k = vk(p[0], p[1]); let i = vmap.get(k); if (i == null) { const gx = Math.round(p[0] / tol), gy = Math.round(p[1] / tol); for (let dx = -1; dx <= 1 && i == null; dx++) for (let dy = -1; dy <= 1 && i == null; dy++) { const j = vmap.get(gx + dx + "_" + (gy + dy)); if (j != null) i = j; } if (i == null) { i = verts.length; verts.push(p); } vmap.set(k, i); } return i; };
    const adj = new Map(), addE = (a, b) => { if (a === b) return; (adj.get(a) || adj.set(a, new Set()).get(a)).add(b); (adj.get(b) || adj.set(b, new Set()).get(b)).add(a); };
    segs.forEach((s, k) => { const c = cutsT[k]; let prev = vid(G.lerp(s[0], s[1], c[0])); for (let i = 1; i < c.length; i++) { const v = vid(G.lerp(s[0], s[1], c[i])); addE(prev, v); prev = v; } });
    // prune dangling edges
    let again = true; while (again) { again = false; for (const [v, set] of adj) { if (set.size < 2) { for (const w of set) adj.get(w) && adj.get(w).delete(v); adj.delete(v); again = true; } } }
    const out = new Map(); for (const [v, set] of adj) out.set(v, Array.from(set).sort((a, b) => G.ang(verts[v], verts[a]) - G.ang(verts[v], verts[b])));
    const used = new Set(), faces = [];
    for (const [u, list] of out) for (const v of list) {
      if (used.has(u + ">" + v)) continue;
      const loop = []; let a = u, b = v, guard = 0;
      while (!used.has(a + ">" + b) && guard++ < 200000) {
        used.add(a + ">" + b); loop.push(a);
        const L = out.get(b); if (!L) break; const k = L.indexOf(a); const c = L[(k - 1 + L.length) % L.length]; a = b; b = c;
      }
      if (loop.length > 2) { const pts = loop.map((i) => verts[i]); faces.push({ pts, area: G.area(pts) }); }
    }
    const inside = faces.filter((fc) => fc.area > 1e-12 && G.inPoly(p, fc.pts)).sort((a, b) => a.area - b.area);
    if (!inside.length) return null;
    const outer = inside[0], loops = [outer.pts];
    for (const fc of faces) { if (fc.area >= 0 || -fc.area >= outer.area - 1e-9) continue; if (!G.inPoly(fc.pts[0], outer.pts) || !G.inPoly(fc.pts[Math.floor(fc.pts.length / 2)], outer.pts)) continue; if (G.inPoly(p, fc.pts)) continue; loops.push(fc.pts); }
    return loops;
  };
  const patDlg = (E) => { const M = mem(E).hatch; return E.dialog("Hatch pattern", `<div class="cx-pats">${Object.entries(K.PAT).map(([n, d]) => `<button type="button" data-pat="${n}" class="${n === M.pat ? "on" : ""}">${patSwatch(n)}<b>${n}</b><span>${d.d}</span></button>`).join("")}</div><div class="cx-frm"><label>Scale<input id="hs" type="number" step="any" min="0" value="${M.sc}"></label><label>Angle (°)<input id="ha" type="number" step="any" value="${M.ang}"></label></div>`, (b) => { const on = b.querySelector("[data-pat].on"); M.pat = on ? on.dataset.pat : M.pat; M.sc = +b.querySelector("#hs").value || 1; M.ang = +b.querySelector("#ha").value || 0; return M; }, { init: (b) => b.querySelectorAll("[data-pat]").forEach((x) => (x.onclick = () => { b.querySelectorAll("[data-pat]").forEach((y) => y.classList.remove("on")); x.classList.add("on"); })) }); };
  const patSwatch = (n) => { const e = { t: "hatch", loops: [[[0, 0], [16, 0], [16, 16], [0, 16]]], pat: n, solid: n === "SOLID", sc: 0.6, ang: 0, layer: "0", color: "#64748b" }; const d = K.newDoc(false); d.ents = [e]; return K.toSVG(d, { box: { x0: 0, y0: 0, x1: 16, y1: 16 }, widthMm: 16, heightMm: 16 }).replace(/width="16mm" height="16mm"/, 'width="40" height="40"'); };
  cmd("HATCH", { a: ["H", "BH", "BHATCH"], d: "Fill a closed area with a hatch pattern or solid fill", fn: async (E) => {
    const M = mem(E).hatch; E.begin("hatch"); let n = 0;
    for (;;) {
      const v = await E.getPoint(pr("Pick internal point", ["Select objects", "Pattern", "sCale", "Angle"]) + ` (${M.pat}, scale ${M.sc}, ${M.ang}°)`, { kws: ["Select objects", "Pattern", "sCale", "Angle"] });
      if (v == null) break;
      if (v.kw === "Pattern") { await patDlg(E); continue; }
      if (v.kw === "sCale") { const s = await E.getNum("Specify hatch pattern scale", { dflt: M.sc, positive: true }); if (typeof s === "number") M.sc = s; continue; }
      if (v.kw === "Angle") { const a = await E.getNum("Specify hatch pattern angle", { dflt: M.ang }); if (typeof a === "number") M.ang = a; continue; }
      let loops;
      if (v.kw === "Select objects") { const ids = await E.getSel("Select closed objects (circles, closed polylines, ellipses):", { fresh: true }); loops = ids.map((id) => G.outline(E.byId(id), 0.02)).filter(Boolean); if (!loops.length) { E.err("None of the selected objects is closed."); continue; } }
      else { E.msg("Analysing the boundary…", "mu"); loops = K.findRegion(E, v); if (!loops) { E.err("No closed boundary found around that point. Close the gaps (or use Select objects)."); continue; } }
      E.add({ t: "hatch", loops, pat: M.pat, solid: M.pat === "SOLID", sc: M.sc, ang: M.ang * D2R, layer: E.doc.layers.find((l) => l.name === "Hatch") && E.cur.layer === "0" ? "Hatch" : E.cur.layer }); n++;
    }
    if (n) E.msg(n + " hatch area(s) created.");
  } });
  cmd("BOUNDARY", { a: ["BO", "BPOLY"], d: "Closed polyline around a picked area", fn: async (E) => { E.begin("boundary"); for (;;) { const v = await E.getPoint("Pick internal point:"); if (!isP(v)) break; const L = K.findRegion(E, v); if (!L) { E.err("No closed boundary found."); continue; } for (const l of L) E.add({ t: "pline", closed: true, pts: l.map((p) => [p[0], p[1], 0]) }); E.msg(L.length + " polyline(s) created."); } } });

  /* =============================== MODIFY =============================== */
  const preview = (ids, E, m) => ids.slice(0, 600).map((id) => { const e = E.byId(id); return e ? K.xform(e, m) : null; }).filter(Boolean);
  const applyXf = (E, ids, m, copy) => { for (const id of ids) { const e = E.byId(id); if (!e) continue; const n = K.xform(e, m); if (copy) E.add(Object.assign(n, { id: undefined }), true); else E.replace(id, n); } };
  const selOrStop = async (E, msg) => { const ids = await E.getSel(msg || "Select objects:"); if (!ids.length) { E.msg("Nothing selected."); return null; } return ids; };
  cmd("MOVE", { a: ["M"], d: "Move objects", fn: async (E) => {
    const ids = await selOrStop(E); if (!ids) return;
    const b = await E.getPoint(pr("Specify base point", ["Displacement"], "Displacement"), { kws: ["Displacement"] });
    let d;
    if (b == null || b.kw) { const v = need(await E.getPoint("Specify displacement <0,0>:", { preview: (q) => preview(ids, E, K.M.move(q[0], q[1])) })); d = v; }
    else { const q = await E.getPoint("Specify second point or <use first point as displacement>:", { base: b, preview: (q2) => preview(ids, E, K.M.move(q2[0] - b[0], q2[1] - b[1])) }); d = q == null ? b : G.sub(q, b); }
    if (!isP(d)) return; E.tx("move", () => applyXf(E, ids, K.M.move(d[0], d[1])));
  } });
  cmd("COPY", { a: ["CO", "CP"], d: "Copy objects (multiple placements, linear array)", fn: async (E) => {
    const ids = await selOrStop(E); if (!ids) return;
    const b = await E.getPoint(pr("Specify base point", ["Displacement"], "Displacement"), { kws: ["Displacement"] });
    if (b == null || b.kw) { const v = need(await E.getPoint("Specify displacement:")); E.tx("copy", () => applyXf(E, ids, K.M.move(v[0], v[1]), true)); return; }
    E.begin("copy"); const made = [];
    for (;;) {
      const q = await E.getPoint(pr("Specify second point", ["Array", "Undo", "eXit"], "exit"), { base: b, kws: ["Array", "Undo", "eXit"], preview: (q2) => preview(ids, E, K.M.move(q2[0] - b[0], q2[1] - b[1])) });
      if (q == null || q.kw === "eXit") break;
      if (q.kw === "Undo") { const last = made.pop(); if (last) E.remove(last); continue; }
      if (q.kw === "Array") { const n = need(await E.getNum("Enter number of items to array:", { int: true, min: 2 })); const q2 = need(await E.getPoint("Specify second point (spacing):", { base: b, preview: (p) => { const out = []; for (let i = 1; i < n; i++) out.push(...preview(ids, E, K.M.move((p[0] - b[0]) * i, (p[1] - b[1]) * i))); return out; } })); const before = E.doc.ents.length; for (let i = 1; i < n; i++) applyXf(E, ids, K.M.move((q2[0] - b[0]) * i, (q2[1] - b[1]) * i), true); made.push(E.doc.ents.slice(before).map((e) => e.id)); continue; }
      const before = E.doc.ents.length; applyXf(E, ids, K.M.move(q[0] - b[0], q[1] - b[1]), true); made.push(E.doc.ents.slice(before).map((e) => e.id));
    }
  } });
  cmd("ROTATE", { a: ["RO"], d: "Rotate objects about a base point", fn: async (E) => {
    const ids = await selOrStop(E); if (!ids) return;
    const b = need(await E.getPoint("Specify base point:")); if (!isP(b)) return; let copy = false, ref = 0;
    for (;;) {
      const a = await E.getAngle(pr("Specify rotation angle", ["Copy", "Reference"], 0), { base: b, kws: ["Copy", "Reference"], dflt: 0, preview: (q) => preview(ids, E, K.M.rot(b, G.ang(b, q) - ref)) });
      if (a == null) return;
      if (a.kw === "Copy") { copy = true; E.msg("Rotating a copy of the selected objects."); continue; }
      if (a.kw === "Reference") { const r0 = need(await E.getAngle("Specify the reference angle <0>:", { dflt: 0 })); ref = r0; const n = need(await E.getAngle("Specify the new angle:", { base: b, preview: (q) => preview(ids, E, K.M.rot(b, G.ang(b, q) - ref)) })); E.tx("rotate", () => applyXf(E, ids, K.M.rot(b, n - ref), copy)); return; }
      E.tx("rotate", () => applyXf(E, ids, K.M.rot(b, a), copy)); return;
    }
  } });
  cmd("SCALE", { a: ["SC"], d: "Scale objects about a base point", fn: async (E) => {
    const ids = await selOrStop(E); if (!ids) return;
    const b = need(await E.getPoint("Specify base point:")); if (!isP(b)) return; let copy = false;
    for (;;) {
      const k = await E.getDist(pr("Specify scale factor", ["Copy", "Reference"], 1), { base: b, kws: ["Copy", "Reference"], dflt: 1, preview: (q) => preview(ids, E, K.M.scale(b, Math.max(1e-6, G.dist(b, q)))) });
      if (k == null) return;
      if (k.kw === "Copy") { copy = true; continue; }
      if (k.kw === "Reference") { const r = need(await E.getDist("Specify reference length <1>:", { dflt: 1 })); const n = need(await E.getDist("Specify new length:", { base: b, preview: (q) => preview(ids, E, K.M.scale(b, G.dist(b, q) / r)) })); E.tx("scale", () => applyXf(E, ids, K.M.scale(b, n / r), copy)); return; }
      if (!(k > 0)) return E.err("The scale factor must be more than zero.");
      E.tx("scale", () => applyXf(E, ids, K.M.scale(b, k), copy)); return;
    }
  } });
  cmd("MIRROR", { a: ["MI"], d: "Mirror objects about a line", fn: async (E) => {
    const ids = await selOrStop(E); if (!ids) return;
    const a = need(await E.getPoint("Specify first point of mirror line:")); const b = need(await E.getPoint("Specify second point of mirror line:", { base: a, preview: (q) => (G.dist(a, q) > 1e-9 ? preview(ids, E, K.M.mirror(a, q)) : []) }));
    if (!isP(a) || !isP(b) || G.dist(a, b) < 1e-12) return;
    const er = await E.getKw(pr("Erase source objects?", ["Yes", "No"], "No"), ["Yes", "No"], "No"); if (er === undefined) return;
    E.tx("mirror", () => applyXf(E, ids, K.M.mirror(a, b), !(er && er.kw === "Yes")));
  } });
  cmd("ERASE", { a: ["E", "DEL"], d: "Erase (delete) objects", fn: async (E) => { const ids = await selOrStop(E); if (!ids) return; E.tx("erase", () => E.remove(ids)); E.msg(ids.length + " object(s) erased."); } });
  cmd("EXPLODE", { a: ["X"], d: "Break blocks, polylines, dimensions, hatches into their parts", fn: async (E) => {
    const ids = await selOrStop(E); if (!ids) return; let n = 0, skip = 0;
    E.tx("explode", () => { for (const id of ids) { const e = E.byId(id); const parts = e && !e.xref ? K.explodeEnt(e, E.doc) : []; if (!parts.length) { skip++; continue; } E.remove([id]); for (const p of parts) E.add(p, true); n++; } });
    E.msg(`${n} object(s) exploded${skip ? `, ${skip} cannot be exploded` : ""}.`);
  } });

  /* ---- offset ---- */
  K.offsetEnt = (e, d, side) => {
    const P = (x) => Object.assign(K.props(e), x, { id: K.uid() });
    if (e.t === "line") { const o = G.offsetPrim({ k: "s", a: e.a, b: e.b }, d, side); return o && P({ t: "line", a: o.a, b: o.b }); }
    if (e.t === "xline") { const n = [-e.dir[1], e.dir[0]], sg = G.dot(G.sub(side, e.p), n) >= 0 ? 1 : -1; return P({ t: "xline", ray: e.ray, p: G.add(e.p, G.mul(n, d * sg)), dir: e.dir }); }
    if (e.t === "circle" || e.t === "arc") { const r = G.dist(side, e.c) < e.r ? e.r - d : e.r + d; if (r <= 1e-9) return null; return P(Object.assign({}, e, { r })); }
    if (e.t === "ellipse") { const inside = (() => { const l = G.rotp(side, e.c, -(e.rot || 0)); return ((l[0] - e.c[0]) / e.rx) ** 2 + ((l[1] - e.c[1]) / e.ry) ** 2 < 1; })(); if (inside && (e.rx <= d || e.ry <= d)) return null; return K.offsetEnt(K.toPline(e), d, side); }
    if (e.t === "spline") return K.offsetEnt(K.toPline(e), d, side);
    if (e.t !== "pline") return null;
    const path = K.path(e), prs = path.prims; if (!prs.length) return null;
    // side: left (+1) or right (−1) of the path direction at the nearest primitive
    const s = K.pathParam(path, side), i0 = Math.min(prs.length - 1, Math.floor(s)), q = K.pAt(prs[i0], s - i0);
    let tan; const pr0 = prs[i0]; if (pr0.k === "s") tan = G.unit(G.sub(pr0.b, pr0.a)); else { const a = G.ang(pr0.c, q) + (pr0.sw > 0 ? Math.PI / 2 : -Math.PI / 2); tan = [Math.cos(a), Math.sin(a)]; }
    const sg = G.cross(tan, G.sub(side, q)) >= 0 ? 1 : -1, dd = d * sg;
    const off = prs.map((p) => p.k === "s" ? (() => { const u = G.unit(G.sub(p.b, p.a)), n = [-u[1], u[0]]; return { k: "s", a: G.add(p.a, G.mul(n, dd)), b: G.add(p.b, G.mul(n, dd)) }; })() : Object.assign({}, p, { r: p.r - dd * Math.sign(p.sw) }));
    if (off.some((p) => p.k === "a" && p.r <= 1e-9)) return null;
    const full = (p) => (p.k === "s" ? p : { k: "a", c: p.c, r: p.r, a0: 0, a1: TAU, full: true });
    const joint = (A, B, orig) => { const xs = G.ix(full(A), full(B), true, true); if (!xs.length) return null; xs.sort((x, y) => G.dist(x, orig) - G.dist(y, orig)); return xs[0]; };
    const n = off.length, starts = off.map((p) => K.pAt(p, 0)), ends = off.map((p) => K.pAt(p, 1));
    for (let i = 0; i < (path.closed ? n : n - 1); i++) {
      const j = (i + 1) % n; if (G.dist(ends[i], starts[j]) < 1e-9) continue;
      const orig = K.pAt(prs[j], 0), x = joint(off[i], off[j], orig); if (x && G.dist(x, orig) < Math.abs(d) * 50 + 1e-6) { ends[i] = x; starts[j] = x; }
    }
    const pts = [];
    for (let i = 0; i < n; i++) {
      const p = off[i], a = starts[i], b = ends[i]; let bulge = 0;
      if (p.k === "a") { const sa = G.ang(p.c, a), ea = G.ang(p.c, b); const sw = p.sw > 0 ? G.norm(ea - sa) || TAU : -(G.norm(sa - ea) || TAU); bulge = Math.abs(sw) >= TAU - 1e-9 ? Math.tan(p.sw / 4) : Math.tan(sw / 4); }
      pts.push([a[0], a[1], bulge]);
      if (!path.closed && i === n - 1) pts.push([b[0], b[1], 0]);
      else { const j = (i + 1) % n; if (G.dist(b, starts[j]) > 1e-9) pts.push([b[0], b[1], 0]); }
    }
    return P({ t: "pline", pts, closed: !!path.closed, w: e.w });
  };
  cmd("OFFSET", { a: ["O"], d: "Parallel copy at a distance (lines, arcs, circles, polylines)", fn: async (E) => {
    const M = mem(E);
    let d = await E.getDist(pr("Specify offset distance", ["Through"], M.through ? "Through" : f(M.off, E)), { kws: ["Through"], dflt: M.through ? "T" : M.off });
    if (d == null) return; let through = false;
    if (d === "T" || (d && d.kw === "Through")) { through = true; M.through = true; } else { if (!(d > 0)) return E.err("The distance must be more than zero."); M.off = +d; M.through = false; }
    const ok = (e) => ["line", "circle", "arc", "pline", "ellipse", "spline", "xline"].includes(e.t);
    for (;;) {
      const s = await E.getEnt(pr("Select object to offset", ["Exit", "Undo"], "Exit"), { filter: ok, kws: ["Exit", "Undo"] }); if (s == null || s.kw === "Exit") return;
      if (s.kw === "Undo") { E.undo(); continue; }
      const q = await E.getPoint(through ? "Specify through point:" : pr("Specify point on side to offset", ["Exit"]), { kws: ["Exit"], preview: (p) => { const dist = through ? K.hitDist(s.e, p, E.doc) : M.off; const o = dist > 1e-9 && K.offsetEnt(s.e, dist, p); return o ? [o] : []; } });
      if (q == null || q.kw === "Exit") return;
      const dist = through ? K.hitDist(s.e, q, E.doc) : M.off, o = K.offsetEnt(s.e, dist, q);
      if (!o) { E.err("Cannot offset that object to that side by this distance."); continue; }
      E.tx("offset", () => E.add(o, true));
    }
  } });

  /* ---- trim / extend ---- */
  const boundaryPrims = (E, e, edges) => {
    const b = K.bbox(e, E.doc), out = [];
    for (const o of edges || E.doc.ents) {
      if (o.id === e.id || !E.visible(o) || o.t === "hatch") continue;
      const ob = K.bbox(o, E.doc); if (b && ob && (ob.x1 < b.x0 - 1e-9 || ob.x0 > b.x1 + 1e-9 || ob.y1 < b.y0 - 1e-9 || ob.y0 > b.y1 + 1e-9)) continue;
      out.push(...K.segs(o, E.doc));
    }
    return out;
  };
  K.trimAt = (E, e, p, edges) => {
    const P = K.path(e); if (!P) return { err: "This type of object cannot be trimmed." };
    const cuts = K.pathCuts(P, boundaryPrims(E, e, edges), e.t === "pline"), n = P.prims.length, sp = K.pathParam(P, p);
    const inner = cuts.filter((c) => (P.closed ? true : c > 1e-9 && c < n - 1e-9));
    if (!inner.length || (P.closed && inner.length < 2)) return { erase: true };
    let pieces = [];
    if (!P.closed) {
      const lo = inner.filter((c) => c < sp - 1e-12).pop(), hi = inner.find((c) => c > sp + 1e-12);
      if (lo != null) pieces.push(K.subPath(P, 0, lo)); if (hi != null) pieces.push(K.subPath(P, hi, n));
      if (lo == null && hi == null) return { erase: true };
    } else {
      let lo = inner.filter((c) => c < sp).pop(), hi = inner.find((c) => c > sp);
      if (lo == null) lo = inner[inner.length - 1]; if (hi == null) hi = inner[0];
      pieces.push(K.subPath(P, hi, lo));
    }
    return { ents: pieces.filter((x) => x.length && x.reduce((t, q) => t + K.pLen(q), 0) > 1e-9).map((x) => K.fromPrims(e, x, false)).filter(Boolean) };
  };
  K.extendAt = (E, e, p, edges) => {
    let src = e; if (e.t === "ellipse" || e.t === "spline") return { err: "Ellipses and splines cannot be extended here." };
    const P = K.path(src); if (!P || P.closed) return { err: "Closed objects cannot be extended." };
    const n = P.prims.length, atEnd = K.pathParam(P, p) > n / 2, others = boundaryPrims(E, { id: e.id }, edges).filter(Boolean);
    let pr0 = atEnd ? P.prims[n - 1] : P.prims[0];
    if (!atEnd) pr0 = pr0.k === "s" ? { k: "s", a: pr0.b, b: pr0.a } : { k: "a", c: pr0.c, r: pr0.r, sa: pr0.sa + pr0.sw, sw: -pr0.sw };
    let best = null, bd = Infinity;
    if (pr0.k === "s") { const ray = { k: "s", a: pr0.a, b: pr0.b }, L = G.dist(pr0.a, pr0.b); for (const o of others) for (const x of G.ix(ray, o, true, false)) { const t = K.pPar(pr0, x) * L; if (t > L + 1e-9 && t - L < bd) { bd = t - L; best = x; } } }
    else { const cir = { k: "a", c: pr0.c, r: pr0.r, a0: 0, a1: TAU, full: true }, endA = pr0.sa + pr0.sw; for (const o of others) for (const x of G.ix(cir, o, false, false)) { const a = G.ang(pr0.c, x), g = pr0.sw > 0 ? G.norm(a - endA) : G.norm(endA - a); if (g > 1e-9 && g < bd && Math.abs(pr0.sw) + g < TAU - 1e-6) { bd = g; best = x; } } }
    if (!best) return { err: "No boundary in that direction." };
    if (e.t === "line") return { ent: Object.assign({}, e, atEnd ? { b: best } : { a: best }) };
    if (e.t === "arc") { const a = G.ang(e.c, best); return { ent: Object.assign({}, e, atEnd ? { a1: a } : { a0: a }) }; }
    const pts = e.pts.map((q) => q.slice()), k = atEnd ? pts.length - 1 : 0;
    pts[k] = [best[0], best[1], pts[k][2] || 0];
    if (pr0.k === "a") { const seg = atEnd ? P.prims[n - 1] : P.prims[0], sw = seg.sw + (seg.sw > 0 ? bd : -bd); const vi = atEnd ? pts.length - 2 : 0; pts[vi][2] = Math.tan(sw / 4); }
    return { ent: Object.assign({}, e, { pts }) };
  };
  const trimExtend = async (E, extendFirst) => {
    let edges = null;
    E.msg(extendFirst ? "Extend: every object is a boundary. Click the end of the object to extend (Shift+click trims)." : "Trim: every object is a cutting edge. Click the part to remove (Shift+click extends).", "mu");
    for (;;) {
      const kws = ["cuTting edges", "Erase", "Undo"];
      const v = await E.getEnt(pr(extendFirst ? "Select object to extend or shift-select to trim" : "Select object to trim or shift-select to extend", kws), { kws, filter: (e) => !!K.path(e) || e.t === "xline" });
      if (v == null) return;
      if (v.kw === "Undo") { E.undo(); continue; }
      if (v.kw === "Erase") { const ids = await E.getSel("Select objects to erase:", { fresh: true }); if (ids.length) E.tx("erase", () => E.remove(ids)); continue; }
      if (v.kw === "cuTting edges") { const ids = await E.getSel("Select cutting edges (Enter = all objects):", { fresh: true }); edges = ids.length ? ids.map((id) => E.byId(id)).filter(Boolean) : null; E.msg(edges ? edges.length + " cutting edge(s)." : "All objects are cutting edges."); continue; }
      const ext = extendFirst !== !!(E.lastShift);
      if (v.e.t === "xline") { E.err("Construction lines cannot be trimmed here."); continue; }
      if (ext) { const r = K.extendAt(E, v.e, v.p, edges); if (r.err) { E.err(r.err); continue; } E.tx("extend", () => E.replace(v.e.id, r.ent)); }
      else { const r = K.trimAt(E, v.e, v.p, edges); if (r.err) { E.err(r.err); continue; } E.tx("trim", () => { E.remove([v.e.id]); if (!r.erase) for (const x of r.ents) E.add(x, true); }); }
    }
  };
  cmd("TRIM", { a: ["TR"], d: "Trim objects at their intersections (quick mode)", fn: (E) => trimExtend(E, false) });
  cmd("EXTEND", { a: ["EX"], d: "Extend objects to meet other objects", fn: (E) => trimExtend(E, true) });

  /* ---- fillet / chamfer ---- */
  const segAt = (s) => { const P = K.path(s.e); if (!P) return null; const i = Math.min(P.prims.length - 1, Math.floor(K.pathParam(P, s.p))); return { P, i, pr: P.prims[i] }; };
  const trimLineTo = (e, keepPick, t) => { const a = e.a, b = e.b, da = G.dot(G.sub(a, t), G.sub(keepPick, t)), db = G.dot(G.sub(b, t), G.sub(keepPick, t)); const keep = da > db ? a : b; return Object.assign({}, e, { a: keep, b: t }); };
  const filletPline = (E, e, r, chamfer, only) => {
    const P = e.pts, n = P.length, cl = !!e.closed, out = []; let k = 0;
    for (let i = 0; i < n; i++) {
      const hasPrev = cl || i > 0, hasNext = cl || i < n - 1, prev = P[(i - 1 + n) % n], cur = P[i], next = P[(i + 1) % n];
      if (!hasPrev || !hasNext || (prev[2] || 0) || (cur[2] || 0) || (only != null && i !== only)) { out.push(cur.slice()); continue; }
      const d1 = G.unit(G.sub(prev, cur)), d2 = G.unit(G.sub(next, cur)), ang = Math.acos(Math.max(-1, Math.min(1, G.dot(d1, d2))));
      if (ang < 1e-6 || Math.abs(ang - Math.PI) < 1e-6) { out.push(cur.slice()); continue; }
      const t = chamfer ? r[0] : r / Math.tan(ang / 2), t2 = chamfer ? r[1] : t;
      if (t > G.dist(prev, cur) / (cl || i > 1 ? 2 : 1) + 1e-9 || t2 > G.dist(next, cur) / (cl || i < n - 2 ? 2 : 1) + 1e-9) { out.push(cur.slice()); continue; }
      const p1 = G.add(cur, G.mul(d1, t)), p2 = G.add(cur, G.mul(d2, t2)), turn = G.cross(G.mul(d1, -1), d2), defl = Math.PI - ang;
      out.push([p1[0], p1[1], chamfer ? 0 : Math.tan(defl / 4) * Math.sign(turn)], [p2[0], p2[1], 0]); k++;
    }
    return { ent: Object.assign({}, e, { pts: out }), k };
  };
  cmd("FILLET", { a: ["F"], d: "Round the corner between two lines, arcs or circles, or all corners of a polyline", fn: async (E) => {
    const M = mem(E); let multi = false;
    for (;;) {
      const kws = ["Undo", "Polyline", "Radius", "Trim", "Multiple"];
      const a = await E.getEnt(pr(`Select first object (radius ${f(M.fil, E)}${M.filTrim ? "" : ", no trim"})`, kws), { kws, filter: (e) => ["line", "arc", "circle", "pline"].includes(e.t) }); if (a == null) return;
      if (a.kw === "Radius") { const r = await E.getDist("Specify fillet radius", { dflt: f(M.fil, E) }); if (typeof r === "number" && r >= 0) M.fil = r; continue; }
      if (a.kw === "Trim") { const k = await E.getKw(pr("Enter Trim mode option", ["Trim", "No trim"], M.filTrim ? "Trim" : "No trim"), ["Trim", "No trim"]); if (k && k.kw) M.filTrim = k.kw === "Trim"; continue; }
      if (a.kw === "Multiple") { multi = true; continue; } if (a.kw === "Undo") { E.undo(); continue; }
      if (a.kw === "Polyline") { const s = need(await E.getEnt("Select 2D polyline:", { filter: (e) => e.t === "pline" })); if (!(M.fil > 0)) { E.err("Set a radius above zero first (Radius option)."); continue; } const r = filletPline(E, s.e, M.fil, false); E.tx("fillet", () => E.replace(s.e.id, r.ent)); E.msg(r.k + " corner(s) filleted."); if (!multi) return; continue; }
      const b = await E.getEnt("Select second object (Shift = sharp corner):", { filter: (e) => ["line", "arc", "circle", "pline"].includes(e.t) }); if (b == null || b.kw) return;
      const r = E.lastShift ? 0 : M.fil;
      const res = filletTwo(E, a, b, r, M.filTrim); if (res.err) { E.err(res.err); if (!multi) return; continue; }
      E.tx("fillet", () => { for (const [id, n] of res.rep) E.replace(id, n); if (res.add) E.add(res.add); });
      if (!multi) return;
    }
  } });
  const filletTwo = (E, a, b, r, trim) => {
    if (a.e.id === b.e.id && a.e.t === "pline") {
      const P = K.path(a.e), i = Math.floor(K.pathParam(P, a.p)), j = Math.floor(K.pathParam(P, b.p)), n = P.prims.length;
      if (Math.abs(i - j) !== 1 && !(a.e.closed && Math.abs(i - j) === n - 1)) return { err: "Pick two neighbouring segments of the polyline." };
      const v = Math.abs(i - j) === 1 ? Math.max(i, j) : 0, e = a.e;
      if (r <= 0) return { err: "Use a radius above zero for polyline corners." };
      const out = filletPline(E, e, r, false, v); if (!out.k) return { err: "The radius is too large for these segments (or a segment is an arc)." }; return { rep: [[e.id, out.ent]] };
    }
    const sa = segAt(a), sb = segAt(b); if (!sa || !sb) return { err: "Cannot fillet those objects." };
    const A = K.pAsPrim(sa.pr), B = K.pAsPrim(sb.pr);
    if (A.k === "s" && B.k === "s") {
      const X = G.ixSS(A, B, true, true)[0]; if (!X) return { err: "The lines are parallel." };
      const fl = G.filletLines(A, B, r, G.closestSeg(a.p, A.a, A.b), G.closestSeg(b.p, B.a, B.b)); if (!fl) return { err: "Cannot fillet those lines." };
      const rep = [], t1 = fl.t1, t2 = fl.t2;
      if (trim) {
        if (a.e.t === "line") rep.push([a.e.id, trimLineTo(a.e, a.p, t1)]); if (b.e.t === "line") rep.push([b.e.id, trimLineTo(b.e, b.p, t2)]);
        if (a.e.t === "pline" || b.e.t === "pline") return { err: "To fillet polyline segments use the Polyline option, or explode the polyline first." };
      }
      if (r <= 0) return { rep };
      const a0 = G.ang(fl.c, t1), a1 = G.ang(fl.c, t2), add = G.sweep(a0, a1) < Math.PI ? { t: "arc", c: fl.c, r, a0, a1 } : { t: "arc", c: fl.c, r, a0: a1, a1: a0 };
      return { rep, add: Object.assign(add, { layer: a.e.layer, color: a.e.color, lt: a.e.lt, lw: a.e.lw }) };
    }
    if (r <= 0) return { err: "Use a radius above zero for arcs and circles." };
    const offs = (P) => P.k === "s" ? (() => { const u = G.unit(G.sub(P.b, P.a)), n = [-u[1], u[0]]; return [1, -1].map((s) => ({ k: "s", a: G.add(P.a, G.mul(n, r * s)), b: G.add(P.b, G.mul(n, r * s)) })); })() : [P.r + r, P.r - r].filter((x) => x > 1e-9).map((rr) => ({ k: "a", c: P.c, r: rr, a0: 0, a1: TAU, full: true }));
    const qa = G.closest(a.p, A), qb = G.closest(b.p, B); let best = null, bd = Infinity;
    for (const o1 of offs(A)) for (const o2 of offs(B)) for (const c of G.ix(o1, o2, true, true)) { const t1 = A.k === "s" ? G.add(A.a, G.mul(G.unit(G.sub(A.b, A.a)), G.dot(G.sub(c, A.a), G.unit(G.sub(A.b, A.a))))) : G.polar(A.c, G.ang(A.c, c), A.r), t2 = B.k === "s" ? G.add(B.a, G.mul(G.unit(G.sub(B.b, B.a)), G.dot(G.sub(c, B.a), G.unit(G.sub(B.b, B.a))))) : G.polar(B.c, G.ang(B.c, c), B.r); const sc = G.dist(t1, qa) + G.dist(t2, qb); if (sc < bd) { bd = sc; best = { c, t1, t2 }; } }
    if (!best) return { err: "The radius is too large — no fillet is possible." };
    const rep = [];
    if (trim) for (const [s, t] of [[a, best.t1], [b, best.t2]]) {
      const e = s.e;
      if (e.t === "line") rep.push([e.id, trimLineTo(e, s.p, t)]);
      else if (e.t === "arc") { const at = G.ang(e.c, t), ap = G.ang(e.c, s.p); rep.push([e.id, G.inSweep(ap, at, e.a1) ? Object.assign({}, e, { a0: at }) : Object.assign({}, e, { a1: at })]); }
    }
    const a0 = G.ang(best.c, best.t1), a1 = G.ang(best.c, best.t2);
    return { rep, add: Object.assign(G.sweep(a0, a1) <= Math.PI ? { t: "arc", c: best.c, r, a0, a1 } : { t: "arc", c: best.c, r, a0: a1, a1: a0 }, K.props(a.e)) };
  };
  cmd("CHAMFER", { a: ["CHA"], d: "Bevel the corner between two lines or all corners of a polyline", fn: async (E) => {
    const M = mem(E);
    for (;;) {
      const kws = ["Undo", "Polyline", "Distance"];
      const a = await E.getEnt(pr(`Select first line (distances ${f(M.cham[0], E)}, ${f(M.cham[1], E)})`, kws), { kws, filter: (e) => e.t === "line" || e.t === "pline" }); if (a == null) return;
      if (a.kw === "Distance") { const d1 = await E.getDist("Specify first chamfer distance", { dflt: f(M.cham[0], E) }); if (typeof d1 !== "number") continue; const d2 = await E.getDist("Specify second chamfer distance", { dflt: f(d1, E) }); M.cham = [d1, typeof d2 === "number" ? d2 : d1]; continue; }
      if (a.kw === "Undo") { E.undo(); continue; }
      if (a.kw === "Polyline") { const s = need(await E.getEnt("Select 2D polyline:", { filter: (e) => e.t === "pline" })); const r = filletPline(E, s.e, M.cham, true); E.tx("chamfer", () => E.replace(s.e.id, r.ent)); E.msg(r.k + " corner(s) chamfered."); return; }
      const b = need(await E.getEnt("Select second line:", { filter: (e) => e.t === "line" })); if (a.e.t !== "line") return E.err("Use the Polyline option for polylines.");
      const A = { k: "s", a: a.e.a, b: a.e.b }, B = { k: "s", a: b.e.a, b: b.e.b }, X = G.ixSS(A, B, true, true)[0]; if (!X) return E.err("The lines are parallel.");
      const dir = (L, p) => { const q = G.closestSeg(p, L.a, L.b); return G.unit(G.dist(q, X) > 1e-9 ? G.sub(q, X) : G.sub(G.dist(L.a, X) > G.dist(L.b, X) ? L.a : L.b, X)); };
      const c1 = G.add(X, G.mul(dir(A, a.p), M.cham[0])), c2 = G.add(X, G.mul(dir(B, b.p), M.cham[1]));
      E.tx("chamfer", () => { E.replace(a.e.id, trimLineTo(a.e, a.p, c1)); E.replace(b.e.id, trimLineTo(b.e, b.p, c2)); if (G.dist(c1, c2) > 1e-9) E.add(Object.assign({ t: "line", a: c1, b: c2 }, K.props(a.e))); });
      return;
    }
  } });

  /* ---- array ---- */
  cmd("ARRAY", { a: ["AR", "ARRAYRECT", "ARRAYPOLAR"], d: "Rectangular or polar (circular) array of copies", fn: async (E) => {
    const ids = await selOrStop(E); if (!ids) return;
    const bb = ids.map((id) => K.bbox(E.byId(id), E.doc)).reduce((a, b) => G.mergeBounds(a, b), null) || { x0: 0, y0: 0, x1: 10, y1: 10 }, w = bb.x1 - bb.x0, h = bb.y1 - bb.y0, M = mem(E);
    const r = await E.dialog("Array", `<div class="cx-seg"><label><input type="radio" name="at" value="rect" ${M.arrT !== "polar" ? "checked" : ""}> Rectangular</label><label><input type="radio" name="at" value="polar" ${M.arrT === "polar" ? "checked" : ""}> Polar (around a centre)</label></div>
      <div class="cx-frm" data-t="rect"><label>Rows<input id="ar" type="number" min="1" value="${M.arR || 3}"></label><label>Columns<input id="ac" type="number" min="1" value="${M.arC || 4}"></label><label>Row spacing<input id="ars" type="number" step="any" value="${K.fmt(M.arRs || h * 1.5 || 10, 4)}"></label><label>Column spacing<input id="acs" type="number" step="any" value="${K.fmt(M.arCs || w * 1.5 || 10, 4)}"></label></div>
      <div class="cx-frm" data-t="polar"><label>Number of items (incl. original)<input id="pn" type="number" min="2" value="${M.arN || 6}"></label><label>Angle to fill (°, − = clockwise)<input id="pa" type="number" step="any" value="${M.arA ?? 360}"></label><label class="cx-chk"><input id="pr" type="checkbox" ${M.arRot !== false ? "checked" : ""}> Rotate items as copied</label></div><label class="cx-chk"><input id="aas" type="checkbox" ${M.arAs !== false ? "checked" : ""}> Associative (one array object you can edit later: counts, spacing)</label><p class="cx-note">For polar, you pick the centre point after OK.</p>`,
      (b) => ({ t: b.querySelector("input[name=at]:checked").value, R: Math.max(1, +b.querySelector("#ar").value | 0), C: Math.max(1, +b.querySelector("#ac").value | 0), Rs: +b.querySelector("#ars").value, Cs: +b.querySelector("#acs").value, N: Math.max(2, +b.querySelector("#pn").value | 0), A: +b.querySelector("#pa").value, rot: b.querySelector("#pr").checked, assoc: b.querySelector("#aas").checked }));
    if (!r) return; Object.assign(M, { arT: r.t, arR: r.R, arC: r.C, arRs: r.Rs, arCs: r.Cs, arN: r.N, arA: r.A, arRot: r.rot, arAs: r.assoc });
    if (r.assoc && K.makeArray) {
      const src = ids.map((id) => E.byId(id));
      if (r.t === "rect") { E.tx("array", () => { E.remove(ids); E.add({ t: "array", kind: "rect", src, base: [bb.x0, bb.y0], cols: r.C, rows: r.R, vc: [r.Cs, 0], vr: [0, r.Rs], layer: src[0].layer }, true); }); E.msg(`Associative array: ${r.R} × ${r.C}.`); return; }
      const mk = (q) => ({ t: "array", kind: "polar", src, base: [(bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2], c: q, n: r.N, fill: r.A, rot: r.rot, layer: src[0].layer });
      const c0 = need(await E.getPoint("Specify center point of array:", { preview: (q) => [mk(q)] })); if (!isP(c0)) return;
      E.tx("array", () => { E.remove(ids); E.add(mk(c0), true); }); E.msg(`Associative polar array of ${r.N}.`); return;
    }
    if (r.t === "rect") { if (r.R * r.C > 5000) return E.err("That is more than 5000 copies."); E.tx("array", () => { for (let i = 0; i < r.R; i++) for (let j = 0; j < r.C; j++) if (i || j) applyXf(E, ids, K.M.move(j * r.Cs, i * r.Rs), true); }); E.msg(`${r.R * r.C - 1} copies made.`); return; }
    const full = Math.abs(Math.abs(r.A) - 360) < 1e-9, step = (r.A * D2R) / (full ? r.N : r.N - 1);
    const mxf = (c, i) => (r.rot ? K.M.rot(c, step * i) : (() => { const ctr = [(bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2], q = G.rotp(ctr, c, step * i); return K.M.move(q[0] - ctr[0], q[1] - ctr[1]); })());
    const c = need(await E.getPoint("Specify center point of array:", { preview: (q) => { const out = []; for (let i = 1; i < r.N; i++) out.push(...preview(ids.slice(0, 60), E, mxf(q, i))); return out; } })); if (!isP(c)) return;
    E.tx("array", () => { for (let i = 1; i < r.N; i++) applyXf(E, ids, mxf(c, i), true); }); E.msg(`${r.N - 1} copies made.`);
  } });

  /* ---- join / break / stretch / lengthen ---- */
  cmd("JOIN", { a: ["J"], d: "Join lines, arcs and polylines end-to-end into one polyline", fn: async (E) => {
    const ids = await E.getSel("Select objects to join:", { filter: (e) => ["line", "arc", "pline"].includes(e.t) }); if (ids.length < 2) return E.msg("Select at least two objects that touch end-to-end.");
    const ents = ids.map((id) => E.byId(id)).filter((e) => e && !(e.t === "pline" && e.closed));
    const lines = ents.filter((e) => e.t === "line");
    if (lines.length === ents.length) { const u = G.unit(G.sub(lines[0].b, lines[0].a)), col = lines.every((l) => Math.abs(G.cross(u, G.sub(l.a, lines[0].a))) < 1e-7 && Math.abs(G.cross(u, G.sub(l.b, lines[0].a))) < 1e-7); if (col) { const ts = lines.flatMap((l) => [G.dot(G.sub(l.a, lines[0].a), u), G.dot(G.sub(l.b, lines[0].a), u)]); const t0 = Math.min(...ts), t1 = Math.max(...ts); E.tx("join", () => { E.remove(lines.map((l) => l.id)); E.add(Object.assign({}, lines[0], { id: undefined, a: G.add(lines[0].a, G.mul(u, t0)), b: G.add(lines[0].a, G.mul(u, t1)) }), true); }); E.msg(lines.length + " lines joined into 1 line."); return; } }
    const chains = ents.map((e) => ({ id: e.id, prims: K.path(e).prims })), tol = 1e-6 * (1 + Math.max(...ents.map((e) => { const b = K.bbox(e, E.doc); return b ? Math.max(b.x1 - b.x0, b.y1 - b.y0) : 1; })));
    const rev = (ps) => ps.slice().reverse().map((p) => (p.k === "s" ? { k: "s", a: p.b, b: p.a } : { k: "a", c: p.c, r: p.r, sa: p.sa + p.sw, sw: -p.sw }));
    const st = (ps) => K.pAt(ps[0], 0), en = (ps) => K.pAt(ps[ps.length - 1], 1);
    let cur = chains.shift(); const used = [cur.id];
    for (let grew = true; grew && chains.length;) {
      grew = false;
      for (let i = 0; i < chains.length; i++) {
        const c = chains[i]; let ps = null;
        if (G.dist(en(cur.prims), st(c.prims)) < tol) ps = cur.prims.concat(c.prims); else if (G.dist(en(cur.prims), en(c.prims)) < tol) ps = cur.prims.concat(rev(c.prims));
        else if (G.dist(st(cur.prims), en(c.prims)) < tol) ps = c.prims.concat(cur.prims); else if (G.dist(st(cur.prims), st(c.prims)) < tol) ps = rev(c.prims).concat(cur.prims);
        if (ps) { cur = { prims: ps }; used.push(c.id); chains.splice(i, 1); grew = true; break; }
      }
    }
    if (used.length < 2) return E.err("The objects do not touch end-to-end.");
    const closed = G.dist(st(cur.prims), en(cur.prims)) < tol, src = E.byId(used[0]);
    E.tx("join", () => { E.remove(used); E.add(K.fromPrims(Object.assign({}, src, { t: "pline" }), cur.prims, closed), true); });
    E.msg(`${used.length} objects joined into 1 polyline${chains.length ? `, ${chains.length} could not be joined` : ""}.`);
  } });
  cmd("BREAK", { a: ["BR"], d: "Break an object between two points (or at one point)", fn: async (E) => {
    const s = need(await E.getEnt("Select object:", { filter: (e) => !!K.path(e) }));
    let p1 = s.p; const v = await E.getPoint(pr("Specify second break point", ["First point"]), { kws: ["First point"] }); if (v == null) return;
    let p2 = v; if (v.kw) { p1 = need(await E.getPoint("Specify first break point:")); p2 = need(await E.getPoint("Specify second break point:", { base: p1 })); }
    const e = s.e, P = K.path(e), n = P.prims.length; let a = K.pathParam(P, p1), b = K.pathParam(P, p2);
    let pieces;
    if (P.closed) { if (Math.abs(a - b) < 1e-9) return E.err("A closed object needs two different break points."); pieces = [K.subPath(P, b, a)]; }
    else { if (a > b) [a, b] = [b, a]; pieces = [K.subPath(P, 0, a), K.subPath(P, b, n)]; if (Math.abs(a - b) < 1e-12) pieces = [K.subPath(P, 0, a), K.subPath(P, a, n)]; }
    E.tx("break", () => { E.remove([e.id]); for (const x of pieces) if (x.length) { const ne = K.fromPrims(e, x, false); if (ne) E.add(ne, true); } });
  } });
  cmd("BREAKATPOINT", { a: ["BRP"], d: "Split an object into two at a point", fn: async (E) => {
    const s = need(await E.getEnt("Select object:", { filter: (e) => !!K.path(e) && !K.path(e).closed })); const p = need(await E.getPoint("Specify break point:"));
    const P = K.path(s.e), a = K.pathParam(P, p); E.tx("break", () => { E.remove([s.e.id]); for (const x of [K.subPath(P, 0, a), K.subPath(P, a, P.prims.length)]) if (x.length) E.add(K.fromPrims(s.e, x, false), true); });
  } });
  cmd("STRETCH", { a: ["S"], d: "Stretch: move the points inside a crossing window", fn: async (E) => {
    E.msg("Select objects to stretch by crossing-window (drag right-to-left)…", "mu");
    const a = need(await E.getPoint("Specify first corner:")); const b = need(await E.getPoint("Specify opposite corner:", { base: a, noRubber: true, preview: (q) => [{ t: "pline", closed: true, lt: "DASHED", pts: [[a[0], a[1]], [q[0], a[1]], [q[0], q[1]], [a[0], q[1]]] }] }));
    const r = { x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) }, inR = (p) => p[0] >= r.x0 && p[0] <= r.x1 && p[1] >= r.y0 && p[1] <= r.y1;
    const ents = E.doc.ents.filter((e) => E.editable(e) && K.crosses(e, r, E.doc)); if (!ents.length) return E.msg("Nothing found in the window.");
    E.msg(ents.length + " found");
    const st = (e, d) => {
      const mv = (p) => (inR(p) ? G.add(p, d) : p), n = JSON.parse(JSON.stringify(e));
      if (K.inside(e, r, E.doc)) return K.xform(e, K.M.move(d[0], d[1]));
      switch (e.t) {
        case "line": n.a = mv(e.a); n.b = mv(e.b); return n;
        case "pline": n.pts = e.pts.map((p) => (inR(p) ? [p[0] + d[0], p[1] + d[1], p[2] || 0] : p)); return n;
        case "spline": n.pts = e.pts.map(mv); delete n.ctrl; delete n.knots; return n;
        case "leader": n.pts = e.pts.map(mv); return n;
        case "dim": for (const k of ["p1", "p2", "loc", "c"]) if (e[k]) n[k] = mv(e[k]); return n;
        case "hatch": n.loops = e.loops.map((l) => l.map(mv)); return n;
        case "arc": { const p0 = G.polar(e.c, e.a0, e.r), p1 = G.polar(e.c, e.a1, e.r), pm = G.polar(e.c, e.a0 + G.sweep(e.a0, e.a1) / 2, e.r); if (!inR(p0) && !inR(p1)) return inR(e.c) ? K.xform(e, K.M.move(d[0], d[1])) : e; const A = G.arc3(mv(p0), G.add(pm, G.mul(d, inR(p0) && inR(p1) ? 1 : 0.5)), mv(p1)); return A ? Object.assign(n, A) : e; }
        default: { const g = K.grips(e)[0]; return g && inR(g) ? K.xform(e, K.M.move(d[0], d[1])) : e; }
      }
    };
    const bp = need(await E.getPoint("Specify base point:")); const q = need(await E.getPoint("Specify second point:", { base: bp, preview: (p) => ents.slice(0, 400).map((e) => st(e, G.sub(p, bp))) }));
    if (!isP(q)) return; const d = G.sub(q, bp); E.tx("stretch", () => { for (const e of ents) { const n = st(e, d); if (n !== e) E.replace(e.id, n); } });
  } });
  cmd("LENGTHEN", { a: ["LEN"], d: "Change the length of a line or arc (delta or total)", fn: async (E) => {
    const M = mem(E); let mode = M.lenMode || "DElta";
    for (;;) {
      const kws = ["DElta", "Total"];
      const v = await E.getEnt(pr(`Select an object to change (${mode === "Total" ? "total " + f(M.lenT || 0, E) : "delta " + f(M.lenD || 0, E)})`, kws), { kws, filter: (e) => e.t === "line" || e.t === "arc" }); if (v == null) return;
      if (v.kw === "DElta") { const d = await E.getDist("Enter delta length", { dflt: f(M.lenD || 0, E) }); if (typeof d === "number") { M.lenD = d; mode = M.lenMode = "DElta"; } continue; }
      if (v.kw === "Total") { const d = await E.getDist("Specify total length", { dflt: f(M.lenT || 10, E) }); if (typeof d === "number") { M.lenT = d; mode = M.lenMode = "Total"; } continue; }
      const e = v.e, P = K.path(e), L = K.pathLen(P), nl = mode === "Total" ? M.lenT : L + (M.lenD || 0); if (!(nl > 0)) { E.err("The new length must be above zero."); continue; }
      const atEnd = K.pathParam(P, v.p) > 0.5;
      let n;
      if (e.t === "line") { const u = G.unit(G.sub(e.b, e.a)); n = atEnd ? Object.assign({}, e, { b: G.add(e.a, G.mul(u, nl)) }) : Object.assign({}, e, { a: G.sub(e.b, G.mul(u, nl)) }); }
      else { const sw = nl / e.r; if (sw >= TAU) { E.err("That would be more than a full circle."); continue; } n = atEnd ? Object.assign({}, e, { a1: e.a0 + sw }) : Object.assign({}, e, { a0: e.a1 - sw }); }
      E.tx("lengthen", () => E.replace(e.id, n));
    }
  } });
  cmd("MATCHPROP", { a: ["MA", "PAINTER"], d: "Copy layer, colour, linetype (and text / hatch settings) from one object to others", fn: async (E) => {
    const s = need(await E.getEnt("Select source object:", { anyLayer: true })); const src = s.e;
    E.msg(`Current active settings: layer ${src.layer}, colour ${src.color || "ByLayer"}, linetype ${src.lt || "ByLayer"}.`);
    E.begin("match properties");
    for (;;) {
      const v = await E.getEnt("Select destination object (Enter to finish):"); if (v == null) break;
      const n = Object.assign({}, v.e, { layer: src.layer, color: src.color || null, lt: src.lt || null, lw: src.lw == null ? null : src.lw });
      if (src.t === v.e.t && (src.t === "text" || src.t === "mtext")) n.h = src.h;
      if (src.t === "hatch" && v.e.t === "hatch") Object.assign(n, { pat: src.pat, solid: src.solid, sc: src.sc, ang: src.ang });
      if (src.t === "dim" && v.e.t === "dim" && src.st) n.st = Object.assign({}, src.st);
      E.replace(v.e.id, n);
    }
  } });

  /* ---- selection helpers ---- */
  cmd("SELECTALL", { a: ["AI_SELALL"], d: "Select every object on unlocked visible layers", keepSel: true, norepeat: true, fn: async (E) => { E.sel = E.doc.ents.filter((e) => E.editable(e)).map((e) => e.id); E.msg(E.sel.length + " selected."); E.drawOverlay(); E.refreshSide(); } });
  cmd("SELECTSIMILAR", { a: [], d: "Select all objects of the same type on the same layer as the selection", keepSel: true, fn: async (E) => {
    let ids = E.sel.slice(); if (!ids.length) { const v = need(await E.getEnt("Select an object:")); ids = [v.e.id]; }
    const keys = new Set(ids.map((id) => { const e = E.byId(id); return e.t + "|" + e.layer + (e.t === "insert" ? "|" + e.name : ""); }));
    E.sel = E.doc.ents.filter((e) => E.editable(e) && keys.has(e.t + "|" + e.layer + (e.t === "insert" ? "|" + e.name : ""))).map((e) => e.id); E.msg(E.sel.length + " selected."); E.drawOverlay(); E.refreshSide();
  } });

  /* ---- clipboard ---- */
  const clipSave = (E, ids) => { const ents = ids.map((id) => E.byId(id)).filter(Boolean), names = new Set(); const walk = (list) => { for (const e of list) if (e.t === "insert" && !names.has(e.name) && E.doc.blocks[e.name]) { names.add(e.name); walk(E.doc.blocks[e.name].ents); } }; walk(ents); const blocks = {}; names.forEach((n) => (blocks[n] = E.doc.blocks[n])); const b = ents.map((e) => K.bbox(e, E.doc)).reduce((a, c) => G.mergeBounds(a, c), null) || { x0: 0, y0: 0 }; const data = { ents, blocks, layers: E.doc.layers.filter((l) => ents.some((e) => e.layer === l.name)), base: [b.x0, b.y0] }; try { localStorage.setItem("kcad-clip", JSON.stringify(data)); } catch (e) { E.clip = data; } E.clip = data; return ents.length; };
  cmd("COPYCLIP", { a: [], d: "Copy selected objects to the clipboard (Ctrl+C)", keepSel: true, norepeat: true, fn: async (E) => { const ids = await selOrStop(E); if (!ids) return; E.msg(clipSave(E, ids) + " object(s) copied."); } });
  cmd("CUTCLIP", { a: [], d: "Cut selected objects to the clipboard (Ctrl+X)", norepeat: true, fn: async (E) => { const ids = await selOrStop(E); if (!ids) return; clipSave(E, ids); E.tx("cut", () => E.remove(ids)); } });
  cmd("PASTECLIP", { a: [], d: "Paste objects from the clipboard (Ctrl+V)", norepeat: true, fn: async (E) => {
    let c = E.clip; try { c = JSON.parse(localStorage.getItem("kcad-clip") || "null") || c; } catch (e) { /* use memory */ } if (!c || !c.ents.length) return E.msg("The clipboard is empty.");
    const ents = c.ents, b = c.base;
    const q = need(await E.getPoint("Specify insertion point:", { preview: (p) => ents.slice(0, 600).map((e) => K.xform(e, K.M.move(p[0] - b[0], p[1] - b[1]))) })); if (!isP(q)) return;
    E.tx("paste", () => { for (const [n, blk] of Object.entries(c.blocks || {})) if (!E.doc.blocks[n]) E.doc.blocks[n] = blk; for (const l of c.layers || []) if (!E.doc.layers.find((x) => x.name === l.name)) E.doc.layers.push(l); const ids = []; for (const e of ents) ids.push(E.add(Object.assign(K.xform(e, K.M.move(q[0] - b[0], q[1] - b[1])), { id: undefined }), true).id); E.sel = []; });
  } });

  /* ---- blocks ---- */
  cmd("BLOCK", { a: ["B", "BMAKE"], d: "Make a named block from selected objects", fn: async (E) => {
    const r = await E.dialog("Create block", `<label>Block name<input id="bn" maxlength="60" placeholder="e.g. BOLT-M8"></label><label class="cx-chk"><input id="bk" type="checkbox" checked> Replace the selected objects with the block</label><p class="cx-note">After OK: pick the base (insertion) point, then select the objects.</p>`, (b) => { const n = b.querySelector("#bn").value.trim(); if (!n) throw new Error("Enter a block name."); if (/[<>/\\":;?*|=`]/.test(n)) throw new Error("A block name cannot contain < > / \\ \" : ; ? * | = `"); return { n, keep: b.querySelector("#bk").checked }; });
    if (!r) return;
    if (E.doc.blocks[r.n]) { const k = await E.getKw(pr(`Block "${r.n}" exists. Redefine it?`, ["Yes", "No"], "No"), ["Yes", "No"], "No"); if (!k || k.kw !== "Yes") return; }
    const base = need(await E.getPoint("Specify insertion base point:")); const ids = await E.getSel("Select objects:", { fresh: true }); if (!ids.length) return E.msg("No objects selected — block not made.");
    E.tx("block", () => {
      const ents = ids.map((id) => E.byId(id)).filter(Boolean).map((e) => Object.assign(JSON.parse(JSON.stringify(e)), { id: K.uid() }));
      E.doc.blocks = Object.assign({}, E.doc.blocks, { [r.n]: { base, ents } });
      if (r.keep) { E.remove(ids); const at = {}; ents.filter((s) => s.t === "attdef").forEach((s) => (at[s.tag] = s.def || "")); E.add(Object.assign({ t: "insert", name: r.n, p: base, sx: 1, sy: 1, rot: 0 }, Object.keys(at).length ? { attrs: at } : {})); }
    });
    E.msg(`Block "${r.n}" created with ${ids.length} object(s).`);
  } });
  cmd("INSERT", { a: ["I", "DDINSERT"], d: "Insert a block (from this drawing or the library)", fn: async (E, args) => {
    let name = args && args.name;
    if (!name) {
      const names = Object.keys(E.doc.blocks).filter((n) => !n.startsWith("*")), lib = Object.keys(K.LIB || {});
      name = await E.dialog("Insert block", `${names.length ? `<h4>Blocks in this drawing</h4><div class="cx-blist">${names.map((n) => `<button type="button" data-bn="${K.esc(n)}">${K.blockThumb(E.doc, n)}<span>${K.esc(n)}</span></button>`).join("")}</div>` : ""}<h4>Standard library</h4><div class="cx-blist">${lib.map((n) => `<button type="button" data-lib="${K.esc(n)}">${K.libThumb(n)}<span>${K.esc(K.LIB[n].d)}</span></button>`).join("")}</div>`, null, { width: "min(760px,96vw)", init: (b) => b.querySelectorAll("[data-bn],[data-lib]").forEach((x) => (x.onclick = () => E.closeDlg(x.dataset.bn || "lib:" + x.dataset.lib))) });
      if (!name) return;
    }
    if (name.startsWith("lib:")) { const key = name.slice(4); name = K.LIB[key].name || key; if (!E.doc.blocks[name]) E.tx("library block", () => { E.doc.blocks = Object.assign({}, E.doc.blocks, { [name]: K.LIB[key].make() }); }); }
    if (!E.doc.blocks[name]) return E.err(`Block "${name}" not found.`);
    const mk = (p, s = 1, rot = 0) => ({ t: "insert", name, p, sx: s, sy: s, rot });
    const p = need(await E.getPoint(pr("Specify insertion point", ["Scale", "Rotate"]), { kws: ["Scale", "Rotate"], preview: (q) => [mk(q)] }));
    let sc = 1, rot = 0, ins = p;
    if (p.kw) { if (p.kw === "Scale") sc = +(need(await E.getNum("Specify scale factor <1>:", { dflt: 1, positive: true }))); else rot = need(await E.getAngle("Specify rotation angle <0>:", { dflt: 0 })); ins = need(await E.getPoint("Specify insertion point:", { preview: (q) => [mk(q, sc, rot)] })); }
    else { const s = await E.getNum("Enter scale factor <1>:", { dflt: 1, positive: true }); if (typeof s === "number") sc = s; const a = await E.getAngle("Specify rotation angle <0>:", { base: ins, dflt: 0, preview: (q) => [mk(ins, sc, G.ang(ins, q))] }); if (typeof a === "number") rot = a; }
    const placed = E.add(mk(ins, sc, rot)); if (K.askAttrs) await K.askAttrs(E, placed);
  } });
  K.blockThumb = (doc, name) => { const d = K.newDoc(false); d.layers = doc.layers; d.blocks = doc.blocks; d.ents = [{ t: "insert", name, p: [0, 0], sx: 1, sy: 1, rot: 0, layer: "0" }]; const b = K.extents(d); if (!b) return ""; return K.toSVG(d, { box: b, widthMm: 60, heightMm: 44, mono: true }).replace(/width="60mm" height="44mm"/, 'width="90" height="66"'); };
  K.libThumb = (key) => { const d = K.newDoc(false); d.blocks = { X: K.LIB[key].make() }; d.ents = [{ t: "insert", name: "X", p: [0, 0], sx: 1, sy: 1, rot: 0, layer: "0" }]; const b = K.extents(d); return b ? K.toSVG(d, { box: b, widthMm: 60, heightMm: 44, mono: true }).replace(/width="60mm" height="44mm"/, 'width="90" height="66"') : ""; };
  /* a small engineering library (drawn at 1:1 in mm) */
  const L = (a, b) => ({ t: "line", layer: "0", a, b }), Ci = (c, r) => ({ t: "circle", layer: "0", c, r }), Ar = (c, r, a0, a1) => ({ t: "arc", layer: "0", c, r, a0: a0 * D2R, a1: a1 * D2R }), Tx = (p, h, s, ha = 1) => ({ t: "text", layer: "0", p, h, s, rot: 0, ha, va: 2 });
  K.LIB = {
    hexnut: { d: "Hex nut M10 (top view)", name: "HEX-NUT-M10", make: () => { const pts = []; for (let i = 0; i < 6; i++) { const p = G.polar([0, 0], (i * 60 + 30) * D2R, 8.66); pts.push([p[0], p[1], 0]); } return { base: [0, 0], ents: [{ t: "pline", layer: "0", closed: true, pts }, Ci([0, 0], 7.5), Ci([0, 0], 5), Ar([0, 0], 4.25, 10, 280)] }; } },
    bolt: { d: "Hex bolt M10×40 (side view)", name: "BOLT-M10x40", make: () => ({ base: [0, 0], ents: [{ t: "pline", layer: "0", closed: true, pts: [[0, -8.66, 0], [6.4, -8.66, 0], [6.4, 8.66, 0], [0, 8.66, 0]] }, L([0, -4.33], [6.4, -4.33]), L([0, 4.33], [6.4, 4.33]), { t: "pline", layer: "0", closed: false, pts: [[6.4, -5, 0], [46.4, -5, 0], [46.4, 5, 0], [6.4, 5, 0]] }, { t: "line", layer: "0", lt: "HIDDEN", a: [26.4, -4.2], b: [46.4, -4.2] }, { t: "line", layer: "0", lt: "HIDDEN", a: [26.4, 4.2], b: [46.4, 4.2] }, { t: "line", layer: "0", lt: "CENTER", a: [-2, 0], b: [48.4, 0] }] }) },
    bearing: { d: "Ball bearing 6204 (section symbol)", name: "BEARING-6204", make: () => ({ base: [0, 0], ents: [Ci([0, 0], 23.5), Ci([0, 0], 20), Ci([0, 0], 13.5), Ci([0, 0], 10), Ci([0, 16.75], 3.2), Ci([0, -16.75], 3.2), Ci([16.75, 0], 3.2), Ci([-16.75, 0], 3.2), { t: "line", layer: "0", lt: "CENTER", a: [-27, 0], b: [27, 0] }, { t: "line", layer: "0", lt: "CENTER", a: [0, -27], b: [0, 27] }] }) },
    centremark: { d: "Centre mark (Ø20 hole)", name: "CENTRE-MARK", make: () => ({ base: [0, 0], ents: [{ t: "line", layer: "0", lt: "CENTER", a: [-14, 0], b: [14, 0] }, { t: "line", layer: "0", lt: "CENTER", a: [0, -14], b: [0, 14] }] }) },
    roughness: { d: "Surface roughness symbol (Ra)", name: "SURFACE-RA", make: () => ({ base: [0, 0], ents: [L([-3.5, 6], [0, 0]), L([0, 0], [7, 12]), L([7, 12], [16, 12]), L([-3.5, 6], [3.5, 6]), Tx([10, 14.5], 2.5, "Ra 1.6")] }) },
    datum: { d: "Datum feature symbol A", name: "DATUM-A", make: () => ({ base: [0, 0], ents: [{ t: "hatch", layer: "0", solid: true, loops: [[[-3, 0], [3, 0], [0, 5]]] }, L([0, 5], [0, 9]), { t: "pline", layer: "0", closed: true, pts: [[-4, 9, 0], [4, 9, 0], [4, 17, 0], [-4, 17, 0]] }, Tx([0, 13], 5, "A")] }) },
    weld: { d: "Fillet weld symbol", name: "WELD-FILLET", make: () => ({ base: [0, 0], ents: [L([0, 0], [10, 10]), L([10, 10], [35, 10]), { t: "hatch", layer: "0", solid: true, loops: [[[0, 0], [2.6, 0.6], [0.6, 2.6]]] }, { t: "pline", layer: "0", closed: true, pts: [[18, 10, 0], [24, 10, 0], [18, 16, 0]] }] }) },
    northArrow: { d: "Section view arrow A-A", name: "SECTION-ARROW", make: () => ({ base: [0, 0], ents: [{ t: "pline", layer: "0", closed: false, w: 0.7, pts: [[0, 0, 0], [0, 10, 0], [8, 10, 0]] }, { t: "hatch", layer: "0", solid: true, loops: [[[8, 12], [8, 8], [14, 10]]] }, Tx([4, 15], 5, "A")] }) },
  };
})((window.KCAD = window.KCAD || {}));
