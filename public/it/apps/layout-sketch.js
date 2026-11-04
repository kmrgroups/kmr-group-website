/* Layout Studio — "Sketch & Table" tab.
   Draw a to-scale floor sketch inside the inner wall size, label every object, mark operator positions,
   get the data table (with four-side gaps) and a dashboard, and export controlled PDF / Excel reports.
   Internal unit is always metres; the chosen unit is only used for input and display. */
(function () {
  'use strict';
  const UN = { m: 1, mm: 0.001, cm: 0.01, ft: 0.3048, in: 0.0254, yd: 0.9144 };
  const UNAME = { m: 'metre (m)', mm: 'millimetre (mm)', cm: 'centimetre (cm)', ft: 'feet (ft)', in: 'inch (in)', yd: 'yard (yd)' };
  const DEC = { m: 2, mm: 0, cm: 1, ft: 2, in: 1, yd: 2 };
  const PAPER = { A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594], A0: [1189, 841] };
  const STD_SCALES = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  const SIDES = ['N', 'E', 'S', 'W'];
  const SIDE_NAME = { N: 'North (top)', E: 'East (right)', S: 'South (bottom)', W: 'West (left)' };
  const KINDS = ['Machine', 'Equipment', 'Inspection / gauge', 'Room', 'Storage', 'Other'];
  const PAL = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#0891b2', '#ea580c', '#ca8a04', '#db2777', '#4d7c0f', '#475569'];
  const FORMAT = { no: 'KMR/LAY/F-02', title: 'Floor Layout Sketch & Object Register' };
  const EPS = 1e-6;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let H = null;            // host options
  let el = null;           // root element
  let S = null;            // state
  let tool = 'sel', sel = null, selOp = null, showGaps = false;
  let vb = null;           // current viewBox [x,y,w,h] in metres
  let undo = [], drag = null, popEl = null, saveT = null, BG = null, remoteT = null, svState = '', svAt = null, sketches = [], saving = false, again = false;

  /* ---------- state ---------- */
  const fresh = () => ({ id: null, at: 0, title: 'Shopfloor layout', plant: '', unit: 'm', L: 44, W: 27, shifts: 1, paper: 'A3', rev: '00', revNote: 'First issue', drawn: '', checked: '', approved: '', objs: [], seq: 1, hist: [] });
  const key = () => 'kmr-layout-sketch:' + (H.key || 'demo');
  function load() { try { const j = JSON.parse(localStorage.getItem(key()) || 'null'); if (j && j.objs) return Object.assign(fresh(), j); } catch (e) { /* ignore */ } return fresh(); }
  function persist() { S.at = Date.now(); clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(key(), JSON.stringify(S)); } catch (e) { /* blocked */ } }, 300); remoteQueue(); }
  /* ---------- automatic saving in the database ---------- */
  function remoteQueue() { if (!H.store) return; svState = 'wait'; paintSv(); clearTimeout(remoteT); remoteT = setTimeout(remoteSave, 1500); }
  async function remoteSave() {
    if (!H.store) return; if (saving) { again = true; return; } saving = true;
    try { svState = 'saving'; paintSv(); const cur = S; const id = await H.store.save(cur.id, cur); cur.id = id; svState = 'ok'; svAt = new Date(); try { localStorage.setItem(key(), JSON.stringify(cur)); } catch (e) { /* ignore */ } await refreshList(); }
    catch (e) { svState = 'err:' + (e.message || e); }
    saving = false; paintSv(); paintBar(); if (again) { again = false; remoteQueue(); }
  }
  async function refreshList() { if (!H.store) return; try { sketches = await H.store.list(); } catch (e) { /* ignore */ } }
  async function openSketch(id) { const r = await H.store.load(id); if (!r) throw new Error('That sketch could not be found.'); S = Object.assign(fresh(), r); S.id = id; sel = selOp = null; vb = null; BG = null; undo = []; resetSetup(); render(); try { localStorage.setItem(key(), JSON.stringify(S)); } catch (e) { /* ignore */ } }
  async function bootRemote() {
    try {
      await refreshList();
      if (sketches.length) {
        const mine = sketches.find(x => x.id === S.id);
        if (mine && S.objs.length && S.at > Date.parse(mine.updated_at || 0)) remoteQueue();          // this browser has newer changes
        else await openSketch(mine ? mine.id : sketches[0].id);                                             // the database copy is the latest
      } else if (S.objs.length) remoteQueue();
      if (svState !== 'wait') { svState = 'ok'; svAt = svAt || new Date(); }
    } catch (e) { svState = 'err:' + (e.message || e); }
    paintSv(); paintBar();
  }
  function resetSetup() { const h = el && el.querySelector('#ls-setup'); if (h) delete h.dataset.t; }
  function snap() { undo.push(JSON.stringify(S)); if (undo.length > 60) undo.shift(); }
  function doUndo() { if (!undo.length) return; S = Object.assign(fresh(), JSON.parse(undo.pop())); sel = null; selOp = null; closePop(); render(); persist(); }

  /* ---------- units ---------- */
  const u = () => S.unit;
  const toU = m => m / UN[u()];
  const fu = (m, d) => { const k = d == null ? DEC[u()] : d; return toU(m).toFixed(k); };
  const fuu = m => fu(m) + ' ' + u();
  const fromU = v => parseFloat(String(v).replace(',', '.')) * UN[u()];
  const niceStep = v => { const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p; };
  const step = () => niceStep(Math.max(S.L, S.W) / 200);
  const snapv = v => Math.round(v / step()) * step();

  /* ---------- geometry ---------- */
  const clampObj = o => { o.w = Math.min(o.w, S.L); o.h = Math.min(o.h, S.W); o.x = Math.max(0, Math.min(S.L - o.w, o.x)); o.y = Math.max(0, Math.min(S.W - o.h, o.y)); };
  const ov = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > EPS && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > EPS;
  function gapsOf(a) {
    const r = { N: { v: a.y, to: 'Wall', o: null }, S: { v: S.W - a.y - a.h, to: 'Wall', o: null }, W: { v: a.x, to: 'Wall', o: null }, E: { v: S.L - a.x - a.w, to: 'Wall', o: null } };
    for (const b of S.objs) {
      if (b === a) continue;
      const hx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), hy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (hx > EPS) {
        if (b.y + b.h <= a.y + EPS) { const g = a.y - (b.y + b.h); if (g < r.N.v) r.N = { v: g, to: b.code, o: b }; }
        if (b.y >= a.y + a.h - EPS) { const g = b.y - (a.y + a.h); if (g < r.S.v) r.S = { v: g, to: b.code, o: b }; }
      }
      if (hy > EPS) {
        if (b.x + b.w <= a.x + EPS) { const g = a.x - (b.x + b.w); if (g < r.W.v) r.W = { v: g, to: b.code, o: b }; }
        if (b.x >= a.x + a.w - EPS) { const g = b.x - (a.x + a.w); if (g < r.E.v) r.E = { v: g, to: b.code, o: b }; }
      }
    }
    return r;
  }
  function setGap(a, side, val) {
    const g = gapsOf(a)[side], nb = g.o; if (!isFinite(val) || val < 0) return false;
    snap();
    if (side === 'N') a.y = (nb ? nb.y + nb.h : 0) + val;
    if (side === 'S') a.y = (nb ? nb.y : S.W) - val - a.h;
    if (side === 'W') a.x = (nb ? nb.x + nb.w : 0) + val;
    if (side === 'E') a.x = (nb ? nb.x : S.L) - val - a.w;
    clampObj(a); persist(); return true;
  }
  const overlaps = () => S.objs.filter(a => S.objs.some(b => b !== a && ov(a, b)));
  const groups = () => { const g = []; S.objs.forEach(o => { const k = o.group || '—'; if (!g.includes(k)) g.push(k); }); return g; };
  const gcol = g => PAL[Math.max(0, groups().indexOf(g || '—')) % PAL.length];

  /* ---------- label fitting (wrap or shrink, never overlap the box edge) ---------- */
  function wrap(t, n) {
    if (n < 1) return null; const out = []; let cur = '';
    for (const w0 of String(t).split(/\s+/).filter(Boolean)) {
      let w = w0;
      while (w.length > n) { if (cur) { out.push(cur); cur = ''; } out.push(w.slice(0, n)); w = w.slice(n); }
      if (!cur) cur = w; else if ((cur + ' ' + w).length <= n) cur += ' ' + w; else { out.push(cur); cur = w; }
    }
    if (cur) out.push(cur); return out;
  }
  function layoutLines(parts, f, aw) {
    const out = []; const cw = 0.58 * f; const n = Math.floor(aw / cw); if (n < 1) return null;
    for (const p of parts) {
      if (p.nowrap) { if (p.t.length > n) return null; out.push({ t: p.t, b: p.b, s: p.s }); }
      else { const ws = wrap(p.t, n); if (!ws || ws.length > (p.max || 4)) return null; ws.forEach(t => out.push({ t, b: p.b, s: p.s })); }
    }
    return out;
  }
  function fitLabel(o, ppm) {
    const code = o.code || '', name = o.name || '', sz = fu(o.w) + ' × ' + fu(o.h) + ' ' + u();
    const variants = [
      [code && { t: code, b: 1, max: 2 }, name && { t: name, max: 4 }, { t: sz, nowrap: 1, s: 1 }],
      [code && { t: code, b: 1, max: 2 }, { t: sz, nowrap: 1, s: 1 }],
      [code && { t: code, b: 1, max: 2 }],
      [{ t: sz, nowrap: 1, s: 1 }]
    ].map(v => v.filter(Boolean));
    const fmin = 6 / ppm, fcap = 15 / ppm; let best = null;
    for (const v of variants) {
      if (!v.length) continue;
      for (const rot of (o.h > o.w * 1.35 ? [false, true] : [false])) {
        const pad = 0.06 * Math.min(o.w, o.h), aw = (rot ? o.h : o.w) - 2 * pad, ah = (rot ? o.w : o.h) - 2 * pad;
        if (aw <= 0 || ah <= 0) continue;
        for (let f = Math.min(fcap, Math.min(aw, ah) * 0.5); f >= fmin; f *= 0.93) {
          const L = layoutLines(v, f, aw);
          if (L && L.length * 1.2 * f <= ah) { if (!best || f > best.f) best = { f, L, rot }; break; }
        }
      }
      if (best) break;   // the fullest variant that fits at a readable size wins
    }
    return best;
  }

  /* ---------- drawing ---------- */
  function opPos(o, side, i, k, r) {
    const fr = (i + 1) / (k + 1), d = r * 1.35;
    if (side === 'N') return { x: o.x + o.w * fr, y: o.y - d, dx: 0, dy: 1 };
    if (side === 'S') return { x: o.x + o.w * fr, y: o.y + o.h + d, dx: 0, dy: -1 };
    if (side === 'W') return { x: o.x - d, y: o.y + o.h * fr, dx: 1, dy: 0 };
    return { x: o.x + o.w + d, y: o.y + o.h * fr, dx: -1, dy: 0 };
  }
  function buildSVG(opt) {
    opt = opt || {};
    const mx = Math.max(S.L, S.W), pad = mx * 0.07;
    const V = opt.vb || vb || [-pad, -pad, S.L + 2 * pad, S.W + 2 * pad];
    const ppm = opt.ppm || ((opt.px || (el && el.querySelector('#ls-cv') ? el.querySelector('#ls-cv').clientWidth : 900)) / V[2]);
    const bad = new Set(overlaps()), fs = 11 / ppm, sw = 1.2 / ppm;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${V.join(' ')}" font-family="Arial,Helvetica,sans-serif" ${opt.px ? `width="${opt.px}" height="${Math.round(opt.px * V[3] / V[2])}"` : 'width="100%" style="display:block;touch-action:none;user-select:none;background:#fff"'} id="${opt.px ? 'x' : 'ls-svg'}">`;
    if (opt.px) s += `<rect x="${V[0]}" y="${V[1]}" width="${V[2]}" height="${V[3]}" fill="#fff"/>`;
    if (BG && !opt.px) s += `<image href="${BG.url}" x="0" y="0" width="${S.L}" height="${S.W}" preserveAspectRatio="none" opacity="0.4"/>`;
    // grid
    const gs = niceStep(mx / 22);
    let gr = ''; for (let x = 0; x <= S.L + EPS; x += gs) gr += `M${x} 0V${S.W}`; for (let y = 0; y <= S.W + EPS; y += gs) gr += `M0 ${y}H${S.L}`;
    s += `<path d="${gr}" stroke="#e2e8f0" stroke-width="${0.6 / ppm}" fill="none"/>`;
    s += `<rect x="0" y="0" width="${S.L}" height="${S.W}" fill="none" stroke="#111827" stroke-width="${3 / ppm}"/>`;
    // objects
    for (const o of S.objs) {
      const c = gcol(o.group), isBad = bad.has(o), isSel = sel === o.id;
      s += `<g data-o="${o.id}" style="cursor:move"><rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="${isBad ? '#ff000040' : c + '22'}" stroke="${isBad ? '#dc2626' : c}" stroke-width="${(isSel ? 2.6 : 1.4) / ppm}"/>`;
      const f = fitLabel(o, ppm);
      if (f) {
        const cx = o.x + o.w / 2, cy = o.y + o.h / 2, th = f.L.length * 1.2 * f.f; let t = '';
        f.L.forEach((ln, i) => { t += `<text x="${cx}" y="${cy - th / 2 + (i + 0.85) * 1.2 * f.f}" font-size="${f.f}" text-anchor="middle" fill="${ln.s ? '#475569' : '#0f172a'}" ${ln.b ? 'font-weight="700"' : ''}>${esc(ln.t)}</text>`; });
        s += f.rot ? `<g transform="rotate(-90 ${cx} ${cy})">${t}</g>` : t;
      }
      s += '</g>';
      if (isSel && !opt.px) for (const [hx, hy, id] of [[o.x, o.y, 'nw'], [o.x + o.w, o.y, 'ne'], [o.x, o.y + o.h, 'sw'], [o.x + o.w, o.y + o.h, 'se']]) s += `<rect data-h="${id}" data-o="${o.id}" x="${hx - 4 / ppm}" y="${hy - 4 / ppm}" width="${8 / ppm}" height="${8 / ppm}" fill="#fff" stroke="#7c3aed" stroke-width="${sw}" style="cursor:nwse-resize"/>`;
    }
    // operators
    for (const o of S.objs) {
      const r = Math.min(Math.min(o.w, o.h) * 0.2, mx * 0.011), rr = Math.max(r, mx * 0.004);
      const by = {}; o.ops.forEach((sd, i) => { (by[sd] = by[sd] || []).push(i); });
      for (const sd of Object.keys(by)) by[sd].forEach((idx, j) => {
        const p = opPos(o, sd, j, by[sd].length, rr), act = selOp && selOp.o === o.id && selOp.i === idx;
        const ang = Math.atan2(p.dy, p.dx) * 180 / Math.PI;
        s += `<g data-op="${o.id}:${idx}" style="cursor:pointer"><circle cx="${p.x}" cy="${p.y}" r="${rr}" fill="${act ? '#7c3aed' : '#fff'}" stroke="#111827" stroke-width="${sw}"/><path d="M${p.x + p.dx * rr * 0.2} ${p.y + p.dy * rr * 0.2}l${-p.dy * rr * 0.5 + p.dx * rr * 0.9} ${p.dx * rr * 0.5 + p.dy * rr * 0.9}l${p.dy * rr} ${-p.dx * rr}z" fill="${act ? '#fff' : '#111827'}" transform="rotate(0)"/></g>`;
      });
    }
    // gap dimensions
    if (showGaps || opt.gaps) for (const a of S.objs) {
      const g = gapsOf(a);
      for (const sd of SIDES) {
        const q = g[sd]; if (!(q.v > EPS)) continue; let x1, y1, x2, y2;
        if (sd === 'N' || sd === 'S') { const lo = q.o ? Math.max(a.x, q.o.x) : a.x, hi = q.o ? Math.min(a.x + a.w, q.o.x + q.o.w) : a.x + a.w; x1 = x2 = (lo + hi) / 2; y1 = sd === 'N' ? a.y : a.y + a.h; y2 = sd === 'N' ? a.y - q.v : a.y + a.h + q.v; }
        else { const lo = q.o ? Math.max(a.y, q.o.y) : a.y, hi = q.o ? Math.min(a.y + a.h, q.o.y + q.o.h) : a.y + a.h; y1 = y2 = (lo + hi) / 2; x1 = sd === 'W' ? a.x : a.x + a.w; x2 = sd === 'W' ? a.x - q.v : a.x + a.w + q.v; }
        const len = Math.hypot(x2 - x1, y2 - y1), txt = fu(q.v), tw = txt.length * 0.55 * fs;
        s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#0891b2" stroke-width="${0.9 / ppm}"/>`;
        const horiz = sd === 'W' || sd === 'E';
        if ((horiz ? len : len) * 1 >= (horiz ? tw : fs) * 1.1) s += `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - (horiz ? 0.25 * fs : 0)}" font-size="${fs * 0.85}" fill="#0e7490" text-anchor="middle" ${horiz ? '' : `transform="rotate(-90 ${(x1 + x2) / 2} ${(y1 + y2) / 2})" dy="-${0.3 * fs}"`}>${txt}</text>`;
      }
    }
    // overall dimensions
    const dy = -mx * 0.035, dx = -mx * 0.035, a1 = 4 / ppm;
    s += `<g stroke="#111827" stroke-width="${sw}" fill="#111827"><line x1="0" y1="${dy}" x2="${S.L}" y2="${dy}"/><line x1="0" y1="${dy - a1}" x2="0" y2="${dy + a1}"/><line x1="${S.L}" y1="${dy - a1}" x2="${S.L}" y2="${dy + a1}"/>`;
    s += `<line x1="${dx}" y1="0" x2="${dx}" y2="${S.W}"/><line x1="${dx - a1}" y1="0" x2="${dx + a1}" y2="0"/><line x1="${dx - a1}" y1="${S.W}" x2="${dx + a1}" y2="${S.W}"/></g>`;
    s += `<text x="${S.L / 2}" y="${dy - 0.35 * fs}" font-size="${fs * 1.15}" text-anchor="middle" font-weight="700" fill="#111827">${fuu(S.L)}</text>`;
    s += `<text x="${dx - 0.35 * fs}" y="${S.W / 2}" font-size="${fs * 1.15}" text-anchor="middle" font-weight="700" fill="#111827" transform="rotate(-90 ${dx - 0.35 * fs} ${S.W / 2})">${fuu(S.W)}</text>`;
    // north arrow
    const nx = S.L + mx * 0.04, ny = -mx * 0.02;
    s += `<g fill="#111827"><path d="M${nx} ${ny - mx * 0.03}l${mx * 0.012} ${mx * 0.04}l${-mx * 0.012} ${-mx * 0.012}l${-mx * 0.012} ${mx * 0.012}z"/><text x="${nx}" y="${ny - mx * 0.035}" font-size="${fs}" text-anchor="middle" font-weight="700">N</text></g>`;
    if (drag && drag.kind === 'draw') s += `<rect x="${Math.min(drag.x0, drag.x1)}" y="${Math.min(drag.y0, drag.y1)}" width="${Math.abs(drag.x1 - drag.x0)}" height="${Math.abs(drag.y1 - drag.y0)}" fill="#7c3aed22" stroke="#7c3aed" stroke-dasharray="${4 / ppm}" stroke-width="${sw}"/>`;
    return s + '</svg>';
  }

  /* ---------- table + dashboard data ---------- */
  function rows() {
    return S.objs.map((o, i) => { const g = gapsOf(o); return { n: i + 1, o, x: o.x, y: o.y, code: o.code, name: o.name, kind: o.kind, group: o.group || '—', len: o.w, wid: o.h, area: o.w * o.h, ops: o.ops.slice(), man: o.ops.length, g }; });
  }
  function stats() {
    const R = rows(), tot = S.L * S.W, used = R.reduce((a, r) => a + r.area, 0), by = {};
    R.forEach(r => { const b = by[r.group] = by[r.group] || { group: r.group, n: 0, mach: 0, man: 0, area: 0 }; b.n++; if (r.kind === 'Machine') b.mach++; b.man += r.man; b.area += r.area; });
    const gaps = []; R.forEach(r => SIDES.forEach(sd => { if (r.g[sd].v > EPS) gaps.push(r.g[sd].v); }));
    return { R, tot, used, by: Object.values(by), mach: R.filter(r => r.kind === 'Machine').length, man: R.reduce((a, r) => a + r.man, 0), over: overlaps().length, minGap: gaps.length ? Math.min.apply(null, gaps) : 0 };
  }

  /* ---------- screen ---------- */
  const css = `
  .ls .row{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px}.ls .row>div{display:flex;flex-direction:column;gap:3px;min-width:90px}
  .ls label.lb{font-size:11px;font-weight:700;text-transform:uppercase;color:var(--mut)}.ls .tools{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
  .ls .tb{border:1px solid var(--line);background:var(--card);border-radius:10px;padding:7px 12px;font-weight:700;cursor:pointer}.ls .tb.on{background:var(--b1);color:#fff;border-color:var(--b1)}
  .ls #ls-cv{position:relative;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;background:#fff;max-height:72vh}
  .ls .pop{position:absolute;z-index:9;background:var(--card);color:var(--ink);border:1px solid var(--b1);border-radius:12px;padding:10px;box-shadow:0 8px 28px #0004;min-width:230px;max-width:290px}
  .ls .pop h4{margin:0 0 6px;font-size:13px}.ls .pop .g2{display:grid;grid-template-columns:1fr 1fr;gap:6px}.ls .pop .acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
  .ls .tbl{overflow:auto;max-height:60vh}.ls .tbl input,.ls .tbl select{padding:4px 6px;width:100%;min-width:62px}.ls .tbl select{min-width:110px}.ls .tbl td small{display:block;color:var(--mut);font-size:10px}
  .ls .bar{height:10px;border-radius:5px}.ls .sec{border:1px solid var(--line);border-radius:12px;padding:12px;margin:12px 0}.ls h3{margin:0 0 8px}
  .ls .warn{color:var(--r);font-weight:700}
  `;
  function render() {
    if (!el) return;
    const keepFocus = document.activeElement && el.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName) && document.activeElement.closest('#ls-setup,#ls-tbl') ? document.activeElement.id || document.activeElement.dataset.k : null;
    if (!el.querySelector('#ls-cv')) {
      el.innerHTML = `<style>${css}</style><div class="ls">
      <div class="sec" style="position:sticky;top:var(--hh,0);z-index:5"><div class="row" id="ls-bar" style="margin:0"></div><div id="ls-sv" class="mut" style="font-size:12px"></div></div>
      <div class="sec"><h3>1. Building (inner wall) and unit</h3><div class="row" id="ls-setup"></div>
        <p class="mut" style="margin:0">Enter the inner length and width of the building and the unit you work in. The sketch is drawn 1:1 to those sizes; every length shown uses the unit you select.</p></div>
      <div class="tools" id="ls-tools"></div>
      <div id="ls-cv"></div><div class="mut" id="ls-hint" style="margin:6px 0"></div>
      <div class="sec"><h3>Dashboard</h3><div id="ls-dash"></div></div>
      <div class="sec"><h3>Object register (updates by itself)</h3><div class="tbl" id="ls-tbl"></div></div>
      <div class="sec"><h3>Documents and reports</h3><div id="ls-doc"></div></div>
      <div class="sec"><h3>Standards alignment of this screen</h3><div id="ls-std"></div></div></div>`;
      bindCanvas();
    }
    paintBar(); paintSv(); paintSetup(); paintTools(); paintCanvas(); paintDash(); paintTable(); paintDoc(); paintStd();
    if (keepFocus) { const e = el.querySelector('#' + CSS.escape(keepFocus)) || el.querySelector(`[data-k="${keepFocus}"]`); if (e && e.focus) { e.focus(); } }
  }
  function paintBar() {
    const h = el.querySelector('#ls-bar'); if (!h || h.querySelector('select:focus')) return;
    const pick = H.store ? `<div style="min-width:200px"><label class="lb">Saved sketches</label><select id="ls-pick"><option value="">${S.id ? '' : '(this one – not saved yet)'}</option>${sketches.map(x => `<option value="${x.id}" ${x.id === S.id ? 'selected' : ''}>${esc(x.title)} · ${esc(String(x.updated_at || '').slice(0, 10).split('-').reverse().join('-'))}</option>`).join('')}</select></div><div><button class="tb" data-act="newsk">＋ New sketch</button></div>` : '';
    h.innerHTML = `${pick}<div style="flex:1"></div><div><button class="btn" data-act="pdf">⬇ Save PDF (layout + table)</button></div><div><button class="btn" data-act="dxf">⬇ Save CAD file (DXF)</button></div><div><button class="btn o" data-act="xlsx">⬇ Save Excel</button></div><div><button class="btn o" data-act="open">📂 Open a file…</button><input type="file" id="ls-open" hidden accept=".json,.dxf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp,.bmp,.gif,.pdf,.svg"></div>${BG ? '<div><button class="tb" data-act="nobg">✕ Remove background picture</button></div>' : ''}${H.store && S.id ? '<div><button class="tb" data-act="delsk">🗑 Delete this sketch</button></div>' : ''}`;
  }
  function paintSv() {
    const h = el && el.querySelector('#ls-sv'); if (!h) return; const hm = d => d ? d.toTimeString().slice(0, 5) : '';
    h.style.color = svState.startsWith('err') ? 'var(--r)' : '';
    h.textContent = !H.store ? 'Saved in this browser only.' : svState === 'saving' ? 'Saving to the database…' : svState === 'wait' ? 'Changes will be saved to the database in a moment…' : svState.startsWith('err') ? 'NOT saved to the database: ' + svState.slice(4) + ' (still kept in this browser; it will retry on the next change)' : svState === 'ok' ? '✔ All changes are saved in the database' + (svAt ? ' at ' + hm(svAt) : '') + '.' : '';
  }
  function paintSetup() {
    const h = el.querySelector('#ls-setup'); if (h.dataset.u === u() + S.L + S.W + S.paper && h.dataset.t) { return; }
    h.innerHTML = `<div><label class="lb">Layout title</label><input id="s_title" value="${esc(S.title)}"></div>
      <div><label class="lb">Plant / unit</label><input id="s_plant" value="${esc(S.plant)}" placeholder="Plant-1"></div>
      <div><label class="lb">Unit</label><select id="s_unit">${Object.keys(UN).map(k => `<option value="${k}" ${k === u() ? 'selected' : ''}>${UNAME[k]}</option>`).join('')}</select></div>
      <div><label class="lb">Inner length (${u()})</label><input id="s_L" type="number" step="any" value="${fu(S.L)}"></div>
      <div><label class="lb">Inner width (${u()})</label><input id="s_W" type="number" step="any" value="${fu(S.W)}"></div>
      <div><label class="lb">Shifts</label><input id="s_sh" type="number" min="1" max="4" value="${S.shifts}" style="max-width:70px"></div>
      <div><button class="btn" id="s_apply">Apply size</button></div>`;
    h.dataset.u = u() + S.L + S.W + S.paper; h.dataset.t = 1;
  }
  function paintTools() {
    const t = el.querySelector('#ls-tools'); const b = (id, txt) => `<button class="tb ${tool === id ? 'on' : ''}" data-tool="${id}">${txt}</button>`;
    t.innerHTML = b('sel', '↖ Select / move') + b('draw', '▭ Draw shape') + b('op', '🧍 Add operator') + `<button class="tb" data-act="del" ${sel || selOp ? '' : 'disabled'}>🗑 Delete selected</button><button class="tb" data-act="undo">↶ Undo</button><button class="tb ${showGaps ? 'on' : ''}" data-act="gaps">↔ Show distances</button><button class="tb" data-act="fit">⛶ Fit view</button><button class="tb" data-act="clear">Clear all</button><button class="tb" data-act="jsonout">⬇ JSON</button><button class="tb" data-act="jsonin">⬆ JSON</button><input type="file" id="ls-file" accept=".json" hidden>`;
    el.querySelector('#ls-hint').textContent = tool === 'draw' ? 'Drag on the floor to draw a rectangle; you will then be asked for its code and name.' : tool === 'op' ? 'Click an object to add an operator on its south side; click the operator to move it to the next side or delete it.' : 'Drag an object to move it; use the corner handles to resize; double-click to edit; wheel to zoom; drag the empty floor to pan.';
  }
  function paintCanvas() { const c = el.querySelector('#ls-cv'); const keep = popEl && c.contains(popEl) ? popEl : null; c.innerHTML = buildSVG(); if (keep) c.appendChild(keep); }
  function paintDash() {
    const st = stats(), K = (v, l, c) => `<div class="kpi" style="--c:${c || 'var(--b1)'}"><b>${v}</b><span>${l}</span></div>`;
    const mxm = Math.max.apply(null, st.by.map(b => b.mach || b.n).concat([1]));
    el.querySelector('#ls-dash').innerHTML = `<div class="kpis">${K(S.objs.length, 'Objects drawn')}${K(st.mach, 'Machines', '#2563eb')}${K(st.man, 'Manpower per shift', '#16a34a')}${K(st.man * S.shifts, 'Manpower, all ' + S.shifts + ' shift(s)', '#0891b2')}${K(st.by.length, 'Groups / lines', '#9333ea')}${K((st.used / st.tot * 100 || 0).toFixed(1) + ' %', 'Floor occupied', '#ca8a04')}${K((st.tot / (UN[u()] * UN[u()])).toFixed(1) + ' ' + u() + '²', 'Building area')}${K(st.over, 'Overlaps', st.over ? '#dc2626' : '#16a34a')}${K(fuu(st.minGap), 'Smallest gap')}</div>
    ${st.by.length ? `<table><thead><tr><th>S.No</th><th>Group / line</th><th>Objects</th><th>Machines</th><th>Operators</th><th>Floor area (${u()}²)</th><th style="width:30%">Machines by group</th></tr></thead><tbody>${st.by.map((b, i) => `<tr><td>${i + 1}</td><td><b style="color:${gcol(b.group)}">■</b> ${esc(b.group)}</td><td>${b.n}</td><td>${b.mach}</td><td>${b.man}</td><td>${(b.area / (UN[u()] * UN[u()])).toFixed(1)}</td><td><div class="bar" style="width:${(b.mach || b.n) / mxm * 100}%;background:${gcol(b.group)}"></div></td></tr>`).join('')}</tbody></table>` : '<p class="mut">Draw shapes to see group-wise counts.</p>'}`;
  }
  function paintTable() {
    const R = rows(), host = el.querySelector('#ls-tbl'), kd = host.querySelector('input:focus');
    if (kd) return; // never rebuild while typing
    const gc = (r, sd) => { const g = r.g[sd]; return `<td><input data-k="g${r.n}${sd}" data-gap="${r.o.id}:${sd}" type="number" step="any" value="${fu(g.v)}"><small>to ${esc(g.to)}</small></td>`; };
    host.innerHTML = R.length ? `<table><thead><tr><th>S.No</th><th>Object code</th><th>Object name</th><th>Type</th><th>Group / line</th><th>Length (${u()})</th><th>Width (${u()})</th><th>Position X (${u()})</th><th>Position Y (${u()})</th><th>Area (${u()}²)</th><th>Operator direction</th><th>Manpower</th><th>Gap N</th><th>Gap E</th><th>Gap S</th><th>Gap W</th></tr></thead><tbody>${R.map(r => `<tr${overlaps().includes(r.o) ? ' style="background:#ff000018"' : ''}><td>${r.n}</td><td><input data-k="c${r.n}" data-f="code" data-id="${r.o.id}" value="${esc(r.code)}"></td><td><input data-k="n${r.n}" data-f="name" data-id="${r.o.id}" value="${esc(r.name)}"></td><td><select data-f="kind" data-id="${r.o.id}">${KINDS.map(k => `<option ${k === r.kind ? 'selected' : ''}>${k}</option>`).join('')}</select></td><td><input data-k="gr${r.n}" data-f="group" data-id="${r.o.id}" value="${esc(r.o.group)}"></td><td><input data-k="l${r.n}" data-f="w" data-id="${r.o.id}" type="number" step="any" value="${fu(r.len)}"></td><td><input data-k="w${r.n}" data-f="h" data-id="${r.o.id}" type="number" step="any" value="${fu(r.wid)}"></td><td>${fu(r.x)}</td><td>${fu(r.y)}</td><td>${(r.area / (UN[u()] * UN[u()])).toFixed(2)}</td><td>${r.ops.length ? r.ops.map(sd => `<span class="chip x">${sd}</span>`).join(' ') : '—'}</td><td>${r.man}</td>${gc(r, 'N')}${gc(r, 'E')}${gc(r, 'S')}${gc(r, 'W')}</tr>`).join('')}</tbody></table>` : '<p class="mut">The table fills in as you draw.</p>';
  }
  function paintDoc() {
    const h = el.querySelector('#ls-doc'); if (h.querySelector('input:focus,select:focus')) return;
    h.innerHTML = `<div class="row"><div><label class="lb">Paper size (ISO 216)</label><select id="d_paper">${Object.keys(PAPER).map(k => `<option ${k === S.paper ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
      <div><label class="lb">Revision</label><input id="d_rev" value="${esc(S.rev)}" style="max-width:80px"></div>
      <div style="flex:1"><label class="lb">Revision note</label><input id="d_note" value="${esc(S.revNote)}"></div>
      <div><label class="lb">Drawn by</label><input id="d_dr" value="${esc(S.drawn || H.user || '')}"></div>
      <div><label class="lb">Checked by</label><input id="d_ch" value="${esc(S.checked)}"></div>
      <div><label class="lb">Approved by</label><input id="d_ap" value="${esc(S.approved)}"></div></div>
      <div class="row"><button class="btn" data-act="pdf">⬇ Download PDF</button><button class="btn" data-act="xlsx">⬇ Download Excel</button></div>
      <p class="mut" style="margin:0">Each download gets its own reference number. The PDF has the drawing sheet (frame, title block, scale, north arrow) followed by the register, dashboard and revision history. Customer logo is at the top left, reference number at the top right, and format number, revision, page number and “Powered By : KMR Group of Companies” are in the footer of every page.${S.hist.length ? ' Issued: ' + S.hist.slice(-6).map(x => esc(x.ref)).join(', ') + '.' : ''}</p>`;
  }
  function paintStd() {
    const R = [['ISO 128 / ISO 5457 / ISO 7200', 'Technical drawing: line types, sheet size and margins, title block'], ['ISO 216', 'A-series paper sizes'], ['ISO 9001:2015', '7.1.3 infrastructure, 7.5 documented information (reference no., revision, date)'], ['IATF 16949:2016', '7.1.3.1 plant, facility and equipment planning — layout and material flow'], ['VDA 6.3:2016', 'P6 / P4 — production resources and layout; operator station per machine'], ['ISO 45001:2018', '8.1.2 / 6.1.2 — gaps and aisles to each side recorded for safe access'], ['APQP / PPAP', 'Process flow and floor plan evidence']];
    el.querySelector('#ls-std').innerHTML = `<table><thead><tr><th>S.No</th><th>Standard</th><th>Element covered</th></tr></thead><tbody>${R.map((r, i) => `<tr><td>${i + 1}</td><td><b>${r[0]}</b></td><td>${r[1]}</td></tr>`).join('')}</tbody></table><p class="mut" style="margin:6px 0 0">This is an aid to evidence; check clauses against your own copy of each standard.</p>`;
  }

  /* ---------- interaction ---------- */
  function pt(e) { const svg = el.querySelector('#ls-svg'); const m = svg.getScreenCTM().inverse(); const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(m); return { x: q.x, y: q.y }; }
  const byId = id => S.objs.find(o => o.id === id);
  function addObj(x, y, w, h) { const o = { id: 'o' + (S.seq++), code: 'OBJ-' + (S.objs.length + 1), name: '', kind: 'Machine', group: '', x, y, w, h, ops: [] }; clampObj(o); S.objs.push(o); return o; }
  function bindCanvas() {
    const c = el.querySelector('#ls-cv');
    c.addEventListener('pointerdown', e => {
      if (e.target.closest('.pop')) return; const p = pt(e), t = e.target;
      const opg = t.closest('[data-op]'), og = t.closest('[data-o]'), hh = t.dataset.h;
      if (opg) { const [id, i] = opg.dataset.op.split(':'); selOp = { o: id, i: +i }; sel = id; openOpPop(e, byId(id), +i); render(); return; }
      if (tool === 'draw') { drag = { kind: 'draw', x0: snapv(p.x), y0: snapv(p.y), x1: snapv(p.x), y1: snapv(p.y) }; c.setPointerCapture(e.pointerId); return; }
      if (tool === 'op' && og) { snap(); const o = byId(og.dataset.o); o.ops.push('S'); sel = o.id; selOp = { o: o.id, i: o.ops.length - 1 }; persist(); render(); return; }
      if (og && hh) { snap(); const o = byId(og.dataset.o); drag = { kind: 'size', o, h: hh, p0: p, r: { x: o.x, y: o.y, w: o.w, h: o.h } }; c.setPointerCapture(e.pointerId); return; }
      if (og) { const o = byId(og.dataset.o); if (sel !== o.id) { sel = o.id; selOp = null; closePop(); } snap(); drag = { kind: 'move', o, dx: p.x - o.x, dy: p.y - o.y, moved: false }; c.setPointerCapture(e.pointerId); render(); return; }
      sel = null; selOp = null; closePop(); const svg = el.querySelector('#ls-svg'); drag = { kind: 'pan', cx: e.clientX, cy: e.clientY, v0: (vb || curVB()).slice(), k: svg.clientWidth }; c.setPointerCapture(e.pointerId); render();
    });
    c.addEventListener('pointermove', e => {
      if (!drag) return; const p = (drag.kind === 'pan') ? null : pt(e);
      if (drag.kind === 'draw') { drag.x1 = snapv(p.x); drag.y1 = snapv(p.y); paintCanvas(); }
      else if (drag.kind === 'move') { const o = drag.o; o.x = snapv(p.x - drag.dx); o.y = snapv(p.y - drag.dy); clampObj(o); drag.moved = true; paintCanvas(); paintTable(); paintDash(); }
      else if (drag.kind === 'size') { const o = drag.o, r = drag.r, X = snapv(p.x), Y = snapv(p.y), h = drag.h; let x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h; if (h.includes('w')) x0 = Math.min(X, x1 - step()); if (h.includes('e')) x1 = Math.max(X, x0 + step()); if (h.includes('n')) y0 = Math.min(Y, y1 - step()); if (h.includes('s')) y1 = Math.max(Y, y0 + step()); o.x = x0; o.y = y0; o.w = x1 - x0; o.h = y1 - y0; clampObj(o); paintCanvas(); paintTable(); paintDash(); }
      else if (drag.kind === 'pan') { const k = drag.v0[2] / drag.k; vb = [drag.v0[0] - (e.clientX - drag.cx) * k, drag.v0[1] - (e.clientY - drag.cy) * k, drag.v0[2], drag.v0[3]]; paintCanvas(); }
    });
    const end = e => {
      if (!drag) return; const d = drag; drag = null;
      if (d.kind === 'draw') { const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1), w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0); if (w >= step() * 2 && h >= step() * 2) { snap(); const o = addObj(x, y, w, h); sel = o.id; render(); openObjPop(o, true); persist(); return; } render(); return; }
      if (d.kind === 'move' && !d.moved) undo.pop();
      persist(); render();
    };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
    c.addEventListener('dblclick', e => { const og = e.target.closest('[data-o]'); if (og && !e.target.dataset.h) openObjPop(byId(og.dataset.o)); });
    c.addEventListener('wheel', e => { e.preventDefault(); const p = pt(e), f = e.deltaY > 0 ? 1.15 : 1 / 1.15, v = vb || curVB(); vb = [p.x - (p.x - v[0]) * f, p.y - (p.y - v[1]) * f, v[2] * f, v[3] * f]; paintCanvas(); }, { passive: false });
    el.addEventListener('click', onClick); el.addEventListener('change', onChange); el.addEventListener('keydown', onKey);
    document.addEventListener('keydown', e => { if (!el || el.closest('.hide')) return; if (e.target.closest && e.target.closest('input,select,textarea')) return; if (e.key === 'Delete' || e.key === 'Backspace') { delSel(); e.preventDefault(); } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { doUndo(); e.preventDefault(); } if (e.key === 'Escape') { closePop(); tool = 'sel'; render(); } });
  }
  function curVB() { const mx = Math.max(S.L, S.W), pad = mx * 0.07; return [-pad, -pad, S.L + 2 * pad, S.W + 2 * pad]; }
  function delSel() {
    if (selOp) { const o = byId(selOp.o); if (o) { snap(); o.ops.splice(selOp.i, 1); } selOp = null; }
    else if (sel) { snap(); S.objs = S.objs.filter(o => o.id !== sel); sel = null; }
    else return; closePop(); persist(); render();
  }
  function closePop() { if (popEl) { popEl.remove(); popEl = null; } }
  function placePop(e, html) {
    closePop(); const c = el.querySelector('#ls-cv'), r = c.getBoundingClientRect(); popEl = document.createElement('div'); popEl.className = 'pop'; popEl.innerHTML = html;
    c.appendChild(popEl); const x = Math.max(4, Math.min(r.width - popEl.offsetWidth - 4, (e && e.clientX ? e.clientX - r.left : 20) + 12)), y = Math.max(4, Math.min(Math.max(4, r.height - popEl.offsetHeight - 4), (e && e.clientY ? e.clientY - r.top : 20) + 12));
    popEl.style.left = x + 'px'; popEl.style.top = y + 'px'; popEl.addEventListener('pointerdown', ev => ev.stopPropagation());
    const f = popEl.querySelector('input'); if (f) { f.focus(); f.select && f.select(); }
  }
  function openObjPop(o, isNew) {
    const e = (() => { const svg = el.querySelector('#ls-svg'), m = svg.getScreenCTM(); const p = svg.createSVGPoint(); p.x = o.x + o.w; p.y = o.y; const q = p.matrixTransform(m); return { clientX: q.x, clientY: q.y }; })();
    placePop(e, `<h4>${isNew ? 'New object — enter its details' : 'Edit object'}</h4>
      <div class="g2"><div><label class="lb">Object code</label><input id="p_code" value="${esc(o.code)}"></div><div><label class="lb">Object name</label><input id="p_name" value="${esc(o.name)}"></div>
      <div><label class="lb">Group / line</label><input id="p_group" list="ls-gl" value="${esc(o.group)}"><datalist id="ls-gl">${groups().map(g => `<option value="${esc(g)}">`).join('')}</datalist></div>
      <div><label class="lb">Type</label><select id="p_kind">${KINDS.map(k => `<option ${k === o.kind ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
      <div><label class="lb">Length (${u()})</label><input id="p_w" type="number" step="any" value="${fu(o.w)}"></div><div><label class="lb">Width (${u()})</label><input id="p_h" type="number" step="any" value="${fu(o.h)}"></div></div>
      <div class="acts"><button class="btn sm" data-pop="ok" data-id="${o.id}">OK</button><button class="btn o sm" data-pop="op" data-id="${o.id}">+ Operator</button><button class="btn d sm" data-pop="del" data-id="${o.id}">Delete</button></div>`);
    popEl.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); applyPop(o.id); } });
  }
  function openOpPop(e, o, i) {
    placePop(e, `<h4>Operator of ${esc(o.code)} — standing on ${SIDE_NAME[o.ops[i]]}</h4><div class="acts"><button class="btn sm" data-pop="next" data-id="${o.id}" data-i="${i}">Move to next side ▸</button><button class="btn o sm" data-pop="add" data-id="${o.id}">+ New operator</button><button class="btn d sm" data-pop="delop" data-id="${o.id}" data-i="${i}">Delete operator</button></div>`);
  }
  function applyPop(id) {
    const o = byId(id); if (!o || !popEl) return; snap();
    const g = s => popEl.querySelector(s); o.code = g('#p_code').value.trim() || o.code; o.name = g('#p_name').value.trim(); o.group = g('#p_group').value.trim(); o.kind = g('#p_kind').value;
    const w = fromU(g('#p_w').value), h = fromU(g('#p_h').value); if (w > 0) o.w = w; if (h > 0) o.h = h; clampObj(o); closePop(); persist(); render();
  }
  function onClick(e) {
    const t = e.target.closest('button'); if (!t) return; const d = t.dataset;
    if (d.tool) { tool = d.tool; closePop(); render(); return; }
    if (d.pop) {
      const o = byId(d.id);
      if (d.pop === 'ok') return applyPop(d.id);
      if (d.pop === 'del') { sel = d.id; selOp = null; return delSel(); }
      if (d.pop === 'op' || d.pop === 'add') { applyPopSilent(o); snap(); o.ops.push('S'); selOp = { o: o.id, i: o.ops.length - 1 }; persist(); closePop(); render(); return; }
      if (d.pop === 'next') { snap(); o.ops[+d.i] = SIDES[(SIDES.indexOf(o.ops[+d.i]) + 1) % 4]; persist(); closePop(); render(); return; }
      if (d.pop === 'delop') { snap(); o.ops.splice(+d.i, 1); selOp = null; persist(); closePop(); render(); return; }
    }
    if (t.id === 's_apply') return applySetup();
    switch (d.act) {
      case 'del': return delSel();
      case 'undo': return doUndo();
      case 'gaps': showGaps = !showGaps; return render();
      case 'fit': vb = null; return render();
      case 'clear': if (!S.objs.length || confirm('Remove all objects from this sketch?')) { snap(); S.objs = []; sel = selOp = null; persist(); render(); } return;
      case 'dxf': return exportDXF();
      case 'open': return el.querySelector('#ls-open').click();
      case 'nobg': BG = null; return render();
      case 'newsk': snap(); S = fresh(); sel = selOp = null; vb = null; BG = null; undo = []; resetSetup(); persist(); return render();
      case 'delsk': if (S.id && confirm('Delete this sketch from the database?')) { H.store.del(S.id).then(async () => { await refreshList(); S = sketches.length ? S : fresh(); if (sketches.length) await openSketch(sketches[0].id); else { sel = selOp = null; resetSetup(); } render(); H.say('Sketch deleted.', true); }).catch(e => H.say(e.message)); } return;
      case 'jsonout': return download(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }), 'layout-sketch-' + stamp() + '.json');
      case 'jsonin': return el.querySelector('#ls-file').click();
      case 'pdf': return exportPDF();
      case 'xlsx': return exportXLSX();
    }
  }
  function applyPopSilent(o) { if (!popEl || !popEl.querySelector('#p_code')) return; o.code = popEl.querySelector('#p_code').value.trim() || o.code; o.name = popEl.querySelector('#p_name').value.trim(); o.group = popEl.querySelector('#p_group').value.trim(); o.kind = popEl.querySelector('#p_kind').value; }
  function applySetup() {
    const nu = el.querySelector('#s_unit').value; snap(); S.title = el.querySelector('#s_title').value; S.plant = el.querySelector('#s_plant').value; S.shifts = Math.max(1, Math.min(4, parseInt(el.querySelector('#s_sh').value) || 1));
    const wasU = S.unit; S.unit = nu; const L = fromU(el.querySelector('#s_L').value), W = fromU(el.querySelector('#s_W').value);
    if (!(L > 0 && W > 0)) { S.unit = wasU; H.say('Enter a length and a width greater than zero.'); return; }
    S.L = L; S.W = W; S.objs.forEach(clampObj); vb = null; persist(); delete el.querySelector('#ls-setup').dataset.t; render();
    if (S.objs.some(o => o.x + o.w > S.L + EPS || o.y + o.h > S.W + EPS)) H.say('Some objects were pulled inside the new walls.');
  }
  function onChange(e) {
    const t = e.target, d = t.dataset;
    if (t.id === 's_unit') { const L = fromU(el.querySelector('#s_L').value), W = fromU(el.querySelector('#s_W').value); S.unit = t.value; const h = el.querySelector('#ls-setup'); delete h.dataset.t; S.L = L > 0 ? L : S.L; S.W = W > 0 ? W : S.W; /* keeps the typed size in the new unit */ render(); return; }
    if (t.id === 'ls-pick') { if (t.value) openSketch(t.value).catch(e => H.say(e.message)); return; }
    if (t.id === 'ls-open') { const f = t.files[0]; t.value = ''; if (f) openAny(f); return; }
    if (t.id === 'ls-file') { const f = t.files[0]; if (!f) return; f.text().then(x => { try { const j = JSON.parse(x); if (!j.objs) throw 0; snap(); S = Object.assign(fresh(), j); sel = selOp = null; vb = null; const h = el.querySelector('#ls-setup'); delete h.dataset.t; persist(); render(); H.say('Sketch loaded.', true); } catch (er) { H.say('That file is not a layout sketch JSON.'); } }); t.value = ''; return; }
    const set = { d_paper: 'paper', d_rev: 'rev', d_note: 'revNote', d_dr: 'drawn', d_ch: 'checked', d_ap: 'approved' }[t.id]; if (set) { S[set] = t.value; persist(); return; }
    if (d.gap) { const [id, sd] = d.gap.split(':'); const o = byId(id); const ok = setGap(o, sd, fromU(t.value)); if (!ok) H.say('Enter a distance of zero or more.'); render(); return; }
    if (d.f && d.id) { const o = byId(d.id); snap(); if (d.f === 'w' || d.f === 'h') { const v = fromU(t.value); if (v > 0) o[d.f] = v; clampObj(o); } else o[d.f] = t.value.trim(); persist(); render(); }
  }
  function onKey(e) { if (e.key === 'Enter' && e.target.matches('#ls-setup input')) applySetup(); }

  /* ---------- exports ---------- */
  const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); }
  function nextRef() {
    const d = new Date(), ds = d.toISOString().slice(0, 10).replace(/-/g, ''), k = 'kmr-layout-sketch-ref:' + (H.key || 'demo') + ':' + ds; let n = 1;
    try { n = (+localStorage.getItem(k) || 0) + 1; localStorage.setItem(k, n); } catch (e) { n = Math.floor(Math.random() * 900) + 100; }
    return 'LAY-SK-' + ds + '-' + String(n).padStart(3, '0');
  }
  function loadScript(src, test) { return new Promise((ok, no) => { if (test()) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('Could not load ' + src.split('/').pop() + '. Check the internet connection.')); document.head.appendChild(s); }); }
  const dataUrl = src => new Promise(ok => { if (!src) return ok(null); const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { try { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); ok({ url: c.toDataURL('image/png'), w: c.width, h: c.height }); } catch (e) { ok(null); } }; im.onerror = () => ok(null); im.src = src; });
  async function sketchPNG(px, jpg) {
    const mx = Math.max(S.L, S.W), pad = mx * 0.09, V = [-pad, -pad, S.L + 2 * pad, S.W + 2 * pad];
    const svg = buildSVG({ px, vb: V, ppm: px / V[2] / 3.6, gaps: true }), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('The sketch could not be rendered for export.')); i.src = url; });
    const c = document.createElement('canvas'); c.width = px; c.height = Math.round(px * V[3] / V[2]); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
    return { url: jpg ? c.toDataURL('image/jpeg', 0.9) : c.toDataURL('image/png'), w: c.width, h: c.height, V };
  }
  function meta(ref) { return { ref, date: new Date().toISOString().slice(0, 10), company: H.company || '', plant: S.plant, title: S.title }; }
  function logHist(ref, kind) { S.hist.push({ ref, rev: S.rev, date: new Date().toISOString().slice(0, 10), note: S.revNote, by: S.drawn || H.user || '', kind }); persist(); paintDoc(); }
  const cell = (m, d) => (m / UN[u()]).toFixed(d == null ? DEC[u()] : d);

  async function exportPDF() {
    try {
      H.say('Preparing the PDF…', true);
      await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', () => window.jspdf);
      await loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js', () => window.jspdf && window.jspdf.jsPDF.API.autoTable);
      const ref = nextRef(), M = meta(ref), logo = await dataUrl(H.logo && H.logo()), [PW, PH] = PAPER[S.paper], { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [PW, PH] }), ML = 20, MO = 10;
      doc.setProperties({ title: S.title + ' ' + ref, subject: FORMAT.title, author: S.drawn || H.user || '', creator: 'KMR Layout Studio' });
      // sheet 1: drawing
      doc.setLineWidth(0.35); doc.rect(ML, MO, PW - ML - MO, PH - 2 * MO);
      const tbW = Math.min(185, PW - ML - MO - 10), tbH = 46, tx = PW - MO - tbW, ty = PH - MO - tbH;
      doc.setLineWidth(0.5); doc.rect(tx, ty, tbW, tbH); doc.setLineWidth(0.2);
      doc.line(tx, ty + 16, tx + tbW, ty + 16); doc.line(tx + 52, ty, tx + 52, ty + 16); doc.line(tx, ty + 30, tx + tbW, ty + 30);
      for (const x of [tx + 38, tx + 76, tx + 112, tx + 148]) doc.line(x, ty + 30, x, ty + tbH);
      doc.line(tx, ty + 38, tx + tbW, ty + 38);
      if (logo) { const k = Math.min(48 / logo.w, 13 / logo.h); doc.addImage(logo.url, 'PNG', tx + 2, ty + 1.5 + (13 - logo.h * k) / 2, logo.w * k, logo.h * k); } else { doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(doc.splitTextToSize(M.company, 48), tx + 2, ty + 7); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(doc.splitTextToSize(S.title, tbW - 56), tx + 55, ty + 7);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(doc.splitTextToSize(FORMAT.title + (S.plant ? ' · ' + S.plant : '') + ' · inner wall ' + fuu(S.L) + ' × ' + fuu(S.W), tbW - 56), tx + 55, ty + 12);
      const lab = (x, y, a, b, w) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(100); doc.text(a, x + 1.5, y + 3); doc.setTextColor(0); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text(doc.splitTextToSize(String(b), (w || 34) - 3), x + 1.5, y + 7.5); };
      lab(tx, ty + 16, 'Drawing / reference no.', ref, 52); lab(tx + 52, ty + 16, 'Revision', S.rev, 40); lab(tx + 92, ty + 16, 'Date', M.date.split('-').reverse().join('-'), 40); lab(tx + 132, ty + 16, 'Paper', S.paper + ' (ISO 216)', 40);
      doc.line(tx + 52, ty + 16, tx + 52, ty + 30); doc.line(tx + 92, ty + 16, tx + 92, ty + 30); doc.line(tx + 132, ty + 16, tx + 132, ty + 30);
      const png = await sketchPNG(Math.min(4200, Math.round(PW * 8)), true);
      const ax = ML + 4, ay = MO + 4, aw = PW - ML - MO - 8, ah = ty - ay - 4;
      const pxm = png.w / png.V[2]; // image px per metre
      let mmPerM = Math.min(aw / png.V[2], ah / png.V[3]); const denom = 1000 / mmPerM, sc = STD_SCALES.find(s => s >= denom - 1e-9) || STD_SCALES[STD_SCALES.length - 1]; mmPerM = 1000 / sc;
      const iw = png.V[2] * mmPerM, ih = png.V[3] * mmPerM; doc.addImage(png.url, 'JPEG', ax + (aw - iw) / 2, ay + (ah - ih) / 2, iw, ih);
      lab(tx, ty + 30, 'Scale', '1 : ' + sc, 38); lab(tx + 38, ty + 30, 'Unit of figures', UNAME[u()], 38); lab(tx + 76, ty + 30, 'Objects / machines', S.objs.length + ' / ' + stats().mach, 36); lab(tx + 112, ty + 30, 'Manpower / shift', stats().man, 36); lab(tx + 148, ty + 30, 'Sheet', '', 37);
      lab(tx, ty + 38, 'Drawn by', S.drawn || H.user || '—', 38); lab(tx + 38, ty + 38, 'Checked by', S.checked || '—', 38); lab(tx + 76, ty + 38, 'Approved by', S.approved || '—', 36); lab(tx + 112, ty + 38, 'Format no.', FORMAT.no, 36); lab(tx + 148, ty + 38, 'Plant', S.plant || '—', 37);
      doc.setFontSize(6); doc.setTextColor(90); doc.text('Operator stands at the marked side of the object (circle with arrow). Distances in ' + u() + '. ISO 128 · ISO 5457 · ISO 7200 · ISO 9001:2015 7.1.3 · IATF 16949:2016 7.1.3.1 · VDA 6.3 P6', ax, ty - 1.2); doc.setTextColor(0);
      // register
      const R = rows(), HD = [['S.No', 'Object code', 'Object name', 'Type', 'Group / line', 'Length (' + u() + ')', 'Width (' + u() + ')', 'Position X (' + u() + ')', 'Position Y (' + u() + ')', 'Operator direction', 'Manpower', 'Gap N', 'Gap E', 'Gap S', 'Gap W']];
      const body = R.map(r => [r.n, r.code, r.name, r.kind, r.group, cell(r.len), cell(r.wid), cell(r.x), cell(r.y), r.ops.join(', ') || '—', r.man].concat(SIDES.map(sd => cell(r.g[sd].v) + '\nto ' + r.g[sd].to)));
      const common = { margin: { top: 24, left: ML, right: MO, bottom: 14 }, styles: { fontSize: 7, cellPadding: 1.4, lineColor: [150, 150, 150], lineWidth: 0.1 }, headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 7 }, alternateRowStyles: { fillColor: [245, 247, 250] } };
      doc.addPage(); doc.autoTable(Object.assign({ head: HD, body, startY: 24, theme: 'grid' }, common));
      // dashboard
      const st = stats(); doc.addPage();
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Dashboard', ML, 25);
      doc.autoTable(Object.assign({}, common, { startY: 28, theme: 'grid', head: [['S.No', 'Indicator', 'Value']], body: [[1, 'Objects drawn', S.objs.length], [2, 'Machines', st.mach], [3, 'Manpower per shift (operators marked)', st.man], [4, 'Shifts / manpower all shifts', S.shifts + ' / ' + st.man * S.shifts], [5, 'Groups / lines', st.by.length], [6, 'Building area (' + u() + '²)', cell(st.tot / UN[u()], 1)], [7, 'Floor occupied', (st.used / st.tot * 100).toFixed(1) + ' %'], [8, 'Overlapping objects', st.over], [9, 'Smallest gap', fuu(st.minGap)]], tableWidth: 150 }));
      doc.autoTable(Object.assign({}, common, { startY: doc.lastAutoTable.finalY + 8, theme: 'grid', head: [['S.No', 'Group / line', 'Objects', 'Machines', 'Operators', 'Floor area (' + u() + '²)']], body: st.by.map((b, i) => [i + 1, b.group, b.n, b.mach, b.man, (b.area / (UN[u()] * UN[u()])).toFixed(2)]), tableWidth: 200 }));
      doc.autoTable(Object.assign({}, common, { startY: doc.lastAutoTable.finalY + 8, theme: 'grid', head: [['S.No', 'Rev.', 'Date', 'Reference', 'Change / note', 'By']], body: S.hist.concat([{ rev: S.rev, date: M.date, ref, note: S.revNote, by: S.drawn || H.user || '' }]).map((h, i) => [i + 1, h.rev, h.date.split('-').reverse().join('-'), h.ref, h.note, h.by]) }));
      // header/footer on every page
      const n = doc.getNumberOfPages();
      for (let p = 1; p <= n; p++) {
        doc.setPage(p); doc.setTextColor(0);
        if (p > 1) {
          doc.setLineWidth(0.3); doc.rect(ML, MO, PW - ML - MO, PH - 2 * MO);
          if (logo) { const k = Math.min(40 / logo.w, 12 / logo.h); doc.addImage(logo.url, 'PNG', ML + 2, MO + 2, logo.w * k, logo.h * k); } else { doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(M.company, ML + 2, MO + 7); }
          doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(FORMAT.title, PW / 2, MO + 7, { align: 'center' }); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(S.title + (S.plant ? ' · ' + S.plant : ''), PW / 2, MO + 12, { align: 'center' });
          doc.setFontSize(7); doc.text('Reference no.', PW - MO - 2, MO + 4.5, { align: 'right' }); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(ref, PW - MO - 2, MO + 9, { align: 'right' }); doc.line(ML, MO + 15, PW - MO, MO + 15);
        }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(60);
        doc.text(FORMAT.no + ' · Rev ' + S.rev + ' · ' + M.date.split('-').reverse().join('-') + ' · ' + ref, ML, PH - 5.5);
        doc.text('Page ' + p + ' of ' + n, PW / 2, PH - 5.5, { align: 'center' });
        const pt1 = 'Powered By : ', pt2 = 'KMR Group of Companies', w2 = doc.getTextWidth(pt2), w1 = doc.getTextWidth(pt1), x0 = PW - MO - w1 - w2;
        doc.text(pt1, x0, PH - 5.5); doc.setTextColor(37, 99, 235); doc.textWithLink(pt2, x0 + w1, PH - 5.5, { url: 'https://www.kmr-groups.com' }); doc.setTextColor(0);
        if (p === 1) { doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.text('1 of ' + n, tx + 148 + 1.5, ty + 30 + 7.5, { baseline: 'alphabetic' }); }
      }
      logHist(ref, 'pdf'); doc.save(ref + '.pdf'); H.say('PDF ' + ref + ' downloaded.', true);
    } catch (err) { H.say(err.message || String(err)); }
  }

  async function exportXLSX() {
    try {
      H.say('Preparing the Excel file…', true);
      await loadScript('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js', () => window.ExcelJS);
      const ref = nextRef(), M = meta(ref), wb = new ExcelJS.Workbook(), logo = await dataUrl(H.logo && H.logo()), png = await sketchPNG(2400);
      wb.creator = S.drawn || H.user || 'KMR Layout Studio'; wb.created = new Date();
      const PS = { A4: 9, A3: 8, A2: 66, A1: 8, A0: 8 }; const paperCode = PS[S.paper] || 9;
      const hf = `&L&8${FORMAT.no} · Rev ${S.rev} · ${ref}&C&8Page &P of &N&R&8Powered By : KMR Group of Companies`;
      const mkSheet = (name, land) => { const ws = wb.addWorksheet(name, { pageSetup: { paperSize: paperCode, orientation: land ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.79, right: 0.39, top: 0.9, bottom: 0.75, header: 0.3, footer: 0.3 } }, headerFooter: { oddFooter: hf }, views: [{ showGridLines: false }] }); return ws; };
      const thin = { style: 'thin', color: { argb: 'FF94A3B8' } }, box = { top: thin, left: thin, bottom: thin, right: thin };
      const banner = (ws, ncol, title) => {
        ws.mergeCells(1, 1, 3, 2); ws.mergeCells(1, 3, 1, ncol - 2 > 3 ? ncol - 2 : 4); ws.mergeCells(2, 3, 3, ncol - 2 > 3 ? ncol - 2 : 4);
        const c1 = ws.getCell(1, 3); c1.value = FORMAT.title; c1.font = { bold: true, size: 14 }; c1.alignment = { horizontal: 'center', vertical: 'middle' };
        const c2 = ws.getCell(2, 3); c2.value = `${title} · ${S.title}${S.plant ? ' · ' + S.plant : ''} · ${M.company}`; c2.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c2.font = { size: 10 };
        const last = ncol - 1; ws.mergeCells(1, last, 1, ncol); ws.mergeCells(2, last, 3, ncol); ws.getCell(1, last).value = 'Reference no.'; ws.getCell(1, last).font = { size: 8, color: { argb: 'FF64748B' } }; ws.getCell(1, last).alignment = { horizontal: 'right' };
        ws.getCell(2, last).value = ref + '\nRev ' + S.rev + ' · ' + M.date.split('-').reverse().join('-'); ws.getCell(2, last).font = { bold: true, size: 11 }; ws.getCell(2, last).alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
        ws.getRow(1).height = 22; ws.getRow(2).height = 20; ws.getRow(3).height = 20;
        if (logo) { const id = wb.addImage({ base64: logo.url, extension: 'png' }), k = Math.min(150 / logo.w, 58 / logo.h); ws.addImage(id, { tl: { col: 0.1, row: 0.1 }, ext: { width: logo.w * k, height: logo.h * k } }); } else { ws.getCell(1, 1).value = M.company; ws.getCell(1, 1).font = { bold: true, size: 11 }; }
        for (let c = 1; c <= ncol; c++) ws.getCell(3, c).border = { bottom: { style: 'medium' } };
      };
      // register
      const ws = mkSheet('Object register', true), HD = ['S.No', 'Object code', 'Object name', 'Type', 'Group / line', `Length (${u()})`, `Width (${u()})`, `Position X (${u()})`, `Position Y (${u()})`, `Area (${u()}²)`, 'Operator direction', 'Manpower', 'Gap N', 'Gap to N', 'Gap E', 'Gap to E', 'Gap S', 'Gap to S', 'Gap W', 'Gap to W'];
      banner(ws, HD.length, 'Object register'); ws.getCell(4, 1).value = `Inner wall (length x width): ${cell(S.L)} x ${cell(S.W)} ${u()}`; ws.getCell(4, 1).font = { size: 9, italic: true }; const hr = 5; ws.getRow(hr).values = HD;
      ws.getRow(hr).eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = box; }); ws.getRow(hr).height = 30;
      const R = rows(), uu = UN[u()] * UN[u()];
      R.forEach((r, i) => { const row = ws.addRow([r.n, r.code, r.name, r.kind, r.group, +cell(r.len), +cell(r.wid), +cell(r.x), +cell(r.y), +(r.area / uu).toFixed(3), r.ops.join(', ') || '—', r.man, +cell(r.g.N.v), r.g.N.to, +cell(r.g.E.v), r.g.E.to, +cell(r.g.S.v), r.g.S.to, +cell(r.g.W.v), r.g.W.to]); row.eachCell(c => { c.border = box; c.alignment = { vertical: 'middle', wrapText: true }; c.font = { size: 10 }; if (i % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; }); [1, 6, 7, 8, 9, 10, 12, 13, 15, 17, 19].forEach(k => { row.getCell(k).alignment = { horizontal: 'center', vertical: 'middle' }; }); });
      [7, 14, 30, 16, 18, 12, 12, 13, 13, 12, 16, 10, 9, 12, 9, 12, 9, 12, 9, 12].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
      ws.views = [{ state: 'frozen', ySplit: hr, showGridLines: false }]; ws.autoFilter = { from: { row: hr, column: 1 }, to: { row: hr + Math.max(1, R.length), column: HD.length } }; ws.pageSetup.printTitlesRow = `${hr}:${hr}`;
      // dashboard
      const st = stats(), wd = mkSheet('Dashboard', false); banner(wd, 6, 'Dashboard');
      const kv = [['Objects drawn', S.objs.length], ['Machines', st.mach], ['Manpower per shift', st.man], ['Shifts', S.shifts], ['Manpower, all shifts', st.man * S.shifts], ['Groups / lines', st.by.length], [`Building area (${u()}²)`, +cell(st.tot / UN[u()], 1)], ['Floor occupied (%)', +(st.used / st.tot * 100).toFixed(1)], ['Overlapping objects', st.over], ['Smallest gap (' + u() + ')', +cell(st.minGap)]];
      wd.getRow(5).values = ['S.No', 'Indicator', 'Value']; kv.forEach((k, i) => wd.addRow([i + 1, k[0], k[1]]));
      const g0 = 5 + kv.length + 3; wd.getRow(g0).values = ['S.No', 'Group / line', 'Objects', 'Machines', 'Operators', `Floor area (${u()}²)`]; st.by.forEach((b, i) => wd.addRow([i + 1, b.group, b.n, b.mach, b.man, +(b.area / uu).toFixed(2)]));
      [5, g0].forEach(r => wd.getRow(r).eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; c.border = box; c.alignment = { horizontal: 'center' }; }));
      wd.eachRow((row, n) => { if (n >= 6 && !(n === g0)) row.eachCell(c => { if (n > 5 && n !== g0 - 1 && n !== g0 - 2) c.border = box; }); });
      [8, 34, 14, 14, 14, 18].forEach((w, i) => { wd.getColumn(i + 1).width = w; });
      // sketch
      const wk = mkSheet('Layout sketch', true); banner(wk, 12, 'Layout sketch (scale as printed)'); const id = wb.addImage({ base64: png.url, extension: 'png' }); const wpx = 1100; wk.addImage(id, { tl: { col: 0, row: 4 }, ext: { width: wpx, height: wpx * png.h / png.w } });
      wk.getCell(4, 1).value = `Inner wall ${fuu(S.L)} × ${fuu(S.W)} · operator stands at the marked side of each object · distances in ${u()} · paper ${S.paper}`; wk.getCell(4, 1).font = { size: 9, italic: true };
      for (let c = 1; c <= 12; c++) wk.getColumn(c).width = 14;
      // revision
      const wr = mkSheet('Revision history', false); banner(wr, 6, 'Revision history'); wr.getRow(5).values = ['S.No', 'Rev.', 'Date', 'Reference', 'Change / note', 'By'];
      S.hist.concat([{ rev: S.rev, date: M.date, ref, note: S.revNote, by: S.drawn || H.user || '' }]).forEach((h, i) => wr.addRow([i + 1, h.rev, h.date.split('-').reverse().join('-'), h.ref, h.note, h.by]));
      wr.getRow(5).eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; c.border = box; }); [8, 8, 14, 24, 40, 20].forEach((w, i) => { wr.getColumn(i + 1).width = w; });
      wr.eachRow((row, n) => { if (n > 5) row.eachCell(c => { c.border = box; }); });
      const buf = await wb.xlsx.writeBuffer(); logHist(ref, 'xlsx');
      download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), ref + '.xlsx'); H.say('Excel ' + ref + ' downloaded.', true);
    } catch (err) { H.say(err.message || String(err)); }
  }

  /* ---------- CAD file (DXF) save ---------- */
  function exportDXF() {
    try {
      const ref = nextRef(), mm = 1000, mxm = Math.max(S.L, S.W), th = mxm * mm * 0.004, o = [];
      const p = (c, v) => { o.push(String(c)); o.push(String(v)); };
      const X = x => (x * mm).toFixed(1), Y = y => ((S.W - y) * mm).toFixed(1), asc = t => String(t == null ? '' : t).replace(/×/g, 'x').replace(/²/g, '2').replace(/[^\x20-\x7e]/g, '?');
      const LAY = [['WALLS', 7], ['OBJECTS', 5], ['TEXT', 7], ['OPERATORS', 3], ['DIMS', 1], ['GAPS', 4]];
      p(0, 'SECTION'); p(2, 'HEADER'); p(9, '$ACADVER'); p(1, 'AC1009'); p(9, '$INSUNITS'); p(70, 4); p(9, '$MEASUREMENT'); p(70, 1); p(0, 'ENDSEC');
      p(0, 'SECTION'); p(2, 'TABLES'); p(0, 'TABLE'); p(2, 'LTYPE'); p(70, 1); p(0, 'LTYPE'); p(2, 'CONTINUOUS'); p(70, 0); p(3, 'Solid line'); p(72, 65); p(73, 0); p(40, 0); p(0, 'ENDTAB');
      p(0, 'TABLE'); p(2, 'LAYER'); p(70, LAY.length); LAY.forEach(l => { p(0, 'LAYER'); p(2, l[0]); p(70, 0); p(62, l[1]); p(6, 'CONTINUOUS'); }); p(0, 'ENDTAB'); p(0, 'ENDSEC');
      p(0, 'SECTION'); p(2, 'ENTITIES');
      const poly = (layer, pts, closed) => { p(0, 'POLYLINE'); p(8, layer); p(66, 1); p(70, closed ? 1 : 0); pts.forEach(q => { p(0, 'VERTEX'); p(8, layer); p(10, X(q[0])); p(20, Y(q[1])); }); p(0, 'SEQEND'); p(8, layer); };
      const line = (layer, x1, y1, x2, y2) => { p(0, 'LINE'); p(8, layer); p(10, X(x1)); p(20, Y(y1)); p(11, X(x2)); p(21, Y(y2)); };
      const text = (layer, x, y, h, str, rot) => { p(0, 'TEXT'); p(8, layer); p(10, X(x)); p(20, Y(y)); p(40, h.toFixed(1)); p(1, asc(str)); if (rot) p(50, rot); p(72, 1); p(11, X(x)); p(21, Y(y)); p(73, 2); };
      poly('WALLS', [[0, 0], [S.L, 0], [S.L, S.W], [0, S.W]], true);
      for (const a of S.objs) {
        poly('OBJECTS', [[a.x, a.y], [a.x + a.w, a.y], [a.x + a.w, a.y + a.h], [a.x, a.y + a.h]], true);
        const hh = Math.min(th, Math.min(a.w, a.h) * mm * 0.16) / mm, vert = a.h > a.w * 1.35, cx = a.x + a.w / 2, cy = a.y + a.h / 2;
        const ls = [a.code, a.name, fu(a.w) + ' x ' + fu(a.h) + ' ' + u()].filter(Boolean);
        ls.forEach((t, i) => { const off = (i - (ls.length - 1) / 2) * hh * 1.5; if (vert) text('TEXT', cx + off, cy, hh, t, 90); else text('TEXT', cx, cy + off, hh, t, 0); });
        const r0 = Math.min(Math.min(a.w, a.h) * 0.2, mxm * 0.011), rr = Math.max(r0, mxm * 0.004), by = {};
        a.ops.forEach(sd => { (by[sd] = by[sd] || []).push(sd); });
        for (const sd of Object.keys(by)) by[sd].forEach((_, j) => { const q = opPos(a, sd, j, by[sd].length, rr); p(0, 'CIRCLE'); p(8, 'OPERATORS'); p(10, X(q.x)); p(20, Y(q.y)); p(40, (rr * mm).toFixed(1)); line('OPERATORS', q.x, q.y, q.x + q.dx * rr * 1.8, q.y + q.dy * rr * 1.8); });
        const g = gapsOf(a);
        for (const sd of SIDES) {
          const q = g[sd]; if (!(q.v > EPS)) continue; let x1, y1, x2, y2;
          if (sd === 'N' || sd === 'S') { const lo = q.o ? Math.max(a.x, q.o.x) : a.x, hi = q.o ? Math.min(a.x + a.w, q.o.x + q.o.w) : a.x + a.w; x1 = x2 = (lo + hi) / 2; y1 = sd === 'N' ? a.y : a.y + a.h; y2 = sd === 'N' ? a.y - q.v : a.y + a.h + q.v; }
          else { const lo = q.o ? Math.max(a.y, q.o.y) : a.y, hi = q.o ? Math.min(a.y + a.h, q.o.y + q.o.h) : a.y + a.h; y1 = y2 = (lo + hi) / 2; x1 = sd === 'W' ? a.x : a.x + a.w; x2 = sd === 'W' ? a.x - q.v : a.x + a.w + q.v; }
          line('GAPS', x1, y1, x2, y2); text('GAPS', (x1 + x2) / 2, (y1 + y2) / 2 - (sd === 'W' || sd === 'E' ? th * 0.7 / mm : 0), th * 0.7 / mm, fu(q.v), (sd === 'N' || sd === 'S') ? 90 : 0);
        }
      }
      const dy = -mxm * 0.035; line('DIMS', 0, dy, S.L, dy); line('DIMS', 0, dy - th / mm, 0, dy + th / mm); line('DIMS', S.L, dy - th / mm, S.L, dy + th / mm); text('DIMS', S.L / 2, dy - th * 1.4 / mm, th * 1.3 / mm, fuu(S.L), 0);
      line('DIMS', dy, 0, dy, S.W); line('DIMS', dy - th / mm, 0, dy + th / mm, 0); line('DIMS', dy - th / mm, S.W, dy + th / mm, S.W); text('DIMS', dy - th * 1.4 / mm, S.W / 2, th * 1.3 / mm, fuu(S.W), 90);
      const tb = [S.title + (S.plant ? ' - ' + S.plant : ''), (H.company || ''), 'Ref ' + ref + '   Rev ' + S.rev + '   ' + new Date().toISOString().slice(0, 10) + '   Format ' + FORMAT.no, 'Unit of figures: ' + u() + '   Operator = circle with arrow on the side where the operator stands'];
      tb.forEach((t, i) => text('TEXT', S.L / 2, S.W + mxm * 0.05 + i * th * 1.8 / mm, th * 1.2 / mm, t, 0));
      p(0, 'ENDSEC'); p(0, 'EOF');
      logHist(ref, 'dxf'); download(new Blob([o.join('\r\n')], { type: 'application/dxf' }), ref + '.dxf'); H.say('CAD file ' + ref + '.dxf downloaded (millimetres, layers WALLS, OBJECTS, TEXT, OPERATORS, DIMS, GAPS).', true);
    } catch (err) { H.say(err.message || String(err)); }
  }

  /* ---------- open a file from this computer ---------- */
  const UFROM = { 1: 'in', 2: 'ft', 4: 'mm', 5: 'cm', 6: 'm', 10: 'yd' };
  function adopt(objs, L, W, unit, title) {
    snap(); const keepU = unit || S.unit; S = fresh(); S.unit = keepU; S.title = title || 'Opened drawing'; S.L = L; S.W = W; S.objs = objs.map(a => { const x = Object.assign({ id: 'o' + (S.seq++), code: 'OBJ-' + S.seq, name: '', kind: 'Machine', group: '', ops: [] }, a); clampObj(x); return x; });
    sel = selOp = null; vb = null; undo = []; resetSetup(); persist(); render();
  }
  function parseDXF(txt, fname) {
    const L = txt.split(/\r?\n/), pr = []; for (let i = 0; i + 1 < L.length; i += 2) pr.push([parseInt(L[i].trim(), 10), L[i + 1].trim()]);
    let ins = null, sec = '', ents = [], cur = null, lastPoly = null;
    for (let i = 0; i < pr.length; i++) {
      const [c, v] = pr[i];
      if (c === 9 && v === '$INSUNITS' && pr[i + 1] && pr[i + 1][0] === 70) ins = +pr[i + 1][1];
      if (c === 0 && v === 'SECTION' && pr[i + 1]) { sec = pr[i + 1][1]; continue; }
      if (sec !== 'ENTITIES') continue;
      if (c === 0) {
        if (cur) { if (cur.t === 'VERTEX') { if (lastPoly) lastPoly.pts.push([cur.x, cur.y]); } else if (cur.t !== 'SEQEND') ents.push(cur); if (cur.t === 'POLYLINE') lastPoly = cur; }
        cur = { t: v, layer: '', pts: [], flag: 0, x: 0, y: 0, x2: 0, y2: 0, r: 0, s: '', h: 0, a72: 0 }; continue;
      }
      if (!cur) continue;
      if (c === 8) cur.layer = v; else if (c === 70) cur.flag = +v; else if (c === 72) cur.a72 = +v;
      else if (c === 10) { cur.x = +v; if (cur.t === 'LWPOLYLINE') cur.pts.push([+v, 0]); } else if (c === 20) { cur.y = +v; if (cur.t === 'LWPOLYLINE' && cur.pts.length) cur.pts[cur.pts.length - 1][1] = +v; }
      else if (c === 11) cur.x2 = +v; else if (c === 21) cur.y2 = +v; else if (c === 40) cur.r = +v; else if (c === 1) cur.s += v;
    }
    if (cur && cur.t !== 'VERTEX' && cur.t !== 'SEQEND') ents.push(cur);
    // rectangles
    const rects = [];
    for (const e of ents) if ((e.t === 'LWPOLYLINE' || e.t === 'POLYLINE') && e.pts.length >= 4) {
      let pts = e.pts.slice(); if (pts.length === 5 && Math.hypot(pts[0][0] - pts[4][0], pts[0][1] - pts[4][1]) < 1e-6) pts.pop(); if (pts.length !== 4) continue;
      const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), tol = Math.max(x1 - x0, y1 - y0) * 1e-4 + 1e-9;
      if (pts.every(q => (Math.abs(q[0] - x0) < tol || Math.abs(q[0] - x1) < tol) && (Math.abs(q[1] - y0) < tol || Math.abs(q[1] - y1) < tol)) && x1 - x0 > 0 && y1 - y0 > 0) rects.push({ x0, y0, x1, y1, layer: e.layer });
    }
    if (!rects.length) throw new Error('No rectangles were found in this DXF, so there is nothing to turn into objects. Draw machines as closed rectangles (polylines) and save again.');
    const area = r => (r.x1 - r.x0) * (r.y1 - r.y0); rects.sort((a, b) => area(b) - area(a));
    let wall = rects.find(r => /wall/i.test(r.layer)), others;
    if (!wall && rects.length > 1 && area(rects[0]) > 1.5 * area(rects[1])) wall = rects[0];
    if (wall) others = rects.filter(r => r !== wall && !/wall/i.test(r.layer)); else { others = rects; wall = { x0: Math.min.apply(null, rects.map(r => r.x0)), y0: Math.min.apply(null, rects.map(r => r.y0)), x1: Math.max.apply(null, rects.map(r => r.x1)), y1: Math.max.apply(null, rects.map(r => r.y1)) }; }
    const ext = Math.max(wall.x1 - wall.x0, wall.y1 - wall.y0); let unit = UFROM[ins];
    if (!unit) unit = ext > 500 ? 'mm' : 'm';
    const k = UN[unit], objs = others.map(r => ({ x: (r.x0 - wall.x0) * k, y: (wall.y1 - r.y1) * k, w: (r.x1 - r.x0) * k, h: (r.y1 - r.y0) * k, _r: r })).filter(a => a.w * a.h > 1e-6);
    const skip = /^\s*[\d.,\s]+(x|X)?\s*[\d.,\s]*\s*(mm|cm|m|ft|in|yd)?\s*$/;
    const tx = ents.filter(e => (e.t === 'TEXT' || e.t === 'MTEXT') && !/^(DIMS|GAPS)$/i.test(e.layer));
    for (const a of objs) {
      const r = a._r, inside = tx.filter(e => { const px = e.a72 || e.t === 'MTEXT' ? (e.a72 ? e.x2 : e.x) : e.x, py = e.a72 ? e.y2 : e.y; return px >= r.x0 - 1e-6 && px <= r.x1 + 1e-6 && py >= r.y0 - 1e-6 && py <= r.y1 + 1e-6; }).map(e => ({ s: e.s.replace(/\\P/g, ' ').replace(/[{}]/g, '').replace(/\\[A-Za-z][^;]*;/g, '').trim(), y: e.a72 ? e.y2 : e.y, x: e.a72 ? e.x2 : e.x })).filter(e => e.s && !skip.test(e.s));
      inside.sort((p1, p2) => (p2.y - p1.y) || (p1.x - p2.x)); if (inside[0]) a.code = inside[0].s; if (inside[1]) a.name = inside.slice(1).map(e => e.s).join(' '); a.kind = 'Machine'; a.group = ''; a.ops = []; delete a._r;
    }
    for (const e of ents.filter(e => e.t === 'CIRCLE' && /oper/i.test(e.layer))) {
      const cx = (e.x - wall.x0) * k, cy = (wall.y1 - e.y) * k; let best = null, bd = 1e18;
      objs.forEach(a => { const dx = Math.max(a.x - cx, 0, cx - (a.x + a.w)), dy = Math.max(a.y - cy, 0, cy - (a.y + a.h)), d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = a; } });
      if (best) { const dx = cx - (best.x + best.w / 2), dy = cy - (best.y + best.h / 2); best.ops.push(Math.abs(dx / best.w) > Math.abs(dy / best.h) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N')); }
    }
    return { objs, L: (wall.x1 - wall.x0) * k, W: (wall.y1 - wall.y0) * k, unit, title: (fname || '').replace(/\.[^.]+$/, '') };
  }
  async function parseSheet(f) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', () => window.XLSX);
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }); let rows = null, found = null;
    for (const n of wb.SheetNames) {
      const r = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }), hi = r.findIndex(x => x.filter(c => String(c).trim()).length >= 3 && x.some(c => /code|id\b|tag|machine/i.test(c)) && x.some(c => /length|width|size|breadth/i.test(c)));
      if (hi >= 0 && !rows) { rows = r; found = hi; }
    }
    if (!rows) throw new Error('No table with a code/name column and length and width columns was found in this file.');
    const hd = rows[found].map(c => String(c).toLowerCase()), ix = re => hd.findIndex(h => re.test(h));
    const iC = ix(/code|^id\b|tag|machine no/), iN = ix(/name|descr/), iG = ix(/group|line|cell/), iT = ix(/^type|kind/), iL = ix(/^length|^l\b|size.*l/), iW = ix(/^width|breadth|^w\b|depth/), iX = ix(/position x|^x\b|pos.*x/), iY = ix(/position y|^y\b|pos.*y/), iO = ix(/operator/);
    if (iL < 0 || iW < 0) throw new Error('The length and width columns were not found.');
    const um = (hd[iL].match(/\((mm|cm|m|ft|in|yd)\)/) || [])[1] || S.unit, k = UN[um]; let wallTxt = null;
    for (let i = 0; i < found; i++) for (const c of rows[i]) { const m = String(c).match(/inner wall[^0-9]*([\d.]+)\s*[x×]\s*([\d.]+)\s*(mm|cm|m|ft|in|yd)/i); if (m) wallTxt = { L: +m[1] * UN[m[3]], W: +m[2] * UN[m[3]] }; }
    const objs = []; const num = v => parseFloat(String(v).replace(',', '.'));
    for (let i = found + 1; i < rows.length; i++) { const r = rows[i], w = num(r[iL]), h = num(r[iW]); if (!(w > 0 && h > 0)) continue; objs.push({ code: iC >= 0 ? String(r[iC]).trim() : '', name: iN >= 0 ? String(r[iN]).trim() : '', group: iG >= 0 ? String(r[iG]).trim().replace(/^—$/, '') : '', kind: iT >= 0 && KINDS.includes(String(r[iT]).trim()) ? String(r[iT]).trim() : 'Machine', w: w * k, h: h * k, x: iX >= 0 && isFinite(num(r[iX])) ? num(r[iX]) * k : null, y: iY >= 0 && isFinite(num(r[iY])) ? num(r[iY]) * k : null, ops: iO >= 0 ? (String(r[iO]).toUpperCase().match(/[NESW]/g) || []) : [] }); }
    if (!objs.length) throw new Error('The table has no rows with a length and a width.');
    const hasPos = objs.every(a => a.x != null && a.y != null);
    if (!hasPos) { const tot = objs.reduce((s2, a) => s2 + a.w * a.h, 0), rw = wallTxt ? wallTxt.L : Math.max(Math.sqrt(tot * 2.2), Math.max.apply(null, objs.map(a => a.w)) + 1); let x = 0.5, y = 0.5, rh = 0; objs.forEach(a => { if (x + a.w > rw - 0.5) { x = 0.5; y += rh + 0.5; rh = 0; } a.x = x; a.y = y; x += a.w + 0.5; rh = Math.max(rh, a.h); }); }
    const L = wallTxt ? wallTxt.L : Math.max.apply(null, objs.map(a => a.x + a.w)) * 1.08, W = wallTxt ? wallTxt.W : Math.max.apply(null, objs.map(a => a.y + a.h)) * 1.08;
    return { objs, L, W, unit: um, title: f.name.replace(/\.[^.]+$/, ''), note: hasPos ? '' : ' The file had no positions, so the objects were placed in rows; drag them to their places.' };
  }
  async function openAny(f) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    try {
      if (ext === 'json') { const j = JSON.parse(await f.text()); if (!j.objs) throw new Error('That JSON file is not a layout sketch.'); snap(); S = Object.assign(fresh(), j); S.id = null; sel = selOp = null; vb = null; undo = []; resetSetup(); persist(); render(); H.say('Sketch opened as a new sketch.', true); return; }
      if (ext === 'dxf') { const r = parseDXF(await f.text(), f.name); adopt(r.objs, r.L, r.W, r.unit, r.title); H.say(`DXF opened: ${r.objs.length} objects found in a ${fuu(r.L)} × ${fuu(r.W)} building. Check codes, names and operators.`, true); return; }
      if (ext === 'dwg') throw new Error('DWG files cannot be read in the browser. In AutoCAD or KMR CAD use Save As → DXF, then open that DXF here.');
      if (/^(xlsx|xls|csv)$/.test(ext)) { const r = await parseSheet(f); adopt(r.objs, r.L, r.W, r.unit, r.title); H.say(`Table opened: ${r.objs.length} objects.${r.note}`, true); return; }
      if (/^(png|jpe?g|webp|bmp|gif|svg)$/.test(ext)) { const url = await new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => no(new Error('The picture could not be read.')); fr.readAsDataURL(f); }); BG = { url }; render(); H.say('Picture placed behind the floor (stretched to the walls). Draw shapes over it; remove it with the button at the top.', true); return; }
      if (ext === 'pdf') {
        H.say('Reading the PDF…', true); await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js', () => window.pdfjsLib); window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise, pg = await pdf.getPage(1), vp = pg.getViewport({ scale: 2 }), c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
        await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; BG = { url: c.toDataURL('image/jpeg', 0.85) }; render(); H.say('PDF page 1 placed behind the floor (stretched to the walls). Draw shapes over it.', true); return;
      }
      throw new Error('This file type cannot be opened. Use JSON, DXF, Excel, CSV, a picture or a PDF.');
    } catch (err) { H.say(err.message || String(err)); }
  }

  /* ---------- public ---------- */
  window.LayoutSketch = {
    init(o) { H = Object.assign({ say: m => alert(m), logo: null, key: 'demo', user: '', company: '', store: null }, o); el = H.el; S = load(); render(); if (H.store) bootRemote(); },
    show() { if (el) { S.objs.forEach(x => { x.ops = x.ops || []; }); render(); } },
    refresh(o) { Object.assign(H, o || {}); if (el) { render(); } },
    _state: () => S
  };
})();
