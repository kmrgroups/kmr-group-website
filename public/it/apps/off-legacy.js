/* KMR Office Suite - readers for the old binary formats: .xls (values, formats, merges, widths), .doc (text and tables), .ppt (slide text).
   They only read; formulas in .xls come across as their last calculated values, and pictures/drawings in .doc/.ppt are not carried over. */
(function () {
  "use strict";
  const C = () => window.Calc;
  /* ---------- OLE2 compound file ---------- */
  function cfb(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (dv.getUint32(0, false) !== 0xd0cf11e0) throw new Error("This is not an old Office file (it does not have the expected header).");
    const ss = 1 << dv.getUint16(30, true), mss = 1 << dv.getUint16(32, true), dirStart = dv.getUint32(48, true), cutoff = dv.getUint32(56, true), miniStart = dv.getInt32(60, true), difStart = dv.getInt32(68, true), nDif = dv.getUint32(72, true);
    const sec = (i) => u8.subarray((i + 1) * ss, (i + 2) * ss), END = 0xfffffffa;
    const fatSecs = []; for (let i = 0; i < 109; i++) { const v = dv.getInt32(76 + 4 * i, true); if (v >= 0) fatSecs.push(v); }
    let d = difStart; for (let k = 0; k < nDif && d >= 0 && d < END; k++) { const s = sec(d), dv2 = new DataView(s.buffer, s.byteOffset, s.byteLength); for (let j = 0; j < ss / 4 - 1; j++) { const v = dv2.getInt32(4 * j, true); if (v >= 0) fatSecs.push(v); } d = dv2.getInt32(ss - 4, true); }
    const fat = []; fatSecs.forEach((si) => { const s = sec(si); if (s.length < ss) return; const d3 = new DataView(s.buffer, s.byteOffset, s.byteLength); for (let j = 0; j < ss / 4; j++) fat.push(d3.getInt32(4 * j, true)); });
    const chain = (start) => { const out = []; let c = start, g = 0; while (c >= 0 && c < END && g++ < 4e6) { out.push(c); c = fat[c]; if (c === undefined) break; } return out; };
    const readChain = (start, size) => { const ch = chain(start), buf = new Uint8Array(ch.length * ss); ch.forEach((c, i) => buf.set(sec(c), i * ss)); return size != null ? buf.subarray(0, size) : buf; };
    const dir = readChain(dirStart), ents = []; for (let p = 0; p + 128 <= dir.length; p += 128) { const dd = new DataView(dir.buffer, dir.byteOffset + p, 128), nl = dd.getUint16(64, true); let nm = ""; for (let k = 0; k < Math.max(0, nl / 2 - 1); k++) nm += String.fromCharCode(dd.getUint16(k * 2, true)); ents.push({ name: nm, type: dd.getUint8(66), start: dd.getInt32(116, true), size: dd.getUint32(120, true) }); }
    const root = ents[0], mini = root ? readChain(root.start, root.size) : new Uint8Array(0), miniFat = miniStart >= 0 && miniStart < END ? (() => { const b = readChain(miniStart), v = new DataView(b.buffer, b.byteOffset, b.byteLength), o = []; for (let i = 0; i + 4 <= b.length; i += 4) o.push(v.getInt32(i, true)); return o; })() : [];
    const stream = (e) => { if (e.size < cutoff) { const out = new Uint8Array(e.size); let c = e.start, pos = 0, g = 0; while (c >= 0 && c < END && pos < e.size && g++ < 4e6) { { const ck = mini.subarray(c * mss, c * mss + mss); out.set(ck.subarray(0, Math.min(ck.length, e.size - pos)), pos); } pos += mss; c = miniFat[c]; } return out; } return readChain(e.start, e.size); };
    return { get: (name) => { const e = ents.find((x) => x.type === 2 && x.name === name); return e ? stream(e) : null; } };
  }
  const u16 = (b, o) => b[o] | (b[o + 1] << 8), u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  const f64 = (b, o) => new DataView(b.buffer, b.byteOffset + o, 8).getFloat64(0, true);
  const win1252 = (n) => (n >= 0x80 && n <= 0x9f ? ["€", "", "‚", "ƒ", "„", "…", "†", "‡", "ˆ", "‰", "Š", "‹", "Œ", "", "Ž", "", "", "‘", "’", "“", "”", "•", "–", "—", "˜", "™", "š", "›", "œ", "", "ž", "Ÿ"][n - 0x80] || "" : String.fromCharCode(n));

  /* ---------- .xls (BIFF8) ---------- */
  const PAL0 = ["000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF", "000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF", "800000", "008000", "000080", "808000", "800080", "008080", "C0C0C0", "808080", "9999FF", "993366", "FFFFCC", "CCFFFF", "660066", "FF8080", "0066CC", "CCCCFF", "000080", "FF00FF", "FFFF00", "00FFFF", "800080", "800000", "008080", "0000FF", "00CCFF", "CCFFFF", "CCFFCC", "FFFF99", "99CCFF", "FF99CC", "CC99FF", "FFCC99", "3366FF", "33CCCC", "99CC00", "FFCC00", "FF9900", "FF6600", "666699", "969696", "003366", "339966", "003300", "333300", "993300", "993366", "333399", "333333"];
  const BSTY = { 1: "thin", 2: "medium", 3: "dashed", 4: "dotted", 5: "thick", 6: "double", 7: "hair" };
  function xls(buf) {
    const Cc = C(), file = cfb(buf), wbS = file.get("Workbook") || file.get("Book"); if (!wbS) throw new Error("I could not find the workbook inside this .xls file."); let recs = []; { let p = 0; while (p + 4 <= wbS.length) { const t = u16(wbS, p), l = u16(wbS, p + 2), d = wbS.subarray(p + 4, p + 4 + l); if (t === 0x3c && recs.length) recs[recs.length - 1].more.push(d); else recs.push({ t, d, more: [] }); p += 4 + l; } }
    if (recs[0] && recs[0].t === 0x809 && u16(recs[0].d, 0) !== 0x600) throw new Error("This .xls file is from Excel 95 or older. Please open it in Excel or LibreOffice and save it as .xlsx, then import that.");
    const pal = PAL0.slice(); const rgb = (i) => (i === 64 || i === 0x7fff ? "000000" : pal[i] || "000000");
    let sstr = [], fonts = [], xfs = [], fmts = {}, sheetsInfo = [], date1904 = false;
    const readSst = (chunks) => { let ci = 0, pos = 8, cur = chunks[0]; const n = u32(cur, 4), out = []; const adv = () => { if (pos >= cur.length && ci < chunks.length - 1) { ci++; cur = chunks[ci]; pos = 0; return true; } return false; }; const skip = (k) => { while (k > 0 && cur) { if (pos >= cur.length) { if (!adv()) break; } const q = Math.min(k, cur.length - pos); pos += q; k -= q; } };
      for (let i = 0; i < n; i++) { adv(); if (pos + 3 > cur.length) break; const cch = u16(cur, pos), fl = cur[pos + 2]; pos += 3; let runs = 0, ext = 0; if (fl & 8) { runs = u16(cur, pos); pos += 2; } if (fl & 4) { ext = u32(cur, pos); pos += 4; } let s = "", rem = cch, wide = !!(fl & 1);
        while (rem > 0) { if (pos >= cur.length) { if (!adv()) break; wide = !!(cur[pos++] & 1); } const unit = wide ? 2 : 1, q = Math.min(rem, Math.floor((cur.length - pos) / unit)); if (q <= 0) { pos = cur.length; continue; } for (let k = 0; k < q; k++) { s += wide ? String.fromCharCode(u16(cur, pos)) : win1252(cur[pos]); pos += unit; } rem -= q; }
        skip(runs * 4 + ext); out.push(s); } return out; };
    const readStr16 = (d, o) => { const cch = u16(d, o), fl = d[o + 2]; let p = o + 3; if (fl & 8) p += 2; if (fl & 4) p += 4; let s = ""; for (let k = 0; k < cch; k++) { if (fl & 1) { s += String.fromCharCode(u16(d, p)); p += 2; } else { s += win1252(d[p]); p++; } } return s; };
    // globals
    let idx = 0; for (; idx < recs.length; idx++) { const r = recs[idx], d = r.d; if (r.t === 0x0a && idx > 0) break;
      if (r.t === 0x22) date1904 = u16(d, 0) === 1; else if (r.t === 0xfc) sstr = readSst([d].concat(r.more)); else if (r.t === 0x85) { const nl = d[6], fl = d[7]; let nm = ""; for (let k = 0; k < nl; k++) nm += fl & 1 ? String.fromCharCode(u16(d, 8 + k * 2)) : win1252(d[8 + k]); sheetsInfo.push({ name: nm, type: d[5], hidden: d[4] }); }
      else if (r.t === 0x31) { fonts.push({ h: u16(d, 0) / 20, it: !!(u16(d, 2) & 2), st: !!(u16(d, 2) & 8), col: u16(d, 4), b: u16(d, 6) >= 700, u: d[10], name: (() => { const cch = d[14], fl = d[15]; let s = ""; for (let k = 0; k < cch; k++) s += fl & 1 ? String.fromCharCode(u16(d, 16 + k * 2)) : String.fromCharCode(d[16 + k]); return s; })() }); if (fonts.length === 4) fonts.push(null); }
      else if (r.t === 0x41e) fmts[u16(d, 0)] = readStr16(d, 2); else if (r.t === 0x92) { const n = u16(d, 0); for (let k = 0; k < n; k++) pal[8 + k] = [d[2 + k * 4], d[3 + k * 4], d[4 + k * 4]].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase(); }
      else if (r.t === 0xe0) xfs.push({ font: u16(d, 0), fmt: u16(d, 2), ha: d[6] & 7, wr: !!(d[6] & 8), va: (d[6] >> 4) & 7, ind: d[8] & 15, bl: [d[10] & 15, (d[10] >> 4) & 15, d[11] & 15, (d[11] >> 4) & 15], bc: [(u32(d, 10) >>> 16) & 127, (u32(d, 10) >>> 23) & 127, u32(d, 14) & 127, (u32(d, 14) >>> 7) & 127], pat: (u32(d, 14) >>> 26) & 63, fore: u16(d, 18) & 127 }); }
    const wb = new Cc.Workbook({ sheets: sheetsInfo.filter((s) => s.type === 0).map((s) => ({ name: s.name })) }); const sheetObjs = {}; let si = 0; sheetsInfo.forEach((s) => { if (s.type === 0) { sheetObjs[sheetsInfo.indexOf(s)] = wb.sheets[si++]; if (s.hidden) sheetObjs[sheetsInfo.indexOf(s)].hidden = true; } });
    const cache = new Map(); const styleOf = (xi) => { if (cache.has(xi)) return cache.get(xi); const x = xfs[xi]; let id = 0; if (x) { const s = {}; const f = fonts[x.font]; if (f) { if (f.b) s.b = 1; if (f.it) s.i = 1; if (f.st) s.st = 1; if (f.u) s.u = f.u === 2 || f.u === 0x22 ? 2 : 1; if (f.h && f.h !== 11) s.fs = f.h; if (f.name && f.name !== "Calibri") s.ff = f.name; const c = rgb(f.col); if (f.col !== 0x7fff && c !== "000000") s.fc = "#" + c.toLowerCase(); }
      if (x.pat === 1) s.bg = "#" + rgb(x.fore).toLowerCase(); const ha = { 1: "left", 2: "center", 3: "right" }[x.ha]; if (ha) s.ha = ha; const va = { 0: "top", 1: "middle" }[x.va]; if (va) s.va = va; if (x.wr) s.wr = 1; if (x.ind) s.ind = x.ind;
      const bd = {}; ["l", "r", "t", "b"].forEach((k, i) => { if (x.bl[i] && BSTY[x.bl[i]]) bd[k] = [BSTY[x.bl[i]], "#" + rgb(x.bc[i]).toLowerCase()]; }); if (Object.keys(bd).length) s.bd = bd;
      const fid = x.fmt; let code = fmts[fid] || Cc.Fmt.BUILT[fid] || null; if (fid === 14 || (fid >= 27 && fid <= 36)) code = "dd-mm-yyyy"; if (fid >= 50 && fid <= 58) code = "mmm-yy"; if (fid === 12 || fid === 13) code = "# ?/?"; if (code && code !== "General") s.nf = code; id = Object.keys(s).length ? wb.styleId(s) : 0; } cache.set(xi, id); return id; };
    const num = (v) => (date1904 ? v + 1462 : v); const rk = (r) => { let v; if (r & 2) v = r >> 2; else { const b = new DataView(new ArrayBuffer(8)); b.setUint32(4, (r & 0xfffffffc) >>> 0, true); v = b.getFloat64(0, true); } return r & 1 ? v / 100 : v; };
    const ERR = { 0: "#NULL!", 7: "#DIV/0!", 15: "#VALUE!", 23: "#REF!", 29: "#NAME?", 36: "#NUM!", 42: "#N/A" };
    let sh = null, bofN = -1, pendingF = null, nCells = 0; const put = (r, c, v, xi) => { if (!sh || v == null || v === "") { if (sh && xi != null && styleOf(xi)) sh.set(r + 1, c + 1, { s: styleOf(xi) }); return; } const cell = { v }; const st = styleOf(xi); if (st) cell.s = st; sh.set(r + 1, c + 1, cell); nCells++; };
    for (; idx < recs.length; idx++) { const r = recs[idx], d = r.d;
      if (r.t === 0x809) { bofN++; sh = sheetObjs[bofN] || null; continue; } if (!sh) continue;
      if (r.t === 0x203) put(u16(d, 0), u16(d, 2), num(f64(d, 6)), u16(d, 4));
      else if (r.t === 0x27e) put(u16(d, 0), u16(d, 2), num(rk(u32(d, 6))), u16(d, 4));
      else if (r.t === 0xbd) { const row = u16(d, 0), c0 = u16(d, 2), n = (d.length - 6) / 6; for (let k = 0; k < n; k++) put(row, c0 + k, num(rk(u32(d, 6 + k * 6))), u16(d, 4 + k * 6)); }
      else if (r.t === 0xfd) put(u16(d, 0), u16(d, 2), sstr[u32(d, 6)], u16(d, 4));
      else if (r.t === 0x204) { const cch = u16(d, 6); let s = ""; for (let k = 0; k < cch; k++) s += win1252(d[8 + k]); put(u16(d, 0), u16(d, 2), s, u16(d, 4)); }
      else if (r.t === 0x205) { const row = u16(d, 0), col = u16(d, 2); put(row, col, d[7] ? ERR[d[6]] || "#VALUE!" : !!d[6], u16(d, 4)); }
      else if (r.t === 0x06) { const row = u16(d, 0), col = u16(d, 2), xi = u16(d, 4); if (d[12] === 0xff && d[13] === 0xff) { if (d[6] === 0) pendingF = { row, col, xi }; else if (d[6] === 1) put(row, col, !!d[8], xi); else if (d[6] === 2) put(row, col, ERR[d[8]] || "#VALUE!", xi); } else put(row, col, num(f64(d, 6)), xi); }
      else if (r.t === 0x207 && pendingF) { put(pendingF.row, pendingF.col, readStr16(d, 0), pendingF.xi); pendingF = null; }
      else if (r.t === 0xe5) { const n = u16(d, 0); for (let k = 0; k < n; k++) { const r1 = u16(d, 2 + k * 8), r2 = u16(d, 4 + k * 8), c1 = u16(d, 6 + k * 8), c2 = u16(d, 8 + k * 8); if (r2 >= r1 && c2 >= c1 && (r2 > r1 || c2 > c1)) sh.merges.push(Cc.addr(r1 + 1, c1 + 1) + ":" + Cc.addr(r2 + 1, c2 + 1)); } }
      else if (r.t === 0x7d) { const c1 = u16(d, 0), c2 = Math.min(u16(d, 2), c1 + 300), w = Math.round((u16(d, 4) / 256) * 7 + 5); for (let c = c1; c <= c2; c++) { if (u16(d, 8) & 1) sh.hiddenCols[c + 1] = 1; else if (w > 5) sh.cols[c + 1] = w; } }
      else if (r.t === 0x208) { const row = u16(d, 0), h = u16(d, 6), fl = u16(d, 12); if (fl & 0x20) sh.hiddenRows[row + 1] = 1; else if (fl & 0x40 && !(h & 0x8000)) sh.rows[row + 1] = Math.round(h / 15); }
      else if (r.t === 0x41) { sh.__pane = { x: u16(d, 0), y: u16(d, 2) }; }
      else if (r.t === 0x23e) { if (u16(d, 0) & 8 && sh.__pane) sh.freeze = { r: sh.__pane.y, c: sh.__pane.x }; if (!(u16(d, 0) & 2)) sh.grid = false; }
    }
    wb.sheets.forEach((s) => delete s.__pane); if (!wb.sheets.length) throw new Error("No worksheets were found in this .xls file.");
    return { wb, cells: nCells };
  }

  /* ---------- .doc (Word 97-2003): text and tables ---------- */
  function doc(buf) {
    const file = cfb(buf), wd = file.get("WordDocument"); if (!wd) throw new Error("I could not find the document text inside this .doc file."); if (u16(wd, 0) !== 0xa5ec) throw new Error("This .doc file is from a very old version of Word. Please open it in Word or LibreOffice and save it as .docx, then import that.");
    const flags = u16(wd, 0x0a); if (flags & 0x100) throw new Error("This .doc file is password protected. Remove the password in Word, then import it."); const tbl = file.get(flags & 0x200 ? "1Table" : "0Table"); if (!tbl) throw new Error("This .doc file is damaged (its table stream is missing).");
    const ccpText = u32(wd, 76), fcClx = u32(wd, 418), lcbClx = u32(wd, 422); let p = fcClx; const end = fcClx + lcbClx; let text = "";
    while (p < end) { const t = tbl[p]; if (t === 1) { p += 3 + u16(tbl, p + 1); continue; } if (t === 2) { const lcb = u32(tbl, p + 1), plc = p + 5, n = (lcb - 4) / 12; const cps = []; for (let i = 0; i <= n; i++) cps.push(u32(tbl, plc + i * 4)); for (let i = 0; i < n; i++) { const pcd = plc + (n + 1) * 4 + i * 8, fc = u32(tbl, pcd + 2), len = cps[i + 1] - cps[i]; if (fc & 0x40000000) { const o = (fc & 0x3fffffff) >>> 1; for (let k = 0; k < len; k++) text += win1252(wd[o + k]); } else { const o = fc & 0x3fffffff; for (let k = 0; k < len; k++) text += String.fromCharCode(u16(wd, o + k * 2)); } } break; } else break; }
    if (!text) throw new Error("I could not read any text from this .doc file."); text = text.slice(0, ccpText);
    // fields: keep the shown result only
    let clean = "", depth = 0, instr = []; for (const ch of text) { const c = ch.charCodeAt(0); if (c === 0x13) { depth++; instr.push(true); continue; } if (c === 0x14 && depth) { instr[depth - 1] = false; continue; } if (c === 0x15 && depth) { depth--; instr.pop(); continue; } if (depth && instr[depth - 1]) continue; clean += ch; }
    const esc = (s) => s.replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m])); const html = []; let rows = [], row = [], cur = "";
    const flushTable = () => { if (rows.length) { html.push('<table border="1" style="border-collapse:collapse;width:100%">' + rows.map((r) => "<tr>" + r.map((c) => `<td style="border:1px solid #888;padding:4px">${esc(c) || "&nbsp;"}</td>`).join("") + "</tr>").join("") + "</table><p></p>"); rows = []; } };
    const fix = (s) => esc(s.replace(/[\x01\x08]/g, "").replace(/\x0b/g, "\n").replace(/\x0c/g, "").replace(/ /g, " ")).replace(/\n/g, "<br>");
    for (const ch of clean) { const c = ch.charCodeAt(0); if (c === 0x07) { if (cur === "" && row.length) { rows.push(row); row = []; } else { row.push(cur.replace(/[\x01\x08\x0b\x0c]/g, " ")); cur = ""; } continue; } if (c === 0x0d) { if (row.length) { rows.push(row); row = []; } flushTable(); html.push("<p>" + (fix(cur) || "<br>") + "</p>"); cur = ""; continue; } cur += ch; }
    if (cur.trim()) { flushTable(); html.push("<p>" + fix(cur) + "</p>"); } else flushTable();
    return { html: html.join(""), text: clean };
  }

  /* ---------- .ppt (PowerPoint 97-2003): slide text ---------- */
  function ppt(buf) {
    const file = cfb(buf), s = file.get("PowerPoint Document"); if (!s) throw new Error("I could not find the slides inside this .ppt file.");
    const slides = []; let curSlide = null, textType = 3;
    const rec = (p, end, inSlide, depth) => { while (p + 8 <= end) { const ver = s[p] & 15, type = u16(s, p + 2), len = u32(s, p + 4), body = p + 8; if (body + len > end + 1 && depth > 0) break;
      if (ver === 15 && depth < 12) { if (type === 0x3ee) { curSlide = { blocks: [] }; slides.push(curSlide); rec(body, Math.min(body + len, end), true, depth + 1); curSlide = null; } else rec(body, Math.min(body + len, end), inSlide, depth + 1); }
      else if (inSlide && curSlide) { if (type === 0xf9f) textType = u32(s, body); else if (type === 0xfa0) { let t = ""; for (let k = 0; k + 1 < len; k += 2) t += String.fromCharCode(u16(s, body + k)); curSlide.blocks.push({ type: textType, text: t }); textType = 3; } else if (type === 0xfa8) { let t = ""; for (let k = 0; k < len; k++) t += win1252(s[body + k]); curSlide.blocks.push({ type: textType, text: t }); textType = 3; } }
      p = body + len; } };
    rec(0, s.length, false, 0);
    const norm = (t) => t.replace(/\r\n?/g, "\n").replace(/\x0b/g, "\n").replace(/\x00/g, "").split("\n").map((x) => x.trim()).filter((x, i, a) => x !== "" || (i > 0 && i < a.length - 1));
    const out = slides.map((sl) => { const title = sl.blocks.find((b) => b.type === 0 || b.type === 5), rest = sl.blocks.filter((b) => b !== title && b.type !== 2); return { title: title ? norm(title.text).join(" ") : "", body: rest.flatMap((b) => norm(b.text)) }; }).filter((x) => x.title || x.body.length);
    if (!out.length) throw new Error("I could not find any slide text in this .ppt file.");
    return out;
  }
  window.OffLegacy = { cfb, xls, doc, ppt };
})();
