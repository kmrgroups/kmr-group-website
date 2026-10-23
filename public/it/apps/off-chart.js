/* KMR Office Suite - chart drawing (own SVG renderer): column, bar, line, area, pie, doughnut, scatter. */
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const PAL = ["#4472c4", "#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5", "#70ad47", "#264478", "#9e480e", "#636363", "#997300"];
  const nice = (lo, hi, n) => {
    if (lo === hi) { hi = lo + 1; } const span = hi - lo, step0 = span / Math.max(1, n), mag = Math.pow(10, Math.floor(Math.log10(step0))), r = step0 / mag, step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
    const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, t = []; for (let v = a; v <= b + step / 2; v += step) t.push(Math.round(v / step) * step); return { a, b, t, step };
  };
  const fmt = (v) => { const a = Math.abs(v); if (a >= 1e7) return +(v / 1e7).toFixed(2) + "Cr"; if (a >= 1e5) return +(v / 1e5).toFixed(2) + "L"; if (a >= 1e3) return v.toLocaleString("en-IN", { maximumFractionDigits: 2 }); return String(+v.toFixed(4)); };
  const trunc = (s, n) => { s = String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
  /* data: { cats:[], series:[{name, values, color}] } */
  function svg(ch, data, W, H) {
    const type = ch.type || "col", cats = data.cats || [], ser = data.series || []; const ff = 'font-family="Calibri,Arial,sans-serif"';
    let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" ${ff}><rect width="${W}" height="${H}" fill="#fff"/>`;
    if (!ser.length || !ser.some((s) => s.values.some((v) => v != null))) return out + `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="13" fill="#888">No numbers in the chosen range</text></svg>`;
    const col = (i, s) => (s && s.color) || (ch.colors && ch.colors[i]) || PAL[i % PAL.length];
    let top = 12; if (ch.title) { out += `<text x="${W / 2}" y="24" text-anchor="middle" font-size="15" font-weight="700" fill="#222">${esc(ch.title)}</text>`; top = 38; }
    const legend = ch.legend === "none" ? null : ch.legend === "right" ? "r" : "b"; const pie = type === "pie" || type === "doughnut";
    const items = pie ? cats.map((c, i) => [c, PAL[i % PAL.length]]) : ser.map((s, i) => [s.name, col(i, s)]);
    let left = 8, right = W - 10, bottom = H - 8;
    if (legend === "b") { bottom -= 22; const per = Math.max(1, Math.floor((W - 20) / 110)); let x = 14, y = H - 14, row = 0; const total = Math.min(items.length, 40); const rows = Math.ceil(total / per); if (rows > 1) bottom -= (rows - 1) * 16; items.slice(0, 40).forEach((it, i) => { const cc = i % per; if (cc === 0 && i) row++; const px = 14 + cc * 110, py = H - 12 - (rows - 1 - row) * 16; out += `<rect x="${px}" y="${py - 9}" width="10" height="10" fill="${it[1]}"/><text x="${px + 14}" y="${py}" font-size="11" fill="#444">${esc(trunc(it[0], 14))}</text>`; }); }
    if (legend === "r") { const lw = 120; right -= lw; items.slice(0, 30).forEach((it, i) => { const py = top + 12 + i * 18; out += `<rect x="${right + 18}" y="${py - 9}" width="10" height="10" fill="${it[1]}"/><text x="${right + 32}" y="${py}" font-size="11" fill="#444">${esc(trunc(it[0], 14))}</text>`; }); }
    if (pie) {
      const vals = (ser[0].values || []).map((v) => (v > 0 ? v : 0)), sum = vals.reduce((a, b) => a + b, 0) || 1; const cx = (left + right) / 2, cy = (top + bottom) / 2, R = Math.max(20, Math.min(right - left, bottom - top) / 2 - 8), r0 = type === "doughnut" ? R * 0.55 : 0; let a0 = -Math.PI / 2;
      vals.forEach((v, i) => { const a1 = a0 + (v / sum) * Math.PI * 2, large = a1 - a0 > Math.PI ? 1 : 0, c = PAL[i % PAL.length]; const P = (a, r) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]; if (v / sum > 0.9999) out += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${c}"/>${r0 ? `<circle cx="${cx}" cy="${cy}" r="${r0}" fill="#fff"/>` : ""}`; else if (v > 0) { const p1 = P(a0, R), p2 = P(a1, R), q1 = P(a1, r0), q2 = P(a0, r0); out += `<path d="M${p1} A${R} ${R} 0 ${large} 1 ${p2} ${r0 ? `L${q1} A${r0} ${r0} 0 ${large} 0 ${q2}Z` : `L${cx} ${cy}Z`}" fill="${c}" stroke="#fff" stroke-width="1.5"/>`; } if (v / sum > 0.04) { const am = (a0 + a1) / 2, pp = [cx + (r0 ? (R + r0) / 2 : R * 0.62) * Math.cos(am), cy + (r0 ? (R + r0) / 2 : R * 0.62) * Math.sin(am)]; out += `<text x="${pp[0]}" y="${pp[1] + 4}" text-anchor="middle" font-size="11" fill="#fff" font-weight="600">${Math.round((v / sum) * 100)}%</text>`; } a0 = a1; });
      return out + "</svg>";
    }
    const horiz = type === "bar", scat = type === "scatter", area = type === "area", line = type === "line";
    const stack = !!ch.stacked && (type === "col" || type === "bar" || area);
    let lo = Infinity, hi = -Infinity;
    if (stack) { const n = cats.length; for (let i = 0; i < n; i++) { let p = 0, q = 0; ser.forEach((s) => { const v = s.values[i] || 0; if (v >= 0) p += v; else q += v; }); hi = Math.max(hi, p); lo = Math.min(lo, q); } }
    else ser.forEach((s) => s.values.forEach((v) => { if (v != null) { if (v < lo) lo = v; if (v > hi) hi = v; } }));
    if (!(type === "line" || scat)) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    const sc = nice(lo, hi, 5); const lab = sc.t.map(fmt); const lblW = Math.max(...lab.map((s) => s.length)) * 6.2 + 10;
    let xs = null, xlo = 0, xhi = 1, xsc = null; if (scat) { xs = cats.map(Number); const fin = xs.filter(isFinite); xlo = Math.min(...fin); xhi = Math.max(...fin); xsc = nice(xlo, xhi, 6); }
    const catLab = cats.map((c) => String(c)); const maxCat = Math.max(0, ...catLab.map((s) => Math.min(s.length, 14)));
    const rot = !horiz && !scat && cats.length * (maxCat * 6 + 8) > right - left - lblW;
    const bottomAxis = horiz ? 20 : scat ? 20 : rot ? maxCat * 4.2 + 14 : 22; const leftAxis = horiz ? maxCat * 6 + 14 : lblW;
    const px0 = left + leftAxis, px1 = right - 6, py0 = top + 4, py1 = bottom - bottomAxis; const pw = Math.max(10, px1 - px0), ph = Math.max(10, py1 - py0);
    const vy = (v) => py1 - ((v - sc.a) / (sc.b - sc.a)) * ph, vx = (v) => px0 + ((v - sc.a) / (sc.b - sc.a)) * pw;
    // grid and value axis
    sc.t.forEach((t, i) => { if (horiz) { const x = vx(t); out += `<line x1="${x}" y1="${py0}" x2="${x}" y2="${py1}" stroke="#e3e3e3"/><text x="${x}" y="${py1 + 14}" text-anchor="middle" font-size="11" fill="#555">${esc(lab[i])}</text>`; } else { const y = vy(t); out += `<line x1="${px0}" y1="${y}" x2="${px1}" y2="${y}" stroke="${t === 0 ? "#999" : "#e3e3e3"}"/><text x="${px0 - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#555">${esc(lab[i])}</text>`; } });
    const n = cats.length || 1;
    if (scat) {
      const sx = (v) => px0 + ((v - xsc.a) / (xsc.b - xsc.a)) * pw; xsc.t.forEach((t) => { const x = sx(t); out += `<line x1="${x}" y1="${py0}" x2="${x}" y2="${py1}" stroke="#eee"/><text x="${x}" y="${py1 + 14}" text-anchor="middle" font-size="11" fill="#555">${esc(fmt(t))}</text>`; });
      ser.forEach((s, k) => { const c = col(k, s); let d = ""; s.values.forEach((v, i) => { if (v == null || !isFinite(xs[i])) return; const x = sx(xs[i]), y = vy(v); d += (d ? "L" : "M") + x + " " + y; }); out += `<path d="${d}" fill="none" stroke="${c}" stroke-width="2"/>`; s.values.forEach((v, i) => { if (v == null || !isFinite(xs[i])) return; out += `<circle cx="${sx(xs[i])}" cy="${vy(v)}" r="3.5" fill="${c}"/>`; }); });
    } else if (horiz || type === "col") {
      const band = (horiz ? ph : pw) / n, gp = band * 0.2, inner = band - gp, bw = stack ? inner : inner / ser.length; const pos = new Array(n).fill(0), neg = new Array(n).fill(0);
      ser.forEach((s, k) => { const c = col(k, s); s.values.forEach((v, i) => { if (v == null) return; let a, b; if (stack) { if (v >= 0) { a = pos[i]; b = a + v; pos[i] = b; } else { a = neg[i]; b = a + v; neg[i] = b; } } else { a = 0; b = v; } const o = (horiz ? py0 : px0) + band * i + gp / 2 + (stack ? 0 : bw * k); if (horiz) { const x1 = vx(Math.min(a, b)), x2 = vx(Math.max(a, b)); out += `<rect x="${x1}" y="${o}" width="${Math.max(1, x2 - x1)}" height="${Math.max(1, bw - 1)}" fill="${c}"/>`; } else { const y1 = vy(Math.max(a, b)), y2 = vy(Math.min(a, b)); out += `<rect x="${o}" y="${y1}" width="${Math.max(1, bw - 1)}" height="${Math.max(1, y2 - y1)}" fill="${c}"/>`; if (!stack && n * ser.length <= 24) out += `<text x="${o + bw / 2}" y="${(v >= 0 ? y1 : y2) + (v >= 0 ? -3 : 11)}" text-anchor="middle" font-size="9.5" fill="#555">${esc(fmt(v))}</text>`; } }); });
    } else {
      const xAt = (i) => px0 + (n === 1 ? pw / 2 : (pw * i) / (n - 1)) * (area ? 1 : 1) * 1; const acc = new Array(n).fill(0);
      ser.forEach((s, k) => { const c = col(k, s); const pts = []; s.values.forEach((v, i) => { if (v == null) { pts.push(null); return; } let y0 = 0, y; if (stack) { y0 = acc[i]; acc[i] += v; y = acc[i]; } else y = v; pts.push([xAt(i), vy(y), vy(y0)]); }); let d = "", seg = []; const flush = () => { if (!seg.length) return; d += "M" + seg.map((p) => p[0] + " " + p[1]).join("L"); if (area) out += `<path d="M${seg.map((p) => p[0] + " " + p[1]).join("L")}L${seg[seg.length - 1][0]} ${seg[seg.length - 1][2]}L${seg[0][0]} ${seg[0][2]}Z" fill="${c}" fill-opacity="${stack ? 0.85 : 0.45}"/>`; seg = []; }; pts.forEach((p) => { if (p) seg.push(p); else flush(); }); flush(); out += `<path d="${d}" fill="none" stroke="${c}" stroke-width="2.2"/>`; if (line) pts.forEach((p) => { if (p) out += `<circle cx="${p[0]}" cy="${p[1]}" r="3.2" fill="#fff" stroke="${c}" stroke-width="1.8"/>`; }); });
    }
    // category labels
    if (!scat) { const step = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((horiz ? ph / 14 : pw / (rot ? 14 : maxCat * 6 + 8)))))); catLab.forEach((t, i) => { if (i % step) return; const band = (horiz ? ph : pw) / n; const o = line || area ? (horiz ? py0 : px0) + (n === 1 ? (horiz ? ph : pw) / 2 : ((horiz ? ph : pw) * i) / (n - 1)) : (horiz ? py0 : px0) + band * i + band / 2; const s = esc(trunc(t, 14)); if (horiz) out += `<text x="${px0 - 6}" y="${o + 4}" text-anchor="end" font-size="11" fill="#555">${s}</text>`; else if (rot) out += `<text transform="translate(${o},${py1 + 8}) rotate(-40)" text-anchor="end" font-size="11" fill="#555">${s}</text>`; else out += `<text x="${o}" y="${py1 + 15}" text-anchor="middle" font-size="11" fill="#555">${s}</text>`; }); }
    out += `<line x1="${px0}" y1="${py1}" x2="${px1}" y2="${py1}" stroke="#999"/>`;
    return out + "</svg>";
  }
  window.OffChart = { svg, PAL, nice };
})();
