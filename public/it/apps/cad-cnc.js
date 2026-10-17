/* KMR CAD Draft — CNC turning program + machining simulation, made from the stage drawing of an operation.
   gen():    part outline of the stage (SP.state) -> ISO G-code (Fanuc style) in program coordinates X = diameter, Z = 0 at the finished working face, negative into the part
   interp(): reads the program TEXT back into moves (the program on screen is the program that is simulated)
   Sim:      material-removal simulation of the half section on a fine grid, tool, chuck, chips, program listing, recorded to WebM */
(function (K) {
  "use strict";
  const CN = (K.cnc = {});
  const SPk = () => K.stageProg;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const fmt = (v) => { let s = (Math.round(v * 1000) / 1000).toFixed(3).replace(/0+$/, ""); if (s === "-0.") s = "0."; return s; };
  const ascii = (s) => String(s == null ? "" : s).replace(/Ø|⌀/g, "DIA ").replace(/±/g, "+-").replace(/[×x](?=\d)/gi, "X").replace(/°/g, " DEG").replace(/µ/g, "U").replace(/[^A-Za-z0-9 .,+\-/*:=#%]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();
  const eq2 = (p, q) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6;
  const sameSeg = (a, b, e) => (eq2(a, e.a) && eq2(b, e.b)) || (eq2(a, e.b) && eq2(b, e.a));

  /** cutting data by material (very common values, the programmer checks them against the tooling catalogue) */
  const cutData = (mat) => {
    const m = String(mat || "").toUpperCase();
    if (/ALU|\bAL\b|6061|6082|7075|2011/.test(m)) return { name: "ALUMINIUM", vcR: 380, vcF: 420, vcD: 90, vcT: 200 };
    if (/BRASS|CW6|CW5|CUZN|C36000|C3604|COPPER|BRONZE/.test(m)) return { name: "BRASS", vcR: 260, vcF: 300, vcD: 80, vcT: 150 };
    if (/STAINLESS|\bSS\b|AISI ?3|304|316|17-4|1\.43/.test(m)) return { name: "STAINLESS", vcR: 120, vcF: 140, vcD: 35, vcT: 70 };
    return { name: "STEEL", vcR: 180, vcF: 220, vcD: 60, vcT: 110 };
  };

  /** list of [u, r] points + the outline edge of each piece -> items: line / arc (G02 / G03) */
  const items = (pts, edges, arcOf) => {
    const out = []; let i = 0;
    while (i < pts.length - 1) {
      const e = edges[i], g = e && arcOf(e);
      if (g) {
        let j = i; while (j + 1 < pts.length - 1 && edges[j + 1] && arcOf(edges[j + 1]) === g) j++;
        const a = pts[i], b = pts[j + 1], mid = pts[i + Math.floor((j + 1 - i) / 2)];
        // machine frame: Z = -u (to the right), X = r (up)
        const cr = ((-b[0]) - (-a[0])) * (mid[1] - a[1]) - (b[1] - a[1]) * ((-mid[0]) - (-a[0]));
        const R = g.R || chordR(a, mid, b);
        out.push({ to: b, arc: { R: R3(R), cw: cr > 0 } });
        i = j + 1;
      } else { out.push({ to: pts[i + 1] }); i++; }
    }
    return out;
  };
  const R3 = (v) => Math.round(v * 1000) / 1000;
  const chordR = (p0, p1, p2) => { const a = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), b = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), c = Math.hypot(p2[0] - p0[0], p2[1] - p0[1]), ar = Math.abs((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1])) / 2; return ar > 1e-9 ? (a * b * c) / (4 * ar) : 1e9; };

  /** the program of one turning operation */
  CN.gen = (cx, rank, opt) => {
    opt = opt || {};
    const SP = SPk(), U = SP.util, nT = cx.nT, m = cx.m, model = cx.model, P = cx.P, H = P.header || {};
    const d = nT === 1 || rank === 0 ? 1 : -1, xw = d === 1 ? 0 : m.L, uOf = (x) => d * (x - xw), xOf = (u) => xw + d * u;
    const S0 = SP.state(cx, rank - 1), S = SP.state(cx, rank), jaws = SP.jaws(cx, S, rank);
    const stIdx = cx.stages.findIndex((o, i) => cx.rankOfStage.get(i) === rank), op = cx.stages[stIdx] || { opNo: 0, name: "" };
    const mine = (cx.map[String(op.opNo)] || []).map(Number).map((n) => cx.chars.get(n)).filter(Boolean);
    const cd = cutData(H.material), R0 = S0.R0;
    const lines = [], tools = {}; let nn = 10, curT = 0;
    const N = (s) => { lines.push(`N${nn} ${s}`); nn += 10; }, C = (s) => lines.push(`(${ascii(s)})`);
    const rpmAt = (vc, dia) => Math.min(4000, Math.round((vc * 1000) / (Math.PI * Math.max(dia, 4))));
    const toolNo = (n, name, kind, extra) => { tools[n] = Object.assign({ n, name, kind }, extra || {}); return n; };
    const tcode = (n) => `T${String(n).padStart(2, "0")}${String(n).padStart(2, "0")}`;
    const changeTool = (n, title) => { C(`${tcode(n)} ${title}`); N("G28 U0. W0."); N(tcode(n)); N("G54"); curT = n; };
    const eOf = (a, b, side) => cx.A.edges.find((e) => e.side === side && sameSeg(a, b, e));
    const arcOf = (e) => e.arc || null;

    // --- the outline made at this operation, in u (distance from the working face, + into the part) and r
    const segs = S.segs, rolesAll = segs.map((s) => s.role), thisIdx = rolesAll.map((r, i) => (r === "this" ? i : -1)).filter((i) => i >= 0);
    let oc = null, ocEdges = null;
    if (thisIdx.length) {
      const i0 = thisIdx[0], i1 = thisIdx[thisIdx.length - 1];
      oc = S.pts.slice(i0, i1 + 2).map((p) => [uOf(p[0]), p[1]]); ocEdges = segs.slice(i0, i1 + 1).map((s) => eOf(s.a, s.b, "o"));
      if (d === -1) { oc.reverse(); ocEdges.reverse(); }
    }
    const uStock = (() => { const xs = [S0.xl, S0.xr].map(uOf); return -Math.min(0, Math.min(...xs)); })();   // stock in front of the finished face
    const uEnd = oc ? oc[oc.length - 1][0] : 0, rMaxOc = oc ? Math.max(...oc.map((p) => p[1])) : R0;
    const dia0 = 2 * R0, fin = 0.25, ap = 1.2;

    // contour envelope seen from the free end (running maximum of the radius): what turning can reach
    const STEP = 0.02, nS = oc ? Math.ceil(uEnd / STEP) + 1 : 0, rc = new Float64Array(nS).fill(-1), cm = new Float64Array(nS);
    if (oc) {
      for (let k = 0; k + 1 < oc.length; k++) {
        const a = oc[k], b = oc[k + 1];
        if (Math.abs(b[0] - a[0]) < 1e-9) { const j = Math.min(nS - 1, Math.round(a[0] / STEP)); rc[j] = Math.max(rc[j], a[1], b[1]); continue; }
        const j0 = Math.max(0, Math.ceil(Math.min(a[0], b[0]) / STEP - 1e-9)), j1 = Math.min(nS - 1, Math.floor(Math.max(a[0], b[0]) / STEP + 1e-9));
        for (let j = j0; j <= j1; j++) { const u = j * STEP, t = (u - a[0]) / (b[0] - a[0]); rc[j] = Math.max(rc[j], a[1] + t * (b[1] - a[1])); }
      }
      let run = 0; for (let j = 0; j < nS; j++) { run = Math.max(run, rc[j]); cm[j] = run; }
    }
    const uHit = (level) => { for (let j = 0; j < nS; j++) if (cm[j] + fin > level) return Math.max(0, (j - 1) * STEP); return uEnd; };

    // --- header
    const stockLen = r3(m.L + 2 * (model.fa || 0));
    lines.push("%");
    lines.push(`O${String(4000 + (+op.opNo || 0)).slice(-4)} (${ascii(`OP${op.opNo} ${op.name}`)})`);
    C(`PART ${P.part_no || ""} ${P.part_name || ""}`);
    C(`FROM STAGE DRAWING - DIMENSIONS FROZEN REV ${(P.freeze && P.freeze.rev) || ""}`);
    C(`MATERIAL ${H.material || cd.name} - STOCK DIA ${r3(model.D0)} X ${stockLen}`);
    C("DRAFT PROGRAM - PROVE OUT ON THE MACHINE BEFORE PRODUCTION");
    const need = { face: uStock > 0.02 };

    N("G21 G40 G80 G99");
    N("G28 U0. W0.");
    N(`G50 S${Math.round(Math.min(4000, rpmAt(cd.vcR, 4 * 2)))}`);

    // --- T01 facing + OD roughing
    let tool = toolNo(1, "OD ROUGHING CNMG120408", "od", { H: 1.8, vc: cd.vcR });
    if (need.face || oc) {
      changeTool(tool, "OD ROUGHING CNMG120408");
      N(`G96 S${cd.vcR} M03`);
      N(`G00 X${fmt(dia0 + 3)} Z${fmt(uStock + 1)}`); N("M08");
      if (need.face) {
        C("FACE TO LENGTH");
        const nf = Math.max(1, Math.ceil((uStock - 0.2) / 1.0)), zs = [];
        for (let k = 1; k <= nf; k++) zs.push(r3(uStock - (k * (uStock - 0.2)) / nf));
        zs.push(0);
        zs.forEach((z, k) => { N(`G00 X${fmt(dia0 + 2)} Z${fmt(z + 0.0 + (k < zs.length - 1 ? 0 : 0))}`); N(`G01 X-1.6 F${k < zs.length - 1 ? "0.20" : "0.10"}`); N(`G00 Z${fmt(z + 1)}`); });
      }
      if (oc) {
        const rLow = (cm[0] || oc[0][1]) + fin, rTop = R0;
        if (rTop - rLow > 0.05) {
          C("OD ROUGH - LAYERS");
          const nl = Math.ceil((rTop - rLow) / ap), step = (rTop - rLow) / nl;
          for (let k = 1; k <= nl; k++) {
            const rk = r3(rTop - k * step), us = uHit(rk);
            if (us < 0.05) continue;
            N(`G00 X${fmt(2 * rk)} Z${fmt(1)}`); N(`G01 Z${fmt(-us)} F0.25`);
            N(`G01 X${fmt(2 * (rk + 0.5))} Z${fmt(-(us - 0.5))}`); N("G00 Z1.");
          }
        }
      }
      N("G28 U0. W0.");
    }

    // --- bores made at this operation: drill, rough and finish bore
    const bores = [];
    for (const v of S.voids) {
      if (!v.roles.some((r) => r === "this")) continue;
      let pts = v.pts.map((p) => [uOf(p[0]), p[1]]), roles = v.roles.slice(), edges = v.roles.map((_, i) => eOf(v.pts[i], v.pts[i + 1], "i"));
      if (Math.abs(pts[0][0]) > Math.abs(pts[pts.length - 1][0])) { pts.reverse(); roles.reverse(); edges.reverse(); }
      const tip = v.tip ? [uOf(v.tip[0]), 0] : null;
      const flats = []; for (let i = 0; i + 1 < pts.length; i++) if (Math.abs(pts[i][1] - pts[i + 1][1]) < 1e-6 && Math.abs(pts[i + 1][0] - pts[i][0]) > 0.25) flats.push({ u0: pts[i][0], u1: pts[i + 1][0], r: pts[i][1] });
      if (!flats.length) continue;
      const deep = flats.reduce((a, b) => (b.u1 > a.u1 ? b : a)), rMin = Math.min(...flats.map((f) => f.r));
      let dD = null; for (const c of mine) { const f = cx.M.get(+c.no); if (f && f.semi && f.kind === "dia" && f.side === "i") { const n = U.nomOf(c); if (n >= 2 && n < 2 * rMin - 0.1) dD = n; } }
      let only = false; if (dD == null) { if (flats.every((f) => Math.abs(f.r - flats[0].r) < 0.02)) { dD = r3(2 * flats[0].r); only = true; } else dD = Math.max(2, Math.floor((2 * rMin - 1.0) * 2) / 2); }
      bores.push({ pts, edges, tip, flats, deep, rMin, dD, only, rd: dD / 2 });
    }
    bores.forEach((b, bi) => {
      const rd = b.rd, depth = b.deep.u1, tipDepth = r3(depth + 0.3 * b.dD);
      C(`BORE ${bi + 1} - DRILL DIA ${fmt(b.dD)} DEPTH ${fmt(depth)}`);
      const dn = toolNo(3 + bi * 10, `DRILL DIA ${fmt(b.dD)}`, "drill", { rd, vc: cd.vcD });
      changeTool(dn, `DRILL DIA ${fmt(b.dD)} 118 DEG`);
      N(`G97 S${rpmAt(cd.vcD, b.dD)} M03`); N("G00 X0. Z2."); N("M08");
      N("G74 R0.5"); N(`G74 Z${fmt(-tipDepth)} Q${Math.round(Math.min(3, Math.max(1, b.dD * 0.4)) * 1000)} F${b.dD > 6 ? "0.15" : "0.10"}`);
      N("G00 Z2."); N("G28 U0. W0.");
      // boring bar: rough layers, then the finishing contour with the mouth chamfer and the bottom
      const bn = toolNo(4 + bi * 10, "BORING BAR S16 DCMT0702", "bore", { H: 1.6, vc: cd.vcF });
      const b2 = (u) => { let best = -1; for (let i = 0; i + 1 < b.pts.length; i++) { const p = b.pts[i], q = b.pts[i + 1]; if (u < Math.min(p[0], q[0]) - 1e-9 || u > Math.max(p[0], q[0]) + 1e-9) continue; if (Math.abs(q[0] - p[0]) < 1e-9) best = Math.max(best, p[1], q[1]); else best = Math.max(best, p[1] + ((q[1] - p[1]) * (u - p[0])) / (q[0] - p[0])); } return best; };
      const needBore = !b.only || b.pts.some((p, i) => i + 1 < b.pts.length && Math.abs(p[1] - b.pts[i + 1][1]) > 1e-6);
      if (needBore) {
        changeTool(bn, "BORING BAR S16 DCMT0702");
        N(`G96 S${cd.vcF} M03`); N(`G00 X${fmt(2 * Math.max(rd - 0.5, 0.3))} Z2.`);
        let gmax = 0; for (let u = 0; u <= depth + 1e-9; u += 0.05) gmax = Math.max(gmax, b2(u) - fin);
        if (gmax > rd + 0.05) {
          C("BORE ROUGH - LAYERS"); const nl = Math.ceil((gmax - rd) / 0.45), st = (gmax - rd) / nl;
          for (let k = 1; k <= nl; k++) {
            const lk = r3(rd + k * st); let us = depth; for (let u = 0; u <= depth + 1e-9; u += 0.05) if (b2(u) - fin < lk) { us = Math.max(0, u - 0.05); break; }
            if (us < 0.1) continue;
            N(`G00 X${fmt(2 * lk)} Z1.`); N(`G01 Z${fmt(-us)} F0.15`); N(`G00 X${fmt(2 * (lk - 0.4))}`); N("G00 Z1.");
          }
        }
        C("BORE FINISH - CONTOUR"); const full = b.pts.slice(); const ed = b.edges.slice(); if (b.tip) { full.push(b.tip); ed.push(null); }
        const it = items(full, ed, arcOf), p0 = full[0];
        N(`G00 X${fmt(2 * Math.max(p0[1] - 1, 0.3))} Z1.`); N(`G01 X${fmt(2 * p0[1])} Z0. F0.06`);
        it.forEach((q) => N(q.arc ? `G${q.arc.cw ? "02" : "03"} X${fmt(2 * q.to[1])} Z${fmt(-q.to[0])} R${fmt(q.arc.R)}` : `G01 X${fmt(2 * q.to[1])} Z${fmt(-q.to[0])}`));
        const q = full[full.length - 1]; if (q[1] > 0.3) N(`G01 X${fmt(2 * (q[1] - 0.5))}`); N("G00 Z1."); N("G28 U0. W0.");
      }
    });

    // --- T02 OD finishing (chamfers, radii, grooves, the whole outline) and the thread
    if (oc) {
      tool = toolNo(2, "OD FINISHING VNMG160404", "od", { H: 2.6, vc: cd.vcF });
      changeTool(tool, "OD FINISHING VNMG160404");
      N(`G96 S${cd.vcF} M03`);
      const first = oc[0]; N(`G00 X${fmt(2 * (first[1] + 1))} Z1.`); N(`G01 X${fmt(2 * first[1])} Z0. F0.08`);
      C("OD FINISH - CONTOUR");
      items(oc, ocEdges, arcOf).forEach((q) => N(q.arc ? `G${q.arc.cw ? "02" : "03"} X${fmt(2 * q.to[1])} Z${fmt(-q.to[0])} R${fmt(q.arc.R)} F0.08` : `G01 X${fmt(2 * q.to[1])} Z${fmt(-q.to[0])}`));
      N(`G00 X${fmt(2 * (rMaxOc + 1.5))}`); N("G28 U0. W0.");
      // external threads owned by this operation
      mine.filter((c) => c.type === "Thread").forEach((c, ti) => {
        const f = cx.M.get(+c.no); if (!f || !f.e || f.side !== "o") return;
        const pm = String(c.spec || c.text || "").match(/[×xX]\s*(\d+(?:\.\d+)?)/), pitch = pm ? parseFloat(pm[1]) : 1.5, rM = f.e.a[1], hh = r3(0.6134 * pitch);
        const ua = uOf(f.e.a[0]), ub = uOf(f.e.b[0]), u0 = Math.min(ua, ub), u1 = Math.max(ua, ub);
        const tn = toolNo(5, `THREAD TOOL 60 DEG P${fmt(pitch)}`, "thread", { pitch, vc: cd.vcT });
        C(`THREAD ${ascii(c.spec || c.text)} PITCH ${fmt(pitch)}`);
        changeTool(tn, `THREAD TOOL 60 DEG P${fmt(pitch)}`);
        N(`G97 S${rpmAt(cd.vcT, 2 * rM)} M03`); N(`G00 X${fmt(2 * (rM + 2))} Z${fmt(-(u0 - 3 * pitch))}`);
        N("G76 P011060 Q100 R0.05"); N(`G76 X${fmt(2 * (rM - hh))} Z${fmt(-u1)} P${Math.round(hh * 1000)} Q300 F${fmt(pitch)}`);
        N(`G00 X${fmt(2 * (rM + 3))}`); N("G28 U0. W0.");
      });
    }
    N("M05"); N("M09"); N("M30"); lines.push("%");
    return { name: `O${String(4000 + (+op.opNo || 0)).slice(-4)}`, op, lines, tools, d, xw, uOf, xOf, S0, S, jaws, cd, mine, rank };
  };
  void 0;

  /* ================================================================ reading the program text back into moves ================================================================ */
  /** every block: motion in machine coordinates [Z, X(dia)], with the tool, spindle and feed that apply */
  CN.interp = (lines, tools) => {
    const mv = []; let pos = [3, 40], tool = 0, g96 = false, vc = 0, maxS = 4000, rpm = 0, fr = 0.2, f99 = true, mode = "G00", cool = false, spin = false, peck = null, thr = null;
    const words = (t) => { const o = []; String(t).replace(/\([^)]*\)/g, "").replace(/([A-Z])\s*(-?\d*\.?\d*)/g, (a, k, v) => { o.push([k, v === "" ? NaN : parseFloat(v)]); return ""; }); return o; };
    const rpmFor = (X) => (g96 ? Math.min(maxS, Math.round((vc * 1000) / (Math.PI * Math.max(Math.abs(X), 4)))) : rpm);
    const fmmin = (X) => (f99 ? fr * Math.max(rpmFor(X), 1) : fr);
    const push = (o) => mv.push(Object.assign({ tool, rpm: rpmFor(o.to ? o.to[1] : pos[1]), spin }, o));
    lines.forEach((ln, li) => {
      if (/^\s*%?\s*$/.test(ln) || /^\s*\(/.test(ln)) return;
      const W = words(ln); if (!W.length) return;
      const g = [], v = {}; let tNew = null, mcodes = [];
      for (const [k, x] of W) { if (k === "N" || k === "O") continue; if (k === "G") g.push(x); else if (k === "M") mcodes.push(x); else if (k === "T") tNew = x; else v[k] = x; }
      if (g.includes(98)) f99 = false; if (g.includes(99)) f99 = true;
      if (g.includes(50) && v.S != null) maxS = v.S;
      if (g.includes(96)) { g96 = true; if (v.S != null) vc = v.S; } else if (g.includes(97)) { g96 = false; if (v.S != null) rpm = v.S; } else if (v.S != null && !g.includes(50)) { if (g96) vc = v.S; else rpm = v.S; }
      if (v.F != null) fr = v.F;
      for (const mc of mcodes) { if (mc === 3 || mc === 4) spin = true; if (mc === 5) spin = false; if (mc === 8) cool = true; if (mc === 9) cool = false; }
      if (tNew != null) { tool = Math.floor(tNew / 100); push({ li, type: "tool", dur: 4, tool }); return; }
      if (g.includes(28)) { push({ li, type: "home", dur: 2, from: pos.slice(), to: [3, 40] }); pos = [3, 40]; return; }
      if (g.includes(74)) {
        if (v.R != null && v.Z == null) { peck = { r: v.R }; return; }
        const z1 = v.Z, q = (v.Q != null ? v.Q : 2000) / 1000, z0 = pos[0], X = v.X != null ? v.X : pos[1], fm = fmmin(0);
        let z = z0; const dir = z1 < z0 ? -1 : 1, rr = peck ? peck.r : 0.5;
        for (let guard = 0; guard < 400; guard++) {
          const zn = dir < 0 ? Math.max(z1, z - q) : Math.min(z1, z + q);
          push({ li, type: "feed", from: [z, X], to: [zn, X], f: fm, drill: true });
          if (Math.abs(zn - z1) < 1e-9) { push({ li, type: "rapid", from: [zn, X], to: [z0, X] }); break; }
          const zb = dir < 0 ? zn + rr : zn - rr; push({ li, type: "rapid", from: [zn, X], to: [zb, X] }); z = zb;
        }
        pos = [z0, X]; peck = null; return;
      }
      if (g.includes(76)) {
        if (v.P != null && v.X == null) { thr = { p: v.P, q: v.Q, r: v.R }; return; }
        const depth = (v.P || 920) / 1000, xRoot = v.X, z1 = v.Z, pitch = v.F, passes = Math.max(4, Math.round(Math.sqrt(depth / 0.12) * 3)), xStart = pos[1], z0 = pos[0];
        for (let k = 1; k <= passes; k++) {
          const dk = depth * Math.sqrt(k / passes), major = xRoot + 2 * depth, Xm = major - 2 * dk;   // tip diameter of this pass
          push({ li, type: "rapid", from: [z0, xStart], to: [z0, Xm] });
          push({ li, type: "thread", from: [z0, Xm], to: [z1, Xm], f: pitch * Math.max(rpmFor(Xm), 1), pitch, depth: dk, major, last: k === passes });
          push({ li, type: "rapid", from: [z1, Xm], to: [z1, xStart] }); push({ li, type: "rapid", from: [z1, xStart], to: [z0, xStart] });
        }
        pos = [z0, xStart]; thr = null; return;
      }
      const mot = g.find((q) => q === 0 || q === 1 || q === 2 || q === 3); if (mot != null) mode = "G0" + mot;
      if (v.X == null && v.Z == null) return;
      const to = [v.Z != null ? v.Z : pos[0], v.X != null ? v.X : pos[1]];
      if (mode === "G00") push({ li, type: "rapid", from: pos.slice(), to });
      else if (mode === "G01") push({ li, type: "feed", from: pos.slice(), to, f: fmmin(to[1]) });
      else push({ li, type: "feed", from: pos.slice(), to, f: fmmin(to[1]), arc: { R: v.R, cw: mode === "G02" } });
      pos = to;
    });
    return mv;
  };
  /** arc centre in (Z, X(radius)) from start, end, radius and direction (standard lathe plane: Z right, X up) */
  const arcCentre = (a, b, R, cw) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], q = Math.hypot(dx, dy) || 1, h2 = R * R - (q / 2) * (q / 2), h = h2 > 0 ? Math.sqrt(h2) : 0, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = -dy / q, ny = dx / q, sg = cw ? -1 : 1;
    return [mx + nx * h * sg, my + ny * h * sg];
  };
  CN.arcCentre = arcCentre;

  /* ================================================================ the simulation: material removal on a fine grid ================================================================ */
  const fillLoops = (loops, W, Hc, xlo, cs, out) => {
    const edges = []; for (const lp of loops) for (let i = 0; i < lp.length; i++) { const a = lp[i], b = lp[(i + 1) % lp.length]; if (Math.abs(a[1] - b[1]) > 1e-12) edges.push(a[1] < b[1] ? [a[0], a[1], b[0], b[1]] : [b[0], b[1], a[0], a[1]]); }
    for (let j = 0; j < Hc; j++) {
      const y = (j + 0.5) * cs, xs = [];
      for (const e of edges) if (y >= e[1] && y < e[3]) xs.push(e[0] + ((y - e[1]) * (e[2] - e[0])) / (e[3] - e[1]));
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) { const i0 = Math.max(0, Math.ceil((xs[k] - xlo) / cs - 0.5)), i1 = Math.min(W - 1, Math.floor((xs[k + 1] - xlo) / cs - 0.5)); for (let i = i0; i <= i1; i++) out[j * W + i] = 1; }
    }
  };
  const mmss = (s) => { s = Math.max(0, Math.round(s)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

  class Sim {
    constructor(g, cx) {
      this.g = g; this.cx = cx; this.mv = CN.interp(g.lines, g.tools); const S0 = g.S0, S = g.S, jw = g.jaws;
      let xlo = Math.min(S0.xl, S.xl, ...jw.poly.map((p) => p[0])) - 2, xhi = Math.max(S0.xr, S.xr, ...jw.poly.map((p) => p[0])) + 2;
      this.Rm = Math.max(S0.R0, S.rmax, jw.top || 0) + 0.4; this.xlo = xlo; this.xhi = xhi; this.cs = Math.max(0.02, (xhi - xlo) / 1500);
      this.W = Math.ceil((xhi - xlo) / this.cs); this.Hc = Math.ceil(this.Rm / this.cs);
      this.sf = -g.d;   // display direction of the free end (the side the tool comes from)
      this.tgt = new Uint8Array(this.W * this.Hc); fillLoops(S.loops, this.W, this.Hc, xlo, this.cs, this.tgt);
      this.ctx = null; this.reset();
      // time of every move
      let t = 0; for (const m of this.mv) {
        m.len = this.lenOf(m); m.t0 = t;
        m.dur = m.type === "tool" ? 4 : m.type === "home" ? 2 : m.type === "rapid" ? Math.max(0.15, m.len / 250) : Math.max(0.05, m.len / Math.max(m.f / 60, 1));
        t += m.dur;
      }
      this.total = t;
    }
    lenOf(m) {
      if (m.type === "tool" || m.type === "home") return 0;
      const dx = m.to[0] - m.from[0], dy = (m.to[1] - m.from[1]) / 2;
      if (m.arc && m.arc.R) {
        const a = [m.from[0], m.from[1] / 2], b = [m.to[0], m.to[1] / 2], c = arcCentre(a, b, m.arc.R, m.arc.cw), t0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
        let dt = Math.atan2(b[1] - c[1], b[0] - c[0]) - t0; if (m.arc.cw) { while (dt > 1e-9) dt -= 2 * Math.PI; } else { while (dt < -1e-9) dt += 2 * Math.PI; }
        m.arc.c = c; m.arc.t0 = t0; m.arc.dt = dt; return Math.abs(dt) * m.arc.R;
      }
      return Math.hypot(dx, dy);
    }
    posAt(m, s) {
      if (m.arc && m.arc.c) { const th = m.arc.t0 + m.arc.dt * (m.len ? s / m.len : 1); return [m.arc.c[0] + m.arc.R * Math.cos(th), 2 * (m.arc.c[1] + m.arc.R * Math.sin(th))]; }
      const f = m.len ? s / m.len : 1; return [m.from[0] + (m.to[0] - m.from[0]) * f, m.from[1] + (m.to[1] - m.from[1]) * f];
    }
    reset() {
      const { W, Hc, g } = this; this.mat = new Uint8Array(W * Hc); fillLoops(g.S0.loops, W, Hc, this.xlo, this.cs, this.mat);
      this.i = 0; this.s = 0; this.t = 0; this.li = -1; this.done = false; this.trail = []; this.chips = []; this.pos = [3, 40]; this.tool = 0; this.rpm = 0; this.feed = 0; this.phase = ""; this.stats = null; this.removed = 0; this.vol = 0;
      this.img = null; this.dirty = true; this.lastM = null;
    }
    xr(Z, X) { return [this.g.xw - this.g.d * Z, X / 2]; }
    cut(ix, j, force) { if (ix < 0 || ix >= this.W || j < 0 || j >= this.Hc) return 0; const k = j * this.W + ix; if (!this.mat[k]) return 0; if (!force && this.tgt[k]) return 0; this.mat[k] = 0; this.dirty = true; this.vol += 2 * Math.PI * (j + 0.5) * this.cs * this.cs * this.cs; return 1; }
    carve(m, Z, X) {
      const [x, r] = this.xr(Z, X), cs = this.cs, tl = this.g.tools[m.tool], ix = Math.floor((x - this.xlo) / cs); let n = 0;
      if (!tl) return;
      if (tl.kind === "od") {
        const H = tl.H || 2, j0 = Math.ceil(r / cs - 0.5), j1 = Math.min(this.Hc - 1, Math.floor((r + H) / cs)); for (let j = j0; j <= j1; j++) n += this.cut(ix, j);
        const jr = Math.floor(r / cs), nb = Math.round(1.2 / cs); for (let k = 0; k <= nb; k++) n += this.cut(ix + this.sf * k, jr);
      } else if (tl.kind === "bore") {
        const H = tl.H || 1.6, j1 = Math.floor(r / cs - 0.5), j0 = Math.max(0, j1 - Math.round(H / cs)); for (let j = j0; j <= j1; j++) n += this.cut(ix, j);
        const jr = Math.max(0, Math.floor(r / cs - 0.5)), nb = Math.round(1.2 / cs); for (let k = 0; k <= nb; k++) n += this.cut(ix + this.sf * k, jr);
      } else if (tl.kind === "drill") {
        const rd = tl.rd, T = 0.6 * rd + 1.2, nt = Math.round(T / cs);
        for (let k = 0; k <= nt; k++) { const t = k * cs, ar = rd * Math.min(1, t / (0.6 * rd)), jm = Math.floor(ar / cs - 0.5); for (let j = 0; j <= jm; j++) n += this.cut(ix + this.sf * k, j); }
      } else if (tl.kind === "thread" && m.type === "thread") {
        const P = m.pitch, u = -Z, ua = -m.from[0], ph = ((u - ua) % P + P) % P;
        if (ph < cs * 1.1 || P - ph < cs * 1.1) {
          const rT = r, hmax = 2.2, tan = Math.tan(Math.PI / 6), nx = Math.ceil(hmax * tan / cs);
          for (let a = -nx; a <= nx; a++) for (let j = Math.ceil(rT / cs - 0.5); j <= Math.floor((rT + hmax) / cs); j++) { const rc = (j + 0.5) * cs; if (Math.abs(a) * cs <= (rc - rT) * tan) n += this.cut(ix + a, j, true); }
        }
      }
      if (n) { this.removed += n; if (this.chips.length < 160 && Math.random() < 0.7) for (let q = 0; q < 2; q++) this.chips.push({ x, r, vx: (Math.random() - 0.3) * 6 * this.sf, vr: 2 + Math.random() * 6, life: 1 }); }
    }
    /** advance the simulated machine time by dt seconds */
    advance(dt) {
      if (this.done) return; this.t += dt; const cs = this.cs;
      while (this.i < this.mv.length) {
        const m = this.mv[this.i], p = Math.min(1, (this.t - m.t0) / m.dur), tgt = m.len * p;
        this.li = m.li; this.tool = m.tool; this.rpm = m.rpm; this.feed = m.f || 0; this.lastM = m;
        const prev = this.lines && this.lines[m.li]; void prev;
        if (m.type === "tool" || m.type === "home") { this.pos = m.type === "home" ? m.to.slice() : this.pos; }
        else if (m.type === "rapid") { this.pos = this.posAt(m, tgt); }
        else {
          const ds = cs * 0.8; let s = this.s; if (s > tgt) s = 0;
          while (s < tgt) { s = Math.min(tgt, s + ds); const q = this.posAt(m, s); this.carve(m, q[0], q[1]); this.pos = q; if (!this.trail.length || Math.hypot(q[0] - this.trail[this.trail.length - 1][0], q[1] - this.trail[this.trail.length - 1][1]) > 0.35) this.trail.push([q[0], q[1], m.type === "feed" ? 1 : 0]); }
          this.s = s;
        }
        if (p >= 1) { this.i++; this.s = 0; if (m.type !== "rapid" && m.type !== "tool" && m.type !== "home") this.pos = m.to.slice(); } else break;
      }
      if (this.i >= this.mv.length) { this.done = true; this.t = this.total; this.finish(); }
    }
    /** after the last block: what is left above the finished outline, and the checked diameters */
    finish() {
      const { W, Hc, cs, mat, tgt } = this; let resid = 0, maxCol = 0; const colRes = new Float32Array(W);
      for (let j = 0; j < Hc; j++) for (let i = 0; i < W; i++) { const k = j * W + i; if (mat[k] && !tgt[k]) { resid++; colRes[i] += cs; } }
      for (let i = 0; i < W; i++) maxCol = Math.max(maxCol, colRes[i]);
      const U = SPk().util, checks = [];
      for (const c of this.g.mine) {
        const f = this.cx.M.get(+c.no); if (!f || f.kind !== "dia" || f.semi || !f.e || c.type === "Thread") continue;
        const xm = (f.e.a[0] + f.e.b[0]) / 2, ix = Math.floor((xm - this.xlo) / cs); let top = 0; for (let j = 0; j < Hc; j++) if (mat[j * W + ix]) top = j + 1; else if (f.side === "i" && top) break;
        let rr = 0; if (f.side === "o") { rr = top * cs; } else { let jb = 0; while (jb < Hc && !mat[jb * W + ix]) jb++; rr = jb * cs; }
        const spec = (c.spec || c.text || "").toString(), nom = U.nomOf(c), err = Math.abs(2 * rr - nom), lsl = c.lsl != null && c.lsl !== "" ? +c.lsl : null, usl = c.usl != null && c.usl !== "" ? +c.usl : null;
        checks.push({ no: c.no, spec, dia: 2 * rr, ok: err <= 4 * cs + 1e-6 && (lsl == null || 2 * rr >= lsl - 2 * cs) && (usl == null || 2 * rr <= usl + 2 * cs) });
      }
      this.stats = { resid, maxRes: maxCol, checks, time: this.total, lines: this.g.lines.filter((l) => /^N\d+/.test(l)).length };
      this.dirty = true;
    }
  }
  CN.Sim = Sim;
  void 0;

  /* ================================================================ drawing the simulation frame (one canvas, so the recorded video has everything) ================================================================ */
  const CW = 1280, CH = 720, PANEL = 470, HEADH = 46, FOOT = 64;
  Sim.prototype.layout = function () {
    const vw = CW - PANEL - 24, vh = CH - HEADH - FOOT - 16, wx = this.xhi - this.xlo, k = Math.min(vw / wx, vh / (2 * this.Rm + 2));
    this.k = k; this.ox = 12 + (vw - wx * k) / 2 - this.xlo * k; this.cy = HEADH + 8 + vh / 2;
  };
  Sim.prototype.sx = function (x) { return this.ox + x * this.k; };
  Sim.prototype.sy = function (r) { return this.cy - r * this.k; };
  Sim.prototype.paintGrid = function () {
    if (!this.off) { this.off = document.createElement("canvas"); this.off.width = this.W; this.off.height = this.Hc; this.octx = this.off.getContext("2d"); this.img = this.octx.createImageData(this.W, this.Hc); }
    if (!this.dirty) return; const { W, Hc, mat, tgt, img } = this, d = img.data, res = this.done;
    for (let j = 0; j < Hc; j++) {
      const row = Hc - 1 - j, sh = 0.80 + 0.2 * (j / Hc);
      for (let i = 0; i < W; i++) {
        const k = j * W + i, o = (row * W + i) * 4;
        if (!mat[k]) { d[o + 3] = 0; continue; }
        if (res && !tgt[k]) { d[o] = 245; d[o + 1] = 158; d[o + 2] = 11; d[o + 3] = 255; } else { d[o] = 150 * sh + 30; d[o + 1] = 165 * sh + 30; d[o + 2] = 185 * sh + 30; d[o + 3] = 255; }
      }
    }
    this.octx.putImageData(img, 0, 0); this.dirty = false;
  };
  const toolShape = (kind, sf) => {
    // polygons relative to the tip, in mm; x towards the free end (sf), r up
    if (kind === "od") return [[[0, 0], [1.1 * sf, 0.15], [4.2 * sf, 3.4], [3.4 * sf, 4.6], [0.3 * sf, 1.2]], [[1.6 * sf, 2.3], [14 * sf, 2.3], [14 * sf, 8.5], [3.0 * sf, 8.5]]];
    if (kind === "thread") return [[[0, 0], [0.9 * sf, 1.3], [-0.2 * sf, 1.6], [-0.9 * sf, 1.3]], [[0, 1.4], [10 * sf, 1.4], [10 * sf, 7.5], [-0.9 * sf, 7.5]]];
    if (kind === "bore") return [[[0, 0], [1.0 * sf, -0.2], [4.0 * sf, -2.8], [3.4 * sf, -3.8], [0.2 * sf, -1.0]], [[2.0 * sf, -2.4], [34 * sf, -2.4], [34 * sf, -7.4], [3.4 * sf, -7.4]]];
    return [];
  };
  Sim.prototype.draw = function (c, ui) {
    this.layout(); const k = this.k, W = CW, H = CH;
    c.fillStyle = "#0b1220"; c.fillRect(0, 0, W, H);
    // header
    c.fillStyle = "#111c33"; c.fillRect(0, 0, W, HEADH); c.fillStyle = "#e2e8f0"; c.font = "600 17px system-ui, Segoe UI, Arial"; c.textBaseline = "middle";
    const op = this.g.op; c.fillText(`CNC SIMULATION · OP ${op.opNo} · ${String(op.name || "").toUpperCase()}`, 14, HEADH / 2);
    c.font = "13px ui-monospace, Menlo, Consolas, monospace"; c.fillStyle = "#94a3b8"; c.textAlign = "right"; c.fillText(`${this.cx.P.part_no || ""} · program ${this.g.name}`, W - 14, HEADH / 2); c.textAlign = "left";
    // view
    this.paintGrid();
    c.save(); c.beginPath(); c.rect(0, HEADH, CW - PANEL, CH - HEADH - FOOT); c.clip();
    c.strokeStyle = "#475569"; c.setLineDash([14, 4, 3, 4]); c.lineWidth = 1; c.beginPath(); c.moveTo(8, this.cy); c.lineTo(CW - PANEL - 8, this.cy); c.stroke(); c.setLineDash([]);
    c.imageSmoothingEnabled = true; const dx = this.sx(this.xlo), dw = (this.xhi - this.xlo) * k, dh = this.Hc * this.cs * k;
    c.drawImage(this.off, dx, this.cy - dh, dw, dh); c.save(); c.translate(0, this.cy * 2); c.scale(1, -1); c.drawImage(this.off, dx, this.cy - dh, dw, dh); c.restore();
    // the finished outline (what the program has to make)
    c.strokeStyle = "rgba(125,211,252,.85)"; c.lineWidth = 1; c.setLineDash([5, 4]);
    for (const sg of [1, -1]) {
      c.beginPath(); this.g.S.pts.forEach((p, i) => { const X = this.sx(p[0]), Y = this.cy - sg * p[1] * k; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.stroke();
      for (const v of this.g.S.voids) { c.beginPath(); const pp = v.tip ? v.pts.concat([v.tip]) : v.pts; pp.forEach((p, i) => { const X = this.sx(p[0]), Y = this.cy - sg * p[1] * k; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.stroke(); }
    }
    c.setLineDash([]);
    // chuck / soft jaws
    for (const sg of [1, -1]) { c.beginPath(); this.g.jaws.poly.forEach((p, i) => { const X = this.sx(p[0]), Y = this.cy - sg * p[1] * k; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.closePath(); c.fillStyle = "rgba(14,116,180,.55)"; c.fill(); c.strokeStyle = "#38bdf8"; c.lineWidth = 1.5; c.stroke(); }
    // tool path trail
    c.lineWidth = 1; c.strokeStyle = "rgba(34,197,94,.75)"; c.beginPath(); let pen = false;
    for (const q of this.trail) { const [x, r] = this.xr(q[0], q[1]), X = this.sx(x), Y = this.cy - r * k; if (q[2] && pen) c.lineTo(X, Y); else c.moveTo(X, Y); pen = !!q[2]; } c.stroke();
    // tool
    const tl = this.g.tools[this.tool];
    if (tl && this.i < this.mv.length + 1 && this.lastM && this.lastM.type !== "tool" && this.lastM.type !== "home") {
      const [x, r] = this.xr(this.pos[0], this.pos[1]), X = this.sx(x), Y = this.cy - r * k;
      if (tl.kind === "drill") {
        const rd = tl.rd, L = 60, sf = this.sf, cy = this.cy; c.fillStyle = "#e5e7eb"; c.strokeStyle = "#111827"; c.lineWidth = 1;
        c.beginPath(); c.moveTo(X, cy); c.lineTo(X + sf * 0.6 * rd * k, cy - rd * k); c.lineTo(X + sf * L * k, cy - rd * k); c.lineTo(X + sf * L * k, cy + rd * k); c.lineTo(X + sf * 0.6 * rd * k, cy + rd * k); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = "#94a3b8"; c.beginPath(); for (let q = 0; q < 8; q++) { const xx = X + sf * (0.6 * rd + 1.5 + q * 3) * k; c.moveTo(xx, cy - rd * k); c.lineTo(xx + sf * 2 * k, cy + rd * k); } c.stroke();
      } else for (const poly of toolShape(tl.kind, this.sf)) {
        c.beginPath(); poly.forEach((p, i) => { const px = X + p[0] * k, py = Y - p[1] * k; i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.closePath(); c.fillStyle = poly.length === 5 || poly.length === 4 ? "#fbbf24" : "#cbd5e1"; c.fill(); c.strokeStyle = "#0f172a"; c.lineWidth = 1; c.stroke();
      }
      if (this.lastM.type === "feed" || this.lastM.type === "thread") { c.fillStyle = "rgba(251,191,36,.9)"; c.beginPath(); c.arc(X, Y, 3, 0, 7); c.fill(); }
    }
    // chips
    for (const q of this.chips) { q.x += q.vx * 0.016; q.r += q.vr * 0.016; q.vr -= 22 * 0.016; q.life -= 0.035; c.fillStyle = `rgba(251,${146 + Math.round(60 * q.life)},60,${Math.max(0, q.life)})`; c.fillRect(this.sx(q.x), this.cy - q.r * k, 2.2, 2.2); }
    this.chips = this.chips.filter((q) => q.life > 0);
    c.restore();
    // read-outs (top-left of the view)
    const m = this.lastM, Z = this.pos[0], X = this.pos[1], t = this.tool && this.g.tools[this.tool];
    c.font = "14px ui-monospace, Menlo, Consolas, monospace"; c.fillStyle = "#cbd5e1"; c.textBaseline = "alphabetic";
    const rd = [["X (dia)", X.toFixed(3)], ["Z", Z.toFixed(3)], ["Spindle", (this.rpm || 0) + " rpm"], ["Feed", m && m.f ? (m.type === "rapid" ? "rapid" : (m.f / Math.max(this.rpm, 1)).toFixed(2) + " mm/rev") : "—"], ["Tool", t ? `T${String(this.tool).padStart(2, "0")} ${t.name}` : "—"]];
    rd.forEach((q, i) => { c.fillStyle = "#64748b"; c.fillText(q[0], 18, HEADH + 26 + i * 19); c.fillStyle = "#e2e8f0"; c.fillText(q[1], 96, HEADH + 26 + i * 19); });
    // phase (last comment above the current line)
    let ph = ""; for (let q = Math.max(0, this.li); q >= 0; q--) { const ln = this.g.lines[q]; if (/^\(/.test(ln) && !/^\(T\d/.test(ln)) { ph = ln.slice(1, -1); break; } }
    if (ph) { c.fillStyle = "#38bdf8"; c.font = "600 15px system-ui, Segoe UI, Arial"; c.fillText(ph, 18, HEADH + 26 + 5 * 19 + 10); }
    c.font = "12px system-ui, Segoe UI, Arial"; c.fillStyle = "#94a3b8";
    const lg = [["rgba(125,211,252,.9)", "required shape (finished outline)"], ["#38bdf8", "chuck / soft jaws"], ["#22c55e", "tool path"], ["#f59e0b", "stock left uncut"]];
    lg.forEach((q, i) => { const yy = CH - FOOT - 18 - (lg.length - 1 - i) * 17; c.fillStyle = q[0]; c.fillRect(18, yy - 8, 18, 3); c.fillStyle = "#94a3b8"; c.fillText(q[1], 44, yy - 2); });
    // program panel
    const px = CW - PANEL; c.fillStyle = "#0f172a"; c.fillRect(px, HEADH, PANEL, CH - HEADH); c.fillStyle = "#1e293b"; c.fillRect(px, HEADH, 2, CH - HEADH);
    c.fillStyle = "#94a3b8"; c.font = "600 12px system-ui, Segoe UI, Arial"; c.fillText(`CNC PROGRAM ${this.g.name}  (Fanuc style, X = diameter)`, px + 14, HEADH + 20);
    const LH = 17, rows = Math.floor((CH - HEADH - FOOT - 34) / LH), n = this.g.lines.length, cur = Math.max(0, this.li), first = Math.max(0, Math.min(n - rows, cur - 11));
    c.font = "13px ui-monospace, Menlo, Consolas, monospace";
    for (let q = 0; q < rows && first + q < n; q++) {
      const li = first + q, y = HEADH + 40 + q * LH, ln = this.g.lines[li];
      if (li === this.li && !this.done) { c.fillStyle = "#1d4ed8"; c.fillRect(px + 6, y - 13, PANEL - 12, LH); }
      c.fillStyle = li === this.li && !this.done ? "#ffffff" : /^\(/.test(ln) ? "#4ade80" : li < this.li ? "#64748b" : "#e2e8f0";
      c.fillText(ln.length > 50 ? ln.slice(0, 49) + "…" : ln, px + 14, y);
    }
    // footer: progress and time
    const fy = CH - FOOT; c.fillStyle = "#111c33"; c.fillRect(0, fy, CW - PANEL, FOOT);
    const pr = this.total ? Math.min(1, this.t / this.total) : 0; c.fillStyle = "#1e293b"; c.fillRect(14, fy + 14, CW - PANEL - 28, 8); c.fillStyle = "#22c55e"; c.fillRect(14, fy + 14, (CW - PANEL - 28) * pr, 8);
    c.font = "13px ui-monospace, Menlo, Consolas, monospace"; c.fillStyle = "#e2e8f0"; c.fillText(`Machine time ${mmss(this.t)} / ${mmss(this.total)}`, 14, fy + 44);
    c.textAlign = "right"; c.fillStyle = "#94a3b8"; c.fillText(`${this.removedMm3().toFixed(0)} mm³ of chips`, CW - PANEL - 14, fy + 44); c.textAlign = "left";
    if (ui && ui.msg) { c.fillStyle = "#fbbf24"; c.textAlign = "center"; c.fillText(ui.msg, (CW - PANEL) / 2, fy + 44); c.textAlign = "left"; }
    // result card at the end
    if (this.done && this.stats) {
      const st = this.stats, ok = st.maxRes < 3 * this.cs + 0.05, w = 430, h = 78 + Math.min(5, st.checks.length) * 18, x0 = 24, y0 = HEADH + 150;
      c.fillStyle = "rgba(2,6,23,.92)"; c.fillRect(x0, y0, w, h); c.strokeStyle = ok ? "#22c55e" : "#f59e0b"; c.lineWidth = 2; c.strokeRect(x0, y0, w, h);
      c.fillStyle = ok ? "#4ade80" : "#fbbf24"; c.font = "600 15px system-ui, Segoe UI, Arial"; c.fillText(ok ? "Machining complete — required shape reached" : "Machining complete — some stock is left", x0 + 14, y0 + 24);
      c.font = "13px ui-monospace, Menlo, Consolas, monospace"; c.fillStyle = "#e2e8f0"; c.fillText(`Stock left above the finished outline: max ${st.maxRes.toFixed(2)} mm`, x0 + 14, y0 + 46);
      c.fillText(`Cycle time ${mmss(st.time)} · ${st.lines} program blocks`, x0 + 14, y0 + 64);
      st.checks.slice(0, 5).forEach((q, i) => { c.fillStyle = q.ok ? "#4ade80" : "#fbbf24"; c.fillText(`${q.ok ? "✓" : "!"} #${q.no} ${q.spec.slice(0, 22)} → Ø${q.dia.toFixed(2)}`, x0 + 14, y0 + 84 + i * 18); });
    }
  };
  Sim.prototype.removedMm3 = function () { return this.vol || 0; };
  void 0;

  /* ================================================================ the screen: player, program download, video recording ================================================================ */
  const download = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); };
  const safe = (s) => String(s || "part").replace(/[^A-Za-z0-9._-]+/g, "_");

  CN.player = (cx, ranks, onClose) => {
    const ov = document.createElement("div"); ov.id = "cncOv";
    ov.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.95);display:flex;flex-direction:column;align-items:center;padding:10px 12px;gap:8px;font:14px system-ui,Segoe UI,Arial;color:#e2e8f0";
    const btn = "background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:7px 13px;cursor:pointer;font:600 13px system-ui,Segoe UI,Arial";
    ov.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;max-width:1280px">
      <select id="cnOp" style="${btn}"></select>
      <button id="cnPlay" style="${btn};background:#15803d;border-color:#16a34a">▶ Play</button><button id="cnRe" style="${btn}">⟲ Restart</button>
      <select id="cnSp" style="${btn}"><option value="120">Slow (about 2 min)</option><option value="60" selected>Normal (about 1 min)</option><option value="30">Fast (about 30 s)</option><option value="15">Very fast (about 15 s)</option></select>
      <button id="cnRec" style="${btn};background:#b91c1c;border-color:#dc2626">⏺ Record video</button><button id="cnNc" style="${btn}">⬇ Program (.nc)</button><button id="cnX" style="${btn}">✕ Close</button></div>
      <canvas id="cnCv" width="${CW}" height="${CH}" style="width:min(100%,calc((100vh - 96px) * 16 / 9));height:auto;border-radius:10px;border:1px solid #1e293b;background:#0b1220"></canvas>
      <div id="cnNote" style="color:#94a3b8;font-size:12px;max-width:1280px;text-align:center">Draft program made from the stage drawing. The program on the right is the one that is simulated. Check feeds, speeds, tools and tool-nose compensation on your machine before production.</div>`;
    document.body.appendChild(ov);
    const $ = (id) => ov.querySelector("#" + id), cv = $("cnCv"), c = cv.getContext("2d"); let sim = null, g = null, playing = false, last = 0, raf = 0, rec = null, doneAt = 0, ui = {};
    ranks.forEach((r) => { const o = document.createElement("option"); o.value = r.rank; o.textContent = `OP ${r.op.opNo} · ${r.op.name}`; $("cnOp").appendChild(o); });
    const load = (rank) => { g = CN.gen(cx, rank); sim = new Sim(g, cx); playing = false; $("cnPlay").textContent = "▶ Play"; doneAt = 0; ui = {}; };
    const speed = () => Math.max(1, sim.total / (+$("cnSp").value || 60));
    const frame = (ts) => {
      raf = requestAnimationFrame(frame); const dt = Math.min(0.1, (ts - last) / 1000 || 0); last = ts;
      if (playing && sim && !sim.done) sim.advance(dt * speed());
      if (sim && sim.done && playing) { playing = false; $("cnPlay").textContent = "▶ Play again"; doneAt = ts; }
      if (rec && sim && sim.done && ts - doneAt > 2800) { rec.stop(); }
      if (sim) sim.draw(c, ui);
    };
    $("cnOp").onchange = () => { if (rec) return; load(+$("cnOp").value); };
    $("cnPlay").onclick = () => { if (!sim) return; if (sim.done) { sim.reset(); } playing = !playing; $("cnPlay").textContent = playing ? "⏸ Pause" : "▶ Play"; };
    $("cnRe").onclick = () => { if (rec) return; sim.reset(); playing = false; $("cnPlay").textContent = "▶ Play"; };
    $("cnNc").onclick = () => download(new Blob([g.lines.join("\r\n") + "\r\n"], { type: "text/plain" }), `${g.name}_${safe(cx.P.part_no)}.nc`);
    $("cnRec").onclick = () => {
      if (rec) return; if (!cv.captureStream || !window.MediaRecorder) { $("cnNote").textContent = "This browser cannot record video. Use Chrome or Edge."; return; }
      const types = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"], mt = types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
      const ext = /mp4/.test(mt) ? "mp4" : "webm", chunks = [];
      sim.reset(); playing = true; $("cnPlay").textContent = "⏸ Pause"; $("cnRec").textContent = "⏺ Recording…"; ui.msg = "● REC";
      try { rec = new MediaRecorder(cv.captureStream(30), mt ? { mimeType: mt, videoBitsPerSecond: 6000000 } : {}); } catch (e) { rec = null; $("cnNote").textContent = "Video recording is not available here: " + e.message; return; }
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => { const name = `${safe(cx.P.part_no)}_OP${g.op.opNo}_CNC-simulation.${ext}`; download(new Blob(chunks, { type: mt || "video/webm" }), name); rec = null; ui.msg = ""; $("cnRec").textContent = "⏺ Record video"; $("cnNote").textContent = `Video saved: ${name}`; };
      rec.start(250);
    };
    $("cnX").onclick = () => { if (rec) { try { rec.stop(); } catch (e) { /* ignore */ } } cancelAnimationFrame(raf); ov.remove(); document.removeEventListener("keydown", key); if (onClose) onClose(); };
    const key = (e) => { if (e.key === "Escape") $("cnX").onclick(); if (e.key === " ") { e.preventDefault(); $("cnPlay").onclick(); } };
    document.addEventListener("keydown", key);
    load(ranks[0].rank); raf = requestAnimationFrame(frame);
    CN._player = { ov, get sim() { return sim; }, play: () => { playing = true; }, load };
    return CN._player;
  };

  /** open the simulation for the stage drawings that are open in the editor */
  CN.open = async (E) => {
    const st = E.doc.info && E.doc.info.stage;
    if (!st || !st.flow) return E.err("Open a set of process-stage drawings first (Process → Make stage drawings), then start the CNC simulation.");
    E.msg("Reading the process plan and the part shape…", "mu");
    const P = await K.stageGetProject(st.pd), SP = SPk(), sh = st.shape || {};
    const model = Object.assign({ outer: sh.outer, inner: sh.inner || [], L: sh.L, rmax: Math.max(...(sh.outer || [[0, 0]]).map((p) => p[1])), D0: sh.D0, fa: 1.5, clamp: 10, first: "L", bar: { len: "", tol: "", cond: "", cert: "" } }, st.model || {});
    const cx = SP.prepare(P, model, {}); if (st.own) cx.own = new Map(st.own);
    const ranks = []; cx.stages.forEach((op, i) => { if (cx.rankOfStage.has(i)) ranks.push({ op, rank: cx.rankOfStage.get(i) }); });
    if (!ranks.length) return E.err("This process plan has no CNC turning operation to simulate.");
    E.msg(`CNC program and machining simulation for ${ranks.map((r) => "OP " + r.op.opNo).join(", ")}. Press Play; use Record video to keep it as a file.`, "mu");
    CN.player(cx, ranks, () => E.focus && E.focus());
  };
  K.cmd("CNCSIM", { a: ["CNC", "SIMULATE", "MACHSIM"], d: "CNC program and machining simulation (material removal, program on screen, video) for the CNC turning operations of the stage drawings", norepeat: true, fn: async (E) => { try { await CN.open(E); } catch (e) { if (e === K.CANCEL) throw e; E.err(e.message || String(e)); } } });
  { const tab = K.RIBBON.find((x) => x.t === "Process"), grp = { n: "CNC program", b: [["CNCSIM", "Program & simulation", "rotate"]] }; if (tab) tab.g.push(grp); else K.RIBBON.push({ t: "Process", g: [grp] }); }

})((window.KCAD = window.KCAD || {}));
