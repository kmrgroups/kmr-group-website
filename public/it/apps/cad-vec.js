/* KMR CAD Draft — PDF / picture → CAD.
   A drawing that arrives as a PDF (CAD plot or scan) or as a picture (PNG, JPG, scan, phone photo) is converted into
   editable CAD objects: lines, circles, arcs and text.
     • PDF with vector content  → the lines, curves and text are read straight from the PDF (exact).
     • Scan / picture / PDF made of a picture → the picture is cleaned, thinned to centre-lines and traced into lines,
       circles and arcs; the text is read by OCR (Tesseract) when it can be loaded.
   Opened through Open / Import / Convert; the original picture can stay underneath as a faint reference layer. */
(function (K) {
  "use strict";
  const G = K.geom, TAU = Math.PI * 2, V = (K.vec = {});
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const PT = 25.4 / 72;                                     // one PDF point in mm
  const SHEETS = { A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594], A0: [1189, 841] };
  const UNITMM = { mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8 };
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Could not load " + src)); document.head.append(s); });
  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  const pdfLib = async () => { if (!window.pdfjsLib) await loadScript(PDFJS + "pdf.min.js"); window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; return window.pdfjsLib; };
  const TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  const mkCanvas = (w, h, white) => { const c = document.createElement("canvas"); c.width = w; c.height = h; if (white !== false) { const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); } return c; };

  /* ================================================================= circle fit (shared) ================================================================= */
  /** least-squares circle through points P[i0..i1] (every point of at most 240) → {cx,cy,r,max,rms,span,sweep} */
  function fitCircle(P, i0, i1) {
    const n = i1 - i0 + 1, st = Math.max(1, Math.floor(n / 240)); let mx = 0, my = 0, m = 0;
    for (let i = i0; i <= i1; i += st) { mx += P[i][0]; my += P[i][1]; m++; }
    mx /= m; my /= m; let suu = 0, suv = 0, svv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
    for (let i = i0; i <= i1; i += st) { const u = P[i][0] - mx, v = P[i][1] - my; suu += u * u; suv += u * v; svv += v * v; suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u; }
    const det = suu * svv - suv * suv; if (Math.abs(det) < 1e-9) return null;
    const a = (suuu + suvv) / 2, b = (svvv + svuu) / 2, uc = (a * svv - b * suv) / det, vc = (b * suu - a * suv) / det;
    const cx = uc + mx, cy = vc + my, r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / m); if (!isFinite(r)) return null;
    let mxr = 0, ss = 0, prev = null, sw = 0, amin = 1e9, amax = -1e9;
    for (let i = i0; i <= i1; i++) {
      const dx = P[i][0] - cx, dy = P[i][1] - cy, e = Math.abs(Math.hypot(dx, dy) - r); if (e > mxr) mxr = e; ss += e * e;
      let an = Math.atan2(dy, dx); if (prev != null) { let d = an - prev; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; sw += d; } prev = an;
    }
    return { cx, cy, r, max: mxr, rms: Math.sqrt(ss / n), sweep: sw, a0: Math.atan2(P[i0][1] - cy, P[i0][0] - cx) };
  }
  V.fitCircle = fitCircle;

  /* ================================================================= picture → lines / arcs / circles ================================================================= */
  /** adaptive threshold: 1 where the pixel is clearly darker than its surroundings */
  V.binarize = (g, w, h, sens) => {
    const win = Math.max(15, ((Math.max(w, h) / 90) | 0) | 1), R = win >> 1, W1 = w + 1, I = new Float64Array(W1 * (h + 1));
    for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += g[y * w + x]; I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + row; } }
    const ink = new Uint8Array(w * h), k = 1 - sens;
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - R), y1 = Math.min(h - 1, y + R);
      for (let x = 0; x < w; x++) {
        const v = g[y * w + x]; if (v > 200) continue;
        const x0 = Math.max(0, x - R), x1 = Math.min(w - 1, x + R), cnt = (x1 - x0 + 1) * (y1 - y0 + 1);
        const mean = (I[(y1 + 1) * W1 + x1 + 1] - I[y0 * W1 + x1 + 1] - I[(y1 + 1) * W1 + x0] + I[y0 * W1 + x0]) / cnt;
        if (v < mean * k) ink[y * w + x] = 1;
      }
    }
    return ink;
  };

  /** connected components (8-neighbour) → { lab, comps:[{n,x0,y0,x1,y1}] } */
  V.components = (ink, w, h) => {
    const lab = new Int32Array(w * h), comps = [], q = new Int32Array(w * h);
    for (let s = 0; s < w * h; s++) {
      if (!ink[s] || lab[s]) continue;
      const id = comps.length + 1; let qh = 0, qt = 0; q[qt++] = s; lab[s] = id; let x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0;
      while (qh < qt) {
        const p = q[qh++], x = p % w, y = (p / w) | 0; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const np = ny * w + nx; if (ink[np] && !lab[np]) { lab[np] = id; q[qt++] = np; } }
      }
      comps.push({ n, x0, y0, x1, y1 });
    }
    return { lab, comps };
  };

  /** Zhang–Suen thinning → 1-pixel centre-lines */
  V.thin = (ink, w, h) => {
    const img = ink.slice(); for (let x = 0; x < w; x++) { img[x] = 0; img[(h - 1) * w + x] = 0; } for (let y = 0; y < h; y++) { img[y * w] = 0; img[y * w + w - 1] = 0; }
    let list = []; for (let i = 0; i < img.length; i++) if (img[i]) list.push(i);
    let cur = Int32Array.from(list), changed = true, guard = 0;
    while (changed && guard++ < 80) {
      changed = false;
      for (let step = 0; step < 2; step++) {
        const del = []; let m = 0;
        for (let k = 0; k < cur.length; k++) {
          const i = cur[k]; if (!img[i]) continue;
          const p2 = img[i - w], p3 = img[i - w + 1], p4 = img[i + 1], p5 = img[i + w + 1], p6 = img[i + w], p7 = img[i + w - 1], p8 = img[i - 1], p9 = img[i - w - 1];
          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9; if (B < 2 || B > 6) { cur[m++] = i; continue; }
          const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
          if (A !== 1) { cur[m++] = i; continue; }
          if (step === 0 ? p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0 : p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0) del.push(i); else cur[m++] = i;
        }
        cur = cur.subarray(0, m); if (del.length) { changed = true; for (const i of del) img[i] = 0; }
      }
    }
    return img;
  };

  const N8 = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];
  /** skeleton → chains of pixels between end points / junctions (and closed loops) */
  V.trace = (sk, w, h) => {
    const cn = new Uint8Array(w * h), vis = new Uint8Array(w * h), chains = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x; if (!sk[i]) continue;
      const p2 = sk[i - w], p3 = sk[i - w + 1], p4 = sk[i + 1], p5 = sk[i + w + 1], p6 = sk[i + w], p7 = sk[i + w - 1], p8 = sk[i - 1], p9 = sk[i - w - 1];
      const nb = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9; const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
      cn[i] = nb === 0 ? 0 : nb === 1 || A === 1 ? 1 : A === 2 ? 2 : 3;
    }
    const walk = (s, n0) => {
      const path = [s, n0]; let prev = s, n = n0;
      while (cn[n] === 2 && !vis[n]) {
        vis[n] = 1; let nx = -1; const x = n % w, y = (n / w) | 0;
        for (let d = 0; d < 8 && nx < 0; d++) { const q = (y + N8[d][1]) * w + x + N8[d][0]; if (q !== prev && sk[q] && (cn[q] !== 2 || !vis[q])) nx = q; }
        if (nx < 0) break; prev = n; n = nx; path.push(n); if (n === s) break;
      }
      return path;
    };
    for (let i = 0; i < w * h; i++) {
      if (!sk[i] || cn[i] === 2 || cn[i] === 0) continue; const x = i % w, y = (i / w) | 0;
      for (let d = 0; d < 8; d++) {
        const q = (y + N8[d][1]) * w + x + N8[d][0]; if (!sk[q]) continue;
        if (cn[q] === 2 && vis[q]) continue; if (cn[q] !== 2) continue;       // chains start from a node into a plain pixel
        chains.push(walk(i, q));
      }
    }
    for (let i = 0; i < w * h; i++) if (sk[i] && cn[i] === 2 && !vis[i]) { const x = i % w, y = (i / w) | 0; let q = -1; for (let d = 0; d < 8 && q < 0; d++) { const t = (y + N8[d][1]) * w + x + N8[d][0]; if (sk[t] && !vis[t]) q = t; } if (q < 0) continue; vis[i] = 1; const p = walk(i, q); if (p.length > 6) chains.push(p); }
    return chains.map((c) => c.map((i) => [i % w, (i / w) | 0]));
  };

  /** recursive best fit: a run of points → lines and arcs (px units) */
  function fitRun(P, i0, i1, out, depth) {
    const n = i1 - i0 + 1, A = P[i0], B = P[i1];
    if (n < 2) return;
    let dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy), md = 0, mi = i0;
    for (let i = i0 + 1; i < i1; i++) { const d = L > 1e-9 ? Math.abs((P[i][0] - A[0]) * dy - (P[i][1] - A[1]) * dx) / L : Math.hypot(P[i][0] - A[0], P[i][1] - A[1]); if (d > md) { md = d; mi = i; } }
    if (md <= 1.15 || n <= 3) { if (L >= 1) out.push({ k: "L", a: A, b: B }); return; }
    if (n >= 9 && depth < 40) {
      const c = fitCircle(P, i0, i1);
      if (c && c.r >= 2.5 && c.max <= Math.min(2.2, Math.max(1.35, 0.022 * c.r)) && Math.abs(c.sweep) >= 0.22 && Math.abs(c.sweep) <= TAU + 0.5 && c.r < 6000) {
        // sagitta must be real (otherwise it is a straight line with a huge radius)
        if (md > 1.15) { out.push({ k: "A", c: [c.cx, c.cy], r: c.r, a0: c.a0, sw: Math.abs(c.sweep) > TAU - 0.08 ? Math.sign(c.sweep) * TAU : c.sweep }); return; }
      }
    }
    if (depth > 60 || n < 4) { for (let i = i0; i < i1; i++) out.push({ k: "L", a: P[i], b: P[i + 1] }); return; }
    // split where the curve is farthest from the chord; keep both halves at least 2 points
    let sp = Math.min(Math.max(mi, i0 + 2), i1 - 2); if (n < 6) sp = Math.floor((i0 + i1) / 2);
    fitRun(P, i0, sp, out, depth + 1); fitRun(P, sp, i1, out, depth + 1);
  }

  /** simplify a chain so the recursion works on corner points rather than every pixel */
  function fitChain(P, out) {
    if (P.length < 3) { if (P.length === 2 && Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]) >= 3) out.push({ k: "L", a: P[0], b: P[1] }); return; }
    const closed = Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) <= 2.5 && P.length > 14;
    if (closed) {
      const c = fitCircle(P, 0, P.length - 1);
      if (c && c.r >= 3 && c.max <= Math.min(2.4, Math.max(1.5, 0.025 * c.r)) && Math.abs(c.sweep) > TAU - 0.5) { out.push({ k: "C", c: [c.cx, c.cy], r: c.r }); return; }
      // not a circle: break the loop at the point farthest from the start so rectangles and slots split into sides
      let fi = 0, fd = -1; for (let i = 0; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[0][0], P[i][1] - P[0][1]); if (d > fd) { fd = d; fi = i; } }
      fitRun(P, 0, fi, out, 0); fitRun(P, fi, P.length - 1, out, 0); return;
    }
    fitRun(P, 0, P.length - 1, out, 0);
  }

  V.fitChain = fitChain;
  /** straighten, merge and join line work (px units) */
  function tidy(items, opt) {
    const ang = (l) => { let a = Math.atan2(l.b[1] - l.a[1], l.b[0] - l.a[0]); if (a < 0) a += Math.PI; if (a >= Math.PI - 1e-9) a -= Math.PI; return a; };
    const lines = items.filter((x) => x.k === "L").map((l) => ({ k: "L", a: l.a.slice(), b: l.b.slice() }));
    const other = items.filter((x) => x.k !== "L");
    if (opt.ortho) for (const l of lines) {
      const a = ang(l), d = Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]), tol = Math.max(0.03, Math.min(0.045, 2.2 / Math.max(d, 1)));    // ≈ 1.7–2.5° but never more than ~2 px of drift
      if (a < tol || a > Math.PI - tol) { const y = (l.a[1] + l.b[1]) / 2; l.a[1] = l.b[1] = y; } else if (Math.abs(a - Math.PI / 2) < tol) { const x = (l.a[0] + l.b[0]) / 2; l.a[0] = l.b[0] = x; }
    }
    // merge collinear pieces that touch or nearly touch
    const merged = []; const used = new Uint8Array(lines.length), GAP = 4, OFF = 1.3;
    lines.sort((p, q) => Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]) - Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]));
    for (let i = 0; i < lines.length; i++) {
      if (used[i]) continue; used[i] = 1; let l = lines[i], grew = true;
      while (grew) {
        grew = false; const dx = l.b[0] - l.a[0], dy = l.b[1] - l.a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
        for (let j = i + 1; j < lines.length; j++) {
          if (used[j]) continue; const m = lines[j]; if (Math.abs(Math.sin(ang(l) - ang(m))) > 0.03) continue;
          const o1 = (m.a[0] - l.a[0]) * uy - (m.a[1] - l.a[1]) * ux, o2 = (m.b[0] - l.a[0]) * uy - (m.b[1] - l.a[1]) * ux; if (Math.abs(o1) > OFF || Math.abs(o2) > OFF) continue;
          const t = [0, L, (m.a[0] - l.a[0]) * ux + (m.a[1] - l.a[1]) * uy, (m.b[0] - l.a[0]) * ux + (m.b[1] - l.a[1]) * uy], lo = Math.min(t[2], t[3]), hi = Math.max(t[2], t[3]);
          if (lo > L + GAP || hi < -GAP) continue; used[j] = 1; const a = Math.min(0, lo), b = Math.max(L, hi);
          l = { k: "L", a: [l.a[0] + ux * a, l.a[1] + uy * a], b: [l.a[0] + ux * b, l.a[1] + uy * b] }; grew = true; break;
        }
      }
      merged.push(l);
    }
    // square up corners: an end of a horizontal / vertical line close to a vertical / horizontal line goes exactly onto it
    const H = merged.filter((l) => l.a[1] === l.b[1]), Vv = merged.filter((l) => l.a[0] === l.b[0]), SN = 3.2;
    for (const h of H) for (const e of [h.a, h.b]) for (const v of Vv) {
      const lo = Math.min(v.a[1], v.b[1]) - SN, hi = Math.max(v.a[1], v.b[1]) + SN; if (e[1] < lo || e[1] > hi) continue; if (Math.abs(e[0] - v.a[0]) <= SN) { e[0] = v.a[0]; break; }
    }
    for (const v of Vv) for (const e of [v.a, v.b]) for (const h of H) {
      const lo = Math.min(h.a[0], h.b[0]) - SN, hi = Math.max(h.a[0], h.b[0]) + SN; if (e[0] < lo || e[0] > hi) continue; if (Math.abs(e[1] - h.a[1]) <= SN) { e[1] = h.a[1]; break; }
    }
    return merged.filter((l) => Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]) >= (opt.minLen || 4)).concat(other);
  }
  V.tidy = tidy;

  /* ================================================================= OCR ================================================================= */
  async function runOCR(canvas, say) {
    if (!window.Tesseract) { say("Loading the text reader (first time only, about 10 MB)…"); await loadScript(TESS); }
    const worker = await window.Tesseract.createWorker("eng", 1, V.ocrPaths || {});
    try {
      say("Reading the text in the picture…");
      const r = await Promise.race([worker.recognize(canvas), new Promise((_, rej) => setTimeout(() => rej(new Error("The text reader took too long.")), 150000))]);
      return (r.data.words || []).filter((w) => w.confidence >= 60 && /[A-Za-z0-9]/.test(w.text) && w.bbox && w.bbox.y1 > w.bbox.y0).map((w) => ({ s: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 }));
    } finally { try { await worker.terminate(); } catch (e) { /* ignore */ } }
  }

  /* ================================================================= picture pipeline ================================================================= */
  /** canvas (white paper, dark lines) → { items:[{k:L|A|C…}], words, w, h } in pixel units, y down */
  V.fromCanvas = async (cv, opt, say) => {
    say = say || (() => {}); const w = cv.width, h = cv.height, id = cv.getContext("2d").getImageData(0, 0, w, h).data, g = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (id[j] * 0.299 + id[j + 1] * 0.587 + id[j + 2] * 0.114) | 0;
    say("Cleaning the picture…"); await tick();
    let ink = V.binarize(g, w, h, opt.sens == null ? 0.14 : opt.sens), words = [];
    if (opt.ocr) {
      try { words = await runOCR(cv, say); } catch (e) { say("The text could not be read automatically (" + e.message + ") — the lines are still converted."); opt.ocrFailed = e.message; }
      // keep only words that really are lettering: not line work (a long line or a ring that the reader took for “I”, “l” or “(0)”)
      if (words.length) {
        const { lab: l0, comps: c0 } = V.components(ink, w, h), big0 = Math.max(w, h); const okw = [];
        for (const t of words) {
          const bw = t.x1 - t.x0 + 1, bh = t.y1 - t.y0 + 1; if (bh > big0 * 0.03 || /^[\W_0OoIl1|]{1,3}$/.test(t.s)) continue;
          let bad = false; const seen = new Set();
          for (let y = t.y0; y <= t.y1 && !bad; y += 2) for (let x = t.x0; x <= t.x1; x += 2) { const id = l0[y * w + x]; if (!id || seen.has(id)) continue; seen.add(id); const c = c0[id - 1]; if (c.x1 - c.x0 + 1 > bw * 1.35 + 3 || c.y1 - c.y0 + 1 > bh * 1.6 + 3) { bad = true; break; } }
          if (!bad) okw.push(t);
        }
        words = okw;
      }
      const pad = 2; for (const t of words) for (let y = Math.max(0, t.y0 - pad); y <= Math.min(h - 1, t.y1 + pad); y++) for (let x = Math.max(0, t.x0 - pad); x <= Math.min(w - 1, t.x1 + pad); x++) ink[y * w + x] = 0;
    }
    await tick();
    // specks, and small isolated marks that are lettering (only when the text was not read)
    const { lab, comps } = V.components(ink, w, h), big = Math.max(w, h), txt = opt.ocr && !opt.ocrFailed ? 0 : Math.round(big * 0.014);
    let dropped = 0; const drop = new Uint8Array(comps.length + 1);
    comps.forEach((c, i) => { const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1; if (c.n < 5 || (txt && bw <= txt * 1.6 && bh <= txt * 1.6 && c.n < bw * bh * 0.7 && !(Math.abs(bw - bh) < 3 && bw > txt * 0.5 && c.n < bw * bh * 0.55 && false))) { drop[i + 1] = 1; if (c.n >= 5) dropped++; } });
    for (let i = 0; i < ink.length; i++) if (ink[i] && drop[lab[i]]) ink[i] = 0;
    say("Finding the centre-lines…"); await tick();
    const sk = V.thin(ink, w, h); await tick();
    say("Tracing lines, arcs and circles…"); await tick();
    const chains = V.trace(sk, w, h), items = [];
    for (const c of chains) fitChain(c, items);
    let skew = 0;
    if (opt.deskew !== false) {
      // a crooked scan: find the angle the long lines share (modulo 90°) and turn everything back
      const bins = new Float64Array(121); let tot = 0;
      for (const it of items) if (it.k === "L") { const L = Math.hypot(it.b[0] - it.a[0], it.b[1] - it.a[1]); if (L < big * 0.06) continue; let a = Math.atan2(it.b[1] - it.a[1], it.b[0] - it.a[0]) * 180 / Math.PI; a = ((a % 90) + 135) % 90 - 45; tot += L; if (Math.abs(a) <= 6) bins[Math.round((a + 6) * 10)] += L; }
      let bi = -1, bv = 0; for (let i = 1; i < 120; i++) { const v = bins[i - 1] + bins[i] * 2 + bins[i + 1]; if (v > bv) { bv = v; bi = i; } }
      if (bi >= 0 && bv / 4 > tot * 0.25) {
        const th = (bi / 10 - 6) * Math.PI / 180;
        if (Math.abs(th) > 0.0017 && Math.abs(th) < 0.105) {
          skew = th; const cx = w / 2, cy = h / 2, co = Math.cos(-th), si = Math.sin(-th), R = (p) => [cx + co * (p[0] - cx) - si * (p[1] - cy), cy + si * (p[0] - cx) + co * (p[1] - cy)];
          for (const it of items) { if (it.k === "L") { it.a = R(it.a); it.b = R(it.b); } else { it.c = R(it.c); if (it.k === "A") it.a0 -= th; } }
          for (const t of words) { const q = R([(t.x0 + t.x1) / 2, (t.y0 + t.y1) / 2]), hw = (t.x1 - t.x0) / 2, hh = (t.y1 - t.y0) / 2; t.x0 = q[0] - hw; t.x1 = q[0] + hw; t.y0 = q[1] - hh; t.y1 = q[1] + hh; }
        }
      }
    }
    if (opt.debug) opt.debug.pre = items.map((i) => Object.assign({}, i));
    const out = tidy(items, opt);
    return { items: out, words, w, h, dropped, skew };
  };

  /* ---------- picture items → CAD entities (mm, y up) ---------- */
  const lay = (E, name, color) => { if (!E.layers.find((l) => l.name === name)) E.layers.push({ name, color: color || "#ffffff", lt: "CONTINUOUS", lw: 0.25, on: true, frozen: false, lock: false }); return name; };
  V.itemsToEnts = (res, mm, ox, oy, layers, names) => {
    const X = (p) => ox + p[0] * mm, Y = (p) => oy + (res.h - p[1]) * mm, ents = [], cnt = { lines: 0, circles: 0, arcs: 0, text: 0 }, L = names.lines;
    for (const it of res.items) {
      if (it.k === "L") { ents.push({ t: "line", layer: L, a: [r3(X(it.a)), r3(Y(it.a)), 0], b: [r3(X(it.b)), r3(Y(it.b)), 0] }); cnt.lines++; }
      else if (it.k === "C") { ents.push({ t: "circle", layer: L, c: [r3(X(it.c)), r3(Y(it.c)), 0], r: r3(it.r * mm) }); cnt.circles++; }
      else if (it.k === "A") {
        const s0 = it.a0, e0 = it.a0 + it.sw; let a0, a1;                          // image angles run clockwise on screen; flip for y-up
        if (it.sw > 0) { a0 = -e0; a1 = -s0; } else { a0 = -s0; a1 = -e0; }
        const nz = (a) => { a %= TAU; return a < 0 ? a + TAU : a; };
        if (Math.abs(it.sw) >= TAU - 0.05) { ents.push({ t: "circle", layer: L, c: [r3(X(it.c)), r3(Y(it.c)), 0], r: r3(it.r * mm) }); cnt.circles++; }
        else { ents.push({ t: "arc", layer: L, c: [r3(X(it.c)), r3(Y(it.c)), 0], r: r3(it.r * mm), a0: nz(a0), a1: nz(a1) }); cnt.arcs++; }
      }
    }
    for (const t of res.words || []) {
      const bh = t.y1 - t.y0, desc = /[gjpqy,;()]/.test(t.s), cap = bh * (desc ? 0.72 : 0.92), hh = cap * mm, base = desc ? t.y1 - bh * 0.22 : t.y1;
      let h2 = hh; const wmm = (t.x1 - t.x0) * mm, tw = G.textW(t.s, h2); if (tw > wmm * 1.08) h2 = h2 * (wmm / tw);
      if (h2 * 1 < 0.4) continue; ents.push({ t: "text", layer: names.text, p: [r3(X([t.x0, 0])), r3(Y([0, base])), 0], h: r3(h2), s: t.s, rot: 0, ha: 0, va: 0 }); cnt.text++;
    }
    return { ents, cnt };
  };

  /* ================================================================= PDF with vector content ================================================================= */
  const mmul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const std = [0.09, 0.13, 0.18, 0.25, 0.35, 0.5, 0.7, 1, 1.4, 2];
  const colName = (c) => { const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16), mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn < 40) return null; if (r >= g && r >= b) return g > b + 40 ? "yellow" : "red"; if (g >= r && g >= b) return b > r + 40 ? "cyan" : "green"; return r > g + 40 ? "magenta" : "blue"; };

  /** vector content of one PDF page → entities (mm). Returns null if the page is a picture. */
  V.pdfVector = async (page, lib, opt, scale) => {
    const ol = await page.getOperatorList(), O = lib.OPS, vp = page.getViewport({ scale: 1 }), VPM = vp.transform, S = PT * scale;
    // viewport (user space → canvas, y down) then flip to y up
    const P = (m, x, y) => { const px = m[0] * x + m[2] * y + m[4], py = m[1] * x + m[3] * y + m[5]; return [px * S, (vp.height - py) * S]; };
    let ctm = [1, 0, 0, 1, 0, 0], stack = [], lw = 1, stroke = "#000000", dash = false, sub = [], cur = null, strokes = 0, images = 0, glyphs = 0, filled = 0;
    const ents = [], lineSeen = new Set(), names = new Set();
    const full = () => mmul(VPM, ctm);                        // user → viewport
    const mv = (x, y) => { cur = { pts: [P(full(), x, y)], seg: [], closed: false, lu: [x, y] }; sub.push(cur); };
    const ln = (x, y) => { if (!cur) return mv(x, y); cur.pts.push(P(full(), x, y)); cur.seg.push("L"); cur.lu = [x, y]; };
    const cv = (x1, y1, x2, y2, x3, y3) => {
      if (!cur) mv(x1, y1); const m = full(), a = cur.pts[cur.pts.length - 1], b = P(m, x1, y1), c = P(m, x2, y2), d = P(m, x3, y3), N = 10;
      for (let i = 1; i <= N; i++) { const t = i / N, u = 1 - t; cur.pts.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]); cur.seg.push("C"); } cur.lu = [x3, y3];
    };
    const lastPt = () => { return cur ? cur.lu : [0, 0]; }, lastPtOld = () => { const p = cur && cur.pts[cur.pts.length - 1]; if (!p) return [0, 0]; const m = full(), det = m[0] * m[3] - m[1] * m[2]; const x = (p[0] / S) , y = vp.height - p[1] / S; const dx = x - m[4], dy = y - m[5]; return [(m[3] * dx - m[2] * dy) / det, (-m[1] * dx + m[0] * dy) / det]; };
    const layerFor = () => {
      const col = stroke, cn = colName(col), nm = "PDF " + (dash ? "dashed " : "") + (cn || "lines"); names.add(nm + "|" + (cn ? col : "#ffffff") + "|" + (dash ? "DASHED" : "CONTINUOUS")); return nm;
    };
    const lwOf = () => { const sc = Math.hypot(ctm[0], ctm[1]) * lw * PT * scale; return std.reduce((b, v) => (Math.abs(v - sc) < Math.abs(b - sc) ? v : b), 0.25); };
    const emitLine = (a, b, layer, w) => {
      const k = [a, b].map((p) => Math.round(p[0] * 50) + "," + Math.round(p[1] * 50)).sort().join("|"); if (lineSeen.has(layer + k)) return; lineSeen.add(layer + k);
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.02) return; ents.push({ t: "line", layer, lw: w, a: [r3(a[0]), r3(a[1]), 0], b: [r3(b[0]), r3(b[1]), 0] });
    };
    const emitCurve = (pts, closed, layer, w) => {
      // a circle or an arc made of Béziers
      const n = pts.length; if (n >= 8) {
        const c = fitCircle(pts, 0, n - 1);
        if (c && c.r > 0.05 && c.max <= 0.004 * c.r + 0.01 && Math.abs(c.sweep) > 0.2) {
          if (Math.abs(c.sweep) > TAU - 0.08) { ents.push({ t: "circle", layer, lw: w, c: [r3(c.cx), r3(c.cy), 0], r: r3(c.r) }); return; }
          const s0 = c.a0, e0 = c.a0 + c.sweep, nz = (a) => { a %= TAU; return a < 0 ? a + TAU : a; }; ents.push({ t: "arc", layer, lw: w, c: [r3(c.cx), r3(c.cy), 0], r: r3(c.r), a0: nz(c.sweep > 0 ? s0 : e0), a1: nz(c.sweep > 0 ? e0 : s0) }); return;
        }
      }
      ents.push({ t: "pline", layer, lw: w, closed: !!closed, pts: pts.map((p) => [r3(p[0]), r3(p[1]), 0]) });
    };
    const strokePath = (close) => {
      const layer = layerFor(), w = lwOf();
      for (const sp of sub) {
        if (sp.pts.length < 2) continue; if (close || sp.closed) sp.closed = true; strokes++;
        const hasC = sp.seg.includes("C");
        if (!hasC) {
          let pts = sp.pts.slice(); if (sp.closed && (Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) > 0.02)) pts.push(pts[0]);
          if (pts.length === 2) emitLine(pts[0], pts[1], layer, w); else if (pts.length <= 3 || !sp.closed) { for (let i = 0; i + 1 < pts.length; i++) emitLine(pts[i], pts[i + 1], layer, w); } else for (let i = 0; i + 1 < pts.length; i++) emitLine(pts[i], pts[i + 1], layer, w);
        } else {
          // split the sub-path into straight runs and curve runs
          let i = 0; const pts = sp.pts, seg = sp.seg, closedAll = sp.closed && seg.every((s) => s === "C");
          if (closedAll) { emitCurve(pts, true, layer, w); continue; }
          while (i < seg.length) {
            if (seg[i] === "L") { emitLine(pts[i], pts[i + 1], layer, w); i++; continue; }
            let j = i; while (j < seg.length && seg[j] === "C") j++; emitCurve(pts.slice(i, j + 1), false, layer, w); i = j;
          }
        }
      }
    };
    const fillPath = () => {
      // thin filled rectangles are how some CAD plotters draw lines; small filled shapes are text drawn as outlines; the rest is shading
      for (const sp of sub) {
        if (sp.pts.length < 3) continue; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of sp.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
        const bw = x1 - x0, bh = y1 - y0;
        if (!sp.seg.includes("C") && sp.pts.length <= 6 && Math.min(bw, bh) <= 0.45 && Math.max(bw, bh) > 0.9) { const layer = layerFor(); if (bw >= bh) emitLine([x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2], layer, std.reduce((b, v) => (Math.abs(v - Math.min(bw, bh)) < Math.abs(b - Math.min(bw, bh)) ? v : b), 0.25)); else emitLine([(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1], layer, 0.25); strokes++; }
        else if (Math.max(bw, bh) < 7) glyphs++; else filled++;
      }
    };
    const paint = (st, fl, close) => { if (close && cur) cur.closed = true; if (fl) fillPath(); if (st) strokePath(close); sub = []; cur = null; };
    const rect = (x, y, w, h) => { mv(x, y); ln(x + w, y); ln(x + w, y + h); ln(x, y + h); cur.closed = true; cur = null; };
    const run = (op, a) => {
      switch (op) {
        case O.save: stack.push([ctm.slice(), lw, stroke, dash]); break;
        case O.restore: { const s = stack.pop(); if (s) { ctm = s[0]; lw = s[1]; stroke = s[2]; dash = s[3]; } break; }
        case O.transform: ctm = mmul(ctm, a); break;
        case O.setLineWidth: lw = a[0]; break;
        case O.setDash: dash = !!(a[0] && a[0].length && a[0].some((v) => v > 0)); break;
        case O.setStrokeRGBColor: stroke = typeof a[0] === "string" ? a[0] : hex(a[0], a[1], a[2]); break;
        case O.setStrokeGray: stroke = hex(a[0] * 255, a[0] * 255, a[0] * 255); break;
        case O.setStrokeColor: case O.setStrokeColorN: if (typeof a[0] === "string") stroke = a[0]; break;
        case O.moveTo: mv(a[0], a[1]); break; case O.lineTo: ln(a[0], a[1]); break;
        case O.curveTo: cv(a[0], a[1], a[2], a[3], a[4], a[5]); break;
        case O.curveTo2: { const p = lastPt(); cv(p[0], p[1], a[0], a[1], a[2], a[3]); break; }
        case O.curveTo3: cv(a[0], a[1], a[2], a[3], a[2], a[3]); break;
        case O.closePath: if (cur) { cur.closed = true; } break;
        case O.rectangle: rect(a[0], a[1], a[2], a[3]); break;
        case O.stroke: paint(true, false, false); break; case O.closeStroke: paint(true, false, true); break;
        case O.fill: case O.eoFill: paint(false, true, false); break;
        case O.fillStroke: case O.eoFillStroke: paint(true, true, false); break; case O.closeFillStroke: case O.closeEOFillStroke: paint(true, true, true); break;
        case O.endPath: sub = []; cur = null; break;
        case O.paintFormXObjectBegin: stack.push([ctm.slice(), lw, stroke, dash]); if (a && a[0]) ctm = mmul(ctm, a[0]); break;
        case O.paintFormXObjectEnd: { const s = stack.pop(); if (s) { ctm = s[0]; lw = s[1]; stroke = s[2]; dash = s[3]; } break; }
        case O.paintImageXObject: case O.paintInlineImageXObject: case O.paintImageMaskXObject: case O.paintJpegXObject: images++; break;
        default: break;
      }
    };
    for (let i = 0; i < ol.fnArray.length; i++) {
      const op = ol.fnArray[i], a = ol.argsArray[i];
      if (op === O.constructPath) {
        const ops = a[0], co = a[1]; let k = 0;
        for (const o of ops) { if (o === O.moveTo || o === O.lineTo) { run(o, [co[k], co[k + 1]]); k += 2; } else if (o === O.curveTo) { run(o, co.slice(k, k + 6)); k += 6; } else if (o === O.curveTo2 || o === O.curveTo3) { run(o, co.slice(k, k + 4)); k += 4; } else if (o === O.rectangle) { run(o, co.slice(k, k + 4)); k += 4; } else if (o === O.closePath) run(o, []); }
      } else run(op, a || []);
    }
    // text with a real text layer
    const tc = await page.getTextContent(), words = [];
    for (const t of tc.items) {
      const s = (t.str || "").replace(/\s+$/, ""); if (!s.trim() || !t.transform) continue;
      const m = mmul(VPM, t.transform), x = m[4], y = m[5], sx = Math.hypot(m[0], m[1]), sy = Math.hypot(m[2], m[3]), rot = Math.atan2(-m[1], m[0]), fs = sy * S;      // font size in mm
      let h = fs * 0.716; void sx;
      const wantW = (t.width || 0) * PT * scale; if (wantW > 0) { const tw = G.textW(s, h); if (tw > wantW * 1.08) h = h * (wantW / tw); }
      if (h < 0.3) continue; words.push({ t: "text", layer: "PDF text", p: [r3(x * S), r3((vp.height - y) * S), 0], h: r3(h), s, rot: r3(rot), ha: 0, va: 0 });
    }
    return { ents, words, strokes, images, glyphs, filled, names: [...names], W: vp.width * S, H: vp.height * S };
  };

  /* ================================================================= file → drawing ================================================================= */
  const extOf = (f) => String((f && f.name) || "").split(".").pop().toLowerCase();
  V.isPicture = (f) => /^(png|jpe?g|webp|bmp|gif|tif|tiff)$/.test(extOf(f)) || /^image\//.test(f.type || "");
  V.isPdf = (f) => extOf(f) === "pdf" || f.type === "application/pdf";
  V.accepts = ".pdf,.png,.jpg,.jpeg,.webp,.bmp";

  const pickSheet = (w, h, want) => { if (want && SHEETS[want]) { const s = SHEETS[want]; return w >= h ? s[0] : s[1]; } const land = w >= h, ar = Math.max(w, h) / Math.min(w, h); let best = "A3", bd = 9; for (const [k, s] of Object.entries(SHEETS)) { const d = Math.abs(s[0] / s[1] - ar); if (d < bd) { bd = d; best = k; } } void best; return land ? 420 : 297; };

  /** convert a PDF page or a picture; returns {ents, layers:[{name,color,lt}], cnt, note, pages, kind, W, H, picture} (mm, lower-left origin at 0,0) */
  V.convert = async (file, o, say) => {
    say = say || (() => {}); o = Object.assign({ page: 1, sheet: "", scaleK: 1, sens: 0.14, ortho: true, ocr: true, keep: true, force: "" }, o || {});
    const res = { ents: [], layers: [], cnt: { lines: 0, circles: 0, arcs: 0, text: 0, other: 0 }, warn: [], kind: "", pages: 1 };
    let canvas = null, pageW = 0;
    if (V.isPdf(file)) {
      const lib = await pdfLib(); say("Opening the PDF…"); const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise; res.pages = pdf.numPages;
      const pn = Math.min(Math.max(1, +o.page || 1), pdf.numPages), page = await pdf.getPage(pn); const vp1 = page.getViewport({ scale: 1 });
      if (o.force !== "picture") {
        say("Reading the lines and text of the PDF…"); const v = await V.pdfVector(page, lib, o, o.scaleK || 1);
        if (v && (v.ents.length >= 12 || o.force === "vector")) {
          res.kind = "vector"; res.W = v.W; res.H = v.H;
          for (const n of v.names) { const [nm, col, lt] = n.split("|"); res.layers.push({ name: nm, color: col, lt }); }
          if (v.words.length) res.layers.push({ name: "PDF text", color: "#ffffff", lt: "CONTINUOUS" });
          res.ents = v.ents.concat(v.words); for (const e of res.ents) { if (e.t === "line" || e.t === "pline") res.cnt.lines++; else if (e.t === "circle") res.cnt.circles++; else if (e.t === "arc") res.cnt.arcs++; else if (e.t === "text") res.cnt.text++; }
          if (v.glyphs > 20 && !v.words.length) res.warn.push(`${v.glyphs} small filled shapes (letters drawn as outlines) were left out — this PDF has no text layer. Convert it again with “Treat as a picture” to read the text with OCR.`);
          if (v.images) res.warn.push(`${v.images} picture(s) inside the PDF were not converted.`);
          res.note = `PDF page ${pn} of ${pdf.numPages} read as vector: ${res.cnt.lines} lines, ${res.cnt.circles} circles, ${res.cnt.arcs} arcs, ${res.cnt.text} text items (exact, in mm at the PDF’s printed size).`;
          return res;
        }
      }
      // a picture inside a PDF: render and trace
      const sc = Math.min(3, 2600 / Math.max(vp1.width, vp1.height)), vp = page.getViewport({ scale: sc }); canvas = mkCanvas(Math.round(vp.width), Math.round(vp.height));
      say("Rendering the PDF page…"); await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise; pageW = vp1.width * PT * (o.scaleK || 1); res.kind = "picture"; res.src = "PDF page " + pn;
      if (!o.sheet) o.sheetMm = pageW;
    } else {
      say("Reading the picture…"); const url = URL.createObjectURL(file), im = new Image(); im.src = url; try { await im.decode(); } finally { URL.revokeObjectURL(url); }
      const k = Math.min(1, 2600 / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k); canvas = mkCanvas(w, h); canvas.getContext("2d").drawImage(im, 0, 0, w, h); res.kind = "picture"; res.src = "picture";
    }
    // pictures: trace
    const r = await V.fromCanvas(canvas, o, say), w = canvas.width, h = canvas.height;
    const sheetW = o.sheetMm && !o.sheet ? o.sheetMm : pickSheet(w, h, o.sheet) * (o.scaleK || 1), mm = sheetW / w;
    res.W = w * mm; res.H = h * mm; const names = { lines: "Traced lines", text: "Traced text" };
    res.layers.push({ name: names.lines, color: "#ffffff", lt: "CONTINUOUS" }); if (r.words.length) res.layers.push({ name: names.text, color: "#ffffff", lt: "CONTINUOUS" });
    const cv = V.itemsToEnts(r, mm, 0, 0, res.layers, names); res.ents = cv.ents; res.cnt = Object.assign(res.cnt, cv.cnt);
    if (o.keep) { res.picture = { src: canvas.toDataURL("image/jpeg", 0.85), w: res.W, h: res.H }; res.layers.push({ name: "Source picture", color: "#8a96a6", lt: "CONTINUOUS", lock: true }); }
    if (o.ocrFailed) res.warn.push("The text could not be read automatically, so the text is missing; the original picture is kept as a reference layer to type it in.");
    else if (!o.ocr && r.dropped) res.warn.push(`${r.dropped} small marks (probably lettering) were left out because text reading was switched off.`);
    res.skew = r.skew; res.note = `Picture traced: ${res.cnt.lines} lines, ${res.cnt.circles} circles, ${res.cnt.arcs} arcs, ${res.cnt.text} text items${r.skew ? "; the crooked scan was straightened by " + Math.abs(Math.round(r.skew * 1800 / Math.PI) / 10) + "°" : ""}. Scale assumed from the sheet width of ${r3(res.W)} mm — check one known dimension and use SCALE if it differs.`;
    return res;
  };

  /** put a conversion result into a document {layers, ents, images} */
  V.intoDoc = (doc, res, ox, oy, factor) => {
    factor = factor || 1; doc.layers = doc.layers || [];
    for (const l of res.layers) if (!doc.layers.find((x) => x.name === l.name)) doc.layers.push(Object.assign({ on: true, frozen: false, lock: false, lw: 0.25 }, l));
    const mv = (p) => [(p[0] + ox) * factor, (p[1] + oy) * factor, 0];
    for (const e of res.ents) {
      const n = Object.assign({}, e); if (n.a) { n.a = mv(n.a); n.b = mv(n.b); } if (n.c) { n.c = mv(n.c); n.r = n.r * factor; } if (n.p) { n.p = mv(n.p); n.h = n.h * factor; } if (n.pts) n.pts = n.pts.map(mv);
      n.color = null; n.lt = null; if (n.lw == null) n.lw = null; doc.ents.push(n);
    }
    if (res.picture) { doc.images = doc.images || {}; const key = "src" + Object.keys(doc.images).length; doc.images[key] = res.picture.src; doc.ents.unshift({ t: "image", layer: "Source picture", p: [ox * factor, oy * factor, 0], w: res.picture.w * factor, h: res.picture.h * factor, rot: 0, src: "img:" + key, alpha: 0.35, color: null, lt: null, lw: null }); }
    return doc;
  };

  /* ---------- Open / Import / register import accept PDFs and pictures ---------- */
  const readFile1 = K.readDrawingFile;
  K.readDrawingFile = async (file, say) => {
    if (V.isPdf(file) || V.isPicture(file)) {
      say = say || (() => {}); const res = await V.convert(file, {}, say); const doc = K.newDoc(false); doc.units = "mm"; V.intoDoc(doc, res, 0, 0, 1);
            return { doc, warn: {}, notes: res.warn, note: res.note, name: String(file.name).replace(/\.[^.]+$/, ""), converted: true };
    }
    return readFile1(file, say);
  };
  const pick1 = K.pickFile; K.pickFile = (accept) => pick1(/\.dxf/.test(accept || "") && !/\.pdf/.test(accept) ? accept + "," + V.accepts : accept);

  /* ---------- command: Insert → Convert PDF / picture ---------- */
  K.cmd("PDF2CAD", { a: ["IMG2CAD", "VECTORIZE", "CONVERT", "TRACE"], d: "Convert a PDF or a picture of a drawing (scan, photo, CAD plot) into editable CAD objects", norepeat: true, fn: async (E) => {
    const file = await K.pickFile(V.accepts); if (!file) return; const pdf = V.isPdf(file);
    let pages = 1; if (pdf) { try { const lib = await pdfLib(); pages = (await lib.getDocument({ data: await file.arrayBuffer() }).promise).numPages; } catch (e) { return E.err("This PDF could not be opened: " + e.message); } }
    const o = await E.dialog("Convert to CAD", `<p class="cx-note"><b>${K.esc(file.name)}</b> — ${pdf ? pages + " page(s)" : "picture"}. The drawing is turned into lines, circles, arcs and text that you can edit.</p><div class="cx-frm">
      ${pdf ? `<label>PDF page<input id="vp" type="number" min="1" max="${pages}" value="1"></label>` : ""}
      <label>${pdf ? "If the PDF has no vector lines" : "Picture"} covers sheet<select id="vs"><option value="">Automatic (A3 / its own size)</option>${Object.keys(SHEETS).map((s) => `<option>${s}</option>`).join("")}</select></label>
      <label>Scale of the drawing (1 : …)<input id="vk" type="number" min="0.001" step="any" value="1"></label>
      <label>Line sensitivity<select id="vz"><option value="0.2">High — faint or pencil lines</option><option value="0.14" selected>Normal</option><option value="0.09">Low — dirty scans</option></select></label>
      ${pdf ? `<label>PDF type<select id="vf"><option value="">Automatic</option><option value="picture">Treat as a picture (scan / lettering as outlines)</option><option value="vector">Read as vector</option></select></label>` : ""}
      <label class="cx-chk"><input id="vo" type="checkbox" checked> Read the text (OCR)</label><label class="cx-chk"><input id="vr" type="checkbox" checked> Make near-horizontal / vertical lines exact</label><label class="cx-chk"><input id="vd" type="checkbox" checked> Straighten a crooked scan</label><label class="cx-chk"><input id="vk2" type="checkbox" checked> Keep the original as a faint reference layer</label>
      <label>Place at<select id="vw"><option value="cur">This drawing (right of what is there)</option><option value="org">This drawing, at 0,0</option></select></label></div>
      <p class="cx-note">Scans are traced to about 1–2 pixels, so check key dimensions afterwards. Hand-drawn or very dirty pictures need tidying; CAD plots and clean scans convert very well.</p>`,
      (b) => { const g = (id) => b.querySelector("#" + id); return { page: pdf ? +g("vp").value : 1, sheet: g("vs").value, scaleK: +g("vk").value || 1, sens: +g("vz").value, force: pdf ? g("vf").value : "", ocr: g("vo").checked, ortho: g("vr").checked, deskew: g("vd").checked, keep: g("vk2").checked, where: g("vw").value }; }, { width: "min(640px,96vw)", ok: "Convert" });
    if (!o) return;
    const say = (t) => E.msg(t);
    let res; try { res = await V.convert(file, o, say); } catch (e) { return E.err("The conversion failed: " + e.message); }
    if (!res.ents.length && !res.picture) return E.err("Nothing could be recognised in this file. Try the other sensitivity, or “Treat as a picture”.");
    let ox = 0; if (o.where === "cur") { const b = K.extents(E.doc); if (b) ox = b.x1 + 20; }
    const f = 1 / (UNITMM[E.doc.units] || 1);
    E.tx("convert " + file.name, () => { const before = E.doc.ents.length; const tmp = { layers: E.doc.layers, ents: [], images: E.doc.images }; V.intoDoc(tmp, res, ox, 0, f); E.doc.layers = tmp.layers; if (tmp.images) E.doc.images = Object.assign({}, E.doc.images, tmp.images); for (const e of tmp.ents) E.add(Object.assign({}, e), true); void before; });
    E.zoomExt(); E.msg(res.note + (res.warn.length ? " " + res.warn.join(" ") : ""), "ok");
  } });
  if (K.RIBBON) { const ins = K.RIBBON.find((t) => t.t === "Insert"); if (ins) ins.g.push({ n: "Convert", b: [["PDF2CAD", "PDF / picture → CAD", "open"]] }); }
})((window.KCAD = window.KCAD || {}));
