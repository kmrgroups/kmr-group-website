/* KMR Office Suite - Presentations, part 2: effects (gradient, shadow, glow, opacity, flip), groups, charts, SmartArt-style diagrams, WordArt,
   picture formatting, video/audio, hyperlinks and actions, selection pane, find and replace, sections, comments, slide master, slide sorter. */
(function () {
  "use strict";
  const O = window.OffUI, { form, esc, IC } = O;
  const add = (n, p) => { if (!IC[n]) IC[n] = p; };
  add("anim", '<path d="M12 3l2.4 5 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 8.8 9.6 8z"/>');
  add("pane", '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16M7 9h4M7 13h4"/>');
  add("chart", '<path d="M4 20V4M4 20h16"/><rect x="7" y="11" width="3" height="6"/><rect x="12" y="7" width="3" height="10"/><rect x="17" y="13" width="2" height="4"/>');
  add("smart", '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/>');
  add("video", '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>');
  add("audio", '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/>');
  add("comment", '<path d="M4 5h16v11H9l-5 4z"/>');
  add("link", '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>');
  add("wordart", '<path d="M4 19L12 4l8 15M7.5 14h9"/>');
  add("gradient", '<defs><linearGradient id="gg"><stop offset="0" stop-color="currentColor"/><stop offset="1" stop-color="transparent"/></linearGradient></defs><rect x="4" y="4" width="16" height="16" rx="2" fill="url(#gg)"/>');
  add("shadow", '<rect x="4" y="4" width="11" height="11" rx="1"/><path d="M18 8v10H8" opacity=".5"/>');
  add("flipH", '<path d="M12 3v18M8 7L3 12l5 5zM16 7l5 5-5 5z"/>');
  add("flipV", '<path d="M3 12h18M7 8l5-5 5 5zM7 16l5 5 5-5z"/>');
  add("crop", '<path d="M6 2v14h14M2 6h14v14"/>');
  add("sort", '<rect x="3" y="4" width="8" height="7"/><rect x="13" y="4" width="8" height="7"/><rect x="3" y="13" width="8" height="7"/><rect x="13" y="13" width="8" height="7"/>');
  add("play", '<path d="M7 4l13 8-13 8z"/>');
  add("eye", '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>');
  add("trash", '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>');
  add("up", '<path d="M12 19V5M6 11l6-6 6 6"/>');
  add("down", '<path d="M12 5v14M6 13l6 6 6-6"/>');

  const PALETTE = ["#2563eb", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#0ea5e9", "#ec4899", "#84cc16"];
  const NS = "http://www.w3.org/2000/svg";

  (window.OffSlideP = window.OffSlideP || []).push(function (P) {
    const { X, D, api, tabs, tc, uid, cl, plain } = P; const th = P.th, sl = P.sl, W = P.W, H = P.H;
    const tab = (id) => tabs.find((t) => t.id === id);
    const objKind = () => { const o = P.one(); return o ? o.t : null; };
    const selOne = () => P.one();
    const say = (m, ok) => api.say(m, ok);
    const anchor = api.rib;
    const colHex = (c) => tc(th(), c, "#2563eb");
    const refresh = () => { P.drawMain(); P.redraw(); };
    const rect = (os) => { let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9; os.forEach((o) => { x1 = Math.min(x1, o.x); y1 = Math.min(y1, o.y); x2 = Math.max(x2, o.x + o.w); y2 = Math.max(y2, o.y + o.h); }); return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }; };
    D.media = D.media || {};

    /* ======================= effects ======================= */
    const gradCss = (g, T) => { const a = colHex(g.c1), b = colHex(g.c2); return g.type === "rad" ? `radial-gradient(circle at center, ${a}, ${b})` : `linear-gradient(${g.ang == null ? 90 : g.ang}deg, ${a}, ${b})`; };
    const WORDART = { grad: "Gradient", outline: "Outline", shadow: "Shadow", neon: "Neon glow", ext3d: "3-D extrude", retro: "Retro stripes", gold: "Gold" };
    function wordartCss(w, T) {
      const ac = tc(T, "@ac", "#2563eb"), ac2 = tc(T, "@ac2", "#f59e0b");
      switch (w) {
        case "grad": return `background:linear-gradient(90deg,${ac},${ac2});-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;`;
        case "outline": return `color:transparent;-webkit-text-fill-color:transparent;-webkit-text-stroke:2px ${ac};`;
        case "shadow": return `text-shadow:4px 4px 0 rgba(0,0,0,.28);`;
        case "neon": return `color:#fff;text-shadow:0 0 6px ${ac},0 0 14px ${ac},0 0 28px ${ac};`;
        case "ext3d": return `text-shadow:1px 1px 0 ${ac},2px 2px 0 ${ac},3px 3px 0 ${ac},4px 4px 0 ${ac},5px 5px 0 ${ac},6px 6px 8px rgba(0,0,0,.4);`;
        case "retro": return `background:repeating-linear-gradient(0deg,${ac} 0 6px,${ac2} 6px 12px);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;`;
        case "gold": return `background:linear-gradient(180deg,#fff3b0,#d4a017 50%,#8a5a00);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;`;
      } return "";
    }
    X.decorate = (o, d, T, live) => {
      const f = o.fx || {};
      if (o.hide) d.style.display = "none";
      if (f.op != null && f.op < 100) d.style.opacity = f.op / 100;
      const fl = []; if (f.sh) fl.push(`drop-shadow(${f.sh.x}px ${f.sh.y}px ${f.sh.b}px ${f.sh.c || "rgba(0,0,0,.4)"})`); if (f.glow) fl.push(`drop-shadow(0 0 ${f.glow.r}px ${colHex(f.glow.c)})`); if (f.soft) fl.push(`blur(${f.soft}px)`);
      if (fl.length) d.style.filter = fl.join(" ");
      if (f.grad && (o.t === "shape" || o.t === "text")) {
        d.style.background = gradCss(f.grad, T);
        d.querySelectorAll(":scope > div[style*='inset:0']").forEach((e) => (e.style.background = "transparent"));
        const k = o.k; if (k === "ellipse" || k === "cloud") d.style.borderRadius = "50%"; else if (k === "rrect") d.style.borderRadius = Math.min(o.w, o.h) * 0.18 + "px";
        else if (k && P.POLY && P.POLY[k]) { d.style.clipPath = "polygon(" + P.POLY[k].split(" ").map((p) => p.split(",").map((v) => v + "%").join(" ")).join(",") + ")"; const pg = d.querySelector("polygon"); if (pg) pg.setAttribute("fill", "none"); }
      }
      if ((f.flipH || f.flipV) && o.t !== "text" && o.t !== "table") { const c = d.firstElementChild; if (c) c.style.transform = `scale(${f.flipH ? -1 : 1},${f.flipV ? -1 : 1})`; }
      if (o.t === "img" && o.px) {
        const p = o.px, im = d.querySelector("img"); if (im) {
          const [ct, cr, cb, cl2] = p.cr || [0, 0, 0, 0], ww = 100 - cl2 - cr, hh = 100 - ct - cb; d.style.overflow = "hidden"; im.style.cssText = `position:absolute;max-width:none;width:${10000 / ww}%;height:${10000 / hh}%;left:${(-cl2 / ww) * 100}%;top:${(-ct / hh) * 100}%;`;
          const fi = []; if (p.br) fi.push(`brightness(${1 + p.br / 100})`); if (p.ct) fi.push(`contrast(${1 + p.ct / 100})`); if (p.gray) fi.push("grayscale(1)"); if (p.sepia) fi.push("sepia(.85)"); if (p.sat != null && p.sat !== 100) fi.push(`saturate(${p.sat / 100})`); if (p.blur) fi.push(`blur(${p.blur}px)`); if (fi.length) im.style.filter = fi.join(" ");
        } if (p.rd) d.style.borderRadius = p.rd === 100 ? "50%" : (Math.min(o.w, o.h) * p.rd) / 200 + "px";
      }
      if (o.wa) { const t = d.querySelector(".pt"); if (t) t.style.cssText += wordartCss(o.wa, T) + "font-weight:700;"; }
      if (o.lnk) { d.dataset.lnk = JSON.stringify(o.lnk); d.title = o.lnk.t === "url" ? o.lnk.v : "Link: " + o.lnk.t; if (live) d.style.outline = "1px dashed rgba(37,99,235,.35)"; }
      if (o.name) d.setAttribute("aria-label", o.name);
    };

    const onSel = (fn) => () => { const os = P.selObjs(); if (!os.length) { say("Click a shape, text box or picture first."); return; } P.mod(() => os.forEach((o) => fn(o))); refresh(); };
    const fxSet = (o, k, v) => { o.fx = Object.assign({}, o.fx); if (v == null) delete o.fx[k]; else o.fx[k] = v; };
    const setGrad = (g) => onSel((o) => { if (!(o.t === "shape" || o.t === "text")) return; fxSet(o, "grad", g); if (g && !o.fill && o.t === "shape") o.fill = "@ac"; })();
    const GRADS = [["Blue → Cyan", "#1d4ed8", "#38bdf8"], ["Orange → Yellow", "#f97316", "#fde047"], ["Green → Lime", "#047857", "#a3e635"], ["Purple → Pink", "#6d28d9", "#f472b6"], ["Dark → Light", "#111827", "#9ca3af"], ["Theme accents", "@ac", "@ac2"]];
    const SHADOWS = [["Soft shadow", { x: 3, y: 4, b: 6, c: "rgba(0,0,0,.35)" }], ["Hard shadow", { x: 5, y: 5, b: 0, c: "rgba(0,0,0,.45)" }], ["Far shadow", { x: 10, y: 12, b: 14, c: "rgba(0,0,0,.3)" }]];

    /* ======================= groups ======================= */
    X.types.group = (o, d, T, live) => {
      const inner = document.createElement("div"); inner.style.cssText = `position:absolute;left:0;top:0;width:${o.ow}px;height:${o.oh}px;transform-origin:0 0;transform:scale(${o.w / o.ow},${o.h / o.oh});pointer-events:none`;
      (o.kids || []).forEach((k) => { const e = P.objEl(k, T, false); e.style.pointerEvents = "none"; inner.append(e); }); d.append(inner);
    };
    function groupSel() {
      const os = P.selObjs(); if (os.length < 2) { say("Select two or more objects first (Shift+click, or drag a box around them)."); return; }
      P.mod(() => { const b = rect(os), s = sl(), order = s.objs.filter((o) => os.includes(o)); const kids = order.map((o) => { const k = cl(o); k.x -= b.x; k.y -= b.y; return k; }); const g = { id: uid(), t: "group", x: b.x, y: b.y, w: b.w, h: b.h, ox: b.w, oy: b.h, ow: b.w, oh: b.h, rot: 0, kids, name: "Group" }; const idx = Math.max(...os.map((o) => s.objs.indexOf(o))); s.objs = s.objs.filter((o) => !os.includes(o)); s.objs.splice(Math.min(idx - os.length + 1, s.objs.length), 0, g); P.setSel([g.id]); }); refresh(); say("Grouped. Move, resize or rotate the group as one. Ungroup to edit the pieces.", true);
    }
    function ungroupSel() {
      const gs = P.selObjs().filter((o) => o.t === "group"); if (!gs.length) { say("Select a group first."); return; } const ids = [];
      P.mod(() => { const s = sl(); gs.forEach((g) => { const i = s.objs.indexOf(g), sx = g.w / g.ow, sy = g.h / g.oh, a = ((g.rot || 0) * Math.PI) / 180, gcx = g.x + g.w / 2, gcy = g.y + g.h / 2; const out = g.kids.map((k) => { const c = cl(k); const w = k.w * sx, h = k.h * sy, cx = g.x + (k.x + k.w / 2) * sx - gcx, cy = g.y + (k.y + k.h / 2) * sy - gcy; const rx = gcx + cx * Math.cos(a) - cy * Math.sin(a), ry = gcy + cx * Math.sin(a) + cy * Math.cos(a); c.w = Math.round(w); c.h = Math.round(h); c.x = Math.round(rx - w / 2); c.y = Math.round(ry - h / 2); c.rot = ((k.rot || 0) + (g.rot || 0)) % 360; c.id = uid(); ids.push(c.id); return c; }); s.objs.splice(i, 1, ...out); }); P.setSel(ids); }); refresh();
    }
    function groupFlat(o) { const sx = o.w / o.ow, sy = o.h / o.oh, a = ((o.rot || 0) * Math.PI) / 180, gcx = o.x + o.w / 2, gcy = o.y + o.h / 2; return (o.kids || []).flatMap((k) => { const c = cl(k), w = k.w * sx, h = k.h * sy, cx = o.x + (k.x + k.w / 2) * sx - gcx, cy = o.y + (k.y + k.h / 2) * sy - gcy; c.w = w; c.h = h; c.x = gcx + cx * Math.cos(a) - cy * Math.sin(a) - w / 2; c.y = gcy + cx * Math.sin(a) + cy * Math.cos(a) - h / 2; c.rot = ((k.rot || 0) + (o.rot || 0)) % 360; return c.t === "group" ? groupFlat(c) : [c]; }); }

    /* ======================= charts ======================= */
    const parseData = (t) => { const rows = String(t).split(/\r?\n/).map((r) => r.split(/\t|,/).map((x) => x.trim())).filter((r) => r.some((x) => x !== "")); if (rows.length < 2) return null; const names = rows[0].slice(1), cats = rows.slice(1).map((r) => r[0]), series = names.map((n, j) => ({ name: n || "Series " + (j + 1), vals: rows.slice(1).map((r) => { const v = parseFloat(String(r[j + 1] || "").replace(/[^0-9.\-eE]/g, "")); return isFinite(v) ? v : 0; }) })); return { cats, series }; };
    const dataText = (c) => ["", ...c.series.map((s) => s.name)].join(", ") + "\n" + c.cats.map((k, i) => [k, ...c.series.map((s) => s.vals[i])].join(", ")).join("\n");
    function chartSvg(c, w, h, T) {
      const fg = tc(T, "@fg", "#1f2937"), cols = c.colors && c.colors.length ? c.colors : [tc(T, "@ac", PALETTE[0]), tc(T, "@ac2", PALETTE[1])].concat(PALETTE.slice(2));
      const ser = c.series || [], cats = c.cats || [], n = cats.length, fs = Math.max(10, Math.round(Math.min(w, h) / 22));
      let s = `<svg xmlns="${NS}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="${tc(T, "@bf", "Calibri")},Arial,sans-serif" font-size="${fs}" fill="${fg}">`;
      const top = c.title ? fs * 2.2 : 10, leg = c.legend !== false && (ser.length > 1 || /pie|doughnut/.test(c.type)) ? fs * 1.8 : 0; if (c.title) s += `<text x="${w / 2}" y="${fs * 1.5}" text-anchor="middle" font-size="${fs * 1.3}" font-weight="700">${esc(c.title)}</text>`;
      const bot = leg ? h - leg : h - 6, num = (v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : +v.toFixed(2));
      if (/pie|doughnut/.test(c.type)) {
        const v = (ser[0] ? ser[0].vals : []).map((x) => Math.max(0, x)), tot = v.reduce((a, b) => a + b, 0) || 1, cx = w / 2, cy = (top + bot) / 2, r = Math.min(w, bot - top) / 2 - fs; let a0 = -Math.PI / 2;
        v.forEach((x, i) => { const a1 = a0 + (x / tot) * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0; const p = (a, rr) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; const ir = c.type === "doughnut" ? r * 0.55 : 0; const [x1, y1] = p(a0, r), [x2, y2] = p(a1, r), [x3, y3] = p(a1, ir), [x4, y4] = p(a0, ir); const full = x / tot > 0.9999; s += full ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${cols[i % cols.length]}"/>` : `<path d="M${x1},${y1} A${r},${r} 0 ${big} 1 ${x2},${y2} ${ir ? `L${x3},${y3} A${ir},${ir} 0 ${big} 0 ${x4},${y4}` : `L${cx},${cy}`} Z" fill="${cols[i % cols.length]}" stroke="#fff" stroke-width="2"/>`; if (c.labels !== false && x / tot > 0.04) { const [lx, ly] = p((a0 + a1) / 2, ir ? (r + ir) / 2 : r * 0.65); s += `<text x="${lx}" y="${ly + fs / 3}" text-anchor="middle" fill="#fff" font-weight="700">${c.pct ? Math.round((x / tot) * 100) + "%" : num(x)}</text>`; } a0 = a1; });
        if (leg) cats.forEach((k, i) => { const x0 = 10 + i * (w - 20) / Math.max(1, n); s += `<rect x="${x0}" y="${h - leg + 4}" width="${fs * 0.8}" height="${fs * 0.8}" fill="${cols[i % cols.length]}"/><text x="${x0 + fs}" y="${h - leg + 4 + fs * 0.8}" font-size="${fs * 0.85}">${esc(String(k).slice(0, 14))}</text>`; });
        return s + "</svg>";
      }
      const horiz = c.type === "bar", stacked = !!c.stacked, all = ser.flatMap((q) => q.vals); let mx = Math.max(0, ...(stacked ? cats.map((_, i) => ser.reduce((a, q) => a + Math.max(0, q.vals[i] || 0), 0)) : all)), mn = Math.min(0, ...all); if (mx === mn) mx = mn + 1;
      const nice = (v) => { const p = Math.pow(10, Math.floor(Math.log10(Math.abs(v) || 1))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }; const step = nice((mx - mn) / 5); mx = Math.ceil(mx / step) * step; mn = Math.floor(mn / step) * step;
      const L = horiz ? fs * 7 : fs * 4, R = 14, T0 = top + 4, B = bot - fs * 1.8, pw = w - L - R, ph = B - T0;
      const val = (v) => (horiz ? L + ((v - mn) / (mx - mn)) * pw : B - ((v - mn) / (mx - mn)) * ph); const ct = (i) => (horiz ? T0 + ((i + 0.5) / n) * ph : L + ((i + 0.5) / n) * pw);
      for (let v = mn; v <= mx + 1e-9; v += step) { const p = val(v); s += horiz ? `<line x1="${p}" y1="${T0}" x2="${p}" y2="${B}" stroke="#d1d5db"/><text x="${p}" y="${B + fs * 1.2}" text-anchor="middle" font-size="${fs * 0.85}">${num(v)}</text>` : `<line x1="${L}" y1="${p}" x2="${L + pw}" y2="${p}" stroke="#d1d5db"/><text x="${L - 6}" y="${p + fs / 3}" text-anchor="end" font-size="${fs * 0.85}">${num(v)}</text>`; }
      cats.forEach((k, i) => { s += horiz ? `<text x="${L - 6}" y="${ct(i) + fs / 3}" text-anchor="end" font-size="${fs * 0.85}">${esc(String(k).slice(0, 16))}</text>` : `<text x="${ct(i)}" y="${B + fs * 1.3}" text-anchor="middle" font-size="${fs * 0.85}">${esc(String(k).slice(0, Math.max(4, Math.floor(pw / n / (fs * 0.55)))))}</text>`; });
      if (c.type === "line" || c.type === "area") {
        ser.forEach((q, j) => { const pts = q.vals.map((v, i) => [ct(i), val(v)]); const col = cols[j % cols.length]; if (c.type === "area") s += `<path d="M${pts[0][0]},${val(0)} ${pts.map((p) => "L" + p.join(",")).join(" ")} L${pts[pts.length - 1][0]},${val(0)} Z" fill="${col}" fill-opacity=".35"/>`; s += `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${col}" stroke-width="3"/>` + pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${col}"/>${c.labels ? `<text x="${p[0]}" y="${p[1] - 8}" text-anchor="middle" font-size="${fs * 0.8}">${num(q.vals[i])}</text>` : ""}`).join(""); });
      } else {
        const gw = (horiz ? ph : pw) / n, bw = stacked ? gw * 0.6 : (gw * 0.7) / Math.max(1, ser.length);
        cats.forEach((_, i) => { let acc = 0; ser.forEach((q, j) => { const v = q.vals[i] || 0, col = cols[j % cols.length]; let a, b; if (stacked) { a = val(acc); b = val(acc + v); acc += v; } else { a = val(0); b = val(v); } const off = stacked ? -bw / 2 : -(bw * ser.length) / 2 + j * bw; const x = Math.min(a, b), len = Math.abs(b - a); s += horiz ? `<rect x="${x}" y="${ct(i) + off}" width="${len}" height="${bw - 1}" fill="${col}"/>` : `<rect x="${ct(i) + off}" y="${x}" width="${bw - 1}" height="${len}" fill="${col}"/>`; if (c.labels) s += horiz ? `<text x="${Math.max(a, b) + 4}" y="${ct(i) + off + bw / 2 + fs / 3}" font-size="${fs * 0.8}">${num(v)}</text>` : `<text x="${ct(i) + off + bw / 2}" y="${Math.min(a, b) - 4}" text-anchor="middle" font-size="${fs * 0.8}">${num(v)}</text>`; }); });
      }
      s += `<line x1="${L}" y1="${T0}" x2="${L}" y2="${B}" stroke="#6b7280"/><line x1="${L}" y1="${B}" x2="${L + pw}" y2="${B}" stroke="#6b7280"/>`;
      if (leg) ser.forEach((q, j) => { const x0 = L + j * Math.min(160, pw / ser.length); s += `<rect x="${x0}" y="${h - leg + 4}" width="${fs * 0.8}" height="${fs * 0.8}" fill="${cols[j % cols.length]}"/><text x="${x0 + fs}" y="${h - leg + 4 + fs * 0.8}" font-size="${fs * 0.85}">${esc(String(q.name).slice(0, 16))}</text>`; });
      return s + "</svg>";
    }
    X.chartSvg = chartSvg;
    X.types.chart = (o, d, T) => { d.innerHTML = `<div style="position:absolute;inset:0;background:${o.fill ? tc(T, o.fill) : "transparent"}">${chartSvg(o.ch, Math.round(o.w), Math.round(o.h), T).replace("<svg ", '<svg style="width:100%;height:100%" ')}</div>`; };
    const CHART_TYPES = [["col", "Column"], ["bar", "Bar"], ["line", "Line"], ["area", "Area"], ["pie", "Pie"], ["doughnut", "Doughnut"]];
    function chartForm(o) {
      const c = o ? o.ch : { type: "col", title: "Quarterly results", legend: true, labels: true, stacked: false, cats: ["Q1", "Q2", "Q3", "Q4"], series: [{ name: "2025", vals: [40, 55, 48, 70] }, { name: "2026", vals: [52, 61, 66, 85] }] };
      form(anchor, o ? "Edit chart" : "Insert chart", [{ k: "type", label: "Chart type", type: "select", opts: CHART_TYPES, value: c.type }, { k: "title", label: "Title", value: c.title || "" }, { k: "data", label: "Data. First row: series names. First column: labels. Separate with commas or tabs. Paste from Excel works.", type: "area", value: dataText(c) }, { k: "stacked", label: "Options", type: "check", ph: "Stack the series", value: !!c.stacked }, { k: "labels", label: " ", type: "check", ph: "Show values on the chart", value: c.labels !== false }, { k: "legend", label: " ", type: "check", ph: "Show legend", value: c.legend !== false }], o ? "Save" : "Insert", (v) => {
        const d2 = parseData(v.data); if (!d2) { say("The data needs a header row and at least one row of values."); return; }
        const ch = { type: v.type, title: v.title, stacked: !!v.stacked, labels: !!v.labels, legend: !!v.legend, cats: d2.cats, series: d2.series, colors: c.colors };
        if (o) { P.mod(() => { o.ch = ch; }); refresh(); } else { const w = Math.round(W() * 0.62), h = Math.round(H() * 0.62); P.addObj({ id: uid(), t: "chart", x: Math.round((W() - w) / 2), y: Math.round((H() - h) / 2), w, h, rot: 0, ch, name: "Chart" }); }
      });
    }

    /* ======================= SmartArt-style diagrams ======================= */
    const SA = [["list", "Vertical list"], ["process", "Basic process"], ["chevron", "Chevron process"], ["cycle", "Cycle"], ["hier", "Hierarchy"], ["pyramid", "Pyramid"], ["matrix", "Matrix (2 × 2)"], ["timeline", "Timeline"], ["venn", "Venn (overlap)"], ["steps", "Step up"]];
    const lineObj = (x1, y1, x2, y2, fill) => ({ id: uid(), t: "shape", k: "arrow", x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.max(2, Math.abs(x2 - x1)), h: Math.max(2, Math.abs(y2 - y1)), rot: 0, flipV: (x2 - x1) * (y2 - y1) < 0, ln: { w: 3, c: fill || "@fg", end: true }, tx: "" });
    function saKids(kind, lines, w, h) {
      const n = Math.max(1, lines.length), kids = [], gap = Math.round(Math.min(w, h) * 0.05), pal = ["@ac", "@ac2", "#10b981", "#8b5cf6", "#ef4444", "#0ea5e9", "#ec4899", "#84cc16"];
      const box = (x, y, bw, bh, t, fill, k, fz) => ({ id: uid(), t: "shape", k: k || "rrect", x: Math.round(x), y: Math.round(y), w: Math.round(bw), h: Math.round(bh), rot: 0, fill, tx: "<p>" + esc(t) + "</p>", st: { sz: fz || Math.max(12, Math.min(28, Math.round(Math.min(bw, bh) / 3.2))), c: "#ffffff", al: "center", va: "middle", b: 1 } });
      const ac = (i) => pal[i % pal.length];
      if (kind === "list") { const bh = (h - gap * (n - 1)) / n; lines.forEach((t, i) => kids.push(box(0, i * (bh + gap), w, bh, t, ac(i)))); }
      else if (kind === "process") { const aw = Math.round(w * 0.05) + 14, bw = (w - aw * (n - 1)) / n, bh = Math.min(h, bw * 0.8); lines.forEach((t, i) => { kids.push(box(i * (bw + aw), (h - bh) / 2, bw, bh, t, ac(i))); if (i < n - 1) kids.push(lineObj(i * (bw + aw) + bw + 3, h / 2, (i + 1) * (bw + aw) - 3, h / 2)); }); }
      else if (kind === "chevron") { const bw = (w + (n - 1) * (h * 0.25)) / n, bh = Math.min(h, bw * 0.7); lines.forEach((t, i) => kids.push(Object.assign(box(i * (bw - h * 0.25 + 4), (h - bh) / 2, bw, bh, t, ac(i), "rarrow"), { st: { sz: Math.max(11, Math.round(bw / 8)), c: "#ffffff", al: "center", va: "middle", b: 1 } }))); }
      else if (kind === "cycle") { const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2, bw = R * 0.62, bh = bw * 0.62, rr = R - bh / 2 - 4; const pts = lines.map((_, i) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [cx + rr * 1.15 * Math.cos(a), cy + rr * Math.sin(a), a]; }); pts.forEach((p, i) => kids.push(box(p[0] - bw / 2, p[1] - bh / 2, bw, bh, lines[i], ac(i), "ellipse"))); if (n > 1) pts.forEach((p, i) => { const q = pts[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len; kids.push(lineObj(p[0] + ux * (bw / 2 + 4), p[1] + uy * (bh / 2 + 4), q[0] - ux * (bw / 2 + 8), q[1] - uy * (bh / 2 + 8))); }); }
      else if (kind === "hier") { const top = lines[0], kidsL = lines.slice(1), bh = h * 0.28; kids.push(box(w / 2 - w * 0.17, 0, w * 0.34, bh, top, "@ac")); const m = Math.max(1, kidsL.length), bw = (w - gap * (m - 1)) / m; kidsL.forEach((t, i) => { const x = i * (bw + gap); kids.push(box(x, h - bh, bw, bh, t, ac(i + 1))); kids.push(lineObj(w / 2, bh, x + bw / 2, h - bh)); }); }
      else if (kind === "pyramid") { const bh = (h - gap * (n - 1)) / n; lines.forEach((t, i) => { const bw = w * ((i + 1) / n); kids.push(box((w - bw) / 2, i * (bh + gap), bw, bh, t, ac(i), i === 0 ? "tri" : "rect")); }); }
      else if (kind === "matrix") { const m = lines.slice(0, 4); const bw = (w - gap) / 2, bh = (h - gap) / 2; m.forEach((t, i) => kids.push(box((i % 2) * (bw + gap), Math.floor(i / 2) * (bh + gap), bw, bh, t, ac(i)))); }
      else if (kind === "timeline") { kids.push({ id: uid(), t: "shape", k: "rect", x: 0, y: Math.round(h / 2 - 3), w: Math.round(w), h: 6, rot: 0, fill: "@fg", tx: "" }); const bw = w / n; lines.forEach((t, i) => { const up = i % 2 === 0, bh = h * 0.36; kids.push(box(i * bw + bw * 0.05, up ? h / 2 - bh - 18 : h / 2 + 18, bw * 0.9, bh, t, ac(i))); kids.push({ id: uid(), t: "shape", k: "ellipse", x: Math.round(i * bw + bw / 2 - 9), y: Math.round(h / 2 - 9), w: 18, h: 18, rot: 0, fill: ac(i), tx: "" }); }); }
      else if (kind === "venn") { const m = Math.min(n, 4), d2 = Math.min(w / (m * 0.6 + 0.4), h) * 0.95, step2 = (w - d2) / Math.max(1, m - 1); lines.slice(0, m).forEach((t, i) => kids.push(Object.assign(box(m === 1 ? (w - d2) / 2 : i * step2, (h - d2) / 2, d2, d2, t, ac(i), "ellipse"), { fx: { op: 60 } }))); }
      else if (kind === "steps") { const bw = w / n, unit = h / n; lines.forEach((t, i) => kids.push(box(i * bw, h - unit * (i + 1), bw - gap / 2, unit * (i + 1), t, ac(i), "rect"))); }
      return kids;
    }
    function saForm(o) {
      const cur = o ? o.sa : { kind: "process", lines: ["Plan", "Do", "Check", "Act"] };
      form(anchor, o ? "Edit diagram" : "Insert SmartArt diagram", [{ k: "kind", label: "Diagram type", type: "select", opts: SA, value: cur.kind }, { k: "lines", label: "One item per line. For a hierarchy, line 1 is the top box.", type: "area", value: cur.lines.join("\n") }], o ? "Save" : "Insert", (v) => {
        const lines = String(v.lines).split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, 12); if (!lines.length) { say("Type at least one item."); return; }
        if (o) { P.mod(() => { o.sa = { kind: v.kind, lines }; o.kids = saKids(v.kind, lines, o.ow, o.oh); }); refresh(); return; }
        const w = Math.round(W() * 0.8), h = Math.round(H() * 0.55); P.addObj({ id: uid(), t: "group", x: Math.round((W() - w) / 2), y: Math.round((H() - h) / 2 + 20), w, h, ox: w, oy: h, ow: w, oh: h, rot: 0, name: "Diagram", sa: { kind: v.kind, lines }, kids: saKids(v.kind, lines, w, h) });
      });
    }

    /* ======================= media (video / audio) ======================= */
    X.types.media = (o, d, T, live) => {
      const src = D.media[o.m]; if (!src) { d.innerHTML = '<div style="background:#111;width:100%;height:100%"></div>'; return; }
      if (X.inShow) { d.innerHTML = o.kind === "audio" ? `<audio src="${src}" ${o.auto ? "autoplay" : ""} ${o.loop ? "loop" : ""} controls style="width:100%;height:100%"></audio>` : `<video src="${src}" ${o.auto ? "autoplay" : ""} ${o.loop ? "loop" : ""} ${o.mute ? "muted" : ""} controls playsinline style="width:100%;height:100%;object-fit:contain;background:#000"></video>`; return; }
      d.innerHTML = `<div style="position:absolute;inset:0;background:${o.kind === "audio" ? "#eef2ff" : "#111"};color:${o.kind === "audio" ? "#3730a3" : "#fff"};display:flex;flex-direction:column;align-items:center;justify-content:center;font:14px Calibri,Arial;border-radius:8px;gap:6px"><svg viewBox="0 0 24 24" width="${Math.min(o.w, o.h) * 0.4}" height="${Math.min(o.w, o.h) * 0.4}" fill="currentColor"><path d="${o.kind === "audio" ? "M4 9v6h4l5 4V5L8 9z" : "M8 5v14l11-7z"}"/></svg><span>${esc(o.name || (o.kind === "audio" ? "Audio" : "Video"))}</span></div>`;
    };
    function pickMedia(kind) {
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = kind === "audio" ? "audio/*" : "video/*"; inp.onchange = () => {
        const f = inp.files[0]; if (!f) return; if (f.size > 30 * 1024 * 1024) { say("That file is " + Math.round(f.size / 1048576) + " MB. Please use a file under 30 MB."); return; }
        const r = new FileReader(); r.onload = () => { const key = "m" + Math.random().toString(36).slice(2, 8); D.media[key] = r.result; const w = kind === "audio" ? 160 : 480, h = kind === "audio" ? 70 : 270; P.addObj({ id: uid(), t: "media", kind, m: key, x: Math.round((W() - w) / 2), y: Math.round((H() - h) / 2), w, h, rot: 0, name: f.name, auto: false }); say((kind === "audio" ? "Audio" : "Video") + " added. It plays in the slide show (it is kept inside the file, but not exported to .pptx).", true); }; r.readAsDataURL(f);
      }; inp.click();
    }

    /* ======================= links / actions ======================= */
    function linkForm() {
      const os = P.selObjs(); if (!os.length) { say("Click the shape, text box or picture that should act as a link first."); return; } const o = os[0], cur = o.lnk || { t: "url", v: "https://" };
      form(anchor, "Link or action", [{ k: "t", label: "When clicked during the slide show", type: "select", opts: [["none", "Do nothing (remove link)"], ["url", "Open a web address"], ["slide", "Go to slide number"], ["next", "Go to the next slide"], ["prev", "Go to the previous slide"], ["first", "Go to the first slide"], ["last", "Go to the last slide"], ["end", "End the show"]], value: o.lnk ? cur.t : "none" }, { k: "v", label: "Web address or slide number", value: cur.v || "" }], "Save", (v) => {
        if (v.t === "url" && !/^https?:\/\//i.test(v.v)) { say("A web address must start with http:// or https://"); return; } if (v.t === "slide" && !(+v.v >= 1 && +v.v <= D.slides.length)) { say("Slide number must be between 1 and " + D.slides.length + "."); return; }
        P.mod(() => os.forEach((x) => { if (v.t === "none") delete x.lnk; else x.lnk = { t: v.t, v: v.v }; })); refresh();
      });
    }

    /* ======================= panes ======================= */
    const pane = document.createElement("div"); pane.className = "pxpane"; pane.style.display = "none"; P.wk.querySelector(".psw").append(pane); let paneKind = null;
    const st = document.createElement("style"); st.textContent = `.pxpane{width:270px;flex:none;background:var(--card,#fff);color:#111;border-left:1px solid #d1d5db;overflow:auto;font:13px Calibri,Arial,sans-serif;padding:8px}.pxpane h4{margin:0 0 8px;font-size:14px;display:flex;justify-content:space-between;align-items:center}.pxpane h4 button{border:0;background:none;cursor:pointer;font-size:16px}
.pxpane .row{display:flex;align-items:center;gap:4px;padding:4px 6px;border:1px solid transparent;border-radius:6px;cursor:pointer}.pxpane .row:hover{background:#f1f5f9}.pxpane .row.on{background:#dbeafe;border-color:#93c5fd}.pxpane .row .nm{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.pxpane .row button{border:0;background:none;cursor:pointer;padding:2px 4px;border-radius:4px;font-size:13px}.pxpane .row button:hover{background:#e2e8f0}.pxpane input[type=text],.pxpane select,.pxpane textarea{width:100%;box-sizing:border-box;padding:5px;border:1px solid #cbd5e1;border-radius:6px;font:inherit;margin:2px 0 6px}.pxpane .btn{padding:5px 10px;border:1px solid #cbd5e1;background:#f8fafc;border-radius:6px;cursor:pointer;font:inherit;margin:2px 4px 2px 0}.pxpane .btn.pri{background:#2563eb;color:#fff;border-color:#2563eb}.pxpane .hint{color:#64748b;font-size:12px;margin:4px 0}
.psec{position:absolute;top:0;left:20px;right:2px;background:#1d4ed8;color:#fff;font:600 10px Calibri,Arial;padding:1px 6px;z-index:3;border-radius:0 0 4px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}.pth .tm{position:relative}.pcm{position:absolute;right:4px;bottom:4px;background:#facc15;color:#422006;font:700 10px Calibri,Arial;border-radius:8px;padding:0 5px;z-index:3}
.psw.sorter .pmid{display:none}.psw.sorter .pth{width:auto;flex:1;display:flex;flex-wrap:wrap;align-content:flex-start;gap:14px;padding:16px;overflow:auto}.psw.sorter .pth .tm{margin:0}.psw.mastermode .pst{outline:3px solid #f59e0b;outline-offset:-3px}`; document.head.append(st);
    const closePane = () => { pane.style.display = "none"; paneKind = null; P.fit(); }; const openPane = (k, fn) => { if (paneKind === k) { closePane(); return; } paneKind = k; pane.style.display = ""; fn(); P.fit(); };
    X.refreshPane = () => { if (paneKind && X.panes && X.panes[paneKind]) X.panes[paneKind](); }; X.panes = {};
    const label = (o) => o.name || ({ text: "Text", shape: "Shape", img: "Picture", table: "Table", group: "Group", chart: "Chart", media: "Media" }[o.t] || "Object") + (o.t === "text" || o.t === "shape" ? (plain(o.tx || "").trim() ? ": " + plain(o.tx).trim().slice(0, 24) : o.t === "shape" ? " (" + (o.k || "rect") + ")" : "") : "");
    X.label = label;
    X.panes.sel = () => {
      const s = sl(), list = s.objs.slice().reverse(); pane.innerHTML = `<h4>Selection pane <button data-x title="Close">✕</button></h4><div class="hint">Click to select. 👁 hides an object. ▲▼ change stacking. Double-click a name to rename.</div>` + (list.length ? list.map((o) => `<div class="row${P.sel.includes(o.id) ? " on" : ""}" data-id="${o.id}"><span class="nm">${esc(label(o))}</span><button data-a="eye" title="Show or hide">${o.hide ? "🚫" : "👁"}</button><button data-a="up" title="Bring forward">▲</button><button data-a="dn" title="Send backward">▼</button></div>`).join("") : '<div class="hint">This slide is empty.</div>');
      pane.querySelector("[data-x]").onclick = closePane;
      pane.querySelectorAll(".row").forEach((r) => { const id = r.dataset.id, o = s.objs.find((q) => q.id === id); r.onclick = (e) => { const b = e.target.closest("button"); if (b) { e.stopPropagation(); if (b.dataset.a === "eye") P.mod(() => (o.hide = !o.hide)); else { const i = s.objs.indexOf(o), j = b.dataset.a === "up" ? i + 1 : i - 1; if (j >= 0 && j < s.objs.length) P.mod(() => { s.objs.splice(i, 1); s.objs.splice(j, 0, o); }); } P.drawMain(); X.panes.sel(); return; } P.setSel([id]); X.panes.sel(); }; r.ondblclick = () => { const nm = r.querySelector(".nm"); const inp = document.createElement("input"); inp.type = "text"; inp.value = o.name || ""; inp.placeholder = label(o); nm.replaceWith(inp); inp.focus(); const done = () => { P.mod(() => { if (inp.value.trim()) o.name = inp.value.trim(); else delete o.name; }); X.panes.sel(); }; inp.onblur = done; inp.onkeydown = (e) => { if (e.key === "Enter") inp.blur(); e.stopPropagation(); }; }; });
    };
    /* find and replace */
    let fr = { q: "", rep: "", cs: false, last: -1 };
    const walkText = (html, fn) => { const d = document.createElement("div"); d.innerHTML = html || ""; const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT); const ns = []; while (w.nextNode()) ns.push(w.currentNode); ns.forEach(fn); return d.innerHTML; };
    const reOf = () => new RegExp(fr.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), fr.cs ? "g" : "gi");
    const targets = () => { const out = []; D.slides.forEach((s, si) => { s.objs.forEach((o) => { if (o.t === "text" || o.t === "shape") out.push({ si, o, get: () => o.tx, set: (v) => (o.tx = v) }); if (o.t === "table") o.rows.forEach((r) => r.forEach((c) => out.push({ si, o, get: () => c.tx, set: (v) => (c.tx = v) }))); }); out.push({ si, o: null, get: () => s.notes, set: (v) => (s.notes = v), plain: true }); }); return out; };
    function findAll(replace) {
      if (!fr.q) return 0; const re = reOf(); let n = 0; targets().forEach((t) => { const cur = t.get() || ""; const txt = t.plain ? cur : plain(cur); const m = txt.match(re); if (!m) return; n += m.length; if (replace) t.set(t.plain ? cur.replace(re, fr.rep) : walkText(cur, (nd) => (nd.nodeValue = nd.nodeValue.replace(re, fr.rep)))); }); return n;
    }
    X.panes.find = () => {
      pane.innerHTML = `<h4>Find and replace <button data-x title="Close">✕</button></h4>Find<input type="text" id="fq" value="${esc(fr.q)}">Replace with<input type="text" id="fr" value="${esc(fr.rep)}"><label><input type="checkbox" id="fc" ${fr.cs ? "checked" : ""}> Match case</label><div style="margin:6px 0"><button class="btn pri" data-a="next">Find next</button><button class="btn" data-a="rep">Replace all</button></div><div class="hint" id="fm">Searches every slide, table and the speaker notes.</div>`;
      pane.querySelector("[data-x]").onclick = closePane; const q = pane.querySelector("#fq"), r = pane.querySelector("#fr"), c = pane.querySelector("#fc"), m = pane.querySelector("#fm"); setTimeout(() => q.focus(), 20);
      const sync = () => { fr.q = q.value; fr.rep = r.value; fr.cs = c.checked; }; [q, r, c].forEach((e) => (e.oninput = sync)); [q, r].forEach((e) => (e.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === "Enter") pane.querySelector("[data-a=next]").click(); }));
      pane.querySelector("[data-a=next]").onclick = () => { sync(); if (!fr.q) return; const re = reOf(), hits = targets().map((t, i) => ({ t, i })).filter(({ t }) => ((t.plain ? t.get() : plain(t.get())) || "").match(re)); if (!hits.length) { m.textContent = "No matches found."; return; } const nx = hits.find((h) => h.i > fr.last) || hits[0]; fr.last = nx.i; P.go(nx.t.si); if (nx.t.o) P.setSel([nx.t.o.id]); m.textContent = hits.length + " place" + (hits.length > 1 ? "s" : "") + " contain this text. Showing slide " + (nx.t.si + 1) + (nx.t.o ? "" : " (speaker notes)") + "."; };
      pane.querySelector("[data-a=rep]").onclick = () => { sync(); if (!fr.q) return; let n = 0; P.mod(() => { n = findAll(true); }); P.drawAll(); m.textContent = n ? "Replaced " + n + "." : "No matches found."; };
    };
    X.panes.cm = () => {
      const s = sl(), list = s.cm || []; pane.innerHTML = `<h4>Comments <button data-x title="Close">✕</button></h4>` + (list.length ? list.map((c) => `<div class="row" style="display:block;cursor:default;${c.res ? "opacity:.55" : ""}"><b>${esc(c.a)}</b> <span class="hint">${esc(new Date(c.d).toLocaleString())}</span><div>${esc(c.t)}</div><button class="btn" data-r="${c.id}">${c.res ? "Reopen" : "Resolve"}</button><button class="btn" data-d="${c.id}">Delete</button></div>`).join("") : '<div class="hint">No comments on this slide.</div>') + `<textarea id="ct" rows="3" placeholder="Write a comment for this slide"></textarea><button class="btn pri" id="ca">Add comment</button>`;
      pane.querySelector("[data-x]").onclick = closePane; const ta = pane.querySelector("#ct"); ta.onkeydown = (e) => e.stopPropagation();
      pane.querySelector("#ca").onclick = () => { if (!ta.value.trim()) return; P.mod(() => { s.cm = (s.cm || []).concat([{ id: uid(), a: (api.user && api.user.name) || "You", t: ta.value.trim(), d: new Date().toISOString() }]); }); P.drawThumbs(); X.panes.cm(); };
      pane.querySelectorAll("[data-r]").forEach((b) => (b.onclick = () => { P.mod(() => { const c = s.cm.find((x) => x.id === b.dataset.r); c.res = !c.res; }); X.panes.cm(); })); pane.querySelectorAll("[data-d]").forEach((b) => (b.onclick = () => { P.mod(() => { s.cm = s.cm.filter((x) => x.id !== b.dataset.d); }); P.drawThumbs(); X.panes.cm(); }));
    };

    /* ======================= sections, thumbnails badges ======================= */
    X.afterThumbs = (thEl) => { thEl.querySelectorAll(".tm").forEach((el) => { const s = D.slides[+el.dataset.i]; if (!s) return; if (s.master) { el.insertAdjacentHTML("afterbegin", '<div class="psec" style="background:#b45309">Slide master</div>'); return; } if (s.sec) el.insertAdjacentHTML("afterbegin", `<div class="psec">${esc(s.sec)}</div>`); const n = (s.cm || []).filter((c) => !c.res).length; if (n) el.insertAdjacentHTML("beforeend", `<div class="pcm" title="${n} open comment(s)">💬 ${n}</div>`); }); };
    function sectionMenu() {
      const s = sl(); return [{ label: "Add a section starting at this slide…", run: () => form(anchor, "Section name", [{ k: "n", label: "Name", value: s.sec || "New section" }], "Save", (v) => { P.mod(() => { s.sec = v.n.trim() || undefined; }); P.drawThumbs(); }) }, { label: "Remove the section from this slide", run: () => { P.mod(() => { delete s.sec; }); P.drawThumbs(); } }, { label: "Delete all slides in this section", run: () => { let i = P.cur; while (i > 0 && !D.slides[i].sec) i--; let j = i + 1; while (j < D.slides.length && !D.slides[j].sec) j++; if (j - i >= D.slides.length) { say("A presentation needs at least one slide."); return; } P.mod(() => { D.slides.splice(i, j - i); }); P.drawAll(); } }];
    }

    /* ======================= master ======================= */
    D.master = D.master || null; let masterSlide = null;
    X.bg = (s, T) => { if (s.master) return tc(T, s.bg, "#fff"); return tc(T, s.bg === "@bg" && D.master && D.master.bg ? D.master.bg : s.bg, "#fff"); };
    X.master = (host, s, T) => {
      if (s.master || s.nomaster || !D.master || !(D.master.objs || []).length) return; const i = D.slides.indexOf(s) - (masterSlide ? 1 : 0), num = i + 1, today = new Date().toLocaleDateString();
      D.master.objs.forEach((o) => { const c = cl(o); if (c.tx) c.tx = c.tx.replace(/\{#\}/g, String(num)).replace(/\{date\}/g, today); const e = P.objEl(c, T, false); e.style.pointerEvents = "none"; e.classList.add("pmo"); host.append(e); });
    };
    function enterMaster() {
      if (masterSlide) return; D.master = D.master || { bg: null, objs: [] }; masterSlide = { id: "master", master: true, layout: "blank", bg: D.master.bg || "@bg", notes: "", trans: "none", objs: D.master.objs }; D.slides.unshift(masterSlide); P.wk.querySelector(".psw").classList.add("mastermode"); P.drawAll(); P.go(0); say("Slide master: anything you add here (logo, footer, slide number, background) appears on every slide. Press “Close master view” when done.", true); rbRedraw();
    }
    function exitMaster() { if (!masterSlide) return; D.master.objs = masterSlide.objs; D.master.bg = masterSlide.bg === "@bg" ? null : masterSlide.bg; const i = D.slides.indexOf(masterSlide); if (i >= 0) D.slides.splice(i, 1); masterSlide = null; P.wk.querySelector(".psw").classList.remove("mastermode"); P.drawAll(); P.go(Math.min(1, D.slides.length - 1) >= 0 ? 0 : 0); rbRedraw(); }
    const rbRedraw = () => P.redraw();
    X.body = (j) => { if (masterSlide) { j.slides = j.slides.filter((s) => !s.master); j.master = { bg: masterSlide.bg === "@bg" ? null : masterSlide.bg, objs: masterSlide.objs }; } return j; };
    const mAdd = (tx, w, h, x, y, al) => P.addObj({ id: uid(), t: "text", x, y, w, h, rot: 0, tx: "<p>" + tx + "</p>", st: { sz: 16, c: "@fg", al: al || "left", va: "middle" }, name: "Master text" });

    /* ======================= flat export ======================= */
    X.flat = async (src) => {
      const j = cl(src); j.media = src.media; if (masterSlide) j.master = { bg: masterSlide.bg === "@bg" ? null : masterSlide.bg, objs: masterSlide.objs }; const mo = (j.master && j.master.objs) || [];
      for (let i = 0; i < j.slides.length; i++) {
        const s = j.slides[i]; if (s.master) continue; const pre = !s.nomaster && mo.length ? mo.map((o) => { const c = cl(o); if (c.tx) c.tx = c.tx.replace(/\{#\}/g, String(i + 1)).replace(/\{date\}/g, new Date().toLocaleDateString()); c.id = uid(); return c; }) : []; if (!s.nomaster && j.master && j.master.bg && s.bg === "@bg") s.bg = j.master.bg;
        const out = []; for (const o of pre.concat(s.objs)) { if (o.hide) continue; if (o.t === "group") groupFlat(o).forEach((k) => out.push(k)); else if (o.t === "chart") { const png = await svgPng(chartSvg(o.ch, Math.round(o.w * 2), Math.round(o.h * 2), j.theme), o.w * 2, o.h * 2); if (png) { const key = "c" + uid(); j.media[key] = png; out.push({ id: o.id, t: "img", m: key, x: o.x, y: o.y, w: o.w, h: o.h, rot: o.rot || 0, alt: o.ch.title || "Chart" }); } } else if (o.t === "media") continue; else out.push(o); }
        s.objs = out;
      } j.slides = j.slides.filter((s) => !s.master); return j;
    };
    const svgPng = (svg, w, h) => new Promise((res) => { const im = new Image(); im.onload = () => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0, w, h); res(c.toDataURL("image/png")); }; im.onerror = () => res(null); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });

    /* ======================= ribbon ======================= */
    const home = tab("home"), ins = tab("insert"), pic = tab("pic");
    home.groups.push({ label: "Arrange more", items: [{ i: "group", label: "Group", t: "Treat the selected objects as one (Ctrl+G)", on: groupSel }, { i: "group", label: "Ungroup", on: ungroupSel }, { i: "pane", label: "Selection pane", t: "List, hide, rename and re-order every object on the slide", on: () => openPane("sel", X.panes.sel) },
      { i: "flipH", label: "Flip horizontal", on: onSel((o) => fxSet(o, "flipH", !(o.fx && o.fx.flipH) || null)) }, { i: "flipV", label: "Flip vertical", on: onSel((o) => fxSet(o, "flipV", !(o.fx && o.fx.flipV) || null)) }, { k: "menu", i: "orient", label: "Rotate", items: () => [["Right 90°", 90], ["Left 90°", -90], ["180°", 180], ["Reset", 0]].map((a) => ({ label: a[0], run: onSel((o) => { o.rot = a[1] === 0 ? 0 : (((o.rot || 0) + a[1]) % 360 + 360) % 360; }) })) }] });
    home.groups.push({ label: "Editing", items: [{ i: "find", label: "Find / replace", t: "Find and replace text on every slide (Ctrl+F)", on: () => openPane("find", X.panes.find) }, { k: "menu", i: "slide", label: "Section", items: sectionMenu }] });
    ins.groups.push({ label: "Illustrations", items: [{ i: "chart", label: "Chart", big: true, t: "Column, bar, line, area, pie or doughnut chart", on: () => (objKind() === "chart" ? chartForm(selOne()) : chartForm(null)) }, { i: "smart", label: "SmartArt", big: true, t: "Process, cycle, hierarchy, pyramid and other diagrams from a list", on: () => (selOne() && selOne().sa ? saForm(selOne()) : saForm(null)) }, { k: "menu", i: "wordart", label: "WordArt", items: () => Object.entries(WORDART).map(([k, n]) => ({ label: n, run: () => { const o = selOne(); if (o && (o.t === "text" || o.t === "shape")) { P.mod(() => (o.wa = k)); refresh(); } else { P.addObj({ id: uid(), t: "text", x: Math.round(W() / 2 - 260), y: Math.round(H() / 2 - 50), w: 520, h: 100, rot: 0, tx: "<p>Your text</p>", wa: k, st: { sz: 60, al: "center", va: "middle", b: 1 } }, true); } } })).concat([{ label: "Remove WordArt style", run: onSel((o) => delete o.wa) }]) }] });
    ins.groups.push({ label: "Media and links", items: [{ i: "video", label: "Video", on: () => pickMedia("video") }, { i: "audio", label: "Audio", on: () => pickMedia("audio") }, { i: "link", label: "Link / action", t: "Make the selected object open a web page or jump to a slide", on: linkForm }, { i: "comment", label: "Comment", on: () => openPane("cm", X.panes.cm) }] });
    const fmt = { id: "fmt", label: "Format", ctx: true, when: () => !!selOne() && objKind() !== "table", groups: [
      { label: "Fill and effects", items: [{ k: "menu", i: "gradient", label: "Gradient fill", big: true, items: () => GRADS.map((g) => ({ label: g[0], run: () => setGrad({ c1: g[1], c2: g[2], ang: 90 }) })).concat([{ label: "Radial: theme accents", run: () => setGrad({ c1: "@ac", c2: "@ac2", type: "rad" }) }, { label: "Remove gradient", run: () => setGrad(null) }]) },
        { k: "menu", i: "shadow", label: "Shadow", items: () => SHADOWS.map((s2) => ({ label: s2[0], run: onSel((o) => fxSet(o, "sh", s2[1])) })).concat([{ label: "No shadow", run: onSel((o) => fxSet(o, "sh", null)) }]) },
        { k: "menu", i: "wordart", label: "Glow", items: () => [["Accent glow", { r: 10, c: "@ac" }], ["Gold glow", { r: 12, c: "#f59e0b" }], ["Soft white glow", { r: 14, c: "#ffffff" }]].map((g) => ({ label: g[0], run: onSel((o) => fxSet(o, "glow", g[1])) })).concat([{ label: "No glow", run: onSel((o) => fxSet(o, "glow", null)) }]) },
        { k: "menu", i: "eye", label: "Transparency", items: () => [0, 20, 40, 60, 80].map((p) => ({ label: p ? p + "% transparent" : "Opaque", run: onSel((o) => fxSet(o, "op", p ? 100 - p : null)) })) }] },
      { label: "Name", items: [{ i: "pane", label: "Alt text and name", on: () => { const o = selOne(); form(anchor, "Name and description", [{ k: "n", label: "Name (shown in the selection pane)", value: o.name || "" }, { k: "a", label: "Description for screen readers", value: o.alt || "" }], "Save", (v) => P.mod(() => { o.name = v.n || undefined; o.alt = v.a || undefined; })); } }] }] };
    tabs.push(fmt);
    const piFx = (patch) => onSel((o) => { if (o.t !== "img") return; o.px = Object.assign({}, o.px, patch); });
    if (pic) {
      pic.groups.push({ label: "Adjust", items: [{ k: "menu", i: "gradient", label: "Brightness", items: () => [-40, -20, 0, 20, 40].map((v) => ({ label: (v > 0 ? "+" : "") + v + "%", run: piFx({ br: v }) })) }, { k: "menu", i: "gradient", label: "Contrast", items: () => [-40, -20, 0, 20, 40].map((v) => ({ label: (v > 0 ? "+" : "") + v + "%", run: piFx({ ct: v }) })) },
        { k: "menu", i: "wordart", label: "Recolour", items: () => [{ label: "None", run: piFx({ gray: 0, sepia: 0, sat: 100 }) }, { label: "Black and white", run: piFx({ gray: 1, sepia: 0 }) }, { label: "Sepia", run: piFx({ sepia: 1, gray: 0 }) }, { label: "Washed out", run: piFx({ sat: 40, gray: 0 }) }, { label: "Vivid", run: piFx({ sat: 180, gray: 0 }) }] }, { i: "crop", label: "Crop", t: "Trim the edges (percent)", on: () => { const o = selOne(), c = (o.px && o.px.cr) || [0, 0, 0, 0]; form(anchor, "Crop picture (percent trimmed from each side)", [{ k: "t", label: "Top", type: "number", value: c[0] }, { k: "r", label: "Right", type: "number", value: c[1] }, { k: "b", label: "Bottom", type: "number", value: c[2] }, { k: "l", label: "Left", type: "number", value: c[3] }], "Crop", (v) => { const a = [v.t, v.r, v.b, v.l].map((x) => Math.max(0, Math.min(80, +x || 0))); if (a[0] + a[2] > 90 || a[1] + a[3] > 90) { say("That removes too much of the picture."); return; } piFx({ cr: a })(); }); } }] },
        { label: "Style", items: [{ k: "menu", i: "rrect", label: "Shape", items: () => [["Square", 0], ["Rounded", 20], ["Very rounded", 50], ["Circle / oval", 100]].map((a) => ({ label: a[0], run: piFx({ rd: a[1] }) })) }, { k: "menu", i: "shadow", label: "Shadow", items: () => SHADOWS.map((s2) => ({ label: s2[0], run: onSel((o) => fxSet(o, "sh", s2[1])) })).concat([{ label: "No shadow", run: onSel((o) => fxSet(o, "sh", null)) }]) }, { i: "link", label: "Link", on: linkForm }, { i: "undo", label: "Reset picture", on: onSel((o) => { delete o.px; }) }] });
    }
    const SMART = { id: "smartc", label: "Diagram", ctx: true, when: () => objKind() === "group" && !!(selOne() && selOne().sa), groups: [{ label: "SmartArt", items: [{ i: "smart", label: "Edit diagram", big: true, on: () => saForm(selOne()) }, { i: "group", label: "Convert to shapes", t: "Ungroup into editable shapes", on: ungroupSel }] }] };
    const CHART = { id: "chartc", label: "Chart", ctx: true, when: () => objKind() === "chart", groups: [{ label: "Chart", items: [{ i: "chart", label: "Edit data", big: true, on: () => chartForm(selOne()) }, { k: "menu", i: "chart", label: "Change type", items: () => CHART_TYPES.map((c) => ({ label: c[1], on: selOne() && selOne().ch.type === c[0], run: onSel((o) => { if (o.ch) o.ch.type = c[0]; }) })) }, { k: "col", i: "fill", t: "First series colour", none: "Theme", get: () => (selOne() && selOne().ch.colors && selOne().ch.colors[0]) || "#2563eb", on: (c) => onSel((o) => { o.ch.colors = (o.ch.colors || []).slice(); o.ch.colors[0] = c; if (!o.ch.colors[1]) o.ch.colors[1] = PALETTE[1]; for (let i = 2; i < 8; i++) if (!o.ch.colors[i]) o.ch.colors[i] = PALETTE[i]; })() }] }] };
    const MEDIA = { id: "mediac", label: "Playback", ctx: true, when: () => objKind() === "media", groups: [{ label: "Options", items: [{ i: "play", label: "Start automatically", on: onSel((o) => (o.auto = !o.auto)), act: () => !!(selOne() && selOne().auto) }, { i: "undo", label: "Loop", on: onSel((o) => (o.loop = !o.loop)), act: () => !!(selOne() && selOne().loop) }, { i: "audio", label: "Mute (video)", on: onSel((o) => (o.mute = !o.mute)), act: () => !!(selOne() && selOne().mute) }] }] };
    tabs.push(SMART, CHART, MEDIA);
    const MASTER = { id: "master", label: "Slide master", ctx: true, when: () => !!masterSlide, groups: [{ label: "Master", items: [{ i: "front", label: "Close master view", big: true, on: exitMaster }] }, { label: "Add to every slide", items: [{ i: "textbox", label: "Footer text", on: () => mAdd("Company name · Confidential", 420, 36, 40, H() - 56) }, { i: "textbox", label: "Slide number", on: () => mAdd("{#}", 80, 36, W() - 120, H() - 56, "right") }, { i: "calendar", label: "Date", on: () => mAdd("{date}", 200, 36, W() / 2 - 100, H() - 56, "center") }, { i: "image", label: "Logo / picture", on: () => document.querySelector(".pxfile") }] }, { label: "Background", items: [{ k: "col", i: "fill", t: "Master background colour", none: "Theme", get: () => colHex(masterSlide && masterSlide.bg), on: (c) => { if (masterSlide) { P.mod(() => (masterSlide.bg = c || "@bg")); P.drawAll(); } } }] }] };
    tabs.push(MASTER);
    const view = { id: "view", label: "View", groups: [{ label: "Master views", items: [{ i: "layout", label: "Slide master", big: true, t: "Edit what appears on every slide: logo, footer, number, background", on: () => (masterSlide ? exitMaster() : enterMaster()), act: () => !!masterSlide }, { i: "sort", label: "Slide sorter", t: "See all slides at once and drag to re-order", on: () => { const w = P.wk.querySelector(".psw"); w.classList.toggle("sorter"); P.fit(); }, act: () => P.wk.querySelector(".psw").classList.contains("sorter") }] }, { label: "Panes", items: [{ i: "pane", label: "Selection pane", on: () => openPane("sel", X.panes.sel) }, { i: "comment", label: "Comments", on: () => openPane("cm", X.panes.cm) }, { i: "find", label: "Find / replace", on: () => openPane("find", X.panes.find) }] }] };
    tabs.splice(tabs.findIndex((t) => t.id === "show") + 1, 0, view);
    /* slide-level master toggle and keyboard shortcuts */
    const design = tab("design"); if (design) design.groups.push({ label: "Master", items: [{ i: "layout", label: "Hide master items on this slide", t: "Do not show the logo/footer from the slide master here", on: () => { P.mod(() => (sl().nomaster = !sl().nomaster)); P.drawAll(); }, act: () => !!sl().nomaster }] });
    P.wk.addEventListener("keydown", (e) => { if (P.editing || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || "")) return; const k = e.key.toLowerCase(); if ((e.ctrlKey || e.metaKey) && !e.shiftKey && k === "g") { e.preventDefault(); groupSel(); } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && k === "g") { e.preventDefault(); ungroupSel(); } else if ((e.ctrlKey || e.metaKey) && k === "f") { e.preventDefault(); openPane("find", X.panes.find); } }, true);
    X.groupSel = groupSel; X.ungroupSel = ungroupSel; X.openPane = openPane; X.closePane = closePane; X.groupFlat = groupFlat;
    /* image add for master: reuse the normal Insert > Picture button */
    MASTER.groups[1].items[3] = { i: "image", label: "Logo / picture", on: () => { const b = P.wk.ownerDocument.querySelector('[data-t="Picture"]'); const any = [...api.rib.querySelectorAll("button")].find((x) => /^Picture/.test(x.textContent.trim()) || /Picture/.test(x.title || "")); if (any) any.click(); else say("Use Insert ▸ Picture while the master view is open."); void b; } };
  });
})();
