/* SPC engine - control charts (X̄-R, X̄-S, I-MR, p, np, c, u), run rules and process capability.
   Used by SPC Charts (spc.html) and by the stability study of MSA Studies. Pure functions, no screen code; tested by scripts/test-spc-msa.js.
   Constants and rules follow AIAG SPC (2nd ed.) and the Western Electric / Nelson tests; limits are 3 sigma. */
(function (root) {
  "use strict";
  const D2 = [0, 0, 1.128, 1.693, 2.059, 2.326, 2.534, 2.704, 2.847, 2.970, 3.078, 3.173, 3.258, 3.336, 3.407, 3.472, 3.532, 3.588, 3.640, 3.689, 3.735, 3.778, 3.819, 3.858, 3.895, 3.931];
  const D3C = [0, 0, 0.853, 0.888, 0.880, 0.864, 0.848, 0.833, 0.820, 0.808, 0.797, 0.787, 0.778, 0.770, 0.763, 0.756, 0.750, 0.744, 0.739, 0.734, 0.729, 0.724, 0.720, 0.716, 0.712, 0.708];
  const sum = (a) => a.reduce((x, y) => x + y, 0), mean = (a) => (a.length ? sum(a) / a.length : NaN);
  const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(sum(a.map((v) => (v - m) ** 2)) / (a.length - 1)); };
  const rng = (a) => Math.max(...a) - Math.min(...a);
  function lgamma(x) { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const k of c) s += k / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
  function ncdf(z) { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989422804014327 * Math.exp(-z * z / 2), p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))); return z > 0 ? 1 - p : p; }
  function ninv(p) { let lo = -9, hi = 9; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (ncdf(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; }
  /* the control-chart constants for a subgroup of n */
  function K(n) {
    n = Math.max(2, Math.min(25, Math.round(n)));
    const d2 = D2[n], d3 = D3C[n], c4 = Math.sqrt(2 / (n - 1)) * Math.exp(lgamma(n / 2) - lgamma((n - 1) / 2)), b = Math.sqrt(1 - c4 * c4) / c4;
    return { n, d2, d3, c4, A2: 3 / (d2 * Math.sqrt(n)), D3: Math.max(0, 1 - 3 * d3 / d2), D4: 1 + 3 * d3 / d2, A3: 3 / (c4 * Math.sqrt(n)), B3: Math.max(0, 1 - 3 * b), B4: 1 + 3 * b };
  }
  /* ---------------- charts ---------------- */
  const clean = (v) => (Array.isArray(v) ? v : []).map(Number).filter((x) => Number.isFinite(x));
  /* subgroups: array of arrays of readings. type 'xr' or 'xs'. Limits are worked out for each point's own subgroup size. */
  function xbarChart(groups, type, o) {
    o = o || {}; const G = groups.map(clean).filter((g) => g.length >= 2), k = G.length;
    if (!k) return null;
    const means = G.map(mean), disp = G.map((g) => (type === "xs" ? sd(g) : rng(g))), ns = G.map((g) => g.length);
    const base = o.limitsFrom && o.limitsFrom > 1 ? Math.min(k, o.limitsFrom) : k;
    const gbar = mean(means.slice(0, base)), dbar = mean(disp.slice(0, base)), nmean = mean(ns.slice(0, base)), Kb = K(Math.round(nmean));
    const sigma = type === "xs" ? dbar / Kb.c4 : dbar / Kb.d2;
    const lim = G.map((g) => {
      const c = K(g.length), a = type === "xs" ? c.A3 : c.A2;
      return { x: { cl: gbar, ucl: gbar + a * dbar, lcl: gbar - a * dbar }, d: type === "xs" ? { cl: dbar, ucl: c.B4 * dbar, lcl: c.B3 * dbar } : { cl: dbar, ucl: c.D4 * dbar, lcl: c.D3 * dbar }, sigmaXbar: sigma / Math.sqrt(g.length) };
    });
    return { type, k, n: ns, means, disp, grand: gbar, dbar, sigma, lim, all: G.flat() };
  }
  function imrChart(values, o) {
    o = o || {}; const X = clean(values), k = X.length; if (k < 2) return null;
    const mr = X.slice(1).map((v, i) => Math.abs(v - X[i])), base = o.limitsFrom && o.limitsFrom > 2 ? Math.min(k, o.limitsFrom) : k;
    const xb = mean(X.slice(0, base)), mrb = mean(mr.slice(0, Math.max(1, base - 1))), sigma = mrb / 1.128;
    const lim = X.map(() => ({ x: { cl: xb, ucl: xb + 2.66 * mrb, lcl: xb - 2.66 * mrb }, d: { cl: mrb, ucl: 3.267 * mrb, lcl: 0 }, sigmaXbar: sigma }));
    return { type: "imr", k, n: X.map(() => 1), means: X, disp: [null].concat(mr), grand: xb, dbar: mrb, sigma, lim, all: X };
  }
  /* attribute charts: 'p' defectives/n, 'np' defectives, 'c' defects, 'u' defects per unit. rows: [{d: count, n: sample size}] */
  function attrChart(rows, type) {
    const R = rows.map((r) => ({ d: Number(r.d), n: Number(r.n) })).filter((r) => Number.isFinite(r.d) && r.d >= 0 && (type === "c" || (Number.isFinite(r.n) && r.n > 0)));
    if (!R.length) return null; const k = R.length, D = sum(R.map((r) => r.d)), N = sum(R.map((r) => r.n || 1));
    let cl, val, lim;
    if (type === "p") { const pb = D / N; val = R.map((r) => r.d / r.n); lim = R.map((r) => { const s = Math.sqrt(pb * (1 - pb) / r.n); return { cl: pb, ucl: Math.min(1, pb + 3 * s), lcl: Math.max(0, pb - 3 * s), s }; }); cl = pb; }
    else if (type === "np") { const nb = mean(R.map((r) => r.n)), pb = D / N; val = R.map((r) => r.d); lim = R.map((r) => { const s = Math.sqrt(r.n * pb * (1 - pb)); return { cl: r.n * pb, ucl: Math.min(r.n, r.n * pb + 3 * s), lcl: Math.max(0, r.n * pb - 3 * s), s }; }); cl = nb * pb; }
    else if (type === "c") { const cb = D / k; val = R.map((r) => r.d); lim = R.map(() => ({ cl: cb, ucl: cb + 3 * Math.sqrt(cb), lcl: Math.max(0, cb - 3 * Math.sqrt(cb)), s: Math.sqrt(cb) })); cl = cb; }
    else { const ub = D / N; val = R.map((r) => r.d / r.n); lim = R.map((r) => { const s = Math.sqrt(ub / r.n); return { cl: ub, ucl: ub + 3 * s, lcl: Math.max(0, ub - 3 * s), s }; }); cl = ub; }
    return { type, k, val, lim, cl, defects: D, units: N };
  }
  /* ---------------- run rules ----------------
     pts: values, lim: per point {cl, ucl, lcl, s?}; sig: per point sigma of the plotted statistic. Returns [{i, rule, text}] (zero-based point index). */
  const RULES = {
    1: "A point is outside the control limits",
    2: "points in a row on one side of the centre line",
    3: "points in a row going up or down",
    4: "2 of 3 points beyond 2 sigma on the same side",
    5: "4 of 5 points beyond 1 sigma on the same side"
  };
  function rules(vals, lim, opts) {
    opts = opts || {}; const on = opts.rules || [1, 2, 3], run = opts.run || 7, trend = opts.trend || 7, out = [], seen = {}, n = vals.length;
    const add = (i, r, t) => { const key = i + ":" + r; if (!seen[key]) { seen[key] = 1; out.push({ i, rule: r, text: t }); } };
    const sg = (i) => (lim[i].ucl - lim[i].cl) / 3, z = (i) => (sg(i) > 0 ? (vals[i] - lim[i].cl) / sg(i) : 0);
    for (let i = 0; i < n; i++) {
      if (vals[i] == null || !Number.isFinite(vals[i])) continue;
      if (on.includes(1) && (vals[i] > lim[i].ucl + 1e-12 || vals[i] < lim[i].lcl - 1e-12)) add(i, 1, RULES[1]);
    }
    if (on.includes(2)) { let s = 0, c = 0; for (let i = 0; i < n; i++) { const d = Math.sign(vals[i] - lim[i].cl); if (d !== 0 && d === s) c++; else { s = d; c = d === 0 ? 0 : 1; } if (c >= run) add(i, 2, run + " " + RULES[2]); } }
    if (on.includes(3)) { let c = 1, dir = 0; for (let i = 1; i < n; i++) { const d = Math.sign(vals[i] - vals[i - 1]); if (d !== 0 && d === dir) c++; else { dir = d; c = d === 0 ? 1 : 2; } if (c >= trend) add(i, 3, trend + " " + RULES[3]); } }
    if (on.includes(4)) for (let i = 2; i < n; i++) for (const sgn of [1, -1]) { let c = 0; for (let j = i - 2; j <= i; j++) if (sgn * z(j) > 2) c++; if (c >= 2 && sgn * z(i) > 2) add(i, 4, RULES[4]); }
    if (on.includes(5)) for (let i = 4; i < n; i++) for (const sgn of [1, -1]) { let c = 0; for (let j = i - 4; j <= i; j++) if (sgn * z(j) > 1) c++; if (c >= 4 && sgn * z(i) > 1) add(i, 5, RULES[5]); }
    return out.sort((a, b) => a.i - b.i || a.rule - b.rule);
  }
  /* ---------------- capability ---------------- */
  function skew(a) { const n = a.length, m = mean(a), s = sd(a); if (n < 3 || !s) return 0; return (n / ((n - 1) * (n - 2))) * sum(a.map((v) => ((v - m) / s) ** 3)); }
  function kurt(a) { const n = a.length, m = mean(a), s = sd(a); if (n < 4 || !s) return 0; return (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) * sum(a.map((v) => ((v - m) / s) ** 4)) - 3 * (n - 1) ** 2 / ((n - 2) * (n - 3)); }
  /* all: every reading; sigmaWithin from the chart (R̄/d2, S̄/c4, MR̄/1.128); lsl/usl/target may be null (one-sided limits are allowed) */
  function capability(all, sigmaWithin, lsl, usl, target) {
    const X = clean(all); if (X.length < 2) return null;
    const m = mean(X), so = sd(X), L = lsl == null || lsl === "" ? null : Number(lsl), U = usl == null || usl === "" ? null : Number(usl), T = target == null || target === "" ? null : Number(target);
    const idx = (s) => {
      if (!(s > 0)) return {};
      const cpu = U != null ? (U - m) / (3 * s) : null, cpl = L != null ? (m - L) / (3 * s) : null;
      return { cp: L != null && U != null ? (U - L) / (6 * s) : null, cpu, cpl, cpk: cpu != null && cpl != null ? Math.min(cpu, cpl) : cpu != null ? cpu : cpl };
    };
    const w = idx(sigmaWithin), o = idx(so);
    const ppm = (s) => (s > 0 ? (L != null ? ncdf((L - m) / s) : 0) * 1e6 + (U != null ? 1 - ncdf((U - m) / s) : 0) * 1e6 : null);
    const out = { n: X.length, mean: m, sdOverall: so, sdWithin: sigmaWithin, min: Math.min(...X), max: Math.max(...X), skew: skew(X), kurt: kurt(X),
      cp: w.cp, cpk: w.cpk, cpu: w.cpu, cpl: w.cpl, pp: o.cp, ppk: o.cpk, ppu: o.cpu, ppl: o.cpl, ppmWithin: ppm(sigmaWithin), ppmOverall: ppm(so),
      cpm: T != null && L != null && U != null && so > 0 ? (U - L) / (6 * Math.sqrt(so * so + (m - T) ** 2)) : null };
    const inL = X.filter((v) => (L != null && v < L) || (U != null && v > U)).length; out.outOfSpec = inL;
    return out;
  }
  const verdict = (c) => (c == null || !Number.isFinite(c) ? "—" : c >= 1.67 ? "Capable" : c >= 1.33 ? "Acceptable" : c >= 1 ? "Marginal" : "Not capable");
  function histogram(all, bins) {
    const X = clean(all); if (!X.length) return { edges: [], counts: [] };
    const lo = Math.min(...X), hi = Math.max(...X), b = bins || Math.max(5, Math.min(20, Math.round(Math.sqrt(X.length)))), w = (hi - lo) / b || 1, counts = Array(b).fill(0);
    X.forEach((v) => { counts[Math.min(b - 1, Math.floor((v - lo) / w))]++; });
    return { edges: Array.from({ length: b + 1 }, (_, i) => lo + i * w), counts, width: w };
  }
  const api = { K, D2, mean, sd, rng, sum, ncdf, ninv, lgamma, xbarChart, imrChart, attrChart, rules, RULES, capability, verdict, histogram, skew, kurt };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SPCCalc = api;
})(typeof window !== "undefined" ? window : globalThis);
