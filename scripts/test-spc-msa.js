/* Checks of the SPC and MSA engines against published values (AIAG MSA 4th ed. Gage R&R example) and hand calculations. Run: node scripts/test-spc-msa.js */
const S = require("../public/it/apps/spc-calc.js"), M = require("../public/it/apps/msa-calc.js");
let fails = 0; const near = (a, b, tol, name) => { if (!(Math.abs(a - b) <= tol)) { fails++; console.log("FAIL", name, "got", a, "expected", b); } };
const ok = (c, name) => { if (!c) { fails++; console.log("FAIL", name); } };
// constants
const k5 = S.K(5); near(k5.A2, 0.577, 0.001, "A2 n5"); near(k5.D4, 2.114, 0.001, "D4 n5"); near(k5.A3, 1.427, 0.001, "A3 n5"); near(k5.B4, 2.089, 0.001, "B4 n5"); near(S.K(10).c4, 0.9727, 0.0001, "c4 n10"); near(S.K(7).D3, 0.076, 0.001, "D3 n7");
// AIAG Gage R&R example
const A = [[.29, -.56, 1.34, .47, -.80, .02, .59, -.31, 2.26, -1.36], [.41, -.68, 1.17, .50, -.92, -.11, .75, -.20, 1.99, -1.25], [.64, -.58, 1.27, .64, -.84, -.21, .66, -.17, 2.01, -1.31]];
const B = [[.08, -.47, 1.19, .01, -.56, -.20, .47, -.63, 1.80, -1.68], [.25, -1.22, .94, 1.03, -1.20, .22, .55, .08, 2.12, -1.62], [.07, -.68, 1.34, .20, -1.28, .06, .83, -.34, 2.19, -1.50]];
const C = [[.04, -1.38, .88, .14, -1.46, -.29, .02, -.46, 1.77, -1.49], [-.11, -1.13, 1.09, .20, -1.07, -.67, .01, -.56, 1.45, -1.77], [-.15, -.96, .67, .11, -1.45, -.49, .21, -.49, 1.87, -2.16]];
const mk = (X) => Array.from({ length: 10 }, (_, p) => X.map((t) => t[p])), d = [mk(A), mk(B), mk(C)];
const r = M.grrRange(d, {});
near(r.EV, 0.20188, 0.0001, "EV"); near(r.AV, 0.22963, 0.0001, "AV"); near(r.GRR, 0.30575, 0.0001, "GRR"); near(r.PV, 1.10456, 0.0002, "PV"); near(r.TV, 1.14610, 0.0002, "TV"); near(r.pctGRR, 26.68, 0.01, "%GRR"); ok(r.ndc === 5, "ndc 5"); ok(r.decision === "Conditional", "decision");
const a = M.grrAnova(d, {});
near(a.var.repeat, 0.039973, 0.00001, "ANOVA repeatability"); near(a.var.appraiser, 0.051455, 0.00001, "ANOVA appraiser"); near(a.var.part, 1.08645, 0.0001, "ANOVA part"); near(a.var.grr, 0.09143, 0.0001, "ANOVA GRR"); ok(a.pooled === true, "interaction pooled (p>0.25)");
near(a.table[0].ss, 88.3619, 0.001, "SS parts"); near(a.table[1].ss, 3.1673, 0.001, "SS appraiser");
const rt = M.grrRange(d, { tol: 6 }); near(rt.pctTol, 6 * 0.30575 / 6 * 100, 0.1, "%tolerance");
// bias: readings 5.8 6.0 6.2 6.0 against master 6.00 (hand calculation: bias 0, s 0.1633, CI +-0.2597)
const bs = M.bias([5.8, 6.0, 6.2, 6.0], 6); near(bs.bias, 0, 1e-9, "bias"); near(bs.sd, 0.16330, 0.0001, "bias s"); near(bs.hi, 3.182 * 0.16330 / 2, 0.002, "bias CI high"); ok(bs.zeroInside, "bias zero inside CI");
const bs2 = M.bias([6.31, 6.29, 6.32, 6.30, 6.28], 6); ok(!bs2.zeroInside, "significant bias flagged"); near(bs2.bias, 0.30, 1e-9, "bias value");
// linearity: exact line  bias = 0.4 - 0.05 * ref, with symmetric noise
const rows = [2, 4, 6, 8, 10].map((x) => ({ ref: x, readings: [-0.02, 0.01, 0.02, -0.01, 0, 0.03, -0.03, 0.01, -0.02, 0.02].map((e) => x + 0.4 - 0.05 * x + e) }));
const lin = M.linearity(rows, { processVariation: 6 }); near(lin.slope, -0.05, 0.002, "slope"); near(lin.intercept, 0.4, 0.02, "intercept"); ok(lin.r2 > 0.9, "r2"); ok(!lin.ok, "linearity flagged"); near(lin.linearity, 0.3, 0.02, "linearity = |slope| x PV");
// attribute agreement: A perfect, B misses part 4, C false alarm on part 1; ref known
const ref = [1, 1, 0, 0, 1, 0, 1, 0, 1, 0], pa = (f) => ref.map((r, j) => [f(r, j), f(r, j)]);
const at = M.attribute([pa((r) => r), pa((r, j) => (j === 3 ? 1 : r)), pa((r, j) => (j === 0 ? 0 : r))], ref);
near(at.vsRef[0].effectiveness, 100, 1e-9, "A effectiveness"); near(at.vsRef[1].miss, 20, 1e-9, "B miss rate 1 of 5 bad"); near(at.vsRef[2].falseAlarm, 20, 1e-9, "C false alarm 1 of 5 good"); near(at.within[0], 100, 1e-9, "within"); ok(at.decision === "Not acceptable", "attribute decision");
near(M.kappa([1, 0, 1, 0], [1, 0, 1, 0]), 1, 1e-9, "kappa perfect"); near(M.kappa([1, 1, 0, 0], [1, 0, 1, 0]), 0, 1e-9, "kappa chance");
// distributions
near(M.fCdf(4.0, 3, 20), 0.9783, 0.001, "F cdf"); near(M.tInv(0.975, 10), 2.228, 0.002, "t 0.975 df10"); near(M.tTwoSided(2.228, 10), 0.05, 0.001, "t two-sided");
// control charts
const g = [[10, 11, 12], [11, 12, 13], [9, 10, 11], [10, 12, 14]], xr = S.xbarChart(g, "xr");
near(xr.grand, 11.25, 1e-9, "grand mean"); near(xr.dbar, 2.5, 1e-9, "Rbar"); near(xr.lim[0].x.ucl, 11.25 + S.K(3).A2 * 2.5, 1e-9, "UCL xbar"); near(xr.sigma, 2.5 / 1.693, 1e-9, "sigma within");
const im = S.imrChart([10, 12, 11, 13, 12]); near(im.dbar, 1.5, 1e-9, "MRbar"); near(im.lim[0].x.ucl, 11.6 + 2.66 * 1.5, 1e-9, "I UCL"); near(im.lim[0].d.ucl, 3.267 * 1.5, 1e-9, "MR UCL");
const p = S.attrChart([{ d: 2, n: 100 }, { d: 4, n: 100 }, { d: 6, n: 100 }], "p"); near(p.cl, 0.04, 1e-9, "pbar"); near(p.lim[0].ucl, 0.04 + 3 * Math.sqrt(0.04 * 0.96 / 100), 1e-9, "p UCL");
const cc = S.attrChart([{ d: 4 }, { d: 9 }, { d: 5 }], "c"); near(cc.cl, 6, 1e-9, "cbar"); near(cc.lim[0].ucl, 6 + 3 * Math.sqrt(6), 1e-9, "c UCL");
// rules
const lim = Array(12).fill({ cl: 10, ucl: 13, lcl: 7 });
ok(S.rules([10, 10, 14, 10, 10, 10, 10, 10, 10, 10, 10, 10], lim, { rules: [1] }).some((x) => x.i === 2 && x.rule === 1), "rule 1");
ok(S.rules([11, 11, 11, 11, 11, 11, 11, 9, 9, 9, 9, 9], lim, { rules: [2] }).some((x) => x.i === 6 && x.rule === 2), "rule 2 run of 7");
ok(S.rules([8, 9, 10, 11, 12, 12.5, 12.8, 10, 10, 10, 10, 10], lim, { rules: [3] }).some((x) => x.rule === 3), "rule 3 trend");
ok(!S.rules([10, 11, 9, 10, 11, 9, 10, 11, 9, 10, 11, 9], lim, { rules: [1, 2, 3] }).length, "no false signals");
// capability
const cap = S.capability([9.8, 10, 10.2, 10, 9.9, 10.1, 10, 10], 0.1, 9.4, 10.6, 10); near(cap.cp, 1.2 / 0.6, 1e-9, "Cp"); near(cap.cpk, (10.6 - cap.mean) / 0.3, 1e-9, "Cpk");
ok(S.verdict(1.7) === "Capable" && S.verdict(1.4) === "Acceptable" && S.verdict(1.1) === "Marginal" && S.verdict(0.8) === "Not capable", "verdict");
console.log(fails ? fails + " FAILED" : "all passed"); process.exit(fails ? 1 : 0);
