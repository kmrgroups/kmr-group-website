/* MSA engine - measurement system analysis after AIAG MSA (4th ed.): Gage R&R (average & range, and ANOVA), bias, linearity,
   stability (uses SPCCalc charts) and attribute agreement (kappa, effectiveness, miss rate, false alarm rate). Pure functions; tested by scripts/test-spc-msa.js. */
(function (root) {
  "use strict";
  const S = typeof require !== "undefined" && typeof module !== "undefined" ? require("./spc-calc.js") : root.SPCCalc;
  const { mean, sd, sum, lgamma } = S;
  const num = (v) => (v === "" || v == null ? NaN : Number(v));
  /* ---- distributions ---- */
  function betacf(a, b, x) {
    const MAXIT = 300, EPS = 3e-14, FPMIN = 1e-300; let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  function ibeta(x, a, b) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
  const fCdf = (f, d1, d2) => (f <= 0 ? 0 : ibeta(d1 * f / (d1 * f + d2), d1 / 2, d2 / 2));
  const tTwoSided = (t, df) => ibeta(df / (df + t * t), df / 2, 0.5);                  // P(|T| > t)
  function tInv(p, df) { let lo = 0, hi = 200; for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (1 - tTwoSided(m, df) / 2 < p) lo = m; else hi = m; } return (lo + hi) / 2; }   // upper quantile, p e.g. 0.975
  /* ---- Gage R&R ----
     data[a][p][t]: appraiser a, part p, trial t (rectangular, all numbers). opts: tol (USL-LSL), k (6 or 5.15), */
  const K1 = { 2: 0.8862, 3: 0.5908, 4: 0.4857, 5: 0.4299 }, K2 = { 2: 0.7071, 3: 0.5231, 4: 0.4467, 5: 0.4030 }, K3 = { 2: 0.7071, 3: 0.5231, 4: 0.4467, 5: 0.4030, 6: 0.3742, 7: 0.3534, 8: 0.3375, 9: 0.3249, 10: 0.3146, 11: 0.3069, 12: 0.2998, 13: 0.2935, 14: 0.2880, 15: 0.2831 };
  const D4 = { 2: 3.267, 3: 2.574, 4: 2.282, 5: 2.114 };
  const shape = (d) => { const A = d.length, P = A ? d[0].length : 0, T = P ? d[0][0].length : 0; for (const a of d) { if (a.length !== P) return null; for (const p of a) { if (p.length !== T) return null; for (const v of p) if (!Number.isFinite(v)) return null; } } return { A, P, T }; };
  const decide = (g, t) => { const w = t != null ? Math.max(g, t) : g; return w < 10 ? "Acceptable" : w <= 30 ? "Conditional" : "Not acceptable"; };
  function grrRange(d, o) {
    o = o || {}; const sh = shape(d); if (!sh) return null; const { A, P, T } = sh, k = o.k || 6, tol = num(o.tol);
    if (T < 2 || T > 5 || A < 2 || A > 5 || P < 2 || P > 15) return { error: "Needs 2–5 appraisers, 2–15 parts and 2–5 trials." };
    const rg = (a) => Math.max(...a) - Math.min(...a), Rb = d.map((a) => mean(a.map(rg))), Rbb = mean(Rb), aMean = d.map((a) => mean(a.flat())), xd = Math.max(...aMean) - Math.min(...aMean);
    const pMean = Array.from({ length: P }, (_, j) => mean(d.flatMap((a) => a[j]))), Rp = Math.max(...pMean) - Math.min(...pMean);
    const EV = Rbb * K1[T], AV = Math.sqrt(Math.max((xd * K2[A]) ** 2 - EV ** 2 / (P * T), 0)), GRR = Math.hypot(EV, AV), PV = Rp * K3[P], TV = Math.hypot(GRR, PV);
    const pg = GRR / TV * 100, pt = tol > 0 ? k * GRR / tol * 100 : null;
    return { method: "range", A, P, T, k, EV, AV, GRR, PV, TV, pctEV: EV / TV * 100, pctAV: AV / TV * 100, pctGRR: pg, pctPV: PV / TV * 100, pctTol: pt, ndc: Math.max(1, Math.floor(1.41 * PV / GRR)), decision: decide(pg, pt),
      Rbar: Rbb, UCLR: D4[T] * Rbb, maxRange: Math.max(...d.flatMap((a) => a.map(rg))), appraiserMeans: aMean, partMeans: pMean, rangesByAppraiser: Rb };
  }
  function grrAnova(d, o) {
    o = o || {}; const sh = shape(d); if (!sh) return null; const { A, P, T } = sh, k = o.k || 6, tol = num(o.tol);
    if (T < 2 || A < 2 || P < 2) return { error: "Needs at least 2 appraisers, 2 parts and 2 trials." };
    const all = d.flat(2), gm = mean(all), cell = d.map((a) => a.map((p) => mean(p))), aM = d.map((a) => mean(a.flat())), pM = Array.from({ length: P }, (_, j) => mean(d.flatMap((a) => a[j])));
    const SSP = A * T * sum(pM.map((m) => (m - gm) ** 2)), SSA = P * T * sum(aM.map((m) => (m - gm) ** 2));
    let SSAP = 0, SSE = 0; for (let i = 0; i < A; i++) for (let j = 0; j < P; j++) { SSAP += T * (cell[i][j] - aM[i] - pM[j] + gm) ** 2; for (const v of d[i][j]) SSE += (v - cell[i][j]) ** 2; }
    const dfP = P - 1, dfA = A - 1, dfAP = dfP * dfA, dfE = A * P * (T - 1), MSP = SSP / dfP, MSA = SSA / dfA, MSAP = SSAP / dfAP, MSE = dfE ? SSE / dfE : 0;
    const Fap = MSE > 0 ? MSAP / MSE : Infinity, pAP = MSE > 0 ? 1 - fCdf(Fap, dfAP, dfE) : 0, pooled = pAP > 0.25;
    const MSEp = pooled ? (SSAP + SSE) / (dfAP + dfE) : MSE;
    const vE = MSEp, vAP = pooled ? 0 : Math.max(0, (MSAP - MSE) / T), vA = Math.max(0, (MSA - (pooled ? MSEp : MSAP)) / (P * T)), vP = Math.max(0, (MSP - (pooled ? MSEp : MSAP)) / (A * T));
    const vR = vA + vAP, vG = vE + vR, vT = vG + vP, s = Math.sqrt, pct = (v) => (vT > 0 ? v / vT * 100 : 0), sv = (v) => (vT > 0 ? s(v / vT) * 100 : 0);
    const ndc = vG > 0 ? Math.max(1, Math.floor(1.41 * s(vP) / s(vG))) : null, pg = sv(vG), pt = tol > 0 ? k * s(vG) / tol * 100 : null;
    const row = (name, ss, df, ms, f, p) => ({ name, ss, df, ms, f, p });
    return { method: "anova", A, P, T, k, pooled, pInteraction: pAP, fInteraction: Fap,
      table: [row("Part", SSP, dfP, MSP, MSAP > 0 ? MSP / MSAP : null, MSAP > 0 ? 1 - fCdf(MSP / MSAP, dfP, dfAP) : null), row("Appraiser", SSA, dfA, MSA, MSAP > 0 ? MSA / MSAP : null, MSAP > 0 ? 1 - fCdf(MSA / MSAP, dfA, dfAP) : null),
        row("Appraiser × Part", SSAP, dfAP, MSAP, Fap, pAP), row("Repeatability (error)", SSE, dfE, MSE, null, null), row("Total", SSP + SSA + SSAP + SSE, A * P * T - 1, null, null, null)],
      var: { repeat: vE, reprod: vR, appraiser: vA, interaction: vAP, grr: vG, part: vP, total: vT },
      sd: { repeat: s(vE), reprod: s(vR), grr: s(vG), part: s(vP), total: s(vT) },
      pctContribution: { repeat: pct(vE), reprod: pct(vR), grr: pct(vG), part: pct(vP) }, pctStudyVar: { repeat: sv(vE), reprod: sv(vR), grr: pg, part: sv(vP) },
      pctTol: pt, ndc, pctGRR: pg, decision: decide(pg, pt) };
  }
  /* ---- Bias (independent sample method): readings of one master part, reference value known ---- */
  function bias(readings, ref, o) {
    o = o || {}; const X = readings.map(num).filter(Number.isFinite), n = X.length, r = num(ref), tol = num(o.tol); if (n < 2 || !Number.isFinite(r)) return null;
    const m = mean(X), s = sd(X), se = s / Math.sqrt(n), b = m - r, df = n - 1, t = se > 0 ? b / se : 0, p = se > 0 ? tTwoSided(Math.abs(t), df) : (b === 0 ? 1 : 0), q = tInv(0.975, df), lo = b - q * se, hi = b + q * se;
    const zeroIn = lo <= 0 && hi >= 0;
    return { n, mean: m, ref: r, bias: b, sd: s, se, t, df, p, lo, hi, zeroInside: zeroIn, pctTol: tol > 0 ? Math.abs(b) / tol * 100 : null, decision: zeroIn ? "Acceptable" : "Bias is significant" };
  }
  /* ---- Linearity: rows [{ref, readings:[...]}], each reference part measured m times ---- */
  function linearity(rows, o) {
    o = o || {}; const k = o.k || 6, tol = num(o.tol), pts = [], parts = [];
    rows.forEach((r) => { const ref = num(r.ref), X = (r.readings || []).map(num).filter(Number.isFinite); if (!Number.isFinite(ref) || !X.length) return; X.forEach((v) => pts.push({ x: ref, y: v - ref })); parts.push({ ref, n: X.length, mean: mean(X), bias: mean(X) - ref, sd: sd(X) }); });
    if (parts.length < 3 || pts.length < 6) return { error: "Needs at least 3 reference parts and 6 readings." };
    const n = pts.length, mx = mean(pts.map((p) => p.x)), my = mean(pts.map((p) => p.y)), sxx = sum(pts.map((p) => (p.x - mx) ** 2)), sxy = sum(pts.map((p) => (p.x - mx) * (p.y - my)));
    if (!(sxx > 0)) return { error: "The reference values must differ." };
    const slope = sxy / sxx, icpt = my - slope * mx, res = pts.map((p) => p.y - (icpt + slope * p.x)), sse = sum(res.map((e) => e * e)), df = n - 2, s2 = df > 0 ? sse / df : 0, se = Math.sqrt(s2);
    const seSlope = se / Math.sqrt(sxx), seInt = se * Math.sqrt(1 / n + mx * mx / sxx), sst = sum(pts.map((p) => (p.y - my) ** 2)), r2 = sst > 0 ? 1 - sse / sst : 1;
    const pSlope = seSlope > 0 ? tTwoSided(Math.abs(slope / seSlope), df) : (slope === 0 ? 1 : 0), pInt = seInt > 0 ? tTwoSided(Math.abs(icpt / seInt), df) : (icpt === 0 ? 1 : 0);
    const pv = num(o.processVariation) > 0 ? num(o.processVariation) : (tol > 0 ? tol : null);   // process variation (6 sigma of the process) or tolerance
    const lin = pv ? Math.abs(slope) * pv : null, ok = pSlope > 0.05 && pInt > 0.05;
    return { n, parts, slope, intercept: icpt, r2, se, seSlope, seIntercept: seInt, pSlope, pIntercept: pInt, linearity: lin, pctLinearity: Math.abs(slope) * 100, avgBias: mean(parts.map((p) => Math.abs(p.bias))), decision: ok ? "Acceptable" : "Linearity or bias is significant", ok, pv };
  }
  /* ---- Attribute agreement: data[a][p][t] = 1 (accept / good) or 0 (reject / bad); ref[p] = 1 | 0 | null ---- */
  function kappa(x, y) { const n = x.length; if (!n) return null; const cats = [...new Set(x.concat(y))]; const po = x.filter((v, i) => v === y[i]).length / n; let pe = 0; cats.forEach((c) => { pe += (x.filter((v) => v === c).length / n) * (y.filter((v) => v === c).length / n); }); return pe >= 1 ? 1 : (po - pe) / (1 - pe); }
  function attribute(d, ref) {
    const A = d.length, P = A ? d[0].length : 0, T = P ? d[0][0].length : 0; if (A < 2 || P < 2 || T < 1) return { error: "Needs at least 2 appraisers, 2 parts and 1 trial." };
    const hasRef = ref && ref.length === P && ref.every((v) => v === 0 || v === 1), out = { A, P, T, hasRef };
    const within = d.map((a) => a.filter((p) => p.every((v) => v === p[0])).length / P * 100);
    const consensus = Array.from({ length: P }, (_, j) => { const all = d.flatMap((a) => a[j]); return all.every((v) => v === all[0]) ? all[0] : null; });
    out.within = within; out.allAgree = consensus.filter((v) => v != null).length / P * 100;
    const first = d.map((a) => a.map((p) => p[0])), pairs = [];
    for (let i = 0; i < A; i++) for (let j = i + 1; j < A; j++) pairs.push({ a: i, b: j, kappa: kappa(first[i], first[j]) });
    out.kappaPairs = pairs;
    if (hasRef) {
      const opp = (a, t) => ref.map((r, j) => [d[a][j][t], r]);
      out.vsRef = d.map((a, i) => { let ok = 0, tot = 0, miss = 0, bad = 0, fa = 0, good = 0; a.forEach((p, j) => p.forEach((v) => { tot++; if (v === ref[j]) ok++; if (ref[j] === 0) { bad++; if (v === 1) miss++; } else { good++; if (v === 0) fa++; } })); return { effectiveness: ok / tot * 100, miss: bad ? miss / bad * 100 : null, falseAlarm: good ? fa / good * 100 : null }; });
      out.kappaRef = d.map((a, i) => kappa(a.map((p) => p[0]), ref));
      out.allVsRef = ref.filter((r, j) => d.every((a) => a[j].every((v) => v === r))).length / P * 100;
      out.effectiveness = mean(out.vsRef.map((v) => v.effectiveness));
      const ms = out.vsRef.map((v) => v.miss).filter((v) => v != null), fs = out.vsRef.map((v) => v.falseAlarm).filter((v) => v != null);
      out.miss = ms.length ? mean(ms) : null; out.falseAlarm = fs.length ? mean(fs) : null;
      const e = out.effectiveness, m = out.miss == null ? 0 : out.miss, f = out.falseAlarm == null ? 0 : out.falseAlarm;
      out.decision = e >= 90 && m <= 2 && f <= 5 ? "Acceptable" : e >= 80 && m <= 5 && f <= 10 ? "Conditional" : "Not acceptable";
    } else { const k = mean(pairs.map((p) => p.kappa)); out.decision = k >= 0.75 ? "Acceptable" : k >= 0.4 ? "Conditional" : "Not acceptable"; }
    return out;
  }
  const api = { grrRange, grrAnova, bias, linearity, attribute, kappa, fCdf, ibeta, tTwoSided, tInv, decide, K1, K2, K3, D4 };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.MSACalc = api;
})(typeof window !== "undefined" ? window : globalThis);
