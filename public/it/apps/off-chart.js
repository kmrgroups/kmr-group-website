/* KMR Office Suite - chart drawing (own SVG renderer).
   Types: col, bar, line, area, pie, doughnut, scatter, bubble, radar, combo, waterfall, histogram, pareto, funnel, treemap, box.
   Options on the chart object: title, legend (bottom|right|top|left|none), stacked, pct (100% stacked), labels (data labels), grid (false hides),
   xTitle, yTitle, ymin, ymax, log, trend (linear|exp|poly|avg), trendAll, smooth, marker (false hides), gap (% gap width), stypes[] (per series: col|line|area),
   sec[] (series on the right-hand axis), bins (histogram), colors[] */
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const PAL = ["#4472c4", "#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5", "#70ad47", "#264478", "#9e480e", "#636363", "#997300"];
  const nice = (lo, hi, n) => {
    if (lo === hi) { hi = lo + 1; } const span = hi - lo, step0 = span / Math.max(1, n), mag = Math.pow(10, Math.floor(Math.log10(step0))), r = step0 / mag, step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
    const a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step, t = []; for (let v = a; v <= b + step / 2; v += step) t.push(Math.round(v / step) * step); return { a, b, t, step };
  };
  const fmt = (v) => { if (v == null || !isFinite(v)) return ""; const a = Math.abs(v); if (a >= 1e7) return +(v / 1e7).toFixed(2) + "Cr"; if (a >= 1e5) return +(v / 1e5).toFixed(2) + "L"; if (a >= 1e3) return v.toLocaleString("en-IN", { maximumFractionDigits: 2 }); return String(+v.toFixed(4)); };
  const trunc = (s, n) => { s = String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const smoothPath = (pts) => { if (pts.length < 3) return "M" + pts.map((p) => p[0] + " " + p[1]).join("L"); let d = `M${pts[0][0]} ${pts[0][1]}`; for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2; d += `C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`; } return d; };
  /* least squares helpers for trendlines */
  function fit(kind, xs, ys) {
    const pts = xs.map((x, i) => [x, ys[i]]).filter((p) => p[1] != null && isFinite(p[0]) && isFinite(p[1])); if (pts.length < 2) return null; const n = pts.length;
    if (kind === "avg") { const k = Math.max(2, Math.min(5, Math.round(n / 4))); return { f: null, pts: pts.map((p, i) => (i < k - 1 ? null : [p[0], sum(pts.slice(i - k + 1, i + 1).map((q) => q[1])) / k])).filter(Boolean), label: k + "-point moving average" }; }
    if (kind === "exp") { const q = pts.filter((p) => p[1] > 0); if (q.length < 2) return null; const f = fit("linear", q.map((p) => p[0]), q.map((p) => Math.log(p[1]))); const b = f.m, a = Math.exp(f.c); return { f: (x) => a * Math.exp(b * x), label: "y = " + +a.toPrecision(3) + "e^" + +b.toPrecision(3) + "x" }; }
    if (kind === "poly") { // quadratic via normal equations
      const S = (k) => sum(pts.map((p) => Math.pow(p[0], k))), T = (k) => sum(pts.map((p) => Math.pow(p[0], k) * p[1])); const A = [[S(4), S(3), S(2), T(2)], [S(3), S(2), S(1), T(1)], [S(2), S(1), n, T(0)]];
      for (let i = 0; i < 3; i++) { let p = i; for (let r = i + 1; r < 3; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r; [A[i], A[p]] = [A[p], A[i]]; if (Math.abs(A[i][i]) < 1e-12) return null; for (let r = 0; r < 3; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let k = i; k < 4; k++) A[r][k] -= f * A[i][k]; } }
      const a = A[0][3] / A[0][0], b = A[1][3] / A[1][1], c = A[2][3] / A[2][2]; return { f: (x) => a * x * x + b * x + c, label: "y = " + +a.toPrecision(3) + "x² + " + +b.toPrecision(3) + "x + " + +c.toPrecision(3) };
    }
    const mx = sum(pts.map((p) => p[0])) / n, my = sum(pts.map((p) => p[1])) / n; let sxy = 0, sxx = 0, syy = 0; pts.forEach((p) => { sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) ** 2; syy += (p[1] - my) ** 2; }); const m = sxx ? sxy / sxx : 0, c = my - m * mx; const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
    return { f: (x) => m * x + c, m, c, label: "y = " + +m.toPrecision(3) + "x " + (c < 0 ? "− " : "+ ") + +Math.abs(c).toPrecision(3) + "   R² = " + r2.toFixed(3) };
  }
  /* data: { cats:[], series:[{name, values, color}] } */
  function svg(ch, data, W, H) {
    let type = ch.type || "col", cats = (data.cats || []).slice(), ser = (data.series || []).map((s) => Object.assign({}, s, { values: s.values.slice() })); const ff = 'font-family="Calibri,Arial,sans-serif"';
    let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" ${ff}><rect width="${W}" height="${H}" fill="#fff"/>`;
    if (!ser.length || !ser.some((s) => s.values.some((v) => v != null))) return out + `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="13" fill="#888">No numbers in the chosen range</text></svg>`;
    const col = (i, s) => (s && s.color) || (ch.colors && ch.colors[i]) || PAL[i % PAL.length];
    let top = 12; if (ch.title) { out += `<text x="${W / 2}" y="24" text-anchor="middle" font-size="15" font-weight="700" fill="#222">${esc(ch.title)}</text>`; top = 38; }
    /* ----- derived types ----- */
    let stypes = ch.stypes || [], sec = (ch.sec || []).slice(), stacked = !!ch.stacked || !!ch.pct, extraLine = null;
    if (type === "histogram") {
      const v = ser[0].values.filter((x) => x != null && isFinite(x)); if (!v.length) return out + "</svg>"; const lo = Math.min(...v), hi = Math.max(...v), k = Math.max(2, Math.min(60, ch.bins || Math.ceil(Math.sqrt(v.length)) + 1)), nz = nice(lo, hi, k); const bw = (hi - lo) / k || 1; const cnt = new Array(k).fill(0); v.forEach((x) => { cnt[Math.min(k - 1, Math.floor((x - lo) / bw))]++; });
      cats = cnt.map((_, i) => `${fmt(+(lo + i * bw).toPrecision(4))}–${fmt(+(lo + (i + 1) * bw).toPrecision(4))}`); ser = [{ name: "Count", values: cnt }]; type = "col"; ch = Object.assign({}, ch, { gap: 3 }); void nz;
    }
    if (type === "pareto") {
      const idx = cats.map((_, i) => i).sort((a, b) => (ser[0].values[b] || 0) - (ser[0].values[a] || 0)); const vals = idx.map((i) => ser[0].values[i] || 0), tot = sum(vals) || 1; let acc = 0; cats = idx.map((i) => cats[i]); ser = [{ name: ser[0].name, values: vals }, { name: "Cumulative %", values: vals.map((v) => ((acc += v) / tot) * 100) }]; type = "combo"; stypes = ["col", "line"]; sec = [1]; stacked = false;
    }
    const legend = ch.legend === "none" ? null : ch.legend === "right" ? "r" : ch.legend === "top" ? "t" : ch.legend === "left" ? "l" : "b";
    const pie = type === "pie" || type === "doughnut" || type === "funnel" || type === "treemap";
    const showLeg = legend && !(type === "histogram" || (ser.length === 1 && !pie && ch.legend == null && type !== "combo"));
    const items = pie ? cats.map((c, i) => [c, PAL[i % PAL.length]]) : type === "waterfall" ? [["Increase", "#70ad47"], ["Decrease", "#e15759"], ["Total", "#4472c4"]] : ser.map((s, i) => [s.name, col(i, s)]);
    let left = 8, right = W - 10, bottom = H - 8, topY = top;
    const legItems = items.slice(0, 40);
    if (showLeg && legend === "b") { bottom -= 22; const per = Math.max(1, Math.floor((W - 20) / 110)), total = legItems.length, rows = Math.ceil(total / per); if (rows > 1) bottom -= (rows - 1) * 16; let row = 0; legItems.forEach((it, i) => { const cc = i % per; if (cc === 0 && i) row++; const px = 14 + cc * 110, py = H - 12 - (rows - 1 - row) * 16; out += `<rect x="${px}" y="${py - 9}" width="10" height="10" fill="${it[1]}"/><text x="${px + 14}" y="${py}" font-size="11" fill="#444">${esc(trunc(it[0], 14))}</text>`; }); }
    if (showLeg && legend === "t") { const per = Math.max(1, Math.floor((W - 20) / 110)), rows = Math.ceil(legItems.length / per); legItems.forEach((it, i) => { const px = 14 + (i % per) * 110, py = topY + 10 + Math.floor(i / per) * 16; out += `<rect x="${px}" y="${py - 9}" width="10" height="10" fill="${it[1]}"/><text x="${px + 14}" y="${py}" font-size="11" fill="#444">${esc(trunc(it[0], 14))}</text>`; }); topY += rows * 16 + 6; }
    if (showLeg && legend === "r") { const lw = 120; right -= lw; legItems.slice(0, 30).forEach((it, i) => { const py = topY + 12 + i * 18; out += `<rect x="${right + 18}" y="${py - 9}" width="10" height="10" fill="${it[1]}"/><text x="${right + 32}" y="${py}" font-size="11" fill="#444">${esc(trunc(it[0], 14))}</text>`; }); }
    if (showLeg && legend === "l") { const lw = 120; left += lw; legItems.slice(0, 30).forEach((it, i) => { const py = topY + 12 + i * 18; out += `<rect x="8" y="${py - 9}" width="10" height="10" fill="${it[1]}"/><text x="22" y="${py}" font-size="11" fill="#444">${esc(trunc(it[0], 14))}</text>`; }); }
    top = topY;
    /* ----- pie / doughnut ----- */
    if (type === "pie" || type === "doughnut") {
      const vals = (ser[0].values || []).map((v) => (v > 0 ? v : 0)), tot = sum(vals) || 1; const cx = (left + right) / 2, cy = (top + bottom) / 2, R = Math.max(20, Math.min(right - left, bottom - top) / 2 - 8), r0 = type === "doughnut" ? R * 0.55 : 0; let a0 = -Math.PI / 2;
      vals.forEach((v, i) => { const a1 = a0 + (v / tot) * Math.PI * 2, large = a1 - a0 > Math.PI ? 1 : 0, c = PAL[i % PAL.length]; const P = (a, r) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]; if (v / tot > 0.9999) out += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${c}"/>${r0 ? `<circle cx="${cx}" cy="${cy}" r="${r0}" fill="#fff"/>` : ""}`; else if (v > 0) { const p1 = P(a0, R), p2 = P(a1, R), q1 = P(a1, r0), q2 = P(a0, r0); out += `<path d="M${p1} A${R} ${R} 0 ${large} 1 ${p2} ${r0 ? `L${q1} A${r0} ${r0} 0 ${large} 0 ${q2}Z` : `L${cx} ${cy}Z`}" fill="${c}" stroke="#fff" stroke-width="1.5"/>`; } if (v / tot > 0.04 && ch.labels !== false) { const am = (a0 + a1) / 2, rr = r0 ? (R + r0) / 2 : R * 0.62, pp = [cx + rr * Math.cos(am), cy + rr * Math.sin(am)]; out += `<text x="${pp[0]}" y="${pp[1] + 4}" text-anchor="middle" font-size="11" fill="#fff" font-weight="600">${ch.labels === "value" ? esc(fmt(v)) : Math.round((v / tot) * 100) + "%"}</text>`; } a0 = a1; });
      return out + "</svg>";
    }
    /* ----- funnel ----- */
    if (type === "funnel") {
      const vals = (ser[0].values || []).map((v) => Math.max(0, v || 0)), mx = Math.max(...vals) || 1, n = vals.length, ph = bottom - top - 4, bh = ph / n, cx = (left + right) / 2, wmax = right - left - 20;
      vals.forEach((v, i) => { const w = (v / mx) * wmax, y = top + 2 + i * bh; out += `<rect x="${cx - w / 2}" y="${y}" width="${Math.max(1, w)}" height="${Math.max(1, bh - 3)}" fill="${PAL[i % PAL.length]}"/><text x="${cx}" y="${y + bh / 2 + 3}" text-anchor="middle" font-size="11" fill="#fff" font-weight="600">${esc(trunc(cats[i], 18))}  ${esc(fmt(v))}</text>`; });
      return out + "</svg>";
    }
    /* ----- treemap ----- */
    if (type === "treemap") {
      const vals = (ser[0].values || []).map((v, i) => ({ v: Math.max(0, v || 0), n: cats[i], i })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v); const tot = sum(vals.map((x) => x.v)) || 1; const rects = [];
      (function lay(items, x, y, w, h) { if (!items.length) return; if (items.length === 1) { rects.push([items[0], x, y, w, h]); return; } const t = sum(items.map((q) => q.v)); let acc = 0, k = 0; while (k < items.length - 1 && acc + items[k].v < t / 2) acc += items[k++].v; k = Math.max(1, k); const a = items.slice(0, k), b = items.slice(k), fa = sum(a.map((q) => q.v)) / t; if (w >= h) { lay(a, x, y, w * fa, h); lay(b, x + w * fa, y, w * (1 - fa), h); } else { lay(a, x, y, w, h * fa); lay(b, x, y + h * fa, w, h * (1 - fa)); } })(vals, left + 4, top + 2, right - left - 8, bottom - top - 6);
      rects.forEach(([q, x, y, w, h]) => { out += `<rect x="${x}" y="${y}" width="${Math.max(0, w - 2)}" height="${Math.max(0, h - 2)}" fill="${PAL[q.i % PAL.length]}"/>`; if (w > 40 && h > 22) out += `<text x="${x + 6}" y="${y + 16}" font-size="11.5" fill="#fff" font-weight="600">${esc(trunc(q.n, Math.floor(w / 7)))}</text><text x="${x + 6}" y="${y + 30}" font-size="10.5" fill="#fff">${esc(fmt(q.v))} (${Math.round((q.v / tot) * 100)}%)</text>`; });
      return out + "</svg>";
    }
    /* ----- radar ----- */
    if (type === "radar") {
      const n = cats.length || 1, cx = (left + right) / 2, cy = (top + bottom) / 2 + 4, R = Math.max(20, Math.min(right - left, bottom - top) / 2 - 26); let hi = 0; ser.forEach((s) => s.values.forEach((v) => { if (v != null && v > hi) hi = v; })); const sc = nice(0, hi || 1, 4); const P = (i, r) => [cx + r * Math.sin((2 * Math.PI * i) / n), cy - r * Math.cos((2 * Math.PI * i) / n)];
      sc.t.forEach((t) => { if (t <= 0) return; const r = (t / sc.b) * R; out += `<polygon points="${cats.map((_, i) => P(i, r).join(",")).join(" ")}" fill="none" stroke="#e3e3e3"/><text x="${cx + 3}" y="${cy - r - 2}" font-size="9.5" fill="#777">${esc(fmt(t))}</text>`; });
      cats.forEach((c, i) => { const p = P(i, R), q = P(i, R + 12); out += `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="#e3e3e3"/><text x="${q[0]}" y="${q[1] + 4}" text-anchor="${Math.abs(q[0] - cx) < 4 ? "middle" : q[0] > cx ? "start" : "end"}" font-size="11" fill="#555">${esc(trunc(c, 12))}</text>`; });
      ser.forEach((s, k) => { const c = col(k, s), pts = cats.map((_, i) => P(i, ((s.values[i] || 0) / sc.b) * R)); out += `<polygon points="${pts.map((p) => p.join(",")).join(" ")}" fill="${c}" fill-opacity="0.18" stroke="${c}" stroke-width="2"/>`; pts.forEach((p) => (out += `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${c}"/>`)); });
      return out + "</svg>";
    }
    /* ----- box and whisker ----- */
    if (type === "box") {
      let lo = Infinity, hi = -Infinity; const stats = ser.map((s) => { const v = s.values.filter((x) => x != null && isFinite(x)).sort((a, b) => a - b); if (!v.length) return null; const q = (p) => { const r = p * (v.length - 1), l = Math.floor(r); return v[l] + (r - l) * ((v[l + 1] ?? v[l]) - v[l]); }; const q1 = q(0.25), q3 = q(0.75), iq = q3 - q1, wl = v.find((x) => x >= q1 - 1.5 * iq), wh = [...v].reverse().find((x) => x <= q3 + 1.5 * iq); lo = Math.min(lo, v[0]); hi = Math.max(hi, v[v.length - 1]); return { q1, q3, med: q(0.5), wl, wh, out: v.filter((x) => x < wl || x > wh), mean: sum(v) / v.length }; });
      const sc = nice(lo, hi, 5), lab = sc.t.map(fmt), lw = Math.max(...lab.map((s) => s.length)) * 6.2 + 10; const px0 = left + lw, px1 = right - 6, py0 = top + 4, py1 = bottom - 22, vy = (v) => py1 - ((v - sc.a) / (sc.b - sc.a)) * (py1 - py0);
      sc.t.forEach((t, i) => { out += `<line x1="${px0}" y1="${vy(t)}" x2="${px1}" y2="${vy(t)}" stroke="#e3e3e3"/><text x="${px0 - 6}" y="${vy(t) + 4}" text-anchor="end" font-size="11" fill="#555">${esc(lab[i])}</text>`; });
      const band = (px1 - px0) / ser.length; stats.forEach((s, i) => { if (!s) return; const c = col(i, ser[i]), x = px0 + band * i + band / 2, bw = Math.min(60, band * 0.5); out += `<line x1="${x}" y1="${vy(s.wl)}" x2="${x}" y2="${vy(s.wh)}" stroke="${c}" stroke-width="1.5"/><line x1="${x - bw / 4}" y1="${vy(s.wl)}" x2="${x + bw / 4}" y2="${vy(s.wl)}" stroke="${c}" stroke-width="1.5"/><line x1="${x - bw / 4}" y1="${vy(s.wh)}" x2="${x + bw / 4}" y2="${vy(s.wh)}" stroke="${c}" stroke-width="1.5"/><rect x="${x - bw / 2}" y="${vy(s.q3)}" width="${bw}" height="${Math.max(1, vy(s.q1) - vy(s.q3))}" fill="${c}" fill-opacity="0.35" stroke="${c}" stroke-width="1.5"/><line x1="${x - bw / 2}" y1="${vy(s.med)}" x2="${x + bw / 2}" y2="${vy(s.med)}" stroke="${c}" stroke-width="2.5"/><text x="${x}" y="${py1 + 15}" text-anchor="middle" font-size="11" fill="#555">${esc(trunc(ser[i].name, 14))}</text>`; s.out.forEach((v) => (out += `<circle cx="${x}" cy="${vy(v)}" r="3" fill="none" stroke="${c}"/>`)); out += `<path d="M${x - 4} ${vy(s.mean) - 4}l8 8m0-8l-8 8" stroke="${c}"/>`; });
      return out + `<line x1="${px0}" y1="${py1}" x2="${px1}" y2="${py1}" stroke="#999"/></svg>`;
    }
    /* ----- waterfall: build floating bars ----- */
    let wf = null;
    if (type === "waterfall") {
      const v = ser[0].values; let run = 0; wf = v.map((x, i) => { const isT = /total|balance|net|closing|ending/i.test(String(cats[i])); if (isT) { const r = { a: 0, b: run, kind: "t", v: run }; return r; } const a = run; run += x || 0; return { a, b: run, kind: (x || 0) >= 0 ? "u" : "d", v: x || 0 }; });
      ser = [{ name: ser[0].name, values: wf.map((w) => w.b) }]; stacked = false;
    }
    /* ----- cartesian ----- */
    const horiz = type === "bar", scat = type === "scatter" || type === "bubble", bubble = type === "bubble";
    const kindOf = (i) => (type === "combo" ? stypes[i] || (i === 0 ? "col" : "line") : type === "waterfall" ? "wf" : horiz ? "col" : type === "bar" ? "col" : type);
    const isSec = (i) => !horiz && sec.indexOf(i) >= 0;
    const hasSec = ser.some((_, i) => isSec(i));
    const pct = !!ch.pct && (type === "col" || type === "bar" || type === "area"); const n = cats.length || 1;
    // stacked totals for percent charts
    const tot = new Array(n).fill(0); if (pct) ser.forEach((s) => s.values.forEach((v, i) => (tot[i] += Math.abs(v || 0))));
    const V = (s, i) => (pct ? (tot[i] ? ((s.values[i] || 0) / tot[i]) * 100 : 0) : s.values[i]);
    const range = (sel) => {
      let lo = Infinity, hi = -Infinity; const idx = ser.map((_, i) => i).filter(sel); const st = stacked && (type === "col" || type === "bar" || type === "area" || (type === "combo" && !!ch.stacked));
      if (st) { for (let i = 0; i < n; i++) { let p = 0, q = 0; idx.forEach((k) => { if (kindOf(k) === "line") { const v = V(ser[k], i); if (v != null) { hi = Math.max(hi, v); lo = Math.min(lo, v); } return; } const v = V(ser[k], i) || 0; if (v >= 0) p += v; else q += v; }); hi = Math.max(hi, p); lo = Math.min(lo, q); } }
      else idx.forEach((k) => ser[k].values.forEach((v, i) => { v = V(ser[k], i); if (v != null && isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } }));
      if (wf) { wf.forEach((w) => { lo = Math.min(lo, w.a, w.b); hi = Math.max(hi, w.a, w.b); }); }
      return [lo, hi];
    };
    let [lo, hi] = range((i) => !isSec(i)); if (!isFinite(lo)) { lo = 0; hi = 1; }
    const needZero = ser.some((_, i) => !isSec(i) && ["col", "area", "wf"].indexOf(kindOf(i)) >= 0) || type === "col" || type === "bar" || type === "area";
    if (needZero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    if (pct) { lo = 0; hi = 100; }
    const mkScale = (lo, hi, pmin, pmax, logOK) => { if (pmin != null && isFinite(pmin)) lo = pmin; if (pmax != null && isFinite(pmax)) hi = pmax; if (logOK && ch.log && lo > 0) { const a = Math.floor(Math.log10(lo)), b = Math.ceil(Math.log10(hi)), t = []; for (let e = a; e <= b; e++) t.push(Math.pow(10, e)); return { log: true, a: t[0], b: t[t.length - 1], t }; } const s = nice(lo, hi, 5); if (pmin != null && isFinite(pmin)) { s.a = pmin; s.t = s.t.filter((t) => t >= pmin); } if (pmax != null && isFinite(pmax)) { s.b = pmax; s.t = s.t.filter((t) => t <= pmax); } return s; };
    const sc = mkScale(lo, hi, ch.ymin, ch.ymax, true);
    let sc2 = null; if (hasSec) { let [l2, h2] = range((i) => isSec(i)); if (!isFinite(l2)) { l2 = 0; h2 = 1; } if (ser.some((_, i) => isSec(i) && ["col", "area"].indexOf(kindOf(i)) >= 0)) { l2 = Math.min(l2, 0); h2 = Math.max(h2, 0); } sc2 = mkScale(l2, h2, ch.y2min, ch.y2max, false); }
    const frac = (s, v) => (s.log ? (Math.log10(Math.max(v, s.a)) - Math.log10(s.a)) / (Math.log10(s.b) - Math.log10(s.a) || 1) : (v - s.a) / (s.b - s.a || 1));
    const fmtAx = (v) => (pct ? Math.round(v) + "%" : fmt(v));
    const lab = sc.t.map(fmtAx), lab2 = sc2 ? sc2.t.map((v) => fmt(v)) : [];
    const lblW = Math.max(...lab.map((s) => s.length)) * 6.2 + 10, lblW2 = sc2 ? Math.max(...lab2.map((s) => s.length)) * 6.2 + 10 : 0;
    let xs = null, xsc = null; if (scat) { xs = cats.map(Number); const fin = xs.filter(isFinite); const xl = Math.min(...fin), xh = Math.max(...fin); xsc = nice(xl, xh, 6); }
    const catLab = cats.map((c) => String(c)); const maxCat = Math.max(0, ...catLab.map((s) => Math.min(s.length, 14)));
    const rot = !horiz && !scat && cats.length * (maxCat * 6 + 8) > right - left - lblW;
    const xT = ch.xTitle ? 16 : 0, yT = ch.yTitle ? 16 : 0;
    const bottomAxis = (horiz || scat ? 20 : rot ? maxCat * 4.2 + 14 : 22) + xT; const leftAxis = (horiz ? maxCat * 6 + 14 : lblW) + yT;
    const px0 = left + leftAxis, px1 = right - 6 - (sc2 ? lblW2 : 0), py0 = top + 4, py1 = bottom - bottomAxis; const pw = Math.max(10, px1 - px0), ph = Math.max(10, py1 - py0);
    const vy = (v) => py1 - frac(sc, v) * ph, vx = (v) => px0 + frac(sc, v) * pw, vy2 = (v) => py1 - frac(sc2, v) * ph;
    // titles
    if (ch.xTitle) out += `<text x="${(px0 + px1) / 2}" y="${bottom - 3}" text-anchor="middle" font-size="12" fill="#444">${esc(ch.xTitle)}</text>`;
    if (ch.yTitle) out += `<text transform="translate(${left + 11},${(py0 + py1) / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#444">${esc(ch.yTitle)}</text>`;
    // grid and value axis
    const gridOn = ch.grid !== false;
    sc.t.forEach((t, i) => { if (horiz) { const x = vx(t); out += `${gridOn ? `<line x1="${x}" y1="${py0}" x2="${x}" y2="${py1}" stroke="#e3e3e3"/>` : ""}<text x="${x}" y="${py1 + 14}" text-anchor="middle" font-size="11" fill="#555">${esc(lab[i])}</text>`; } else { const y = vy(t); out += `${gridOn || t === 0 ? `<line x1="${px0}" y1="${y}" x2="${px1}" y2="${y}" stroke="${t === 0 ? "#999" : "#e3e3e3"}"/>` : ""}<text x="${px0 - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#555">${esc(lab[i])}</text>`; } });
    if (sc2) sc2.t.forEach((t, i) => { out += `<text x="${px1 + 6}" y="${vy2(t) + 4}" font-size="11" fill="#555">${esc(lab2[i])}</text>`; });
    const dl = !!ch.labels && ch.labels !== false;
    if (scat) {
      const sx = (v) => px0 + ((v - xsc.a) / (xsc.b - xsc.a || 1)) * pw; xsc.t.forEach((t) => { const x = sx(t); out += `${gridOn ? `<line x1="${x}" y1="${py0}" x2="${x}" y2="${py1}" stroke="#eee"/>` : ""}<text x="${x}" y="${py1 + 14}" text-anchor="middle" font-size="11" fill="#555">${esc(fmt(t))}</text>`; });
      if (bubble) {
        const y = ser[0], z = ser[1] || { values: y.values.map(() => 1) }, zmax = Math.max(...z.values.filter((v) => v != null && v > 0), 1), rmax = Math.min(pw, ph) / 9; const c = col(0, y);
        y.values.forEach((v, i) => { if (v == null || !isFinite(xs[i])) return; const r = Math.max(4, Math.sqrt(Math.max(z.values[i] || 0, 0) / zmax) * rmax); out += `<circle cx="${sx(xs[i])}" cy="${vy(v)}" r="${r}" fill="${c}" fill-opacity="0.55" stroke="${c}"/>`; if (dl) out += `<text x="${sx(xs[i])}" y="${vy(v) + 4}" text-anchor="middle" font-size="9.5" fill="#222">${esc(fmt(z.values[i]))}</text>`; });
      } else ser.forEach((s, k) => { const c = col(k, s); const pts = []; s.values.forEach((v, i) => { if (v == null || !isFinite(xs[i])) return; pts.push([sx(xs[i]), vy(v), v]); }); if (ch.scatterLines !== false && ch.markersOnly !== true) out += `<path d="${ch.smooth ? smoothPath(pts) : "M" + pts.map((p) => p[0] + " " + p[1]).join("L")}" fill="none" stroke="${c}" stroke-width="2"/>`; pts.forEach((p) => { out += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${c}"/>`; if (dl) out += `<text x="${p[0]}" y="${p[1] - 7}" text-anchor="middle" font-size="9.5" fill="#555">${esc(fmt(p[2]))}</text>`; }); if (ch.trend) { const t = fit(ch.trend, xs, s.values); if (t && t.f) { const a = xsc.a, b = xsc.b; let d = ""; for (let i = 0; i <= 40; i++) { const x = a + ((b - a) * i) / 40, y = t.f(x); if (isFinite(y)) d += (d ? "L" : "M") + sx(x) + " " + vy(y); } out += `<path d="${d}" fill="none" stroke="${c}" stroke-width="1.6" stroke-dasharray="6 4"/>`; if (k === 0) out += `<text x="${px1 - 4}" y="${py0 + 12}" text-anchor="end" font-size="10.5" fill="${c}">${esc(t.label)}</text>`; } } });
    } else {
      const band = (horiz ? ph : pw) / n, gapF = Math.max(0, Math.min(300, ch.gap == null ? 25 : ch.gap)) / 100, colSer = ser.map((_, i) => i).filter((i) => kindOf(i) === "col"), ncol = type === "combo" || !stacked ? colSer.length || 1 : 1; const bwTot = band / (1 + gapF), gp = band - bwTot, bw = stacked ? bwTot : bwTot / ncol;
      const pos = new Array(n).fill(0), neg = new Array(n).fill(0), accA = new Array(n).fill(0), place = {};
      const xAtLine = (i) => (n === 1 ? px0 + pw / 2 : type === "area" || (type === "line" && ch.edge) ? px0 + (pw * i) / (n - 1) : px0 + band * i + band / 2);
      // columns
      if (wf) {
        wf.forEach((w, i) => { const c = w.kind === "t" ? "#4472c4" : w.kind === "u" ? "#70ad47" : "#e15759"; const o = px0 + band * i + gp / 2, y1 = vy(Math.max(w.a, w.b)), y2 = vy(Math.min(w.a, w.b)); out += `<rect x="${o}" y="${y1}" width="${bwTot}" height="${Math.max(1, y2 - y1)}" fill="${c}"/>`; out += `<text x="${o + bwTot / 2}" y="${y1 - 3}" text-anchor="middle" font-size="9.5" fill="#555">${esc(w.kind === "t" ? fmt(w.v) : (w.v > 0 ? "+" : "") + fmt(w.v))}</text>`; if (i < wf.length - 1) out += `<line x1="${o + bwTot}" y1="${vy(w.b)}" x2="${o + band}" y2="${vy(w.b)}" stroke="#999" stroke-dasharray="3 3"/>`; });
      } else {
        let ci = 0; ser.forEach((s, k) => { if (kindOf(k) !== "col") return; const c = col(k, s), scx = isSec(k) ? sc2 : sc, vf = isSec(k) ? vy2 : vy, vxf = (v) => px0 + frac(scx, v) * pw; const slot = stacked ? 0 : ci++; s.values.forEach((_, i) => { let v = V(s, i); if (v == null) return; let a, b; if (stacked) { if (v >= 0) { a = pos[i]; b = a + v; pos[i] = b; } else { a = neg[i]; b = a + v; neg[i] = b; } } else { a = 0; b = v; } const o = (horiz ? py0 : px0) + band * i + gp / 2 + (stacked ? 0 : bw * slot); const showL = dl && (stacked || n * ncol <= 40); const lv = pct ? Math.round(v) + "%" : fmt(s.values[i]);
          if (horiz) { const x1 = vxf(Math.min(a, b)), x2 = vxf(Math.max(a, b)); out += `<rect x="${x1}" y="${o}" width="${Math.max(1, x2 - x1)}" height="${Math.max(1, bw - 1)}" fill="${c}"/>`; if (showL) out += `<text x="${stacked ? (x1 + x2) / 2 : x2 + 4}" y="${o + bw / 2 + 3.5}" ${stacked ? 'text-anchor="middle" fill="#fff"' : 'fill="#555"'} font-size="9.5">${esc(lv)}</text>`; }
          else { const y1 = vf(Math.max(a, b)), y2 = vf(Math.min(a, b)); out += `<rect x="${o}" y="${y1}" width="${Math.max(1, bw - 1)}" height="${Math.max(1, y2 - y1)}" fill="${c}"/>`; if (showL) out += `<text x="${o + bw / 2}" y="${stacked ? (y1 + y2) / 2 + 3.5 : (v >= 0 ? y1 - 3 : y2 + 11)}" text-anchor="middle" ${stacked ? 'fill="#fff"' : 'fill="#555"'} font-size="9.5">${esc(lv)}</text>`; } }); });
      }
      // areas then lines
      ["area", "line"].forEach((kind) => {
        ser.forEach((s, k) => { if (kindOf(k) !== kind) return; const c = col(k, s), vf = isSec(k) ? vy2 : vy; const pts = []; s.values.forEach((_, i) => { let v = V(s, i); if (v == null) { pts.push(null); return; } let y0 = 0, y; if (stacked && kind === "area") { y0 = accA[i]; accA[i] += v; y = accA[i]; } else y = v; pts.push([xAtLine(i), vf(y), vf(y0), v]); });
          let d = "", seg = []; const flush = () => { if (!seg.length) return; d += (ch.smooth && kind === "line" ? smoothPath(seg) : "M" + seg.map((p) => p[0] + " " + p[1]).join("L")); if (kind === "area") out += `<path d="M${seg.map((p) => p[0] + " " + p[1]).join("L")}L${seg[seg.length - 1][0]} ${seg[seg.length - 1][2]}L${seg[0][0]} ${seg[0][2]}Z" fill="${c}" fill-opacity="${stacked ? 0.85 : 0.45}"/>`; seg = []; }; pts.forEach((p) => { if (p) seg.push(p); else flush(); }); flush();
          out += `<path d="${d}" fill="none" stroke="${c}" stroke-width="2.2"/>`;
          if (kind === "line") pts.forEach((p) => { if (!p) return; if (ch.marker !== false) out += `<circle cx="${p[0]}" cy="${p[1]}" r="3.2" fill="#fff" stroke="${c}" stroke-width="1.8"/>`; if (dl) out += `<text x="${p[0]}" y="${p[1] - 7}" text-anchor="middle" font-size="9.5" fill="#555">${esc(isSec(k) && type === "combo" && ch.type === "pareto" ? Math.round(p[3]) + "%" : fmt(p[3]))}</text>`; });
          if (ch.trend && (ch.trendAll || k === 0 || (type === "combo" && kind === "line" && k === ser.findIndex((_, j) => kindOf(j) === "line")))) { const idx = s.values.map((_, i) => i + 1), t = fit(ch.trend, idx, s.values); if (t) { let dd = ""; if (t.f) { for (let i = 0; i <= 40; i++) { const xi = 1 + ((n - 1) * i) / 40, y = t.f(xi); if (isFinite(y)) dd += (dd ? "L" : "M") + (n === 1 ? px0 + pw / 2 : xAtLine(0) + ((xAtLine(n - 1) - xAtLine(0)) * (xi - 1)) / (n - 1)) + " " + vf(y); } } else dd = "M" + t.pts.map((p) => xAtLine(p[0] - 1) + " " + vf(p[1])).join("L"); out += `<path d="${dd}" fill="none" stroke="${c}" stroke-width="1.6" stroke-dasharray="6 4"/>`; out += `<text x="${px1 - 4}" y="${py0 + 12 + k * 13}" text-anchor="end" font-size="10.5" fill="${c}">${esc(t.label)}</text>`; } }
        });
      });
      void place; void extraLine;
    }
    // category labels
    if (!scat) { const step = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((horiz ? ph / 14 : pw / (rot ? 14 : maxCat * 6 + 8)))))); const lineLike = type === "area" || (type === "line" && ch.edge); catLab.forEach((t, i) => { if (i % step) return; const bandW = (horiz ? ph : pw) / n; const o = lineLike ? (horiz ? py0 : px0) + (n === 1 ? (horiz ? ph : pw) / 2 : ((horiz ? ph : pw) * i) / (n - 1)) : (horiz ? py0 : px0) + bandW * i + bandW / 2; const s = esc(trunc(t, 14)); if (horiz) out += `<text x="${px0 - 6}" y="${o + 4}" text-anchor="end" font-size="11" fill="#555">${s}</text>`; else if (rot) out += `<text transform="translate(${o},${py1 + 8}) rotate(-40)" text-anchor="end" font-size="11" fill="#555">${s}</text>`; else out += `<text x="${o}" y="${py1 + 15}" text-anchor="middle" font-size="11" fill="#555">${s}</text>`; }); }
    out += `<line x1="${px0}" y1="${py1}" x2="${px1}" y2="${py1}" stroke="#999"/>`;
    if (sc2) out += `<line x1="${px1}" y1="${py0}" x2="${px1}" y2="${py1}" stroke="#bbb"/>`;
    return out + "</svg>";
  }
  const TYPES = [["Column", "col"], ["Bar", "bar"], ["Line", "line"], ["Area", "area"], ["Pie", "pie"], ["Doughnut", "doughnut"], ["Scatter (X Y)", "scatter"], ["Bubble", "bubble"], ["Radar", "radar"], ["Combo (columns + line)", "combo"], ["Waterfall", "waterfall"], ["Histogram", "histogram"], ["Pareto", "pareto"], ["Funnel", "funnel"], ["Treemap", "treemap"], ["Box and whisker", "box"]];
  window.OffChart = { svg, PAL, nice, TYPES, fit };
})();
