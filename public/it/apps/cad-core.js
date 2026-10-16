/* KMR CAD Draft — drawing model: entities, transforms, paths (trim / break / extend), dimensions, blocks,
   hit-testing, extents and painting (canvas and SVG share one painter interface). No DOM except the painters. */
(function (K) {
  "use strict";
  const G = K.geom, TAU = G.TAU, D2R = Math.PI / 180;
  let seq = 0;
  K.uid = () => "e" + Date.now().toString(36) + (++seq).toString(36) + Math.random().toString(36).slice(2, 5);

  /* ---------- line types (acadiso, mm) and hatch patterns ---------- */
  K.LT = {
    CONTINUOUS: { d: "Solid line", p: [] },
    DASHED: { d: "Dashed __ __ __", p: [12.7, -6.35] },
    HIDDEN: { d: "Hidden _ _ _ _", p: [6.35, -3.175] },
    CENTER: { d: "Center ____ _ ____", p: [31.75, -6.35, 6.35, -6.35] },
    PHANTOM: { d: "Phantom ____ _ _ ____", p: [31.75, -6.35, 6.35, -6.35, 6.35, -6.35] },
    DASHDOT: { d: "Dash dot __ . __ .", p: [12.7, -6.35, 0, -6.35] },
    DOT: { d: "Dot . . . .", p: [0, -6.35] },
    BORDER: { d: "Border __ __ . __", p: [12.7, -6.35, 12.7, -6.35, 0, -6.35] },
  };
  K.PAT = {
    SOLID: { d: "Solid fill", f: [] },
    ANSI31: { d: "Iron, brick, stone (45°)", f: [{ a: 45, d: 3.175 }] },
    ANSI32: { d: "Steel", f: [{ a: 45, d: 9.525 }, { a: 45, d: 9.525, o: 3.175 }] },
    ANSI37: { d: "Lead, zinc, plastics (cross 45°)", f: [{ a: 45, d: 3.175 }, { a: 135, d: 3.175 }] },
    NET: { d: "Grid (0° / 90°)", f: [{ a: 0, d: 3.175 }, { a: 90, d: 3.175 }] },
    LINE: { d: "Parallel lines", f: [{ a: 0, d: 3.175 }] },
    CROSS: { d: "Wide cross", f: [{ a: 45, d: 8 }, { a: 135, d: 8 }] },
  };
  K.LW = [0, 0.05, 0.09, 0.13, 0.15, 0.18, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.53, 0.6, 0.7, 0.8, 0.9, 1, 1.2, 1.4, 2];

  K.newDoc = (withLayers = true) => ({
    v: 1, units: "mm", ltscale: 1, pdmode: 3, pdsize: 0,
    layers: withLayers ? [
      { name: "0", color: "#ffffff", lt: "CONTINUOUS", lw: 0.25, on: true, frozen: false, lock: false },
      { name: "Outline", color: "#ffffff", lt: "CONTINUOUS", lw: 0.5, on: true, frozen: false, lock: false },
      { name: "Hidden", color: "#ffff00", lt: "HIDDEN", lw: 0.25, on: true, frozen: false, lock: false },
      { name: "Centre", color: "#ff0000", lt: "CENTER", lw: 0.18, on: true, frozen: false, lock: false },
      { name: "Dimensions", color: "#00ffff", lt: "CONTINUOUS", lw: 0.18, on: true, frozen: false, lock: false },
      { name: "Text", color: "#00ff00", lt: "CONTINUOUS", lw: 0.25, on: true, frozen: false, lock: false },
      { name: "Hatch", color: "#808080", lt: "CONTINUOUS", lw: 0.13, on: true, frozen: false, lock: false },
    ] : [{ name: "0", color: "#ffffff", lt: "CONTINUOUS", lw: 0.25, on: true, frozen: false, lock: false }],
    blocks: {}, ents: [],
    dim: { th: 2.5, as: 2.5, exo: 0.625, exe: 1.25, gap: 0.625, dec: 2, adec: 0, sfx: "", pre: "", dli: 7, scale: 1 },
    text: { h: 2.5 },
    info: {},
  });
  K.layer = (doc, name) => doc.layers.find((l) => l.name === name) || doc.layers[0];
  K.fmt = (v, dec) => { const s = (+v).toFixed(dec); return s === "-0" || /^-0\.0*$/.test(s) ? s.slice(1) : s; };

  /* ---------- affine matrices [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f ---------- */
  const M = (K.M = {
    id: () => [1, 0, 0, 1, 0, 0],
    move: (dx, dy) => [1, 0, 0, 1, dx, dy],
    rot: (c, a) => { const co = Math.cos(a), s = Math.sin(a); return [co, s, -s, co, c[0] - co * c[0] + s * c[1], c[1] - s * c[0] - co * c[1]]; },
    scale: (c, k, ky = k) => [k, 0, 0, ky, c[0] - k * c[0], c[1] - ky * c[1]],
    mirror: (p, q) => { const a = G.ang(p, q), c2 = Math.cos(2 * a), s2 = Math.sin(2 * a); return [c2, s2, s2, -c2, p[0] - c2 * p[0] - s2 * p[1], p[1] - s2 * p[0] + c2 * p[1]]; },
    mul: (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]],
    ap: (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]],
    insert: (e) => M.mul(M.move(e.p[0], e.p[1]), M.mul(M.rot([0, 0], e.rot || 0), [e.sx == null ? 1 : e.sx, 0, 0, e.sy == null ? 1 : e.sy, 0, 0])),
  });
  /** a similarity decomposition: uniform scale s, angle phi, mirrored? */
  const decomp = (m) => {
    const det = m[0] * m[3] - m[1] * m[2], s = Math.hypot(m[0], m[1]), s2 = Math.hypot(m[2], m[3]);
    const ortho = Math.abs(m[0] * m[2] + m[1] * m[3]) < 1e-9 * s * s2 + 1e-12;
    return { s, sim: ortho && Math.abs(s - s2) < 1e-9 * Math.max(s, 1), mir: det < 0, phi: Math.atan2(m[1], m[0]), sx: s, sy: s2 };
  };
  const clone = (e) => JSON.parse(JSON.stringify(e));

  /** a transformed copy of an entity (same id unless the caller changes it) */
  K.EXT = K.EXT || {};
  K.xform = (e, m) => {
    const T = (p) => M.ap(m, p), d = decomp(m), n = clone(e), ad = (a) => (d.mir ? d.phi - a : a + d.phi);
    const textRot = (rot) => { const dir = [Math.cos(rot), Math.sin(rot)], v = [m[0] * dir[0] + m[2] * dir[1], m[1] * dir[0] + m[3] * dir[1]]; let r = Math.atan2(v[1], v[0]), flip = false; if (d.mir && Math.cos(r) < -1e-9) { r += Math.PI; flip = true; } return { r, flip }; };
    switch (e.t) {
      case "line": n.a = T(e.a); n.b = T(e.b); break;
      case "xline": n.p = T(e.p); { const q = T(G.add(e.p, e.dir)); n.dir = G.unit(G.sub(q, n.p)); } break;
      case "point": n.p = T(e.p); break;
      case "circle": case "arc":
        if (!d.sim) { const pl = K.toPline(e); return K.xform(pl, m); }
        n.c = T(e.c); n.r = e.r * d.s;
        if (e.t === "arc") { if (d.mir) { n.a0 = d.phi - e.a1; n.a1 = d.phi - e.a0; } else { n.a0 = e.a0 + d.phi; n.a1 = e.a1 + d.phi; } }
        break;
      case "ellipse":
        if (!d.sim) { const pts = G.ellipsePoints(e, 96).map(T); return Object.assign(clone(K.props(e)), { t: "pline", pts: pts.map((p) => [p[0], p[1], 0]), closed: e.a1 == null, id: e.id }); }
        n.c = T(e.c); n.rx = e.rx * d.s; n.ry = e.ry * d.s;
        if (d.mir) { n.rot = d.phi - (e.rot || 0); if (e.a1 != null) { n.a0 = -e.a1; n.a1 = -e.a0; } } else n.rot = (e.rot || 0) + d.phi;
        break;
      case "pline": n.pts = e.pts.map((p) => { const q = T(p); return [q[0], q[1], d.mir ? -(p[2] || 0) : p[2] || 0]; }); if (e.w) n.w = e.w * d.s; break;
      case "spline": n.pts = e.pts.map(T); if (e.ctrl) n.ctrl = e.ctrl.map(T); break;
      case "leader": n.pts = e.pts.map(T); if (e.h) n.h = e.h * d.s; break;
      case "text": case "mtext": case "attdef": { n.p = T(e.p); n.h = e.h * d.s; if (e.w) n.w = e.w * d.s; const tr = textRot(e.rot || 0); n.rot = tr.r; if (tr.flip && e.t === "text" && e.ha !== 1) n.ha = e.ha === 2 ? 0 : 2; break; }
      case "dim": for (const k of ["p1", "p2", "loc", "c"]) if (e[k]) n[k] = T(e[k]); if (e.r) n.r = e.r * d.s; if (e.ext) n.ext = e.ext.map(T); if (e.kind === "lin" && e.dir && Math.abs(Math.sin(d.phi)) > 0.5) n.dir = e.dir === "h" ? "v" : "h"; if (e.ds) n.ds = e.ds * d.s; break;
      case "hatch": n.loops = e.loops.map((l) => l.map(T)); n.ang = ad(e.ang || 0); n.sc = (e.sc || 1) * d.s; break;
      case "insert":
        n.p = T(e.p);
        if (d.mir) { n.rot = d.phi - (e.rot || 0); n.sx = (e.sx || 1) * d.s; n.sy = -(e.sy || 1) * d.s; } else { n.rot = (e.rot || 0) + d.phi; n.sx = (e.sx || 1) * d.sx; n.sy = (e.sy || 1) * d.sy; }
        break;
      default:
        if (K.EXT[e.t] && K.EXT[e.t].xform) return K.EXT[e.t].xform(e, m, d, n);
        for (const k of ["p", "a", "b", "c", "loc", "p1", "p2"]) if (Array.isArray(e[k])) n[k] = T(e[k]);
        if (Array.isArray(e.pts)) n.pts = e.pts.map((q) => { const w = T(q); return q.length > 2 ? [w[0], w[1], q[2]] : w; });
        if (e.h) n.h = e.h * d.s; if (e.rot != null) n.rot = ad(e.rot);
    }
    return n;
  };
  K.props = (e) => ({ layer: e.layer, color: e.color || null, lt: e.lt || null, lw: e.lw == null ? null : e.lw });
  K.toPline = (e) => {
    if (e.t === "circle") return Object.assign(K.props(e), { t: "pline", id: e.id, closed: true, pts: [[e.c[0] + e.r, e.c[1], 1], [e.c[0] - e.r, e.c[1], 1]] });
    if (e.t === "arc") { const sw = G.sweep(e.a0, e.a1), p = G.polar(e.c, e.a0, e.r), q = G.polar(e.c, e.a1, e.r); return Object.assign(K.props(e), { t: "pline", id: e.id, closed: false, pts: [[p[0], p[1], Math.tan(sw / 4)], [q[0], q[1], 0]] }); }
    if (e.t === "line") return Object.assign(K.props(e), { t: "pline", id: e.id, closed: false, pts: [[e.a[0], e.a[1], 0], [e.b[0], e.b[1], 0]] });
    if (e.t === "ellipse") return Object.assign(K.props(e), { t: "pline", id: e.id, closed: e.a1 == null, pts: G.ellipsePoints(e, 96).slice(0, e.a1 == null ? -1 : undefined).map((p) => [p[0], p[1], 0]) });
    if (e.t === "spline") { const pts = G.splinePoints(e); return Object.assign(K.props(e), { t: "pline", id: e.id, closed: !!e.closed, pts: pts.slice(0, e.closed ? -1 : undefined).map((p) => [p[0], p[1], 0]) }); }
    return e;
  };

  /* ---------- paths: one universal representation for trim / extend / break / divide / offset ----------
     prim {k:"s", a, b}  or  {k:"a", c, r, sa (start angle), sw (signed sweep: + counter-clockwise)} */
  K.path = (e) => {
    switch (e.t) {
      case "line": return { prims: [{ k: "s", a: e.a, b: e.b }], closed: false };
      case "arc": return { prims: [{ k: "a", c: e.c, r: e.r, sa: e.a0, sw: G.sweep(e.a0, e.a1) }], closed: false };
      case "circle": return { prims: [{ k: "a", c: e.c, r: e.r, sa: 0, sw: TAU }], closed: true };
      case "pline": {
        const P = e.pts, n = P.length, cnt = e.closed ? n : n - 1, prims = [];
        for (let i = 0; i < cnt; i++) {
          const p = P[i], q = P[(i + 1) % n], b = p[2] || 0;
          if (b && G.dist(p, q) > 1e-12) { const A = G.bulgeArc(p, q, b); prims.push({ k: "a", c: A.c, r: A.r, sa: G.ang(A.c, p), sw: 4 * Math.atan(b) }); }
          else prims.push({ k: "s", a: [p[0], p[1]], b: [q[0], q[1]] });
        }
        return { prims, closed: !!e.closed };
      }
      case "ellipse": case "spline": return K.path(K.toPline(e));
      default: return null;
    }
  };
  K.pAt = (pr, f) => (pr.k === "s" ? G.lerp(pr.a, pr.b, f) : G.polar(pr.c, pr.sa + pr.sw * f, pr.r));
  K.pLen = (pr) => (pr.k === "s" ? G.dist(pr.a, pr.b) : Math.abs(pr.sw) * pr.r);
  /** local parameter (0..1) of a point lying on the primitive */
  K.pPar = (pr, p) => {
    if (pr.k === "s") { const d = G.sub(pr.b, pr.a), l2 = G.dot(d, d) || 1; return G.dot(G.sub(p, pr.a), d) / l2; }
    const a = G.ang(pr.c, p), S = Math.abs(pr.sw), g = pr.sw > 0 ? G.norm(a - pr.sa) : G.norm(pr.sa - a);
    if (g <= S + 1e-9 || S >= TAU - 1e-9) return g / S;
    return g - S > (TAU - S) / 2 ? (g - TAU) / S : g / S;
  };
  /** sub-primitive between local parameters f0 < f1 */
  K.pSub = (pr, f0, f1) => (pr.k === "s" ? { k: "s", a: G.lerp(pr.a, pr.b, f0), b: G.lerp(pr.a, pr.b, f1) } : { k: "a", c: pr.c, r: pr.r, sa: pr.sa + pr.sw * f0, sw: pr.sw * (f1 - f0) });
  K.pAsPrim = (pr) => (pr.k === "s" ? pr : pr.sw > 0 ? { k: "a", c: pr.c, r: pr.r, a0: pr.sa, a1: pr.sa + pr.sw, full: Math.abs(pr.sw) >= TAU - 1e-9 } : { k: "a", c: pr.c, r: pr.r, a0: pr.sa + pr.sw, a1: pr.sa, full: Math.abs(pr.sw) >= TAU - 1e-9 });
  K.pathPoint = (P, s) => { const n = P.prims.length, i = Math.min(n - 1, Math.max(0, Math.floor(s))); return K.pAt(P.prims[i], s - i); };
  K.pathLen = (P) => P.prims.reduce((t, p) => t + K.pLen(p), 0);
  /** path parameter at a distance along the path */
  K.pathAtLen = (P, L) => { let acc = 0; for (let i = 0; i < P.prims.length; i++) { const l = K.pLen(P.prims[i]); if (acc + l >= L - 1e-12) return i + (l ? (L - acc) / l : 0); acc += l; } return P.prims.length; };
  /** the part of a path between global parameters s0 < s1 (with wrap-around for closed paths when s1 > n) */
  K.subPath = (P, s0, s1) => {
    const n = P.prims.length, out = [];
    if (P.closed && s1 < s0) s1 += n;
    let s = s0;
    while (s < s1 - 1e-12) {
      const i = Math.floor(s + 1e-12), k = i % n, f0 = s - i, f1 = Math.min(1, s1 - i);
      if (f1 - f0 > 1e-10) out.push(K.pSub(P.prims[k], f0, f1));
      s = i + 1;
    }
    return out;
  };
  /** entities rebuilt from a run of primitives, in the style of the source entity */
  K.fromPrims = (src, prims, closed) => {
    const base = Object.assign(K.props(src), { id: K.uid() });
    if (!prims.length) return null;
    if (prims.length === 1 && !closed && src.t !== "pline") {
      const p = prims[0];
      if (p.k === "s") return Object.assign(base, { t: "line", a: p.a, b: p.b });
      const q = K.pAsPrim(p); return Object.assign(base, { t: "arc", c: p.c, r: p.r, a0: q.a0, a1: q.a1 });
    }
    if (closed && prims.length === 1 && prims[0].k === "a" && Math.abs(prims[0].sw) >= TAU - 1e-9) return Object.assign(base, { t: "circle", c: prims[0].c, r: prims[0].r });
    const pts = prims.map((p) => { const a = K.pAt(p, 0); return [a[0], a[1], p.k === "a" ? Math.tan(p.sw / 4) : 0]; });
    if (!closed) { const e = K.pAt(prims[prims.length - 1], 1); pts.push([e[0], e[1], 0]); }
    const out = Object.assign(base, { t: "pline", pts, closed: !!closed }); if (src.w) out.w = src.w; return out;
  };
  /** global parameters where other primitives cross the path (sorted) */
  K.pathCuts = (P, others, self) => {
    const cuts = [];
    P.prims.forEach((pr, i) => {
      const A = K.pAsPrim(pr);
      for (const Q of others) for (const x of G.ix(A, Q, false, false)) { const f = K.pPar(pr, x); if (f >= -1e-9 && f <= 1 + 1e-9) cuts.push(i + Math.max(0, Math.min(1, f))); }
      if (self) P.prims.forEach((pr2, j) => { if (Math.abs(i - j) < 2 || (P.closed && Math.abs(i - j) === P.prims.length - 1)) return; for (const x of G.ix(A, K.pAsPrim(pr2), false, false)) cuts.push(i + K.pPar(pr, x)); });
    });
    cuts.sort((a, b) => a - b);
    return cuts.filter((c, k) => k === 0 || c - cuts[k - 1] > 1e-9);
  };
  /** nearest global parameter to a point */
  K.pathParam = (P, p) => { let best = 0, bd = Infinity; P.prims.forEach((pr, i) => { const q = G.closest(p, K.pAsPrim(pr)), d = G.dist(p, q); if (d < bd) { bd = d; best = i + Math.max(0, Math.min(1, K.pPar(pr, q))); } }); return best; };

  /* ---------- dimensions ---------- */
  /** the dimension style of a dimension: Standard (doc.dim) ← named style ← its own overrides; annotative scale applied */
  K.dimStyle = (e, doc) => { const D = Object.assign({}, doc.dim, (doc.dimstyles || {})[e.sty] || {}, e.st || {}); if (e.anno || D.anno) D.scale = (D.scale || 1) * K.annoF(); return D; };
  /** annotative factor: model units per paper mm at the current annotation scale (1 when not used) */
  K.annoF = () => (K.view && K.view.anno ? K.view.anno : 1);
  K.dimText = (e, doc) => {
    const D = K.dimStyle(e, doc), fm = (v) => (D.pre || "") + K.fmt(v * (D.lfac || 1), D.dec) + (D.sfx || "");
    let v = "";
    if (e.kind === "lin" || e.kind === "ali") { const u = K.dimDir(e); v = fm(Math.abs(G.dot(G.sub(e.p2, e.p1), u))); }
    else if (e.kind === "rad") v = "R" + fm(e.r);
    else if (e.kind === "dia") v = "Ø" + fm(e.r * 2);
    else if (e.kind === "ang") { const A = K.dimAng(e); v = K.fmt(A.sw / D2R, D.adec) + "°"; }
    else if (e.kind === "ord") v = fm(e.dir === "x" ? e.p1[0] - (e.o ? e.o[0] : 0) : e.p1[1] - (e.o ? e.o[1] : 0));
    if (e.txt != null && e.txt !== "") return String(e.txt).replace("<>", v);
    return v;
  };
  K.dimDir = (e) => (e.kind === "ali" ? G.unit(G.sub(e.p2, e.p1)) : e.dir === "v" ? [0, 1] : e.dir === "r" ? [Math.cos(e.rot || 0), Math.sin(e.rot || 0)] : [1, 0]);
  K.dimAng = (e) => {
    const a1 = G.ang(e.c, e.p1), a2 = G.ang(e.c, e.p2), al = G.ang(e.c, e.loc);
    return G.inSweep(al, a1, a2) ? { a0: a1, a1: a2, sw: G.sweep(a1, a2) } : { a0: a2, a1: a1, sw: G.sweep(a2, a1) };
  };
  const arrow = (tip, dir, as) => { const n = [-dir[1], dir[0]], b = G.sub(tip, G.mul(dir, as)), w = as / 6; return { t: "hatch", solid: true, loops: [[tip, G.add(b, G.mul(n, w)), G.sub(b, G.mul(n, w))]] }; };
  const readable = (a) => { a = G.norm(a); return a > Math.PI / 2 + 1e-6 && a <= 1.5 * Math.PI + 1e-6 ? a - Math.PI : a; };
  /** the pieces a dimension is drawn with (world entities; colour/layer inherited from the dimension) */
  K.dimGeom = (e, doc) => {
    const D = K.dimStyle(e, doc), k = D.scale || 1, as = D.as * k, th = D.th * k, exo = D.exo * k, exe = D.exe * k, gap = D.gap * k, out = [], txt = K.dimText(e, doc);
    const L = (a, b) => out.push({ t: "line", a, b }), T = (p, rot, ha = 1) => out.push(...K.dimTextGeom(e, D, txt, p, rot, ha, th, gap));
    const tw = K.dimTextW(e, D, txt, th, gap);
    if (e.kind === "lin" || e.kind === "ali") {
      const u = K.dimDir(e), d1 = G.add(e.loc, G.mul(u, G.dot(G.sub(e.p1, e.loc), u))), d2 = G.add(e.loc, G.mul(u, G.dot(G.sub(e.p2, e.loc), u)));
      for (const [p, d] of [[e.p1, d1], [e.p2, d2]]) { const v = G.sub(d, p), l = G.len(v); if (l > exo) { const w = G.unit(v); L(G.add(p, G.mul(w, exo)), G.add(d, G.mul(w, exe))); } }
      const len = G.dist(d1, d2), du = len > 1e-12 ? G.unit(G.sub(d2, d1)) : u, inside = len >= 2 * as + tw * 0.2;
      if (inside) { L(d1, d2); out.push(arrow(d1, G.mul(du, -1), as), arrow(d2, du, as)); }
      else { L(G.sub(d1, G.mul(du, as * 2)), G.add(d2, G.mul(du, as * 2))); out.push(arrow(d1, du, as), arrow(d2, G.mul(du, -1), as)); }
      let rot = readable(Math.atan2(du[1], du[0])), n = [-Math.sin(rot), Math.cos(rot)];
      let tp = e.tp ? e.tp : G.add(G.mid(d1, d2), G.mul(n, gap));
      if (!e.tp && tw + 2 * as > len && len > 0) tp = G.add(G.add(d2, G.mul(du, as * 2 + gap + tw / 2)), G.mul(n, gap));
      T(tp, rot, 1, 0);
    } else if (e.kind === "rad" || e.kind === "dia") {
      const dir = G.unit(G.sub(e.loc, e.c)), pc = G.add(e.c, G.mul(dir, e.r)), far = G.dist(e.loc, e.c) > e.r;
      if (e.kind === "rad") { L(far ? e.c : e.c, far ? e.loc : pc); out.push(arrow(pc, far ? G.mul(dir, -1) : dir, as)); }
      else { const pa = G.sub(e.c, G.mul(dir, e.r)); L(pa, far ? e.loc : pc); out.push(arrow(pc, dir, as), arrow(pa, G.mul(dir, -1), as)); }
      const ha = dir[0] >= 0 ? 0 : 2, land = G.add(e.loc, [dir[0] >= 0 ? as : -as, 0]);
      if (far) { L(e.loc, land); T(G.add(land, [dir[0] >= 0 ? gap : -gap, -th / 2]), 0, ha); }
      else { const rot = readable(Math.atan2(dir[1], dir[0])); T(G.add(G.mid(e.c, e.loc), G.mul([-Math.sin(rot), Math.cos(rot)], gap)), rot); }
    } else if (e.kind === "ang") {
      const A = K.dimAng(e), r = G.dist(e.c, e.loc), q0 = G.polar(e.c, A.a0, r), q1 = G.polar(e.c, A.a1, r);
      out.push({ t: "arc", c: e.c, r, a0: A.a0, a1: A.a1 });
      for (const p of [e.p1, e.p2]) { const ap = G.ang(e.c, p), dp = G.dist(e.c, p); if (dp < r - exo) L(G.polar(e.c, ap, dp + exo), G.polar(e.c, ap, r + exe)); }
      const cw = as / r; out.push(arrow(q0, G.unit(G.sub(q0, G.polar(e.c, A.a0 + cw, r))), as), arrow(q1, G.unit(G.sub(q1, G.polar(e.c, A.a1 - cw, r))), as));
      const am = A.a0 + A.sw / 2, rot = readable(am - Math.PI / 2), pm = G.polar(e.c, am, r + gap + (G.norm(am) > Math.PI ? th : 0));
      T(e.tp || pm, rot, 1, 0);
    } else if (e.kind === "ord") {
      L(G.add(e.p1, G.mul(G.unit(G.sub(e.loc, e.p1)), exo)), e.loc); T(G.add(e.loc, e.dir === "x" ? [th / 2, gap] : [gap, -th / 2]), e.dir === "x" ? Math.PI / 2 : 0, 0);
    }
    return out;
  };

  /* ---------- dimension text with tolerances: sym (±), dev (+/− stacked), lim (limits), basic (box) ---------- */
  const tolParts = (e, D, txt) => {
    const tt = e.tol || (D.tol && D.tol !== "none" ? { type: D.tol, up: D.tup, lo: D.tlo } : null); if (!tt || !tt.type || tt.type === "none") return null;
    const dec = D.tdec != null ? D.tdec : D.dec, f = (v) => K.fmt(+v || 0, dec), up = +tt.up || 0, lo = tt.lo == null || tt.lo === "" ? up : +tt.lo;
    if (tt.type === "sym") return { main: txt + " ±" + f(up) };
    if (tt.type === "basic") return { main: txt, box: true };
    if (tt.type === "dev") return { main: txt, a: (up >= 0 ? "+" : "") + f(up), b: (lo === 0 ? " " : "−") + f(Math.abs(lo)) };
    if (tt.type === "lim") { const m = String(txt).match(/^(\D*?)(-?[\d.]+)(.*)$/); if (!m) return { main: txt }; const v = parseFloat(m[2]); return { main: "", pre: m[1], a: m[1] + f(v + up) + m[3], b: m[1] + f(v - lo) + m[3], lim: true }; }
    return null;
  };
  K.dimTextW = (e, D, txt, th, gap) => { const t = tolParts(e, D, txt); if (!t) return G.textW(txt, th); const tf = D.tfac || 0.7; return G.textW(t.main, th) + (t.a ? G.textW(t.a.length > t.b.length ? t.a : t.b, th * (t.lim ? 1 : tf)) + (t.main ? gap : 0) : 0) + (t.box ? gap * 2 : 0); };
  K.dimTextGeom = (e, D, txt, p, rot, ha, th, gap) => {
    const t = tolParts(e, D, txt), out = [], W = K.dimTextW(e, D, txt, th, gap), x0 = ha === 1 ? -W / 2 : ha === 2 ? -W : 0, at = (x, y) => G.add(p, G.rotp([x, y], [0, 0], rot));
    if (!t) { out.push({ t: "text", p, h: th, s: txt, rot, ha, va: 0 }); return out; }
    const tf = t.lim ? 1 : D.tfac || 0.7, mw = G.textW(t.main, th);
    if (t.main) out.push({ t: "text", p: at(x0 + (t.box ? gap : 0), 0), h: th, s: t.main, rot, ha: 0, va: 0 });
    if (t.box) out.push({ t: "pline", closed: true, pts: [[x0, -gap], [x0 + W, -gap], [x0 + W, th + gap], [x0, th + gap]].map((q) => { const w = at(q[0], q[1]); return [w[0], w[1], 0]; }) });
    if (t.a) { const xs = x0 + mw + (t.main ? gap : 0), h2 = th * tf; out.push({ t: "text", p: at(xs, t.lim ? th * 0.62 : th * 0.55), h: t.lim ? th * 0.7 : h2, s: t.a, rot, ha: 0, va: 0 }, { t: "text", p: at(xs, t.lim ? -th * 0.38 : -th * 0.2), h: t.lim ? th * 0.7 : h2, s: t.b, rot, ha: 0, va: 0 }); }
    return out;
  };

  /* ---------- leaders and multiline text ---------- */
  K.leaderGeom = (e, doc) => {
    const out = [], as = (doc.dim.as || 2.5) * (doc.dim.scale || 1), P = e.pts;
    for (let i = 0; i < P.length - 1; i++) out.push({ t: "line", a: P[i], b: P[i + 1] });
    if (P.length > 1) out.push(arrow(P[0], G.unit(G.sub(P[0], P[1])), as));
    if (e.style === "balloon" && P.length > 1) {
      const h = e.h || doc.dim.th * (doc.dim.scale || 1), r = e.br || h * 1.3, end = P[P.length - 1], prev = P[P.length - 2], c = G.add(end, G.mul(G.unit(G.sub(end, prev)), r));
      out.push({ t: "circle", c, r }, { t: "text", p: c, h, s: String(e.s || ""), rot: 0, ha: 1, va: 2 });
      return out;
    }
    if (e.s) {
      const end = P[P.length - 1], prev = P[P.length - 2] || end, right = end[0] >= prev[0], h = e.h || doc.dim.th * (doc.dim.scale || 1);
      const land = G.add(end, [right ? as : -as, 0]); out.push({ t: "line", a: end, b: land });
      out.push(...K.mtextLines({ t: "mtext", p: G.add(land, [right ? h * 0.4 : -h * 0.4, h * 0.5]), h, s: e.s, rot: 0, ap: right ? 1 : 3, w: 0 }));
    }
    return out;
  };
  K.wrap = (s, h, w) => {
    const out = [];
    for (const para of String(s).split("\n")) {
      if (!w) { out.push(para); continue; }
      let line = "";
      for (const word of para.split(/(\s+)/)) { const t = line + word; if (line && G.textW(t.trimEnd(), h) > w) { out.push(line.trimEnd()); line = word.trimStart(); } else line = t; }
      out.push(line);
    }
    return out;
  };
  K.mtextLines = (e) => {
    const lines = K.wrap(e.s, e.h, e.w), ap = e.ap || 1, row = Math.floor((ap - 1) / 3), col = (ap - 1) % 3, ls = e.h * 1.667, H = (lines.length - 1) * ls + e.h;
    const top = row === 0 ? 0 : row === 1 ? H / 2 : H, out = [];
    lines.forEach((s, i) => { if (!s) return; const local = [0, top - e.h - i * ls], p = G.add(e.p, G.rotp(local, [0, 0], e.rot || 0)); out.push({ t: "text", p, h: e.h, s, rot: e.rot || 0, ha: col, va: 0 }); });
    return out;
  };
  /** baseline anchor of a single-line text (va → baseline) */
  K.textBase = (e) => { const dy = e.va === 3 ? e.h : e.va === 2 ? e.h / 2 : 0; return dy ? G.add(e.p, G.rotp([0, -dy], [0, 0], e.rot || 0)) : e.p; };
  K.textBox = (e) => {
    const b = K.textBase(e), w = G.textW(e.s, e.h), x0 = e.ha === 1 ? -w / 2 : e.ha === 2 ? -w : 0, r = e.rot || 0;
    return [[x0, -e.h * 0.25], [x0 + w, -e.h * 0.25], [x0 + w, e.h * 1.05], [x0, e.h * 1.05]].map((p) => G.add(b, G.rotp(p, [0, 0], r)));
  };

  /* ---------- blocks: world entities of an insert (recursive) ---------- */
  K.expand = (e, doc, depth = 0) => {
    const B = doc.blocks[e.name]; if (!B || depth > 8) return [];
    const m0 = M.mul(M.insert(e), M.move(-B.base[0], -B.base[1])), out = [];
    const cols = e.cols || 1, rows = e.rows || 1;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const m = cols > 1 || rows > 1 ? M.mul(M.mul(M.move(e.p[0], e.p[1]), M.mul(M.rot([0, 0], e.rot || 0), M.move(c * (e.dc || 0), r * (e.dr || 0)))), M.mul(M.move(-e.p[0], -e.p[1]), m0)) : m0;
      for (const s0 of B.ents) {
        let s = s0;
        if (s.t === "attdef") { if (s.inv) continue; const v = e.attrs && e.attrs[s.tag] != null ? e.attrs[s.tag] : s.def || ""; if (v === "") continue; s = Object.assign({}, s, { t: "text", s: v }); }
        let w = K.xform(s, m);
        w.layer = !s.layer || s.layer === "0" ? e.layer : s.layer;
        if (!s.color && (!s.layer || s.layer === "0")) w.color = e.color || null; else if (s.color === "byblock") w.color = e.color || null;
        if (s.lt === "BYBLOCK" || (!s.lt && (!s.layer || s.layer === "0"))) w.lt = e.lt || null;
        if (w.t === "insert") out.push(...K.expand(w, doc, depth + 1)); else out.push(w);
      }
    }
    return out;
  };
  /** exploding one level (what EXPLODE does) */
  K.explodeEnt = (e, doc) => {
    const P = (x) => Object.assign(K.props(e), x, { id: K.uid() });
    switch (e.t) {
      case "insert": { const B = doc.blocks[e.name]; if (!B) return []; const m = M.mul(M.insert(e), M.move(-B.base[0], -B.base[1])); return B.ents.filter((s) => !(s.t === "attdef" && (s.inv || (e.attrs && e.attrs[s.tag] === "")))).map((s0) => { const s = s0.t === "attdef" ? Object.assign({}, s0, { t: "text", s: e.attrs && e.attrs[s0.tag] != null ? e.attrs[s0.tag] : s0.def || "" }) : s0; const w = K.xform(s, m); w.id = K.uid(); if (!s.layer || s.layer === "0") w.layer = e.layer; if (!s.color || s.color === "byblock") w.color = s.color === "byblock" || !s.layer || s.layer === "0" ? e.color || null : null; return w; }); }
      case "pline": return K.path(e).prims.map((p) => K.fromPrims(Object.assign({}, e, { t: "line" }), [p], false));
      case "dim": return K.dimGeom(e, doc).map((g) => P(g));
      case "leader": return K.leaderGeom(e, doc).map((g) => P(g));
      case "mtext": return K.mtextLines(e).map((g) => P(g));
      case "hatch": return K.hatchLines(e).map(([a, b]) => P({ t: "line", a, b }));
      case "ellipse": case "spline": return K.explodeEnt(K.toPline(e), doc);
      case "circle": return [];
      case "attdef": return [P({ t: "text", p: e.p, h: e.h, s: e.def || e.tag, rot: e.rot || 0, ha: e.ha || 0, va: e.va || 0 })];
      default: return K.EXT[e.t] ? K.EXT[e.t].geom(e, doc).map((g) => P(g)) : [];
    }
  };
  /* hatch pattern lines, cached per entity object */
  const hatchCache = new WeakMap();
  K.hatchLines = (e) => {
    if (e.solid) return []; let r = hatchCache.get(e); if (r) return r;
    const pat = K.PAT[e.pat] || K.PAT.ANSI31; r = [];
    for (const f of pat.f) r.push(...G.hatchSegs(e.loops, (e.ang || 0) + f.a * D2R, f.d * (e.sc || 1), (f.o || 0) * (e.sc || 1)));
    hatchCache.set(e, r); return r;
  };

  /* ---------- segments of anything (selection, extents) ---------- */
  K.segs = (e, doc) => {
    switch (e.t) {
      case "line": case "circle": case "arc": case "pline": case "ellipse": case "spline": return G.prims(e);
      case "xline": { const L = 1e7; return [{ k: "s", a: e.ray ? e.p : G.sub(e.p, G.mul(e.dir, L)), b: G.add(e.p, G.mul(e.dir, L)) }]; }
      case "leader": return [].concat(...K.leaderGeom(e, doc).map((g) => K.segs(g, doc)));
      case "point": return [{ k: "s", a: e.p, b: e.p }];
      case "text": return G.polySegs(K.textBox(e), true);
      case "mtext": return [].concat(...K.mtextLines(e).map((g) => K.segs(g, doc)));
      case "dim": return [].concat(...K.dimGeom(e, doc).map((g) => K.segs(g, doc)));
      case "hatch": return [].concat(...e.loops.map((l) => G.polySegs(l, true)));
      case "insert": return [].concat(...K.expand(e, doc).map((g) => K.segs(g, doc)));
      case "attdef": return G.polySegs(K.textBox(Object.assign({}, e, { s: e.tag })), true);
      default: return K.EXT[e.t] ? [].concat(...K.EXT[e.t].geom(e, doc).map((g) => K.segs(g, doc))) : [];
    }
  };
  const bbCache = new WeakMap();
  K.bbox = (e, doc) => {
    if (e.t === "xline") return null;
    let b = bbCache.get(e); if (b !== undefined) return b; b = null;
    for (const s of K.segs(e, doc)) b = G.mergeBounds(b, G.primBounds(s));
    bbCache.set(e, b); return b;
  };
  K.extents = (doc, ents) => { let b = null; for (const e of ents || doc.ents) { const L = K.layer(doc, e.layer); if (L.on === false || L.frozen) continue; b = G.mergeBounds(b, K.bbox(e, doc)); } return b; };
  K.hitDist = (e, p, doc) => {
    if (K.EXT[e.t]) { let d = Infinity; for (const w of K.EXT[e.t].geom(e, doc)) { const v = K.hitDist(w, p, doc); if (v < d) d = v; } return d; }
    if (e.t === "insert") { let d = Infinity; for (const w of K.expand(e, doc)) { const v = K.hitDist(w, p, doc); if (v < d) d = v; if (d === 0) break; } return d; }
    if (e.t === "hatch") { let inside = false; for (const l of e.loops) if (G.inPoly(p, l)) inside = !inside; if (inside) return 0; }
    if (e.t === "text") { if (G.inPoly(p, K.textBox(e))) return 0; }
    if (e.t === "mtext") { for (const l of K.mtextLines(e)) if (G.inPoly(p, K.textBox(l))) return 0; }
    let d = Infinity; for (const s of K.segs(e, doc)) { const v = G.distTo(p, s); if (v < d) d = v; }
    return d;
  };
  /** crossing test: does the entity touch the rectangle? */
  K.crosses = (e, r, doc) => {
    const b = K.bbox(e, doc); if (b && (b.x1 < r.x0 || b.x0 > r.x1 || b.y1 < r.y0 || b.y0 > r.y1)) return false;
    if (b && b.x0 >= r.x0 && b.x1 <= r.x1 && b.y0 >= r.y0 && b.y1 <= r.y1) return true;
    const edges = G.polySegs([[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]], true), inR = (p) => p[0] >= r.x0 && p[0] <= r.x1 && p[1] >= r.y0 && p[1] <= r.y1;
    for (const s of K.segs(e, doc)) {
      if (s.k === "s" && (inR(s.a) || inR(s.b))) return true;
      if (s.k === "a" && (G.primEnds(s).some(inR) || inR(G.primMid(s)))) return true;
      for (const ed of edges) if (G.ix(s, ed, false, false).length) return true;
    }
    if (e.t === "hatch" || e.t === "text") { const c = [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2]; if (K.hitDist(e, c, doc) === 0) return true; }
    return false;
  };
  K.inside = (e, r, doc) => { if (e.t === "xline") return false; const b = K.bbox(e, doc); return !!b && b.x0 >= r.x0 && b.x1 <= r.x1 && b.y0 >= r.y0 && b.y1 <= r.y1; };

  /* ---------- grips (editable points) ---------- */
  K.grips = (e) => {
    switch (e.t) {
      case "line": return [e.a, G.mid(e.a, e.b), e.b];
      case "circle": return [e.c, [e.c[0] + e.r, e.c[1]], [e.c[0], e.c[1] + e.r], [e.c[0] - e.r, e.c[1]], [e.c[0], e.c[1] - e.r]];
      case "arc": return [e.c, G.polar(e.c, e.a0, e.r), G.polar(e.c, e.a0 + G.sweep(e.a0, e.a1) / 2, e.r), G.polar(e.c, e.a1, e.r)];
      case "pline": return e.pts.map((p) => [p[0], p[1]]);
      case "spline": return e.pts.slice();
      case "leader": return e.pts.slice();
      case "ellipse": { const r = e.rot || 0; return [e.c, G.add(e.c, G.rotp([e.rx, 0], [0, 0], r)), G.add(e.c, G.rotp([0, e.ry], [0, 0], r)), G.add(e.c, G.rotp([-e.rx, 0], [0, 0], r)), G.add(e.c, G.rotp([0, -e.ry], [0, 0], r))]; }
      case "text": case "mtext": case "insert": case "point": case "attdef": return [e.p];
      case "xline": return [e.p];
      case "dim": return e.kind === "ang" ? [e.c, e.p1, e.p2, e.loc] : e.kind === "rad" || e.kind === "dia" ? [e.c, e.loc] : [e.p1, e.p2, e.loc];
      case "hatch": return [];
      default: return K.EXT[e.t] && K.EXT[e.t].grips ? K.EXT[e.t].grips(e) : e.p ? [e.p] : [];
    }
  };
  /** an entity with grip i moved to point q */
  K.gripMove = (e, i, q) => {
    const n = clone(e), dd = G.sub(q, K.grips(e)[i]);
    switch (e.t) {
      case "line": if (i === 0) n.a = q; else if (i === 2) n.b = q; else { n.a = G.add(e.a, dd); n.b = G.add(e.b, dd); } break;
      case "circle": if (i === 0) n.c = q; else n.r = Math.max(1e-6, G.dist(e.c, q)); break;
      case "arc": {
        if (i === 0) { n.c = q; break; }
        const p0 = G.polar(e.c, e.a0, e.r), pm = G.polar(e.c, e.a0 + G.sweep(e.a0, e.a1) / 2, e.r), p1 = G.polar(e.c, e.a1, e.r);
        const A = i === 1 ? G.arc3(q, pm, p1) : i === 2 ? G.arc3(p0, q, p1) : G.arc3(p0, pm, q);
        if (A) { n.c = A.c; n.r = A.r; n.a0 = A.a0; n.a1 = A.a1; } break;
      }
      case "pline": n.pts[i] = [q[0], q[1], e.pts[i][2] || 0]; break;
      case "spline": n.pts[i] = q; delete n.ctrl; delete n.knots; break;
      case "leader": n.pts[i] = q; break;
      case "ellipse": if (i === 0) n.c = q; else if (i % 2) n.rx = Math.max(1e-6, G.dist(e.c, q)); else n.ry = Math.max(1e-6, G.dist(e.c, q)); break;
      case "text": case "mtext": case "insert": case "point": case "xline": case "attdef": n.p = q; break;
      default: if (K.EXT[e.t] && K.EXT[e.t].gripMove) return K.EXT[e.t].gripMove(e, i, q); if (e.p) return K.xform(e, K.M.move(dd[0], dd[1]));
      case "dim": { const keys = e.kind === "ang" ? ["c", "p1", "p2", "loc"] : e.kind === "rad" || e.kind === "dia" ? ["c", "loc"] : ["p1", "p2", "loc"]; n[keys[i]] = q; if (keys[i] === "c" && e.loc && (e.kind === "rad" || e.kind === "dia")) n.loc = G.add(e.loc, dd); delete n.tp; break; }
    }
    return n;
  };

  /* ---------- painting ---------- */
  /** paint entities into a painter: P.style({color,lt,lw}), P.line, P.poly(pts,closed), P.arc(c,r,a0,a1), P.circle(c,r), P.text(base,h,s,rot,ha), P.fill(loops), P.point(p) */
  K.paint = (P, e, doc, inh) => {
    const L = K.layer(doc, e.layer);
    if (!inh) { if (L.on === false || L.frozen) return; }
    const col = e.color && e.color !== "byblock" ? e.color : inh && (!e.color || e.color === "byblock") && (!e.layer || e.layer === "0") ? inh.color : L.color;
    const lt = e.lt && e.lt !== "BYLAYER" && e.lt !== "BYBLOCK" ? e.lt : L.lt, lw = e.lw != null && e.lw >= 0 ? e.lw : L.lw;
    const st = { color: col, lt, lw, w: e.w || 0 };
    const sub = (arr, styleOverride) => { for (const g of arr) { const s2 = Object.assign({}, st, styleOverride || {}); P.style(Object.assign({}, s2, { lt: g.t === "hatch" || g.t === "text" ? "CONTINUOUS" : s2.lt })); draw(g); } };
    const draw = (g) => {
      switch (g.t) {
        case "line": P.line(g.a, g.b); break;
        case "xline": P.xline(g.p, g.dir, !!g.ray); break;
        case "circle": P.circle(g.c, g.r); break;
        case "arc": P.arc(g.c, g.r, g.a0, g.a1); break;
        case "pline": {
          const pts = []; for (const s of G.plineSegs(g)) { if (s.k === "s") { if (!pts.length) pts.push(s.a); pts.push(s.b); } else { const ap = G.arcPoints(s.c, s.r, s.a0, s.a1, P.tol); const arr = s.ccw ? ap : ap.reverse(); if (!pts.length) pts.push(arr[0]); pts.push(...arr.slice(1)); } }
          if (g.closed && pts.length > 1 && G.eq(pts[0], pts[pts.length - 1])) pts.pop();
          P.poly(pts, !!g.closed); break;
        }
        case "ellipse": P.poly(G.ellipsePoints(g, 120), g.a1 == null); break;
        case "spline": P.poly(G.splinePoints(g), false); break;
        case "point": P.point(g.p, doc.pdmode, doc.pdsize); break;
        case "text": if (g.s) P.text(K.textBase(g), g.h, g.s, g.rot || 0, g.ha === 2 ? 2 : g.ha === 1 || g.ha === 4 ? 1 : 0); break;
        case "mtext": for (const l of K.mtextLines(g)) P.text(K.textBase(l), l.h, l.s, l.rot || 0, l.ha); break;
        case "hatch": if (g.solid) P.fill(g.loops); else for (const [a, b] of K.hatchLines(g)) P.line(a, b); break;
        case "dim": sub(K.dimGeom(g, doc), { lt: "CONTINUOUS" }); P.style(st); break;
        case "leader": sub(K.leaderGeom(g, doc), { lt: "CONTINUOUS" }); P.style(st); break;
        case "insert": for (const w of K.expand(g, doc)) K.paint(P, w, doc, { color: col }); break;
        case "attdef": P.text(K.textBase(g), g.h, g.tag || "TAG", g.rot || 0, g.ha === 2 ? 2 : g.ha === 1 ? 1 : 0); break;
        default: if (K.EXT[g.t]) { sub(K.EXT[g.t].geom(g, doc), { lt: "CONTINUOUS" }); P.style(st); }
      }
    };
    P.style(st);
    draw(e);
  };

  /** canvas painter: world → screen by view {cx, cy, s, W, H}; ink maps colour 7 (white) on light paper */
  K.canvasPainter = (ctx, view, o) => {
    o = o || {}; const s = view.s, W2 = view.W / 2, H2 = view.H / 2, X = (p) => (p[0] - view.cx) * s + W2, Y = (p) => H2 - (p[1] - view.cy) * s;
    const ink = (c) => (o.override ? o.override : !c ? o.fg : o.light && /^#(ffffff|fff)$/i.test(c) ? o.fg : c);
    let lt = "CONTINUOUS", dashed = [];
    const P = {
      tol: 0.6 / s,
      style(st) {
        const c = ink(st.color); ctx.strokeStyle = c; ctx.fillStyle = c;
        let w = o.lwt ? Math.max(1, Math.round((st.lw || 0) * 3.78)) : 1; if (st.w) w = Math.max(w, st.w * s); if (o.width) w = o.width;
        ctx.lineWidth = w;
        lt = st.lt || "CONTINUOUS"; const def = K.LT[lt]; dashed = [];
        if (def && def.p.length) { const k = (o.ltscale || 1) * s, arr = def.p.map((v) => Math.max(v === 0 ? 0.6 : 1, Math.abs(v) * k)); if (arr.reduce((a, b) => a + b, 0) > 4) dashed = arr; }
        ctx.setLineDash(o.dash || dashed); ctx.lineCap = st.w ? "round" : "butt"; ctx.lineJoin = "round";
      },
      line(a, b) { ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke(); },
      xline(p, d, ray) { const L = (view.W + view.H) / s * 2; const a = ray ? p : G.sub(p, G.mul(d, L)), b = G.add(p, G.mul(d, L)); P.line(a, b); },
      poly(pts, closed) { if (pts.length < 2) return; ctx.beginPath(); ctx.moveTo(X(pts[0]), Y(pts[0])); for (let i = 1; i < pts.length; i++) ctx.lineTo(X(pts[i]), Y(pts[i])); if (closed) ctx.closePath(); ctx.stroke(); },
      circle(c, r) { ctx.beginPath(); ctx.arc(X(c), Y(c), Math.max(0.5, r * s), 0, TAU); ctx.stroke(); },
      arc(c, r, a0, a1) { ctx.beginPath(); ctx.arc(X(c), Y(c), Math.max(0.5, r * s), -a0, -a0 - G.sweep(a0, a1), true); ctx.stroke(); },
      text(b, h, str, rot, ha) {
        const px = h * s / 0.716; if (px < 1.2) { if (px * str.length > 2) { ctx.save(); ctx.globalAlpha = 0.5; const w = G.textW(str, h); const e2 = G.add(b, G.rotp([ha === 1 ? w / 2 : ha === 2 ? 0 : w, 0], [0, 0], rot)), s2 = G.add(b, G.rotp([ha === 1 ? -w / 2 : ha === 2 ? -w : 0, 0], [0, 0], rot)); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(X(s2), Y(s2)); ctx.lineTo(X(e2), Y(e2)); ctx.stroke(); ctx.restore(); } return; }
        ctx.save(); ctx.translate(X(b), Y(b)); ctx.rotate(-rot); ctx.font = px.toFixed(2) + "px Arial, Helvetica, sans-serif"; ctx.textBaseline = "alphabetic"; ctx.textAlign = ha === 1 ? "center" : ha === 2 ? "right" : "left"; ctx.fillText(str, 0, 0); ctx.restore();
      },
      fill(loops) { ctx.beginPath(); for (const l of loops) { if (l.length < 3) continue; ctx.moveTo(X(l[0]), Y(l[0])); for (let i = 1; i < l.length; i++) ctx.lineTo(X(l[i]), Y(l[i])); ctx.closePath(); } ctx.fill("evenodd"); },
      point(p, mode, size) {
        const x = X(p), y = Y(p), r = size > 0 ? size * s / 2 : size < 0 ? (-size / 100) * view.H / 2 : 4; ctx.setLineDash([]);
        ctx.beginPath(); if (mode === 0 || mode == null) { ctx.fillRect(x - 1, y - 1, 2, 2); return; }
        if ((mode & 3) === 2 || (mode & 3) === 3) { ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); }
        if ((mode & 3) === 3) { ctx.moveTo(x - r * 0.7, y - r * 0.7); ctx.lineTo(x + r * 0.7, y + r * 0.7); ctx.moveTo(x - r * 0.7, y + r * 0.7); ctx.lineTo(x + r * 0.7, y - r * 0.7); }
        if (mode & 32) { ctx.moveTo(x + r * 0.6, y); ctx.arc(x, y, r * 0.6, 0, TAU); }
        if (mode & 64) ctx.rect(x - r * 0.6, y - r * 0.6, r * 1.2, r * 1.2);
        if ((mode & 3) === 1) { /* nothing */ } else if (!(mode & 3)) ctx.fillRect(x - 1, y - 1, 2, 2);
        ctx.stroke();
      },
    };
    return P;
  };

  /** SVG painter (world units; the caller wraps it in a y-flipped group). mono = black lines */
  K.svgPainter = (o) => {
    o = o || {}; const out = [], f = (v) => (+v.toFixed(4)).toString();
    let att = "";
    const col = (c) => (o.mono ? "#000" : !c || /^#(ffffff|fff)$/i.test(c) ? "#000" : c);
    const P = {
      tol: o.tol || 0.05, out,
      style(st) {
        const c = col(st.color), w = Math.max(o.minw || 0.13, st.w ? Math.max(st.lw || 0.25, st.w * o.k) : st.lw || 0.25) / o.k, def = K.LT[st.lt];
        const da = def && def.p.length ? ` stroke-dasharray="${def.p.map((v) => f(Math.max(Math.abs(v) * (o.ltscale || 1), v === 0 ? w : 0))).join(" ")}"` : "";
        att = `stroke="${c}" stroke-width="${f(w)}"${da}`; P.fillc = c;
      },
      line(a, b) { out.push(`<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" ${att}/>`); },
      xline(p, d, ray) { const L = o.diag || 1e4; const a = ray ? p : G.sub(p, G.mul(d, L)), b = G.add(p, G.mul(d, L)); P.line(a, b); },
      poly(pts, closed) { if (pts.length < 2) return; out.push(`<${closed ? "polygon" : "polyline"} points="${pts.map((p) => f(p[0]) + "," + f(p[1])).join(" ")}" fill="none" ${att}/>`); },
      circle(c, r) { out.push(`<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(r)}" fill="none" ${att}/>`); },
      arc(c, r, a0, a1) { const sw = G.sweep(a0, a1), p = G.polar(c, a0, r), q = G.polar(c, a1, r); out.push(`<path d="M${f(p[0])} ${f(p[1])}A${f(r)} ${f(r)} 0 ${sw > Math.PI ? 1 : 0} 1 ${f(q[0])} ${f(q[1])}" fill="none" ${att}/>`); },
      text(b, h, s, rot, ha) { const e = String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); out.push(`<text transform="translate(${f(b[0])} ${f(b[1])}) rotate(${f(rot / D2R)}) scale(1 -1)" font-size="${f(h / 0.716)}" font-family="Arial, Helvetica, sans-serif" text-anchor="${ha === 1 ? "middle" : ha === 2 ? "end" : "start"}" fill="${P.fillc}" stroke="none">${e}</text>`); },
      fill(loops) { out.push(`<path d="${loops.map((l) => "M" + l.map((p) => f(p[0]) + " " + f(p[1])).join("L") + "Z").join("")}" fill="${P.fillc}" fill-rule="evenodd" stroke="none"/>`); },
      point(p, mode) { const r = 1; if (!mode) out.push(`<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(0.3)}" fill="${P.fillc}" stroke="none"/>`); else { P.line([p[0] - r, p[1] - r], [p[0] + r, p[1] + r]); P.line([p[0] - r, p[1] + r], [p[0] + r, p[1] - r]); } },
    };
    return P;
  };
  /** a whole drawing (or a window of it) as SVG. o: {box, widthMm, heightMm, k (mm per unit), mono, bg} */
  K.toSVG = (doc, o) => {
    o = o || {}; const box = o.box || K.extents(doc) || { x0: 0, y0: 0, x1: 100, y1: 100 };
    const bw = Math.max(box.x1 - box.x0, 1e-6), bh = Math.max(box.y1 - box.y0, 1e-6);
    const Wmm = o.widthMm || bw, Hmm = o.heightMm || bh, k = o.k || Math.min(Wmm / bw, Hmm / bh);
    const P = K.svgPainter({ k, mono: o.mono, ltscale: doc.ltscale, tol: 0.2 / k, diag: (bw + bh) * 2 });
    for (const e of doc.ents) K.paint(P, e, doc);
    const tx = (Wmm - bw * k) / 2 - box.x0 * k, ty = (Hmm - bh * k) / 2 + box.y1 * k;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${Wmm}mm" height="${Hmm}mm" viewBox="0 0 ${Wmm} ${Hmm}">${o.bg ? `<rect width="100%" height="100%" fill="${o.bg}"/>` : ""}<g transform="matrix(${k} 0 0 ${-k} ${tx} ${ty})" stroke-linecap="round" stroke-linejoin="round">${P.out.join("")}</g>${o.extra || ""}</svg>`;
  };
})((window.KCAD = window.KCAD || {}));
