/* AIAG SPC forms: control chart sheet (variables X̄-R, X̄-s, I-MR and attributes p, np, c, u) and the capability study sheet.
   spcControl(ch, A, x) / spcCapability(ch, A, x)
   ch = the study, A = result of the app's analyse(), x = { d, co, ri, ed, canTask, VAR, TYPES, C (SPCCalc), hasF, lockLink } */
(function () {
  "use strict";
  const F = window.AIAGForm, { esc, f, wrap, title, head, sec, signoff, shortDate, ctlSheet } = F;
  const TTL = { xr: "CONTROL CHART — X̄ AND R", xs: "CONTROL CHART — X̄ AND s", imr: "CONTROL CHART — INDIVIDUALS (X) AND MOVING RANGE (MR)", p: "CONTROL CHART — p (FRACTION NONCONFORMING)", np: "CONTROL CHART — np (NUMBER NONCONFORMING)", c: "CONTROL CHART — c (NUMBER OF NONCONFORMITIES)", u: "CONTROL CHART — u (NONCONFORMITIES PER UNIT)" };
  const SUB = "Statistical process control · AIAG SPC manual (2nd edition)";
  const ppm = (v) => (v == null ? "—" : Math.round(v).toLocaleString("en-IN"));
  const fmtD = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? m[3] + "-" + m[2] + "-" + m[1] : ""; };

  function header(ch, A, x, cols) {
    const meta = (ch.rules || {}).meta || {}, tol = A.tol, unit = ch.unit ? " " + esc(ch.unit) : "", vr = A.vr, rows = ch.rows || [];
    const spec = vr && tol.ok ? `${esc(tol.symbol)}${unit}<br><span style="font-size:9px">LSL ${tol.lsl == null ? "—" : f(tol.lsl, x.d)} · USL ${tol.usl == null ? "—" : f(tol.usl, x.d)}</span>` : "—";
    const sz = x.VAR.includes(ch.chart_type) && ch.chart_type !== "imr" ? `${esc(ch.subgroup_size)} readings` : ch.chart_type === "np" ? `${esc(ch.subgroup_size)} inspected` : ch.chart_type === "imr" ? "1 reading" : "varies";
    const per = rows.length ? fmtD(rows[0].taken_at) + (rows.length > 1 ? " to " + fmtD(rows[rows.length - 1].taken_at) : "") : "";
    if (cols === 3) return head([[["Part number", esc(ch.part_no)], ["Part name", esc(ch.part_name)], ["Characteristic", esc(ch.characteristic)]],
      [["Operation / machine", esc(ch.process)], ["Gauge used", esc(meta.gauge)], ["Unit of measure", esc(ch.unit)]],
      [["Specification", spec], ["Subgroup size · frequency", sz + (meta.freq ? " · " + esc(meta.freq) : "")], ["Study no.", esc(ch.no || "(not saved yet)")]],
      [["Company", esc(x.co)], ["Period covered", per], ["Prepared by", esc(meta.by)]]]);
    return head([[["Part number", esc(ch.part_no)], ["Part name", esc(ch.part_name)]], [["Characteristic", esc(ch.characteristic)], ["Operation / machine", esc(ch.process)]],
      [["Specification", spec], ["Unit of measure", esc(ch.unit)]], [["Gauge used", esc(meta.gauge)], ["Subgroup size · frequency", sz + (meta.freq ? " · " + esc(meta.freq) : "")]],
      [["Study no.", esc(ch.no || "(not saved yet)")], ["Chart type", esc(x.TYPES[ch.chart_type][0] + " — " + x.TYPES[ch.chart_type][1])]], [["Company", esc(x.co)], ["Period · prepared by", per + (meta.by ? " · " + esc(meta.by) : "")]]]);
  }
  const lbl = (ch, r, i) => r.label || shortD(r) || String(i + 1);
  const shortD = (r) => shortDate(r.taken_at);
  const sigText = (A, i) => { const s = A.sig.filter((z) => z.i === i); return s.length ? [...new Set(s.map((z) => z.rule))].join(",") : ""; };

  /* ================= control chart sheet ================= */
  function spcControl(ch, A, x) {
    const t = ch.chart_type, vr = A.vr, d = x.d, C = x.C, meta = (ch.rules || {}).meta || {};
    const top = title(TTL[t], SUB, x.ri) + header(ch, A, x, 3);
    if (!A.res) return wrap("land", top + `<div class="box" style="margin-top:12px">${ch.rows.length ? "Enter at least two " + (vr ? (t === "imr" ? "readings" : "groups") : "readings") + " to draw the control chart." : "No readings yet. Enter them in step 2 and the control chart, limits and conclusion are drawn here."}</div>`);
    const R = A.rows, N = R.length, res = A.res, nz = (r) => (r.vals || []).map(Number).filter(Number.isFinite);
    let grid, charts, calc = "";
    const flagged = A.flagged, dfl = A.dflagged;
    if (vr) {
      const n = A.n, nmax = t === "imr" ? 1 : Math.min(25, Math.max(...R.map((r) => nz(r).length))), V = R.map(nz);
      const fl = (set, i, v, dd) => ({ t: f(v, dd), cls: "n" + (t === "imr" ? " sm" : "") + (set[i] ? " fl" : "") });
      grid = [{ name: "SUBGROUP NO.", cell: (i) => ({ t: R[i].seq || i + 1, cls: "c" }) }, { name: "DATE / LABEL", cell: (i) => ({ t: esc(lbl(ch, R[i], i)), cls: "c" }) }];
      if (t === "imr") {
        grid.push({ name: "INDIVIDUAL X", cell: (i) => fl(flagged, i, A.vals[i], d + 1) }, { name: "MOVING RANGE MR", cell: (i) => (A.dvals[i] == null ? { t: "", cls: "c" } : fl(dfl, i, A.dvals[i], d + 1)) });
      } else {
        for (let k = 0; k < nmax; k++) grid.push({ name: "READING " + (k + 1), cell: (i) => ({ t: V[i][k] == null ? "" : f(V[i][k], d), cls: "n" }) });
        if (t === "xr") grid.push({ name: "SUM Σ", cell: (i) => ({ t: f(V[i].reduce((a, b) => a + b, 0), d), cls: "n" }) });
        grid.push({ name: t === "xr" ? "AVERAGE X̄" : "AVERAGE X̄", cell: (i) => fl(flagged, i, A.vals[i], d + 1) }, { name: t === "xr" ? "RANGE R" : "STD. DEV. s", cell: (i) => fl(dfl, i, A.dvals[i], d + 1) });
      }
      grid.push({ name: "SIGNAL (rule)", cell: (i) => ({ t: sigText(A, i), cls: "sg" }) });
      charts = t === "imr" ? [{ name: "INDIVIDUALS X", vals: A.vals, lim: A.lim, flagged, d: d + 1, h: 130 }, { name: "MOVING RANGE MR", vals: A.dvals.map((v) => (v == null ? NaN : v)), lim: A.dlim, flagged: dfl, d: d + 1, h: 100 }]
        : [{ name: "AVERAGES X̄", vals: A.vals, lim: A.lim, flagged, d: d + 1, h: 130 }, { name: t === "xr" ? "RANGES R" : "STD. DEV. s", vals: A.dvals, lim: A.dlim, flagged: dfl, d: d + 1, h: 100 }];
      // calculations and constants (as at the foot of the AIAG chart)
      const k = C.K(Math.max(2, n || 2)), l = res.lim[res.lim.length - 1], row = (a, b, c) => `<tr><td>${a}</td><td class="eq">${b}</td><td class="n"><b>${c}</b></td></tr>`;
      const lf = Number(ch.limits_from) || 0;
      let L1, K1;
      if (t === "imr") { L1 = row("X̄ = ΣX / k", `Σ ${f(res.grand * res.k, d + 1)} / ${res.k}`, f(res.grand, d + 2)) + row("MR̄ = ΣMR / (k − 1)", `average moving range`, f(res.dbar, d + 2)) + row("UCL X = X̄ + 2.660 × MR̄", `${f(res.grand, d + 2)} + 2.660 × ${f(res.dbar, d + 2)}`, f(l.x.ucl, d + 2)) + row("LCL X = X̄ − 2.660 × MR̄", `${f(res.grand, d + 2)} − 2.660 × ${f(res.dbar, d + 2)}`, f(l.x.lcl, d + 2)) + row("UCL MR = 3.267 × MR̄", `3.267 × ${f(res.dbar, d + 2)}`, f(l.d.ucl, d + 2)) + row("LCL MR", "n = 2 → D₃ = 0", f(l.d.lcl, d + 2)) + row("σ̂ = MR̄ / d₂", `${f(res.dbar, d + 2)} / 1.128`, f(res.sigma, d + 3));
        K1 = [["Subgroup size n", "1 (moving range of 2)"], ["E₂ (2.660 = 3 / d₂)", "2.660"], ["D₄", "3.267"], ["D₃", "0"], ["d₂", "1.128"]]; }
      else if (t === "xr") { L1 = row("X̿ = ΣX̄ / k", `Σ ${f(res.grand * res.k, d + 1)} / ${res.k}`, f(res.grand, d + 2)) + row("R̄ = ΣR / k", `average range of ${res.k} groups`, f(res.dbar, d + 2)) + row("UCL X̄ = X̿ + A₂ R̄", `${f(res.grand, d + 2)} + ${f(k.A2, 3)} × ${f(res.dbar, d + 2)}`, f(l.x.ucl, d + 2)) + row("LCL X̄ = X̿ − A₂ R̄", `${f(res.grand, d + 2)} − ${f(k.A2, 3)} × ${f(res.dbar, d + 2)}`, f(l.x.lcl, d + 2)) + row("UCL R = D₄ R̄", `${f(k.D4, 3)} × ${f(res.dbar, d + 2)}`, f(l.d.ucl, d + 2)) + row("LCL R = D₃ R̄", `${f(k.D3, 3)} × ${f(res.dbar, d + 2)}`, f(l.d.lcl, d + 2)) + row("σ̂ = R̄ / d₂", `${f(res.dbar, d + 2)} / ${f(k.d2, 3)}`, f(res.sigma, d + 3));
        K1 = [["Subgroup size n", n], ["A₂", f(k.A2, 3)], ["D₃", f(k.D3, 3)], ["D₄", f(k.D4, 3)], ["d₂", f(k.d2, 3)]]; }
      else { L1 = row("X̿ = ΣX̄ / k", `Σ ${f(res.grand * res.k, d + 1)} / ${res.k}`, f(res.grand, d + 2)) + row("s̄ = Σs / k", `average standard deviation`, f(res.dbar, d + 2)) + row("UCL X̄ = X̿ + A₃ s̄", `${f(res.grand, d + 2)} + ${f(k.A3, 3)} × ${f(res.dbar, d + 2)}`, f(l.x.ucl, d + 2)) + row("LCL X̄ = X̿ − A₃ s̄", `${f(res.grand, d + 2)} − ${f(k.A3, 3)} × ${f(res.dbar, d + 2)}`, f(l.x.lcl, d + 2)) + row("UCL s = B₄ s̄", `${f(k.B4, 3)} × ${f(res.dbar, d + 2)}`, f(l.d.ucl, d + 2)) + row("LCL s = B₃ s̄", `${f(k.B3, 3)} × ${f(res.dbar, d + 2)}`, f(l.d.lcl, d + 2)) + row("σ̂ = s̄ / c₄", `${f(res.dbar, d + 2)} / ${f(k.c4, 4)}`, f(res.sigma, d + 3));
        K1 = [["Subgroup size n", n], ["A₃", f(k.A3, 3)], ["B₃", f(k.B3, 3)], ["B₄", f(k.B4, 3)], ["c₄", f(k.c4, 4)]]; }
      calc = `<div class="two avoid" style="grid-template-columns:2.4fr 1fr"><div><table><colgroup><col style="width:34%"><col style="width:42%"><col style="width:24%"></colgroup><thead><tr><th>Quantity</th><th>Calculation</th><th>Value</th></tr></thead><tbody>${L1}</tbody></table></div>
        <div><table><thead><tr><th colspan="2">Constants used</th></tr></thead><tbody>${K1.map((z) => `<tr><td>${z[0]}</td><td class="n">${z[1]}</td></tr>`).join("")}</tbody></table></div></div>
        <p class="note">${res.k} ${t === "imr" ? "readings" : "groups"} used${lf ? ` (limits worked out from the first ${lf})` : ""}. Control limits are ±3 σ of the plotted statistic about the centre line. ${n && t !== "imr" && new Set(res.n).size > 1 ? "Group sizes differ; limits are worked out for each group size." : ""}</p>`;
    } else {
      const Lm = res.lim, vals = A.vals, name = { p: "p", np: "np", c: "c", u: "u" }[t];
      grid = [{ name: "SAMPLE NO.", cell: (i) => ({ t: R[i].seq || i + 1, cls: "c" }) }, { name: "DATE / LABEL", cell: (i) => ({ t: esc(lbl(ch, R[i], i)), cls: "c" }) }];
      if (t !== "c") grid.push({ name: t === "u" ? "UNITS CHECKED n" : "SAMPLE SIZE n", cell: (i) => ({ t: R[i].vals[1], cls: "n" }) });
      grid.push({ name: t === "p" || t === "np" ? "NUMBER NONCONFORMING" : "NUMBER OF NONCONFORMITIES", cell: (i) => ({ t: R[i].vals[0], cls: "n" }) },
        { name: "PLOTTED " + name, cell: (i) => ({ t: f(vals[i], t === "p" || t === "u" ? 4 : 2), cls: "n" + (flagged[i] ? " fl" : "") }) },
        { name: "UCL", cell: (i) => ({ t: f(Lm[i].ucl, t === "p" || t === "u" ? 4 : 2), cls: "n" }) }, { name: "LCL", cell: (i) => ({ t: f(Lm[i].lcl, t === "p" || t === "u" ? 4 : 2), cls: "n" }) },
        { name: "SIGNAL (rule)", cell: (i) => ({ t: sigText(A, i), cls: "sg" }) });
      charts = [{ name: { p: "FRACTION p", np: "NUMBER np", c: "NUMBER c", u: "PER UNIT u" }[t], vals, lim: Lm, flagged, d: t === "p" || t === "u" ? 4 : 2, h: 170 }];
      const l = Lm[Lm.length - 1], rr = (a, b, c) => `<tr><td>${a}</td><td class="eq">${b}</td><td class="n"><b>${c}</b></td></tr>`, fm = t === "p" || t === "u" ? 4 : 2, vary = new Set(R.map((r) => r.vals[1])).size > 1;
      const rows = t === "p" ? rr("p̄ = Σnp / Σn", `${res.defects} / ${res.units}`, f(res.cl, 4)) + rr("UCL p = p̄ + 3 √[p̄(1 − p̄) / n]", vary ? "worked out for each sample size" : `n = ${R[0].vals[1]}`, f(l.ucl, 4)) + rr("LCL p = p̄ − 3 √[p̄(1 − p̄) / n]", "not below 0", f(l.lcl, 4))
        : t === "np" ? rr("p̄ = Σnp / Σn", `${res.defects} / ${res.units}`, f(res.defects / res.units, 4)) + rr("n p̄ (centre line)", `n = ${R[0].vals[1]}`, f(res.cl, 2)) + rr("UCL np = n p̄ + 3 √[n p̄ (1 − p̄)]", "", f(l.ucl, 2)) + rr("LCL np = n p̄ − 3 √[n p̄ (1 − p̄)]", "not below 0", f(l.lcl, 2))
        : t === "c" ? rr("c̄ = Σc / k", `${res.defects} / ${res.k}`, f(res.cl, 2)) + rr("UCL c = c̄ + 3 √c̄", "", f(l.ucl, 2)) + rr("LCL c = c̄ − 3 √c̄", "not below 0", f(l.lcl, 2))
        : rr("ū = Σc / Σn", `${res.defects} / ${res.units}`, f(res.cl, 4)) + rr("UCL u = ū + 3 √(ū / n)", vary ? "worked out for each sample size" : `n = ${R[0].vals[1]}`, f(l.ucl, 4)) + rr("LCL u = ū − 3 √(ū / n)", "not below 0", f(l.lcl, 4));
      calc = `<table class="avoid"><colgroup><col style="width:36%"><col style="width:40%"><col style="width:24%"></colgroup><thead><tr><th>Quantity</th><th>Calculation</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table><p class="note">${res.k} samples used. Control limits are ±3 σ about the centre line.</p>`;
    }
    const sheet = ctlSheet({ n: N, cols: 20, grid, charts });
    // signals, causes and actions
    const sigs = A.sig.length ? `<table class="avoid"><colgroup><col style="width:9%"><col style="width:12%"><col style="width:25%"><col style="width:22%"><col style="width:22%"><col style="width:10%"></colgroup><thead><tr><th>Subgroup</th><th>Chart</th><th>Signal</th><th>Cause found</th><th>Action taken</th><th>By / date</th></tr></thead><tbody>${A.sig.map((s, k) => `<tr><td class="c"><b>${esc(lbl(ch, s.row, s.i))}</b></td><td>${esc(s.on)}</td><td>${esc(s.text)}</td>
        <td>${x.ed ? `<textarea rows="2" data-cause="${s.row.id}" placeholder="What made this happen?">${esc(s.row.cause || "")}</textarea>` : esc(s.row.cause || "")}</td><td>${x.ed ? `<textarea rows="2" data-action="${s.row.id}" placeholder="What was done about it?">${esc(s.row.action || "")}</textarea>` : esc(s.row.action || "")}</td>
        <td class="c">${x.canTask ? `<button class="btn s o noprint" data-task="${k}">→ Task</button>` : ""}</td></tr>`).join("")}</tbody></table>${x.ed ? '<p class="note scr">Cause and action are saved as soon as you leave the box.</p>' : ""}` : `<table class="avoid"><tbody><tr><td class="c" style="height:24px">No signals: no point outside the control limits and no run or trend pattern in the rules selected.</td></tr></tbody></table>`;
    const sigN = new Set(A.sig.map((s) => s.i)).size, cap = A.cap, few = (A.rows.length < 25 && vr && t !== "imr") || (A.rows.length < 100 && t === "imr") || (!vr && A.rows.length < 20);
    const concl = [sigN ? `<b>The process is not in statistical control:</b> ${sigN} ${t === "imr" || !vr ? "point" : "subgroup"}${sigN > 1 ? "s show" : " shows"} a signal. Find and remove the special causes, then start a new study; capability figures are only a rough guide until the process is stable.` : "<b>The process is in statistical control</b> for the rules selected: only common-cause variation is shown.",
      few ? `Only ${A.rows.length} ${vr ? (t === "imr" ? "readings" : "subgroups") : "samples"} so far. The manual asks for at least ${vr ? (t === "imr" ? "100 readings" : "25 subgroups (100 or more readings)") : "20 to 25 samples"} before the limits are relied on.` : "",
      vr && cap && cap.cpk != null ? `Capability: Cpk ${f(cap.cpk, 2)}, Ppk ${f(cap.ppk, 2)} — see the capability study sheet.` : ""].filter(Boolean);
    const capSum = vr && cap ? `${sec("Process capability — summary")}<table class="avoid" style="margin-top:4px"><thead><tr><th>Cp</th><th>Cpk</th><th>Pp</th><th>Ppk</th><th>Cpm</th><th>Readings</th><th>Mean</th><th><span style="text-transform:none">σ</span> within</th><th><span style="text-transform:none">σ</span> overall</th></tr></thead><tbody><tr><td class="c">${f(cap.cp, 2)}</td><td class="c"><b>${f(cap.cpk, 2)}</b></td><td class="c">${f(cap.pp, 2)}</td><td class="c"><b>${f(cap.ppk, 2)}</b></td><td class="c">${f(cap.cpm, 2)}</td><td class="c">${cap.n}</td><td class="c">${f(cap.mean, d + 2)}</td><td class="c">${f(cap.sdWithin, d + 3)}</td><td class="c">${f(cap.sdOverall, d + 3)}</td></tr></tbody></table>` : "";
    return wrap("land", `${top}${sec("Subgroup data and control charts")}${sheet}${sec("Centre lines and control limits")}<div style="margin-top:4px">${calc}</div>${sec("Signals — causes and actions")}<div style="margin-top:4px">${sigs}</div><div class="avoid">${capSum}${sec("Conclusion")}<ul>${concl.map((z) => `<li>${z}</li>`).join("")}</ul>${ch.notes ? `<p class="note"><b>Notes:</b> ${esc(ch.notes)}</p>` : ""}${signoff(meta.by)}
      <p class="note">Prepared as an SPC control chart study according to the AIAG Statistical Process Control manual (2nd edition): limits from the data, ±3 σ, run-rule signals with cause and action.</p></div>`);
  }

  /* ================= capability study sheet ================= */
  function hist(X, tol, cap, d) {
    const C = window.SPCCalc, H = C.histogram(X), W = 1000, Ht = 250, L = 30, R = 30, T = 28, B = 36; if (!H.counts.length) return "";
    const lo = Math.min(H.edges[0], tol.lsl != null ? tol.lsl : Infinity), hi = Math.max(H.edges[H.edges.length - 1], tol.usl != null ? tol.usl : -Infinity), span = hi - lo || 1, x = (v) => L + ((v - lo) / span) * (W - L - R);
    const N = X.filter(Number.isFinite).length, pdf = (v, m, sg) => (sg > 0 ? Math.exp(-0.5 * ((v - m) / sg) ** 2) / (sg * Math.sqrt(2 * Math.PI)) : 0), cv = (sg) => (sg > 0 ? H.width * N * pdf(cap.mean, cap.mean, sg) : 0);
    const mx = Math.max(...H.counts, cv(cap.sdWithin), cv(cap.sdOverall)), y = (c) => T + (1 - c / mx) * (Ht - T - B);
    const curve = (sg, dash) => { if (!(sg > 0)) return ""; const pts = Array.from({ length: 81 }, (_, k) => { const v = lo + (span * k) / 80; return x(v).toFixed(1) + "," + y(H.width * N * pdf(v, cap.mean, sg)).toFixed(1); }); return `<polyline points="${pts.join(" ")}" fill="none" stroke="#000" stroke-width="1.6"${dash ? ' stroke-dasharray="7 4"' : ""}/>`; };
    const vl = (v, lb, dash, col, inside) => (v == null ? "" : `<line x1="${x(v)}" x2="${x(v)}" y1="${T - 6}" y2="${Ht - B}" stroke="${col}" stroke-width="1.6"${dash ? ` stroke-dasharray="${dash}"` : ""}/><text x="${inside ? x(v) + 5 : x(v)}" y="${inside ? T + 14 : T - 10}" text-anchor="${inside ? "start" : "middle"}" font-size="12" font-weight="700" fill="${col}" font-family="Arial">${lb} ${Number(v).toFixed(d)}</text>`);
    return `<svg viewBox="0 0 ${W} ${Ht}" role="img" aria-label="Histogram against the specification"><rect x="${L}" y="${T}" width="${W - L - R}" height="${Ht - T - B}" fill="#fff" stroke="#000"/>
      ${H.counts.map((c, i) => `<rect x="${x(H.edges[i]) + 1}" y="${y(c)}" width="${Math.max(1, x(H.edges[i + 1]) - x(H.edges[i]) - 2)}" height="${Ht - B - y(c)}" fill="#cfd5dd" stroke="#000" stroke-width=".8"/>`).join("")}
      ${curve(cap.sdWithin)}${curve(cap.sdOverall, 1)}${vl(tol.lsl, "LSL", "", "#c00000")}${vl(tol.usl, "USL", "", "#c00000")}${vl(tol.target, "Target", "5 3", "#1d4ed8")}${vl(cap.mean, "Mean", "2 3", "#006400", 1)}
      ${[lo, lo + span / 2, hi].map((v, i) => `<text x="${x(v)}" y="${Ht - 14}" text-anchor="${i === 0 ? "start" : i === 2 ? "end" : "middle"}" font-size="12" font-family="Arial">${v.toFixed(d)}</text>`).join("")}</svg>`;
  }
  function spcCapability(ch, A, x) {
    const t = ch.chart_type, d = x.d, tol = A.tol, cap = A.cap, res = A.res, meta = (ch.rules || {}).meta || {}, C = x.C;
    const top = title("PROCESS CAPABILITY STUDY", "Cp, Cpk, Pp, Ppk · AIAG SPC manual (2nd edition) · PPAP initial process study", x.ri) + header(ch, A, x, 2);
    const note = (m) => wrap("port", `${top}<div class="box" style="margin-top:12px">${m}</div>`);
    if (!A.vr) return note("A capability study (Cp, Cpk) needs measured values. Counted data (rejected parts, defects) is judged by the p, np, c or u chart and its centre line — the average fraction or number of nonconformities.");
    if (!tol.ok) return note("Enter the specification in step 1 (choose how the tolerance is written and type the values). Cp, Cpk, Pp and Ppk are worked out from it.");
    if (!x.hasF("spc.capability-analysis")) return note('Capability analysis is not part of your plan. <a href="#" id="capLock">Find out how to add it</a>');
    if (!res || !cap) return note("Enter at least two " + (t === "imr" ? "readings" : "groups") + " in step 2 and the capability study sheet is filled in here.");
    const sigN = new Set(A.sig.map((s) => s.i)).size, nG = A.rows.length, few = t === "imr" ? nG < 100 : nG < 25, skewed = Math.abs(cap.skew) > 1, hasG = !!meta.gauge;
    const yn = (ok) => (ok ? "YES" : "NO");
    const chk = (q, ok, why) => `<tr><td>${q}</td><td class="c"><b>${yn(ok)}</b></td><td>${why}</td></tr>`;
    const v = (z) => (z == null ? "—" : C.verdict(z).toUpperCase());
    const ir = (a, b, val) => `<tr><td><b>${a}</b></td><td class="eq">${b}</td><td class="n"><b>${f(val, 2)}</b></td><td class="c">${v(val)}</td></tr>`;
    const out = [sigN ? `<b>The process was not stable</b> (${sigN} signal${sigN > 1 ? "s" : ""} on the control chart): Cp and Cpk describe a stable process, so these figures are a rough guide until the special causes are removed.` : "The control chart shows no signals: the process was stable during the study, so the indices are meaningful.",
      `<b>Within-group capability:</b> Cp ${f(cap.cp, 2)}${cap.cpk != null ? ", Cpk " + f(cap.cpk, 2) + " — " + C.verdict(cap.cpk).toLowerCase() : ""}.${cap.cp != null && cap.cpk != null && cap.cp - cap.cpk > 0.15 ? " Cp is clearly higher than Cpk: the spread would fit but the average is off-centre — re-centre the process first." : ""}`,
      `<b>Long-term performance:</b> Pp ${f(cap.pp, 2)}${cap.ppk != null ? ", Ppk " + f(cap.ppk, 2) + " — " + C.verdict(cap.ppk).toLowerCase() : ""}. Expected ${ppm(cap.ppmOverall)} ppm outside the specification (overall spread).`];
    if (cap.ppk != null) out.push(cap.ppk >= 1.67 ? "Meets the usual PPAP initial-study requirement (Ppk ≥ 1.67)." : cap.ppk >= 1.33 ? "Does not reach the usual PPAP initial-study requirement (Ppk ≥ 1.67) but meets 1.33 for ongoing production. Follow the customer's requirement." : "Does not meet the usual requirements (Ppk ≥ 1.67 initial study, Cpk ≥ 1.33 in production). Reduce variation, re-centre the process, or agree containment and a reaction plan with the customer.");
    if (few) out.push(`Only ${nG} ${t === "imr" ? "readings" : "subgroups"}: the manual asks for ${t === "imr" ? "100 readings" : "at least 25 subgroups (100 or more readings)"} before the indices are relied on.`);
    if (skewed) out.push("The readings are clearly skewed. The indices assume a roughly normal distribution — check the histogram and use a method for non-normal data if needed.");
    const sg = t === "xs" ? "s̄ / c₄" : t === "imr" ? "MR̄ / 1.128" : "R̄ / d₂";
    return wrap("port", `${top}${sec("1 · Conditions of the study")}<table style="margin-top:4px"><colgroup><col style="width:34%"><col style="width:10%"><col></colgroup><thead><tr><th>Check</th><th>Yes / No</th><th>Comment</th></tr></thead><tbody>
      ${chk("Process in statistical control?", !sigN, sigN ? sigN + " signal(s) on the control chart." : "No signals on the control chart.")}${chk("Measurement system known and acceptable?", hasG, hasG ? esc(meta.gauge) + " — keep its Gage R&R (under 10 %, or up to 30 % by agreement) on file." : "Name the gauge in step 1 and keep its MSA on file.")}
      ${chk("Enough data (25 subgroups / 100 readings)?", !few, nG + " " + (t === "imr" ? "readings" : "subgroups") + ", " + cap.n + " readings in all.")}${chk("Distribution roughly normal?", !skewed, "Skewness " + f(cap.skew, 2) + ", kurtosis " + f(cap.kurt, 2) + (skewed ? " — clearly skewed." : "."))}</tbody></table>
      ${sec("2 · Data summary")}<table style="margin-top:4px"><tbody><tr><th>Readings</th><td class="n">${cap.n}</td><th>Mean X̄</th><td class="n">${f(cap.mean, d + 2)}</td><th>Lowest</th><td class="n">${f(cap.min, d + 2)}</td><th>Highest</th><td class="n">${f(cap.max, d + 2)}</td></tr>
      <tr><th>LSL</th><td class="n">${tol.lsl == null ? "—" : f(tol.lsl, d + 2)}</td><th>USL</th><td class="n">${tol.usl == null ? "—" : f(tol.usl, d + 2)}</td><th>Target</th><td class="n">${tol.target == null ? "—" : f(tol.target, d + 2)}</td><th>Tolerance</th><td class="n">${tol.tolerance == null ? "—" : f(tol.tolerance, d + 2)}</td></tr>
      <tr><th><span style="text-transform:none">σ</span> within</th><td class="n">${f(cap.sdWithin, d + 3)}</td><th><span style="text-transform:none">σ</span> overall (s)</th><td class="n">${f(cap.sdOverall, d + 3)}</td><th>Outside spec.</th><td class="n">${cap.outOfSpec} of ${cap.n}</td><th>Skew · kurtosis</th><td class="n">${f(cap.skew, 2)} · ${f(cap.kurt, 2)}</td></tr></tbody></table>
      <p class="note">σ within = ${sg}; σ overall = standard deviation of all ${cap.n} readings.</p>
      ${sec("3 · Histogram of all readings against the specification")}<div class="avoid" style="margin-top:4px">${hist(res.all, tol, cap, d)}<p class="note">Solid curve: normal distribution from the within-group σ · dashed curve: from the overall σ · bars: readings.</p></div>
      ${sec("4 · Capability and performance indices")}<div class="two" style="margin-top:4px"><div><div class="sub" style="margin-top:0">Within-group (potential) capability</div><table><colgroup><col style="width:16%"><col style="width:44%"><col style="width:16%"><col style="width:24%"></colgroup><thead><tr><th>Index</th><th>Formula</th><th>Value</th><th>Verdict</th></tr></thead><tbody>${ir("Cp", "(USL − LSL) / 6σ", cap.cp)}${ir("CPU", "(USL − X̄) / 3σ", cap.cpu)}${ir("CPL", "(X̄ − LSL) / 3σ", cap.cpl)}${ir("Cpk", "min (CPU, CPL)", cap.cpk)}</tbody></table><p class="note">Expected outside specification: <b>${ppm(cap.ppmWithin)} ppm</b></p></div>
      <div><div class="sub" style="margin-top:0">Overall (long-term) performance</div><table><colgroup><col style="width:16%"><col style="width:44%"><col style="width:16%"><col style="width:24%"></colgroup><thead><tr><th>Index</th><th>Formula</th><th>Value</th><th>Verdict</th></tr></thead><tbody>${ir("Pp", "(USL − LSL) / 6s", cap.pp)}${ir("PPU", "(USL − X̄) / 3s", cap.ppu)}${ir("PPL", "(X̄ − LSL) / 3s", cap.ppl)}${ir("Ppk", "min (PPU, PPL)", cap.ppk)}${cap.cpm != null ? ir("Cpm", "(USL−LSL) / 6√(s²+(X̄−T)²)", cap.cpm) : ""}</tbody></table><p class="note">Expected outside specification: <b>${ppm(cap.ppmOverall)} ppm</b></p></div></div>
      ${sec("5 · Assessment criteria")}<table style="margin-top:4px"><thead><tr><th>Index value</th><th>Verdict</th><th>Meaning</th></tr></thead><tbody><tr><td class="c">1.67 or more</td><td class="c">CAPABLE</td><td>Meets the usual initial-study requirement (PPAP, Ppk).</td></tr><tr><td class="c">1.33 to below 1.67</td><td class="c">ACCEPTABLE</td><td>Usual requirement for ongoing production (Cpk).</td></tr><tr><td class="c">1.00 to below 1.33</td><td class="c">MARGINAL</td><td>Process needs close control; improvement action expected.</td></tr><tr><td class="c">Below 1.00</td><td class="c">NOT CAPABLE</td><td>The process cannot reliably meet the specification — act on the process, 100 % inspect meanwhile.</td></tr></tbody></table>
      <div class="avoid">${sec("6 · Conclusion")}<ul>${out.map((z) => `<li>${z}</li>`).join("")}</ul>${signoff(meta.by)}
      <p class="note">Prepared as a process capability study according to the AIAG SPC manual (Cp and Cpk from the within-group spread; Pp and Ppk from the overall spread) and the PPAP initial process study guidance.</p></div>`);
  }
  window.AIAGForm.spcControl = spcControl; window.AIAGForm.spcCapability = spcCapability;
})();
