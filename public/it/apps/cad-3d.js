/* KMR CAD Draft — 3D modelling: solids (box, cylinder, cone, sphere, torus, wedge, extrude, revolve, imported STEP mesh),
   union / subtract / intersect (CSG), move / rotate in 3D, orbit view with visual styles, STL export, DWG / STEP import,
   and 2D drawing views (front, top, side, isometric) with hidden lines generated from the model. */
(function (K) {
  "use strict";
  const G = K.geom, D2R = Math.PI / 180, cmd = K.cmd, esc = K.esc, isP = Array.isArray;
  const need = (v) => { if (v == null) throw K.CANCEL; return v; };
  const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Could not load " + src)); document.head.append(s); });
  let V3 = null, v3p = null;
  K.load3D = () => { if (V3) return Promise.resolve(V3); if (!v3p) v3p = loadScript("/it/apps/vendor/cad3d-vendor.js").then(() => (V3 = window.KCAD3V)); return v3p; };

  /* =============================== DWG and STEP import (engines shared with Balloon Inspector) =============================== */
  const ENG = "/it/balloon/engines/";
  let dwgMod = null, occtMod = null;
  const wasmOk = () => { try { new WebAssembly.Module(Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0)); return true; } catch (e) { return false; } };
  K.dwgToDxf = async (buf, say) => {
    if (!wasmOk()) throw new Error("This browser blocks the DWG converter. Save the drawing as DXF (ASCII) in AutoCAD, or with the free ODA File Converter, and open that.");
    if (!dwgMod) { say && say("Loading the DWG converter (first time only, about 10 MB)…"); if (typeof window.createLibreDwgModule === "undefined") await loadScript(ENG + "libredwg-web.classic.js"); const wb = new Uint8Array(await (await fetch(ENG + "libredwg-web.wasm")).arrayBuffer()); dwgMod = await window.createLibreDwgModule({ wasmBinary: wb, locateFile: (f) => f, print: () => {}, printErr: () => {} }); }
    say && say("Converting DWG to DXF…");
    const M = dwgMod; M.FS.writeFile("in.dwg", new Uint8Array(buf)); const code = M.dwg_write_dxf("in.dwg", "out.dxf");
    const txt = M.FS.analyzePath("out.dxf", false).exists ? M.FS.readFile("out.dxf", { encoding: "utf8" }) : ""; try { M.FS.unlink("in.dwg"); M.FS.unlink("out.dxf"); } catch (e) { /* ignore */ }
    if (!txt || txt.length < 100) throw new Error("The converter could not read this DWG (code " + code + "). Save it as DXF in AutoCAD and open the DXF.");
    return txt;
  };
  K.readStep = async (buf, say) => {
    if (!wasmOk()) throw new Error("This browser blocks the STEP reader.");
    if (!occtMod) { say && say("Loading the STEP reader (first time only, about 8 MB)…"); if (typeof window.occtimportjs === "undefined") await loadScript(ENG + "occt-import-js.js"); const wb = new Uint8Array(await (await fetch(ENG + "occt-import-js.wasm")).arrayBuffer()); occtMod = await window.occtimportjs({ wasmBinary: wb, locateFile: (f) => f, print: () => {}, printErr: () => {} }); }
    say && say("Reading the 3D model…");
    const r = occtMod.ReadStepFile(new Uint8Array(buf), { linearUnit: "millimeter", linearDeflectionType: "bounding_box_ratio", linearDeflection: 0.001, angularDeflection: 0.3 });
    if (!r || !r.success || !r.meshes || !r.meshes.length) throw new Error("No solid geometry found in this STEP file.");
    return r.meshes.map((m, i) => ({ name: m.name || "Part " + (i + 1), pos: Array.from(m.attributes.position.array, (v) => Math.round(v * 1e4) / 1e4), idx: m.index ? Array.from(m.index.array) : null, color: m.color ? "#" + m.color.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("") : null }));
  };
  /* DWG in the normal Open / Import commands */
  const readFile0 = K.readDrawingFile;
  K.readDrawingFile = async (file, say) => {
    if (/\.dwg$/i.test(file.name)) { const txt = await K.dwgToDxf(await file.arrayBuffer(), say); const r = K.readDXF(txt); return { doc: r.doc, warn: r.warn, name: file.name.replace(/\.[^.]+$/, "") }; }
    return readFile0(file);
  };
  const pick0 = K.pickFile; K.pickFile = (accept) => pick0(/\.dxf/.test(accept || "") ? accept + ",.dwg" : accept);

  /* =============================== solid geometry =============================== */
  const geoCache = new WeakMap();
  const mat = (d) => { const m = new V3.THREE.Matrix4(); if (d.m) m.fromArray(d.m); return m; };
  const shapeOf = (loops) => {
    const T = V3.THREE, ls = loops.map((l) => (G.area(l) < 0 ? l.slice().reverse() : l)).sort((a, b) => Math.abs(G.area(b)) - Math.abs(G.area(a)));
    const outer = ls[0], sh = new T.Shape(outer.map((p) => new T.Vector2(p[0], p[1])));
    for (const h of ls.slice(1)) sh.holes.push(new T.Path(h.slice().reverse().map((p) => new T.Vector2(p[0], p[1]))));
    return sh;
  };
  K.solidGeom = (d) => {
    let g = geoCache.get(d); if (g) return g;
    const T = V3.THREE, p = d.p || {};
    switch (d.kind) {
      case "box": g = new T.BoxGeometry(p.w, p.d, p.h); g.translate(p.w / 2, p.d / 2, p.h / 2); break;
      case "cyl": g = new T.CylinderGeometry(p.r, p.r, p.h, 72, 1); g.rotateX(Math.PI / 2); g.translate(0, 0, p.h / 2); break;
      case "cone": g = new T.CylinderGeometry(p.r2 || 0, p.r1, p.h, 72, 1); g.rotateX(Math.PI / 2); g.translate(0, 0, p.h / 2); break;
      case "sphere": g = new T.SphereGeometry(p.r, 64, 40); break;
      case "torus": g = new T.TorusGeometry(p.R, p.r, 36, 96); break;
      case "wedge": { const s = new T.Shape([new T.Vector2(0, 0), new T.Vector2(p.w, 0), new T.Vector2(0, p.h)]); g = new T.ExtrudeGeometry(s, { depth: p.d, bevelEnabled: false }); g.rotateX(Math.PI / 2); g.translate(0, p.d, 0); break; }
      case "extrude": g = new T.ExtrudeGeometry(shapeOf(p.loops), { depth: p.h, bevelEnabled: false, curveSegments: 48 }); if (p.h < 0) { /* depth below ground */ } break;
      case "revolve": {
        const A = p.a, u = G.unit(G.sub(p.b, p.a)), n0 = [-u[1], u[0]], far = p.loop.reduce((m, q) => (Math.abs(G.dot(G.sub(q, A), n0)) > Math.abs(G.dot(G.sub(m, A), n0)) ? q : m), p.loop[0]), side = G.dot(G.sub(far, A), n0) >= 0 ? 1 : -1, n = G.mul(n0, side);
        const pts = p.loop.map((q) => new T.Vector2(Math.max(0, G.dot(G.sub(q, A), n)), G.dot(G.sub(q, A), u))); if (G.area(p.loop) * side > 0) pts.reverse(); pts.push(pts[0].clone());
        g = new T.LatheGeometry(pts, 96, 0, (p.ang || 360) * D2R);
        const X = new T.Vector3(), Y = new T.Vector3(u[0], u[1], 0), Z = new T.Vector3(n[0], n[1], 0); X.crossVectors(Y, Z);
        const m = new T.Matrix4().makeBasis(X, Y, Z); m.setPosition(A[0], A[1], 0); g.applyMatrix4(m); break;
      }
      case "mesh": { g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(p.pos, 3)); if (p.idx) g.setIndex(p.idx); g.computeVertexNormals(); break; }
      case "bool": {
        const ev = new V3.Evaluator(); ev.useGroups = false; ev.attributes = ["position", "normal"];
        const br = (x) => { const gg = K.solidGeom(x).clone(); gg.deleteAttribute && gg.deleteAttribute("uv"); if (!gg.index) { /* ok */ } const b = new V3.Brush(gg); b.updateMatrixWorld(); return b; };
        const r = ev.evaluate(br(d.a), br(d.b), d.op === "sub" ? V3.SUBTRACTION : d.op === "int" ? V3.INTERSECTION : V3.ADDITION);
        g = r.geometry; break;
      }
      default: g = new T.BufferGeometry();
    }
    if (d.kind !== "bool" && g.getAttribute("uv")) g.deleteAttribute("uv");
    if (d.m) g.applyMatrix4(mat(d));
    g.computeBoundingBox(); geoCache.set(d, g); return g;
  };
  const xformDef = (d, m4) => { const m = mat(d).premultiply(m4); return Object.assign({}, d, { m: m.toArray() }); };
  const solidName = (d) => d.name || ({ box: "Box", cyl: "Cylinder", cone: "Cone", sphere: "Sphere", torus: "Torus", wedge: "Wedge", extrude: "Extrusion", revolve: "Revolved solid", mesh: "Imported part", bool: { sub: "Subtraction", union: "Union", int: "Intersection" }[d.op] })[d.kind];
  K.solidName = solidName;

  /* ---------- edges for drawing / 2D views ---------- */
  const edgeData = new WeakMap();
  const meshEdges = (g) => {
    let ed = edgeData.get(g); if (ed) return ed;
    const T = V3.THREE; let gg = g.index ? g.clone() : g.clone(); gg.deleteAttribute("normal"); if (gg.getAttribute("uv")) gg.deleteAttribute("uv"); gg = V3.mergeVertices(gg, 1e-4);
    const P = gg.getAttribute("position"), I = gg.index ? gg.index.array : Array.from({ length: P.count }, (_, i) => i), tri = [], map = new Map();
    const v = (i) => [P.getX(i), P.getY(i), P.getZ(i)];
    for (let t = 0; t < I.length; t += 3) {
      const a = v(I[t]), b = v(I[t + 1]), c = v(I[t + 2]), u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(...n);
      if (l < 1e-14) continue; tri.push(n.map((x) => x / l)); const ti = tri.length - 1;
      for (const [x, y, z] of [[I[t], I[t + 1], I[t + 2]], [I[t + 1], I[t + 2], I[t]], [I[t + 2], I[t], I[t + 1]]]) { const k = x < y ? x + "_" + y : y + "_" + x; const e = map.get(k); if (e) e.t.push(ti); else map.set(k, { a: Math.min(x, y), b: Math.max(x, y), c: z, t: [ti], fw: x < y }); }
    }
    /* boolean results have T-junctions: an edge of one triangle is matched by several shorter edges on the other side.
       Such an edge is not a real boundary — drop it when the other side covers it with triangles in the same plane. */
    const edges = Array.from(map.values()), open = edges.filter((e) => e.t.length === 1), lines = new Map();
    const bb = g.boundingBox || (g.computeBoundingBox(), g.boundingBox), q = (bb.min.distanceTo(bb.max) || 1) * 1e-5;
    for (const e of open) {
      const a = v(e.a), b = v(e.b), d0 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d0); if (L < q) { e.drop = true; continue; }
      let d = d0.map((x) => x / L); const sg = d[0] < -1e-9 || (Math.abs(d[0]) <= 1e-9 && (d[1] < -1e-9 || (Math.abs(d[1]) <= 1e-9 && d[2] < 0))) ? -1 : 1; d = d.map((x) => x * sg);
      const t0 = dot3(a, d), o = [a[0] - d[0] * t0, a[1] - d[1] * t0, a[2] - d[2] * t0], key = d.map((x) => Math.round(x * 500)).join(",") + "|" + o.map((x) => Math.round(x / (q * 50))).join(",");
      const t1 = dot3(b, d); e.iv = [Math.min(t0, t1), Math.max(t0, t1)]; e.or = (e.fw ? 1 : -1) * (t1 > t0 ? 1 : -1); e.L = L;
      if (!lines.has(key)) { const gl = []; gl.d = d; gl.o = o; lines.set(key, gl); } lines.get(key).push(e);
    }
    /* lines that fell into neighbouring buckets (rounding) are joined when they really are the same line */
    const glist = [...lines.values()], same = (A, B) => Math.abs(dot3(A.d, B.d)) > 1 - 1e-7 && Math.hypot(A.o[0] - B.o[0], A.o[1] - B.o[1], A.o[2] - B.o[2]) < q * 30;
    glist.sort((A, B) => A.o[0] - B.o[0]);
    for (let i = 0; i < glist.length; i++) { const A = glist[i]; if (A.dead) continue; for (let j = i + 1; j < glist.length && glist[j].o[0] - A.o[0] < q * 30; j++) { const B = glist[j]; if (!B.dead && same(A, B)) { const flip = dot3(A.d, B.d) < 0; for (const e of B) { if (flip) { e.iv = [-e.iv[1], -e.iv[0]]; e.or = -e.or; } A.push(e); } B.dead = true; } } }
    lines.clear(); glist.filter((g0) => !g0.dead).forEach((g0, i) => lines.set(i, g0));
    const cosT = Math.cos(22 * D2R);
    for (const grp of lines.values()) {
      if (grp.length < 2) continue;
      for (const e of grp) {
        if (e.drop) continue; const n = tri[e.t[0]]; let cov = 0;
        const parts = grp.filter((f) => f !== e && f.or !== e.or && dot3(tri[f.t[0]], n) > cosT).map((f) => [Math.max(f.iv[0], e.iv[0]), Math.min(f.iv[1], e.iv[1])]).filter((x) => x[1] > x[0]).sort((x, y) => x[0] - y[0]);
        let end = -Infinity; for (const [x0, x1] of parts) { const s0 = Math.max(x0, end); if (x1 > s0) cov += x1 - s0; end = Math.max(end, x1); }
        if (cov >= e.L * 0.98) e.smooth = true;
      }
    }
    /* still unmatched: inside a flat region when points just across the edge lie on a triangle in the same plane */
    if (!g.boundsTree) g.computeBoundsTree();
    const tp = new T.Vector3(), cp = new T.Vector3(), tn = new T.Vector3(), eps = q * 6, hitTol = q * 3;
    const onFlat = (pt, n) => { tp.set(pt[0], pt[1], pt[2]); let hit = false; g.boundsTree.shapecast({ intersectsBounds: (box) => box.distanceToPoint(tp) <= hitTol, intersectsTriangle: (tr) => { tr.getNormal(tn); if (Math.abs(tn.dot(new T.Vector3(n[0], n[1], n[2]))) < cosT) return false; tr.closestPointToPoint(tp, cp); if (cp.distanceTo(tp) <= hitTol) { hit = true; return true; } return false; } }); return hit; };
    for (const e of open) {
      if (e.drop || e.smooth) continue; const a = v(e.a), b = v(e.b), c = v(e.c), n = tri[e.t[0]], d = [(b[0] - a[0]) / e.L, (b[1] - a[1]) / e.L, (b[2] - a[2]) / e.L];
      let pp = [n[1] * d[2] - n[2] * d[1], n[2] * d[0] - n[0] * d[2], n[0] * d[1] - n[1] * d[0]]; if (dot3(pp, [c[0] - a[0], c[1] - a[1], c[2] - a[2]]) > 0) pp = pp.map((x) => -x);
      if ([0.2, 0.5, 0.8].every((t) => onFlat([a[0] + (b[0] - a[0]) * t + pp[0] * eps, a[1] + (b[1] - a[1]) * t + pp[1] * eps, a[2] + (b[2] - a[2]) * t + pp[2] * eps], n))) e.smooth = true;
    }
    /* the remaining open edges on one line are merged into single segments (no duplicates or fragments) */
    const merged = [];
    for (const grp of lines.values()) {
      const iv = grp.filter((e) => !e.drop && !e.smooth).map((e) => e.iv.slice()).sort((x, y) => x[0] - y[0]); let cur = null;
      const push = () => { if (cur && cur[1] - cur[0] > q) merged.push({ pa: [0, 1, 2].map((i) => grp.o[i] + grp.d[i] * cur[0]), pb: [0, 1, 2].map((i) => grp.o[i] + grp.d[i] * cur[1]), t: [-1] }); };
      for (const x of iv) { if (cur && x[0] <= cur[1] + q) cur[1] = Math.max(cur[1], x[1]); else { push(); cur = x; } } push();
    }
    ed = { P, edges: edges.filter((e) => e.t.length > 1).concat(merged), tri, v }; edgeData.set(g, ed); return ed;
  };
  const lerpP = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  /** feature edges (creases and real boundaries) as line-segment positions, for the 3D view */
  const creaseCache = new WeakMap();
  K.creaseLines = (g) => {
    let r = creaseCache.get(g); if (r) return r; const ed = meshEdges(g), out = [], c = Math.cos(22 * D2R);
    for (const e of ed.edges) { if (e.t.length > 1 && !(e.t.length === 2 && dot3(ed.tri[e.t[0]], ed.tri[e.t[1]]) < c) && e.t.length < 3) continue; const a = e.pa || ed.v(e.a), b = e.pb || ed.v(e.b); out.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
    r = new V3.THREE.BufferGeometry(); r.setAttribute("position", new V3.THREE.Float32BufferAttribute(out, 3)); creaseCache.set(g, r); return r;
  };
  /** visible / hidden 2D segments of a geometry seen along v (toward the viewer) */
  K.viewLines = (g, v, rgt, up, hidden = true) => {
    const T = V3.THREE, ed = meshEdges(g), out = { vis: [], hid: [] }, bb = g.boundingBox, diag = bb.min.distanceTo(bb.max) || 1;
    const mesh = new T.Mesh(g, new T.MeshBasicMaterial({ side: T.DoubleSide })); if (!g.boundsTree) g.computeBoundsTree(); mesh.updateMatrixWorld();
    const ray = new T.Raycaster(); ray.firstHitOnly = true; const dir = new T.Vector3(v[0], v[1], v[2]); const eps = diag * 2e-4;
    const pr = (p) => [dot3(p, rgt), dot3(p, up)];
    for (const e of ed.edges) {
      let keep = e.t.length === 1;
      if (!keep) { const n1 = ed.tri[e.t[0]], n2 = ed.tri[e.t[1]]; keep = dot3(n1, n2) < Math.cos(22 * D2R) || (dot3(n1, v) > 1e-9) !== (dot3(n2, v) > 1e-9); }
      if (!keep) continue;
      const a = e.pa || ed.v(e.a), b = e.pb || ed.v(e.b), pa = pr(a), pb = pr(b), L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]); if (L < diag * 1e-6) continue;
      if (!hidden) { out.vis.push([pa, pb]); continue; }
      const k = Math.max(1, Math.min(24, Math.ceil(L / (diag / 60)))); let cur = null, start = 0;
      for (let i = 0; i < k; i++) {
        const t = (i + 0.5) / k, m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        ray.set(new T.Vector3(m[0] + v[0] * eps, m[1] + v[1] * eps, m[2] + v[2] * eps), dir); const hit = ray.intersectObject(mesh, false)[0], vis = !(hit && hit.distance > eps);
        if (cur === null) cur = vis; else if (vis !== cur) { const p0 = lerpP(pa, pb, start / k), p1 = lerpP(pa, pb, i / k); (cur ? out.vis : out.hid).push([p0, p1]); start = i; cur = vis; }
      }
      (cur ? out.vis : out.hid).push([lerpP(pa, pb, start / k), pb]);
    }
    /* 2D clean-up: collinear pieces are merged; a hidden line lying under a visible one is dropped (visible lines take precedence) */
    const tol = diag * 1e-4, groups = new Map();
    const addSeg = (s, kind) => {
      let d = [s[1][0] - s[0][0], s[1][1] - s[0][1]]; const L = Math.hypot(d[0], d[1]); if (L < tol) return; d = [d[0] / L, d[1] / L]; if (d[0] < -1e-9 || (Math.abs(d[0]) <= 1e-9 && d[1] < 0)) d = [-d[0], -d[1]];
      const off = s[0][0] * -d[1] + s[0][1] * d[0], ka = Math.round(Math.atan2(d[1], d[0]) * 2e3), ko = Math.round(off / (tol * 5)); let k = ka + "|" + ko;
      if (!groups.has(k)) { for (const da of [0, -1, 1]) for (const dd of [0, -1, 1]) { const k2 = ka + da + "|" + (ko + dd); if (groups.has(k2)) { k = k2; break; } } }
      if (!groups.has(k)) groups.set(k, { d, off, vis: [], hid: [] }); const g0 = groups.get(k), t0 = s[0][0] * d[0] + s[0][1] * d[1], t1 = s[1][0] * d[0] + s[1][1] * d[1]; g0[kind].push([Math.min(t0, t1), Math.max(t0, t1)]);
    };
    out.vis.forEach((s) => addSeg(s, "vis")); out.hid.forEach((s) => addSeg(s, "hid"));
    const union = (iv) => { iv.sort((x, y) => x[0] - y[0]); const r = []; for (const x of iv) { const l = r[r.length - 1]; if (l && x[0] <= l[1] + tol) l[1] = Math.max(l[1], x[1]); else r.push(x.slice()); } return r; };
    const minus = (iv, cut) => { let r = iv; for (const c of cut) { const n = []; for (const x of r) { if (c[1] <= x[0] + tol || c[0] >= x[1] - tol) { n.push(x); continue; } if (c[0] > x[0] + tol) n.push([x[0], c[0]]); if (c[1] < x[1] - tol) n.push([c[1], x[1]]); } r = n; } return r; };
    const res = { vis: [], hid: [] };
    for (const g0 of groups.values()) { const P2 = (t) => [g0.d[0] * t - g0.d[1] * g0.off, g0.d[1] * t + g0.d[0] * g0.off], V = union(g0.vis); V.forEach((x) => res.vis.push([P2(x[0]), P2(x[1])])); minus(union(g0.hid), V).forEach((x) => { if (x[1] - x[0] > tol * 3) res.hid.push([P2(x[0]), P2(x[1])]); }); }
    /* a short hidden piece running along a visible line (facet chords of the same circle) is noise */
    const near = diag * 2e-3; res.hid = res.hid.filter((h) => { const m = lerpP(h[0], h[1], 0.5); return !res.vis.some((s) => [h[0], m, h[1]].every((pt) => G.dist(G.closestSeg(pt, s[0], s[1]), pt) < near)); });
    return res;
  };
  const VIEWS = { front: { v: [0, -1, 0], r: [1, 0, 0], u: [0, 0, 1], n: "Front" }, top: { v: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0], n: "Top" }, bottom: { v: [0, 0, -1], r: [1, 0, 0], u: [0, -1, 0], n: "Bottom" }, right: { v: [1, 0, 0], r: [0, 1, 0], u: [0, 0, 1], n: "Right" }, left: { v: [-1, 0, 0], r: [0, -1, 0], u: [0, 0, 1], n: "Left" }, back: { v: [0, 1, 0], r: [-1, 0, 0], u: [0, 0, 1], n: "Back" } };
  (() => { const v = [1, -1, 1].map((x) => x / Math.sqrt(3)), r = [1 / Math.SQRT2, 1 / Math.SQRT2, 0], u = [v[1] * r[2] - v[2] * r[1], v[2] * r[0] - v[0] * r[2], v[0] * r[1] - v[1] * r[0]]; VIEWS.iso = { v, r, u, n: "Isometric" }; })();
  K.VIEWS3D = VIEWS;

  /* =============================== editor integration: plan display, picking, 3D view =============================== */
  K.editorHooks = K.editorHooks || [];
  K.editorHooks.push((E) => {
    const solids = () => E.doc.solids || [];
    const planCache = new WeakMap();
    const plan = (d) => { let s = planCache.get(d); if (s) return s; s = K.viewLines(K.solidGeom(d), [0, 0, 1], [1, 0, 0], [0, 1, 0], false).vis; planCache.set(d, s); return s; };
    E.paintHook = ((prev) => (ctx, P) => {
      if (prev) prev(ctx, P);
      if (!solids().length || (E.space && E.space.lay && !E.space.ms)) return;
      if (!V3) { K.load3D().then(() => E.redraw()); return; }
      for (const d of solids()) { P.style({ color: d.color || "#94a3b8", lt: "CONTINUOUS", lw: 0.25 }); for (const [a, b] of plan(d)) P.line(a, b); }
    })(E.paintHook);
    E.overlayHook = ((prev) => (ctx, P) => { if (prev) prev(ctx, P); if (!V3 || !E.sel3d || !E.sel3d.length) return; const hp = P({ width: 2.5, override: "#22d3ee" }); for (const d of solids()) if (E.sel3d.includes(d.id)) for (const [a, b] of plan(d)) hp.line(a, b); })(E.overlayHook);
    E.pickSolid2D = (wp) => { if (!V3) return null; const t = 7 / E.view.s; let best = null, bd = t; for (const d of solids()) for (const [a, b] of plan(d)) { const q = G.closestSeg(wp, a, b), dd = G.dist(q, wp); if (dd < bd) { bd = dd; best = d; } } return best ? best.id : null; };
    E.solidBounds = () => { if (!V3 || !solids().length || (E.space && E.space.lay)) return null; let b = null; for (const d of solids()) { const bb = K.solidGeom(d).boundingBox; b = G.mergeBounds(b, { x0: bb.min.x, y0: bb.min.y, x1: bb.max.x, y1: bb.max.y }); } return b; };
    E.setSolids = (list, label) => E.tx(label || "3D", () => { E.doc.solids = list; });
    E.sel3d = [];

    /* ---------- the 3D view ---------- */
    let R3 = null;
    const build = () => {
      const T = V3.THREE, host = E.$(".cx-cw");
      const wrap = document.createElement("div"); wrap.className = "cx-3d"; host.appendChild(wrap);
      wrap.innerHTML = `<div class="cx-3dbar"><b>3D view</b>${["top", "front", "right", "left", "back", "iso"].map((k) => `<button data-v="${k}">${VIEWS[k].n}</button>`).join("")}<button data-proj>Perspective</button><select data-vs><option value="se">Shaded with edges</option><option value="s">Shaded</option><option value="w">Wireframe</option><option value="x">X-ray</option></select><span style="flex:1"></span><button data-close>Back to 2D</button></div>`;
      const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(window.devicePixelRatio || 1); wrap.appendChild(renderer.domElement);
      const scene = new T.Scene(), persp = new T.PerspectiveCamera(40, 1, 0.1, 1e7), ortho = new T.OrthographicCamera(-1, 1, 1, -1, -1e7, 1e7);
      for (const c of [persp, ortho]) c.up.set(0, 0, 1);
      scene.add(new T.HemisphereLight(0xffffff, 0x445566, 1.1)); const dl = new T.DirectionalLight(0xffffff, 1.6); dl.position.set(1, -1.5, 2.2); scene.add(dl); const dl2 = new T.DirectionalLight(0xffffff, 0.5); dl2.position.set(-1.2, 1, -0.6); scene.add(dl2);
      const root = new T.Group(); scene.add(root); const plane = new T.Group(); scene.add(plane);
      const st = { renderer, scene, persp, ortho, cam: persp, root, plane, wrap, style: "se", ctl: null };
      st.ctl = new V3.OrbitControls(persp, renderer.domElement); st.ctl.enableDamping = true; st.ctl.dampingFactor = 0.12; st.ctl.screenSpacePanning = true;
      const size = () => { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h); persp.aspect = w / h; persp.updateProjectionMatrix(); const s = st.os || 100; ortho.left = -s * w / h; ortho.right = s * w / h; ortho.top = s; ortho.bottom = -s; ortho.updateProjectionMatrix(); };
      new ResizeObserver(size).observe(host); size();
      const loop = () => { if (!R3 || !R3.on) return; st.ctl.update(); if (st.cam === ortho) { const d = persp.position.distanceTo(st.ctl.target); st.os = d * Math.tan(20 * D2R); ortho.position.copy(persp.position); ortho.quaternion.copy(persp.quaternion); size(); } renderer.render(scene, st.cam); requestAnimationFrame(loop); };
      st.loop = loop;
      wrap.querySelector(".cx-3dbar").addEventListener("click", (ev) => {
        const b = ev.target.closest("button"); if (!b) return;
        if (b.dataset.v) return setView(b.dataset.v);
        if (b.hasAttribute("data-proj")) { st.cam = st.cam === persp ? ortho : persp; b.textContent = st.cam === persp ? "Perspective" : "Orthographic"; return; }
        if (b.hasAttribute("data-close")) return E.show3D(false);
      });
      wrap.querySelector("[data-vs]").onchange = (ev) => { st.style = ev.target.value; refresh(); };
      // clicks: point input on the ground plane, or selection of solids
      let down = null;
      renderer.domElement.addEventListener("pointerdown", (ev) => { down = [ev.clientX, ev.clientY]; });
      renderer.domElement.addEventListener("pointerup", (ev) => {
        if (!down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 4 || ev.button !== 0) return; down = null;
        const r = renderer.domElement.getBoundingClientRect(), ndc = new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), ray = new T.Raycaster(); ray.setFromCamera(ndc, st.cam);
        const kind = E.reqKind();
        if (kind === "point" || kind === "dist" || kind === "angle") { const hit = ray.intersectObjects(root.children.filter((o) => o.isMesh), false)[0]; const p = hit ? hit.point : ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 0, 1), 0), new T.Vector3()); if (p) E.submit(`${K.fmt(p.x, 4)},${K.fmt(p.y, 4)}`); return; }
        const hit = ray.intersectObjects(root.children.filter((o) => o.isMesh), false)[0], id = hit ? hit.object.userData.id : null;
        if (kind === "solid") { if (id) E.resolveReq(id); return; }
        if (!id) E.sel3d = []; else if (ev.shiftKey) E.sel3d = E.sel3d.includes(id) ? E.sel3d.filter((x) => x !== id) : E.sel3d.concat(id); else E.sel3d = [id];
        refreshSel(); E.refreshSide();
      });
      return st;
    };
    const setView = (k) => { const st = R3, T = V3.THREE, box = new T.Box3(); st.root.children.forEach((o) => box.expandByObject(o)); if (box.isEmpty()) box.set(new T.Vector3(-50, -50, 0), new T.Vector3(50, 50, 50)); const c = box.getCenter(new T.Vector3()), r = box.getSize(new T.Vector3()).length() || 100, v = VIEWS[k].v; st.ctl.target.copy(c); st.persp.position.set(c.x + v[0] * r * 1.6, c.y + v[1] * r * 1.6 + (k === "top" || k === "bottom" ? -1e-3 * r : 0), c.z + v[2] * r * 1.6); st.persp.near = r / 1000; st.persp.far = r * 100; st.persp.updateProjectionMatrix(); st.ctl.update(); };
    const refreshSel = () => { if (!R3) return; for (const o of R3.root.children) if (o.isMesh) o.material.emissive && o.material.emissive.setHex(E.sel3d.includes(o.userData.id) ? 0x0e7490 : 0x000000); };
    const refresh = () => {
      if (!R3) return; const T = V3.THREE, st = R3;
      for (const g of [st.root, st.plane]) while (g.children.length) { const o = g.children.pop(); if (o.material) o.material.dispose(); if (g === st.plane && o.geometry) o.geometry.dispose(); }
      for (const d of solids()) {
        let geo; try { geo = K.solidGeom(d); } catch (e) { E.err(`Could not build ${solidName(d)}: ${e.message}`); continue; }
        const col = new T.Color(d.color && d.color !== "#ffffff" ? d.color : "#b8c4d4");
        if (st.style !== "w") { const m = new T.Mesh(geo, new T.MeshStandardMaterial({ color: col, metalness: 0.1, roughness: 0.55, transparent: st.style === "x", opacity: st.style === "x" ? 0.35 : 1, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, depthWrite: st.style !== "x" })); m.userData.id = d.id; st.root.add(m); }
        else { const m = new T.Mesh(geo, new T.MeshBasicMaterial({ visible: false })); m.userData.id = d.id; st.root.add(m); }
        if (st.style !== "s") st.root.add(new T.LineSegments(K.creaseLines(geo), new T.LineBasicMaterial({ color: st.style === "w" ? col : 0x1f2937 })));
      }
      // the 2D drawing on the ground plane
      const pts = []; for (const e of E.doc.ents) { if (!E.visible(e)) continue; for (const s of K.segs(e, E.doc)) { if (s.k === "s") pts.push(s.a[0], s.a[1], 0, s.b[0], s.b[1], 0); else { const ap = G.arcPoints(s.c, s.r, s.full ? 0 : s.a0, s.full ? G.TAU : s.a1, Math.max(s.r * 0.01, 0.01)); for (let i = 0; i < ap.length - 1; i++) pts.push(ap[i][0], ap[i][1], 0, ap[i + 1][0], ap[i + 1][1], 0); } } if (pts.length > 3e6) break; }
      if (pts.length) { const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pts, 3)); st.plane.add(new T.LineSegments(g, new T.LineBasicMaterial({ color: 0x64748b }))); }
      const box = new T.Box3(); st.root.children.forEach((o) => box.expandByObject(o)); st.plane.children.forEach((o) => box.expandByObject(o)); const sz = box.isEmpty() ? 200 : Math.max(box.getSize(new T.Vector3()).x, box.getSize(new T.Vector3()).y) * 1.4;
      const step = Math.pow(10, Math.floor(Math.log10(sz / 10))), grid = new T.GridHelper(Math.ceil(sz / step) * step, Math.ceil(sz / step), 0x475569, 0x334155); grid.rotateX(Math.PI / 2); const c = box.isEmpty() ? new T.Vector3() : box.getCenter(new T.Vector3()); grid.position.set(Math.round(c.x / step) * step, Math.round(c.y / step) * step, 0); st.plane.add(grid);
      st.scene.background = new T.Color(E.set.light ? 0xf1f5f9 : 0x1e2833);
      refreshSel();
    };
    E.refresh3D = () => { if (R3 && R3.on) refresh(); };
    E.show3D = async (on) => {
      if (on) { try { await K.load3D(); } catch (e) { return E.err(e.message); } if (!R3) R3 = build(); R3.on = true; R3.wrap.style.display = "block"; refresh(); if (!R3.viewed) { setView("iso"); R3.viewed = true; } R3.loop(); E.mode3d = true; E.msg("3D view: drag to orbit, right-drag or Shift-drag to pan, wheel to zoom. Click a solid to select it.", "mu"); }
      else if (R3) { R3.on = false; R3.wrap.style.display = "none"; E.mode3d = false; E.redraw(); }
      E.refreshSide();
    };
    E.changeHook = ((prev) => () => { if (prev) prev(); E.refresh3D(); })(E.changeHook);
  });
  K.propsHooks = K.propsHooks || [];
  K.propsHooks.push((E, el, ents) => {
    if (!E.sel3d || !E.sel3d.length || (ents && ents.length) || !V3) return; const list = E.doc.solids || [], sel = list.filter((d) => E.sel3d.includes(d.id)); if (!sel.length) return;
    const box = document.createElement("div"), d = sel[0], p = d.p || {}, m = d.m ? new V3.THREE.Matrix4().fromArray(d.m) : new V3.THREE.Matrix4(), pos = new V3.THREE.Vector3().setFromMatrixPosition(m);
    const F = (k, label, v) => `<label>${label}<input data-sp="${k}" type="number" step="any" value="${K.fmt(v, 4)}"></label>`;
    const PF = { box: [["w", "Length X"], ["d", "Width Y"], ["h", "Height Z"]], cyl: [["r", "Radius"], ["h", "Height"]], cone: [["r1", "Base radius"], ["r2", "Top radius"], ["h", "Height"]], sphere: [["r", "Radius"]], torus: [["R", "Ring radius"], ["r", "Tube radius"]], wedge: [["w", "Length X"], ["d", "Width Y"], ["h", "Height Z"]], extrude: [["h", "Height"]], revolve: [["ang", "Angle (°)"]] }[d.kind] || [];
    const vol = (() => { try { const g = K.solidGeom(d), P = g.getAttribute("position"), I = g.index ? g.index.array : null; let v = 0; const n = I ? I.length : P.count; for (let i = 0; i < n; i += 3) { const a = I ? I[i] : i, b = I ? I[i + 1] : i + 1, c = I ? I[i + 2] : i + 2; v += (P.getX(a) * (P.getY(b) * P.getZ(c) - P.getZ(b) * P.getY(c)) - P.getY(a) * (P.getX(b) * P.getZ(c) - P.getZ(b) * P.getX(c)) + P.getZ(a) * (P.getX(b) * P.getY(c) - P.getY(b) * P.getX(c))) / 6; } return Math.abs(v); } catch (e) { return NaN; } })();
    box.innerHTML = `<h4>${sel.length > 1 ? sel.length + " solids" : esc(solidName(d))}</h4>${sel.length === 1 ? `<div class="cx-pg"><label class="cx-w">Name<input data-sn value="${esc(d.name || "")}" placeholder="${esc(solidName(d))}"></label>${PF.map(([k, n]) => F(k, n, p[k] ?? 0)).join("")}${F("x", "Position X", pos.x)}${F("y", "Position Y", pos.y)}${F("z", "Position Z", pos.z)}<label>Colour<input data-sc type="color" value="${d.color && d.color.startsWith("#") ? d.color : "#b8c4d4"}"></label></div><div class="cx-kv"><span>Volume</span><b>${isFinite(vol) ? K.fmt(vol, 2) + " " + E.doc.units + "³" : "—"}</b><span>Mass (steel 7.85 g/cm³)</span><b>${isFinite(vol) ? K.fmt(vol * 7.85e-6 * Math.pow(K.UNITMM[E.doc.units] || 1, 3), 3) + " kg" : "—"}</b></div>` : ""}<div class="cx-pa"><button class="cx-b o" data-run="UNION">Union</button><button class="cx-b o" data-run="SUBTRACT">Subtract</button><button class="cx-b o" data-run="MOVE3D">Move</button><button class="cx-b o" data-run="ROTATE3D">Rotate</button><button class="cx-b o" data-run="DELSOLID">Remove</button></div>`;
    el.innerHTML = ""; el.appendChild(box);
    const upd = (fn) => E.setSolids(list.map((x) => (x.id === d.id ? fn(Object.assign({}, x, { p: Object.assign({}, x.p) })) : x)), "edit solid");
    box.querySelectorAll("[data-sp]").forEach((i) => (i.onchange = () => { const k = i.dataset.sp, v = +i.value; if (!isFinite(v)) return; if (["x", "y", "z"].includes(k)) upd((n) => { const mm = n.m ? new V3.THREE.Matrix4().fromArray(n.m) : new V3.THREE.Matrix4(), pp = new V3.THREE.Vector3().setFromMatrixPosition(mm); pp[k] = v; mm.setPosition(pp); n.m = mm.toArray(); return n; }); else { if (v <= 0 && k !== "r2") return E.err("The value must be more than zero."); upd((n) => { n.p[k] = v; return n; }); } }));
    const nm = box.querySelector("[data-sn]"); if (nm) nm.onchange = () => upd((n) => Object.assign(n, { name: nm.value.trim() || undefined }));
    const sc = box.querySelector("[data-sc]"); if (sc) sc.onchange = () => upd((n) => Object.assign(n, { color: sc.value }));
    box.querySelectorAll("[data-run]").forEach((b) => (b.onclick = () => E.run(b.dataset.run)));
  });

  /* =============================== commands =============================== */
  const add = async (E, d, label) => { await K.load3D(); d.id = K.uid(); if (!d.color && E.cur.color && E.cur.color.startsWith("#")) d.color = E.cur.color; E.setSolids((E.doc.solids || []).concat([d]), label); E.msg(`${solidName(d)} created.${E.mode3d ? "" : " 3D (or the 3D button) shows it in 3D."}`); return d; };
  const at = (p, z = 0) => new V3.THREE.Matrix4().makeTranslation(p[0], p[1], z).toArray();
  const height = async (E, base) => { const h = await E.getDist("Specify height:", { base }); if (h == null || h.kw) throw K.CANCEL; if (!(Math.abs(h) > 1e-9)) throw new Error("The height must not be zero."); return h; };
  const pre3 = async (E) => { await K.load3D(); if (E.space && E.space.lay && !E.space.ms) { E.err("3D works in model space (Model tab)."); return false; } return true; };
  cmd("BOX", { a: [], d: "3D box solid (corner, opposite corner, height)", fn: async (E) => {
    if (!(await pre3(E))) return; const a = need(await E.getPoint("Specify first corner:")); const b = need(await E.getPoint("Specify other corner or [Cube]:", { base: a, noRubber: true, kws: ["Cube"], preview: (q) => [{ t: "pline", closed: true, pts: [[a[0], a[1]], [q[0], a[1]], [q[0], q[1]], [a[0], q[1]]] }] }));
    if (b.kw) { const L = need(await E.getDist("Specify length:", { base: a })); return add(E, { kind: "box", p: { w: L, d: L, h: L }, m: at(a) }); }
    const h = await height(E, b), x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1]); if (Math.abs(a[0] - b[0]) < 1e-9 || Math.abs(a[1] - b[1]) < 1e-9) return E.err("The box has no area.");
    await add(E, { kind: "box", p: { w: Math.abs(b[0] - a[0]), d: Math.abs(b[1] - a[1]), h: Math.abs(h) }, m: at([x0, y0], h < 0 ? h : 0) });
  } });
  cmd("CYLINDER", { a: ["CYL"], d: "3D cylinder solid (centre, radius, height)", fn: async (E) => {
    if (!(await pre3(E))) return; const c = need(await E.getPoint("Specify center point of base:")); const r = need(await E.getDist("Specify base radius or [Diameter]:", { base: c, kws: ["Diameter"], preview: (q) => [{ t: "circle", c, r: G.dist(c, q) }] }));
    const R = r && r.kw ? (await E.getDist("Specify diameter:", { base: c })) / 2 : r; if (!(R > 0)) return; const h = await height(E, c);
    await add(E, { kind: "cyl", p: { r: R, h: Math.abs(h) }, m: at(c, h < 0 ? h : 0) });
  } });
  cmd("CONE", { a: [], d: "3D cone or frustum (centre, base radius, height, top radius)", fn: async (E) => {
    if (!(await pre3(E))) return; const c = need(await E.getPoint("Specify center point of base:")); const r1 = need(await E.getDist("Specify base radius:", { base: c, preview: (q) => [{ t: "circle", c, r: G.dist(c, q) }] }));
    const v = need(await E.getDist("Specify height or [Top radius]:", { base: c, kws: ["Top radius"] })); let r2 = 0, h = v; if (v && v.kw) { r2 = need(await E.getDist("Specify top radius <0>:", { dflt: 0 })); h = await height(E, c); }
    await add(E, { kind: "cone", p: { r1, r2, h: Math.abs(h) }, m: at(c, h < 0 ? h : 0) });
  } });
  cmd("SPHERE", { a: [], d: "3D sphere (centre, radius)", fn: async (E) => { if (!(await pre3(E))) return; const c = need(await E.getPoint("Specify center point:")); const r = need(await E.getDist("Specify radius:", { base: c, preview: (q) => [{ t: "circle", c, r: G.dist(c, q) }] })); if (r > 0) await add(E, { kind: "sphere", p: { r }, m: at(c) }); } });
  cmd("TORUS", { a: ["TOR"], d: "3D torus (centre, ring radius, tube radius)", fn: async (E) => { if (!(await pre3(E))) return; const c = need(await E.getPoint("Specify center point:")); const R = need(await E.getDist("Specify radius of the ring:", { base: c })); const r = need(await E.getDist("Specify radius of the tube:")); if (r > 0 && R > 0) await add(E, { kind: "torus", p: { R, r }, m: at(c) }); } });
  cmd("WEDGE", { a: ["WE"], d: "3D wedge (corner, opposite corner, height)", fn: async (E) => { if (!(await pre3(E))) return; const a = need(await E.getPoint("Specify first corner:")); const b = need(await E.getPoint("Specify other corner:", { base: a, noRubber: true })); const h = await height(E, b); await add(E, { kind: "wedge", p: { w: Math.abs(b[0] - a[0]), d: Math.abs(b[1] - a[1]), h: Math.abs(h) }, m: at([Math.min(a[0], b[0]), Math.min(a[1], b[1])]) }); } });
  cmd("EXTRUDE", { a: ["EXT"], d: "Extrude closed 2D objects into solids (inner loops become holes)", fn: async (E) => {
    if (!(await pre3(E))) return; const ids = await E.getSel("Select closed objects to extrude (circles, closed polylines, rectangles, ellipses):", { filter: (e) => !!G.outline(e) }); if (!ids.length) return;
    const loops = ids.map((id) => ({ id, l: G.outline(E.byId(id), 0.02) })).filter((x) => x.l && x.l.length > 2).map((x) => Object.assign(x, { a: Math.abs(G.area(x.l)) })).sort((a, b) => b.a - a.a);
    const h = await height(E, null), groups = [];
    for (const x of loops) { const host = groups.filter((g) => G.inPoly(x.l[0], g.outer)).sort((a, b) => a.a - b.a)[0]; if (host && host.depth % 2 === 0 && !host.holes.length) host.holes.push(x.l); else if (host && host.depth % 2 === 0) host.holes.push(x.l); else groups.push({ outer: x.l, a: x.a, holes: [], depth: 0 }); }
    const list = groups.map((g) => ({ id: K.uid(), kind: "extrude", p: { loops: [g.outer].concat(g.holes), h: Math.abs(h) }, m: h < 0 ? at([0, 0], h) : undefined }));
    E.tx("extrude", () => { E.doc.solids = (E.doc.solids || []).concat(list); E.remove(ids); }); E.msg(`${list.length} solid(s) extruded.`);
  } });
  cmd("REVOLVE", { a: ["REV"], d: "Revolve a closed 2D profile about an axis into a solid (shafts, rings, pulleys)", fn: async (E) => {
    if (!(await pre3(E))) return; const s = need(await E.getEnt("Select the closed profile to revolve:", { filter: (e) => !!G.outline(e) })); const loop = G.outline(s.e, 0.02);
    const a = need(await E.getPoint("Specify axis start point:")); const b = need(await E.getPoint("Specify axis endpoint:", { base: a }));
    if (G.dist(a, b) < 1e-9) return E.err("The axis has no length."); const u = G.unit(G.sub(b, a)), n = [-u[1], u[0]], sides = loop.map((q) => Math.sign(G.dot(G.sub(q, a), n))).filter((x) => x); if (sides.some((x) => x !== sides[0])) return E.err("The profile must lie on one side of the axis.");
    const ang = await E.getNum("Specify angle of revolution <360>:", { dflt: 360 }); const d = { id: K.uid(), kind: "revolve", p: { loop, a, b, ang: Math.max(1, Math.min(360, Math.abs(ang || 360))) } };
    E.tx("revolve", () => { E.doc.solids = (E.doc.solids || []).concat([d]); E.remove([s.e.id]); }); E.msg("Revolved solid created.");
  } });
  const pickSolids = async (E, msg, n) => { const out = E.sel3d && E.sel3d.length >= (n || 1) ? E.sel3d.slice() : []; if (out.length) { E.sel3d = []; E.msg(out.length + " solid(s) already selected.", "mu"); return out; } for (;;) { const id = await E.getSolid(msg + " (Enter when done):"); if (!id) break; if (!out.includes(id)) out.push(id); E.sel3d = out.slice(); E.drawOverlay(); E.refresh3D && E.refresh3D(); } E.sel3d = []; return out; };
  const boolOp = (op, label) => async (E) => {
    if (!(await pre3(E))) return; const all = () => E.doc.solids || [];
    if (op === "sub") {
      const A = await pickSolids(E, "Select the solid(s) to subtract from"); if (!A.length) return; const B = []; for (;;) { const id = await E.getSolid("Select the solid(s) to remove (Enter when done):"); if (!id) break; if (!A.includes(id) && !B.includes(id)) B.push(id); } if (!B.length) return;
      let a = A.map((id) => all().find((d) => d.id === id)).reduce((x, y) => ({ kind: "bool", op: "union", a: x, b: y })), b = B.map((id) => all().find((d) => d.id === id)).reduce((x, y) => ({ kind: "bool", op: "union", a: x, b: y }));
      const r = { id: K.uid(), kind: "bool", op: "sub", a, b, color: a.color }; try { K.solidGeom(r); } catch (e) { return E.err("The subtraction failed: " + e.message); }
      E.setSolids(all().filter((d) => !A.includes(d.id) && !B.includes(d.id)).concat([r]), label); E.sel3d = [r.id]; return;
    }
    const S = await pickSolids(E, "Select solids", 2); if (S.length < 2) return E.msg("Select at least two solids.");
    const r = Object.assign(S.map((id) => all().find((d) => d.id === id)).reduce((x, y) => ({ kind: "bool", op, a: x, b: y })), { id: K.uid() }); try { K.solidGeom(r); } catch (e) { return E.err("The operation failed: " + e.message); }
    E.setSolids(all().filter((d) => !S.includes(d.id)).concat([r]), label); E.sel3d = [r.id];
  };
  cmd("UNION", { a: ["UNI"], d: "Join solids into one", fn: boolOp("union", "union") });
  cmd("SUBTRACT", { a: ["SU"], d: "Subtract solids (holes, pockets, slots)", fn: boolOp("sub", "subtract") });
  cmd("INTERSECT", { a: ["IN"], d: "Keep only the common volume of solids", fn: boolOp("int", "intersect") });
  cmd("DELSOLID", { a: ["DELS"], d: "Remove solids", fn: async (E) => { if (!(await pre3(E))) return; const S = await pickSolids(E, "Select solids to remove"); if (S.length) E.setSolids((E.doc.solids || []).filter((d) => !S.includes(d.id)), "remove solid"); } });
  cmd("MOVE3D", { a: ["M3D", "3DMOVE"], d: "Move solids in X, Y and Z", fn: async (E) => {
    if (!(await pre3(E))) return; const S = await pickSolids(E, "Select solids to move"); if (!S.length) return;
    const t = need(await E.getText("Enter the move as dx,dy,dz (e.g. 0,0,25):")); const v = String(t).split(/[,\s]+/).map(Number); if (v.length < 2 || v.some((x) => !isFinite(x))) return E.err("Enter dx,dy,dz.");
    const m = new V3.THREE.Matrix4().makeTranslation(v[0], v[1], v[2] || 0); E.setSolids((E.doc.solids || []).map((d) => (S.includes(d.id) ? xformDef(d, m) : d)), "move 3D"); E.sel3d = S;
  } });
  cmd("ROTATE3D", { a: ["3DROTATE", "R3D"], d: "Rotate solids about the X, Y or Z axis through a point", fn: async (E) => {
    if (!(await pre3(E))) return; const S = await pickSolids(E, "Select solids to rotate"); if (!S.length) return;
    const k = await E.getKw("Rotation axis [X/Y/Z] <Z>:", ["X", "Y", "Z"], "Z"), ax = k && k.kw ? k.kw : "Z"; const p = need(await E.getPoint("Specify a point on the axis (in plan):")); const z = ax === "Z" ? 0 : +(await E.getNum("Height (Z) of the axis <0>:", { dflt: 0 })) || 0; const a = need(await E.getNum("Angle in degrees:"));
    const T = V3.THREE, m = new T.Matrix4().makeTranslation(p[0], p[1], z).multiply(ax === "X" ? new T.Matrix4().makeRotationX(a * D2R) : ax === "Y" ? new T.Matrix4().makeRotationY(a * D2R) : new T.Matrix4().makeRotationZ(a * D2R)).multiply(new T.Matrix4().makeTranslation(-p[0], -p[1], -z));
    E.setSolids((E.doc.solids || []).map((d) => (S.includes(d.id) ? xformDef(d, m) : d)), "rotate 3D"); E.sel3d = S;
  } });
  cmd("COPY3D", { a: ["3DCOPY"], d: "Copy solids by dx,dy,dz", fn: async (E) => { if (!(await pre3(E))) return; const S = await pickSolids(E, "Select solids to copy"); if (!S.length) return; const t = need(await E.getText("Enter the offset as dx,dy,dz:")); const v = String(t).split(/[,\s]+/).map(Number); if (v.some((x) => !isFinite(x))) return; const m = new V3.THREE.Matrix4().makeTranslation(v[0], v[1] || 0, v[2] || 0); const add2 = (E.doc.solids || []).filter((d) => S.includes(d.id)).map((d) => Object.assign(xformDef(d, m), { id: K.uid() })); E.setSolids((E.doc.solids || []).concat(add2), "copy 3D"); E.sel3d = add2.map((d) => d.id); } });
  cmd("3DORBIT", { a: ["3D", "3DO", "ORBIT", "VIEW3D"], d: "Show the 3D view (orbit, zoom, visual styles); again to go back to 2D", norepeat: true, keepSel: true, fn: async (E) => E.show3D(!E.mode3d) });
  cmd("STLOUT", { a: ["STLEXPORT", "EXPORTSTL", "STL"], d: "Export the solids as an STL file (3D printing, CAM)", norepeat: true, fn: async (E) => {
    if (!(E.doc.solids || []).length) return E.msg("There are no solids."); await K.load3D(); const T = V3.THREE, grp = new T.Group(); for (const d of E.doc.solids) grp.add(new T.Mesh(K.solidGeom(d)));
    const out = new V3.STLExporter().parse(grp, { binary: true }); K.download(String((E.info && (E.info.number || E.info.title)) || "model").replace(/[^\w\-. ]+/g, "_") + ".stl", new Blob([out], { type: "model/stl" })); E.msg("STL exported.");
  } });
  cmd("STEPIN", { a: ["IMPORTSTEP", "STEP"], d: "Import a STEP (.stp / .step) 3D model as solids", fn: async (E) => {
    if (E.space && E.space.lay && !E.space.ms) return E.err("3D works in model space (Model tab)."); const f = await K.pickFile(".stp,.step"); if (!f) return; await K.load3D();
    try { const parts = await K.readStep(await f.arrayBuffer(), (m) => E.msg(m, "mu")); const list = parts.map((p) => ({ id: K.uid(), kind: "mesh", name: p.name, color: p.color, p: { pos: p.pos, idx: p.idx } })); E.setSolids((E.doc.solids || []).concat(list), "import STEP"); E.msg(`${list.length} part(s) imported from ${f.name}. They can be moved, viewed, exported to STL and used for 2D views.`); if (!E.mode3d) E.show3D(true); }
    catch (e) { E.err(e.message); }
  } });
  /* ---------- 2D drawing views from the 3D model ---------- */
  const makeView = (E, ids, key, sc) => {
    const S = (E.doc.solids || []).filter((d) => ids.includes(d.id)); if (!S.length) return null;
    const vw = VIEWS[key], vis = [], hid = [];
    for (const d of S) { const r = K.viewLines(K.solidGeom(d), vw.v, vw.r, vw.u, true); vis.push(...r.vis); if (key !== "iso") hid.push(...r.hid); }
    const b = G.bounds(vis.concat(hid).flat()); if (!b) return null; const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const ln = (s, hidden) => ({ t: "line", layer: hidden ? (E.doc.layers.find((l) => l.name === "Hidden") ? "Hidden" : "0") : E.doc.layers.find((l) => l.name === "Outline") ? "Outline" : "0", a: [(s[0][0] - cx) * sc, (s[0][1] - cy) * sc], b: [(s[1][0] - cx) * sc, (s[1][1] - cy) * sc], lt: hidden && !E.doc.layers.find((l) => l.name === "Hidden") ? "HIDDEN" : undefined });
    return { ents: vis.map((s) => ln(s, false)).concat(hid.map((s) => ln(s, true))), w: (b.x1 - b.x0) * sc, h: (b.y1 - b.y0) * sc, name: vw.n };
  };
  const placeView = (E, ids, key, sc, p) => { const v = makeView(E, ids, key, sc); if (!v) return null; let i = 1; while (E.doc.blocks["VIEW-" + v.name.toUpperCase() + "-" + i]) i++; const nm = "VIEW-" + v.name.toUpperCase() + "-" + i; E.doc.blocks = Object.assign({}, E.doc.blocks, { [nm]: { base: [0, 0], ents: v.ents } }); return E.add({ t: "insert", name: nm, p, sx: 1, sy: 1, rot: 0, view3d: { key, ids, sc } }, true); };
  cmd("VIEWBASE", { a: ["VB", "BASEVIEW", "VIEWS2D"], d: "2D drawing views from the 3D model: front view, then projected top / side / isometric views with hidden lines", fn: async (E) => {
    if (!(await pre3(E))) return; if (!(E.doc.solids || []).length) return E.msg("Make or import 3D solids first.");
    const ids = (E.sel3d && E.sel3d.length ? E.sel3d : (E.doc.solids || []).map((d) => d.id)).slice(); E.sel3d = [];
    if (E.mode3d) await E.show3D(false);
    const M = (E.mem = E.mem || {}); M.proj = M.proj || "first";
    const r = await E.dialog("Drawing views from the model", `<div class="cx-frm"><label>Base view<select id="vb">${["front", "top", "right", "left", "back", "bottom", "iso"].map((k) => `<option value="${k}">${VIEWS[k].n}</option>`).join("")}</select></label><label>Scale 1 :<input id="vs" type="number" step="any" min="0" value="${M.vsc || 1}"></label><label>Projection<select id="vp"><option value="first"${M.proj === "first" ? " selected" : ""}>First angle (ISO E)</option><option value="third"${M.proj === "third" ? " selected" : ""}>Third angle (ISO A)</option></select></label></div><p class="cx-note">${ids.length} solid(s). After OK, place the base view, then click above, below, left, right or diagonally for projected views (Enter to finish). Hidden edges come out on the Hidden layer.</p>`, (b) => ({ base: b.querySelector("#vb").value, sc: 1 / (+b.querySelector("#vs").value || 1), proj: b.querySelector("#vp").value }));
    if (!r) return; Object.assign(M, { proj: r.proj, vsc: 1 / r.sc });
    E.msg("Working out visible and hidden lines…", "mu");
    const pv = makeView(E, ids, r.base, r.sc); if (!pv) return E.err("Nothing to show.");
    const p0 = need(await E.getPoint("Specify location of base view:", { preview: (q) => pv.ents.slice(0, 3000).map((e) => K.xform(e, K.M.move(q[0], q[1]))) }));
    E.begin("drawing views"); placeView(E, ids, r.base, r.sc, p0);
    if (r.base !== "front") return;
    const map = r.proj === "first" ? { up: "bottom", down: "top", left: "right", right: "left" } : { up: "top", down: "bottom", left: "left", right: "right" };
    for (;;) {
      const which = (q) => { const dx = q[0] - p0[0], dy = q[1] - p0[1]; if (Math.abs(dx) > pv.w * 0.6 && Math.abs(dy) > pv.h * 0.6) return "iso"; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? map.right : map.left) : dy > 0 ? map.up : map.down; };
      const q = await E.getPoint("Specify location of projected view <exit>:", { base: p0 }); if (!isP(q)) break;
      const k = which(q), pos = k === "iso" ? q : Math.abs(q[0] - p0[0]) > Math.abs(q[1] - p0[1]) ? [q[0], p0[1]] : [p0[0], q[1]];
      if (!placeView(E, ids, k, r.sc, pos)) E.err("That view is empty."); else E.msg(`${VIEWS[k].n} view placed.`);
    }
  } });
  cmd("VIEWUPDATE", { a: ["VU"], d: "Update the 2D drawing views after the 3D model changed", fn: async (E) => {
    await K.load3D(); const vs = E.doc.ents.filter((e) => e.t === "insert" && e.view3d); if (!vs.length) return E.msg("No drawing views made from the model (VIEWBASE).");
    let n = 0; E.tx("update views", () => { for (const e of vs) { const ids = e.view3d.ids.filter((id) => (E.doc.solids || []).some((d) => d.id === id)); const v = ids.length && makeView(E, ids, e.view3d.key, e.view3d.sc); if (!v) continue; E.doc.blocks = Object.assign({}, E.doc.blocks, { [e.name]: { base: [0, 0], ents: v.ents } }); E.replace(e.id, Object.assign({}, e)); n++; } });
    E.msg(n + " view(s) updated.");
  } });

  /* DXF: solids go out as 3D faces on layer "3D-SOLIDS" (AutoCAD, CAM and viewers show the model; DXF cannot carry exact solid data) */
  K.dxfExtra = (doc, put) => {
    if (!V3 || !(doc.solids || []).length) return; let n = 0;
    for (const d of doc.solids) {
      let g; try { g = K.solidGeom(d); } catch (e) { continue; } const P = g.getAttribute("position"), I = g.index ? g.index.array : null, cnt = I ? I.length : P.count;
      for (let i = 0; i < cnt && n < 300000; i += 3, n++) { put(0, "3DFACE"); put(8, "3D-SOLIDS"); const ix = [I ? I[i] : i, I ? I[i + 1] : i + 1, I ? I[i + 2] : i + 2, I ? I[i + 2] : i + 2]; ix.forEach((k, j) => { put(10 + j, +P.getX(k).toFixed(5)); put(20 + j, +P.getY(k).toFixed(5)); put(30 + j, +P.getZ(k).toFixed(5)); }); }
    }
  };
  /* ribbon: a 3D tab */
  K.RIBBON.splice(4, 0, { t: "3D", g: [
    { n: "View", b: [["3DORBIT", "3D view", "rotate"], ["STLOUT", "STL", "exportI"], ["STEPIN", "STEP in", "open"]] },
    { n: "Solids", b: [["BOX", "Box", "rect"], ["CYLINDER", "Cylinder", "circle"], ["CONE", "Cone", "polygon"], ["SPHERE", "Sphere", "circle"], ["TORUS", "Torus", "donut"], ["WEDGE", "Wedge", "chamfer"], ["EXTRUDE", "Extrude", "exportI"], ["REVOLVE", "Revolve", "rotate"]] },
    { n: "Edit", b: [["UNION", "Union", "join"], ["SUBTRACT", "Subtract", "trim"], ["INTERSECT", "Intersect", "area"], ["MOVE3D", "Move 3D", "move"], ["ROTATE3D", "Rotate 3D", "rotate"], ["COPY3D", "Copy 3D", "copy"], ["DELSOLID", "Remove", "erase"]] },
    { n: "Drawing", b: [["VIEWBASE", "Views from model", "title"], ["VIEWUPDATE", "Update views", "rotate"]] },
  ] });
})((window.KCAD = window.KCAD || {}));
