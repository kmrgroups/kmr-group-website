/* KMR CAD Draft — geometry core (no DOM). Everything is plain numbers and arrays: points are [x, y].
   Primitives used for snapping, intersections, trim, offset …:
     {k:"s", a:[x,y], b:[x,y]}                         straight segment
     {k:"a", c:[x,y], r, a0, a1, full}                 arc, always counter-clockwise from a0 to a1 (full = whole circle)           */
(function (K) {
  "use strict";
  const TAU = Math.PI * 2, EPS = 1e-9;
  const G = (K.geom = {});
  G.TAU = TAU; G.EPS = EPS;

  /* ---------- vectors ---------- */
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]], mul = (a, k) => [a[0] * k, a[1] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1], cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  const len = (a) => Math.hypot(a[0], a[1]), dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const polar = (p, a, d) => [p[0] + d * Math.cos(a), p[1] + d * Math.sin(a)];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
  const rotp = (p, c, a) => { const s = Math.sin(a), co = Math.cos(a), x = p[0] - c[0], y = p[1] - c[1]; return [c[0] + x * co - y * s, c[1] + x * s + y * co]; };
  const norm = (a) => { a %= TAU; return a < 0 ? a + TAU : a; };
  const eq = (a, b, t = 1e-7) => Math.abs(a[0] - b[0]) < t && Math.abs(a[1] - b[1]) < t;
  Object.assign(G, { add, sub, mul, dot, cross, len, dist, ang, polar, mid, lerp, unit, rotp, norm, eq });

  /** true when angle a lies on the counter-clockwise sweep a0 → a1 */
  G.inSweep = (a, a0, a1) => { const s = norm(a1 - a0) || TAU; return norm(a - a0) <= s + 1e-9; };
  G.sweep = (a0, a1) => norm(a1 - a0) || TAU;

  /* ---------- polyline segments (with bulges) ---------- */
  /** bulge arc from p to q → CCW arc primitive (a0 → a1) plus the direction flag */
  G.bulgeArc = (p, q, b) => {
    const d = dist(p, q); if (d < EPS || Math.abs(b) < 1e-12) return null;
    const th = 4 * Math.atan(b), r = d / (2 * Math.sin(Math.abs(th) / 2));
    const m = mid(p, q), n = unit([-(q[1] - p[1]), q[0] - p[0]]), off = r * Math.cos(Math.abs(th) / 2);
    const cen = b > 0 ? [m[0] + n[0] * off, m[1] + n[1] * off] : [m[0] - n[0] * off, m[1] - n[1] * off];
    const a0 = ang(cen, p), a1 = ang(cen, q);
    return b > 0 ? { k: "a", c: cen, r, a0, a1, full: false, ccw: true } : { k: "a", c: cen, r, a0: a1, a1: a0, full: false, ccw: false };
  };
  /** the segments of a polyline entity as primitives, remembering start/end order */
  G.plineSegs = (e) => {
    const P = e.pts, n = P.length, out = [], cnt = e.closed ? n : n - 1;
    for (let i = 0; i < cnt; i++) {
      const p = P[i], q = P[(i + 1) % n], b = p[2] || 0;
      const arc = b ? G.bulgeArc(p, q, b) : null;
      if (arc) { arc.from = [p[0], p[1]]; arc.to = [q[0], q[1]]; out.push(arc); } else out.push({ k: "s", a: [p[0], p[1]], b: [q[0], q[1]] });
    }
    return out;
  };

  /* ---------- sampling curves ---------- */
  G.arcPoints = (c, r, a0, a1, tol = 0.05) => {
    const sw = G.sweep(a0, a1), steps = Math.max(4, Math.ceil(sw / (2 * Math.acos(Math.max(0, 1 - tol / Math.max(r, tol))) || 0.1)));
    const n = Math.min(steps, 720), out = [];
    for (let i = 0; i <= n; i++) out.push(polar(c, a0 + sw * i / n, r));
    return out;
  };
  G.ellipsePoints = (e, n = 96) => {
    const a0 = e.a0 || 0, a1 = e.a1 == null ? TAU : e.a1, sw = e.a1 == null ? TAU : G.sweep(a0, a1), cs = Math.cos(e.rot || 0), sn = Math.sin(e.rot || 0), out = [];
    for (let i = 0; i <= n; i++) { const t = a0 + sw * i / n, x = e.rx * Math.cos(t), y = e.ry * Math.sin(t); out.push([e.c[0] + x * cs - y * sn, e.c[1] + x * sn + y * cs]); }
    return out;
  };
  /** centripetal Catmull-Rom through fit points (drawing of splines that are defined by fit points) */
  G.splinePoints = (e, per = 14) => {
    if (e.ctrl && e.knots) return G.bsplinePoints(e);
    const P = e.pts.slice(); if (P.length < 3) return P;
    const Q = e.closed ? [P[P.length - 1], ...P, P[0], P[1]] : [P[0], ...P, P[P.length - 1]], out = [];
    const tj = (t, a, b) => t + Math.pow(Math.max(dist(a, b), 1e-9), 0.5);
    for (let i = 0; i < Q.length - 3; i++) {
      const p0 = Q[i], p1 = Q[i + 1], p2 = Q[i + 2], p3 = Q[i + 3];
      const t0 = 0, t1 = tj(t0, p0, p1), t2 = tj(t1, p1, p2), t3 = tj(t2, p2, p3);
      for (let k = 0; k < per; k++) {
        const t = t1 + (t2 - t1) * k / per;
        const L = (a, b, ta, tb) => mul(add(mul(a, tb - t), mul(b, t - ta)), 1 / (tb - ta));
        const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3), B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
        out.push(L(B1, B2, t1, t2));
      }
    }
    out.push(e.closed ? out[0] : P[P.length - 1]);
    return out;
  };
  /** B-spline from DXF (degree, knots, control points) — Cox-de Boor */
  G.bsplinePoints = (e) => {
    const p = e.deg || 3, U = e.knots, P = e.ctrl, n = P.length - 1; if (n < p) return P;
    const lo = U[p], hi = U[n + 1], out = [], N = Math.max(40, P.length * 12);
    const span = (u) => { if (u >= hi) return n; let k = p; while (k < n && u >= U[k + 1]) k++; return k; };
    for (let i = 0; i <= N; i++) {
      const u = lo + (hi - lo) * i / N, k = span(u), d = [];
      for (let j = 0; j <= p; j++) d.push(P[k - p + j].slice(0, 2));
      for (let r = 1; r <= p; r++) for (let j = p; j >= r; j--) {
        const den = U[j + 1 + k - r] - U[k - p + j], a = den ? (u - U[k - p + j]) / den : 0;
        d[j] = [(1 - a) * d[j - 1][0] + a * d[j][0], (1 - a) * d[j - 1][1] + a * d[j][1]];
      }
      out.push(d[p]);
    }
    return out;
  };

  /* ---------- primitives of an entity (for snap / trim / offset) ---------- */
  G.prims = (e, blocks) => {
    switch (e.t) {
      case "line": return [{ k: "s", a: e.a, b: e.b }];
      case "circle": return [{ k: "a", c: e.c, r: e.r, a0: 0, a1: TAU, full: true }];
      case "arc": return [{ k: "a", c: e.c, r: e.r, a0: e.a0, a1: e.a1, full: false }];
      case "pline": return G.plineSegs(e);
      case "ellipse": return G.polySegs(G.ellipsePoints(e), !!(e.a1 == null));
      case "spline": return G.polySegs(G.splinePoints(e), false);
      case "leader": return G.polySegs(e.pts, false);
      case "hatch": return [];
      default: return [];
    }
  };
  G.polySegs = (pts, closed) => { const out = []; for (let i = 0; i < pts.length - 1; i++) out.push({ k: "s", a: pts[i], b: pts[i + 1] }); if (closed && pts.length > 2 && !eq(pts[0], pts[pts.length - 1])) out.push({ k: "s", a: pts[pts.length - 1], b: pts[0] }); return out; };
  G.primEnds = (p) => (p.k === "s" ? [p.a, p.b] : p.full ? [] : [polar(p.c, p.a0, p.r), polar(p.c, p.a1, p.r)]);
  G.primMid = (p) => (p.k === "s" ? mid(p.a, p.b) : polar(p.c, p.a0 + G.sweep(p.a0, p.a1) / 2, p.r));
  G.primLen = (p) => (p.k === "s" ? dist(p.a, p.b) : p.r * (p.full ? TAU : G.sweep(p.a0, p.a1)));

  /* ---------- distance and closest point ---------- */
  G.closestSeg = (p, a, b) => { const d = sub(b, a), l2 = dot(d, d); if (l2 < EPS) return a; const t = Math.max(0, Math.min(1, dot(sub(p, a), d) / l2)); return add(a, mul(d, t)); };
  G.closestArc = (p, A) => {
    const a = ang(A.c, p);
    if (A.full || G.inSweep(a, A.a0, A.a1)) { if (dist(p, A.c) < EPS) return polar(A.c, A.a0, A.r); return polar(A.c, a, A.r); }
    const e = G.primEnds(A); return dist(p, e[0]) < dist(p, e[1]) ? e[0] : e[1];
  };
  G.closest = (p, P) => (P.k === "s" ? G.closestSeg(p, P.a, P.b) : G.closestArc(p, P));
  G.distTo = (p, P) => dist(p, G.closest(p, P));

  /* ---------- intersections ---------- */
  /** ext = treat as infinite line / full circle */
  G.ixSS = (s1, s2, ext1, ext2) => {
    const r = sub(s1.b, s1.a), s = sub(s2.b, s2.a), d = cross(r, s); if (Math.abs(d) < EPS) return [];
    const q = sub(s2.a, s1.a), t = cross(q, s) / d, u = cross(q, r) / d, e = 1e-9;
    if (!ext1 && (t < -e || t > 1 + e)) return []; if (!ext2 && (u < -e || u > 1 + e)) return [];
    return [add(s1.a, mul(r, t))];
  };
  G.ixSA = (s, A, extS, extA) => {
    const d = sub(s.b, s.a), f = sub(s.a, A.c), a = dot(d, d); if (a < EPS) return [];
    const b = 2 * dot(f, d), c = dot(f, f) - A.r * A.r, disc = b * b - 4 * a * c; if (disc < -1e-9) return [];
    const sq = Math.sqrt(Math.max(0, disc)), ts = disc < 1e-9 ? [-b / (2 * a)] : [(-b - sq) / (2 * a), (-b + sq) / (2 * a)], out = [];
    for (const t of ts) {
      if (!extS && (t < -1e-9 || t > 1 + 1e-9)) continue;
      const p = add(s.a, mul(d, t)); if (!extA && !A.full && !G.inSweep(ang(A.c, p), A.a0, A.a1)) continue; out.push(p);
    }
    return out;
  };
  G.ixAA = (A, B, extA, extB) => {
    const d = dist(A.c, B.c); if (d < EPS || d > A.r + B.r + 1e-9 || d < Math.abs(A.r - B.r) - 1e-9) return [];
    const a = (A.r * A.r - B.r * B.r + d * d) / (2 * d), h = Math.sqrt(Math.max(0, A.r * A.r - a * a)), u = unit(sub(B.c, A.c)), m = add(A.c, mul(u, a)), out = [];
    const cand = h < 1e-7 ? [m] : [[m[0] - u[1] * h, m[1] + u[0] * h], [m[0] + u[1] * h, m[1] - u[0] * h]];
    for (const p of cand) { if (!extA && !A.full && !G.inSweep(ang(A.c, p), A.a0, A.a1)) continue; if (!extB && !B.full && !G.inSweep(ang(B.c, p), B.a0, B.a1)) continue; out.push(p); }
    return out;
  };
  G.ix = (P, Q, extP, extQ) => {
    if (P.k === "s" && Q.k === "s") return G.ixSS(P, Q, extP, extQ);
    if (P.k === "s") return G.ixSA(P, Q, extP, extQ);
    if (Q.k === "s") return G.ixSA(Q, P, extQ, extP);
    return G.ixAA(P, Q, extP, extQ);
  };

  /* ---------- offset, trim helpers ---------- */
  /** offset one primitive by distance d towards point `side` (d > 0). Returns the new primitive or null */
  G.offsetPrim = (P, d, side) => {
    if (P.k === "s") {
      const dir = unit(sub(P.b, P.a)), n = [-dir[1], dir[0]], sg = dot(sub(side, P.a), n) >= 0 ? 1 : -1, o = mul(n, d * sg);
      return { k: "s", a: add(P.a, o), b: add(P.b, o) };
    }
    const inside = dist(side, P.c) < P.r, r = inside ? P.r - d : P.r + d; if (r <= 1e-9) return null;
    return Object.assign({}, P, { r });
  };
  /** parameter of a point along a primitive, for ordering cut points */
  G.param = (P, p) => (P.k === "s" ? dot(sub(p, P.a), sub(P.b, P.a)) / (dot(sub(P.b, P.a), sub(P.b, P.a)) || 1) : G.norm(ang(P.c, p) - P.a0) / (G.sweep(P.a0, P.a1)));

  /* ---------- polygons ---------- */
  G.area = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  G.inPoly = (p, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  /** closed outline of an entity as points (for hatch / area); null when the entity is not closed */
  G.outline = (e, tol = 0.05) => {
    if (e.t === "circle") return G.arcPoints(e.c, e.r, 0, TAU, tol).slice(0, -1);
    if (e.t === "ellipse" && e.a1 == null) return G.ellipsePoints(e).slice(0, -1);
    if (e.t === "pline" && (e.closed || (e.pts.length > 2 && eq(e.pts[0], e.pts[e.pts.length - 1])))) {
      const out = []; const segs = G.plineSegs(Object.assign({}, e, { closed: true }));
      for (const s of segs) { if (s.k === "s") out.push(s.a); else { const pts = G.arcPoints(s.c, s.r, s.a0, s.a1, tol); const arr = s.ccw ? pts : pts.reverse(); out.push(...arr.slice(0, -1)); } }
      return out;
    }
    if (e.t === "spline" && e.closed) return G.splinePoints(e).slice(0, -1);
    return null;
  };
  /** clip an infinite family of parallel lines to a polygon set (even-odd): returns [a,b] segments */
  G.hatchSegs = (loops, angle, spacing, phase = 0) => {
    const out = [], ca = Math.cos(angle), sa = Math.sin(angle);
    const to = (p) => [p[0] * ca + p[1] * sa, -p[0] * sa + p[1] * ca], from = (p) => [p[0] * ca - p[1] * sa, p[0] * sa + p[1] * ca];
    const L = loops.map((l) => l.map(to)); let y0 = Infinity, y1 = -Infinity;
    for (const l of L) for (const p of l) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    if (!isFinite(y0) || spacing <= 0) return out;
    const n0 = Math.ceil((y0 - phase) / spacing), n1 = Math.floor((y1 - phase) / spacing); if (n1 - n0 > 4000) return out;
    for (let k = n0; k <= n1; k++) {
      const y = phase + k * spacing + 1e-7, xs = [];
      for (const l of L) for (let i = 0; i < l.length; i++) {
        const a = l[i], b = l[(i + 1) % l.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((u, v) => u - v);
      for (let i = 0; i + 1 < xs.length; i += 2) out.push([from([xs[i], y]), from([xs[i + 1], y])]);
    }
    return out;
  };

  /* ---------- extents ---------- */
  G.bounds = (pts) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; } return isFinite(x0) ? { x0, y0, x1, y1 } : null; };
  G.primBounds = (P) => {
    if (P.k === "s") return G.bounds([P.a, P.b]);
    if (P.full) return { x0: P.c[0] - P.r, y0: P.c[1] - P.r, x1: P.c[0] + P.r, y1: P.c[1] + P.r };
    const pts = G.primEnds(P); for (const a of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) if (G.inSweep(a, P.a0, P.a1)) pts.push(polar(P.c, a, P.r));
    return G.bounds(pts);
  };
  G.mergeBounds = (a, b) => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });

  /* ---------- circle / arc construction ---------- */
  G.circle3 = (p, q, r) => {
    const d = 2 * (p[0] * (q[1] - r[1]) + q[0] * (r[1] - p[1]) + r[0] * (p[1] - q[1])); if (Math.abs(d) < EPS) return null;
    const ux = ((p[0] ** 2 + p[1] ** 2) * (q[1] - r[1]) + (q[0] ** 2 + q[1] ** 2) * (r[1] - p[1]) + (r[0] ** 2 + r[1] ** 2) * (p[1] - q[1])) / d;
    const uy = ((p[0] ** 2 + p[1] ** 2) * (r[0] - q[0]) + (q[0] ** 2 + q[1] ** 2) * (p[0] - r[0]) + (r[0] ** 2 + r[1] ** 2) * (q[0] - p[0])) / d;
    return { c: [ux, uy], r: Math.hypot(p[0] - ux, p[1] - uy) };
  };
  /** arc through three points → {c,r,a0,a1} counter-clockwise from the start point to the end point or reversed */
  G.arc3 = (p, q, r) => {
    const c3 = G.circle3(p, q, r); if (!c3) return null;
    const a = ang(c3.c, p), b = ang(c3.c, q), c = ang(c3.c, r);
    // is q on the CCW sweep from p to r ?
    return G.inSweep(b, a, c) ? { c: c3.c, r: c3.r, a0: a, a1: c } : { c: c3.c, r: c3.r, a0: c, a1: a };
  };
  /** tangent-tangent-radius fillet between two infinite lines (a1-a2, b1-b2) keeping the corner nearest to the picks */
  G.filletLines = (L1, L2, r, pick1, pick2) => {
    const X = G.ixSS(L1, L2, true, true)[0]; if (!X) return null;
    const far = (L, pk) => { const da = dist(L.a, X), db = dist(L.b, X); void pk; return da > db ? L.a : L.b; };
    const d1 = unit(sub(dot(sub(pick1, X), sub(L1.b, L1.a)) >= 0 ? L1.b : L1.a, X)), d2 = unit(sub(dot(sub(pick2, X), sub(L2.b, L2.a)) >= 0 ? L2.b : L2.a, X));
    void far;
    const ang2 = Math.acos(Math.max(-1, Math.min(1, dot(d1, d2)))); if (ang2 < 1e-6 || Math.abs(ang2 - Math.PI) < 1e-6) return null;
    if (r <= 0) return { X, t1: X, t2: X, r: 0 };
    const t = r / Math.tan(ang2 / 2), t1 = add(X, mul(d1, t)), t2 = add(X, mul(d2, t)), bis = unit(add(d1, d2)), c = add(X, mul(bis, r / Math.sin(ang2 / 2)));
    return { X, t1, t2, c, r, d1, d2 };
  };

  /* ---------- text size estimate (hit-testing, extents) ---------- */
  G.textW = (s, h) => { let w = 0; for (const ch of String(s)) w += /[ilIjt.,:;|!'1]/.test(ch) ? 0.34 : /[mwMW@%]/.test(ch) ? 0.95 : /[A-Z0-9]/.test(ch) ? 0.68 : 0.58; return w * h; };
})((window.KCAD = window.KCAD || {}));
