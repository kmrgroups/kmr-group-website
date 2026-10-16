/* KMR CAD Draft — DXF import (ASCII, R12 … 2018) and export (R12 ASCII, opens in AutoCAD, LibreCAD, DraftSight, QCAD). */
(function (K) {
  "use strict";
  const G = K.geom, D2R = Math.PI / 180;

  /* ---------- AutoCAD colour index ---------- */
  const ACI = [null, "#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ffffff", "#808080", "#c0c0c0"];
  K.aci = (i) => {
    i = +i; if (i >= 1 && i <= 9) return ACI[i];
    if (i >= 250 && i <= 255) { const g = Math.round(51 + (i - 250) * 40.8); const h = Math.min(255, g).toString(16).padStart(2, "0"); return "#" + h + h + h; }
    if (i >= 10 && i <= 249) {
      const hue = Math.floor((i - 10) / 10) * 15, row = (i - 10) % 10, sat = row % 2 ? 0.5 : 1, val = [1, 1, 0.8, 0.8, 0.6, 0.6, 0.5, 0.5, 0.3, 0.3][row];
      const c = val * sat, x = c * (1 - Math.abs(((hue / 60) % 2) - 1)), m = val - c;
      const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
      return "#" + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
    }
    return "#ffffff";
  };
  /** nearest ACI for an html colour (export) */
  K.toAci = (hex) => {
    if (!hex) return 256; if (hex === "byblock") return 0;
    const h = hex.replace("#", ""), r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    let best = 7, bd = 1e9;
    for (let i = 1; i < 256; i++) { const c = K.aci(i).slice(1), d = (parseInt(c.slice(0, 2), 16) - r) ** 2 + (parseInt(c.slice(2, 4), 16) - g) ** 2 + (parseInt(c.slice(4, 6), 16) - b) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  };

  /* ---------- reader ---------- */
  K.readDXF = (text) => {
    const L = text.replace(/\r/g, "").split("\n"), P = [];
    for (let i = 0; i + 1 < L.length; i += 2) P.push([parseInt(L[i].trim(), 10), L[i + 1].replace(/\s+$/, "")]);
    const doc = K.newDoc(false), warn = {}; let i = 0; doc.pdmode = 0;
    const W = (k) => (warn[k] = (warn[k] || 0) + 1);
    const grab = () => { const g = {}; g.list = []; i++; while (i < P.length && P[i][0] !== 0) { const [c, v] = P[i]; g.list.push([c, v]); if (g[c] === undefined) g[c] = v; i++; } return g; };
    const n = (g, c, d = 0) => (g[c] === undefined ? d : parseFloat(g[c]));
    const all = (g, c) => g.list.filter((x) => x[0] === c).map((x) => parseFloat(x[1]));
    const common = (g, e) => {
      e.layer = g[8] !== undefined ? String(g[8]) : "0";
      if (g[420] !== undefined) e.color = "#" + (parseInt(g[420], 10) & 0xffffff).toString(16).padStart(6, "0");
      else if (g[62] !== undefined) { const c = Math.abs(parseInt(g[62], 10)); e.color = c === 256 ? null : c === 0 ? "byblock" : K.aci(c); }
      if (g[6] !== undefined && !/^bylayer$/i.test(g[6])) e.lt = String(g[6]).toUpperCase();
      if (g[370] !== undefined && +g[370] >= 0) e.lw = +g[370] / 100;
      return e;
    };
    const mtextClean = (s) => s.replace(/\\U\+([0-9A-Fa-f]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\S([^;^#/]*)[\^#/]([^;]*);/g, "$1/$2").replace(/\\P/g, "\n").replace(/\\[ACcFfHhQqTtWwpXx][^;]*;/g, "").replace(/\\[LlOoKk]/g, "").replace(/[{}]/g, "").replace(/\\~/g, " ").replace(/%%[cC]/g, "Ø").replace(/%%[dD]/g, "°").replace(/%%[pP]/g, "±");
    const txtClean = (s) => String(s).replace(/\\U\+([0-9A-Fa-f]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/%%[cC]/g, "Ø").replace(/%%[dD]/g, "°").replace(/%%[pP]/g, "±").replace(/%%[uUoO]/g, "");
    const ents = (dest) => {
      let lastIns = null;
      while (i < P.length) {
        const [c, v] = P[i]; if (c !== 0) { i++; continue; }
        if (v === "ENDSEC" || v === "ENDBLK") return;
        if (v === "POLYLINE") {
          const g = grab(), fl = parseInt(g[70] || 0, 10), pts = [];
          while (i < P.length && P[i][1] === "VERTEX") { const vg = grab(); if (parseInt(vg[70] || 0, 10) & 16) continue; pts.push([n(vg, 10), n(vg, 20), n(vg, 42)]); }
          if (i < P.length && P[i][1] === "SEQEND") grab();
          if (fl & (16 | 64)) { W("3D mesh"); continue; }
          if (pts.length > 1) dest.push(common(g, { t: "pline", pts, closed: !!(fl & 1) }));
          continue;
        }
        const g = grab(); let e = null;
        switch (v) {
          case "LINE": e = { t: "line", a: [n(g, 10), n(g, 20)], b: [n(g, 11), n(g, 21)] }; break;
          case "CIRCLE": e = { t: "circle", c: [n(g, 10), n(g, 20)], r: n(g, 40) }; break;
          case "ARC": e = { t: "arc", c: [n(g, 10), n(g, 20)], r: n(g, 40), a0: n(g, 50) * D2R, a1: n(g, 51) * D2R }; break;
          case "POINT": e = { t: "point", p: [n(g, 10), n(g, 20)] }; break;
          case "LWPOLYLINE": {
            const pts = []; let cur = null;
            for (const [cc, vv] of g.list) { if (cc === 10) { cur = [parseFloat(vv), 0, 0]; pts.push(cur); } else if (cc === 20 && cur) cur[1] = parseFloat(vv); else if (cc === 42 && cur) cur[2] = parseFloat(vv); }
            if (pts.length > 1) e = { t: "pline", pts, closed: !!(parseInt(g[70] || 0, 10) & 1) };
            break;
          }
          case "SOLID": case "TRACE": case "3DFACE": {
            const q = [[n(g, 10), n(g, 20)], [n(g, 11), n(g, 21)], [n(g, 13), n(g, 23)], [n(g, 12), n(g, 22)]];
            if (v === "3DFACE") { e = { t: "pline", pts: q.map((p) => [p[0], p[1], 0]), closed: true }; break; }
            e = { t: "hatch", loops: [q], solid: true, pat: "SOLID", ang: 0, sc: 1 }; break;
          }
          case "ATTDEF": { const h = n(g, 40, 2.5), ha = parseInt(g[72] || 0, 10), al = ha && g[11] !== undefined; e = { t: "attdef", p: al ? [n(g, 11), n(g, 21)] : [n(g, 10), n(g, 20)], h, tag: String(g[2] || "TAG"), prompt: txtClean(g[3] || ""), def: txtClean(g[1] || ""), rot: n(g, 50) * D2R, ha: ha > 2 ? 1 : ha, va: 0 }; if (parseInt(g[70] || 0, 10) & 1) e.inv = true; break; }
          case "TEXT": {
            const h = n(g, 40, 2.5), ha = parseInt(g[72] || 0, 10), va = parseInt(g[73] || 0, 10), al = (ha || va) && g[11] !== undefined;
            e = { t: "text", p: al ? [n(g, 11), n(g, 21)] : [n(g, 10), n(g, 20)], h, s: txtClean(g[1] || ""), rot: n(g, 50) * D2R, ha: ha > 2 ? 1 : ha, va };
            break;
          }
          case "ATTRIB": {
            const tag = String(g[2] || ""), blk = lastIns && doc.blocks[lastIns.name];
            if (lastIns && tag && blk && blk.ents.some((s) => s.t === "attdef" && s.tag === tag)) { lastIns.attrs = Object.assign(lastIns.attrs || {}, { [tag]: txtClean(g[1] || "") }); break; }
            const h = n(g, 40, 2.5); e = { t: "text", p: [n(g, 10), n(g, 20)], h, s: txtClean(g[1] || ""), rot: n(g, 50) * D2R, ha: 0, va: 0 }; break; }
          case "MTEXT": {
            let s = g.list.filter((x) => x[0] === 3).map((x) => x[1]).join("") + (g[1] || "");
            const ap = parseInt(g[71] || 1, 10), rot = g[50] !== undefined ? n(g, 50) * D2R : g[11] !== undefined ? Math.atan2(n(g, 21), n(g, 11)) : 0;
            e = { t: "mtext", p: [n(g, 10), n(g, 20)], h: n(g, 40, 2.5), s: mtextClean(s), w: n(g, 41, 0), rot, ap: ap || 1 };
            break;
          }
          case "INSERT": {
            e = { t: "insert", name: String(g[2]), p: [n(g, 10), n(g, 20)], sx: n(g, 41, 1), sy: n(g, 42, 1), rot: n(g, 50) * D2R };
            const cols = parseInt(g[70] || 1, 10), rows = parseInt(g[71] || 1, 10);
            if (cols > 1 || rows > 1) { e.cols = cols; e.rows = rows; e.dc = n(g, 44); e.dr = n(g, 45); }
            break;
          }
          case "DIMENSION": if (g[2]) e = { t: "insert", name: String(g[2]), p: [0, 0], sx: 1, sy: 1, rot: 0, dimblock: true }; break;
          case "ELLIPSE": {
            const c = [n(g, 10), n(g, 20)], mx = n(g, 11), my = n(g, 21), ratio = n(g, 40, 1), rx = Math.hypot(mx, my), a0 = n(g, 41, 0), a1 = n(g, 42, Math.PI * 2);
            e = { t: "ellipse", c, rx, ry: rx * ratio, rot: Math.atan2(my, mx) };
            if (Math.abs(a1 - a0 - Math.PI * 2) > 1e-6) { e.a0 = a0; e.a1 = a1; }
            break;
          }
          case "SPLINE": {
            const xs = all(g, 10), ys = all(g, 20), fx = all(g, 11), fy = all(g, 21), knots = all(g, 40), deg = parseInt(g[71] || 3, 10), closed = !!(parseInt(g[70] || 0, 10) & 1);
            if (xs.length && knots.length) e = { t: "spline", ctrl: xs.map((x, k) => [x, ys[k]]), knots, deg, pts: xs.map((x, k) => [x, ys[k]]), closed };
            else if (fx.length) e = { t: "spline", pts: fx.map((x, k) => [x, fy[k]]), closed };
            break;
          }
          case "LEADER": { const xs = all(g, 10), ys = all(g, 20); if (xs.length > 1) e = { t: "leader", pts: xs.map((x, k) => [x, ys[k]]), s: "" }; break; }
          case "HATCH": e = readHatch(g); break;
          case "VIEWPORT": if (parseInt(g[69] || 0, 10) > 1 && n(g, 41) > 0 && n(g, 45) > 0) { const c = [n(g, 10), n(g, 20)], w = n(g, 40), h = n(g, 41); e = { t: "vport", p0: [c[0] - w / 2, c[1] - h / 2], p1: [c[0] + w / 2, c[1] + h / 2], cx: n(g, 12), cy: n(g, 22), sc: h / n(g, 45) }; } break;
          case "ATTRIB_END": case "SEQEND": break;
          default: W(v);
        }
        if (e) { (dest === doc.ents && parseInt(g[67] || 0, 10) === 1 ? (doc._paper = doc._paper || []) : dest).push(common(g, e)); if (e.t === "insert") lastIns = e; else if (v !== "ATTRIB") lastIns = null; }
      }
    };
    const readHatch = (g) => {
      const L2 = g.list, loops = []; let k = 0;
      const solid = parseInt(g[70] || 0, 10) === 1, pat = String(g[2] || "ANSI31").toUpperCase();
      while (k < L2.length && L2[k][0] !== 91) k++;
      const nl = k < L2.length ? parseInt(L2[k][1], 10) : 0; k++;
      for (let l = 0; l < nl && k < L2.length; l++) {
        while (k < L2.length && L2[k][0] !== 92) k++; if (k >= L2.length) break;
        const ty = parseInt(L2[k][1], 10); k++; const pts = [];
        const val = (code) => { while (k < L2.length && L2[k][0] !== code) k++; return k < L2.length ? parseFloat(L2[k++][1]) : 0; };
        if (ty & 2) {
          val(72); val(73); const nv = val(93), hasB = true;
          for (let v = 0; v < nv; v++) {
            const x = val(10), y = val(20); let b = 0;
            if (k < L2.length && L2[k][0] === 42) { b = parseFloat(L2[k][1]); k++; }
            pts.push([x, y, b]); void hasB;
          }
          const pl = { t: "pline", pts, closed: true }; loops.push(G.outline(pl) || pts.map((p) => [p[0], p[1]]));
        } else {
          const ne = val(93);
          for (let ed = 0; ed < ne; ed++) {
            const et = val(72);
            if (et === 1) { const a = [val(10), val(20)], b = [val(11), val(21)]; pts.push(a, b); }
            else if (et === 2) { const c = [val(10), val(20)], r = val(40); let a0 = val(50) * D2R, a1 = val(51) * D2R; const ccw = val(73); let ap = G.arcPoints(c, r, ccw ? a0 : -a0, ccw ? a1 : -a1); if (!ccw) ap = ap.map((p) => [p[0], 2 * c[1] - p[1]]); void a0; void a1; pts.push(...ap); }
            else if (et === 3) { const c = [val(10), val(20)], m = [val(11), val(21)], ratio = val(40), a0 = val(50) * D2R, a1 = val(51) * D2R; val(73); const rx = Math.hypot(m[0], m[1]); pts.push(...G.ellipsePoints({ c, rx, ry: rx * ratio, rot: Math.atan2(m[1], m[0]), a0, a1 }, 48)); }
            else if (et === 4) { val(94); const nk = val(95), nc = val(96); for (let q = 0; q < nk; q++) val(40); for (let q = 0; q < nc; q++) pts.push([val(10), val(20)]); }
          }
          const clean = []; for (const p of pts) if (!clean.length || !G.eq(clean[clean.length - 1], p, 1e-6)) clean.push(p);
          if (clean.length > 2) loops.push(clean);
        }
        const nb = (() => { while (k < L2.length && L2[k][0] !== 97 && L2[k][0] !== 92 && L2[k][0] !== 75) k++; return k < L2.length && L2[k][0] === 97 ? parseInt(L2[k++][1], 10) : 0; })();
        for (let b = 0; b < nb; b++) val(330);
      }
      if (!loops.length) return null;
      const angv = L2.find((x) => x[0] === 52), scv = L2.find((x) => x[0] === 41);
      return { t: "hatch", loops, solid, pat: solid ? "SOLID" : pat, ang: angv ? parseFloat(angv[1]) * D2R : 0, sc: scv ? parseFloat(scv[1]) : 1 };
    };
    while (i < P.length) {
      if (P[i][0] === 0 && P[i][1] === "SECTION") {
        i++; const name = P[i] && P[i][1]; i++;
        if (name === "HEADER") {
          while (i < P.length && !(P[i][0] === 0 && P[i][1] === "ENDSEC")) {
            if (P[i][0] === 9 && P[i][1] === "$INSUNITS" && P[i + 1]) doc.units = { 1: "in", 2: "ft", 4: "mm", 5: "cm", 6: "m" }[parseInt(P[i + 1][1], 10)] || doc.units;
            if (P[i][0] === 9 && P[i][1] === "$LTSCALE" && P[i + 1]) doc.ltscale = parseFloat(P[i + 1][1]) || 1;
            if (P[i][0] === 9 && P[i][1] === "$PDMODE" && P[i + 1]) doc.pdmode = parseInt(P[i + 1][1], 10) || 0;
            if (P[i][0] === 9 && P[i][1] === "$PDSIZE" && P[i + 1]) doc.pdsize = parseFloat(P[i + 1][1]) || 0;
            i++;
          }
        } else if (name === "TABLES") {
          while (i < P.length && !(P[i][0] === 0 && P[i][1] === "ENDSEC")) {
            if (P[i][0] === 0 && P[i][1] === "LAYER") {
              const g = grab(); if (g[2] === undefined) continue;
              const nm = String(g[2]), col = parseInt(g[62] || 7, 10), fl = parseInt(g[70] || 0, 10);
              const lay = { name: nm, color: g[420] !== undefined ? "#" + (parseInt(g[420], 10) & 0xffffff).toString(16).padStart(6, "0") : K.aci(Math.abs(col) || 7), lt: String(g[6] || "CONTINUOUS").toUpperCase(), lw: g[370] !== undefined && +g[370] >= 0 ? +g[370] / 100 : 0.25, on: col >= 0, frozen: !!(fl & 1), lock: !!(fl & 4) };
              const ex = doc.layers.find((l) => l.name === nm); if (ex) Object.assign(ex, lay); else doc.layers.push(lay);
            } else i++;
          }
        } else if (name === "BLOCKS") {
          while (i < P.length && !(P[i][0] === 0 && P[i][1] === "ENDSEC")) {
            if (P[i][0] === 0 && P[i][1] === "BLOCK") {
              const g = grab(), nm = String(g[2] || g[3] || "B"), blk = { base: [n(g, 10), n(g, 20)], ents: [] };
              ents(blk.ents); if (i < P.length && P[i][1] === "ENDBLK") grab();
              if (!/^\*(model|paper)_space/i.test(nm)) doc.blocks[nm] = blk;
            } else i++;
          }
        } else if (name === "ENTITIES") { ents(doc.ents); }
        else { while (i < P.length && !(P[i][0] === 0 && P[i][1] === "ENDSEC")) i++; }
      } else i++;
    }
    for (const e of doc.ents) if (!doc.layers.find((l) => l.name === e.layer)) doc.layers.push({ name: e.layer, color: "#ffffff", lt: "CONTINUOUS", lw: 0.25, on: true, frozen: false, lock: false });
    for (const b of Object.values(doc.blocks)) for (const e of b.ents) if (!doc.layers.find((l) => l.name === e.layer)) doc.layers.push({ name: e.layer, color: "#ffffff", lt: "CONTINUOUS", lw: 0.25, on: true, frozen: false, lock: false });
    doc.ents.forEach((e) => (e.id = K.uid()));
    if (doc._paper && doc._paper.length) {
      const P = doc._paper; delete doc._paper; P.forEach((e) => (e.id = K.uid()));
      const b = K.extents(Object.assign({}, doc, { ents: P }), P) || { x0: 0, y0: 0, x1: 420, y1: 297 }, w = b.x1 - b.x0, h = b.y1 - b.y0, land = w >= h;
      const paper = (K.PAPER ? Object.entries(K.PAPER).filter(([k]) => k[0] === "A").sort((a, c) => a[1][0] - c[1][0]).find(([, s]) => Math.max(...s) >= Math.max(w, h) - 1 && Math.min(...s) >= Math.min(w, h) - 1) : null) || ["A0"];
      doc.layouts = [{ id: K.uid(), name: "Layout1", paper: paper[0], orient: land ? "landscape" : "portrait", ps: "mono", ents: P }];
    }
    return { doc, warn };
  };

  /* ---------- writer (R12) ---------- */
  K.writeDXF = (doc) => {
    const isInt = (c) => (c >= 60 && c <= 99) || (c >= 160 && c <= 179) || (c >= 270 && c <= 299) || (c >= 370 && c <= 389) || (c >= 400 && c <= 409) || (c >= 1060 && c <= 1071);
    const o = [], put = (c, v) => { o.push(String(c), typeof v === "number" ? (isInt(c) ? String(Math.round(v)) : fmt(v)) : String(v)); };
    const fmt = (v) => (Number.isInteger(v) ? v.toFixed(1) : (+v.toFixed(8)).toString());
    const enc = (s) => String(s).replace(/Ø/g, "%%c").replace(/°/g, "%%d").replace(/±/g, "%%p").replace(/−/g, "-").replace(/[^\x20-\x7e]/g, (c) => "\\U+" + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0"));
    const insunits = { in: 1, ft: 2, mm: 4, cm: 5, m: 6 }[doc.units] || 4;
    put(0, "SECTION"); put(2, "HEADER"); put(9, "$ACADVER"); put(1, "AC1009"); put(9, "$INSUNITS"); put(70, insunits); put(9, "$LTSCALE"); put(40, doc.ltscale || 1);
    const ext = K.extents(doc) || { x0: 0, y0: 0, x1: 100, y1: 100 };
    put(9, "$EXTMIN"); put(10, ext.x0); put(20, ext.y0); put(30, 0); put(9, "$EXTMAX"); put(10, ext.x1); put(20, ext.y1); put(30, 0); put(0, "ENDSEC");
    put(0, "SECTION"); put(2, "TABLES");
    put(0, "TABLE"); put(2, "LTYPE"); put(70, Object.keys(K.LT).length);
    for (const [nm, def] of Object.entries(K.LT)) {
      put(0, "LTYPE"); put(2, nm); put(70, 0); put(3, def.d); put(72, 65); put(73, def.p.length); put(40, def.p.reduce((s, x) => s + Math.abs(x), 0));
      for (const x of def.p) put(49, x);
    }
    put(0, "ENDTAB");
    put(0, "TABLE"); put(2, "LAYER"); put(70, doc.layers.length);
    for (const l of doc.layers) { put(0, "LAYER"); put(2, safe(l.name)); put(70, (l.frozen ? 1 : 0) | (l.lock ? 4 : 0)); put(62, K.toAci(l.color) * (l.on === false ? -1 : 1)); put(6, l.lt || "CONTINUOUS"); }
    put(0, "ENDTAB");
    put(0, "TABLE"); put(2, "STYLE"); put(70, 1); put(0, "STYLE"); put(2, "STANDARD"); put(70, 0); put(40, 0); put(41, 1); put(50, 0); put(71, 0); put(42, 2.5); put(3, "txt"); put(4, ""); put(0, "ENDTAB");
    put(0, "ENDSEC");
    const ent = (e, lay) => {
      const L = safe(e.layer || lay || "0"), base = (type) => { put(0, type); put(8, L); if (e.color) put(62, e.color === "byblock" ? 0 : K.toAci(e.color)); if (e.lt) put(6, e.lt); };
      switch (e.t) {
        case "line": base("LINE"); put(10, e.a[0]); put(20, e.a[1]); put(30, 0); put(11, e.b[0]); put(21, e.b[1]); put(31, 0); break;
        case "circle": base("CIRCLE"); put(10, e.c[0]); put(20, e.c[1]); put(30, 0); put(40, e.r); break;
        case "arc": base("ARC"); put(10, e.c[0]); put(20, e.c[1]); put(30, 0); put(40, e.r); put(50, G.norm(e.a0) / D2R); put(51, G.norm(e.a1) / D2R); break;
        case "point": base("POINT"); put(10, e.p[0]); put(20, e.p[1]); put(30, 0); break;
        case "pline": poly(base, e.pts, e.closed, L); break;
        case "ellipse": poly(base, G.ellipsePoints(e, 96), e.a1 == null, L); break;
        case "spline": poly(base, G.splinePoints(e), !!e.closed, L); break;
        case "hatch":
          if (!e.solid) { for (const [a, b] of K.hatchLines(e)) ent(Object.assign(K.props(e), { t: "line", a, b }), lay); break; }
          for (const l of e.loops) {
            if (l.length === 3 || l.length === 4) { base("SOLID"); const q = l.length === 3 ? [l[0], l[1], l[2], l[2]] : [l[0], l[1], l[3], l[2]]; q.forEach((p, k) => { put(10 + k, p[0]); put(20 + k, p[1]); put(30 + k, 0); }); }
            else poly(base, l, true, L);
          }
          break;
        case "xline": base("LINE"); { const a = e.ray ? e.p : G.sub(e.p, G.mul(e.dir, 1e5)), b = G.add(e.p, G.mul(e.dir, 1e5)); put(10, a[0]); put(20, a[1]); put(30, 0); put(11, b[0]); put(21, b[1]); put(31, 0); } break;
        case "attdef": base("ATTDEF"); put(10, e.p[0]); put(20, e.p[1]); put(30, 0); put(40, e.h); put(1, enc(e.def || "")); put(3, enc(e.prompt || e.tag)); put(2, safe(e.tag)); put(70, e.inv ? 1 : 0); if (e.rot) put(50, e.rot / D2R); if (e.ha) { put(72, e.ha); put(11, e.p[0]); put(21, e.p[1]); put(31, 0); } break;
        case "leader": case "dim": case "mtext": for (const s of K.explodeEnt(e, doc)) ent(Object.assign(s, { layer: e.layer, color: s.color || e.color }), lay); break;
        case "text": base("TEXT"); put(10, e.p[0]); put(20, e.p[1]); put(30, 0); put(40, e.h); put(1, enc(e.s)); if (e.rot) put(50, e.rot / D2R); if (e.ha || e.va) { put(72, e.ha || 0); put(11, e.p[0]); put(21, e.p[1]); put(31, 0); if (e.va) put(73, e.va); } break;
        case "insert": {
          const B = doc.blocks[e.name], arr = e.cols > 1 || e.rows > 1, defs = B && !arr ? B.ents.filter((s) => s.t === "attdef") : [];
          base("INSERT"); if (defs.length) put(66, 1); put(2, safe(e.name)); put(10, e.p[0]); put(20, e.p[1]); put(30, 0); if (e.sx !== 1) put(41, e.sx); if (e.sy !== 1) put(42, e.sy); if (e.rot) put(50, e.rot / D2R);
          if (arr) { put(70, e.cols || 1); put(71, e.rows || 1); put(44, e.dc || 0); put(45, e.dr || 0); }
          if (defs.length) {
            const m = K.M.mul(K.M.insert(e), K.M.move(-B.base[0], -B.base[1]));
            for (const s of defs) { const w = K.xform(Object.assign({}, s, { t: "text" }), m); put(0, "ATTRIB"); put(8, L); put(10, w.p[0]); put(20, w.p[1]); put(30, 0); put(40, w.h); put(1, enc(e.attrs && e.attrs[s.tag] != null ? e.attrs[s.tag] : s.def || "")); put(2, safe(s.tag)); put(70, s.inv ? 1 : 0); if (w.rot) put(50, w.rot / D2R); if (s.ha) { put(72, s.ha); put(11, w.p[0]); put(21, w.p[1]); put(31, 0); } }
            put(0, "SEQEND"); put(8, L);
          }
          break;
        }
        default: if (K.EXT[e.t]) for (const s of K.explodeEnt(e, doc)) ent(Object.assign(s, { layer: e.layer, color: s.color || e.color }), lay);
      }
    };
    const poly = (base, pts, closed, L) => { base("POLYLINE"); put(66, 1); put(10, 0); put(20, 0); put(30, 0); put(70, closed ? 1 : 0); for (const p of pts) { put(0, "VERTEX"); put(8, L); put(10, p[0]); put(20, p[1]); put(30, 0); if (p[2]) put(42, p[2]); } put(0, "SEQEND"); put(8, L); };
    put(0, "SECTION"); put(2, "BLOCKS");
    for (const [nm, b] of Object.entries(doc.blocks)) { put(0, "BLOCK"); put(8, "0"); put(2, safe(nm)); put(70, 0); put(10, b.base[0]); put(20, b.base[1]); put(30, 0); put(3, safe(nm)); for (const e of b.ents) ent(e, "0"); put(0, "ENDBLK"); put(8, "0"); }
    put(0, "ENDSEC");
    put(0, "SECTION"); put(2, "ENTITIES"); for (const e of doc.ents) ent(e); put(0, "ENDSEC"); put(0, "EOF");
    return o.join("\r\n") + "\r\n";
  };
  const safe = (s) => String(s).replace(/[<>/\\":;?*|=`]/g, "_").slice(0, 255) || "0";
})((window.KCAD = window.KCAD || {}));
