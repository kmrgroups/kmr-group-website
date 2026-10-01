/* Balloon Inspector – free smart drawing reader. Runs entirely in the browser (no AI service, no cost, the drawing
   never leaves the computer). Works on photos, scans and image-only PDFs:
     1. straightens a skewed scan or photo
     2. reads the sheet in zoomed-in tiles (small and stacked tolerances become legible), horizontal and vertical text
     3. checks the actual shapes for Ø (circle with a slash) and ± (plus with a bar under it), which OCR often misreads
     4. finds GD&T feature control frames from their box lines and recognises the symbol from its shape
   Uses helpers from app.js (ocrCanvas, groupText, itemsFromGroups, …). */
"use strict";
(function () {
  /* ---------- black-and-white mask of a sheet ---------- */
  function maskOf(sh, thr = 150) {
    const key = "_mask" + thr;
    if (sh[key] && sh[key].src === sh.canvas) return sh[key];
    const W = sh.canvas.width, H = sh.canvas.height, d = sh.canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    const m = new Uint8Array(W * H);
    for (let p = 0, i = 0; p < W * H; p++, i += 4) m[p] = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) < thr ? 1 : 0;
    sh[key] = { m, W, H, src: sh.canvas }; return sh[key];
  }

  /* ---------- 1. straighten (deskew) ---------- */
  function skewAngle(canvas) {
    const k = Math.min(1, 1000 / canvas.width), w = Math.round(canvas.width * k), h = Math.round(canvas.height * k);
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(canvas, 0, 0, w, h); const d = g.getImageData(0, 0, w, h).data, pts = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 140) pts.push(x - w / 2, y - h / 2); }
    if (pts.length < 200) return 0;
    const score = (a) => { const r = a * Math.PI / 180, s = Math.sin(r), co = Math.cos(r), bins = new Float64Array(h * 2 + 4);
      for (let i = 0; i < pts.length; i += 2) { const y = Math.round(pts[i + 1] * co - pts[i] * s + h); if (y >= 0 && y < bins.length) bins[y]++; }
      let t = 0; for (const b of bins) t += b * b; return t; };
    let best = 0, bs = score(0);
    for (let a = -4; a <= 4.001; a += 0.2) { const v = score(a); if (v > bs) { bs = v; best = a; } }
    for (let a = best - 0.2; a <= best + 0.2001; a += 0.04) { const v = score(a); if (v > bs) { bs = v; best = a; } }
    return Math.abs(best) < 0.08 ? 0 : +best.toFixed(2);
  }
  function rotateCanvas(src, deg) {
    const c = document.createElement("canvas"); c.width = src.width; c.height = src.height; const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingQuality = "high";
    g.translate(c.width / 2, c.height / 2); g.rotate(deg * Math.PI / 180); g.drawImage(src, -src.width / 2, -src.height / 2); return c;
  }
  /** straightens a scanned sheet in place; returns the angle used */
  function deskew(sh) {
    const a = skewAngle(sh.canvas); if (!a) return 0;
    sh.canvas = rotateCanvas(sh.canvas, -a); sh.deskew = (sh.deskew || 0) - a; sh._mask = null; return -a;
  }

  /* ---------- connected pieces of ink inside a rectangle ---------- */
  function comps(M, x0, y0, x1, y1) {
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(M.W, Math.ceil(x1)); y1 = Math.min(M.H, Math.ceil(y1));
    const w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0) return [];
    const lab = new Int32Array(w * h), out = [], st = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (lab[y * w + x] || !M.m[(y + y0) * M.W + x + x0]) continue;
      const id = out.length + 1, c = { id, x0: x, y0: y, x1: x, y1: y, n: 0, px: [] }; lab[y * w + x] = id; st.push(x, y);
      while (st.length) { const yy = st.pop(), xx = st.pop(); c.n++; c.px.push(xx, yy);
        if (xx < c.x0) c.x0 = xx; if (xx > c.x1) c.x1 = xx; if (yy < c.y0) c.y0 = yy; if (yy > c.y1) c.y1 = yy;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = xx + dx, ny = yy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || lab[ny * w + nx] || !M.m[(ny + y0) * M.W + nx + x0]) continue; lab[ny * w + nx] = id; st.push(nx, ny); } }
      out.push(c);
    }
    for (const c of out) { c.x0 += x0; c.x1 += x0; c.y0 += y0; c.y1 += y0; c.w = c.x1 - c.x0 + 1; c.h = c.y1 - c.y0 + 1; c.ox = x0; c.oy = y0; }
    return out;
  }
  /** enclosed holes of one piece: [{cx, cy, n}] */
  function holes(c) {
    const w = c.w + 2, h = c.h + 2, g = new Uint8Array(w * h);
    for (let i = 0; i < c.px.length; i += 2) g[(c.px[i + 1] + c.oy - c.y0 + 1) * w + (c.px[i] + c.ox - c.x0 + 1)] = 1;
    const seen = new Uint8Array(w * h), out = [], fill = (sx, sy) => { const st = [sx, sy]; seen[sy * w + sx] = 1; let n = 0, X = 0, Y = 0, edge = false;
      while (st.length) { const y = st.pop(), x = st.pop(); n++; X += x; Y += y; if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny * w + nx] || g[ny * w + nx]) continue; seen[ny * w + nx] = 1; st.push(nx, ny); } }
      return { n, cx: X / n - 1 + c.x0, cy: Y / n - 1 + c.y0, edge }; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!g[y * w + x] && !seen[y * w + x]) { const r = fill(x, y); if (!r.edge && r.n >= Math.max(4, c.w * c.h * 0.015)) out.push(r); }
    return out;
  }
  const ink = (M, x, y) => x >= 0 && y >= 0 && x < M.W && y < M.H && M.m[Math.round(y) * M.W + Math.round(x)] === 1;

  /* ---------- 3. Ø and ± from the glyph shapes ---------- */
  /** pieces of a word, left to right, that are letter-sized */
  function glyphs(M, box) {
    const pad = box.h * 0.25;
    // long pieces (dimension lines, arrows) are not letters
    return comps(M, box.x - pad, box.y - box.h - pad, box.x + box.w + pad, box.y + pad)
      .filter((c) => c.h >= box.h * 0.12 && c.n >= 6 && c.w <= Math.max(c.h * 2.2, 6)).sort((a, b) => a.x0 - b.x0);
  }
  /** a circle crossed by a slash: two holes side by side (diagonally split), roughly square */
  function isDiameterSign(c, H) {
    if (c.h < H * 0.55 || c.w < c.h * 0.7 || c.w > c.h * 1.5) return false;
    const hs = holes(c); if (hs.length !== 2) return false;
    const dx = Math.abs(hs[0].cx - hs[1].cx), dy = Math.abs(hs[0].cy - hs[1].cy);
    return dx > c.w * 0.18 && dy > c.h * 0.12;
  }
  /** plus sign (vertical + horizontal stroke crossing near the middle) */
  function isPlus(M, c) {
    if (c.w < 4 || c.h < 4 || c.w > c.h * 1.8 || c.h > c.w * 1.8) return false;
    const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2; let v = 0, hz = 0;
    for (let y = c.y0; y <= c.y1; y++) if (ink(M, cx, y) || ink(M, cx - 1, y) || ink(M, cx + 1, y)) v++;
    for (let x = c.x0; x <= c.x1; x++) if (ink(M, x, cy) || ink(M, x, cy - 1) || ink(M, x, cy + 1)) hz++;
    return v >= c.h * 0.8 && hz >= c.w * 0.8 && holes(c).length === 0;
  }
  /** ± : a plus with a flat bar under it (or joined to it) */
  function plusMinusAt(M, gl, i) {
    const c = gl[i]; if (!c) return false;
    const bar = gl.find((b, j) => j !== i && b.h <= Math.max(4, c.h * 0.35) && b.w >= c.w * 0.5 && b.y0 > c.y0 + c.h * 0.55 && b.y0 < c.y1 + c.h * 0.6 && b.x0 < c.x1 && b.x1 > c.x0);
    if (bar && isPlus(M, c)) return true;
    // joined: bottom row of the piece is a long bar and the upper part is a plus
    let low = 0; for (let x = c.x0; x <= c.x1; x++) if (ink(M, x, c.y1) || ink(M, x, c.y1 - 1)) low++;
    if (low >= c.w * 0.8 && c.h > c.w * 0.9) { let v = 0; const cx = (c.x0 + c.x1) / 2; for (let y = c.y0; y < c.y0 + c.h * 0.6; y++) if (ink(M, cx, y) || ink(M, cx - 1, y) || ink(M, cx + 1, y)) v++; return v >= c.h * 0.45; }
    return false;
  }
  const DIA_JUNK = /^[23@©®&%gQoO0øØ⌀]/;
  /** fixes one OCR word using the picture: returns the corrected text */
  function fixWord(M, w0) {
    let w = w0;
    let s = w.s; if (!/\d/.test(s) || w.h < 8) return s;
    const gl = glyphs(M, w); if (!gl.length) return s;
    // letter height from the letters themselves (OCR's box can include an arrow or a line)
    const hs = gl.map((c) => c.h).sort((a, b) => a - b), Hl = hs[Math.floor(hs.length * 0.7)] || w.h;
    w = { ...w, h: Math.min(w.h, Hl * 1.15) };
    // Ø at the start of the word (sometimes after "4X")
    let start = 0; const mx = s.match(/^(\d+\s*[xX×]\s*)/); if (mx) { start = mx[0].length; }
    const firstGl = mx ? gl.find((c) => c.x0 > gl[0].x1 + 1 && gl.indexOf(c) >= (mx[0].replace(/\s/g, "").length)) : gl[0];
    if (firstGl && isDiameterSign(firstGl, w.h) && !/Ø|⌀|ø/.test(s.slice(start, start + 1))) {
      const rest = s.slice(start), alnum = rest.replace(/[^0-9A-Za-z]/g, "").length, big = gl.filter((c) => c.x0 >= firstGl.x0 && c.h >= w.h * 0.5).length;
      const extra = Math.max(0, alnum - big);                                     // OCR made 2 characters out of Ø
      let k = DIA_JUNK.test(rest) || (/^\d/.test(rest) && alnum >= big) ? 1 + extra : 0;
      // better: count the character shapes of the size right after the Ø and compare with what OCR read
      // ("200" with 3 shapes after Ø: OCR left the Ø out, keep the 2; "2200": the first 2 was the Ø)
      const tok = (rest.match(/^[^\s±+]+/) || [""])[0].replace(/[^0-9A-Za-z]/g, "");
      let nG = 0, last = firstGl.x1;
      for (const c of gl.filter((c) => c.x0 > firstGl.x1 && c.h >= w.h * 0.5).sort((a, b) => a.x0 - b.x0)) { if (c.x0 - last > w.h * 0.6) break; nG++; last = c.x1; }
      if (tok && nG && /^\d/.test(tok)) { if (tok.length === nG) k = 0; else if (tok.length === nG + 1) k = 1; else if (tok.length === nG + 2) k = 2; }
      s = s.slice(0, start) + "Ø" + rest.slice(k);
    }
    return s;
  }
  /** a whole callout ("400 =0.2", "75 +0.1", "Ø30 +£0.01", "400 0.2"): decide ± from the glyphs */
  function fixTol(M, g) {
    // a decimal split over two words ("+0. .1/0", "0 .05") is one number
    const s = g.s.replace(/\s+/g, " ").trim().replace(/(\d)\s*\.\s+\.?\s*(\d)/g, "$1.$2").replace(/([+\-±]\s*0)\s+\.(\d)/g, "$1.$2");
    const m = s.match(/^(.*\d)(?:\s*(=|\+£|£|\+-|\+\/-|±|t|\*|\+|x)\s*|\s+)(\d*[.,]\d+)$/);
    if (!m || /±|\//.test(s) || !/\d/.test(m[1]) || /[+-]\s*\d*[.,]?\d+\s*$/.test(m[1])) return s;
    const sym = m[2] || "", tol = m[3].replace(",", ".");
    if (+tol >= 5) return s;
    if (sym && sym !== "+" && sym !== "x") return `${m[1]} ±${tol}`;
    const box = { x: g.x0, y: g.y, w: g.x1 - g.x0, h: g.h }, gl = glyphs(M, box);
    const i = gl.findIndex((c) => c.h >= g.h * 0.35 && c.h <= g.h * 1.1 && isPlus(M, c));
    if (i >= 0 && plusMinusAt(M, gl, i)) return `${m[1]} ±${tol}`;
    if (sym === "x" && /^0[.,]/.test(m[3])) return `${m[1]} ±${tol}`;
    if (sym === "x") { const j = gl.findIndex((c) => c.h >= g.h * 0.35 && c.h <= g.h * 1.1 && c.x0 > box.x + box.w * 0.25); return j >= 0 && plusMinusAt(M, gl, j) ? `${m[1]} ±${tol}` : s; }
    // the sign was lost, or a lone "+0.1" with no lower value: on a drawing that is a ± tolerance
    return `${m[1]} ±${tol}`;
  }

  /* ---------- 4. GD&T feature control frames ---------- */
  function hSegments(M, minLen) {
    const segs = [];
    for (let y = 1; y < M.H - 1; y++) { let run = 0;
      for (let x = 0; x <= M.W; x++) {
        const on = x < M.W && (M.m[y * M.W + x] || M.m[(y - 1) * M.W + x] || M.m[(y + 1) * M.W + x]);
        if (on) run++; else { if (run >= minLen) segs.push({ y, x0: x - run, x1: x - 1 }); run = 0; } } }
    // merge the same line seen on neighbouring rows
    segs.sort((a, b) => a.y - b.y); const out = [];
    for (const s of segs) { const o = out.find((o) => s.y - o.y1 <= 3 && Math.abs(o.x0 - s.x0) < 8 && Math.abs(o.x1 - s.x1) < 8);
      if (o) { o.y1 = s.y; o.y = (o.y0 + o.y1) / 2; } else out.push({ y0: s.y, y1: s.y, y: s.y, x0: s.x0, x1: s.x1 }); }
    return out;
  }
  const vCover = (M, x, ya, yb) => { let n = 0; for (let y = Math.round(ya); y <= yb; y++) if (ink(M, x, y) || ink(M, x - 1, y) || ink(M, x + 1, y)) n++; return n / Math.max(1, yb - ya + 1); };
  function findFrames(sh) {
    const M = maskOf(sh, 195), minH = Math.max(16, M.W * 0.007), maxH = M.W * 0.035;
    const segs = hSegments(M, Math.round(minH * 1.6)).filter((s) => s.x1 - s.x0 < M.W * 0.5), frames = [];
    for (const t of segs) for (const b of segs) {
      const hgt = b.y - t.y; if (hgt < minH || hgt > maxH) continue;
      const dbg = window.BIR_DEBUG && Math.abs(t.x0 - window.BIR_DEBUG.x) < 40 && Math.abs(t.y - window.BIR_DEBUG.y) < 40 ? (m) => console.log("frame?", Math.round(t.x0), Math.round(t.y), Math.round(b.y), m) : () => {};
      if (Math.abs(b.x0 - t.x0) > hgt * 0.25 || Math.abs(b.x1 - t.x1) > hgt * 0.25) { dbg(`ends differ ${t.x0},${t.x1} vs ${b.x0},${b.x1}`); continue; }
      const x0 = Math.max(t.x0, b.x0), x1 = Math.min(t.x1, b.x1);
      const edge = (xa) => { let best = 0; for (let x = xa - 4; x <= xa + 4; x++) best = Math.max(best, vCover(M, x, t.y + 2, b.y - 2)); return best; };
      if (edge(x0) < 0.85 || edge(x1) < 0.85) { dbg(`walls ${edge(x0).toFixed(2)} ${edge(x1).toFixed(2)}`); continue; }
      // inner dividers
      const div = [x0]; let inRun = false;
      for (let x = x0 + 4; x < x1 - 3; x++) { const v = vCover(M, x, t.y0, b.y1) >= 0.86;
        if (v && !inRun) { div.push(x); inRun = true; } else if (!v) inRun = false; }
      div.push(x1);
      // a line closer than half a cell to the previous wall is part of a symbol (e.g. the cross of ⌖), not a cell wall
      const walls = [x0]; for (const x of div.slice(1)) { if (x - walls[walls.length - 1] >= hgt * 0.55 || x === x1) walls.push(x); }
      if (walls.length > 2 && walls[walls.length - 1] - walls[walls.length - 2] < hgt * 0.55) walls.splice(walls.length - 2, 1);
      const cells = []; for (let i = 0; i + 1 < walls.length; i++) cells.push([walls[i], walls[i + 1]]);
      // the upright stroke of a symbol (⌖, ⊥) seen as a wall: the first cell comes out too narrow → join it with the next
      while (cells.length > 2 && cells[0][1] - cells[0][0] < hgt * 0.65 && cells[1][1] - cells[0][0] <= hgt * 1.6) cells.splice(0, 2, [cells[0][0], cells[1][1]]);
      if (cells.length < 2 || cells.length > 7) { dbg(`cells ${cells.length} walls ${div.map(Math.round)}`); continue; }
      const c0 = cells[0][1] - cells[0][0]; if (c0 < hgt * 0.65 || c0 > hgt * 1.6) { dbg(`first cell ${c0} h ${hgt}`); continue; }
      dbg("OK");
      if (frames.some((f) => Math.abs(f.y0 - t.y) < hgt * 0.4 && Math.abs(f.x0 - x0) < hgt)) continue;
      frames.push({ x0, x1, y0: t.y, y1: b.y, h: hgt, cells });
    }
    // a box inside another box (lines of a symbol, a cross touching the walls) is not a frame of its own
    const outer0 = frames.filter((f) => !frames.some((g) => g !== f && g.h > f.h * 1.3 && f.x0 >= g.x0 - 4 && f.x1 <= g.x1 + 4 && f.y0 >= g.y0 - 4 && f.y1 <= g.y1 + 4));
    // drop rows that belong to big tables (title block, revision table): many stacked rows sharing the same edges
    // rows of a table touch each other (one row's bottom line is the next row's top line); separate frames do not
    const touching = (f) => outer0.filter((g) => g !== f && Math.abs(g.x0 - f.x0) < 6 && Math.abs(g.x1 - f.x1) < 6 && (Math.abs(g.y0 - f.y1) < 5 || Math.abs(g.y1 - f.y0) < 5)).length;
    return outer0.filter((f) => touching(f) === 0);
  }
  /* ---------- GD&T symbol recognition by shape matching ----------
     Reference drawings of the 14 ISO 1101 / ASME Y14.5 symbols (a few drawing styles each), plus the symbol characters
     of any font on this computer that has them. A symbol is matched with a chamfer distance, which does not care about
     line thickness or a little blur. */
  const N = 40;
  const SYM_DRAW = {
    "Position": [(g, s) => { g.arc(s / 2, s / 2, s * .3, 0, 7); g.moveTo(s * .08, s / 2); g.lineTo(s * .92, s / 2); g.moveTo(s / 2, s * .08); g.lineTo(s / 2, s * .92); },
                 (g, s) => { g.arc(s / 2, s / 2, s * .34, 0, 7); g.moveTo(s * .1, s / 2); g.lineTo(s * .9, s / 2); g.moveTo(s / 2, s * .1); g.lineTo(s / 2, s * .9); }],
    "Concentricity": [(g, s) => { g.arc(s / 2, s / 2, s * .4, 0, 7); g.moveTo(s / 2 + s * .2, s / 2); g.arc(s / 2, s / 2, s * .2, 0, 7); },
                      (g, s) => { g.arc(s / 2, s / 2, s * .42, 0, 7); g.moveTo(s / 2 + s * .25, s / 2); g.arc(s / 2, s / 2, s * .25, 0, 7); }],
    "Circularity": [(g, s) => { g.arc(s / 2, s / 2, s * .4, 0, 7); }],
    "Cylindricity": [(g, s) => { g.arc(s / 2, s / 2, s * .26, 0, 7); g.moveTo(s * .08, s * .85); g.lineTo(s * .42, s * .1); g.moveTo(s * .58, s * .9); g.lineTo(s * .92, s * .15); },
                     (g, s) => { g.arc(s / 2, s / 2, s * .3, 0, 7); g.moveTo(s * .12, s * .9); g.lineTo(s * .4, s * .08); g.moveTo(s * .6, s * .92); g.lineTo(s * .88, s * .1); }],
    "Flatness": [(g, s) => { g.moveTo(s * .05, s * .72); g.lineTo(s * .7, s * .72); g.lineTo(s * .95, s * .28); g.lineTo(s * .3, s * .28); g.closePath(); },
                 (g, s) => { g.moveTo(s * .1, s * .7); g.lineTo(s * .65, s * .7); g.lineTo(s * .9, s * .3); g.lineTo(s * .35, s * .3); g.closePath(); }],
    "Straightness": [(g, s) => { g.moveTo(s * .08, s / 2); g.lineTo(s * .92, s / 2); }],
    "Perpendicularity": [(g, s) => { g.moveTo(s / 2, s * .1); g.lineTo(s / 2, s * .85); g.moveTo(s * .1, s * .85); g.lineTo(s * .9, s * .85); }],
    "Parallelism": [(g, s) => { g.moveTo(s * .15, s * .88); g.lineTo(s * .45, s * .12); g.moveTo(s * .55, s * .88); g.lineTo(s * .85, s * .12); },
                    (g, s) => { g.moveTo(s * .2, s * .9); g.lineTo(s * .45, s * .1); g.moveTo(s * .55, s * .9); g.lineTo(s * .8, s * .1); }],
    "Angularity": [(g, s) => { g.moveTo(s * .9, s * .82); g.lineTo(s * .1, s * .82); g.lineTo(s * .8, s * .18); },
                   (g, s) => { g.moveTo(s * .92, s * .8); g.lineTo(s * .1, s * .8); g.lineTo(s * .75, s * .1); }],
    "Symmetry": [(g, s) => { g.moveTo(s * .08, s / 2); g.lineTo(s * .92, s / 2); g.moveTo(s * .25, s * .3); g.lineTo(s * .75, s * .3); g.moveTo(s * .25, s * .7); g.lineTo(s * .75, s * .7); }],
    "Profile of a line": [(g, s) => { g.arc(s / 2, s * .68, s * .38, Math.PI, 0); }],
    "Profile of a surface": [(g, s) => { g.arc(s / 2, s * .68, s * .38, Math.PI, 0); g.closePath(); },
                             (g, s) => { g.arc(s / 2, s * .72, s * .4, Math.PI, 0); g.closePath(); }],
    "Circular runout": [(g, s) => { g.moveTo(s * .2, s * .85); g.lineTo(s * .8, s * .15); g.moveTo(s * .8, s * .15); g.lineTo(s * .52, s * .22); g.moveTo(s * .8, s * .15); g.lineTo(s * .74, s * .44); }],
    "Total runout": [(g, s) => { for (const o of [-.18, .18]) { g.moveTo(s * (.32 + o), s * .85); g.lineTo(s * (.68 + o), s * .15); g.moveTo(s * (.68 + o), s * .15); g.lineTo(s * (.5 + o), s * .2); g.moveTo(s * (.68 + o), s * .15); g.lineTo(s * (.64 + o), s * .38); } g.moveTo(s * .1, s * .85); g.lineTo(s * .55, s * .85); }],
  };
  const SYM_CHAR = { "⌖": "Position", "◎": "Concentricity", "○": "Circularity", "⌭": "Cylindricity", "⏥": "Flatness", "⊥": "Perpendicularity", "∥": "Parallelism",
    "∠": "Angularity", "⌯": "Symmetry", "⌒": "Profile of a line", "⌓": "Profile of a surface", "↗": "Circular runout", "⌰": "Total runout" };
  /** ink → N×N picture keeping the shape's proportions */
  function normBits(get, x0, y0, w, h) {
    const sc = (N - 4) / Math.max(w, h), ox = (N - w * sc) / 2, oy = (N - h * sc) / 2, b = new Uint8Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const sx = x0 + (x - ox) / sc, sy = y0 + (y - oy) / sc;
      if (sx < x0 - 0.5 || sy < y0 - 0.5 || sx > x0 + w - 0.5 || sy > y0 + h - 0.5) continue;
      // sample a small neighbourhood so thin lines survive shrinking
      const r = Math.max(0.5, 0.5 / sc); let on = 0;
      for (let dy = -r; dy <= r; dy += Math.max(0.5, r)) for (let dx = -r; dx <= r; dx += Math.max(0.5, r)) if (get(Math.round(sx + dx), Math.round(sy + dy))) on = 1;
      b[y * N + x] = on;
    }
    return b;
  }
  function distMap(b) {   // two-pass chamfer distance transform
    const D = new Float32Array(N * N), INF = 1e4;
    for (let i = 0; i < N * N; i++) D[i] = b[i] ? 0 : INF;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let d = D[y * N + x];
      if (x > 0) d = Math.min(d, D[y * N + x - 1] + 1); if (y > 0) d = Math.min(d, D[(y - 1) * N + x] + 1);
      if (x > 0 && y > 0) d = Math.min(d, D[(y - 1) * N + x - 1] + 1.414); if (x < N - 1 && y > 0) d = Math.min(d, D[(y - 1) * N + x + 1] + 1.414); D[y * N + x] = d; }
    for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) { let d = D[y * N + x];
      if (x < N - 1) d = Math.min(d, D[y * N + x + 1] + 1); if (y < N - 1) d = Math.min(d, D[(y + 1) * N + x] + 1);
      if (x < N - 1 && y < N - 1) d = Math.min(d, D[(y + 1) * N + x + 1] + 1.414); if (x > 0 && y < N - 1) d = Math.min(d, D[(y + 1) * N + x - 1] + 1.414); D[y * N + x] = d; }
    return D;
  }
  function inkBox(get, W, H) { let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (get(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; }
  let TPL = null;
  function templates() {
    if (TPL) return TPL; TPL = [];
    const S = 96, add = (name, paint) => {
      const c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d", { willReadFrequently: true });
      g.fillStyle = "#fff"; g.fillRect(0, 0, S, S); g.fillStyle = g.strokeStyle = "#000"; paint(g, S);
      const d = g.getImageData(0, 0, S, S).data, get = (x, y) => x >= 0 && y >= 0 && x < S && y < S && d[(y * S + x) * 4] < 128, bx = inkBox(get, S, S); if (!bx) return;
      const b = normBits(get, bx.x0, bx.y0, bx.w, bx.h); TPL.push({ name, b, D: distMap(b), aspect: bx.w / bx.h });
    };
    for (const [name, list] of Object.entries(SYM_DRAW)) for (const f of list) for (const lw of [0.05, 0.08])
      add(name, (g, s) => { g.lineWidth = s * lw; g.lineCap = "round"; g.beginPath(); f(g, s); g.stroke(); });
    // the symbol characters of fonts on this computer (skipped when a font does not have the character)
    const fonts = ["Segoe UI Symbol", "Cambria Math", "STIX Two Math", "DejaVu Sans", "Arial Unicode MS", "Noto Sans Symbols", "Noto Sans Math"];
    for (const font of fonts) for (const [ch, name] of Object.entries(SYM_CHAR)) {
      if (document.fonts && document.fonts.check && !document.fonts.check(`60px "${font}"`, ch)) continue;
      add(name, (g, s) => { g.font = `${s * 0.75}px "${font}"`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(ch, s / 2, s / 2); });
    }
    return TPL;
  }
  /** GD&T symbol from its shape */
  function symbolOf(sh, f) {
    const M = maskOf(sh, 170), [cx0, cx1] = f.cells[0];
    const X0 = Math.round(cx0), Y0 = Math.round(f.y0), W = Math.round(cx1) - X0 + 1, H = Math.round(f.y1) - Y0 + 1;
    // the cell, without its walls: long runs near each edge are wall lines (the symbol itself may come close to them)
    const L = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) L[y * W + x] = M.m[(Y0 + y) * M.W + X0 + x];
    // peel the walls: from each edge inwards, rows / columns that are mostly ink are wall; stop at the first one that is not
    const band = Math.max(3, Math.round(f.h * 0.22));
    const rowF = (y) => { let n = 0; for (let x = 0; x < W; x++) n += L[y * W + x]; return n / W; }, colF = (x) => { let n = 0; for (let y = 0; y < H; y++) n += L[y * W + x]; return n / H; };
    const peel = (len, frac, clear) => { for (let i = 0, hit = false; i < band; i++) { const v = frac(i); if (v >= 0.35) { clear(i); hit = true; } else if (hit || i > 2) break; } };
    peel(H, rowF, (y) => L.fill(0, y * W, y * W + W));
    peel(H, (i) => rowF(H - 1 - i), (i) => L.fill(0, (H - 1 - i) * W, (H - i) * W));
    peel(W, colF, (x) => { for (let y = 0; y < H; y++) L[y * W + x] = 0; });
    peel(W, (i) => colF(W - 1 - i), (i) => { for (let y = 0; y < H; y++) L[y * W + W - 1 - i] = 0; });
    // keep pieces big enough to be part of the symbol
    const seen = new Uint8Array(W * H), keep = new Uint8Array(W * H); let any = false;
    for (let i = 0; i < W * H; i++) { if (!L[i] || seen[i]) continue; const st = [i], px = []; seen[i] = 1;
      while (st.length) { const p = st.pop(); px.push(p); const x = p % W, y = (p - x) / W;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy, q = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[q] || !L[q]) continue; seen[q] = 1; st.push(q); } }
      if (px.length >= Math.max(6, f.h * 0.2)) { any = true; for (const p of px) keep[p] = 1; } }
    if (!any) return { name: "", conf: 0 };
    const get = (x, y) => x >= 0 && y >= 0 && x < W && y < H && keep[y * W + x] === 1, bx = inkBox(get, W, H);
    const b = normBits(get, bx.x0, bx.y0, bx.w, bx.h), D = distMap(b), aspect = bx.w / bx.h;
    const score = (t) => { let a = 0, na = 0, c = 0, nc = 0;
      for (let i = 0; i < N * N; i++) { if (b[i]) { a += t.D[i]; na++; } if (t.b[i]) { c += D[i]; nc++; } }
      // a very different width-to-height ratio is a strong hint too (a line vs a circle)
      return (a / Math.max(1, na) + c / Math.max(1, nc)) / 2 + Math.abs(Math.log(aspect / t.aspect)) * 1.2; };
    const best = {}; for (const t of templates()) { const v = score(t); if (best[t.name] == null || v < best[t.name]) best[t.name] = v; }
    const ranked = Object.entries(best).sort((p, q) => p[1] - q[1]);
    const [n1, v1] = ranked[0], v2 = ranked[1] ? ranked[1][1] : v1 + 3;
    const conf = Math.max(0.3, Math.min(0.9, 0.55 + (v2 - v1) * 0.25 - Math.max(0, v1 - 2) * 0.1));
    return { name: n1, conf: +conf.toFixed(2), score: +v1.toFixed(2), next: ranked[1] ? ranked[1][0] : "", top: ranked.slice(0, 4).map(([n, v]) => n + " " + v.toFixed(2)) };
  }
  function crop(sh, x0, y0, x1, y1, scale) {
    const c = document.createElement("canvas"), w = x1 - x0, h = y1 - y0, k = scale, pad = Math.round(h * 0.6);
    c.width = Math.round(w * k) + pad * 2; c.height = Math.round(h * k) + pad * 2; const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingQuality = "high"; g.drawImage(sh.canvas, x0, y0, w, h, pad, pad, w * k, h * k); return c;
  }
  /** how far the walls of a cell reach into it, on each side */
  function cellInset(M, X0, Y0, W, H, f) {
    const band = Math.max(3, Math.round(f.h * 0.25)), at = (x, y) => M.m[(Y0 + y) * M.W + X0 + x];
    const rowF = (y) => { let n = 0; for (let x = 0; x < W; x++) n += at(x, y); return n / W; }, colF = (x) => { let n = 0; for (let y = 0; y < H; y++) n += at(x, y); return n / H; };
    const go = (frac) => { let last = -1; for (let i = 0, hit = false; i < band; i++) { if (frac(i) >= 0.72) { last = i; hit = true; } else if (hit || i > 2) break; } return last + 1; };
    return { t: go(rowF), b: go((i) => rowF(H - 1 - i)), l: go(colF), r: go((i) => colF(W - 1 - i)) };
  }
  async function readCell(sh, f, cell, psm) {
    const M = maskOf(sh, 170), X0 = Math.round(cell[0]), Y0 = Math.round(f.y0), W = Math.round(cell[1]) - X0 + 1, H = Math.round(f.y1) - Y0 + 1;
    const ins = cellInset(M, X0, Y0, W, H, f), g = Math.max(1, f.h * 0.04), k = Math.max(1, 70 / f.h);
    const words = await ocrCanvas(crop(sh, X0 + ins.l + g, Y0 + ins.t + g, X0 + W - ins.r - g, Y0 + H - ins.b - g, k), psm, 0);
    return words.map((w) => w.s).join(" ").trim();
  }
  async function readFrame(sh, si, f) {
    const sym = symbolOf(sh, f);
    let tol = await readCell(sh, f, f.cells[1], 7);
    const M = maskOf(sh), cell = f.cells[1], m = Math.max(3, f.h * 0.12);
    // Ø in the tolerance cell (diameter tolerance zone)
    const first = comps(M, cell[0] + m, f.y0 + m, cell[1] - m, f.y1 - m).filter((c) => c.h > f.h * 0.3).sort((a, b) => a.x0 - b.x0)[0];
    let dia = /^[ØøO@©⌀]|^2(?=\d?[.,])/.test(tol) || (first && isDiameterSign(first, first.h));
    tol = tol.replace(/^[ØøO@©⌀](?=\s*\d|\s*[.,])/, "").replace(/^2(?=0?[.,]\d)/, dia ? "" : "2").replace(/,/g, ".");
    const mod = /\(M\)|Ⓜ|\bM\b/.test(tol) ? "Ⓜ" : /\(L\)|Ⓛ|\bL\b/.test(tol) ? "Ⓛ" : "";
    if (dia) tol = tol.replace(/^0(?=0[.,]\d)/, "");
    const num = (tol.match(/\d*\.\d+|\d+/) || [])[0];
    const datums = [];
    for (let i = 2; i < f.cells.length; i++) {
      // datum letters, read without a letter filter: this OCR drops a letter it first took for a digit (B → 8),
      // so look-alike digits are mapped back to their letters
      const LOOK = { "8": "B", "0": "D", "5": "S", "2": "Z", "6": "G", "4": "A", "7": "T", "|": "I" };
      const pick = (txt) => (txt || "").replace(/[^A-Za-z0-9|]/g, "").slice(0, 2).toUpperCase().split("").map((ch) => LOOK[ch] || ch).join("").replace(/[^A-Z]/g, "");
      // a common datum ("A-B") keeps its dash
      const pair = (txt) => { const m = String(txt || "").toUpperCase().match(/([A-Z0-9])\s*[-–—~]\s*([A-Z0-9])/); return m ? pick(m[1]) + "-" + pick(m[2]) : ""; };
      let raw = await readCell(sh, f, f.cells[i], 10), t = pair(raw) || pick(raw);
      if (!t) { raw = await readCell(sh, f, f.cells[i], 7); t = pair(raw) || pick(raw); }
      if (!t) { raw = await readCell(sh, f, f.cells[i], 8); t = pair(raw) || pick(raw); }
      if (t && !/-/.test(t) && t.length === 2 && t[0] === t[1]) t = t[0];          // one letter read twice
      if (t) datums.push(/-/.test(t) && t.length === 3 ? t : t.replace(/-/g, "").slice(0, 2));
    }
    const text = `${sym.name ? sym.name + " " : ""}${dia ? "Ø" : ""}${num || "?"}${mod ? "(" + (mod === "Ⓜ" ? "M" : "L") + ")" : ""}${datums.length ? " | " + datums.join(" | ") : ""}`;
    const conf = Math.min(sym.conf || 0.3, num ? 0.85 : 0.3);
    return newItem(si, f.x0, (f.y0 + f.y1) / 2, { type: "GD&T", text, nominal: null, upper: num != null ? +num : null, lower: 0, gdt: sym.name || "(check symbol)",
      datum: datums.join("|"), unit: "mm", conf: +conf.toFixed(2), source: "ocr", ex: f.x1 });
  }
  function api_whitelist(chars) { try { ocrEng && ocrEng.api.SetVariable("tessedit_char_whitelist", chars); } catch (e) {} }

  /** typical letter height on the sheet, from the size of small ink pieces (two-pass labelling, boxes only) */
  function textHeight(M) {
    const W = M.W, H = M.H, lab = new Int32Array(W * H), par = [0], bx = [null];
    const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x; if (!M.m[p]) continue;
      const l = x > 0 ? lab[p - 1] : 0, u = y > 0 ? lab[p - W] : 0, ul = x > 0 && y > 0 ? lab[p - W - 1] : 0, ur = x < W - 1 && y > 0 ? lab[p - W + 1] : 0;
      const ns = [l, u, ul, ur].filter(Boolean);
      if (!ns.length) { const id = par.length; par.push(id); bx.push([x, y, x, y]); lab[p] = id; continue; }
      let r = find(ns[0]); for (const q of ns) { const rq = find(q); if (rq !== r) { par[rq] = r; } } lab[p] = r;
      const b = bx[r]; if (x < b[0]) b[0] = x; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
    }
    const roots = new Map();
    for (let i = 1; i < par.length; i++) { const r = find(i), b = bx[i]; const R = roots.get(r);
      if (!R) roots.set(r, b.slice()); else { R[0] = Math.min(R[0], b[0]); R[1] = Math.min(R[1], b[1]); R[2] = Math.max(R[2], b[2]); R[3] = Math.max(R[3], b[3]); } }
    const hs = [];
    for (const b of roots.values()) { const w = b[2] - b[0] + 1, h = b[3] - b[1] + 1; if (h >= 8 && h <= 120 && w <= h * 1.2 && w >= h * 0.25) hs.push(h); }
    if (hs.length < 20) return 0;
    hs.sort((a, b) => a - b); return hs[Math.floor(hs.length * 0.6)];
  }

  /** a copy of the sheet without long straight lines (dimension lines, leaders touching text, borders): text reads better */
  function withoutLines(canvas, M, th) {
    const L = Math.max(24, Math.round(th * 1.5)), W = M.W, H = M.H;
    const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(canvas, 0, 0); const img = g.getImageData(0, 0, W, H), d = img.data;
    const wipe = (p) => { const i = p * 4; d[i] = d[i + 1] = d[i + 2] = 255; };
    const soft = (p) => { const i = p * 4; if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 215) d[i] = d[i + 1] = d[i + 2] = 255; };
    for (let y = 0; y < H; y++) { let run = 0;
      for (let x = 0; x <= W; x++) { const on = x < W && M.m[y * W + x];
        if (on) run++; else { if (run >= L) for (let k = x - run; k < x; k++) { wipe(y * W + k); if (y > 0) soft((y - 1) * W + k); if (y < H - 1) soft((y + 1) * W + k); } run = 0; } } }
    for (let x = 0; x < W; x++) { let run = 0;
      for (let y = 0; y <= H; y++) { const on = y < H && M.m[y * W + x];
        if (on) run++; else { if (run >= L) for (let k = y - run; k < y; k++) { wipe(k * W + x); if (x > 0) soft(k * W + x - 1); if (x < W - 1) soft(k * W + x + 1); } run = 0; } } }
    g.putImageData(img, 0, 0); return c;
  }

  /** a copy of the sheet without dashed centre / hidden lines (they cut through text: "Ø52" read as "Ø521").
      A dash is a short thin stroke; three or more in a row on one line make a dashed line. Where a letter stroke crosses the
      dash (ink just above and below it) that column is kept, so the letters stay whole. */
  function withoutDashes(canvas, M, th) {
    const W = M.W, H = M.H, thin = Math.max(3, Math.round(th * 0.22)), dmin = Math.max(6, th * 0.5), dmax = th * 5;
    const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(canvas, 0, 0); const img = g.getImageData(0, 0, W, H), d = img.data; let wiped = 0;
    const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && M.m[y * W + x] === 1;
    for (const vert of [false, true]) {
      const A = vert ? W : H, B = vert ? H : W, get = vert ? (a, b) => at(a, b) : (a, b) => at(b, a);
      // runs along each line
      const runs = [];
      for (let a = 0; a < A; a++) { let r = 0;
        for (let b = 0; b <= B; b++) { if (b < B && get(a, b)) r++; else { if (r >= dmin && r <= dmax) runs.push({ a, b0: b - r, b1: b - 1 }); r = 0; } } }
      // the same dash on neighbouring lines → one stroke with a thickness
      runs.sort((p, q) => p.b0 - q.b0 || p.a - q.a); const segs = [];
      for (const r of runs) { const o = segs.find((o) => r.a - o.a1 <= 1 && r.a >= o.a0 && Math.abs(o.b0 - r.b0) <= 3 && Math.abs(o.b1 - r.b1) <= 3);
        if (o) { o.a1 = r.a; } else segs.push({ a0: r.a, a1: r.a, b0: r.b0, b1: r.b1 }); }
      // a dash is longer than a letter's crossbar, thin, and free at both ends (a crossbar touches the letter's stems)
      const freeEnd = (o, b) => { for (let a = o.a0 - 1; a <= o.a1 + 1; a++) if (get(a, b)) return false; return true; };
      const dashes = segs.filter((o) => o.a1 - o.a0 + 1 <= thin && o.b1 - o.b0 + 1 >= th * 0.8)
        .map((o) => ({ ...o, m: (o.a0 + o.a1) / 2, len: o.b1 - o.b0 + 1, free: freeEnd(o, o.b0 - 2) && freeEnd(o, o.b1 + 2) })).sort((p, q) => p.b0 - q.b0);
      // chains of dashes on one line, evenly spaced
      const used = new Set();
      for (const s0 of dashes) { if (used.has(s0)) continue;
        const chain = [s0]; let last = s0;
        for (const t of dashes) { if (t === s0 || used.has(t) || chain.includes(t)) continue; const gap = t.b0 - last.b1;
          if (gap >= 3 && gap <= Math.max(th * 2, last.len * 1.2) && Math.abs(t.m - last.m) <= Math.max(2, th * 0.12) && t.len <= last.len * 2.5 && last.len <= t.len * 2.5) { chain.push(t); last = t; } }
        const gaps = chain.slice(1).map((t, i) => t.b0 - chain[i].b1), gmax = Math.max(...gaps, 0), gmin = Math.min(...gaps, 1e9);
        if (chain.length >= 3 && gmax > gmin * 3 + 4) continue;
        if (chain.length < 3 || chain.filter((t) => t.free).length < 2) continue;      // a dash through text is not free; the others are
        for (const t of chain) { used.add(t);
          for (let b = t.b0; b <= t.b1; b++) {
            // a letter stroke crossing the dash: keep this column
            if (get(t.a0 - 2, b) && get(t.a1 + 2, b)) continue;
            for (let a = t.a0 - 1; a <= t.a1 + 1; a++) { const x = vert ? a : b, y = vert ? b : a; if (x < 0 || y < 0 || x >= W || y >= H) continue;
              const i = (y * W + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; wiped++; } } }
      }
    }
    g.putImageData(img, 0, 0); return wiped ? c : canvas;
  }

  /** letter-sized ink pieces of the whole sheet (boxes only) */
  function letterBoxes(M, th) {
    const W = M.W, H = M.H, lab = new Int32Array(W * H), par = [0], bx = [null];
    const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x; if (!M.m[p]) continue;
      const ns = [x > 0 ? lab[p - 1] : 0, y > 0 ? lab[p - W] : 0, x > 0 && y > 0 ? lab[p - W - 1] : 0, x < W - 1 && y > 0 ? lab[p - W + 1] : 0].filter(Boolean);
      if (!ns.length) { const id = par.length; par.push(id); bx.push([x, y, x, y]); lab[p] = id; continue; }
      let r = find(ns[0]); for (const q of ns) { const rq = find(q); if (rq !== r) par[rq] = r; } lab[p] = r;
      const b = bx[r]; if (x < b[0]) b[0] = x; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
    }
    const roots = new Map();
    for (let i = 1; i < par.length; i++) { const r = find(i), b = bx[i], R = roots.get(r);
      if (!R) roots.set(r, b.slice()); else { R[0] = Math.min(R[0], b[0]); R[1] = Math.min(R[1], b[1]); R[2] = Math.max(R[2], b[2]); R[3] = Math.max(R[3], b[3]); } }
    const out = [];
    for (const b of roots.values()) { const w = b[2] - b[0] + 1, h = b[3] - b[1] + 1;
      if (Math.max(w, h) >= th * 0.55 && Math.max(w, h) <= th * 2 && Math.min(w, h) >= 2) out.push({ x0: b[0], y0: b[1], x1: b[2], y1: b[3], w, h }); }
    return out;
  }
  async function rescue(sh, TX, th, words, frames) {
    const covered = (b) => words.some((w) => b.x1 > w.x - th * 0.12 && b.x0 < w.x + w.w + th * 0.12 && b.y1 > w.y - w.h - th * 0.12 && b.y0 < w.y + th * 0.12)
      || frames.some((f) => b.x1 > f.x0 - 4 && b.x0 < f.x1 + 4 && b.y1 > f.y0 - 4 && b.y0 < f.y1 + 4);
    const free = letterBoxes(TX, th).filter((b) => !covered(b) && b.x0 > TX.W * 0.02 && b.x1 < TX.W * 0.98 && b.y0 > TX.H * 0.02 && b.y1 < TX.H * 0.98);
    // chain neighbours on a line into callouts (horizontal), and in a column (vertical text)
    const out = [], used = new Set();
    for (const vert of [false, true]) {
      const list = free.filter((b) => !used.has(b) && (vert ? b.w >= b.h * 0.25 : b.h >= b.w * 0.25)).sort((a, b) => vert ? a.y0 - b.y0 : a.x0 - b.x0);
      for (const b of list) { if (used.has(b)) continue;
        const run = [b]; let last = b;
        for (const c of list) { if (c === b || used.has(c) || run.includes(c)) continue;
          const gap = vert ? c.y0 - last.y1 : c.x0 - last.x1, off = vert ? Math.abs((c.x0 + c.x1) - (last.x0 + last.x1)) / 2 : Math.abs((c.y0 + c.y1) - (last.y0 + last.y1)) / 2;
          if (gap > -2 && gap < th * 0.75 && off < th * 0.45) { run.push(c); last = c; } }
        if (run.length < 2 || run.length > 16) continue;
        run.forEach((c) => used.add(c));
        const x0 = Math.min(...run.map((c) => c.x0)), x1 = Math.max(...run.map((c) => c.x1)), y0 = Math.min(...run.map((c) => c.y0)), y1 = Math.max(...run.map((c) => c.y1));
        out.push({ vert, x0, x1, y0, y1 });
      }
    }
    const hz = [], vt = [], H = TX.H, replaced = new Set(), hwords = words.filter((w) => !w.vert);
    const digits = (x) => String(x || "").replace(/\D/g, "");
    for (const r of out.slice(0, 40)) {
      const mine = [];
      if (!r.vert) {
        const line = hwords.filter((w) => Math.abs(w.y - r.y1) < th * 0.7);
        // pieces of a word OCR already read (its box is a little tight): not new text
        if (line.some((w) => Math.min(w.x + w.w, r.x1) - Math.max(w.x, r.x0) > (r.x1 - r.x0) * 0.4)) continue;
        // right next to a word: read both together as one callout
        for (const w of line) if (r.x0 - (w.x + w.w) < th * 1.1 && w.x - r.x1 < th * 1.1 && w.h >= (r.y1 - r.y0 + 1) * 0.8) { r.x0 = Math.min(r.x0, w.x); r.x1 = Math.max(r.x1, w.x + w.w); r.y0 = Math.min(r.y0, w.y - w.h); r.y1 = Math.max(r.y1, w.y); mine.push(w); }
      }
      const lh = r.vert ? r.x1 - r.x0 + 1 : r.y1 - r.y0 + 1, k = Math.max(1, 46 / lh), m = lh * 0.35;
      let c = cropC(sh._txt, r.x0 - m, r.y0 - m, r.x1 + m, r.y1 + m, k); if (r.vert) c = rotCanvas(c, true);
      const t = cleanOcr((await ocrCanvas(c, 7, 0)).filter((q) => q.conf >= 0.3).map((q) => q.s).join(" ")).trim();
      if (!t || !/\d/.test(t) || t.length < 2) continue;
      // the merged reading must still contain what was already read; otherwise keep the first reading
      if (mine.length && !mine.every((w) => digits(t).includes(digits(w.s)))) continue;
      mine.forEach((w) => replaced.add(w));
      if (!r.vert) hz.push({ s: t, x: r.x0, y: r.y1, w: r.x1 - r.x0, h: lh, conf: 0.6, rescued: true });
      else vt.push({ s: t, x: H - r.y1, y: r.x1, w: r.y1 - r.y0, h: lh, conf: 0.6, rescued: true });   // in the turned sheet's coordinates
    }
    return { hz, vt, replaced };
  }

  /* ---------- 2. tiled, zoomed OCR ---------- */
  async function ocrTiles(sh, vertical, label, k) {
    const base = sh._clean || sh.canvas, src = vertical ? rotCanvas(base, true) : base, W = src.width, H = src.height;
    const T = Math.round(Math.min(2400, 2000 / k)), ov = Math.round(T * 0.08), words = [];
    const xs = [], ys = []; for (let x = 0; x < W; x += T - ov) { xs.push(x); if (x + T >= W) break; } for (let y = 0; y < H; y += T - ov) { ys.push(y); if (y + T >= H) break; }
    let n = 0; const total = xs.length * ys.length;
    for (const y0 of ys) for (const x0 of xs) {
      n++; busy(`${label} — part ${n} of ${total}`); await tick();
      const w = Math.min(T, W - x0), h = Math.min(T, H - y0), c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingQuality = "high"; g.drawImage(src, x0, y0, w, h, 0, 0, c.width, c.height);
      // low-confidence words are kept when they look like part of a callout (digits, ±, Ø …): the shape checks verify them
      for (const wd of (await ocrCanvas(c, 11, 0)).filter((q) => q.conf >= 0.35 || (q.conf >= 0.05 && /[\d±+=£Ø⌀°]/.test(q.s) && q.s.length <= 14) || (q.conf >= 0.2 && /^[A-Z]{2,}$/.test(q.s)))) {
        const r = { s: wd.s, x: x0 + wd.x / k, y: y0 + wd.y / k, w: wd.w / k, h: wd.h / k, conf: wd.conf };
        const edge = (r.x < x0 + 3 && x0 > 0) || (r.x + r.w > x0 + w - 3 && x0 + w < W) || (r.y - r.h < y0 + 3 && y0 > 0) || (r.y > y0 + h - 3 && y0 + h < H);
        r.edge = edge; words.push(r);
      }
    }
    // the same word read in two overlapping tiles: keep the one not cut by a tile edge, else the more confident
    const keep = [];
    for (const r of words.sort((a, b) => (a.edge - b.edge) || (b.conf - a.conf))) {
      const ov2 = keep.find((q) => { const ix = Math.min(q.x + q.w, r.x + r.w) - Math.max(q.x, r.x), iy = Math.min(q.y, r.y) - Math.max(q.y - q.h, r.y - r.h);
        return ix > 0 && iy > 0 && ix * iy > 0.35 * Math.min(q.w * q.h, r.w * r.h); });
      if (!ov2) keep.push(r);
    }
    return keep;
  }

  /* ---------- second look at each dimension: zoom into the callout and read it as one line ---------- */
  function cropC(canvas, x0, y0, x1, y1, k) {
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(canvas.width, x1); y1 = Math.min(canvas.height, y1);
    const pad = 16, c = document.createElement("canvas"); c.width = Math.round((x1 - x0) * k) + pad * 2; c.height = Math.round((y1 - y0) * k) + pad * 2;
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingQuality = "high";
    g.drawImage(canvas, x0, y0, x1 - x0, y1 - y0, pad, pad, (x1 - x0) * k, (y1 - y0) * k); return c;
  }
  const NUM = /[-+]?\d*\.\d+|[-+]?\d+/g;
  /** small numbers stacked to the right of a size (upper over lower deviation) */
  async function stackedTol(src, M, g) {
    const h = g.h;
    // where the full-height digits of the size end (OCR sometimes swallows the small stacked text into the word)
    const tall = comps(M, g.x0 - h * 0.2, g.y - h * 1.3, g.x1 + h * 0.2, g.y + h * 0.3).filter((c) => c.h >= h * 0.62 && c.h <= h * 1.4).sort((a, b) => a.x0 - b.x0);
    let end = g.x1; if (tall.length) { end = tall[0].x1; for (const c of tall.slice(1)) { if (c.x0 - end > h * 0.9) break; end = Math.max(end, c.x1); } }
    let start = tall.length ? tall[0].x0 : g.x0;
    const left = comps(M, g.x0 - h * 4, g.y - h * 1.3, g.x0 + h * 0.3, g.y + h * 0.3).filter((c) => c.h >= h * 0.62 && c.h <= h * 1.4 && c.x1 < start + 2).sort((a, b) => b.x1 - a.x1);
    for (const c of left) { if (start - c.x1 > h * 0.9) break; start = Math.min(start, c.x0); }
    g._start = start;
    const pieces = comps(M, end + h * 0.05, g.y - h * 1.5, end + h * 4.2, g.y + h * 0.35)
      .filter((c) => c.h >= h * 0.25 && c.h <= h * 0.85 && c.w <= h * 1.2);
    g._end = end;
    if (pieces.length < 4) return null;
    const mid = g.y - h * 0.5, up = pieces.filter((c) => (c.y0 + c.y1) / 2 < mid), lo = pieces.filter((c) => (c.y0 + c.y1) / 2 >= mid);
    if (up.length < 2 || lo.length < 1) return null;
    // the two rows must start near each other and right after the size
    const ux0 = Math.min(...up.map((c) => c.x0)), lx0 = Math.min(...lo.map((c) => c.x0));
    if (Math.abs(ux0 - lx0) > h * 0.9 || Math.min(ux0, lx0) - end > h * 1.2) return null;
    const row = async (list) => { const x0 = Math.min(...list.map((c) => c.x0)), x1 = Math.max(...list.map((c) => c.x1)), y0 = Math.min(...list.map((c) => c.y0)), y1 = Math.max(...list.map((c) => c.y1));
      const k = Math.max(1, 42 / (y1 - y0 + 1)); api_whitelist("+-0123456789.");
      const t = (await ocrCanvas(cropC(src, x0 - 3, y0 - 3, x1 + 3, y1 + 3, k), 7, 0)).map((w) => w.s).join(""); api_whitelist(""); return t; };
    const a = (await row(up)).match(NUM), b = (await row(lo)).match(NUM);
    if (!a || !b) return null;
    let u = +a[0], l = +b[0];
    if (!/^[-+]/.test(a[0]) && u !== 0) u = Math.abs(u); if (!/^[-+]/.test(b[0]) && l !== 0) l = -Math.abs(l);
    if (Math.abs(u) > 5 || Math.abs(l) > 5 || u < l) return null;
    const f = (v) => (v > 0 ? "+" : v < 0 ? "-" : "") + Math.abs(v);
    return `${f(u)}/${f(l)}`;
  }
  async function secondLook(src, M, g) {
    const s = g.s.replace(/\s+/g, " ").trim();
    if (g.limits || !/^\D{0,4}\d/.test(s) || s.length > 18 || /[A-Za-z]{3,}/.test(s.replace(/THRU|DEEP|TYP|MAX|MIN|HEX/g, ""))) return;
    const nominal = (s.replace(/^\d+\s*[xX×]\s*/, "").match(/\d+(?:\.\d+)?/) || [])[0];
    if (!nominal) return;
    // stacked deviations
    if (!/\d\s*\/\s*[-+]?\d/.test(s)) {
      const st = await stackedTol(src, M, g);
      if (st) {
        // read the size again on its own (digits only), the first pass may have mixed the small text into it
        let nom = nominal;
        try { api_whitelist("0123456789."); const t = (await ocrCanvas(cropC(src, g._start - g.h * 0.25, g.y - g.h * 1.15, g._end + g.h * 0.15, g.y + g.h * 0.2, Math.max(1, 46 / g.h)), 7, 0)).map((w) => w.s).join("");
          api_whitelist(""); const m2 = t.match(/\d+(?:\.\d+)?/); if (m2 && m2[0].length >= Math.min(2, nominal.length)) nom = m2[0]; } catch (e) { api_whitelist(""); }
        const pre = (s.match(/^\D*?(?=\d)/) || [""])[0].replace(/[±+\-=*£]/g, ""), lead = (s.match(/^\d+\s*[xX×]\s*/) || [""])[0];
        g.s = `${lead}${pre.replace(lead, "")}${nom} ${st}`; g.stack = { x0: g._end, x1: g._end + g.h * 4.2, y0: g.y - g.h * 1.5, y1: g.y + g.h * 0.4 }; g.x0 = Math.min(g.x0, g._start); g.conf2 = 0.75; return; }
    }
    if (/±|\//.test(s)) return;
    // the callout as one line: from a bit left of the text to the first wide gap on the right
    const h = g.h, y0 = g.y - h * 1.25, y1 = g.y + h * 0.3; let x1 = g.x1, gap = 0;
    for (let x = Math.round(g.x1); x < Math.min(M.W, g.x1 + h * 7); x++) {
      let on = false; for (let y = Math.round(y0 + h * 0.2); y < y1 - h * 0.1; y++) if (M.m[y * M.W + x]) { on = true; break; }
      if (on) { x1 = x; gap = 0; } else if (++gap > h * 1.1) break;
    }
    if (x1 - g.x1 < h * 0.6) return;                                      // nothing after the size
    const k = Math.max(1, 46 / h), words = await ocrCanvas(cropC(src, g.x0 - h * 1.3, y0, x1 + h * 0.3, y1, k), 7, 0);
    let t = cleanOcr(words.map((w) => w.s).join(" ")).replace(/\s+/g, " ").trim();
    if (!t || !t.includes(nominal)) return;
    // a fit grade whose digits OCR read as letters ("h6" → "ho", "H7" → "HT"): fix only when it then is a real ISO fit
    t = t.replace(new RegExp("(" + nominal.replace(".", "\\.") + ")\\s*(js|JS|[a-hk-npr-sA-HK-NP])([0-9oOsSlIBgT]{1,2})\\b"), (all, n, L, g) => {
      const d = g.replace(/[oO]/g, "6").replace(/[sS]/g, "5").replace(/[lI]/g, "1").replace(/B/g, "8").replace(/g/g, "9").replace(/T/g, "7");
      return typeof isoFit === "function" && isoFit(+n, L + d) ? `${n} ${L}${d}` : all; });
    const box = { s: t, x0: g.x0 - h * 1.3, x1, y: g.y, h };
    t = fixTol(M, { ...box, s: t });
    const fitAfter = new RegExp(nominal.replace(".", "\\.") + "\\s*(js\\d{1,2}|JS\\d{1,2}|[a-hk-npr-sA-HK-NP]\\d{1,2})\\b").test(t);
    if ((/±|\d\s*\/\s*[-+]?\d|[+-]\d*\.\d+/.test(t) || fitAfter) && t.length <= 26) {
      // keep what the first pass and the shape checks found up to the size (Ø, 4X …); take only the tolerance from the re-read
      const i = t.indexOf(nominal), j = s.indexOf(nominal);
      g.s = (s.slice(0, j + nominal.length) + t.slice(i + nominal.length)).replace(/\s+/g, " ").trim(); g.x1 = x1;
    }
  }

  /** sizes with stacked deviations ("110" followed by "+0.05" over "-0.02" in small text), found from the ink layout:
      two short rows of small characters, one above the other, starting right after a run of full-height characters.
      Returns groups in the coordinates of the given canvas. */
  async function findStacks(src, TXm, th) {
    const bx = letterBoxes(TXm, th * 0.75), small = bx.filter((b) => b.h >= th * 0.4 && b.h <= th * 0.95), big = bx.filter((b) => b.h >= th * 0.8 && b.h <= th * 1.7);
    const rowsOf = (list) => { const rows = [], used = new Set();
      for (const b of list.slice().sort((p, q) => p.x0 - q.x0)) { if (used.has(b)) continue; const r = [b]; used.add(b); let last = b;
        for (const c of list) { if (used.has(c) || c.x0 < last.x0) continue;
          if (c.x0 - last.x1 < th * 0.6 && c.x0 - last.x1 > -2 && Math.abs((c.y0 + c.y1) - (last.y0 + last.y1)) / 2 < th * 0.3) { r.push(c); used.add(c); last = c; } }
        rows.push({ x0: Math.min(...r.map((c) => c.x0)), x1: Math.max(...r.map((c) => c.x1)), y0: Math.min(...r.map((c) => c.y0)), y1: Math.max(...r.map((c) => c.y1)), n: r.length }); }
      return rows; };
    const sr = rowsOf(small), out = [];
    for (const U of sr) for (const L of sr) {
      if (U === L || U.n + L.n < 3 || Math.abs(U.x0 - L.x0) > th * 0.8) continue;
      const gapY = L.y0 - U.y1; if (gapY < -th * 0.1 || gapY > th * 0.9) continue;
      const x0s = Math.min(U.x0, L.x0), top = U.y0, bot = L.y1;
      // the size: full-height characters ending just left of the stack, spanning its height
      const rowH = Math.max(U.y1 - U.y0, L.y1 - L.y0) + 1;          // the size is clearly taller than each small row
      const near = big.filter((b) => b.h >= rowH * 1.2 && b.x1 <= x0s + th * 0.15 && x0s - b.x1 < th * 0.9 && b.y0 < (top + bot) / 2 && b.y1 > (top + bot) / 2);
      if (!near.length) continue;
      let first = near.sort((p, q) => q.x1 - p.x1)[0], sx0 = first.x0;
      for (const b of big.slice().sort((p, q) => q.x1 - p.x1)) { if (b.h >= rowH * 1.2 && b.x1 < sx0 && sx0 - b.x1 < th * 0.6 && Math.abs((b.y0 + b.y1) - (first.y0 + first.y1)) / 2 < th * 0.35) sx0 = b.x0; }
      const sy0 = Math.min(first.y0, top), sy1 = Math.max(first.y1, bot), bh = first.y1 - first.y0 + 1;
      if (out.some((o) => Math.abs(o.x0 - sx0) < th && Math.abs(o.y - first.y1) < th)) continue;
      const k = Math.max(1, 46 / bh), m = bh * 0.25;
      const read = async (x0, y0, x1, y1, wl, kk) => { api_whitelist(wl); try { return (await ocrCanvas(cropC(src, x0 - m, y0 - m * 0.6, x1 + m * 0.6, y1 + m * 0.6, kk), 7, 0)).map((w) => w.s).join(""); } finally { api_whitelist(""); } };
      const size = cleanOcr(await read(sx0 - bh * 1.2, first.y0, first.x1, first.y1, "", k)).replace(/\s+/g, "");
      const nm = size.match(/(\d+(?:\.\d+)?)$/); if (!nm) continue;
      const kr = Math.max(1, 42 / Math.max(U.y1 - U.y0 + 1, L.y1 - L.y0 + 1));
      // a deviation is nearly always a decimal: when a row reads as a whole number, look again closer before believing it
      const dev = async (R) => { let first = null;
        for (const [kk, psm] of [[kr, 7], [kr * 1.6, 7], [kr * 1.6, 8], [kr * 2.2, 13]]) {
          api_whitelist("+-0123456789."); let t = "";
          try { t = (await ocrCanvas(cropC(src, R.x0 - m, R.y0 - m * 0.6, R.x1 + m * 0.6, R.y1 + m * 0.6, kk), psm, 0)).map((w) => w.s).join(""); } finally { api_whitelist(""); }
          const v = t.match(/[-+]?\d*\.?\d+/); if (!v) continue; if (!first) first = v;
          if (/\./.test(v[0]) || /^[-+]?0$/.test(v[0])) return v; }
        return first; };
      const a = await dev(U), b2 = await dev(L);
      if (!a || !b2) continue;
      let u = +a[0], l = +b2[0]; if (!/^[-+]/.test(a[0]) && u !== 0) u = Math.abs(u); if (!/^[-+]/.test(b2[0]) && l !== 0) l = -Math.abs(l);
      if (Math.abs(u) > 5 || Math.abs(l) > 5 || u < l) continue;
      const f = (v) => (v > 0 ? "+" : v < 0 ? "-" : "") + Math.abs(v), pre = size.slice(0, size.length - nm[1].length).replace(/[^ØR]/g, "").slice(-1);
      out.push({ s: `${pre}${nm[1]} ${f(u)}/${f(l)}`, x0: sx0, x1: Math.max(U.x1, L.x1), y: first.y1, h: bh, conf: 0.75,
        stack: { x0: x0s - th * 0.2, x1: Math.max(U.x1, L.x1) + th * 0.3, y0: sy0 - th * 0.2, y1: sy1 + th * 0.2 }, own: { x0: sx0, x1: Math.max(U.x1, L.x1), y0: sy0, y1: sy1 } });
    }
    return out;
  }
  /** put found stacks in place of whatever the word pass made of that spot */
  function useStacks(groups, st) {
    if (!st.length) return groups;
    const hit = (g) => st.some((t) => { const o = t.own; return g.x1 > o.x0 - 2 && g.x0 < o.x1 + 2 && g.y > o.y0 && g.y - g.h < o.y1; });
    return groups.filter((g) => !hit(g)).concat(st);
  }

  /** small, safe clean-ups of a callout's text */
  function tidy(t) {
    let s = String(t || "").replace(/[,;]+$/, "").trim();
    s = s.replace(/([ØR])[^\w\s.±+\-]+(?=\S)/g, "$1")          // junk mark after Ø / R ("Ø‘60")
      .replace(/Ø[A-Za-z](?=\d)/g, "Ø")                         // "ØG11"
      .replace(/([ØR])0(?=\d)/g, "$1");                          // a size never starts with 0 unless it is 0.x ("Ø060")
    // a fit grade whose digit OCR read as a letter ("Ø90 gb" → g6), only when it then is a real ISO fit
    s = s.replace(/(\d+(?:\.\d+)?)\s*(js|JS|[a-hk-npr-sA-HK-NP])([0-9oOsSlIBbgT]{1,2})\b/, (all, n, L, g) => {
      if (/^\d+$/.test(g)) return all;
      const d = g.replace(/[oObB]/g, "6").replace(/[sS]/g, "5").replace(/[lI]/g, "1").replace(/B/g, "8").replace(/g/g, "9").replace(/T/g, "7");
      return typeof isoFit === "function" && isoFit(+n, L + d) ? `${n} ${L}${d}` : all; });
    return s;
  }
  /** a note broken into two words at a comma ("CASE HARDEN 0.8-1.2 DEEP," + "55-60 HRC") → one line */
  function joinLines(groups) {
    const out = groups.slice();
    for (const g of groups) {
      if (!out.includes(g) || !/[,&-]$/.test(g.s.trim())) continue;
      const n = out.filter((o) => o !== g && Math.abs(o.y - g.y) < 0.45 * Math.max(o.h, g.h) && o.x0 - g.x1 > -g.h && o.x0 - g.x1 < 2.5 * g.h).sort((a, b) => a.x0 - b.x0)[0];
      if (!n) continue;
      g.s = g.s.trim() + " " + n.s.trim(); g.x1 = Math.max(g.x1, n.x1); out.splice(out.indexOf(n), 1);
    }
    return out;
  }

  /** "1.5 x" and "45°" read as two words on one line → one chamfer callout */
  function joinChamfers(groups) {
    const out = groups.slice();
    for (const g of groups) {
      const a = g.s.trim(); if (!out.includes(g) || !/\d\s*[xX×]?$/.test(a)) continue;
      const endsX = /[xX×]$/.test(a), near = (o) => o !== g && Math.abs(o.y - g.y) < 0.5 * Math.max(o.h, g.h) && o.x0 - g.x1 > -g.h && o.x0 - g.x1 < 2.5 * g.h;
      // "1.5 x" + "45°"; "2X 1" + "x 45°"; "1" + "45°" with the x lost (only for 45°, the usual chamfer angle)
      const n = out.find((o) => near(o) && (endsX ? /^\d+(\.\d+)?\s*°/.test(o.s.trim()) : /^[xX×]\s*\d+(\.\d+)?\s*°/.test(o.s.trim()) || (/^45\s*°/.test(o.s.trim()) && o.x0 - g.x1 > 0.6 * g.h)));
      if (!n) continue;
      const b = n.s.trim(); g.s = a + (endsX || /^[xX×]/.test(b) ? " " : " x ") + b; g.x1 = Math.max(g.x1, n.x1); g.h = Math.max(g.h, n.h); out.splice(out.indexOf(n), 1);
    }
    return out;
  }

  const RA = [0.012, 0.025, 0.05, 0.1, 0.2, 0.4, 0.8, 1.6, 3.2, 6.3, 12.5, 25, 50, 100];
  function fixRa(it) {
    if (it.type !== "Surface finish" || it.upper == null || RA.includes(+it.upper)) return;
    const s = String(it.upper), fix = (v) => { it.text = String(it.text).replace(s, String(v)).replace(/^(R[az])(?=\d)/, "$1 "); it.upper = v; it.conf = Math.min(it.conf ?? 0.6, 0.6); };
    // a lost decimal point ("Ra32" → 3.2), or one extra character ("35.2" → 3.2)
    if (!s.includes(".")) for (let i = 1; i < s.length; i++) { const v = +(s.slice(0, i) + "." + s.slice(i)); if (RA.includes(v)) return fix(v); }
    for (let i = 0; i < s.length; i++) { const v = +(s.slice(0, i) + s.slice(i + 1)); if (RA.includes(v)) return fix(v); }
  }

  /** ink pieces of the whole sheet whose box passes a size test (boxes only) */
  function inkBoxes(M, keep) {
    const W = M.W, H = M.H, lab = new Int32Array(W * H), par = [0], bx = [null];
    const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x; if (!M.m[p]) continue;
      const ns = [x > 0 ? lab[p - 1] : 0, y > 0 ? lab[p - W] : 0, x > 0 && y > 0 ? lab[p - W - 1] : 0, x < W - 1 && y > 0 ? lab[p - W + 1] : 0].filter(Boolean);
      if (!ns.length) { const id = par.length; par.push(id); bx.push([x, y, x, y]); lab[p] = id; continue; }
      let r = find(ns[0]); for (const q of ns) { const rq = find(q); if (rq !== r) par[rq] = r; } lab[p] = r;
      const b = bx[r]; if (x < b[0]) b[0] = x; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
    }
    const roots = new Map();
    for (let i = 1; i < par.length; i++) { const r = find(i), b = bx[i], R = roots.get(r);
      if (!R) roots.set(r, b.slice()); else { R[0] = Math.min(R[0], b[0]); R[1] = Math.min(R[1], b[1]); R[2] = Math.max(R[2], b[2]); R[3] = Math.max(R[3], b[3]); } }
    const out = []; for (const b of roots.values()) { const o = { x0: b[0], y0: b[1], x1: b[2], y1: b[3], w: b[2] - b[0] + 1, h: b[3] - b[1] + 1 }; if (keep(o)) out.push(o); }
    return out;
  }
  /** surface-finish ticks (√ with a bar on top): the value written above the bar is often too small for the first pass */
  async function finishMarks(sh, M, th, have) {
    const cand = inkBoxes(M, (b) => b.w >= th * 1.2 && b.w <= th * 7 && b.h >= th * 0.9 && b.h <= th * 4 && b.w >= b.h * 0.8), out = [];
    for (const b of cand.slice(0, 400)) {
      const c = comps(M, b.x0, b.y0, b.x1 + 1, b.y1 + 1).sort((p, q) => q.n - p.n)[0]; if (!c || c.n > c.w * c.h * 0.22) continue;
      const band = (y0f, y1f) => { let lo = 1e9, hi = -1, n = 0; for (let i = 0; i < c.px.length; i += 2) { const x = c.px[i] + c.ox - c.x0, y = c.px[i + 1] + c.oy - c.y0;
        if (y >= c.h * y0f && y <= c.h * y1f) { lo = Math.min(lo, x); hi = Math.max(hi, x); n++; } } return { lo, hi, n }; };
      const top = band(0, 0.14), bot = band(0.86, 1);
      // bar along the top, starting right of the V and running to the right edge; the V's point at the bottom-left
      if (top.n < 3 || top.lo < c.w * 0.3 || top.hi < c.w * 0.85 || top.hi - top.lo < c.w * 0.35) continue;
      if (bot.n < 1 || bot.lo < c.w * 0.03 || bot.hi > c.w * 0.5 || bot.hi - bot.lo > c.w * 0.3) continue;
      // the left arm: some ink in the middle rows left of the point
      const mid = band(0.4, 0.75); if (mid.lo > c.w * 0.3) continue;
      const bx0 = c.x0 + top.lo, by = c.y0;
      if (have.some((it) => Math.hypot(it.ax - bx0, it.ay - by) < th * 4)) continue;
      // the value above the bar
      const TXm = maskOf({ canvas: sh._txt || sh.canvas });                       // long lines removed: a line touching the value does not hide it
      const zone = comps(TXm, bx0 - th * 0.3, by - th * 3, c.x1 + th * 2.5, by - 1).filter((q) => q.h >= th * 0.35 && q.h <= th * 1.3 && q.w <= th * 1.5);
      if (!zone.length) continue;
      const zx0 = Math.min(...zone.map((q) => q.x0)), zx1 = Math.max(...zone.map((q) => q.x1)), zy0 = Math.min(...zone.map((q) => q.y0)), zy1 = Math.max(...zone.map((q) => q.y1));
      const lh = zone.map((q) => q.h).sort((p, q) => q - p)[0], k = Math.max(1, 44 / lh), mm = lh * 0.4;
      let best = null;
      // tiny, blurred text: also try closer and as clean black-and-white
      const bw = (cv) => { const g = cv.getContext("2d", { willReadFrequently: true }), im = g.getImageData(0, 0, cv.width, cv.height), d = im.data;
        for (let i = 0; i < d.length; i += 4) { const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 165 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; } g.putImageData(im, 0, 0); return cv; };
      for (const [kk, mono] of [[k, false], [k * 1.6, false], [k * 1.6, true], [k * 2.4, true]]) {
        const cv = cropC(sh._txt || sh.canvas, zx0 - mm, zy0 - mm, zx1 + mm, zy1 + mm, kk);
        const t = cleanOcr((await ocrCanvas(mono ? bw(cv) : cv, 7, 0)).map((w) => w.s).join(" ")).trim();
        const m2 = t.match(/(R[az])\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i) || t.match(/^(\d+(?:[.,]\d+)?)$/);
        if (!m2) continue;
        const kind = m2[2] ? m2[1][0].toUpperCase() + m2[1][1].toLowerCase() : "Ra", v = +(m2[2] || m2[1]).replace(",", ".");
        const it = { type: "Surface finish", upper: v, text: `${kind} ${v}` }; fixRa(it);
        if (RA.includes(+it.upper)) { best = { kind, v: +it.upper }; break; }
      }
      if (!best) continue;
      out.push({ x: zx0, y: (zy0 + zy1) / 2, text: `${best.kind} ${best.v}`, v: best.v });
    }
    return out;
  }

  /** the smart read of every sheet: returns the number of characteristics found */
  async function smartRead() {
    let out = [];
    for (let si = 0; si < S.sheets.length; si++) {
      const sh = S.sheets[si], lab = S.sheets.length > 1 ? `Sheet ${si + 1}: ` : "";
      busy(`${lab}Looking for GD&T frames`); await tick();
      const frames = findFrames(sh);
      const inFrame = (x, y) => frames.some((f) => x > f.x0 - 4 && x < f.x1 + 4 && y > f.y0 - 4 && y < f.y1 + 4);
      const M = maskOf(sh), th = textHeight(M), k = th ? Math.max(1, Math.min(2.2, 30 / th)) : 1.5;
      sh._zoom = +k.toFixed(2); sh._th = th;
      busy(`${lab}Preparing the text`); await tick();
      sh._txt = withoutLines(sh.canvas, M, th || 20); const TX = maskOf({ canvas: sh._txt });
      sh._clean = withoutDashes(sh.canvas, M, th || 20); const MC = sh._clean === sh.canvas ? M : maskOf({ canvas: sh._clean });
      const w0 = (await ocrTiles(sh, false, `${lab}Reading horizontal text (free)`, k)).map((w) => ({ ...w, s: cleanOcr(w.s) }));
      const w1 = (await ocrTiles(sh, true, `${lab}Reading vertical text (free)`, k)).map((w) => ({ ...w, s: cleanOcr(w.s) }));
      // shape checks for Ø and ± (horizontal words directly; vertical words on the turned sheet)
      for (const w of w0) w.s = fixWord(MC, w);
      const turned = { canvas: rotCanvas(sh._clean, true) }, MT = maskOf(turned);
      for (const w of w1) w.s = fixWord(MT, w);
      const h0 = w0.filter((w) => !inFrame(w.x + w.w / 2, w.y - w.h / 2));
      sh.text = h0; sh.ocr = true; sh._w1 = w1;
      // rescue: letter-sized ink that no word covers (e.g. text touched by a leader line) is read again without the lines
      busy(`${lab}Looking for text the first pass missed`); await tick();
      try { const rs = await rescue(sh, TX, th || 20, [...h0, ...w1.map((w) => ({ x: w.y - w.h, y: sh.h - w.x, w: w.h, h: w.w }))], frames);
        for (const w of rs.replaced) { const i = h0.indexOf(w); if (i >= 0) h0.splice(i, 1); }
        for (const w of rs.hz) { w.s = fixWord(MC, w); h0.push(w); } for (const w of rs.vt) { w.s = fixWord(MT, w); w1.push(w); } sh._rescued = rs.hz.length + rs.vt.length; } catch (e) { console.warn(e); }
      busy(`${lab}Looking for stacked tolerances`); await tick();
      let st0 = [], st1 = []; const txT = rotCanvas(sh._txt, true);
      try { st0 = await findStacks(sh._txt, TX, th || 20); st1 = await findStacks(txT, maskOf({ canvas: txT }), th || 20); } catch (e) { api_whitelist(""); console.warn(e); }
      const g0 = useStacks(joinLines(joinChamfers(groupText(h0))), st0); for (const g of g0) { if (!g.rot && !g.stack) g.s = fixTol(MC, g); g.s = tidy(g.s); }
      const g1raw = useStacks(joinLines(joinChamfers(groupText(w1))), st1); for (const g of g1raw) { if (!g.rot && !g.stack) g.s = fixTol(MT, g); g.s = tidy(g.s); }
      busy(`${lab}Checking each dimension closely`); await tick();
      for (const g of g0) if (!g.rot) { try { await secondLook(sh._clean, MC, g); } catch (e) { console.warn(e); } }
      for (const g of g1raw) if (!g.rot) { try { await secondLook(turned.canvas, MT, g); } catch (e) { console.warn(e); } }
      for (const g of g0.concat(g1raw)) g.s = tidy(g.s);
      const g1 = g1raw.map((g) => { const xr0 = g.x0, xr1 = g.x1, yr = g.y - g.h / 2;
        return { ...g, ax: yr, ay: sh.h - xr1, x0: yr - g.h / 2, x1: yr + g.h / 2, y: sh.h - (xr0 + xr1) / 2 + g.h / 2 }; })
        .filter((g) => !inFrame(g.ax, g.ay));
      const stacks = g0.filter((g) => g.stack).map((g) => ({ g, ...g.stack }));
      const g0k = g0.filter((g) => !stacks.some((t) => t.g !== g && (g.x0 + g.x1) / 2 > t.x0 && (g.x0 + g.x1) / 2 < t.x1 && g.y - g.h / 2 > t.y0 && g.y - g.h / 2 < t.y1));
      g0.length = 0; g0.push(...g0k);
      const items0 = itemsFromGroups(g0, sh, si, "ocr", 0.8), items1 = itemsFromGroups(g1, sh, si, "ocr", 0.7)
        .filter((a) => !items0.some((b) => Math.hypot(a.ax - b.ax, a.ay - b.ay) < sh.w * 0.012));
      if (window.BIR_TRACE) sh._trace = { frames: frames.map((f) => ({ x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, cells: f.cells.length })), th, k,
        w0: w0.map((w) => [w.s, Math.round(w.x), Math.round(w.y), w.conf && +w.conf.toFixed(2)]), w1: w1.map((w) => [w.s, Math.round(w.x), Math.round(w.y)]),
        g0: g0.map((g) => [g.s, Math.round(g.x0), Math.round(g.y)]), g1: g1.map((g) => [g.s, Math.round(g.ax), Math.round(g.ay)]),
        items0: items0.map((i) => i.text), items1: items1.map((i) => i.text) };
      const fr = []; for (let i = 0; i < frames.length; i++) { busy(`${lab}Reading GD&T frame ${i + 1} of ${frames.length}`); await tick(); try { fr.push(await readFrame(sh, si, frames[i])); } catch (e) { console.warn(e); } }
      const edge = (it) => it.ax < sh.w * 0.06 || it.ax > sh.w * 0.94 || it.ay < sh.h * 0.06 || it.ay > sh.h * 0.94;
      // one or two characters: must be real letters (not crossing lines) and not a letter in a little box (datum, flag)
      const lone = (it) => { const t = String(it.text || "").trim(); if (t.length > 2) return false; const h = th || 20;
        const L = comps(TX, it.ax - h * 0.4, it.ay - h * 1.3, it.ax + h * 1.8, it.ay + h * 0.9).filter((c) => c.h >= h * 0.5 && c.h <= h * 2 && c.w <= c.h * 2);
        if (!L.length) return true;
        const x0 = Math.min(...L.map((c) => c.x0)), x1 = Math.max(...L.map((c) => c.x1)), y0 = Math.min(...L.map((c) => c.y0)), y1 = Math.max(...L.map((c) => c.y1)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const ray = (sx, sy, dx, dy) => { for (let k = 2; k < h * 1.3; k++) if (ink(M, sx + dx * k, sy + dy * k)) return true; return false; };
        return ray(x0, cy, -1, 0) && ray(x1, cy, 1, 0) && ray(cx, y0, 0, -1) && ray(cx, y1, 0, 1); };
      const notGrid = (it) => !/^\d{1,2}[.)]$/.test(String(it.text || "").trim()) && !lone(it) && !(edge(it) && /^[A-Z]?\d{0,2}[.,]?$/.test(String(it.text || "").trim()));
      const mine = items0.filter(notGrid).concat(items1.filter(notGrid)); mine.forEach(fixRa);
      busy(`${lab}Looking for surface finish symbols`); await tick();
      try { for (const f of await finishMarks(sh, M, th || 20, mine.filter((i) => i.type === "Surface finish")))
        mine.push(newItem(si, f.x, f.y, { type: "Surface finish", text: f.text, nominal: null, upper: f.v, lower: 0, unit: "µm", conf: 0.6, source: "ocr" })); } catch (e) { console.warn(e); }
      out = out.concat(mine, fr); readTitleBlock(g0, si);
    }
    return out;
  }

  window.BIR = { readFrame, holes, glyphs, isDiameterSign, comps, hSegments, skewAngle, textHeight, fixTol, smartRead, deskew, rotate: rotateCanvas, findFrames, symbolOf, fixWord, maskOf };
})();
