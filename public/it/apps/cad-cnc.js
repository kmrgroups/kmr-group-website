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


  /** tool catalogue: real inserts, holders, boring bars and drills (ISO sizes) */
  const INS = {
    CNMG120408: { iso: "CNMG 12 04 08", ic: 12.7, L: 12.9, ang: 80, r: 0.8, edges: 8, grade: "coated carbide P25 (steel roughing)" },
    VNMG160404: { iso: "VNMG 16 04 04", ic: 9.525, L: 16.6, ang: 35, r: 0.4, edges: 4, grade: "coated carbide P15 (finishing)" },
    DCMT0702: { iso: "DCMT 07 02 04", ic: 6.35, L: 7.0, ang: 55, r: 0.4, edges: 2, grade: "coated carbide P15 (boring)" },
    CCMT060204: { iso: "CCMT 06 02 04", ic: 6.35, L: 6.4, ang: 80, r: 0.4, edges: 2, grade: "coated carbide P15 (boring)" },
    CCGT040102: { iso: "CCGT 04 01 02", ic: 4.76, L: 4.8, ang: 80, r: 0.2, edges: 2, grade: "uncoated carbide, micro boring" },
    CUSTOM: { iso: "SPECIAL (custom) insert", ic: 3, L: 3.2, ang: 55, r: 0.2, edges: 1, grade: "custom - to be designed" },
    TR16ER: { iso: "16 ER ISO 60 deg", ic: 9.525, L: 16.5, ang: 60, r: 0.15, edges: 3, grade: "coated carbide (threading)" },
  };
  const HOLD = { PCLNR2525M12: { w: 25, L: 150, lead: 95 }, MVJNR2525M16: { w: 25, L: 150, lead: 93 }, SER2525M16: { w: 25, L: 150, lead: 90 } };
  const BARS = [
    { name: "S16R-SDQCR07", D: 16, minBore: 20, ins: "DCMT0702" }, { name: "S12M-SDQCR07", D: 12, minBore: 16, ins: "DCMT0702" },
    { name: "S10K-SDQCR07", D: 10, minBore: 13, ins: "DCMT0702" }, { name: "S08K-SCLCR06", D: 8, minBore: 10, ins: "CCMT060204" },
    { name: "S06F-SCLCR04", D: 6, minBore: 8, ins: "CCGT040102" },
  ];
  const barFor = (dia) => BARS.find((b) => dia + 1e-6 >= b.minBore) || null;
  const drillFor = (D, tipDepth) => {
    const cls = [3, 5, 8, 12].find((c) => c * D >= tipDepth + 0.5) || 12, shank = D <= 6 ? 6 : D <= 8 ? 8 : D <= 10 ? 10 : D <= 12 ? 12 : D <= 16 ? 16 : 20;
    const er = shank <= 10 ? { name: "ER16", nut: 28 } : shank <= 16 ? { name: "ER25", nut: 42 } : { name: "ER32", nut: 50 };
    return { cls, fl: cls * D, shank, er };
  };
  CN.INS = INS; CN.HOLD = HOLD; CN.BARS = BARS;
  /** standard-size and tolerance rules (ISO 286 IT grades, standard drill / reamer series) */
  const ITR = [3, 6, 10, 18, 30, 50, 80, 120];
  const IT = { 6: [6, 8, 9, 11, 13, 16, 19, 22], 7: [10, 12, 15, 18, 21, 25, 30, 35], 8: [14, 18, 22, 27, 33, 39, 46, 54], 9: [25, 30, 36, 43, 52, 62, 74, 87], 10: [40, 48, 58, 70, 84, 100, 120, 140], 11: [60, 75, 90, 110, 130, 160, 190, 220], 12: [100, 120, 150, 180, 210, 250, 300, 350], 13: [140, 180, 220, 270, 330, 390, 460, 540] };
  const itTol = (D, g) => { const ix = ITR.findIndex((q) => D <= q); return IT[g][ix < 0 ? 7 : ix] / 1000; };
  const itNeed = (D, band) => { for (let g = 13; g >= 6; g--) if (itTol(D, g) <= band + 1e-9) return g; return 5; };   // IT grade the tolerance band asks for
  const on = (v, st) => Math.abs(v / st - Math.round(v / st)) < 1e-6;
  const stdDrill = (D) => D >= 1 && D <= 20 ? on(D, 0.1) : D > 20 && on(D, 0.5);
  const stdReamer = (D) => D >= 1 && D <= 20 && (D <= 10 ? on(D, 0.1) : on(D, 0.5));
  const stdPitch = (p) => [0.5, 0.6, 0.7, 0.75, 0.8, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4].some((q) => Math.abs(q - p) < 1e-6);
  const dnTo = (D) => (D > 20 ? Math.floor(D * 2 + 1e-9) / 2 : Math.floor(D * 10 + 1e-9) / 10);
  const bandOf = (c, nom) => {
    const lo = c.lsl != null && c.lsl !== "" ? +c.lsl : null, hi = c.usl != null && c.usl !== "" ? +c.usl : null; if (lo != null && hi != null && hi > lo) return { band: hi - lo, src: "drawing" };
    const m = String(c.spec || c.text || "").match(/±\s*(\d+(?:\.\d+)?)/); if (m) return { band: 2 * parseFloat(m[1]), src: "drawing" };
    const t = nom <= 3 ? 0.1 : nom <= 6 ? 0.1 : nom <= 30 ? 0.2 : nom <= 120 ? 0.3 : 0.5; return { band: 2 * t, src: "ISO 2768-m (no tolerance on the drawing)" };
  };
  /** how to make a hole of final diameter D with tolerance band: drill / drill + bore / drill + ream (reamer for close tolerances) */
  const holePlan = (D, band, barFits) => {
    const g = itNeed(D, band), al = D <= 6 ? 0.2 : D <= 12 ? 0.3 : 0.4;
    if (g >= 12) return { mode: "drill", g, D, band };
    if (g >= 9) return barFits ? { mode: "drill+bore", g, D, band } : { mode: "drill+ream", g, D, band, al, pilot: dnTo(D - al) };
    return { mode: "drill+ream", g, D, band, al, pilot: dnTo(D - al), bore: barFits, tight: g <= 5 };
  };
  CN.itTol = itTol; CN.itNeed = itNeed; CN.holePlan = holePlan; CN.bandOf = bandOf; CN.stdDrill = stdDrill; CN.stdReamer = stdReamer; CN.stdPitch = stdPitch;


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
    const lines = [], tools = {}, warn = []; let nn = 10, curT = 0;
    const N = (s) => { lines.push(`N${nn} ${s}`); nn += 10; }, C = (s) => lines.push(`(${ascii(s)})`);
    const rpmAt = (vc, dia) => Math.min(4000, Math.round((vc * 1000) / (Math.PI * Math.max(dia, 4))));
    const toolNo = (n, name, kind, extra) => { tools[n] = Object.assign({ n, name, kind, std: true }, extra || {}); return n; };
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
    const need = { face: uStock > 0.02 && rank === 0 || (rank > 0 && uStock > 0.02) };

    N("G21 G40 G80 G99");
    N("G28 U0. W0.");
    N(`G50 S${Math.round(Math.min(4000, rpmAt(cd.vcR, 4 * 2)))}`);

    // --- T01 facing + OD roughing
    let tool = toolNo(1, "OD ROUGHING CNMG120408", "od", { H: 1.8, vc: cd.vcR, ins: "CNMG120408", holder: "PCLNR2525M12" });
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
    const bores = [], keeps = [], voidMap = new Map();
    for (const v of S.voids) {
      if (!v.roles.some((r) => r === "this")) continue;
      let pts = v.pts.map((p) => [uOf(p[0]), p[1]]), roles = v.roles.slice(), edges = v.roles.map((_, i) => eOf(v.pts[i], v.pts[i + 1], "i"));
      if (Math.abs(pts[0][0]) > Math.abs(pts[pts.length - 1][0])) { pts.reverse(); roles.reverse(); edges.reverse(); }
      let tip = v.tip ? [uOf(v.tip[0]), 0] : null;
      // a part of the bore that is wider than the neck in front of it cannot be reached with a normal boring bar: it needs a CUSTOM back-boring tool
      let cut = pts.length, mn = pts[0][1], pocket = null;
      for (let i = 1; i < pts.length; i++) { if (pts[i][1] > mn + 0.05) { cut = i; break; } mn = Math.min(mn, pts[i][1]); }
      if (cut < pts.length && cut >= 2) {
        const last = pts[cut - 1], pp = pts.slice(cut - 1).concat(tip ? [tip] : []), toX = (q) => [xOf(q[0]), q[1]];
        pocket = { pts: pp, rNeck: last[1], uStart: last[0], rMax: Math.max(...pp.map((q) => q[1])), roles: roles.slice(cut - 1) };
        if (opt.skipPocket) { keeps.push({ keep: [[last[0], 0]].concat(pp).concat([[pp[pp.length - 1][0], 0]]).map(toX) }); }
        pts = pts.slice(0, cut); roles = roles.slice(0, cut - 1); edges = edges.slice(0, cut - 1); tip = [last[0] + 0.6 * last[1], 0];
        if (opt.skipPocket) keeps[keeps.length - 1].open = [[pts[0][0], 0]].concat(pts).concat([tip]).map(toX);
        warn.push(opt.skipPocket ? `The bore is wider than its neck beyond depth ${fmt(last[0])} mm: left unmachined on this side.` : `The pocket behind the dia ${fmt(2 * last[1])} neck (dia ${fmt(2 * pocket.rMax)}) cannot be made with a standard boring bar. A CUSTOM back-boring tool is used in this program; or make that part from the other side with a standard tool.`);
      }
      voidMap.set(v, { pts: pts.map((p) => [xOf(p[0]), p[1]]), tip: tip ? [xOf(tip[0]), 0] : null, roles });
      const flats = []; for (let i = 0; i + 1 < pts.length; i++) if (Math.abs(pts[i][1] - pts[i + 1][1]) < 1e-6 && Math.abs(pts[i + 1][0] - pts[i][0]) > 0.25) flats.push({ u0: pts[i][0], u1: pts[i + 1][0], r: pts[i][1], role: roles[i] });
      const tf = flats.filter((f) => f.role === "this"); if (!tf.length) continue;
      const deep = tf.reduce((a, b) => (b.u1 > a.u1 ? b : a)), rMin = Math.min(...tf.map((f) => f.r)), rFin = rMin;
      let dD = null; for (const c of mine) { const f = cx.M.get(+c.no); if (f && f.semi && f.kind === "dia" && f.side === "i") { const n = U.nomOf(c); if (n >= 2 && n < 2 * rMin - 0.1) dD = n; } }
      let only = false; if (dD == null) { if (tf.every((f) => Math.abs(f.r - tf[0].r) < 0.02) && pts.every((p, i) => i === 0 || Math.abs(p[1] - tf[0].r) < 0.02 || p[0] > deep.u1 - 1e-6)) { dD = r3(2 * tf[0].r); only = true; } else dD = Math.max(2, Math.floor((2 * rMin - 1.0) * 2) / 2); }
      let lastThis = -1; roles.forEach((r, i) => { if (r === "this") lastThis = i; });
      bores.push({ pts, edges, tip, flats: tf, deep, rMin, rFin, dD, only, rd: dD / 2, lastThis, nRoles: roles.length, pocket });
    }
    const checks = [];   // every dimension: made with a standard tool, or flagged CUSTOM
    const findC = (dia) => { for (const c of mine) { const f = cx.M.get(+c.no); if (f && f.kind === "dia" && f.side === "i" && Math.abs(U.nomOf(c) - dia) < 0.05) return c; } return null; };
    bores.forEach((b, bi) => {
      const depth = b.deep.u1; let needBore = !b.only || b.pts.some((p, i) => i + 1 < b.pts.length && Math.abs(p[1] - b.pts[i + 1][1]) > 1e-6);
      const dia = r3(2 * b.rFin), cn = findC(dia), bd = bandOf(cn || {}, dia), barOk = !!barFor(dia), plan = holePlan(dia, bd.band, barOk), label = cn ? `dim ${cn.no}` : `bore ${bi + 1}`;
      let reamD = 0, bar = null; const chk = { label, dia, band: bd.band, src: bd.src, g: plan.g, steps: [] };
      checks.push(chk);
      if (!needBore) {   // straight hole: drilled to size, bored, or drilled and reamed
        if (plan.mode === "drill+bore" && barOk) { needBore = true; b.dD = Math.min(dnTo(dia - 1.0), dnTo(dia - 0.6)); }
        else if (plan.mode === "drill+ream") { reamD = dia; b.dD = Math.max(1, plan.pilot); }
      }
      if (needBore) {
        bar = barFor(2 * b.rFin);
        if (!bar) {   // too small for any boring bar: the drill (and a reamer if the tolerance is close) makes the final size
          const big = b.flats.some((f) => f.r > b.rFin + 0.05);
          if (plan.mode === "drill+ream" && !big) { reamD = dia; b.dD = Math.max(1, plan.pilot); } else { b.dD = dia; }
          b.rd = b.dD / 2;
          warn.push(`Bore dia ${fmt(dia)} is too small for the smallest boring bar (it needs a bore of at least dia 8). ${reamD ? "It is drilled and reamed to size." : "It is drilled to size."}${big ? " The larger section needs a different process (back-boring or another set-up)." : ""}`);
          C(`BORE DIA ${fmt(dia)} - TOO SMALL FOR A BORING BAR, ${reamD ? "DRILL + REAM" : "DRILLED TO SIZE"}`);
        } else if (b.dD < bar.D + 1) { b.dD = Math.min(r3(bar.D + 1), r3(2 * b.rFin - 1)); }
      }
      if (reamD === 0 && !needBore && plan.mode === "drill+ream") { reamD = dia; }
      b.dD = b.dD >= dia - 1e-6 ? b.dD : dnTo(b.dD); b.rd = b.dD / 2;
      const rd = b.rd, tipDepth = r3(depth + 0.3 * b.dD), dr = drillFor(b.dD, tipDepth), drillStd = stdDrill(b.dD);
      chk.steps.push({ tool: `drill dia ${fmt(b.dD)}`, std: drillStd, why: drillStd ? "" : "no catalogue drill of this diameter (special / step drill)" });
      C(`BORE ${bi + 1} - DRILL DIA ${fmt(b.dD)}${drillStd ? "" : " (CUSTOM SIZE)"} DEPTH ${fmt(depth)} - ${label} IT${plan.g} BAND ${fmt(bd.band)} (${bd.src})`);
      const dn = toolNo(3 + bi * 10, `DRILL DIA ${fmt(b.dD)} ${dr.cls}XD${drillStd ? "" : " CUSTOM"}`, "drill", { rd, vc: cd.vcD, ins: "DRILL", fl: dr.fl, shank: dr.shank, collet: dr.er.name, nut: dr.er.nut, holder: `${dr.er.name} collet chuck holder`, std: drillStd, why: drillStd ? "" : `dia ${fmt(b.dD)} is not a standard drill size` });
      changeTool(dn, `DRILL DIA ${fmt(b.dD)} ${dr.cls}XD 118 DEG`);
      N(`G97 S${rpmAt(cd.vcD, b.dD)} M03`); N("G00 X0. Z2."); N("M08");
      N("G74 R0.5"); N(`G74 Z${fmt(-tipDepth)} Q${Math.round(Math.min(3, Math.max(1, b.dD * 0.4)) * 1000)} F${b.dD > 6 ? "0.15" : "0.10"}`);
      N("G00 Z2."); N("G28 U0. W0.");
      // boring bar: rough layers, then the finishing contour with the mouth chamfer and the bottom
      const bn = bar ? toolNo(4 + bi * 10, `BORING BAR ${bar.name} ${bar.ins}`, "bore", { H: 1.6, vc: cd.vcF, ins: bar.ins, holder: bar.name, bar }) : 0;
      const b2 = (u) => { let best = -1; for (let i = 0; i + 1 < b.pts.length; i++) { const p = b.pts[i], q = b.pts[i + 1]; if (u < Math.min(p[0], q[0]) - 1e-9 || u > Math.max(p[0], q[0]) + 1e-9) continue; if (Math.abs(q[0] - p[0]) < 1e-9) best = Math.max(best, p[1], q[1]); else best = Math.max(best, p[1] + ((q[1] - p[1]) * (u - p[0])) / (q[0] - p[0])); } return best; };
      if (needBore && bar) {
        changeTool(bn, `BORING BAR ${bar.name} ${bar.ins}`);
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
        C("BORE FINISH - CONTOUR"); const nb = b.lastThis >= 0 ? b.lastThis + 2 : b.pts.length, full = b.pts.slice(0, nb), ed = b.edges.slice(0, nb - 1); if (b.tip && nb === b.pts.length) { full.push(b.tip); ed.push(null); }
        const it = items(full, ed, arcOf), p0 = full[0];
        N(`G00 X${fmt(2 * Math.max(p0[1] - 1, 0.3))} Z1.`); N(`G01 X${fmt(2 * p0[1])} Z0. F0.06`);
        it.forEach((q) => N(q.arc ? `G${q.arc.cw ? "02" : "03"} X${fmt(2 * q.to[1])} Z${fmt(-q.to[0])} R${fmt(q.arc.R)}` : `G01 X${fmt(2 * q.to[1])} Z${fmt(-q.to[0])}`));
        const q = full[full.length - 1]; if (q[1] > 0.3) N(`G01 X${fmt(2 * (q[1] - 0.5))}`); N("G00 Z1."); N("G28 U0. W0.");
        chk.steps.push({ tool: `boring bar ${bar.name}`, std: true, why: "" });
        if (plan.g <= 8) { chk.note = `IT${plan.g} is very close for a boring bar: use a fine-boring head or ream/hone after boring.`; warn.push(`${label}: tolerance band ${fmt(bd.band)} is about IT${plan.g}; a boring bar can only hold about IT8 - add a finish ream or hone.`); }
      }
      if (reamD) {   // reamer for the final size
        const rr = drillFor(reamD, tipDepth), rs = stdReamer(reamD), rn = toolNo(6 + bi * 10, `REAMER DIA ${fmt(reamD)} H7${rs ? "" : " CUSTOM"}`, "drill", { rd: reamD / 2, vc: Math.round(cd.vcD * 0.5), ins: "DRILL", ream: true, fl: rr.fl, shank: rr.shank, collet: rr.er.name, nut: rr.er.nut, holder: `${rr.er.name} collet chuck holder`, std: rs, why: rs ? "" : `dia ${fmt(reamD)} is not a standard reamer size` });
        C(`REAM TO DIA ${fmt(reamD)} - CLOSE TOLERANCE (IT${plan.g}), ${rs ? "STANDARD REAMER" : "CUSTOM REAMER"}`);
        changeTool(rn, `REAMER DIA ${fmt(reamD)} H7`);
        N(`G97 S${rpmAt(Math.round(cd.vcD * 0.5), reamD)} M03`); N("G00 X0. Z2."); N("M08"); N(`G01 Z${fmt(-tipDepth)} F0.30`); N("G04 P500"); N("G00 Z2."); N("G28 U0. W0.");
        chk.steps.push({ tool: `reamer dia ${fmt(reamD)}`, std: rs, why: rs ? "" : "no catalogue reamer of this diameter" });
      }
      if (b.pocket) {   // pocket behind a narrower neck: a CUSTOM back-boring tool
        const pk = b.pocket, rN = pk.rNeck, pw = Math.max(0.8, r3(2 * rN - 1.0)), cb = { name: `CUSTOM BACK-BORE BAR DIA ${fmt(pw)}`, D: pw, minBore: r3(2 * rN), ins: "CUSTOM" };
        const pn = toolNo(7 + bi * 10, cb.name, "bore", { H: 1.6, vc: cd.vcF, ins: "CUSTOM", holder: "CUSTOM back-boring bar", bar: cb, std: false, why: `pocket dia ${fmt(2 * pk.rMax)} behind a dia ${fmt(2 * rN)} neck cannot be reached by a catalogue tool` });
        chk.steps.push({ tool: cb.name, std: false, why: `pocket dia ${fmt(2 * pk.rMax)} behind the dia ${fmt(2 * rN)} neck` });
        C(`POCKET DIA ${fmt(2 * pk.rMax)} BEHIND NECK DIA ${fmt(2 * rN)} - CUSTOM BACK-BORING TOOL`);
        changeTool(pn, `CUSTOM BACK-BORE BAR DIA ${fmt(pw)}`);
        const pp = pk.pts, uEnd = pp[pp.length - 1][0], rp = (u) => { let best = 0; for (let i = 0; i + 1 < pp.length; i++) { const p = pp[i], q = pp[i + 1]; if (u < Math.min(p[0], q[0]) - 1e-9 || u > Math.max(p[0], q[0]) + 1e-9) continue; best = Math.max(best, Math.abs(q[0] - p[0]) < 1e-9 ? Math.max(p[1], q[1]) : p[1] + ((q[1] - p[1]) * (u - p[0])) / (q[0] - p[0])); } return best; };
        const xs = fmt(2 * Math.max(rN - 0.6, 0.2));
        N(`G96 S${cd.vcF} M03`); N(`G00 X${xs} Z2.`);
        C("POCKET ROUGH - LAYERS FROM THE AXIS OUTWARD");
        for (let rk = 0.45; rk <= pk.rMax - 0.15 + 1e-9; rk += 0.45) {
          let ua = null, ub = null; for (let u = pk.uStart; u <= uEnd + 1e-9; u += 0.05) if (rp(u) - 0.15 >= rk) { if (ua == null) ua = u; ub = u; }
          if (ua == null || ub - ua < 0.05) continue; if (rk < rN) ua = pk.uStart;
          N(`G00 X${xs} Z${fmt(-ua)}`); N(`G01 X${fmt(2 * r3(rk))} F0.08`); N(`G01 Z${fmt(-ub)} F0.10`); N(`G00 X${xs}`);
        }
        C("POCKET FINISH - CONTOUR"); N(`G00 X${xs} Z${fmt(-pk.uStart)}`);
        pp.forEach((q, i) => { if (i) N(`G01 X${fmt(2 * q[1])} Z${fmt(-q[0])} F0.05`); else N(`G01 X${fmt(2 * q[1])} F0.05`); });
        N("G00 Z2."); N("G28 U0. W0.");
      }
    });

    // --- T02 OD finishing (chamfers, radii, grooves, the whole outline) and the thread
    if (oc) {
      tool = toolNo(2, "OD FINISHING VNMG160404", "od", { H: 2.6, vc: cd.vcF, ins: "VNMG160404", holder: "MVJNR2525M16" });
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
        const tn = toolNo(5, `THREAD TOOL 60 DEG P${fmt(pitch)}`, "thread", { pitch, vc: cd.vcT, ins: "TR16ER", holder: "SER2525M16", std: stdPitch(pitch), why: stdPitch(pitch) ? "" : `pitch ${fmt(pitch)} is not a standard ISO pitch` });
        checks.push({ label: `dim ${c.no}`, thread: true, pitch, steps: [{ tool: `thread tool P${fmt(pitch)}`, std: stdPitch(pitch), why: stdPitch(pitch) ? "" : `pitch ${fmt(pitch)} is not a standard ISO pitch` }] });
        C(`THREAD ${ascii(c.spec || c.text)} PITCH ${fmt(pitch)}`);
        changeTool(tn, `THREAD TOOL 60 DEG P${fmt(pitch)}`);
        N(`G97 S${rpmAt(cd.vcT, 2 * rM)} M03`); N(`G00 X${fmt(2 * (rM + 2))} Z${fmt(-(u0 - 3 * pitch))}`);
        N("G76 P011060 Q100 R0.05"); N(`G76 X${fmt(2 * (rM - hh))} Z${fmt(-u1)} P${Math.round(hh * 1000)} Q300 F${fmt(pitch)}`);
        N(`G00 X${fmt(2 * (rM + 3))}`); N("G28 U0. W0.");
      });
    }
    N("M05"); N("M09"); N("M30"); lines.push("%");
    const Sg = voidMap.size ? Object.assign({}, S, { voids: S.voids.map((v) => (voidMap.has(v) ? Object.assign({}, v, voidMap.get(v)) : v)) }) : S;
    return { name: `O${String(4000 + (+op.opNo || 0)).slice(-4)}`, op, lines, tools, d, xw, uOf, xOf, S0, S: Sg, jaws, cd, mine, rank, warn, keeps, checks };
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


  /** chip form from material, tool, feed, depth of cut (after Seco / Mitsubishi chip-control guides):
      low feed or very small depth -> long ribbon; mid feed with a chip breaker -> short spiral / comma; high feed -> short C / fan pieces;
      aluminium stays long and continuous; stainless is tough and stringy / buckled; brass and cast iron break into needles; peck drilling breaks the chip every peck */
  const chipSpec = (mat, kind, f, ap) => {
    const r = (o) => Object.assign({ turns: 3, R: 4, amp: 3 }, o);
    if (kind === "drill") {
      if (mat === "BRASS") return r({ t: "frag", d: 0.9, label: "needle chips (brass breaks short)" });
      if (mat === "ALUMINIUM") return r({ t: "helix", d: 0.9, turns: 5, R: 5, len: 46, label: "long-pitch spiral (aluminium, ductile)" });
      if (mat === "STAINLESS") return r({ t: "zig", d: 0.9, len: 30, amp: 5, label: "buckled zig-zag chips (stainless)" });
      return f < 0.13 ? r({ t: "cone", d: 0.8, turns: 4.5, R: 5.5, len: 30, label: "conical spiral chips, broken every peck" }) : r({ t: "frag", d: 0.8, label: "fan chips (higher feed breaks them)" });
    }
    if (mat === "BRASS") return r({ t: "frag", d: 1.4, label: "short broken chips (brass)" });
    if (mat === "ALUMINIUM") return f >= 0.15 && ap >= 0.6 ? r({ t: "helix", d: 16, turns: 7, R: 7, len: 80, label: "long loose spiral (aluminium keeps flowing)" }) : r({ t: "ribbon", d: 24, len: 110, amp: 6, label: "long ribbon (aluminium, light cut)" });
    if (mat === "STAINLESS") return ap < 0.5 || f < 0.1 ? r({ t: "ribbon", d: 18, len: 85, amp: 4, label: "tough stringy ribbon (stainless, light cut)" }) : r({ t: "zig", d: 6, len: 26, amp: 5, label: "tough buckled chips (stainless)" });
    if (kind === "thread") return r({ t: "ribbon", d: 8, len: 34, amp: 2.5, label: "thin thread swarf" });
    if (f < 0.1 || ap < 0.4) return r({ t: "ribbon", d: 26, len: 100, amp: 4, label: "long thin ribbon (feed or depth too small to break the chip)" });
    if (f > 0.32) return r({ t: "frag", d: 3, label: "short C / square chips (feed very high)" });
    return r({ t: "helix", d: 7, turns: 3.4, R: 3.5 + Math.min(ap, 3) * 1.1, len: 30, label: "short spiral chips (chip breaker working)" });
  };


  /** tool-life model: extended Taylor  T = Tref * (v/vref)^(-1/n) * (f/fref)^(-a/n) * (ap/apref)^(-b/n)
      reference life Tref is the catalogue-style life at the cutting data the program uses; the exponents are typical values for coated carbide.
      Calibrate Tref / n with your own tool-life records (CN.TAYLOR). Wear is VB (flank wear) with the ISO 3685 limit 0.3 mm. */
  const TAYLOR = {
    STEEL: { n: 0.25, a: 0.30, b: 0.12, k: 1 }, STAINLESS: { n: 0.20, a: 0.30, b: 0.12, k: 0.6 }, ALUMINIUM: { n: 0.40, a: 0.25, b: 0.10, k: 3 }, BRASS: { n: 0.35, a: 0.25, b: 0.10, k: 4 },
  };
  const REF = { od: { T: 15, f: 0.25, ap: 1.8 }, od2: { T: 25, f: 0.08, ap: 0.3 }, bore: { T: 20, f: 0.08, ap: 0.3 }, drill: { T: 40, f: 0.10, ap: 2 }, thread: { T: 20, f: 1.5, ap: 0.5 } };
  CN.TAYLOR = TAYLOR; CN.REFLIFE = REF; CN.VB_LIMIT = 0.3;
  const vbOf = (w) => { w = Math.max(0, Math.min(1.15, w)); return CN.VB_LIMIT * (0.18 * (1 - Math.exp(-w * 18)) + 0.62 * w + 0.2 * Math.pow(w, 6)); };
  CN.vbOf = vbOf;
  const lifeMin = (mat, tl, v, f, ap) => {
    const tc = TAYLOR[mat] || TAYLOR.STEEL, key = tl.kind === "od" ? (tl.ins === "VNMG160404" ? "od2" : "od") : tl.kind, r = REF[key] || REF.od, vref = tl.vc || v;
    const T = r.T * tc.k * Math.pow(Math.max(v, 5) / vref, -1 / tc.n) * Math.pow(Math.max(f, 0.01) / r.f, -tc.a / tc.n) * Math.pow(Math.max(ap, 0.05) / r.ap, -tc.b / tc.n);
    return Math.max(0.3, Math.min(600, T));
  };
  CN.lifeMin = lifeMin;

  class Sim {
    constructor(g, cx) {
      this.g = g; this.cx = cx; this.mv = CN.interp(g.lines, g.tools); const S0 = g.S0, S = g.S, jw = g.jaws;
      let xlo = Math.min(S0.xl, S.xl, ...jw.poly.map((p) => p[0])) - 2, xhi = Math.max(S0.xr, S.xr, ...jw.poly.map((p) => p[0])) + 2;
      this.Rm = Math.max(S0.R0, S.rmax, jw.top || 0) + 0.4; this.xlo = xlo; this.xhi = xhi; this.cs = Math.max(0.02, (xhi - xlo) / 1500);
      this.W = Math.ceil((xhi - xlo) / this.cs); this.Hc = Math.ceil(this.Rm / this.cs);
      this.sf = -g.d;   // display direction of the free end (the side the tool comes from)
      this.tgt = new Uint8Array(this.W * this.Hc); fillLoops(S.loops, this.W, this.Hc, xlo, this.cs, this.tgt);
      for (const kp of g.keeps || []) {   // parts left on purpose (made from the other side): protected from cutting and not counted as stock left
        const t1 = new Uint8Array(this.W * this.Hc), t2 = new Uint8Array(this.W * this.Hc); fillLoops([kp.keep], this.W, this.Hc, xlo, this.cs, t1); fillLoops([kp.open], this.W, this.Hc, xlo, this.cs, t2);
        for (let q = 0; q < t1.length; q++) { if (t1[q]) this.tgt[q] = 1; if (t2[q]) this.tgt[q] = 0; }
      }
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
      this.i = 0; this.s = 0; this.t = 0; this.li = -1; this.done = false; this.trail = []; this.use = {}; this.chips = []; this.chipTxt = ""; this.acc = 0; this.ap = 1; this.pos = [3, 40]; this.tool = 0; this.rpm = 0; this.feed = 0; this.phase = ""; this.stats = null; this.removed = 0; this.vol = 0;
      this.img = null; this.dirty = true; this.lastM = null;
    }
    xr(Z, X) { return [this.g.xw - this.g.d * Z, X / 2]; }
    cut(ix, j, force) { if (ix < 0 || ix >= this.W || j < 0 || j >= this.Hc) return 0; const k = j * this.W + ix; if (!this.mat[k]) return 0; if (!force && this.tgt[k]) return 0; this.mat[k] = 0; this.dirty = true; this.vol += 2 * Math.PI * (j + 0.5) * this.cs * this.cs * this.cs; return 1; }
    carve(m, Z, X) {
      const [x, r] = this.xr(Z, X), cs = this.cs, tl = this.g.tools[m.tool], ix = Math.floor((x - this.xlo) / cs); let n = 0;
      if (!tl) return 0;
      if (tl.kind === "od") {
        const H = tl.H || 2, j0 = Math.ceil(r / cs - 0.5), j1 = Math.min(this.Hc - 1, Math.floor((r + H) / cs)); for (let j = j0; j <= j1; j++) n += this.cut(ix, j); this.ap = n * cs;
        const jr = Math.floor(r / cs), nb = Math.round(1.2 / cs); for (let k = 0; k <= nb; k++) n += this.cut(ix + this.sf * k, jr);
      } else if (tl.kind === "bore") {
        const H = tl.H || 1.6, j1 = Math.floor(r / cs - 0.5), j0 = Math.max(0, j1 - Math.round(H / cs)); for (let j = j0; j <= j1; j++) n += this.cut(ix, j); this.ap = n * cs;
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
      if (n) this.removed += n;
      return n;
    }
    /** tool wear: time in cut, cutting speed, feed and depth give the share of one edge life used */
    track(m, tl, ds, r) {
      const rpm = Math.max(this.rpm, 1), dia = tl.kind === "drill" ? 2 * tl.rd : tl.kind === "thread" ? 2 * r : Math.max(2 * r, 4), v = (Math.PI * dia * rpm) / 1000, fRev = m.type === "thread" ? m.pitch : m.f / rpm;
      const ap = tl.kind === "drill" ? tl.rd : tl.kind === "thread" ? m.depth || 0.5 : Math.max(this.ap || 0.3, 0.05), T = lifeMin(this.g.cd.name, tl, v, fRev, ap), dts = ds / Math.max(m.f / 60, 0.01);
      const u = this.use[this.tool] || (this.use[this.tool] = { w: 0, cut: 0, vs: 0, fs: 0, as: 0 });
      u.w += dts / (T * 60); u.cut += dts; u.vs += v * dts; u.fs += fRev * dts; u.as += ap * dts;
    }
    /** result per tool after a run (one part) */
    lifeData() {
      const out = [];
      for (const k of Object.keys(this.use)) {
        const u = this.use[k], tl = this.g.tools[k], ins = CN.INS[tl.ins] || { edges: 1, iso: tl.name, ic: 0, r: 0 }, w = Math.max(u.w, 1e-9);
        const edges = tl.kind === "drill" ? 4 : ins.edges;   // a drill is re-ground (about 3 times), so 4 lives
        out.push({ tool: +k, name: tl.name, holder: tl.holder || "", ins: tl.ins || "", iso: ins.iso, edges, edgeWord: tl.kind === "drill" ? "grinds" : "corners", cutS: u.cut, vc: u.vs / u.cut, f: u.fs / u.cut, ap: u.as / u.cut, w, edgeMin: u.cut / 60 / w, partsEdge: 1 / w, partsTool: edges / w });
      }
      return out.sort((a, b) => a.tool - b.tool);
    }
    /** chips: made from the length of metal actually cut, shaped by chipSpec */
    emit(m, tl, ds, x, r, flush) {
      if (this.quiet) return;
      this.layout(); const spec = chipSpec(this.g.cd.name, tl.kind, m.f / Math.max(this.rpm, 1), this.ap || 1), k = this.k; this.chipTxt = spec.label;
      this.acc = (this.acc || 0) + ds; let guard = 0;
      while ((this.acc >= spec.d || (flush && guard === 0)) && guard++ < 4) {
        this.acc = Math.max(0, this.acc - spec.d); if (this.chips.length > 110) this.chips.shift();
        const sf = this.sf, rnd = Math.random(), q = { spec, rr: Math.max(2.5, spec.R * (0.8 + 0.4 * rnd)), len: spec.len ? spec.len * (0.7 + 0.5 * rnd) : 8, ang: Math.random() * 6.28, w: (Math.random() - 0.5) * 7, life: 0, heat: 1, hole: false };
        if (tl.kind === "drill") { const xm = this.xr(0, 0)[0]; q.px = this.sx(xm); q.py = this.cy + (Math.random() - 0.5) * 2 * Math.min(tl.rd * k, 10); q.vx = sf * (70 + Math.random() * 80); q.vy = (Math.random() - 0.4) * 40; q.out = true; }
        else if (tl.kind === "bore") { q.px = this.sx(x); q.py = this.cy - r * k + 4; q.vx = sf * (90 + Math.random() * 60); q.vy = 0; q.hole = true; }
        else { q.px = this.sx(x); q.py = this.cy - r * k - 3; q.vx = sf * (60 + Math.random() * 90); q.vy = -(90 + Math.random() * 110); }
        this.chips.push(q);
      }
    }
    /** advance the simulated machine time by dt seconds */
    advance(dt) {
      if (this.done) return; this.t += dt; const cs = this.cs;
      while (this.i < this.mv.length) {
        const m = this.mv[this.i], p = Math.min(1, (this.t - m.t0) / m.dur), tgt = m.len * p;
        this.li = m.li; this.tool = m.tool; this.rpm = m.rpm; this.feed = m.f || 0; this.lastM = m;
        const prev = this.lines && this.lines[m.li]; void prev;
        if (m.type === "tool" || m.type === "home") { this.pos = m.type === "home" ? m.to.slice() : this.pos; }
        else if (m.type === "rapid") { this.pos = this.posAt(m, tgt); if (this.acc > 0.4 && this.lastCut) { const lc = this.lastCut; this.emit(lc.m, lc.tl, 0, lc.x, lc.r, true); this.acc = 0; } }
        else {
          const ds = cs * 0.8; let s = this.s; if (s > tgt) s = 0;
          while (s < tgt) { s = Math.min(tgt, s + ds); const q = this.posAt(m, s); const nn = this.carve(m, q[0], q[1]); this.pos = q; if (nn || m.type === "thread") { const tl2 = this.g.tools[m.tool], xy = this.xr(q[0], q[1]); if (tl2) { this.track(m, tl2, ds, xy[1]); if (nn) { this.lastCut = { m, tl: tl2, x: xy[0], r: xy[1] }; this.emit(m, tl2, ds, xy[0], xy[1]); } } } if (!this.trail.length || Math.hypot(q[0] - this.trail[this.trail.length - 1][0], q[1] - this.trail[this.trail.length - 1][1]) > 0.35) this.trail.push([q[0], q[1], m.type === "feed" ? 1 : 0]); }
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
      // where is stock left? group the leftover cells in 0.5 mm blocks and name the regions in Z and diameter
      const bw = Math.max(1, Math.round(0.5 / cs)), nx = Math.ceil(W / bw), ny = Math.ceil(Hc / bw), cnt = new Float32Array(nx * ny);
      for (let j = 0; j < Hc; j++) for (let i = 0; i < W; i++) if (mat[j * W + i] && !tgt[j * W + i]) cnt[Math.floor(j / bw) * nx + Math.floor(i / bw)] += cs * cs;
      const seen = new Uint8Array(nx * ny), regions = [];
      for (let q = 0; q < nx * ny; q++) {
        if (seen[q] || cnt[q] < 0.04) continue; const st = [q]; seen[q] = 1; let a = 0, i0 = nx, i1 = 0, j0 = ny, j1 = 0;
        while (st.length) { const p = st.pop(), pi = p % nx, pj = (p - pi) / nx; a += cnt[p]; i0 = Math.min(i0, pi); i1 = Math.max(i1, pi); j0 = Math.min(j0, pj); j1 = Math.max(j1, pj); for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const ni = pi + di, nj = pj + dj; if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue; const np = nj * nx + ni; if (!seen[np] && cnt[np] >= 0.04) { seen[np] = 1; st.push(np); } } }
        const xa = this.xlo + i0 * bw * cs, xb = this.xlo + (i1 + 1) * bw * cs, za = -this.g.d * (xa - this.g.xw), zb = -this.g.d * (xb - this.g.xw);
        regions.push({ a, txt: `Z ${Math.max(za, zb).toFixed(1)} to ${Math.min(za, zb).toFixed(1)}, dia ${(2 * j0 * bw * cs).toFixed(1)} to ${(2 * (j1 + 1) * bw * cs).toFixed(1)}` });
      }
      regions.sort((p, q) => q.a - p.a);
      this.stats = { resid, maxRes: maxCol, checks, regions: regions.slice(0, 3), time: this.total, lines: this.g.lines.filter((l) => /^N\d+/.test(l)).length };
      this.dirty = true;
    }
  }
  CN.Sim = Sim;
  void 0;

  /* ================================================================ drawing the simulation frame (one canvas, so the recorded video has everything) ================================================================ */
  const CW = 1280, CH = 720, PANEL = 470, HEADH = 46, FOOT = 64, STRIP = 76, TOPM = 12;
  Sim.prototype.layout = function () {
    const vw = CW - PANEL - 24, vh = CH - HEADH - STRIP - FOOT - 16, wx = this.xhi - this.xlo, k = Math.min(vw / wx, vh / (2 * this.Rm + 2 + TOPM));
    this.k = k; this.ox = 12 + (vw - wx * k) / 2 - this.xlo * k; this.cy = HEADH + STRIP + 8 + k * (this.Rm + 1 + TOPM);
  };
  Sim.prototype.sx = function (x) { return this.ox + x * this.k; };
  Sim.prototype.sy = function (r) { return this.cy - r * this.k; };
  Sim.prototype.paintGrid = function () {
    if (!this.off) { this.off = document.createElement("canvas"); this.off.width = this.W; this.off.height = this.Hc; this.octx = this.off.getContext("2d"); }
    if (!this.img) this.img = this.octx.createImageData(this.W, this.Hc);
    if (!this.dirty) return; const { W, Hc, mat, tgt, img } = this, d = img.data, res = this.done, rim = Math.max(2, Math.round(2.4 / Math.max(this.k * this.cs, 0.05)));
    const empty = (k) => k < 0 || k >= mat.length || !mat[k];
    for (let j = 0; j < Hc; j++) {
      const row = Hc - 1 - j, sh = 0.74 + 0.26 * (j / Hc);
      for (let i = 0; i < W; i++) {
        const k = j * W + i, o = (row * W + i) * 4;
        if (!mat[k]) { d[o + 3] = 0; continue; }
        if (res && !tgt[k]) { d[o] = 245; d[o + 1] = 158; d[o + 2] = 11; d[o + 3] = 255; continue; }
        // machined steel: cool grey, brighter towards the outside, fine grain, lit rims (light from the upper left)
        let v = sh * 150 + 38 + ((((i * 73856093) ^ (j * 19349663)) >>> 3) & 7) - 3, tint = 1;
        const eU = j + rim < Hc ? empty(k + rim * W) : true, eD = j - rim >= 0 ? empty(k - rim * W) : false, eL = i - rim >= 0 ? empty(k - rim) : true, eR = i + rim < W ? empty(k + rim) : true;
        if (eU) v += 46; if (eL) v += 26; if (eR) v -= 30; if (eD) v -= 24;
        if (!tgt[k]) { v += 6; tint = 0.97; }   // metal still above the finished outline is a little duller
        d[o] = Math.max(0, Math.min(255, v * 0.94 * tint)); d[o + 1] = Math.max(0, Math.min(255, v * 0.99)); d[o + 2] = Math.max(0, Math.min(255, v * 1.08)); d[o + 3] = 255;
      }
    }
    this.octx.putImageData(img, 0, 0); this.dirty = false;
  };
  /** tool, insert and holder in real size, in mm, tip at (0,0), x towards the free end (times sf), r up */
  const ang2 = (deg) => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
  const rhomb = (a1, a2, L) => { const u = ang2(a1), v = ang2(a2); return [[0, 0], [L * u[0], L * u[1]], [L * (u[0] + v[0]), L * (u[1] + v[1])], [L * v[0], L * v[1]]]; };
  const toolGeom = (tl) => {
    const ins = (CN.INS || {})[tl.ins] || {}, h = (CN.HOLD || {})[tl.holder] || {};
    if (tl.kind === "od") {
      const fin = tl.ins === "VNMG160404", poly = fin ? rhomb(52, 87, ins.L) : rhomb(5, 85, ins.L), x0 = fin ? 2.0 : 1.6, r0 = fin ? 9 : 6.5;
      return { holder: [[x0, r0], [h.L || 150, r0], [h.L || 150, r0 + (h.w || 25)], [x0, r0 + (h.w || 25)]], insert: poly, label: tl.holder, nose: ins.r || 0.4 };
    }
    if (tl.kind === "bore") {
      const bar = tl.bar || { D: 12, minBore: 16 }, off = (bar.minBore - bar.D) / 2;
      return { holder: [[1.2, -off], [150, -off], [150, -off - bar.D], [1.2, -off - bar.D]], insert: rhomb(-10, -65, ins.L || 7), label: tl.holder, nose: ins.r || 0.4 };
    }
    if (tl.kind === "thread") {
      const L = ins.L || 16.5, hh = (L * Math.sqrt(3)) / 2;
      return { holder: [[-1, 9], [150, 9], [150, 34], [-1, 34]], insert: [[0, 0], [-L / 2, hh], [L / 2, hh]], label: tl.holder, nose: ins.r || 0.15 };
    }
    return null;
  };
  /** fill a polygon with a steel gradient across its height (light on top) */
  const metalFill = (c, pts, stops, stroke) => {
    const ys = pts.map((p) => p[1]), xs = pts.map((p) => p[0]), y0 = Math.min(...ys), y1 = Math.max(...ys), g = c.createLinearGradient(0, y0, 0, y1 + 0.01);
    stops.forEach((q) => g.addColorStop(q[0], q[1])); c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath();
    c.save(); c.shadowColor = "rgba(0,0,0,.55)"; c.shadowBlur = 9; c.shadowOffsetX = 2; c.shadowOffsetY = 4; c.fillStyle = g; c.fill(); c.restore(); c.strokeStyle = stroke || "#0b1220"; c.lineWidth = 1.1; c.stroke();
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0, y1 };
  };
  const STEEL = [[0, "#c3ccd8"], [0.18, "#9aa6b6"], [0.55, "#5f6b7c"], [1, "#333c4a"]], CYL = [[0, "#4b5563"], [0.28, "#e5e9ef"], [0.5, "#9ba6b5"], [1, "#2b3340"]], COAT = [[0, "#f4d98a"], [0.5, "#c99a2e"], [1, "#7a5a12"]];
  const screw = (c, x, y, R) => { const g = c.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.1, x, y, R); g.addColorStop(0, "#e5e7eb"); g.addColorStop(1, "#4b5563"); c.beginPath(); c.arc(x, y, R, 0, 7); c.fillStyle = g; c.fill(); c.strokeStyle = "#111827"; c.lineWidth = 1; c.stroke(); c.beginPath(); c.moveTo(x - R * 0.65, y - R * 0.2); c.lineTo(x + R * 0.65, y + R * 0.2); c.stroke(); };
  Sim.prototype.drawTool = function (c) {
    const tl = this.g.tools[this.tool], m = this.lastM; if (!tl || !m || m.type === "tool" || m.type === "home") return;
    const k = this.k, sf = this.sf, [x, r] = this.xr(this.pos[0], this.pos[1]), X = this.sx(x), Y = this.cy - r * k, P = (p) => [X + p[0] * sf * k, Y - p[1] * k];
    if (tl.kind === "drill") {
      const rd = tl.rd, cy = this.cy, fl = tl.fl, sh = tl.shank / 2, nut = tl.nut / 2, pl = 0.3 * 2 * rd, Q = (u, v) => [X + u * sf * k, cy - v * k];
      const body = [[0, 0], [pl, rd], [fl, rd], [fl, -rd], [pl, -rd]].map((p) => Q(p[0], p[1])), b = metalFill(c, body, [[0, "#d9dee6"], [0.3, "#f3f4f6"], [0.55, "#aab3c0"], [1, "#5b6574"]]);
      c.save(); c.beginPath(); body.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.clip();   // two helical flutes
      c.strokeStyle = "rgba(30,41,59,.85)"; c.lineWidth = Math.max(2, rd * k * 0.55); c.beginPath(); for (let q = 0; pl + q * 2.4 < fl + 2.4; q++) { const u = pl + q * 2.4, a = Q(u, rd * 0.9), e = Q(u + 1.8, -rd * 0.9); c.moveTo(a[0], a[1]); c.lineTo(e[0], e[1]); } c.stroke();
      c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = 1; c.beginPath(); for (let q = 0; pl + q * 2.4 < fl + 2.4; q++) { const u = pl + q * 2.4 + 0.9, a = Q(u, rd * 0.9), e = Q(u + 1.8, -rd * 0.9); c.moveTo(a[0], a[1]); c.lineTo(e[0], e[1]); } c.stroke(); c.restore();
      metalFill(c, [[fl, sh], [fl + 4, sh], [fl + 4, -sh], [fl, -sh]].map((p) => Q(p[0], p[1])), CYL);
      const nutp = [[fl + 4, nut * 0.8], [fl + 12, nut], [fl + 62, nut], [fl + 62, -nut], [fl + 12, -nut], [fl + 4, -nut * 0.8]].map((p) => Q(p[0], p[1])); metalFill(c, nutp, CYL);
      c.save(); c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = 1; c.beginPath(); for (let u = fl + 14; u < fl + 60; u += 2.2) { const a = Q(u, nut), e = Q(u, -nut); c.moveTo(a[0], a[1]); c.lineTo(e[0], e[1]); } c.stroke(); c.restore();
      const lb = Q(fl + 16, nut + 1.6); c.save(); c.fillStyle = "#e2e8f0"; c.font = "600 12px system-ui, Segoe UI, Arial"; c.textAlign = sf > 0 ? "left" : "right"; c.fillText(tl.holder, lb[0], lb[1]); c.restore();
      const t0 = Q(0, 0); this.ring(c, t0[0], t0[1], 8, tl, this.cornerOf(this.tool)); return;
    }
    const G = toolGeom(tl); if (!G) return;
    const hp = G.holder.map(P), ip = G.insert.map(P);
    const hb = metalFill(c, hp, tl.kind === "bore" ? CYL : STEEL);
    if (tl.kind !== "bore") { c.save(); c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 1; c.beginPath(); c.moveTo(hp[0][0], hp[0][1] + 2); c.lineTo(hp[1][0], hp[0][1] + 2); c.stroke(); c.restore(); }
    metalFill(c, ip, COAT, "#3b2a06");
    // insert details: centre hole, clamp screw, bright cutting edges
    const cxm = ip.reduce((a, p) => a + p[0], 0) / ip.length, cym = ip.reduce((a, p) => a + p[1], 0) / ip.length;
    if (tl.kind !== "thread") screw(c, cxm, cym, Math.max(3, 0.9 * k)); else screw(c, cxm, cym + 0.2 * k, Math.max(3, 0.9 * k));
    c.save(); c.strokeStyle = "rgba(255,255,255,.85)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(ip[1][0], ip[1][1]); c.lineTo(ip[0][0], ip[0][1]); c.lineTo(ip[ip.length - 1][0], ip[ip.length - 1][1]); c.stroke(); c.restore();
    const hc = P([30, G.holder[0][1] + (G.holder[2][1] - G.holder[0][1]) / 2]); screw(c, hc[0], hc[1], Math.max(4, 1.6 * k));
    const cs = this.cornerOf(this.tool);
    c.save(); c.fillStyle = "#e2e8f0"; c.font = "600 12px system-ui, Segoe UI, Arial"; c.textAlign = sf > 0 ? "left" : "right"; const tx = P([44, G.holder[0][1] + (G.holder[2][1] - G.holder[0][1]) / 2 - 1.2]); c.fillText(G.label, tx[0], tx[1]); c.restore();
    const ring = P(G.insert[0]); this.ring(c, ring[0], ring[1], Math.max(8, (G.nose + 0.8) * k), tl, cs);
  };
  /** red ring on the cutting corner + a short label */
  Sim.prototype.ring = function (c, X, Y, R, tl, cs) {
    c.save(); c.strokeStyle = "#ef4444"; c.lineWidth = 2.4; c.beginPath(); c.arc(X, Y, R, 0, Math.PI * 2); c.stroke();
    const txt = tl.kind === "drill" ? `T${String(tl.n).padStart(2, "0")} drill point` : `T${String(tl.n).padStart(2, "0")} corner ${cs.corner}/${cs.edges}`;
    c.font = "700 12px system-ui, Segoe UI, Arial"; const w = c.measureText(txt).width + 12, bx = Math.max(6, Math.min(CW - PANEL - w - 6, X - w / 2)), by = Math.max(HEADH + STRIP + 4, Y - R - 24);
    c.fillStyle = "rgba(127,29,29,.92)"; c.fillRect(bx, by, w, 18); c.fillStyle = "#fee2e2"; c.textBaseline = "middle"; c.fillText(txt, bx + 6, by + 9); c.restore();
  };
  /** which corner of the insert is in use and how worn it is, from the number of parts already made */
  Sim.prototype.cornerOf = function (tool) {
    const tl = this.g.tools[tool], ins = (CN.INS || {})[tl.ins] || {}, edges = tl.kind === "drill" ? 4 : ins.edges || 1, L = (CN._life[this.lifeKey()] || []).find((q) => q.tool === tool), done = Math.max(0, +this.partsDone || 0);
    const used = L ? done * L.w : 0, ci = Math.min(edges - 1, Math.floor(used)), frac = used >= edges ? 1 : used - ci, part = this.use[tool] ? this.use[tool].w : 0, wf = Math.min(1.15, frac + part);
    return { corner: ci + 1, edges, frac: wf, vb: vbOf(wf), exhausted: used >= edges, nm: tl.kind === "drill" ? "grind" : "corner" };
  };
  Sim.prototype.lifeKey = function () { return this.g.name + ":" + this.g.lines.length; };
  Sim.prototype.getLife = function () {
    const key = this.lifeKey(); if (!CN._life[key]) { const d = new Sim(this.g, this.cx); d.quiet = true; d.advance(d.total + 5); CN._life[key] = d.lifeData(); }
    return CN._life[key];
  };
  /*CHIPS*/
  CN._life = CN._life || {};
  const lerp = (a, b, t) => a + (b - a) * t;
  const chipColour = (mat, heat, a) => {
    if (mat === "ALUMINIUM") return `rgba(226,232,240,${a})`;
    if (mat === "BRASS") return `rgba(250,204,21,${a})`;
    // steel / stainless: hot orange → straw → blue tempering colour → grey
    const h = Math.max(0, Math.min(1, heat)), A = [148, 163, 184], B = [147, 197, 253], C = [251, 191, 36], D = [249, 115, 22];
    const mix = (x, y, t) => x.map((v, i) => Math.round(lerp(v, y[i], t))), col = h > 0.66 ? mix(C, D, (h - 0.66) / 0.34) : h > 0.33 ? mix(B, C, (h - 0.33) / 0.33) : mix(A, B, h / 0.33);
    return `rgba(${col[0]},${col[1]},${col[2]},${a})`;
  };
  Sim.prototype.solidAt = function (px, py) {
    const x = (px - this.ox) / this.k, r = Math.abs(this.cy - py) / this.k, ix = Math.floor((x - this.xlo) / this.cs), j = Math.floor(r / this.cs);
    return ix >= 0 && ix < this.W && j >= 0 && j < this.Hc && this.mat[j * this.W + ix] === 1;
  };
  /** draw one chip: coil, cone, wavy ribbon, zig-zag or small broken pieces, rotated by q.ang */
  const chipPath = (c, q) => {
    const sp = q.spec, N = 40, cs = Math.cos(q.ang), sn = Math.sin(q.ang), pt = (x, y) => [x * cs - y * sn, x * sn + y * cs];
    c.beginPath();
    if (sp.t === "frag") { for (let i = 0; i < 4; i++) { const ox = (i - 1.5) * 4.5, a = q.ang + i * 1.7; c.moveTo(ox, 0); c.arc(ox, 0, 2.4, a, a + 3.6); } return; }
    for (let i = 0; i <= N; i++) {
      const s = i / N; let x, y;
      if (sp.t === "helix" || sp.t === "cone") { const th = s * sp.turns * 2 * Math.PI, R = sp.t === "cone" ? q.rr * (0.3 + 0.7 * s) : q.rr; x = s * q.len + R * 0.55 * Math.cos(th); y = R * Math.sin(th); }
      else if (sp.t === "ribbon") { x = s * q.len; y = sp.amp * Math.sin(s * 9 + q.ang); }
      else { x = s * q.len; y = ((Math.round(s * 10) % 2) * 2 - 1) * sp.amp * (1 - Math.abs(((s * 10) % 1) - 0.5) * 0.4); }
      const [X, Y] = pt(x - q.len / 2, y); i ? c.lineTo(X, Y) : c.moveTo(X, Y);
    }
  };
  Sim.prototype.drawChips = function (c) {
    const mat = this.g.cd.name, dt = 0.016, xm = this.xr(0, 0)[0], xMouth = this.sx(xm), sf = this.sf, bot = CH - FOOT;
    for (const q of this.chips) {
      q.life += dt; q.heat = Math.max(0, 1 - q.life * 0.9);
      if (q.hole) { q.px += q.vx * dt; if ((q.px - xMouth) * sf > 0) { q.hole = false; q.vx *= 1.2; } }       // inside the bore the chip is carried out by the coolant along the axis
      else { q.px += q.vx * dt; q.py += q.vy * dt; q.vy += 520 * dt; }
      q.ang += q.w * dt;
      if (q.vy > 0 && !q.hole && this.solidAt(q.px, q.py)) q.dead = true;   // falls behind the bar
      if (q.py > bot || q.life > 3.5) q.dead = true;
      const a = Math.max(0, Math.min(1, 1.4 - q.life * 0.4));
      c.save(); c.translate(q.px, q.py); c.scale(1.8, 1.8); c.lineCap = "round"; c.lineJoin = "round";
      chipPath(c, q); c.strokeStyle = "rgba(2,6,23,.85)"; c.lineWidth = 3; c.stroke();
      chipPath(c, q); c.strokeStyle = chipColour(mat, q.heat, a); c.lineWidth = 1.6; c.stroke(); c.restore();
    }
    this.chips = this.chips.filter((q) => !q.dead);
  };
  Sim.prototype.draw = function (c, ui) {
    try { this._draw(c, ui); this.drawErr = ""; } catch (e) { this.drawErr = e.message; if (!this._errLogged) { this._errLogged = true; console.error("CNC simulation draw error", e); } c.save(); c.fillStyle = "#fca5a5"; c.font = "12px ui-monospace, Menlo, Consolas, monospace"; c.textBaseline = "alphabetic"; c.fillText("Display problem: " + e.message, 14, CH - FOOT + 54); c.restore(); }
  };
  Sim.prototype._draw = function (c, ui) {
    this.layout(); const k = this.k, W = CW, H = CH;
    { const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#0d1626"); bg.addColorStop(1, "#070c16"); c.fillStyle = bg; c.fillRect(0, 0, W, H); }
    if (ui && ui.look === "machine") this.drawMachineBg(c);
    // header
    c.fillStyle = "#111c33"; c.fillRect(0, 0, W, HEADH); c.fillStyle = "#e2e8f0"; c.font = "600 17px system-ui, Segoe UI, Arial"; c.textBaseline = "middle";
    const op = this.g.op; c.fillText(`CNC SIMULATION · OP ${op.opNo} · ${String(op.name || "").toUpperCase()}`, 14, HEADH / 2);
    c.font = "13px ui-monospace, Menlo, Consolas, monospace"; c.fillStyle = "#94a3b8"; c.textAlign = "right"; c.fillText(`${this.cx.P.part_no || ""} · program ${this.g.name}`, W - 14, HEADH / 2); c.textAlign = "left";
    // view
    this.paintGrid();
    c.save(); c.beginPath(); c.rect(0, HEADH + STRIP, CW - PANEL, CH - HEADH - STRIP - FOOT); c.clip();
    c.strokeStyle = "#475569"; c.setLineDash([14, 4, 3, 4]); c.lineWidth = 1; c.beginPath(); c.moveTo(8, this.cy); c.lineTo(CW - PANEL - 8, this.cy); c.stroke(); c.setLineDash([]);
    c.imageSmoothingEnabled = true; const dx = this.sx(this.xlo), dw = (this.xhi - this.xlo) * k, dh = this.Hc * this.cs * k;
    if (ui && ui.look === "machine") this.drawMachineBody(c, dx, dw, dh);
    else { c.drawImage(this.off, dx, this.cy - dh, dw, dh); c.save(); c.translate(0, this.cy * 2); c.scale(1, -1); c.drawImage(this.off, dx, this.cy - dh, dw, dh); c.restore(); }
    // the finished outline (what the program has to make): dark casing + bright line so it shows on metal and on the background
    c.lineJoin = "round";
    for (const pass of [0, 1]) {
      c.strokeStyle = pass ? "#22d3ee" : "rgba(2,6,23,.9)"; c.lineWidth = pass ? 2.2 : 5;
      for (const sg of [1, -1]) {
        c.beginPath(); this.g.S.pts.forEach((p, i) => { const X = this.sx(p[0]), Y = this.cy - sg * p[1] * k; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.stroke();
        for (const v of this.g.S.voids) { c.beginPath(); const pp = v.tip ? v.pts.concat([v.tip]) : v.pts; pp.forEach((p, i) => { const X = this.sx(p[0]), Y = this.cy - sg * p[1] * k; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.stroke(); }
      }
    }
    // chuck / soft jaws: steel with a serrated face
    for (const sg of [1, -1]) {
      const ys = this.g.jaws.poly.map((p) => this.cy - sg * p[1] * k), y0 = Math.min(...ys), y1 = Math.max(...ys), gr = c.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, "#9aa7b8"); gr.addColorStop(0.45, "#5b6778"); gr.addColorStop(1, "#2b3442");
      c.save(); c.shadowColor = "rgba(0,0,0,.55)"; c.shadowBlur = 10; c.shadowOffsetY = 3;
      c.beginPath(); this.g.jaws.poly.forEach((p, i) => { const X = this.sx(p[0]), Y = this.cy - sg * p[1] * k; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.closePath(); c.fillStyle = gr; c.fill(); c.restore();
      c.strokeStyle = "#0f172a"; c.lineWidth = 1.2; c.stroke();
      c.save(); c.clip(); c.strokeStyle = "rgba(255,255,255,.10)"; c.lineWidth = 1; const xs = this.g.jaws.poly.map((p) => this.sx(p[0])), xa = Math.min(...xs), xb = Math.max(...xs); c.beginPath(); for (let X = xa; X < xb; X += 7) { c.moveTo(X, y0); c.lineTo(X, y1); } c.stroke(); c.restore();
    }
    // tool path trail
    c.lineWidth = 1; c.strokeStyle = "rgba(34,197,94,.75)"; c.beginPath(); let pen = false;
    for (const q of this.trail) { const [x, r] = this.xr(q[0], q[1]), X = this.sx(x), Y = this.cy - r * k; if (q[2] && pen) c.lineTo(X, Y); else c.moveTo(X, Y); pen = !!q[2]; } c.stroke();
    // tool and holder, real size (mm x scale), the cutting corner marked
    this.drawTool(c); if (ui && ui.look === "machine") this.drawCoolant(c);
    // chips (drawn larger than life so they can be seen; shape from chipSpec)
    this.drawChips(c);
    c.restore();
    // tool strip: which tool, holder, insert corner, edge in cut, wear
    const m = this.lastM, Z = this.pos[0], X = this.pos[1], t = this.tool && this.g.tools[this.tool], sy0 = HEADH;
    c.fillStyle = "#0e1a30"; c.fillRect(0, sy0, CW - PANEL, STRIP); c.fillStyle = "#1e293b"; c.fillRect(0, sy0 + STRIP - 1, CW - PANEL, 1); c.textBaseline = "alphabetic";
    const ins = t ? (CN.INS[t.ins] || null) : null, hd = t ? (CN.HOLD[t.holder] || null) : null, cs = t ? this.cornerOf(this.tool) : null;
    const moving = m && m.type !== "rapid" && m.type !== "tool" && m.type !== "home";
    let edge = "—"; if (t && moving) { if (t.kind === "drill") edge = "both lips and the chisel edge"; else if (t.kind === "thread") edge = "both flanks of the V"; else if (m.arc) edge = "nose radius (contour)"; else { const dz = Math.abs(m.to[0] - m.from[0]), dr = Math.abs(m.to[1] - m.from[1]) / 2, an = Math.atan2(dr, dz) * 57.3; edge = an < 20 ? "nose + side cutting edge (turning)" : an > 70 ? "nose + end cutting edge (facing)" : "nose radius (taper / chamfer)"; } }
    c.font = "700 14px system-ui, Segoe UI, Arial"; c.fillStyle = "#e2e8f0"; c.fillText(t ? `T${String(this.tool).padStart(2, "0")} · ${t.name}` : "No tool in cut", 14, sy0 + 19);
    c.font = "12.5px ui-monospace, Menlo, Consolas, monospace"; c.fillStyle = "#94a3b8";
    c.fillText(t ? `Holder ${t.holder || ""}${hd ? ` (${hd.w}x${hd.w} mm, ${hd.lead}° lead, length ${hd.L})` : ""}` : "", 14, sy0 + 36);
    c.fillText(t ? (t.kind === "drill" ? `Drill dia ${(2 * t.rd).toFixed(1)} · flute ${t.fl.toFixed(0)} mm · shank ${t.shank} · ${t.collet} collet chuck` : `Insert ${ins ? ins.iso + " · " + cs.nm + " " + cs.corner + " of " + cs.edges + " · nose R" + ins.r : ""}${cs && cs.exhausted ? " · USED UP, replace" : ""}`) : "", 14, sy0 + 53);
    c.fillStyle = "#4ade80"; c.fillText(t ? `In cut: ${edge}` : "", 14, sy0 + 70);
    const gx = CW - PANEL - 262; c.fillStyle = "#64748b"; c.font = "12px system-ui, Segoe UI, Arial"; c.fillText("X dia / Z / rpm", gx, sy0 + 17); c.fillStyle = "#e2e8f0"; c.font = "12.5px ui-monospace, Menlo, Consolas, monospace"; c.fillText(`${X.toFixed(2)} / ${Z.toFixed(2)} / ${this.rpm || 0}`, gx + 96, sy0 + 17);
    if (t && cs) {
      const vb = cs.vb, fr = Math.min(1, cs.frac); c.fillStyle = "#64748b"; c.font = "12px system-ui, Segoe UI, Arial"; c.fillText(`Flank wear VB ${vb.toFixed(3)} / ${CN.VB_LIMIT.toFixed(2)} mm`, gx, sy0 + 34);
      c.fillStyle = "#1e293b"; c.fillRect(gx, sy0 + 40, 240, 8); c.fillStyle = fr < 0.6 ? "#22c55e" : fr < 0.85 ? "#f59e0b" : "#ef4444"; c.fillRect(gx, sy0 + 40, 240 * fr, 8);
      c.fillStyle = "#94a3b8"; c.fillText(`Edge life used ${(fr * 100).toFixed(0)}%${m && m.f && moving ? " · vc " + Math.round((Math.PI * (t.kind === "drill" ? 2 * t.rd : Math.max(X, 4)) * (this.rpm || 0)) / 1000) + " m/min" : ""}`, gx, sy0 + 62);
    }
    // phase (last comment above the current line)
    let ph = ""; for (let q = Math.max(0, this.li); q >= 0; q--) { const ln = this.g.lines[q]; if (/^\(/.test(ln) && !/^\(T\d/.test(ln)) { ph = ln.slice(1, -1); break; } }
    c.save(); c.beginPath(); c.rect(0, HEADH + STRIP, CW - PANEL, 120); c.clip();
    if (ph) { c.fillStyle = "#38bdf8"; c.font = "600 15px system-ui, Segoe UI, Arial"; c.fillText(ph, 18, HEADH + STRIP + 24); }
    c.fillStyle = "#94a3b8"; c.font = "12.5px system-ui, Segoe UI, Arial"; if (this.chipTxt) c.fillText("Chip: " + this.chipTxt, 18, HEADH + STRIP + 44);
    if (this.g.warn && this.g.warn.length) { c.fillStyle = "#fbbf24"; c.fillText("⚠ " + this.g.warn[0].slice(0, 118), 18, HEADH + STRIP + 64); }
    c.restore();
    c.font = "12px system-ui, Segoe UI, Arial"; c.fillStyle = "#94a3b8";
    const lg = [["#22d3ee", "required shape (finished outline)"], ["#38bdf8", "chuck / soft jaws"], ["#22c55e", "tool path"], ["#f59e0b", "stock left uncut"], ["#e5e7eb", "chips (enlarged)"]];
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
    c.textAlign = "right"; c.fillStyle = "#94a3b8"; c.fillText(`${this.removedMm3().toFixed(0)} mm³ removed ≈ ${(this.removedMm3() * ({ ALUMINIUM: 2.7, BRASS: 8.5, STAINLESS: 7.9 }[this.g.cd.name] || 7.85) / 1000).toFixed(1)} g of chips`, CW - PANEL - 14, fy + 44); c.textAlign = "left";
    if (ui && ui.msg) { c.fillStyle = "#fbbf24"; c.textAlign = "center"; c.fillText(ui.msg, (CW - PANEL) / 2, fy + 44); c.textAlign = "left"; }
    if (ui && ui.page === "life") { this.drawLife(c); return; }
    // result card at the end
    if (this.done && this.stats) {
      const st = this.stats, ok = st.maxRes < 3 * this.cs + 0.05, w = 470, h = 78 + Math.min(5, st.checks.length) * 18 + (st.regions || []).length * 18, x0 = 24, y0 = HEADH + STRIP + 110;
      c.fillStyle = "rgba(2,6,23,.92)"; c.fillRect(x0, y0, w, h); c.strokeStyle = ok ? "#22c55e" : "#f59e0b"; c.lineWidth = 2; c.strokeRect(x0, y0, w, h);
      c.fillStyle = ok ? "#4ade80" : "#fbbf24"; c.font = "600 15px system-ui, Segoe UI, Arial"; c.fillText(ok ? "Machining complete — required shape reached" : "Machining complete — some stock is left", x0 + 14, y0 + 24);
      c.font = "13px ui-monospace, Menlo, Consolas, monospace"; c.fillStyle = "#e2e8f0"; c.fillText(`Stock left above the finished outline: max ${st.maxRes.toFixed(2)} mm`, x0 + 14, y0 + 46);
      c.fillText(`Cycle time ${mmss(st.time)} · ${st.lines} program blocks`, x0 + 14, y0 + 64);
      (st.regions || []).forEach((q, i) => { c.fillStyle = "#fbbf24"; c.fillText(`NOT MACHINED: ${q.txt}`, x0 + 14, y0 + 84 + i * 18); });
      st.checks.slice(0, 5).forEach((q, i) => { c.fillStyle = q.ok ? "#4ade80" : "#fbbf24"; c.fillText(`${q.ok ? "✓" : "!"} #${q.no} ${q.spec.slice(0, 22)} → Ø${q.dia.toFixed(2)}`, x0 + 14, y0 + 84 + ((st.regions || []).length + i) * 18); });
    }
  };

  /** full-screen tool-life page (also drawn on the recorded canvas) */
  Sim.prototype.drawLife = function (c) {
    const L = this.getLife(), x0 = 14, W = CW - 28, top = HEADH + 6;
    c.fillStyle = "#0b1220"; c.fillRect(0, HEADH, CW, CH - HEADH - FOOT);
    c.textBaseline = "alphabetic"; c.fillStyle = "#e2e8f0"; c.font = "700 17px system-ui, Segoe UI, Arial"; c.fillText(`TOOL LIFE PREDICTION · ${this.g.name} · ${this.g.cd.name} · one part per cycle`, x0, top + 24);
    const cols = [["Tool / holder / insert", 14], ["Cut s", 470], ["vc", 530], ["f", 590], ["ap", 645], ["Life / edge", 700], ["Parts / edge", 800], ["Edges", 895], ["Parts / tool", 995]];
    c.font = "600 12px system-ui, Segoe UI, Arial"; c.fillStyle = "#64748b"; cols.forEach((q) => c.fillText(q[0], q[1], top + 52));
    c.fillStyle = "#1e293b"; c.fillRect(x0, top + 58, W, 1);
    const f1 = (v, d) => (v >= 1000 ? Math.round(v).toLocaleString("en-US") : v.toFixed(d));
    L.forEach((q, i) => {
      const y = top + 80 + i * 40; c.font = "600 13px system-ui, Segoe UI, Arial"; c.fillStyle = "#e2e8f0"; c.fillText(`T${String(q.tool).padStart(2, "0")} ${q.name}`.slice(0, 62), 14, y);
      c.font = "12px ui-monospace, Menlo, Consolas, monospace"; c.fillStyle = "#94a3b8"; c.fillText(`${q.holder} · ${q.iso || q.ins}`.slice(0, 66), 14, y + 16);
      c.font = "13px ui-monospace, Menlo, Consolas, monospace"; c.fillStyle = "#cbd5e1";
      c.fillText(q.cutS.toFixed(0), 470, y); c.fillText(q.vc.toFixed(0), 530, y); c.fillText(q.f.toFixed(2), 590, y); c.fillText(q.ap.toFixed(2), 645, y);
      c.fillStyle = "#4ade80"; c.fillText(q.edgeMin.toFixed(1) + " min", 700, y); c.fillText(f1(q.partsEdge, 0), 800, y); c.fillStyle = "#cbd5e1"; c.fillText(`${q.edges} ${q.edgeWord}`, 895, y); c.fillStyle = "#fbbf24"; c.fillText(f1(q.partsTool, 0) + " parts", 995, y);
    });
    // wear curves of the first edge: VB against parts made
    const cx0 = 60, cy0 = top + 80 + L.length * 40 + 24, cw = 760, ch = CH - FOOT - cy0 - 80, maxP = Math.max(10, ...L.map((q) => q.partsEdge)) * 1.08, cols2 = ["#22c55e", "#38bdf8", "#f59e0b", "#e879f9", "#f87171"];
    c.strokeStyle = "#334155"; c.lineWidth = 1; c.strokeRect(cx0, cy0, cw, ch);
    c.fillStyle = "#64748b"; c.font = "11px system-ui, Segoe UI, Arial"; c.fillText("Flank wear VB (mm) of one edge against parts made", cx0, cy0 - 20);
    const ylim = CN.VB_LIMIT * 1.15, Y = (v) => cy0 + ch - (v / ylim) * ch, Xp = (p) => cx0 + (p / maxP) * cw;
    c.strokeStyle = "#ef4444"; c.setLineDash([6, 4]); c.beginPath(); c.moveTo(cx0, Y(CN.VB_LIMIT)); c.lineTo(cx0 + cw, Y(CN.VB_LIMIT)); c.stroke(); c.setLineDash([]); c.fillStyle = "#ef4444"; c.fillText("wear limit 0.30 mm", cx0 + cw - 100, Y(CN.VB_LIMIT) - 4);
    L.forEach((q, i) => { c.strokeStyle = cols2[i % 5]; c.lineWidth = 2; c.beginPath(); for (let p = 0; p <= 60; p++) { const pp = (p / 60) * q.partsEdge * 1.1, vb = vbOf(pp / q.partsEdge); const xx = Xp(pp), yy = Y(Math.min(vb, ylim)); p ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke(); c.fillStyle = cols2[i % 5]; c.font = "12px system-ui, Segoe UI, Arial"; c.fillText(`T${String(q.tool).padStart(2, "0")}`, Xp(Math.min(maxP, q.partsEdge * 1.1)) - 26, Y(Math.min(vbOf(1.1), ylim)) + 14); });
    c.fillStyle = "#64748b"; c.font = "11px system-ui, Segoe UI, Arial"; for (let g = 0; g <= 4; g++) { const pv = (maxP * g) / 4; c.fillText(Math.round(pv).toLocaleString("en-US"), Xp(pv) - 8, cy0 + ch + 14); } c.fillText("parts made on one edge", cx0 + cw / 2 - 50, cy0 + ch + 27);
    // plan text on the right
    const px = cx0 + cw + 24; c.fillStyle = "#e2e8f0"; c.font = "600 13px system-ui, Segoe UI, Arial"; c.fillText("Indexing plan", px, cy0 + 12);
    c.font = "12px system-ui, Segoe UI, Arial"; c.fillStyle = "#cbd5e1"; let yy = cy0 + 32;
    L.forEach((q) => { const t = this.g.tools[q.tool]; c.fillStyle = "#cbd5e1"; c.fillText(`T${String(q.tool).padStart(2, "0")}: ${t.kind === "drill" ? "re-grind" : "index to the next corner"} every ${Math.max(1, Math.floor(q.partsEdge))} parts`, px, yy); yy += 16; c.fillStyle = "#94a3b8"; c.fillText(`   whole tool about ${Math.floor(q.partsTool).toLocaleString("en-US")} parts`, px, yy); yy += 20; });
    // standard tools or CUSTOM: every dimension of this operation
    yy += 6; c.fillStyle = "#e2e8f0"; c.font = "600 13px system-ui, Segoe UI, Arial"; c.fillText("Standard tool check", px, yy); yy += 18; c.font = "12px system-ui, Segoe UI, Arial";
    (this.g.checks || []).forEach((k) => {
      c.fillStyle = "#cbd5e1"; c.fillText(k.thread ? `${k.label}: thread pitch ${k.pitch}` : `${k.label}: dia ${k.dia.toFixed(2)} ±${(k.band / 2).toFixed(2)} (IT${k.g})`, px, yy); yy += 15;
      k.steps.forEach((q) => { c.fillStyle = q.std ? "#4ade80" : "#f59e0b"; c.fillText(`   ${q.std ? "STANDARD" : "CUSTOM  "}  ${q.tool}`, px, yy); yy += 15; if (!q.std && q.why) { c.fillStyle = "#94a3b8"; c.fillText(`      ${q.why}`.slice(0, 64), px, yy); yy += 15; } });
      if (k.note) { c.fillStyle = "#94a3b8"; c.fillText(("   " + k.note).slice(0, 66), px, yy); yy += 15; }
    });
    c.fillStyle = "#64748b"; c.font = "11px system-ui, Segoe UI, Arial"; c.fillText("Estimate from the Taylor tool-life equation with typical constants for coated carbide.", x0, CH - FOOT - 22); c.fillText("Calibrate with your own tool-life records; if a tool is also used in another operation, the lives add up.", x0, CH - FOOT - 8);
  };
  /** MACHINE VIEW: the part looks like a round bar turning in the machine (cylinder lighting, rotation shimmer), with coolant on the cut.
      It is a computer drawing, not camera footage. */
  Sim.prototype.drawMachineBg = function (c) {
    const y0 = HEADH + STRIP, y1 = CH - FOOT, w = CW - PANEL;
    let g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, "#2a3340"); g.addColorStop(0.5, "#3b4656"); g.addColorStop(1, "#1d242e"); c.fillStyle = g; c.fillRect(0, y0, w, y1 - y0);
    c.fillStyle = "rgba(255,255,255,.035)"; for (let x = 0; x < w; x += 46) c.fillRect(x, y0, 2, y1 - y0);   // panel joints of the enclosure
    g = c.createRadialGradient(w * 0.45, y0 + 40, 10, w * 0.45, y0 + 40, w * 0.7); g.addColorStop(0, "rgba(255,244,214,.22)"); g.addColorStop(1, "rgba(255,244,214,0)"); c.fillStyle = g; c.fillRect(0, y0, w, y1 - y0);   // work lamp
    c.fillStyle = "#18202b"; c.fillRect(0, y1 - 46, w, 46); c.fillStyle = "rgba(255,255,255,.08)"; c.fillRect(0, y1 - 46, w, 2);   // slideway cover
    c.fillStyle = "rgba(255,255,255,.05)"; for (let x = 0; x < w; x += 18) c.fillRect(x, y1 - 44, 8, 40);
  };
  Sim.prototype.drawMachineBody = function (c, dx, dw, dh) {
    const W = Math.ceil(dw), H = Math.ceil(dh * 2); if (!W || !H) return;
    if (!this.shd || this.shd.width !== W || this.shd.height !== H) { this.shd = document.createElement("canvas"); this.shd.width = W; this.shd.height = H; }
    const t = this.shd.getContext("2d"); t.clearRect(0, 0, W, H); t.globalCompositeOperation = "source-over";
    t.drawImage(this.off, 0, 0, W, dh); t.save(); t.translate(0, H); t.scale(1, -1); t.drawImage(this.off, 0, 0, W, dh); t.restore();
    t.globalCompositeOperation = "source-atop";
    const g = t.createLinearGradient(0, 0, 0, H);   // round bar: dark edges, bright band above the centre line, soft reflection below
    g.addColorStop(0, "rgba(0,0,0,.62)"); g.addColorStop(0.2, "rgba(255,255,255,.10)"); g.addColorStop(0.36, "rgba(255,255,255,.42)"); g.addColorStop(0.46, "rgba(255,255,255,.06)"); g.addColorStop(0.62, "rgba(0,0,0,.12)"); g.addColorStop(0.8, "rgba(255,255,255,.12)"); g.addColorStop(1, "rgba(0,0,0,.66)");
    t.fillStyle = g; t.fillRect(0, 0, W, H);
    const spin = this.t * 14;   // shimmer lines along the axis: the surface is turning
    for (let i = 0; i < 26; i++) { const y = ((i * 37.1 + spin * (3 + (i % 5))) % H + H) % H; t.fillStyle = `rgba(255,255,255,${0.05 + 0.07 * ((i * 7) % 3) / 2})`; t.fillRect(0, y, W, 1.2); }
    t.globalCompositeOperation = "source-over";
    c.save(); c.shadowColor = "rgba(0,0,0,.6)"; c.shadowBlur = 16; c.shadowOffsetY = 8; c.drawImage(this.shd, dx, this.cy - dh, W, H); c.restore();
  };
  Sim.prototype.drawCoolant = function (c) {
    const m = this.lastM; if (!m || m.type === "rapid" || m.type === "tool" || m.type === "home" || this.done) return;
    const [x, r] = this.xr(this.pos[0], this.pos[1]), tx = this.sx(x), ty = this.cy - r * this.k, nx = tx + this.sf * 150, ny = ty - 170;
    c.save(); c.lineCap = "round";
    for (let i = 0; i < 26; i++) {
      const s = Math.random(), px = nx + (tx - nx) * s + (Math.random() - 0.5) * 7 * s, py = ny + (ty - ny) * s + 90 * s * (1 - s) * 0.0 + (Math.random() - 0.5) * 7 * s;
      c.strokeStyle = `rgba(186,230,253,${0.2 + 0.5 * Math.random()})`; c.lineWidth = 1 + 2 * Math.random(); c.beginPath(); c.moveTo(px, py); c.lineTo(px + (tx - nx) * 0.03, py + (ty - ny) * 0.03); c.stroke();
    }
    c.fillStyle = "#9aa7b8"; c.fillRect(nx - 5, ny - 28, 10, 26); c.fillStyle = "#475569"; c.fillRect(nx - 3, ny - 2, 6, 6);   // coolant nozzle
    for (let i = 0; i < 12; i++) { c.fillStyle = `rgba(224,242,254,${0.15 + 0.4 * Math.random()})`; c.beginPath(); c.arc(tx + (Math.random() - 0.5) * 34, ty + (Math.random() - 0.7) * 22, 1 + 2 * Math.random(), 0, 7); c.fill(); }
    c.restore();
  };
  Sim.prototype.removedMm3 = function () { return this.vol || 0; };
  void 0;

  /* ================================================================ the screen: player, program download, video recording ================================================================ */
  const download = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); };
  const safe = (s) => String(s || "part").replace(/[^A-Za-z0-9._-]+/g, "_");

  CN.player = (cx, ranks, onClose) => {
    const ov = document.createElement("div"); ov.id = "cncOv";
    ov.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.95);display:flex;flex-direction:column;align-items:center;padding:6px 10px;gap:6px;font:14px system-ui,Segoe UI,Arial;color:#e2e8f0";
    const btn = "background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:7px;padding:5px 10px;cursor:pointer;font:600 12px system-ui,Segoe UI,Arial;width:auto;flex:0 0 auto";
    ov.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;max-width:1280px">
      <select id="cnOp" style="${btn};max-width:300px"></select>
      <button id="cnPlay" style="${btn};background:#15803d;border-color:#16a34a">▶ Play</button><button id="cnRe" style="${btn}">⟲ Restart</button>
      <select id="cnSp" style="${btn};max-width:190px"><option value="120">Slow (about 2 min)</option><option value="60" selected>Normal (about 1 min)</option><option value="30">Fast (about 30 s)</option><option value="15">Very fast (about 15 s)</option></select>
      <button id="cnLook" style="${btn}">🎥 Machine view</button><button id="cnLife" style="${btn}">⏱ Tool life</button><label style="color:#94a3b8;font-size:12px">Parts already made on these inserts <input id="cnParts" type="number" min="0" value="0" style="width:70px;background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:4px"></label><button id="cnRec" style="${btn};background:#b91c1c;border-color:#dc2626">⏺ Record video</button><button id="cnNc" style="${btn}">⬇ Program (.nc)</button><button id="cnX" style="${btn}">✕ Close</button></div>
      <canvas id="cnCv" width="${CW}" height="${CH}" style="width:min(100%,calc((100vh - 70px) * 16 / 9));height:auto;border-radius:10px;border:1px solid #1e293b;background:#0b1220"></canvas>
      <div id="cnNote" style="color:#94a3b8;font-size:12px;max-width:1280px;text-align:center">Draft program made from the stage drawing. The program on the right is the one that is simulated. Check feeds, speeds, tools and tool-nose compensation on your machine before production.</div>`;
    document.body.appendChild(ov);
    const $ = (id) => ov.querySelector("#" + id), cv = $("cnCv"), c = cv.getContext("2d"); let sim = null, g = null, playing = false, last = 0, raf = 0, rec = null, doneAt = 0, ui = {};
    ranks.forEach((r) => { const o = document.createElement("option"); o.value = r.rank; o.textContent = `OP ${r.op.opNo} · ${r.op.name}`; $("cnOp").appendChild(o); });
    const load = (rank) => { g = CN.gen(cx, rank); sim = new Sim(g, cx); sim.partsDone = +$("cnParts").value || 0; setTimeout(() => { try { if (sim) sim.getLife(); } catch (e) { /* ignore */ } }, 60); playing = false; $("cnPlay").textContent = "▶ Play"; doneAt = 0; ui = { look: ui.look }; $("cnLife").textContent = "⏱ Tool life"; };
    const speed = () => Math.max(1, sim.total / (+$("cnSp").value || 60));
    const frame = (ts) => {
      raf = requestAnimationFrame(frame); const dt = Math.min(0.1, (ts - last) / 1000 || 0); last = ts;
      if (playing && sim && !sim.done) sim.advance(dt * speed());
      if (sim && sim.done && playing) { playing = false; $("cnPlay").textContent = "▶ Play again"; doneAt = ts; }
      if (rec && sim && sim.done && ts - doneAt > 2800 && rec.state === "recording") { try { rec.stop(); } catch (e) { /* already stopped */ } }
      if (sim) sim.draw(c, ui);
    };
    $("cnLook").onclick = () => { ui.look = ui.look === "machine" ? "" : "machine"; $("cnLook").textContent = ui.look === "machine" ? "◀ Drawing view" : "🎥 Machine view"; };
    $("cnLife").onclick = () => { ui.page = ui.page === "life" ? "" : "life"; $("cnLife").textContent = ui.page === "life" ? "◀ Back to simulation" : "⏱ Tool life"; };
    $("cnParts").onchange = () => { if (sim) sim.partsDone = Math.max(0, +$("cnParts").value || 0); };
    $("cnOp").onchange = () => { if (rec) return; load(+$("cnOp").value); };
    $("cnPlay").onclick = () => { if (!sim) return; if (sim.done) { sim.reset(); } playing = !playing; $("cnPlay").textContent = playing ? "⏸ Pause" : "▶ Play"; };
    $("cnRe").onclick = () => { if (rec) return; sim.reset(); playing = false; $("cnPlay").textContent = "▶ Play"; };
    $("cnNc").onclick = () => download(new Blob([g.lines.join("\r\n") + "\r\n"], { type: "text/plain" }), `${g.name}_${safe(cx.P.part_no)}.nc`);
    $("cnRec").onclick = () => {
      if (rec) return; if (!cv.captureStream || !window.MediaRecorder) { $("cnNote").textContent = "This browser cannot record video. Use Chrome or Edge."; return; }
      const types = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"], mt = types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
      const ext = /mp4/.test(mt) ? "mp4" : "webm", chunks = [];
      sim.reset(); playing = true; $("cnPlay").textContent = "⏸ Pause"; $("cnRec").textContent = "⏺ Recording… (saves when the run ends)"; $("cnRec").style.background = "#f59e0b"; ui.msg = "";
      try { rec = new MediaRecorder(cv.captureStream(30), mt ? { mimeType: mt, videoBitsPerSecond: 6000000 } : {}); } catch (e) { rec = null; $("cnNote").textContent = "Video recording is not available here: " + e.message; return; }
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        const name = `${safe(cx.P.part_no)}_OP${g.op.opNo}_CNC-simulation.${ext}`;
        rec = null; ui.msg = ""; $("cnRec").textContent = "⏺ Record video"; $("cnRec").style.background = "#b91c1c";   // button goes back first, whatever happens to the download
        try { download(new Blob(chunks, { type: mt || "video/webm" }), name); $("cnNote").textContent = `Video saved: ${name}`; } catch (e) { $("cnNote").textContent = "The video was recorded but could not be saved: " + e.message; }
      };
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
