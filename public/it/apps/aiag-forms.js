/* AIAG-style report forms — the printed / on-screen "paper" for SPC Charts and MSA Studies.
   Plain black-on-white forms with ruled boxes, laid out as in the AIAG SPC manual (2nd ed.) and MSA manual (4th ed.):
     SPC   control chart sheet (subgroup data grid with the charts printed directly under the columns), capability study sheet
     MSA   Gage R&R data sheet and report, bias, linearity, stability and attribute study sheets
   Core helpers here; SPC forms below; MSA forms are in aiag-msa.js. Everything returns an HTML string. */
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const f = (v, d) => (v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toFixed(d == null ? 3 : d));
  const CSS = `
  .fmwrap{background:#fff;border:1px solid #cfd6e0;border-radius:4px;padding:14px;overflow-x:auto;color:#000}
  .fm{font:12px/1.35 Arial,Helvetica,sans-serif;color:#000;background:#fff}
  .fm.land{min-width:1040px}.fm.port{min-width:700px}
  .fm table{border-collapse:collapse;width:100%;table-layout:fixed;margin:0}
  .fm th,.fm td{border:1px solid #000;padding:2px 4px;font-size:11px;vertical-align:middle;overflow-wrap:anywhere;text-align:left;background:none;color:#000;font-weight:400}
  .fm th{background:#e9ecf1;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.02em}
  .fm td.c,.fm th.c{text-align:center}.fm td.n{text-align:right;font-variant-numeric:tabular-nums}
  .fm td.fl{background:#fbd5d5;font-weight:700}.fm td.sg{color:#b00000;font-weight:700;text-align:center}
  .fm .fmt{margin-bottom:6px}.fm .fmt td{border:0;border-bottom:2.5px solid #000;padding:0 0 4px}
  .fm .t1{font-size:19px;font-weight:700;letter-spacing:.02em}.fm .t2{font-size:11px;color:#333;margin-top:1px}
  .fm .tr{text-align:right;width:34%;font-size:10px;line-height:1.5;vertical-align:bottom}
  .fm.msa th{text-transform:none}
  .fm td.sm{font-size:7.5px;letter-spacing:-.3px;white-space:nowrap;padding-left:1px;padding-right:1px}
  .fm .sec{margin:12px 0 0;padding:3px 6px;background:#1f2937;color:#fff;font-weight:700;font-size:11px;letter-spacing:.04em;text-transform:uppercase}
  .fm .sub{font-weight:700;font-size:11px;margin:8px 0 3px}
  .fm .note{font-size:10px;color:#333;margin:3px 0 0}
  .fm .two{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start}
  .fm .three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;align-items:start}
  .fm .blk{margin-top:10px}.fm svg{display:block;width:100%;height:auto}
  .fm .box{border:1.5px solid #000;padding:6px 8px;margin-top:8px}.fm .box b.res{font-size:13px}
  .fm ul{margin:4px 0 0;padding-left:18px}.fm li{margin:1px 0;font-size:11px}
  .fm textarea{width:100%;border:0;background:#fff8e1;font:11px Arial;resize:vertical;min-height:32px;padding:2px;box-sizing:border-box}
  .fm .btn.s{padding:2px 8px;font-size:11px}
  .fm .sign th,.fm .sign td{height:30px}
  .fm .leg{font-size:10px;margin:2px 0 0;display:flex;gap:14px;flex-wrap:wrap}
  .fm .scr{font-size:10px;color:#444}
  .fm .eq{font-family:"Cambria Math","Times New Roman",serif}
  @media print{
    .fmwrap{border:0!important;padding:0!important;overflow:visible!important;border-radius:0}
    .fm.land,.fm.port{min-width:0!important}
    .fm{font-size:8.5pt}.fm th,.fm td{font-size:7.6pt;padding:.8pt 2.5pt}.fm th{font-size:7pt}
    .fm .t1{font-size:13pt}.fm .fmt{margin-bottom:4px}.fm .sec{margin-top:7px!important}.fm .blk{margin-top:5px}.fm .t2,.fm .tr{font-size:7.6pt}.fm .sec{font-size:8pt;print-color-adjust:exact;-webkit-print-color-adjust:exact}.fm th,.fm td.fl{print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .fm .blk,.fm .box,.fm .avoid,.fm table tr{break-inside:avoid}.fm .scr{display:none}.fm textarea{background:#fff;border:0;min-height:0;font-size:7.6pt}
  }`;
  function css() { if (document.getElementById("aiag-css")) return; const s = document.createElement("style"); s.id = "aiag-css"; s.textContent = CSS; document.head.append(s); }
  css();

  /* ---------- blocks used by every form ---------- */
  const wrap = (cls, inner) => `<div class="fmwrap"><div class="fm ${cls} no-sno">${inner}</div></div>`;
  function title(main, sub, ri) {
    const r = ri ? `<span class="scr"><b>Report ref. no.</b> ${esc(ri.ref)}<br><b>Format</b> ${esc(ri.format)} · Rev ${esc(ri.rev)} · ${esc(ri.date)}</span>` : "";
    return `<table class="fmt"><tbody><tr><td><div class="t1">${main}</div><div class="t2">${sub}</div></td><td class="tr">${r}</td></tr></tbody></table>`;
  }
  /* header grid: rows of [label, value] pairs; pairs per row must be equal */
  function head(rows) {
    const n = rows[0].length, lw = n === 3 ? 12 : 18, vw = (100 - lw * n) / n;
    return `<table><colgroup>${Array.from({ length: n }, () => `<col style="width:${lw}%"><col style="width:${vw}%">`).join("")}</colgroup><tbody>${rows.map((r) => `<tr>${r.map((p) => `<th>${p[0]}</th><td>${p[1] == null || p[1] === "" ? "—" : p[1]}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  const sec = (t) => `<div class="sec">${t}</div>`;
  const signoff = (by) => `<table class="sign avoid" style="margin-top:10px"><colgroup><col style="width:13%"><col style="width:20%"><col style="width:7%"><col style="width:10%"><col style="width:15%"><col style="width:20%"><col style="width:7%"><col style="width:8%"></colgroup><tbody><tr><th>Prepared by</th><td>${esc(by || "")}</td><th>Date</th><td></td><th>Reviewed / approved by</th><td></td><th>Date</th><td></td></tr></tbody></table>`;
  const shortDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? m[3] + "-" + m[2] : ""; };

  /* ---------- charts printed under the columns of a data grid ----------
     o: { n, cols, grid:[{name, cell(i)->{t, cls}}], charts:[{name, vals, lim:[{ucl,cl,lcl}], flagged:{}, d, ref}] } */
  function ctlSheet(o) {
    const N = o.n, C = o.cols || 20, B = Math.max(1, Math.ceil(N / C)), LW = 140, W = 1000, cw = (W - LW) / C;
    const rg = o.charts.map((c) => { const ys = []; c.vals.forEach((v) => Number.isFinite(v) && ys.push(v)); c.lim.forEach((l) => l && [l.ucl, l.cl, l.lcl].forEach((v) => Number.isFinite(v) && ys.push(v))); if (c.ref != null) ys.push(c.ref); let lo = Math.min(...ys), hi = Math.max(...ys); const p = (hi - lo) * 0.1 || 1; return [lo - p, hi + p]; });
    let out = "";
    for (let b = 0; b < B; b++) {
      const i0 = b * C, i1 = Math.min(N, i0 + C), pct = (100 - 14) / C;
      const rows = o.grid.map((g) => `<tr><th style="font-size:9px">${g.name}</th>${Array.from({ length: C }, (_, k) => { const i = i0 + k; if (i >= i1) return "<td></td>"; const c = g.cell(i) || {}; return `<td class="${c.cls || "c"}">${c.t == null ? "" : c.t}</td>`; }).join("")}</tr>`).join("");
      const tbl = `<table style="table-layout:fixed"><colgroup><col style="width:14%">${Array.from({ length: C }, () => `<col style="width:${pct}%">`).join("")}</colgroup><tbody>${rows}</tbody></table>`;
      const svgs = o.charts.map((c, ci) => {
        const H = (c.h || 150) + 12, T = 20, Bm = 8, [lo, hi] = rg[ci], Y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - Bm), X = (i) => LW + (i - i0 + 0.5) * cw, d = c.d == null ? 3 : c.d;
        const idx = Array.from({ length: i1 - i0 }, (_, k) => i0 + k), line = (k) => idx.filter((i) => c.lim[i] && Number.isFinite(c.lim[i][k])).map((i, j) => (j ? "L" : "M") + X(i).toFixed(1) + " " + Y(c.lim[i][k]).toFixed(1)).join("");
        const last = c.lim[i1 - 1] || {}, lab = (v, t, col) => (Number.isFinite(v) ? `<text x="${LW - 6}" y="${Y(v) + 3.5}" text-anchor="end" font-size="11" fill="${col}" font-family="Arial">${t} ${Number(v).toFixed(d)}</text>` : "");
        const pts = idx.filter((i) => Number.isFinite(c.vals[i]));
        return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.name)}"><rect x="${LW}" y="${T}" width="${W - LW}" height="${H - T - Bm}" fill="#fff" stroke="#000" stroke-width="1"/>
          ${Array.from({ length: C + 1 }, (_, k) => `<line x1="${LW + k * cw}" x2="${LW + k * cw}" y1="${T}" y2="${H - Bm}" stroke="#d6dae0" stroke-width=".7"/>`).join("")}
          ${[0.25, 0.5, 0.75].map((q) => `<line x1="${LW}" x2="${W}" y1="${T + q * (H - T - Bm)}" y2="${T + q * (H - T - Bm)}" stroke="#eceff3" stroke-width=".7"/>`).join("")}
          <text x="6" y="14" font-size="12" font-weight="700" font-family="Arial">${c.name}</text>
          <path d="${line("ucl")}" fill="none" stroke="#c00000" stroke-width="1.3" stroke-dasharray="6 3"/><path d="${line("lcl")}" fill="none" stroke="#c00000" stroke-width="1.3" stroke-dasharray="6 3"/><path d="${line("cl")}" fill="none" stroke="#006400" stroke-width="1.4"/>
          ${c.ref != null ? `<line x1="${LW}" x2="${W}" y1="${Y(c.ref)}" y2="${Y(c.ref)}" stroke="#1d4ed8" stroke-width="1.2" stroke-dasharray="2 3"/>${lab(c.ref, "Master", "#1d4ed8")}` : ""}
          ${lab(last.ucl, "UCL", "#c00000")}${lab(last.cl, "CL", "#006400")}${lab(last.lcl, "LCL", "#c00000")}
          <polyline fill="none" stroke="#000" stroke-width="1.2" points="${pts.map((i) => X(i).toFixed(1) + "," + Y(c.vals[i]).toFixed(1)).join(" ")}"/>
          ${pts.map((i) => (c.flagged && c.flagged[i] ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(c.vals[i]).toFixed(1)}" r="5.2" fill="#c00000" stroke="#000" stroke-width=".8"/>` : `<rect x="${(X(i) - 2.8).toFixed(1)}" y="${(Y(c.vals[i]) - 2.8).toFixed(1)}" width="5.6" height="5.6" fill="#000"/>`)).join("")}</svg>`;
      }).join("");
      out += `<div class="blk">${B > 1 ? `<div class="sub" style="margin-top:0">Subgroups ${i0 + 1} to ${i1}</div>` : ""}${tbl}${svgs}</div>`;
    }
    return out;
  }
  /* simple multi-line chart (MSA): series [{name, vals, dash, shape}], hlines [{v, t, col, dash}], x labels */
  function lineChart(o) {
    const W = 1000, H = o.h || 220, L = 70, R = 90, T = 14, B = 28, n = o.labels.length, ys = []; o.series.forEach((s) => s.vals.forEach((v) => Number.isFinite(v) && ys.push(v))); (o.hlines || []).forEach((h) => ys.push(h.v)); if (!ys.length) return "";
    let lo = Math.min(...ys), hi = Math.max(...ys); const p = (hi - lo) * 0.1 || 1; lo -= p; hi += p; const d = o.d == null ? 3 : o.d;
    const X = (i) => L + (n <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1)), Y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B), tick = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
    const mk = (s, x, y) => (s.shape === "sq" ? `<rect x="${x - 3.2}" y="${y - 3.2}" width="6.4" height="6.4" fill="${s.fill || "#fff"}" stroke="#000"/>` : s.shape === "tr" ? `<path d="M${x} ${y - 4} L${x + 4} ${y + 3} L${x - 4} ${y + 3}Z" fill="${s.fill || "#fff"}" stroke="#000"/>` : `<circle cx="${x}" cy="${y}" r="3.4" fill="${s.fill || "#000"}" stroke="#000"/>`);
    const step = Math.max(1, Math.ceil(n / 25));
    return `<div class="avoid"><div class="sub">${o.title}</div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title)}"><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="#fff" stroke="#000"/>
      ${tick.map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e5e8ee" stroke-width=".7"/><text x="${L - 6}" y="${Y(v) + 3.5}" text-anchor="end" font-size="11" font-family="Arial">${v.toFixed(d)}</text>`).join("")}
      ${(o.hlines || []).map((h) => `<line x1="${L}" x2="${W - R}" y1="${Y(h.v)}" y2="${Y(h.v)}" stroke="${h.col || "#000"}" stroke-width="1.3"${h.dash ? ' stroke-dasharray="6 3"' : ""}/><text x="${W - R + 5}" y="${Y(h.v) + 3.5}" font-size="11" fill="${h.col || "#000"}" font-family="Arial">${h.t}</text>`).join("")}
      ${o.series.map((s) => `<polyline fill="none" stroke="#000" stroke-width="1.2"${s.dash ? ` stroke-dasharray="${s.dash}"` : ""} points="${s.vals.map((v, i) => (Number.isFinite(v) ? X(i).toFixed(1) + "," + Y(v).toFixed(1) : "")).filter(Boolean).join(" ")}"/>${s.vals.map((v, i) => (Number.isFinite(v) ? mk(s, X(i).toFixed(1) * 1, Y(v).toFixed(1) * 1) : "")).join("")}`).join("")}
      ${o.labels.map((lb, i) => (i % step === 0 ? `<text x="${X(i)}" y="${H - 9}" text-anchor="middle" font-size="11" font-family="Arial">${esc(String(lb).slice(0, 8))}</text>` : "")).join("")}
      ${o.xTitle ? `<text x="${(L + W - R) / 2}" y="${H - 0.5}" text-anchor="middle" font-size="10" font-family="Arial">${o.xTitle}</text>` : ""}</svg>
      ${o.series.length > 1 ? `<div class="leg">${o.series.map((s) => `<span><svg viewBox="0 0 26 10" style="display:inline-block;width:26px;height:10px;vertical-align:middle"><line x1="0" x2="26" y1="5" y2="5" stroke="#000" stroke-width="1.2"${s.dash ? ` stroke-dasharray="${s.dash}"` : ""}/>${mk(s, 13, 5)}</svg> ${esc(s.name)}</span>`).join("")}</div>` : ""}</div>`;
  }
  /* horizontal bars (variation components), grey */
  function bars(title, rows) {
    const W = 1000, rh = 26, H = rows.length * rh + 10, L = 230;
    return `<div class="avoid"><div class="sub">${title}</div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${rows.map((r, i) => { const y = 4 + i * rh, w = Math.max(1, (Math.min(100, r.v) / 100) * (W - L - 110)); return `<text x="0" y="${y + 16}" font-size="12" font-family="Arial">${esc(r.t)}</text><rect x="${L}" y="${y + 3}" width="${W - L - 70}" height="16" fill="#fff" stroke="#000" stroke-width=".8"/><rect x="${L}" y="${y + 3}" width="${w}" height="16" fill="${r.c || "#555"}"/><text x="${L + w + 6}" y="${y + 16}" font-size="12" font-weight="700" font-family="Arial">${r.v.toFixed(1)}%</text>`; }).join("")}</svg></div>`;
  }

  window.AIAGForm = { esc, f, wrap, title, head, sec, signoff, shortDate, ctlSheet, lineChart, bars, css };
})();
