/* KMR CAD Draft — parametric drawing: geometric constraints (horizontal, vertical, parallel, perpendicular, coincident,
   concentric, equal, fix, tangent, collinear) and dimensional constraints (distance, horizontal / vertical distance, radius,
   diameter, angle) with named parameters and formulas, solved numerically (Levenberg–Marquardt + minimal-norm polish). */
(function (K) {
  "use strict";
  const G = K.geom, D2R = Math.PI / 180, cmd = K.cmd, esc = K.esc, isP = Array.isArray;
  const need = (v) => { if (v == null) throw K.CANCEL; return v; };

  /* ---------- entity ↔ variables ---------- */
  const enc = (e) => {
    switch (e.t) {
      case "line": return [e.a[0], e.a[1], e.b[0], e.b[1]];
      case "circle": return [e.c[0], e.c[1], e.r];
      case "arc": return [e.c[0], e.c[1], e.r, e.a0, e.a1];
      case "pline": return e.pts.flatMap((p) => [p[0], p[1]]);
      case "point": case "text": case "insert": case "mtext": return [e.p[0], e.p[1]];
      default: return null;
    }
  };
  const dec = (e, v) => {
    const n = Object.assign({}, e);
    switch (e.t) {
      case "line": n.a = [v[0], v[1]]; n.b = [v[2], v[3]]; break;
      case "circle": n.c = [v[0], v[1]]; n.r = Math.abs(v[2]); break;
      case "arc": n.c = [v[0], v[1]]; n.r = Math.abs(v[2]); n.a0 = v[3]; n.a1 = v[4]; break;
      case "pline": n.pts = e.pts.map((p, i) => [v[2 * i], v[2 * i + 1], p[2] || 0]); break;
      default: n.p = [v[0], v[1]];
    }
    return n;
  };
  /** a point handle of an entity from its variables */
  const hp = (t, k, v) => {
    if (t === "line") return k === "a" ? [v[0], v[1]] : k === "b" ? [v[2], v[3]] : [(v[0] + v[2]) / 2, (v[1] + v[3]) / 2];
    if (t === "circle") return [v[0], v[1]];
    if (t === "arc") return k === "s" ? [v[0] + v[2] * Math.cos(v[3]), v[1] + v[2] * Math.sin(v[3])] : k === "e" ? [v[0] + v[2] * Math.cos(v[4]), v[1] + v[2] * Math.sin(v[4])] : [v[0], v[1]];
    if (t === "pline") { const i = +k.slice(1); return [v[2 * i], v[2 * i + 1]]; }
    return [v[0], v[1]];
  };
  /** a straight piece: a line or one segment of a polyline */
  const hl = (t, k, v) => { if (t === "line") return [[v[0], v[1]], [v[2], v[3]]]; if (t === "pline") { const i = +k.slice(1), n = v.length / 2, j = (i + 1) % n; return [[v[2 * i], v[2 * i + 1]], [v[2 * j], v[2 * j + 1]]]; } return null; };
  const hc = (t, v) => (t === "circle" || t === "arc" ? { c: [v[0], v[1]], r: Math.abs(v[2]) } : null);
  K.handles = (e) => {
    switch (e.t) {
      case "line": return [["a", e.a], ["b", e.b], ["m", G.mid(e.a, e.b)]];
      case "circle": return [["c", e.c]];
      case "arc": return [["c", e.c], ["s", G.polar(e.c, e.a0, e.r)], ["e", G.polar(e.c, e.a1, e.r)]];
      case "pline": return e.pts.map((p, i) => ["v" + i, [p[0], p[1]]]);
      case "point": case "text": case "insert": return [["p", e.p]];
      default: return [];
    }
  };

  /* ---------- parameters and formulas ---------- */
  const SAFE = /^[\s\d.+\-*/()%,a-zA-Z_]*$/;
  K.paramValues = (doc) => {
    const out = {}, items = (doc.params || []).map((p) => ({ name: p.name, expr: p.expr })).concat((doc.cons || []).filter((c) => c.name).map((c) => ({ name: c.name, expr: c.expr })));
    for (let pass = 0; pass < items.length + 2; pass++) for (const it of items) { const v = K.evalExpr(it.expr, out); if (isFinite(v)) out[it.name] = v; }
    return out;
  };
  K.evalExpr = (expr, vars) => {
    let s = String(expr == null ? "" : expr).trim(); if (!s) return NaN; if (!SAFE.test(s)) return NaN;
    s = s.replace(/[a-zA-Z_][a-zA-Z_0-9]*/g, (w) => (Object.prototype.hasOwnProperty.call(vars, w) ? "(" + vars[w] + ")" : ({ sqrt: "Math.sqrt", abs: "Math.abs", min: "Math.min", max: "Math.max", round: "Math.round", pi: "Math.PI", PI: "Math.PI", sin: "_s", cos: "_c", tan: "_t" })[w] || "NaN"));
    try { const v = Function("_s", "_c", "_t", '"use strict";return (' + s + ")")((d) => Math.sin(d * D2R), (d) => Math.cos(d * D2R), (d) => Math.tan(d * D2R)); return typeof v === "number" ? v : NaN; } catch (e) { return NaN; }
  };

  /* ---------- residuals ---------- */
  const lenV = (a) => Math.hypot(a[0], a[1]) || 1e-12;
  const resid = (c, get, P) => {
    const R = c.refs, A = get(R[0]), B = R[1] ? get(R[1]) : null, val = P && c.name ? P[c.name] : NaN;
    switch (c.type) {
      case "coincident": { const p = hp(A.t, R[0].k, A.v), q = hp(B.t, R[1].k, B.v); return [p[0] - q[0], p[1] - q[1]]; }
      case "horizontal": { if (R.length === 2) { const p = hp(A.t, R[0].k, A.v), q = hp(B.t, R[1].k, B.v); return [p[1] - q[1]]; } const L = hl(A.t, R[0].k, A.v); return [L[0][1] - L[1][1]]; }
      case "vertical": { if (R.length === 2) { const p = hp(A.t, R[0].k, A.v), q = hp(B.t, R[1].k, B.v); return [p[0] - q[0]]; } const L = hl(A.t, R[0].k, A.v); return [L[0][0] - L[1][0]]; }
      case "parallel": case "perpendicular": case "collinear": {
        const L1 = hl(A.t, R[0].k, A.v), L2 = hl(B.t, R[1].k, B.v), u = G.sub(L1[1], L1[0]), w = G.sub(L2[1], L2[0]), n = lenV(u) * lenV(w);
        if (c.type === "perpendicular") return [G.dot(u, w) / n];
        const out = [G.cross(u, w) / n]; if (c.type === "collinear") out.push(G.cross(u, G.sub(L2[0], L1[0])) / lenV(u)); return out;
      }
      case "concentric": { const p = hc(A.t, A.v), q = hc(B.t, B.v); return [p.c[0] - q.c[0], p.c[1] - q.c[1]]; }
      case "equal": { const p = hc(A.t, A.v), q = hc(B.t, B.v); if (p && q) return [p.r - q.r]; const L1 = hl(A.t, R[0].k, A.v), L2 = hl(B.t, R[1].k, B.v); return [G.dist(L1[0], L1[1]) - G.dist(L2[0], L2[1])]; }
      case "fix": { const p = hp(A.t, R[0].k, A.v); return [p[0] - c.at[0], p[1] - c.at[1]]; }
      case "tangent": {
        const q = hc(B.t, B.v);
        if (A.t === "circle" || A.t === "arc") { const p = hc(A.t, A.v), d = G.dist(p.c, q.c); return [c.inner ? d - Math.abs(p.r - q.r) : d - (p.r + q.r)]; }
        const L = hl(A.t, R[0].k, A.v), u = G.sub(L[1], L[0]); return [(c.sg || 1) * G.cross(u, G.sub(q.c, L[0])) / lenV(u) - q.r];
      }
      case "dist": { const p = hp(A.t, R[0].k, A.v), q = hp(B.t, R[1].k, B.v); return [G.dist(p, q) - val]; }
      case "hdist": { const p = hp(A.t, R[0].k, A.v), q = hp(B.t, R[1].k, B.v); return [(c.sg || 1) * (q[0] - p[0]) - val]; }
      case "vdist": { const p = hp(A.t, R[0].k, A.v), q = hp(B.t, R[1].k, B.v); return [(c.sg || 1) * (q[1] - p[1]) - val]; }
      case "len": { const L = hl(A.t, R[0].k, A.v); return [G.dist(L[0], L[1]) - val]; }
      case "radius": return [hc(A.t, A.v).r - val];
      case "diameter": return [2 * hc(A.t, A.v).r - val];
      case "angle": { const L1 = hl(A.t, R[0].k, A.v), L2 = hl(B.t, R[1].k, B.v), u = G.sub(L1[1], L1[0]), w = G.sub(L2[1], L2[0]); let a = Math.atan2(G.cross(u, w), G.dot(u, w)) * (c.sg || 1) - val * D2R; a = Math.atan2(Math.sin(a), Math.cos(a)); return [a * 10]; }
    }
    return [];
  };
  K.consMeasure = (c, doc, byId) => { const get = (r) => { const e = byId(r.id); return { t: e.t, v: enc(e) }; }; const f = resid(Object.assign({}, c, { name: "_m" }), get, { _m: 0 }); return c.type === "angle" ? Math.abs(f[0] / 10 / D2R) : Math.abs(f[0]); };

  /* ---------- solver ---------- */
  const gauss = (A, b) => { const n = b.length; for (let i = 0; i < n; i++) { let m = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r; if (Math.abs(A[m][i]) < 1e-14) continue; [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]]; for (let r = 0; r < n; r++) { if (r === i) continue; const f = A[r][i] / A[i][i]; if (!f) continue; for (let c2 = i; c2 < n; c2++) A[r][c2] -= f * A[i][c2]; b[r] -= f * b[i]; } } return b.map((v, i) => (Math.abs(A[i][i]) < 1e-14 ? 0 : v / A[i][i])); };
  K.solveCons = (E, pinned) => {
    const doc = E.doc; if (!doc.cons || !doc.cons.length || (E.space && E.space.lay && !E.space.ms)) return { ok: true, n: 0 };
    const cons = doc.cons.filter((c) => c.refs.every((r) => { const e = E.byId(r.id); return e && enc(e); }));
    if (cons.length !== doc.cons.length) doc.cons = cons;
    if (!cons.length) return { ok: true, n: 0 };
    const ids = Array.from(new Set(cons.flatMap((c) => c.refs.map((r) => r.id)))), ents = ids.map((id) => E.byId(id)), off = [], x0 = [];
    ents.forEach((e) => { off.push(x0.length); x0.push(...enc(e)); });
    const idx = new Map(ids.map((id, i) => [id, i])), P = K.paramValues(doc), pin = new Set(pinned || []);
    const wreg = ents.flatMap((e) => enc(e).map(() => (pin.has(e.id) ? 1e-2 : 1e-6)));
    const hv = (e, k) => (e.t === "line" ? (k === "a" ? [0, 1] : k === "b" ? [2, 3] : []) : e.t === "circle" || e.t === "arc" ? (k === "c" ? [0, 1] : []) : e.t === "pline" && k && k[0] === "v" ? [2 * +k.slice(1), 2 * +k.slice(1) + 1] : ["point", "text", "insert", "mtext"].includes(e.t) ? [0, 1] : []);
    for (const c of cons) { if (!c.name) continue; const r0 = c.refs[0], i = idx.get(r0.id), e = ents[i]; if (pin.has(e.id)) continue; if (r0.k === "L" || r0.k === "C" || (r0.k && r0.k[0] === "s")) continue; for (const j of hv(e, r0.k)) if (wreg[off[i] + j] < 1e-3) wreg[off[i] + j] = 1e-3; }
    const R = (x) => { const get = (r) => { const i = idx.get(r.id), e = ents[i]; return { t: e.t, v: x.slice(off[i], off[i] + enc(e).length) }; }; return cons.flatMap((c) => resid(c, get, P)); };
    let x = x0.slice(), r = R(x), cost = r.reduce((s, v) => s + v * v, 0), mu = 1e-3; const n = x.length;
    const jac = (x2, r2) => { const J = r2.map(() => new Array(n).fill(0)); for (let j = 0; j < n; j++) { const h = 1e-7 * Math.max(1, Math.abs(x2[j])), xs = x2.slice(); xs[j] += h; const r3 = R(xs); for (let i = 0; i < r2.length; i++) J[i][j] = (r3[i] - r2[i]) / h; } return J; };
    for (let it = 0; it < 60 && cost > 1e-20; it++) {
      const J = jac(x, r), A = Array.from({ length: n }, () => new Array(n).fill(0)), g = new Array(n).fill(0);
      for (let i = 0; i < r.length; i++) for (let a = 0; a < n; a++) { if (!J[i][a]) continue; g[a] += J[i][a] * r[i]; for (let b = a; b < n; b++) A[a][b] += J[i][a] * J[i][b]; }
      for (let a = 0; a < n; a++) for (let b = 0; b < a; b++) A[a][b] = A[b][a];
      let improved = false;
      for (let tries = 0; tries < 8; tries++) {
        const M = A.map((row, a) => row.map((v, b) => v + (a === b ? wreg[a] + mu * (1 + v) : 0))), gg = g.map((v, a) => -(v + wreg[a] * (x[a] - x0[a])));
        const dx = gauss(M, gg), xn = x.map((v, a) => v + dx[a]), rn = R(xn), cn = rn.reduce((s, v) => s + v * v, 0);
        if (cn < cost) { x = xn; r = rn; cost = cn; mu = Math.max(mu / 3, 1e-9); improved = true; break; } mu *= 8;
      }
      if (!improved) break;
    }
    for (let it = 0; it < 12 && cost > 1e-22; it++) { // minimal-norm polish: dx = −Jᵀ (J Jᵀ + εI)⁻¹ r
      const J = jac(x, r), m = r.length, JJ = Array.from({ length: m }, (_, i) => Array.from({ length: m }, (_, k) => J[i].reduce((s, v, j) => s + v * J[k][j], 0) + (i === k ? 1e-12 : 0)));
      const y = gauss(JJ, r.slice()), xn = x.map((v, j) => v - J.reduce((s, row, i) => s + row[j] * y[i], 0)), rn = R(xn), cn = rn.reduce((s, v) => s + v * v, 0);
      if (cn < cost) { x = xn; r = rn; cost = cn; } else break;
    }
    let changed = 0;
    ents.forEach((e, i) => { const v = x.slice(off[i], off[i] + enc(e).length); if (v.some((q, k) => Math.abs(q - x0[off[i] + k]) > 1e-10)) { E.replace(e.id, dec(e, v)); changed++; } });
    return { ok: cost < 1e-12, cost, n: changed };
  };

  /* ---------- after every edit: keep the constraints satisfied ---------- */
  K.editorHooks = K.editorHooks || [];
  K.editorHooks.push((E) => {
    E.txEndHook = (snap) => {
      if (!E.doc.cons || !E.doc.cons.length) return;
      const before = new Map((snap.ents || []).map((e) => [e.id, e])), changed = E.doc.ents.filter((e) => before.get(e.id) && before.get(e.id) !== e).map((e) => e.id);
      const consIds = new Set(E.doc.cons.flatMap((c) => c.refs.map((r) => r.id)));
      const removed = Array.from(consIds).filter((id) => !E.byId(id));
      if (removed.length) E.doc.cons = E.doc.cons.filter((c) => c.refs.every((r) => !removed.includes(r.id)));
      if (!changed.some((id) => consIds.has(id)) && snap.cons === E.doc.cons && snap.params === E.doc.params) return;
      const r = K.solveCons(E, changed); if (!r.ok) E.err("The constraints cannot all be met (over-constrained or conflicting). Undo, or remove a constraint (DELCONSTRAINT).");
    };
    /* constraint markers */
    const ICON = { horizontal: "H", vertical: "V", parallel: "∥", perpendicular: "⊥", concentric: "◎", equal: "=", fix: "🔒", tangent: "T", collinear: "⋯" };
    E.overlayHook = ((prev) => (ctx, P) => {
      if (prev) prev(ctx, P);
      if (E.set.showCons === false || !E.doc.cons || !E.doc.cons.length || (E.space && E.space.lay && !E.space.ms)) return;
      const per = new Map(), pv = K.paramValues(E.doc), dp = P({ override: "#c084fc", width: 1 });
      E._consText = [];
      for (const c of E.doc.cons) {
        const es = c.refs.map((r) => E.byId(r.id)); if (es.some((e) => !e)) continue;
        if (c.type === "coincident") { const p = K.handles(es[0]).find((h) => h[0] === c.refs[0].k); if (!p) continue; const [x, y] = E.w2s(p[1]); ctx.fillStyle = "#38bdf8"; ctx.fillRect(x - 3, y - 3, 6, 6); continue; }
        if (c.name) {
          const v = pv[c.name], lab = `${c.name}=${K.fmt(v, E.doc.dim.dec)}${c.type === "angle" ? "°" : ""}`; let dim = null;
          const hpt = (i) => (K.handles(es[i]).find((h) => h[0] === c.refs[i].k) || [0, es[i].c || es[i].p])[1];
          if (c.type === "radius" || c.type === "diameter") { const e = es[0]; dim = { t: "dim", kind: c.type === "radius" ? "rad" : "dia", c: e.c, r: e.r, loc: G.polar(e.c, c.ang || 0.8, e.r + (c.off || e.r * 0.4)), txt: lab }; }
          else if (c.type === "angle") { const L1 = c.refs[0], L2 = c.refs[1], a = hl(es[0].t, L1.k, enc(es[0])), b = hl(es[1].t, L2.k, enc(es[1])), X = G.ixSS({ k: "s", a: a[0], b: a[1] }, { k: "s", a: b[0], b: b[1] }, true, true)[0]; if (X) { const far = (s) => (G.dist(s[0], X) > G.dist(s[1], X) ? s[0] : s[1]); const p1 = far(a), p2 = far(b), rr = Math.min(G.dist(X, p1), G.dist(X, p2)) * 0.6; dim = { t: "dim", kind: "ang", c: X, p1, p2, loc: G.polar(X, (G.ang(X, p1) + G.ang(X, p2)) / 2, rr), txt: lab }; } }
          else if (c.type === "len") { const s = hl(es[0].t, c.refs[0].k, enc(es[0])); const n = G.unit([-(s[1][1] - s[0][1]), s[1][0] - s[0][0]]); dim = { t: "dim", kind: "ali", p1: s[0], p2: s[1], loc: G.add(G.mid(s[0], s[1]), G.mul(n, c.off || 8)), txt: lab }; }
          else { const p1 = hpt(0), p2 = hpt(1), kind = c.type === "dist" ? "ali" : "lin", dir = c.type === "hdist" ? "h" : c.type === "vdist" ? "v" : undefined, n = c.type === "hdist" ? [0, 1] : c.type === "vdist" ? [1, 0] : G.unit([-(p2[1] - p1[1]), p2[0] - p1[0]]); dim = { t: "dim", kind, dir, p1, p2, loc: G.add(G.mid(p1, p2), G.mul(n, c.off || 10)), txt: lab }; }
          if (dim) { K.paint(dp, Object.assign({ layer: "0" }, dim), E.doc); const tg = K.dimGeom(dim, E.doc).find((g) => g.t === "text"); if (tg) E._consText.push({ c, p: tg.p }); }
          continue;
        }
        const key = c.refs[0].id + ":" + (c.refs[0].k || ""), k = per.get(key) || 0; per.set(key, k + 1);
        const e = es[0], hs = K.handles(e), base = e.t === "line" ? G.mid(e.a, e.b) : e.t === "pline" && c.refs[0].k && c.refs[0].k[0] === "s" ? (() => { const L = hl(e.t, c.refs[0].k, enc(e)); return G.mid(L[0], L[1]); })() : e.c || (hs[0] && hs[0][1]);
        if (!base) continue; const [x, y] = E.w2s(base), bx = x + 10 + k * 18, by = y + 10;
        ctx.fillStyle = "rgba(30,41,59,.9)"; ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1; ctx.fillRect(bx, by, 16, 16); ctx.strokeRect(bx + 0.5, by + 0.5, 15, 15);
        ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 11px system-ui"; ctx.textAlign = "center"; ctx.fillText(ICON[c.type] || "?", bx + 8, by + 12); ctx.textAlign = "left";
      }
    })(E.overlayHook);
    E.dblHook = ((prev) => (wp) => {
      if (E._consText && E._consText.length) { const s = E.w2s(wp); const hit = E._consText.find((t) => { const q = E.w2s(t.p); return Math.abs(q[0] - s[0]) < 28 && Math.abs(q[1] - s[1]) < 10; }); if (hit) { E.run("PARAMETERS", { focus: hit.c.name }); return true; } }
      return prev ? prev(wp) : false;
    })(E.dblHook);
  });

  /* ---------- picking handles ---------- */
  const okEnt = (e) => !!enc(e);
  const pickPoint = async (E, msg) => {
    const p = need(await E.getPoint(msg)); if (!isP(p)) throw K.CANCEL;
    let best = null, bd = 14 / E.view.s;
    for (const e of E.doc.ents) { if (!okEnt(e) || !E.editable(e)) continue; for (const [k, q] of K.handles(e)) { const d = G.dist(p, q); if (d < bd) { bd = d; best = { id: e.id, k }; } } }
    if (!best) throw new Error("No end, mid or centre point there — click on a point of a line, arc, circle or polyline (object snaps help).");
    return best;
  };
  const pickLine = async (E, msg) => {
    const v = need(await E.getEnt(msg, { filter: (e) => e.t === "line" || e.t === "pline" })); if (v.e.t === "line") return { id: v.e.id, k: "L" };
    const P = K.path(v.e), i = Math.min(P.prims.length - 1, Math.floor(K.pathParam(P, v.p))); if (P.prims[i].k !== "s") throw new Error("Pick a straight segment."); return { id: v.e.id, k: "s" + i };
  };
  const pickCircle = async (E, msg) => { const v = need(await E.getEnt(msg, { filter: (e) => e.t === "circle" || e.t === "arc" })); return { id: v.e.id, k: "C" }; };
  const addCons = (E, c, label) => {
    E.tx(label || "constraint", () => {
      const prev = E.doc.cons || []; c.id = K.uid(); E.doc.cons = prev.concat([c]);
      const r = K.solveCons(E, [c.refs[0].id]);
      if (!r.ok) { E.doc.cons = prev; throw new Error("This constraint conflicts with the existing ones (or the geometry cannot meet it)."); }
    });
  };
  const nextName = (E, pre) => { let i = 1; const used = new Set((E.doc.cons || []).map((c) => c.name).concat((E.doc.params || []).map((p) => p.name))); while (used.has(pre + i)) i++; return pre + i; };
  const gc = (name, a, d, fn) => cmd(name, { a, d, fn: async (E) => { if (E.space && E.space.lay && !E.space.ms) return E.msg("Constraints work on the model (Model tab)."); E.msg("Tip: constraints show as small markers; DELCONSTRAINT removes them, CSHOW hides / shows them.", "mu"); for (;;) { const c = await fn(E); if (!c) return; addCons(E, c, name.toLowerCase()); E.msg(d.split(":")[0] + " applied."); } } });
  const loopPick = async (E, f) => { try { return await f(); } catch (e) { if (e === K.CANCEL) return null; throw e; } };
  gc("GCHORIZONTAL", ["GCH"], "Horizontal constraint: a line (or two points) stays level", (E) => loopPick(E, async () => ({ type: "horizontal", refs: [await pickLine(E, "Select a line or polyline segment:")] })));
  gc("GCVERTICAL", ["GCV"], "Vertical constraint: a line stays upright", (E) => loopPick(E, async () => ({ type: "vertical", refs: [await pickLine(E, "Select a line or polyline segment:")] })));
  gc("GCPARALLEL", ["GCPA"], "Parallel constraint between two lines", (E) => loopPick(E, async () => ({ type: "parallel", refs: [await pickLine(E, "Select first line:"), await pickLine(E, "Select second line (it turns):")] })));
  gc("GCPERPENDICULAR", ["GCPE"], "Perpendicular constraint between two lines", (E) => loopPick(E, async () => ({ type: "perpendicular", refs: [await pickLine(E, "Select first line:"), await pickLine(E, "Select second line (it turns):")] })));
  gc("GCCOLLINEAR", ["GCCL"], "Collinear constraint: two lines on one straight line", (E) => loopPick(E, async () => ({ type: "collinear", refs: [await pickLine(E, "Select first line:"), await pickLine(E, "Select second line:")] })));
  gc("GCCOINCIDENT", ["GCC"], "Coincident constraint: two points stay together", (E) => loopPick(E, async () => ({ type: "coincident", refs: [await pickPoint(E, "Select first point:"), await pickPoint(E, "Select second point (it moves):")] })));
  gc("GCCONCENTRIC", ["GCCN"], "Concentric constraint between circles / arcs", (E) => loopPick(E, async () => ({ type: "concentric", refs: [await pickCircle(E, "Select first circle or arc:"), await pickCircle(E, "Select second circle or arc:")] })));
  gc("GCEQUAL", ["GCE"], "Equal constraint: same length (lines) or same radius (circles)", (E) => loopPick(E, async () => { const v = need(await E.getEnt("Select first line or circle:", { filter: (e) => ["line", "pline", "circle", "arc"].includes(e.t) })); if (v.e.t === "circle" || v.e.t === "arc") return { type: "equal", refs: [{ id: v.e.id, k: "C" }, await pickCircle(E, "Select second circle or arc:")] }; const a = v.e.t === "line" ? { id: v.e.id, k: "L" } : (() => { const P = K.path(v.e); return { id: v.e.id, k: "s" + Math.min(P.prims.length - 1, Math.floor(K.pathParam(P, v.p))) }; })(); return { type: "equal", refs: [a, await pickLine(E, "Select second line:")] }; }));
  gc("GCFIX", ["GCF"], "Fix constraint: a point stays where it is", (E) => loopPick(E, async () => { const r = await pickPoint(E, "Select the point to fix:"); const h = K.handles(E.byId(r.id)).find((x) => x[0] === r.k); return { type: "fix", refs: [r], at: h[1].slice() }; }));
  gc("GCTANGENT", ["GCT"], "Tangent constraint: line–circle or circle–circle", (E) => loopPick(E, async () => {
    const v = need(await E.getEnt("Select a line or circle / arc:", { filter: (e) => ["line", "pline", "circle", "arc"].includes(e.t) })); const b = await pickCircle(E, "Select the circle or arc:"), cb = E.byId(b.id);
    if (v.e.t === "circle" || v.e.t === "arc") { const d = G.dist(v.e.c, cb.c); return { type: "tangent", refs: [{ id: v.e.id, k: "C" }, b], inner: d < Math.max(v.e.r, cb.r) }; }
    const a = v.e.t === "line" ? { id: v.e.id, k: "L" } : (() => { const P = K.path(v.e); return { id: v.e.id, k: "s" + Math.min(P.prims.length - 1, Math.floor(K.pathParam(P, v.p))) }; })(); const L = hl(v.e.t, a.k, enc(v.e)); return { type: "tangent", refs: [a, b], sg: G.cross(G.sub(L[1], L[0]), G.sub(cb.c, L[0])) >= 0 ? 1 : -1 };
  }));
  const dc = (name, a, d, type, fn) => cmd(name, { a, d, fn: async (E) => {
    if (E.space && E.space.lay && !E.space.ms) return E.msg("Constraints work on the model (Model tab).");
    for (;;) {
      const c = await loopPick(E, () => fn(E)); if (!c) return; c.type = type; c.name = nextName(E, type === "angle" ? "ang" : type === "radius" ? "rad" : type === "diameter" ? "dia" : "d");
      const cur = K.consMeasure(c, E.doc, E.byId); const v = await E.getText(`Enter the value or a formula (e.g. d1/2) <${K.fmt(cur, 4)}>:`, { dflt: K.fmt(cur, 4) }); if (v == null) return;
      c.expr = String(v).trim(); if (!isFinite(K.evalExpr(c.expr, K.paramValues(E.doc)))) { E.err("That is not a number or a known parameter."); continue; }
      addCons(E, c, name.toLowerCase()); E.msg(`${c.name} = ${c.expr}`);
    }
  } });
  dc("DCALIGNED", ["DCA", "DCLINEAR", "DCL"], "Dimensional constraint: distance between two points", "dist", async (E) => ({ refs: [await pickPoint(E, "Specify first constraint point:"), await pickPoint(E, "Specify second constraint point:")] }));
  dc("DCHORIZONTAL", ["DCH"], "Dimensional constraint: horizontal distance", "hdist", async (E) => { const a = await pickPoint(E, "Specify first constraint point:"), b = await pickPoint(E, "Specify second constraint point:"); const pa = K.handles(E.byId(a.id)).find((h) => h[0] === a.k)[1], pb = K.handles(E.byId(b.id)).find((h) => h[0] === b.k)[1]; return { refs: [a, b], sg: pb[0] >= pa[0] ? 1 : -1 }; });
  dc("DCVERTICAL", ["DCV"], "Dimensional constraint: vertical distance", "vdist", async (E) => { const a = await pickPoint(E, "Specify first constraint point:"), b = await pickPoint(E, "Specify second constraint point:"); const pa = K.handles(E.byId(a.id)).find((h) => h[0] === a.k)[1], pb = K.handles(E.byId(b.id)).find((h) => h[0] === b.k)[1]; return { refs: [a, b], sg: pb[1] >= pa[1] ? 1 : -1 }; });
  dc("DCLENGTH", ["DCLEN"], "Dimensional constraint: length of a line or segment", "len", async (E) => ({ refs: [await pickLine(E, "Select a line or polyline segment:")] }));
  dc("DCRADIUS", ["DCR"], "Dimensional constraint: radius", "radius", async (E) => ({ refs: [await pickCircle(E, "Select a circle or arc:")] }));
  dc("DCDIAMETER", ["DCD"], "Dimensional constraint: diameter", "diameter", async (E) => ({ refs: [await pickCircle(E, "Select a circle or arc:")] }));
  dc("DCANGULAR", ["DCAN"], "Dimensional constraint: angle between two lines", "angle", async (E) => { const a = await pickLine(E, "Select first line:"), b = await pickLine(E, "Select second line:"); const ea = E.byId(a.id), eb = E.byId(b.id), L1 = hl(ea.t, a.k, enc(ea)), L2 = hl(eb.t, b.k, enc(eb)), u = G.sub(L1[1], L1[0]), w = G.sub(L2[1], L2[0]); return { refs: [a, b], sg: G.cross(u, w) >= 0 ? 1 : -1 }; });

  cmd("PARAMETERS", { a: ["PAR", "PARAMS"], d: "Parameters manager: values and formulas of dimensional constraints and your own parameters", fn: async (E, args) => {
    const doc = E.doc, pv = K.paramValues(doc), dims = (doc.cons || []).filter((c) => c.name), ups = (doc.params || []).slice();
    const row = (n, ex, v, kind, i) => `<tr><td>${kind === "u" ? `<input data-un="${i}" value="${esc(n)}">` : `<b>${esc(n)}</b>`}</td><td><input data-${kind}="${i}" value="${esc(ex)}"${args && args.focus === n ? " autofocus" : ""}></td><td class="cx-ro">${isFinite(v) ? K.fmt(v, 4) : "—"}</td>${kind === "u" ? `<td><button type="button" data-ud="${i}">✕</button></td>` : "<td></td>"}</tr>`;
    const r = await E.dialog("Parameters", `<p class="cx-note">Change a value, or type a formula using other names (e.g. <code>d1/2</code>, <code>width*2 + 5</code>, <code>sqrt(d3)</code>). The geometry follows.</p><div class="cx-tgrid"><table><tr><th>Name</th><th>Expression</th><th>Value</th><th></th></tr>${dims.map((c, i) => row(c.name, c.expr, pv[c.name], "c", i)).join("")}${ups.map((p, i) => row(p.name, p.expr, pv[p.name], "u", i)).join("")}</table></div><button type="button" class="cx-b o" data-addp>Add a user parameter</button>`,
      (b) => { const nd = dims.map((c, i) => Object.assign({}, c, { expr: b.querySelector(`[data-c="${i}"]`).value.trim() })), nu = []; b.querySelectorAll("[data-u]").forEach((inp) => { const i = +inp.dataset.u, nm = b.querySelector(`[data-un="${i}"]`).value.trim(); if (nm && !inp.closest("tr").dataset.del) nu.push({ name: nm, expr: inp.value.trim() }); });
        const names = nd.map((c) => c.name).concat(nu.map((p) => p.name)); if (new Set(names).size !== names.length) throw new Error("Names must be unique."); if (nu.some((p) => !/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(p.name))) throw new Error("A name may use letters, digits and _ (start with a letter).");
        const test = K.paramValues({ params: nu, cons: nd }); for (const n of names) if (!isFinite(test[n])) throw new Error(`"${n}" does not give a number (check the formula).`); return { nd, nu }; },
      { width: "min(680px,96vw)", init: (b) => { b.querySelector("[data-addp]").onclick = () => { const t = b.querySelector(".cx-tgrid table"), i = 1000 + t.rows.length; t.insertAdjacentHTML("beforeend", row("user" + (ups.length + 1), "10", 10, "u", i)); }; b.addEventListener("click", (ev) => { const d = ev.target.closest("[data-ud]"); if (d) { const tr = d.closest("tr"); tr.dataset.del = 1; tr.style.display = "none"; } }); } });
    if (!r) return;
    E.tx("parameters", () => { const map = new Map(r.nd.map((c) => [c.id, c])); E.doc.cons = (E.doc.cons || []).map((c) => map.get(c.id) || c); E.doc.params = r.nu; const s = K.solveCons(E, []); if (!s.ok) E.err("Some constraints cannot be met with these values."); });
  } });
  cmd("DELCONSTRAINT", { a: ["DELCON"], d: "Remove all constraints from the selected objects", fn: async (E) => { const ids = await E.getSel("Select objects:"); if (!ids.length) return; const s = new Set(ids), n0 = (E.doc.cons || []).length; E.tx("delete constraints", () => { E.doc.cons = (E.doc.cons || []).filter((c) => !c.refs.some((r) => s.has(r.id))); }); E.msg(`${n0 - E.doc.cons.length} constraint(s) removed.`); } });
  cmd("CSHOW", { a: ["CONSTRAINTBAR", "CBAR", "DCDISPLAY"], d: "Show or hide constraint markers and dimensional constraints", norepeat: true, keepSel: true, fn: async (E) => { E.set.showCons = E.set.showCons === false; E.drawOverlay(); E.msg(`Constraints ${E.set.showCons ? "shown" : "hidden"}.`); } });
  cmd("AUTOCONSTRAIN", { a: ["AUTOC"], d: "Add horizontal, vertical and coincident constraints automatically to the selected geometry", fn: async (E) => {
    const ids = await E.getSel("Select objects:", { filter: okEnt }); if (!ids.length) return;
    const ents = ids.map((id) => E.byId(id)), add = [], tol = 1e-6 + 0.0005 * (() => { const b = K.extents(E.doc, ents); return b ? Math.max(b.x1 - b.x0, b.y1 - b.y0) : 1; })(), have = new Set((E.doc.cons || []).map((c) => c.type + c.refs.map((r) => r.id + r.k).join("|")));
    const push = (c) => { const k = c.type + c.refs.map((r) => r.id + r.k).join("|"); if (!have.has(k)) { have.add(k); add.push(c); } };
    for (const e of ents) { const segs = e.t === "line" ? [["L", e.a, e.b]] : e.t === "pline" ? K.path(e).prims.map((p, i) => (p.k === "s" ? ["s" + i, p.a, p.b] : null)).filter(Boolean) : []; for (const [k, a, b] of segs) { const an = Math.abs(Math.atan2(b[1] - a[1], b[0] - a[0])); if (G.dist(a, b) < tol) continue; if (Math.abs(Math.sin(an)) < 0.0175) push({ type: "horizontal", refs: [{ id: e.id, k }] }); else if (Math.abs(Math.cos(an)) < 0.0175) push({ type: "vertical", refs: [{ id: e.id, k }] }); } }
    const hs = ents.flatMap((e) => K.handles(e).filter((h) => h[0] !== "m").map((h) => ({ id: e.id, k: h[0], p: h[1] })));
    for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) if (hs[i].id !== hs[j].id && G.dist(hs[i].p, hs[j].p) < tol && !hs.slice(0, i).some((h) => h.id === hs[j].id && G.dist(h.p, hs[j].p) < tol && h.id !== hs[i].id && false)) push({ type: "coincident", refs: [{ id: hs[i].id, k: hs[i].k }, { id: hs[j].id, k: hs[j].k }] });
    if (!add.length) return E.msg("Nothing to add.");
    E.tx("auto constrain", () => { E.doc.cons = (E.doc.cons || []).concat(add.map((c) => Object.assign(c, { id: K.uid() }))); const r = K.solveCons(E, []); if (!r.ok) E.err("Some of the added constraints conflict."); });
    E.msg(add.length + " constraint(s) added.");
  } });

  K.RIBBON.splice(3, 0, { t: "Parametric", g: [
    { n: "Geometric", b: [["GCCOINCIDENT", "Coincident", "join"], ["GCHORIZONTAL", "Horizontal", "line"], ["GCVERTICAL", "Vertical", "line"], ["GCPARALLEL", "Parallel", "offset"], ["GCPERPENDICULAR", "Perpendicular", "dimang"], ["GCTANGENT", "Tangent", "circle"], ["GCCONCENTRIC", "Concentric", "donut"], ["GCEQUAL", "Equal", "dimlin"], ["GCCOLLINEAR", "Collinear", "xline"], ["GCFIX", "Fix", "layer"], ["AUTOCONSTRAIN", "Auto", "gear"]] },
    { n: "Dimensional", b: [["DCALIGNED", "Aligned", "dimali"], ["DCHORIZONTAL", "Horizontal", "dimlin"], ["DCVERTICAL", "Vertical", "dimlin"], ["DCLENGTH", "Length", "dimlin"], ["DCRADIUS", "Radius", "dimrad"], ["DCDIAMETER", "Diameter", "dimdia"], ["DCANGULAR", "Angular", "dimang"]] },
    { n: "Manage", b: [["PARAMETERS", "Parameters", "list"], ["DELCONSTRAINT", "Delete constraints", "erase"], ["CSHOW", "Show / hide", "zoomE"]] },
  ] });
})((window.KCAD = window.KCAD || {}));
