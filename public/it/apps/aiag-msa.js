/* AIAG MSA forms (4th edition): Gage R&R data sheet and report (average & range and ANOVA), bias, linearity, stability, attribute agreement.
   msa(st, A, x): st = the study, A = result of the app's analyse(), x = { d, co, ri, TYPES, M (MSACalc), C (SPCCalc), unit } */
(function () {
  "use strict";
  const F = window.AIAGForm, { esc, f, wrap, title, head, sec, signoff, ctlSheet, lineChart, bars } = F;
  const SUB = "Measurement system analysis · AIAG MSA manual (4th edition)";
  const NAME = { grr: ["GAGE REPEATABILITY AND REPRODUCIBILITY STUDY", "Average and range method and ANOVA method · " + SUB], bias: ["BIAS STUDY", "Independent sample method · " + SUB], linearity: ["LINEARITY STUDY", "Regression of bias on reference value · " + SUB], stability: ["STABILITY STUDY", "Control chart of a master over time · " + SUB], attribute: ["ATTRIBUTE MEASUREMENT SYSTEM STUDY", "Cross-tabulation, kappa, effectiveness, miss and false-alarm rates · " + SUB] };
  const DEC = { Acceptable: "ACCEPTABLE", Conditional: "MAY BE ACCEPTABLE — decision by agreement", "Not acceptable": "NOT ACCEPTABLE" };
  const A2 = { 2: 1.88, 3: 1.023, 4: 0.729, 5: 0.577 }, D3 = { 2: 0, 3: 0, 4: 0, 5: 0 };
  const pct = (v, d) => (v == null || !Number.isFinite(v) ? "—" : f(v, d == null ? 1 : d) + " %");
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const fmtDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? m[3] + "-" + m[2] + "-" + m[1] : s || ""; };

  function header(st, A, x) {
    const t = st.type, cfg = st.config || {}, tl = A.tl, unit = st.unit ? " " + esc(st.unit) : "";
    const spec = tl && tl.ok ? `${esc(tl.symbol)}${unit}${tl.tolerance != null ? `<br><span style="font-size:9px">tolerance ${f(tl.tolerance, x.d)}</span>` : ""}` : "—";
    const extra = t === "grr" || t === "attribute" ? [["Appraisers", esc((cfg.appraisers || []).join(", "))], ["Parts × trials", `${cfg.parts} parts × ${cfg.trials} trials`]]
      : t === "bias" || t === "stability" ? [["Master (reference) value", cfg.reference == null || cfg.reference === "" ? "—" : esc(cfg.reference) + unit], ["Readings", (st.data.readings || []).length]]
        : [["Reference parts", (st.data.rows || []).length], ["Readings", (st.data.rows || []).reduce((s, r) => s + (r.readings || []).length, 0)]];
    return head([[["Gauge number / name", esc([st.gauge_id, st.gauge_name].filter(Boolean).join(" · "))], ["Study no.", esc(st.no || "(not saved yet)")]],
      [["Characteristic", esc(st.characteristic) + (st.unit ? " (" + esc(st.unit) + ")" : "")], ["Specification / tolerance", spec]],
      [["Part number / name", esc([st.part_no, st.part_name].filter(Boolean).join(" · "))], ["Date · done by", fmtDate(st.study_date) + (st.conducted_by ? " · " + esc(st.conducted_by) : "")]],
      extra, [["Company", esc(x.co)], ["Study type", esc(x.TYPES[t][0])]]]);
  }
  const resultBox = (A, line) => `<div class="box avoid"><b>RESULT:</b> ${line}<br><b class="res">${DEC[A.decision] || esc(A.decision || "")}</b></div>`;

  /* ================= Gage R&R ================= */
  function grr(st, A, x) {
    const M = x.M, cfg = st.config || {}, ap = cfg.appraisers || [], dd = A.dd, P = A.res.P, T = A.res.T, Ar = A.res.A, d = x.d, tol = A.tol, k = A.res.k;
    const R = A.range && !A.range.error ? A.range : null, AN = A.anova && !A.anova.error ? A.anova : null, main = A.res;
    const rg = (a) => Math.max(...a) - Math.min(...a), avg = (a) => mean(a);
    const aMeans = dd.map((a) => a.map((p) => avg(p))), aRanges = dd.map((a) => a.map((p) => rg(p))), xa = dd.map((a) => avg(a.flat())), ra = aRanges.map((r) => avg(r));
    const pm = Array.from({ length: P }, (_, j) => avg(dd.flatMap((a) => a[j]))), Rp = Math.max(...pm) - Math.min(...pm), Rbar = avg(ra), xdiff = Math.max(...xa) - Math.min(...xa);
    const ucl = (M.D4[T] || 0) * Rbar, lcl = (D3[T] || 0) * Rbar, pw = (100 - 8 - 7 - 12) / P;
    // 1 data sheet
    const rows = dd.map((a, i) => `${a.length ? "" : ""}${Array.from({ length: T }, (_, t) => `<tr>${t === 0 ? `<th rowspan="${T + 2}" class="c">${esc(ap[i] || "A" + (i + 1))}</th>` : ""}<th class="c">${t + 1}</th>${a.map((p) => `<td class="n">${f(p[t], d)}</td>`).join("")}<td></td></tr>`).join("")}
      <tr><th class="c">Average</th>${aMeans[i].map((v) => `<td class="n"><b>${f(v, d + 1)}</b></td>`).join("")}<td class="n"><b>X̄<sub>${esc(ap[i] || "A" + (i + 1))}</sub> = ${f(xa[i], d + 1)}</b></td></tr>
      <tr><th class="c">Range</th>${aRanges[i].map((v) => `<td class="n${v > ucl + 1e-12 ? " fl" : ""}">${f(v, d + 1)}</td>`).join("")}<td class="n"><b>R̄<sub>${esc(ap[i] || "A" + (i + 1))}</sub> = ${f(ra[i], d + 1)}</b></td></tr>`).join("");
    const sheet = `<table><colgroup><col style="width:8%"><col style="width:7%">${Array.from({ length: P }, () => `<col style="width:${pw}%">`).join("")}<col style="width:12%"></colgroup>
      <thead><tr><th class="c">Appraiser</th><th class="c">Trial</th>${Array.from({ length: P }, (_, j) => `<th class="c">Part ${j + 1}</th>`).join("")}<th class="c">Average</th></tr></thead><tbody>${rows}
      <tr><th colspan="2" class="c">Part average X̄<sub>p</sub></th>${pm.map((v) => `<td class="n"><b>${f(v, d + 1)}</b></td>`).join("")}<td class="n"><b>X̿ = ${f(avg(pm), d + 1)}</b></td></tr></tbody></table>
      <table style="margin-top:4px"><tbody><tr><th>R̄ = (${ap.map((n, i) => "R̄<sub>" + esc(n || "A" + (i + 1)) + "</sub>").join(" + ")}) / ${Ar}</th><td class="n"><b>${f(Rbar, d + 3)}</b></td><th>X̄<sub>DIFF</sub> = max X̄<sub>a</sub> − min X̄<sub>a</sub></th><td class="n"><b>${f(xdiff, d + 3)}</b></td><th>R<sub>p</sub> = max X̄<sub>p</sub> − min X̄<sub>p</sub></th><td class="n"><b>${f(Rp, d + 3)}</b></td></tr>
      <tr><th>UCL<sub>R</sub> = D₄ × R̄ &nbsp;(D₄ = ${M.D4[T]})</th><td class="n"><b>${f(ucl, d + 3)}</b></td><th>LCL<sub>R</sub> = D₃ × R̄ &nbsp;(D₃ = 0)</th><td class="n"><b>${f(lcl, d + 3)}</b></td><th colspan="2" style="text-transform:none;font-weight:400">${aRanges.flat().some((v) => v > ucl + 1e-12) ? "Shaded ranges are above UCL<sub>R</sub>: those readings were not made the same way — find the reason and repeat them." : "All ranges are within UCL<sub>R</sub>: the appraisers measured consistently."}</th></tr></tbody></table>`;
    // 2 report, average and range method
    let rep = "";
    if (R) {
      const tv = R.TV, tp = (v) => (tol != null ? pct((k * v) / tol * 100) : "—"), tvp = (v) => pct((v / tv) * 100), K1 = M.K1[T], K2 = M.K2[Ar], K3 = M.K3[P];
      const line = (nm, calc, v, thin) => `<tr><td>${nm}</td><td class="eq">${calc}</td><td class="n"><b>${f(v, d + 3)}</b></td><td class="n">${thin ? tvp(v) : "100 %"}</td><td class="n">${thin === 2 ? "—" : tp(v)}</td></tr>`;
      rep = `<table><colgroup><col style="width:27%"><col style="width:31%"><col style="width:12%"><col style="width:15%"><col style="width:15%"></colgroup><thead><tr><th>Measurement unit analysis</th><th>Calculation</th><th>Value</th><th>% of total variation</th><th>% of tolerance${tol != null ? " (" + k + "σ)" : ""}</th></tr></thead><tbody>
        ${line("Repeatability — equipment variation (EV)", `EV = R̄ × K₁ = ${f(R.Rbar, d + 3)} × ${K1}`, R.EV, 1)}
        ${line("Reproducibility — appraiser variation (AV)", `AV = √[(X̄<sub>DIFF</sub> × K₂)² − EV² / (n·r)] = √[(${f(xdiff, d + 3)} × ${K2})² − ${f(R.EV, d + 3)}² / (${P}·${T})]`, R.AV, 1)}
        ${line("Repeatability and reproducibility (GRR)", `GRR = √(EV² + AV²)`, R.GRR, 1)}
        ${line("Part variation (PV)", `PV = R<sub>p</sub> × K₃ = ${f(Rp, d + 3)} × ${K3}`, R.PV, 1)}
        ${line("Total variation (TV)", `TV = √(GRR² + PV²)`, R.TV, 0)}
        <tr><td>Number of distinct categories</td><td class="eq">ndc = 1.41 × (PV / GRR)</td><td class="n"><b>${R.ndc}</b></td><td colspan="2" class="c">5 or more needed</td></tr></tbody></table>
        <p class="note">n = number of parts (${P}), r = number of trials (${T}); % of total variation = 100 × (value / TV); % of tolerance = 100 × (${k} × value / tolerance).</p>
        <table class="avoid" style="margin-top:4px"><thead><tr><th>Constant</th><th class="c">Used for</th><th class="c">Value used</th><th>Constant</th><th class="c">Used for</th><th class="c">Value used</th></tr></thead><tbody><tr><th>K₁</th><td class="c">${T} trials</td><td class="c"><b>${K1}</b></td><th>K₃</th><td class="c">${P} parts</td><td class="c"><b>${K3}</b></td></tr><tr><th>K₂</th><td class="c">${Ar} appraisers</td><td class="c"><b>${K2}</b></td><th>D₄</th><td class="c">${T} trials</td><td class="c"><b>${M.D4[T]}</b></td></tr></tbody></table>`;
    }
    // 3 ANOVA method
    let an = "";
    if (AN) {
      const v = AN.var, s = AN.sd, tv = v.total, tpc = (sd) => (tol != null ? pct((k * sd) / tol * 100) : "—");
      const vr = (nm, vv, ind) => `<tr><td${ind ? ` style="padding-left:${ind * 14}px"` : ""}>${nm}</td><td class="n">${f(vv, d + 5)}</td><td class="n">${pct((vv / tv) * 100)}</td><td class="n">${f(Math.sqrt(vv), d + 4)}</td><td class="n">${f(k * Math.sqrt(vv), d + 4)}</td><td class="n">${pct(Math.sqrt(vv / tv) * 100)}</td><td class="n">${tpc(Math.sqrt(vv))}</td></tr>`;
      an = `${sec("4 · Gage R&R report — ANOVA method")}<div class="sub">Analysis of variance table</div>
        <table><colgroup><col style="width:30%"><col style="width:9%"><col style="width:17%"><col style="width:17%"><col style="width:14%"><col style="width:13%"></colgroup><thead><tr><th>Source</th><th>DF</th><th>SS</th><th>MS</th><th>F</th><th>P</th></tr></thead><tbody>${AN.table.map((z) => `<tr><td>${z.name}</td><td class="n">${z.df}</td><td class="n">${f(z.ss, 5)}</td><td class="n">${z.ms == null ? "" : f(z.ms, 5)}</td><td class="n">${z.f == null ? "" : f(z.f, 2)}</td><td class="n">${z.p == null ? "" : f(z.p, 3)}</td></tr>`).join("")}</tbody></table>
        <p class="note">Appraiser × part interaction ${AN.pooled ? "is not significant (P = " + f(AN.pInteraction, 3) + " > 0.25): it is combined with the error (repeatability)." : "is significant (P = " + f(AN.pInteraction, 3) + " ≤ 0.25) and is kept in reproducibility."}</p>
        <div class="sub">Variance components and study variation (${k} σ)</div>
        <table><colgroup><col style="width:28%"><col style="width:14%"><col style="width:12%"><col style="width:12%"><col style="width:12%"><col style="width:11%"><col style="width:11%"></colgroup><thead><tr><th>Source</th><th>Variance <span style="text-transform:none">σ²</span></th><th>% contribution</th><th>Std. dev. <span style="text-transform:none">σ</span></th><th>Study variation ${k}<span style="text-transform:none">σ</span></th><th>% study variation</th><th>% tolerance</th></tr></thead><tbody>
        ${vr("Total gage R&R (GRR)", v.grr, 0)}${vr("Repeatability (EV)", v.repeat, 1)}${vr("Reproducibility (AV)", v.reprod, 1)}${v.appraiser > 0 || !AN.pooled ? vr("Appraiser", v.appraiser, 2) : ""}${!AN.pooled ? vr("Appraiser × part", v.interaction, 2) : ""}${vr("Part-to-part (PV)", v.part, 0)}${vr("Total variation (TV)", v.total, 0)}</tbody></table>
        <p class="note">Number of distinct categories ndc = 1.41 × (σ<sub>part</sub> / σ<sub>GRR</sub>) = <b>${AN.ndc}</b>.</p>`;
    }
    // 4 charts
    const lab = Array.from({ length: P }, (_, i) => String(i + 1)), shp = ["ci", "sq", "tr", "ci", "sq"], dsh = ["", "7 3", "2 3", "10 3 2 3", "5 5"];
    const series = (arr) => arr.map((vals, i) => ({ name: "Appraiser " + (ap[i] || "A" + (i + 1)), vals, shape: shp[i % 5], dash: dsh[i % 5], fill: i % 2 ? "#fff" : "#000" }));
    const xbb = avg(xa), a2 = A2[T] || 0;
    const charts = lineChart({ title: "Range chart by appraiser (part ranges, UCL from D₄ × R̄)", labels: lab, d: d + 1, xTitle: "Part number", series: series(aRanges), hlines: [{ v: ucl, t: "UCL " + f(ucl, d + 2), col: "#c00000", dash: 1 }, { v: Rbar, t: "R̄ " + f(Rbar, d + 2), col: "#006400" }, { v: lcl, t: "LCL " + f(lcl, d + 2), col: "#c00000", dash: 1 }] })
      + lineChart({ title: "Average chart by appraiser (part averages, limits X̿ ± A₂ × R̄)", labels: lab, d: d + 1, xTitle: "Part number", series: series(aMeans), hlines: [{ v: xbb + a2 * Rbar, t: "UCL " + f(xbb + a2 * Rbar, d + 2), col: "#c00000", dash: 1 }, { v: xbb, t: "X̿ " + f(xbb, d + 2), col: "#006400" }, { v: xbb - a2 * Rbar, t: "LCL " + f(xbb - a2 * Rbar, d + 2), col: "#c00000", dash: 1 }] });
    const pv = main.method === "anova" ? [main.sd.repeat, main.sd.reprod, main.sd.grr, main.sd.part, main.sd.total] : [main.EV, main.AV, main.GRR, main.PV, main.TV], tvm = pv[4];
    const comp = bars("Components of variation (% of total variation)", [["Repeatability (EV)", pv[0], "#9aa3af"], ["Reproducibility (AV)", pv[1], "#6b7280"], ["Gage R&R (GRR)", pv[2], "#111"], ["Part-to-part (PV)", pv[3], "#cfd5dd"]].map((z) => ({ t: z[0], v: tvm > 0 ? (z[1] / tvm) * 100 : 0, c: z[2] })));
    const basis = main.method === "anova" ? "ANOVA method" : "average and range method";
    const line1 = `%GRR = <b>${pct(main.pctGRR)}</b> of total variation${main.pctTol != null ? `, <b>${pct(main.pctTol)}</b> of tolerance` : ""}; ndc = <b>${main.ndc}</b> (${basis}).`;
    const concl = [main.decision === "Acceptable" ? "Under 10 % of the total variation and of the tolerance: the measurement system is generally considered <b>acceptable</b>." : main.decision === "Conditional" ? "Between 10 % and 30 %: the measurement system <b>may be acceptable</b> depending on the importance of the application, the cost of the gauge and the cost of repair. Agree it with the customer." : "Over 30 %: the measurement system is <b>not acceptable</b>. Find and correct the causes (equipment, method, training, part presentation) and repeat the study.",
      main.ndc >= 5 ? "ndc is 5 or more: the gauge can separate the parts into enough groups for process control." : "ndc is below 5: the gauge cannot separate the parts well enough for process control.",
      "The decision follows the worse of %GRR of total variation and %GRR of tolerance."];
    return `${sec("1 · Gage R&R data sheet")}<div style="margin-top:4px">${sheet}</div>${R ? `${sec("2 · Gage R&R report — average and range method")}<div style="margin-top:4px">${rep}</div>` : ""}${AN ? an.replace("4 · Gage R&R report — ANOVA method", (R ? "3" : "2") + " · Gage R&R report — ANOVA method") : ""}
      ${sec("Charts")}<div style="margin-top:6px">${charts}${comp}</div>${sec("Acceptance criteria and result")}
      <table style="margin-top:4px"><thead><tr><th>%GRR (of total variation / tolerance)</th><th>Decision</th><th>Comment</th></tr></thead><tbody><tr><td class="c">Under 10 %</td><td class="c">ACCEPTABLE</td><td>Generally considered an acceptable measurement system.</td></tr><tr><td class="c">10 % to 30 %</td><td class="c">MAY BE ACCEPTABLE</td><td>Based on importance of the application, cost of the gauge, cost of repair, etc.</td></tr><tr><td class="c">Over 30 %</td><td class="c">NOT ACCEPTABLE</td><td>Every effort should be made to improve the measurement system.</td></tr><tr><td class="c">ndc 5 or more</td><td class="c">—</td><td>Number of distinct categories the gauge can resolve.</td></tr></tbody></table>
      ${resultBox(A, line1)}<ul>${concl.map((z) => `<li>${z}</li>`).join("")}</ul>`;
  }

  /* ================= Bias ================= */
  function bias(st, A, x) {
    const r = A.res, M = x.M, d = x.d, rd = (st.data.readings || []).map(Number).filter(Number.isFinite), n = r.n, tc = M.tInv(0.975, r.df), unit = st.unit ? " " + esc(st.unit) : "";
    const rowsN = Math.ceil(rd.length / 10);
    const grid = `<table><colgroup><col style="width:12%">${Array.from({ length: 10 }, () => '<col style="width:8.8%">').join("")}</colgroup><thead><tr><th>Readings</th>${Array.from({ length: 10 }, (_, k) => `<th class="c">${k + 1}</th>`).join("")}</tr></thead><tbody>${Array.from({ length: rowsN }, (_, i) => `<tr><th class="c">${i * 10 + 1}–${Math.min(rd.length, i * 10 + 10)}</th>${Array.from({ length: 10 }, (_, k) => `<td class="n">${rd[i * 10 + k] == null ? "" : f(rd[i * 10 + k], d + 1)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    const an = head([[["Reference (master) value", f(r.ref, d + 2) + unit], ["Average X̄ of n = " + n + " readings", f(r.mean, d + 3)]],
      [["Bias = X̄ − reference", `<b>${f(r.bias, d + 3)}</b>`], ["Repeatability σ<sub>r</sub> (std. dev. of readings)", f(r.sd, d + 3)]],
      [["σ<sub>b</sub> = σ<sub>r</sub> / √n", f(r.se, d + 4)], ["t = bias / σ<sub>b</sub>", f(r.t, 3)]],
      [["Degrees of freedom ν = n − 1", r.df], ["Significant t value (95 %, 2-tailed)", f(tc, 3)]],
      [["P value (2-tailed)", f(r.p, 4)], ["Bias as % of tolerance", r.pctTol == null ? "—" : f(r.pctTol, 1) + " %"]],
      [["95 % interval — lower: bias − t × σ<sub>b</sub>", `<b>${f(r.lo, d + 3)}</b>`], ["95 % interval — upper: bias + t × σ<sub>b</sub>", `<b>${f(r.hi, d + 3)}</b>`]]]);
    const ch = lineChart({ title: "Readings against the master value", labels: rd.map((_, i) => String(i + 1)), d: d + 1, xTitle: "Reading number", series: [{ name: "Readings", vals: rd, shape: "ci" }], hlines: [{ v: r.ref, t: "master " + f(r.ref, d + 2), col: "#1d4ed8", dash: 1 }, { v: r.mean, t: "mean " + f(r.mean, d + 2), col: "#006400" }] });
    return `${sec("1 · Readings of the master part")}<div style="margin-top:4px">${grid}</div>${sec("2 · Bias analysis")}<div style="margin-top:4px">${an}</div>${sec("3 · Chart")}<div style="margin-top:6px">${ch}</div>
      ${resultBox(A, `Bias = <b>${f(r.bias, d + 3)}</b>${unit}; 95 % interval ${f(r.lo, d + 3)} to ${f(r.hi, d + 3)}; zero ${r.zeroInside ? "<b>lies inside</b> the interval" : "<b>lies outside</b> the interval"}.`)}
      <ul><li>The bias is acceptable when zero lies inside the confidence interval of the bias. ${r.zeroInside ? "Here it does: no significant bias." : "Here it does not: the gauge reads <b>" + (r.bias > 0 ? "high" : "low") + "</b>; adjust the gauge or apply a correction, then repeat the study."}</li></ul>`;
  }

  /* ================= Linearity ================= */
  function scatter(st, r, d) {
    const W = 1000, H = 260, L = 76, R = 24, T = 16, B = 36, pts = [], rows = (st.data.rows || []).filter((q) => q.ref !== "" && q.ref != null && Number.isFinite(Number(q.ref)));
    rows.forEach((q) => (q.readings || []).map(Number).filter(Number.isFinite).forEach((v) => pts.push({ x: Number(q.ref), y: v - Number(q.ref) }))); if (pts.length < 2) return "";
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y).concat(r.parts.map((p) => p.bias)); let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys, 0), y1 = Math.max(...ys, 0); const py = (y1 - y0) * 0.15 || 1; y0 -= py; y1 += py; const dx = (x1 - x0) * 0.06 || 1; x0 -= dx; x1 += dx;
    const X = (v) => L + ((v - x0) / (x1 - x0)) * (W - L - R), Y = (v) => T + ((y1 - v) / (y1 - y0)) * (H - T - B), tk = Array.from({ length: 5 }, (_, i) => y0 + ((y1 - y0) * i) / 4), xt = Array.from({ length: 5 }, (_, i) => x0 + ((x1 - x0) * i) / 4);
    return `<div class="avoid"><div class="sub">Bias against the reference value</div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Linearity chart"><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="#fff" stroke="#000"/>
      ${tk.map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e5e8ee" stroke-width=".7"/><text x="${L - 6}" y="${Y(v) + 3.5}" text-anchor="end" font-size="11" font-family="Arial">${v.toFixed(4)}</text>`).join("")}${xt.map((v) => `<text x="${X(v)}" y="${H - 18}" text-anchor="middle" font-size="11" font-family="Arial">${v.toFixed(2)}</text>`).join("")}
      <line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="#006400" stroke-width="1.4"/><text x="${W - R - 4}" y="${Y(0) - 4}" text-anchor="end" font-size="11" fill="#006400" font-family="Arial">bias = 0</text>
      <line x1="${X(x0)}" y1="${Y(r.intercept + r.slope * x0)}" x2="${X(x1)}" y2="${Y(r.intercept + r.slope * x1)}" stroke="#c00000" stroke-width="1.6" stroke-dasharray="7 4"/>
      ${pts.map((p) => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.6" fill="#8b93a1"/>`).join("")}${r.parts.map((p) => `<rect x="${(X(p.ref) - 4.5).toFixed(1)}" y="${(Y(p.bias) - 4.5).toFixed(1)}" width="9" height="9" fill="#000"/>`).join("")}
      <text x="${(L + W - R) / 2}" y="${H - 2}" text-anchor="middle" font-size="11" font-family="Arial">Reference value</text></svg><div class="leg"><span>● individual bias</span><span>■ average bias of each master</span><span style="color:#c00000">- - fitted line: bias = a + b × reference</span></div></div>`;
  }
  function linearity(st, A, x) {
    const r = A.res, d = x.d, rows = (st.data.rows || []).filter((q) => q.ref !== "" && q.ref != null && Number.isFinite(Number(q.ref))), mx = Math.min(12, Math.max(...rows.map((q) => (q.readings || []).length), 1));
    const cell = (q, k) => { const v = Number((q.readings || [])[k]); return `<td class="n">${(q.readings || [])[k] == null || !Number.isFinite(v) ? "" : f(v, d + 1)}</td>`; };
    const tab = `<table><colgroup><col style="width:5%"><col style="width:11%">${Array.from({ length: mx }, () => `<col style="width:${(100 - 5 - 11 - 20) / mx}%">`).join("")}<col style="width:10%"><col style="width:10%"></colgroup><thead><tr><th class="c">Part</th><th class="c">Reference</th>${Array.from({ length: mx }, (_, k) => `<th class="c">${k + 1}</th>`).join("")}<th class="c">Average</th><th class="c">Bias</th></tr></thead><tbody>${rows.map((q, i) => { const p = r.parts[i] || {}; return `<tr><td class="c">${i + 1}</td><td class="n"><b>${f(Number(q.ref), d)}</b></td>${Array.from({ length: mx }, (_, k) => cell(q, k)).join("")}<td class="n">${f(p.mean, d + 2)}</td><td class="n"><b>${f(p.bias, d + 3)}</b></td></tr>`; }).join("")}</tbody></table>${Math.max(...rows.map((q) => (q.readings || []).length), 1) > 12 ? '<p class="note">Only the first 12 readings of each master are listed; all readings are used in the calculation.</p>' : ""}`;
    const reg = head([[["Fitted line: bias = a + b × reference", "a = " + f(r.intercept, 5) + " · b = " + f(r.slope, 5)], ["R²", f(r.r2, 3)]],
      [["Standard error of b · of a", f(r.seSlope, 5) + " · " + f(r.seIntercept, 5)], ["P for slope b · for intercept a", f(r.pSlope, 4) + " · " + f(r.pIntercept, 4)]],
      [["Process variation used", f(r.pv, d + 2)], ["Average of the absolute biases", f(r.avgBias, d + 4)]],
      [["Linearity = |b| × process variation", `<b>${f(r.linearity, d + 4)}</b>`], ["% linearity = |b| × 100", `<b>${f(r.pctLinearity, 2)} %</b>`]]]);
    return `${sec("1 · Reference parts, readings and bias")}<div style="margin-top:4px">${tab}</div>${sec("2 · Regression of bias on the reference value")}<div style="margin-top:4px">${reg}</div>${sec("3 · Chart")}<div style="margin-top:6px">${scatter(st, r, d)}</div>
      ${resultBox(A, `Slope b = <b>${f(r.slope, 5)}</b> (P = ${f(r.pSlope, 4)}); intercept a = <b>${f(r.intercept, 5)}</b> (P = ${f(r.pIntercept, 4)}); linearity = <b>${f(r.linearity, d + 4)}</b> (${f(r.pctLinearity, 2)} %).`)}
      <ul><li>The gauge is acceptable when the slope and the intercept are not significantly different from zero (P above 0.05). ${r.ok ? "Here they are not: <b>no significant linearity or bias</b> across the range." : "At least one is significant: the <b>bias changes across the range</b> — correct the gauge or restrict the range of use."}</li></ul>`;
  }

  /* ================= Stability ================= */
  function stability(st, A, x) {
    const r = A.res, d = Math.min(x.d, 4) - 1, X = r.X, n = X.length, ch = r.ch, sg = {}, sigs = r.sig; sigs.forEach((s) => (sg[s.i] = 1));
    const mr = ch.disp, lim = ch.lim, dl = lim.map((l) => l.d), xl = lim.map((l) => l.x);
    const sheet = ctlSheet({ n, cols: 20, grid: [{ name: "CHECK NO.", cell: (i) => ({ t: i + 1, cls: "c" }) }, { name: "MASTER READING X", cell: (i) => ({ t: f(X[i], d + 1), cls: "n sm" + (sg[i] ? " fl" : "") }) }, { name: "MOVING RANGE MR", cell: (i) => (mr[i] == null ? { t: "", cls: "c" } : { t: f(mr[i], d + 1), cls: "n sm" }) }, { name: "SIGNAL (rule)", cell: (i) => ({ t: [...new Set(sigs.filter((s) => s.i === i).map((s) => s.rule))].join(","), cls: "sg" }) }],
      charts: [{ name: "INDIVIDUALS X", vals: X, lim: xl, flagged: sg, d: d + 1, ref: r.ref, h: 130 }, { name: "MOVING RANGE MR", vals: mr.map((v) => (v == null ? NaN : v)), lim: dl, d: d + 1, h: 100 }] });
    const calc = head([[["Average X̄ of " + n + " checks", f(ch.grand, d + 3)], ["Average moving range MR̄", f(ch.dbar, d + 4)]], [["UCL X = X̄ + 2.660 × MR̄", f(xl[0].ucl, d + 3)], ["LCL X = X̄ − 2.660 × MR̄", f(xl[0].lcl, d + 3)]], [["UCL MR = 3.267 × MR̄", f(dl[0].ucl, d + 4)], ["σ̂ = MR̄ / 1.128", f(ch.sigma, d + 4)]]].concat(r.ref != null ? [[["Master (reference) value", f(r.ref, d + 3)], ["Average − master", f(ch.grand - r.ref, d + 4)]]] : []));
    const sgRows = sigs.length ? `<table><thead><tr><th>Check</th><th>Signal</th></tr></thead><tbody>${[...new Map(sigs.map((s) => [s.i + ":" + s.rule, s])).values()].map((s) => `<tr><td class="c">${s.i + 1}</td><td>${esc(s.text)}</td></tr>`).join("")}</tbody></table>` : "";
    return `${sec("1 · Master readings in time order and control charts")}${sheet}${sec("2 · Centre lines and control limits")}<div style="margin-top:4px">${calc}</div>${sgRows ? sec("3 · Signals") + `<div style="margin-top:4px">${sgRows}</div>` : ""}
      ${resultBox(A, sigs.length ? `${new Set(sigs.map((s) => s.i)).size} check(s) with a signal over ${n} checks.` : `No signals over ${n} checks.`)}
      <ul><li>${sigs.length ? "Signals show the gauge is drifting or was disturbed. Find the cause before relying on it." : "The gauge reads the master consistently over time: the measurement system is <b>stable</b>."}</li><li>Stability is judged on an individuals and moving-range chart of the master; at least 20 checks give reliable limits.</li></ul>`;
  }

  /* ================= Attribute ================= */
  function attribute(st, A, x) {
    const r = A.res, cfg = st.config || {}, ap = cfg.appraisers || [], lb = cfg.labels || ["Reject", "Accept"], dd = (st.data.d || []).map((a) => a.map((p) => p.map(Number))), ref = st.data.ref || [], P = r.P, T = r.T;
    const sym = (v) => (v === 1 ? "1" : v === 0 ? "0" : "");
    const hasRef = r.hasRef;
    const sheet = `<table><thead><tr><th rowspan="2" class="c">Part</th>${hasRef ? '<th rowspan="2" class="c">Reference</th>' : ""}${ap.map((n) => `<th colspan="${T}" class="c">Appraiser ${esc(n)}</th>`).join("")}<th rowspan="2" class="c">All agree</th>${hasRef ? '<th rowspan="2" class="c">All agree with reference</th>' : ""}</tr><tr>${ap.map(() => Array.from({ length: T }, (_, t) => `<th class="c">${t + 1}</th>`).join("")).join("")}</tr></thead><tbody>
      ${Array.from({ length: P }, (_, j) => { const all = dd.flatMap((a) => a[j]), agree = all.every((v) => v === all[0]), okRef = hasRef && all.every((v) => v === ref[j]); return `<tr><td class="c">${j + 1}</td>${hasRef ? `<td class="c"><b>${sym(ref[j])}</b></td>` : ""}${dd.map((a) => a[j].map((v) => `<td class="c${hasRef && v !== ref[j] ? " fl" : ""}">${sym(v)}</td>`).join("")).join("")}<td class="c">${agree ? "✓" : "✗"}</td>${hasRef ? `<td class="c">${okRef ? "✓" : "✗"}</td>` : ""}</tr>`; }).join("")}</tbody></table>
      <p class="note">Codes: 1 = ${esc(lb[1])}, 0 = ${esc(lb[0])}. ${hasRef ? "Shaded: the appraiser's call differs from the reference." : ""}</p>`;
    const sum = `<table><thead><tr><th>Appraiser</th><th>Agrees with self (all trials)</th>${hasRef ? "<th>Effectiveness</th><th>Miss rate</th><th>False-alarm rate</th><th>Kappa vs reference</th>" : ""}</tr></thead><tbody>${r.within.map((w, i) => `<tr><td class="c"><b>${esc(ap[i] || "A" + (i + 1))}</b></td><td class="n">${pct(w, 0)}</td>${hasRef ? `<td class="n">${pct(r.vsRef[i].effectiveness, 0)}</td><td class="n">${r.vsRef[i].miss == null ? "—" : pct(r.vsRef[i].miss, 0)}</td><td class="n">${r.vsRef[i].falseAlarm == null ? "—" : pct(r.vsRef[i].falseAlarm, 0)}</td><td class="n">${f(r.kappaRef[i], 2)}</td>` : ""}</tr>`).join("")}
      <tr><th>All appraisers</th><td class="n"><b>${pct(r.allAgree, 0)}</b> agree on every part</td>${hasRef ? `<td class="n"><b>${pct(r.effectiveness, 0)}</b></td><td class="n"><b>${r.miss == null ? "—" : pct(r.miss, 1)}</b></td><td class="n"><b>${r.falseAlarm == null ? "—" : pct(r.falseAlarm, 1)}</b></td><td class="n">${f(r.kappaRef.reduce((s, v) => s + v, 0) / r.kappaRef.length, 2)}</td>` : ""}</tr></tbody></table>`;
    const cross = (i, j) => { const c = [[0, 0], [0, 0]]; for (let p = 0; p < P; p++) c[dd[i][p][0]][dd[j][p][0]]++; return c; };
    const xt = r.kappaPairs.map((p) => { const c = cross(p.a, p.b), rt = [c[0][0] + c[0][1], c[1][0] + c[1][1]], ct = [c[0][0] + c[1][0], c[0][1] + c[1][1]], N = P, e = (i, j) => (rt[i] * ct[j]) / N; const A_ = esc(ap[p.a]), B_ = esc(ap[p.b]);
      return `<div><div class="sub" style="margin-top:0">${A_} × ${B_} (first trial)</div><table><thead><tr><th>${A_} ↓ · ${B_} →</th><th class="c">${esc(lb[0])}</th><th class="c">${esc(lb[1])}</th><th class="c">Total</th></tr></thead><tbody>${[0, 1].map((i) => `<tr><th>${esc(lb[i])}</th>${[0, 1].map((j) => `<td class="c"><b>${c[i][j]}</b><br><span style="font-size:9px">expected ${f(e(i, j), 1)}</span></td>`).join("")}<td class="c">${rt[i]}</td></tr>`).join("")}<tr><th>Total</th><td class="c">${ct[0]}</td><td class="c">${ct[1]}</td><td class="c">${N}</td></tr></tbody></table><p class="note">kappa = <b>${f(p.kappa, 2)}</b></p></div>`; });
    const crit = `<table><thead><tr><th>Decision</th><th>Effectiveness</th><th>Miss rate</th><th>False-alarm rate</th><th>Kappa</th></tr></thead><tbody><tr><td class="c">ACCEPTABLE</td><td class="c">90 % or more</td><td class="c">2 % or less</td><td class="c">5 % or less</td><td class="c">0.75 or more (good agreement)</td></tr><tr><td class="c">MAY BE ACCEPTABLE</td><td class="c">80 % or more</td><td class="c">5 % or less</td><td class="c">10 % or less</td><td class="c">0.40 to 0.75</td></tr><tr><td class="c">NOT ACCEPTABLE</td><td class="c">below 80 %</td><td class="c">above 5 %</td><td class="c">above 10 %</td><td class="c">below 0.40 (poor agreement)</td></tr></tbody></table>`;
    return `${sec("1 · Data sheet — calls of each appraiser")}<div style="margin-top:4px">${sheet}</div>${sec("2 · Agreement, effectiveness, miss rate and false-alarm rate")}<div style="margin-top:4px">${sum}</div>
      ${sec("3 · Cross-tabulation between appraisers and kappa")}<div class="two" style="margin-top:4px">${xt.join("")}</div>${sec("4 · Acceptance criteria and result")}<div style="margin-top:4px">${crit}</div>
      ${resultBox(A, hasRef ? `Effectiveness <b>${pct(r.effectiveness, 0)}</b>, miss rate <b>${r.miss == null ? "—" : pct(r.miss, 1)}</b>, false-alarm rate <b>${r.falseAlarm == null ? "—" : pct(r.falseAlarm, 1)}</b>.` : `No reference given: judged on kappa between appraisers — average <b>${f(r.kappaPairs.reduce((s, p) => s + p.kappa, 0) / r.kappaPairs.length, 2)}</b>.`)}`;
  }

  /* ================= entry point ================= */
  function msa(st, A, x) {
    const t = st.type, nm = NAME[t], top = title(nm[0], nm[1], x.ri) + header(st, A, x);
    if (!A.ready) return wrap("port msa", `${top}<div class="box" style="margin-top:12px">${esc(A.msg || "Enter the readings to see the result.")}</div>`);
    const body = t === "grr" ? grr(st, A, x) : t === "bias" ? bias(st, A, x) : t === "linearity" ? linearity(st, A, x) : t === "stability" ? stability(st, A, x) : attribute(st, A, x);
    return wrap("port msa", `${top}${body}${st.notes ? `<p class="note"><b>Notes:</b> ${esc(st.notes)}</p>` : ""}${signoff(st.conducted_by)}<p class="note">Prepared as a measurement system analysis according to the AIAG MSA manual (4th edition).</p>`);
  }
  window.AIAGForm.msa = msa;
})();
