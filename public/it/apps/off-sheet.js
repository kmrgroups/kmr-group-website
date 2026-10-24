/* KMR Office Suite - Spreadsheets editor (core): grid, selection, editing, clipboard, fill, undo, formatting, rows/columns, sheets, ribbon. Features (find, sort, filter, charts, ...) are in off-sheet2.js. */
(function () {
  "use strict";
  const { ic, esc, make, menu, form, pop, closeMenu, num, colourMenu } = OffUI, C = window.Calc, Z = window.OffZip, X = window.OffXlsx;
  const DW = X.DEFCOL, DH = X.DEFROW, HW = 48, HH = 24, MAXROW = 200000, MAXCOL = 700;
  const FONTS = ["Calibri", "Arial", "Cambria", "Consolas", "Courier New", "Georgia", "Segoe UI", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana"];
  const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48];
  const NF = [["General", "General"], ["Number (2 decimals)", "0.00"], ["Number with commas", "#,##0.00"], ["Indian grouping (12,34,567)", "#,##,##0.00"], ["Currency ₹", '"₹"#,##0.00'], ["Currency ₹ Indian grouping", '"₹"#,##,##0.00'], ["Percentage", "0.00%"], ["Date dd-mm-yyyy", "dd-mm-yyyy"], ["Date dd-mmm-yyyy", "dd-mmm-yyyy"], ["Long date", "dddd, mmmm d, yyyy"], ["Time", "h:mm AM/PM"], ["Fraction", "# ?/?"], ["Scientific", "0.00E+00"], ["Text", "@"]];
  const BORD = { thin: "1px solid", medium: "2px solid", thick: "3px solid", dashed: "1px dashed", dotted: "1px dotted", double: "3px double", hair: "1px dotted" };
  const css = `
.sgw{display:flex;flex-direction:column;width:100%;box-sizing:border-box;height:100%;min-height:0;background:var(--card,#fff);color:#111}
.sfx{display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid var(--line,#ddd);background:var(--card,#fff)}
.sfx input{border:1px solid var(--line,#ccc);border-radius:6px;padding:4px 8px;font:13px Calibri,Arial,sans-serif;background:#fff;color:#111;min-width:0}
.snb{width:96px;text-align:center}.sfi{flex:1}.sfl{font:italic 700 14px Georgia,serif;color:#4f46e5;padding:0 2px}
.sgs{position:relative;overflow:auto;flex:1;min-height:0;background:#fff;outline:0}
.sgsp{position:absolute;left:0;top:0;pointer-events:none;visibility:hidden}
.sgv{position:sticky;left:0;top:0;width:100%;height:100%;overflow:hidden;outline:0;user-select:none;-webkit-user-select:none;cursor:cell;font-family:Calibri,Arial,sans-serif}
.sgv .qd{position:absolute;overflow:hidden;background:#fff}
.sgv .qd.hd{background:#f3f4f6}
.sgv .gv{position:absolute;top:0;width:1px;background:#e1e1e1;pointer-events:none}.sgv .gh{position:absolute;left:0;height:1px;background:#e1e1e1;pointer-events:none}
.sgv .sc{position:absolute;box-sizing:border-box;display:flex;overflow:hidden;white-space:nowrap;padding:0 3px;font-size:14.67px;line-height:1.2;align-items:flex-end;color:#000}
.sgv .sc>span{display:block;overflow:hidden;text-overflow:clip;max-width:100%}
.sgv .sc.wr>span{white-space:pre-wrap;word-break:break-word;overflow:hidden}
.sgv .sc.nt:after{content:"";position:absolute;right:0;top:0;border:4px solid transparent;border-top-color:#dc2626;border-right-color:#dc2626}
.sgv .sc.lk>span{color:#2563eb;text-decoration:underline}
.sgv .sc .fb{position:absolute;right:2px;bottom:2px;width:16px;height:16px;background:#f9fafb;border:1px solid #9ca3af;border-radius:3px;font-size:9px;line-height:14px;text-align:center;cursor:pointer;color:#374151;z-index:3}
.sgv .sc .fb.on{background:#4f46e5;color:#fff;border-color:#4f46e5}
.sgv .sc .db{position:absolute;left:0;bottom:0;height:3px;opacity:.85}
.sgv .hc{position:absolute;box-sizing:border-box;border-right:1px solid #cfd2d8;border-bottom:1px solid #cfd2d8;background:#f3f4f6;color:#4b5563;font:600 12px Calibri,Arial,sans-serif;display:flex;align-items:center;justify-content:center;cursor:default}
.sgv .hc.on{background:#dbe4ff;color:#1e1b4b}.sgv .hc.al{background:#4f46e5;color:#fff}
.sgv .sed{position:absolute;z-index:6;box-sizing:border-box;border:2px solid #4f46e5;background:#fff;color:#000;padding:0 3px;font:14.67px Calibri,Arial,sans-serif;line-height:1.2;resize:none;outline:0;overflow:hidden;white-space:pre-wrap;margin:0}
.sgv .sgx,.sgv .sgc{position:absolute;left:${HW}px;top:${HH}px;right:0;bottom:0;overflow:hidden;pointer-events:none}
.sgv .sgc{z-index:4}.sgv .sgx{z-index:5}
.sgv .sl{position:absolute;box-sizing:border-box;border:2px solid #4f46e5;background:rgba(79,70,229,.09)}
.sgv .sa{position:absolute;box-sizing:border-box;border:2px solid #4f46e5}
.sgv .sa.dv{border-color:#4f46e5}
.sgv .fh{position:absolute;width:8px;height:8px;background:#4f46e5;border:1px solid #fff;cursor:crosshair;pointer-events:auto}
.sgv .fp{position:absolute;box-sizing:border-box;border:2px dashed #4f46e5}
.sgv .cp{position:absolute;box-sizing:border-box;border:2px dashed #16a34a}
.sgv .dd{position:absolute;width:18px;height:18px;background:#f9fafb;border:1px solid #9ca3af;border-radius:3px;text-align:center;font-size:10px;line-height:16px;cursor:pointer;pointer-events:auto;color:#374151}
.sgv .corner{position:absolute;left:0;top:0;width:${HW}px;height:${HH}px;background:#e5e7eb;border-right:1px solid #cfd2d8;border-bottom:1px solid #cfd2d8;z-index:7;cursor:pointer}
.sgv .corner:after{content:"";position:absolute;right:5px;bottom:5px;border:6px solid transparent;border-right-color:#9ca3af;border-bottom-color:#9ca3af}
.sgv .frz{position:absolute;background:#9ca3af;pointer-events:none;z-index:5}
.sgv .chart{position:absolute;pointer-events:auto;background:#fff;border:1px solid #cbd5e1;box-shadow:0 2px 8px rgba(0,0,0,.15);cursor:move}
.sgv .chart.on{outline:2px solid #4f46e5}.sgv .chart svg{display:block;pointer-events:none}
.sgv .chart .rz{position:absolute;right:-5px;bottom:-5px;width:10px;height:10px;background:#4f46e5;border:1px solid #fff;cursor:nwse-resize;display:none}.sgv .chart.on .rz{display:block}
.stb{display:flex;align-items:center;gap:2px;padding:3px 8px;border-top:1px solid var(--line,#ddd);background:var(--card,#fff);overflow-x:auto;flex:none}
.stb button{border:1px solid transparent;background:transparent;padding:4px 14px;border-radius:6px 6px 0 0;font:600 12.5px Calibri,Arial,sans-serif;cursor:pointer;color:var(--ink,#222);white-space:nowrap}
.stb button.on{background:#e0e7ff;border-color:#c7d2fe;color:#312e81}.stb button.add{font-size:16px;padding:2px 10px}
.stb button.hid{opacity:.5;font-style:italic}
.spr{display:none}
.rbm .btn:not(.o){background:var(--b1,#4f46e5)!important;color:#fff!important}
.sro .sed{display:none}
.rbm .sgl{display:block}
@media print{body.opv .sgw>*:not(.spr){display:none!important}body.opv .sgw{display:block!important;height:auto!important}body.opv .spr{display:block!important}.spr table{border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:10pt}.spr td{padding:1px 4px;overflow:hidden;white-space:nowrap}.spr td.w{white-space:pre-wrap}.spr .pgb{break-after:page}.spr svg{max-width:100%;height:auto;break-inside:avoid;margin:8px 0}}
`;
  (function () { if (document.getElementById("off-sheet-css")) return; const s = document.createElement("style"); s.id = "off-sheet-css"; s.textContent = css; document.head.append(s); })();

  const clone = (c) => { if (!c) return null; const o = {}; for (const k in c) if (k !== "ast" && k !== "busy" && k !== "cv") o[k] = c[k]; return o; };
  const jc = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const lowerBound = (arr, v, n) => { let lo = 1, hi = n; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (arr[m] <= v) lo = m; else hi = m - 1; } return lo; };
  const isDateNf = (nf) => !!nf && /[ymdhs]/i.test(nf.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, "")) && !/^[#0,.%E+\-\s?\/@]*$/.test(nf.replace(/"[^"]*"/g, ""));
  const LISTS = [["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"], ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"], ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]];

  /* ----- sample sheets used by the templates (kept here so blank() works without mounting) ----- */
  const SHEET = {
    kind: "sheet", label: "Spreadsheet", plural: "Spreadsheets", blurb: "Tables, calculations, charts and reports", ext: "xlsx", color: "#16a34a", icon: "sheet", accept: ".xlsx,.csv,.tsv,.txt",
    get templates() { return (window.OffSheetT ? OffSheetT.list : [{ id: "blank", name: "Blank spreadsheet", desc: "" }]).map((t) => ({ id: t.id, name: t.name, desc: t.desc })); },
    blank(tid, set) { const wb = window.OffSheetT ? OffSheetT.make(tid, set || {}) : new C.Workbook({}); const j = wb.toJSON(); j.zoom = 100; return j; },
    async importFile(file) {
      const n = file.name, base = n.replace(/\.[^.]+$/, ""), ext = ((/\.([^.]+)$/.exec(n) || [])[1] || "").toLowerCase();
      if (ext === "xls") throw new Error("Old .xls files are not supported. Please save the file as .xlsx in your spreadsheet program and import that.");
      let wb;
      if (ext === "xlsx") wb = await X.read(await Z.readBuf(file)); else { const t = await Z.readText(file); wb = X.fromCsv(ext === "tsv" ? t.replace(/\r?\n/g, "\n") : t, "Sheet1"); if (ext === "tsv") wb = (function () { const rows = X.parseCsv(t, "\t"); const w = new C.Workbook({ sheets: [{ name: "Sheet1" }] }); rows.forEach((r, i) => r.forEach((x, j) => { if (x === "") return; const p = C.parseInput(x); const cell = { v: p.f ? x : p.v }; if (p.nf) cell.s = w.styleId({ nf: p.nf }); if (cell.v != null) w.sheets[0].set(i + 1, j + 1, cell); })); return w; })(); }
      const j = wb.toJSON(); j.zoom = 100; return { name: base, body: j };
    },
    exports: [
      { label: "Excel workbook (.xlsx)", ext: "xlsx", run: (c) => c.exportXlsx() }, { label: "This sheet as CSV (.csv)", ext: "csv", run: (c) => c.exportCsv() }, { label: "Web page (.html)", ext: "html", run: (c) => c.exportHtml() }
    ],
    mount(api) {
      const file = api.file, body = file.body && file.body.sheets ? file.body : SHEET.blank("blank");
      const wb = new C.Workbook(body); let Zm = Math.max(0.5, Math.min(2, (body.zoom || 100) / 100)); let ro = !!api.ro; let ver = 1;
      const print = Object.assign({ orient: "portrait", size: "A4", grid: false, fit: true, title: 0 }, body.print || {});
      if (wb.active >= wb.sheets.length || wb.active < 0) wb.active = 0;
      api.wk.innerHTML = `<div class="sgw${ro ? " sro" : ""}"><div class="sfx"><input class="snb" aria-label="Cell address (type an address or name and press Enter)" spellcheck="false" autocomplete="off"><span class="sfl">fx</span><input class="sfi" aria-label="Formula bar" spellcheck="false" autocomplete="off"></div><div class="sgs"><div class="sgsp"></div><div class="sgv" tabindex="0"><div class="sgl"></div><div class="sgc"></div><div class="sgx"></div><textarea class="sed" hidden spellcheck="false" aria-label="Cell editor"></textarea></div></div><div class="stb"></div><div class="spr"></div></div>`;
      const W = api.wk, sgw = W.querySelector(".sgw"), sgs = W.querySelector(".sgs"), sgsp = W.querySelector(".sgsp"), sgv = W.querySelector(".sgv"), sgl = W.querySelector(".sgl"), sgc = W.querySelector(".sgc"), sgx = W.querySelector(".sgx"), ta = W.querySelector(".sed"), nb = W.querySelector(".snb"), fi = W.querySelector(".sfi"), stb = W.querySelector(".stb"), spr = W.querySelector(".spr");
      const S = { api, wb, x: {}, print, W, sgv, sgc, sgx, ta, spr }; const mix = (o) => Object.defineProperties(S, Object.getOwnPropertyDescriptors(o));
      let sl = 0, st = 0, CX = null, RY = null, NR = 100, NC = 26, FW = 0, FH = 0, showF = false, showGrid = true, raf = 0;
      let cur = { r: 1, c: 1 }, ext = { r: 1, c: 1 }, sel = { r1: 1, c1: 1, r2: 1, c2: 1 }, whole = null;
      let undo = [], redo = [], J = null, clip = null, ed = null, rb = null, mergeCache = null;
      const cs = () => wb.sheets[wb.active];
      const view = (sh) => { if (!sh.vr) { sh.vr = 0; sh.vc = 0; } return sh; };
      mix({ cs, get ro() { return ro; }, get cur() { return cur; }, get sel() { return sel; }, get Zm() { return Zm; }, get ver() { return ver; }, get edit() { return ed; }, bump() { ver++; wb.invalidate(); mergeCache = null; }, get showF() { return showF; } });
      const say = (m, ok) => api.say(m, ok); S.say = say;
      const changed = () => { ver++; api.changed(); };

      /* ---------- geometry ---------- */
      const cw = (sh, c) => (sh.hiddenCols && sh.hiddenCols[c] ? 0 : Math.round((sh.cols[c] || DW) * Zm));
      const rh = (sh, r) => (sh.hiddenRows && sh.hiddenRows[r] ? 0 : Math.round((sh.rows[r] || DH) * Zm));
      function layout() {
        const sh = view(cs()), [ur, uc] = sh.dims(); sh.vr = Math.max(sh.vr, ur + 40, cur.r + 20, sel.r2 + 5, 100, (sh.freeze.r || 0) + 30); sh.vc = Math.max(sh.vc, uc + 6, cur.c + 4, sel.c2 + 2, 26, (sh.freeze.c || 0) + 10);
        sh.vr = Math.min(sh.vr, MAXROW); sh.vc = Math.min(sh.vc, MAXCOL); NR = sh.vr; NC = sh.vc;
        CX = new Float64Array(NC + 3); RY = new Float64Array(NR + 3); CX[1] = 0; RY[1] = 0; for (let c = 1; c <= NC + 1; c++) CX[c + 1] = CX[c] + cw(sh, c); for (let r = 1; r <= NR + 1; r++) RY[r + 1] = RY[r] + rh(sh, r);
        FW = CX[(sh.freeze.c || 0) + 1]; FH = RY[(sh.freeze.r || 0) + 1];
        sgsp.style.width = HW + CX[NC + 1] + "px"; sgsp.style.height = HH + RY[NR + 1] + "px"; sgsp.style.visibility = "hidden";
        S.rowMax = NR; S.colMax = NC;
      }
      const sxOf = (c) => HW + (c <= (cs().freeze.c || 0) ? CX[c] : CX[c] - sl), syOf = (r) => HH + (r <= (cs().freeze.r || 0) ? RY[r] : RY[r] - st);
      const cAt = (x) => lowerBound(CX, x, NC), rAt = (y) => lowerBound(RY, y, NR);
      const merges = () => {
        if (mergeCache && mergeCache.sh === cs() && mergeCache.n === cs().merges.length && mergeCache.v === ver) return mergeCache; const sh = cs(), anchors = new Map(), covered = new Set(), list = [];
        sh.merges.forEach((m) => { const p = m.split(":"), a = C.parseAddr(p[0]), b = C.parseAddr(p[1] || p[0]); if (!a || !b) return; const o = { r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) }; list.push(o); anchors.set(C.key(o.r1, o.c1), o); for (let r = o.r1; r <= o.r2; r++) for (let c = o.c1; c <= o.c2; c++) if (r !== o.r1 || c !== o.c1) covered.add(C.key(r, c)); });
        return (mergeCache = { sh, n: sh.merges.length, v: ver, anchors, covered, list });
      };
      const mergeOf = (r, c) => { const m = merges(); for (const o of m.list) if (r >= o.r1 && r <= o.r2 && c >= o.c1 && c <= o.c2) return o; return null; };
      const anchorOf = (r, c) => { const o = mergeOf(r, c); return o ? { r: o.r1, c: o.c1 } : { r, c }; };
      mix({ mergeOf, anchorOf, merges });

      /* ---------- selection ---------- */
      function expandSel(s) { let ch = true, n = 0; while (ch && n++ < 20) { ch = false; merges().list.forEach((o) => { if (o.r1 <= s.r2 && o.r2 >= s.r1 && o.c1 <= s.c2 && o.c2 >= s.c1) { const a = Math.min(s.r1, o.r1), b = Math.min(s.c1, o.c1), c = Math.max(s.r2, o.r2), d = Math.max(s.c2, o.c2); if (a !== s.r1 || b !== s.c1 || c !== s.r2 || d !== s.c2) { s.r1 = a; s.c1 = b; s.r2 = c; s.c2 = d; ch = true; } } }); } return s; }
      function setSel(r, c, er, ec, wh) {
        const sh = cs(); r = Math.max(1, Math.min(MAXROW, r)); c = Math.max(1, Math.min(MAXCOL, c)); er = Math.max(1, Math.min(MAXROW, er == null ? r : er)); ec = Math.max(1, Math.min(MAXCOL, ec == null ? c : ec));
        if (r > NR - 5 || c > NC - 2 || er > NR - 5 || ec > NC - 2) { const sv = view(sh); sv.vr = Math.max(sv.vr, r + 40, er + 40); sv.vc = Math.max(sv.vc, c + 6, ec + 6); layout(); }
        cur = { r, c }; ext = { r: er, c: ec }; whole = wh || null; sel = expandSel({ r1: Math.min(r, er), c1: Math.min(c, ec), r2: Math.max(r, er), c2: Math.max(c, ec) });
        S.x.chartDeselect && S.x.chartDeselect(); syncBar(); drawOverlay(); statusStats(); if (S.x.onSelect) S.x.onSelect(); rb && rb.refresh(); scrollInto(ext.r, ext.c);
      }
      mix({ setSel, layout, render: () => render() });
      function scrollInto(r, c) {
        const sh = cs(), vw = sgv.clientWidth, vh = sgv.clientHeight, fr = sh.freeze.r || 0, fc = sh.freeze.c || 0; let nl = sgs.scrollLeft, nt = sgs.scrollTop;
        if (c > fc) { const x1 = CX[c], x2 = CX[c + 1]; if (x1 < FW + nl) nl = x1 - FW; else if (x2 > nl + vw - HW) nl = x2 - vw + HW; }
        if (r > fr) { const y1 = RY[r], y2 = RY[r + 1]; if (y1 < FH + nt) nt = y1 - FH; else if (y2 > nt + vh - HH) nt = y2 - vh + HH; }
        nl = Math.max(0, nl); nt = Math.max(0, nt); if (nl !== sgs.scrollLeft) sgs.scrollLeft = nl; if (nt !== sgs.scrollTop) sgs.scrollTop = nt;
      }
      const syncBar = () => {
        const a = anchorOf(cur.r, cur.c); nb.value = sel.r1 === sel.r2 && sel.c1 === sel.c2 || mergeOf(cur.r, cur.c) && sel.r1 === mergeOf(cur.r, cur.c).r1 && sel.r2 === mergeOf(cur.r, cur.c).r2 ? C.addr(a.r, a.c) : (whole === "col" ? C.nCol(sel.c1) + ":" + C.nCol(sel.c2) : whole === "row" ? sel.r1 + ":" + sel.r2 : C.addr(sel.r1, sel.c1) + ":" + C.addr(sel.r2, sel.c2));
        if (!ed) fi.value = rawText(cs(), a.r, a.c);
      };
      const rawText = (sh, r, c) => {
        const cell = sh.get(r, c); if (!cell) return ""; if (cell.f) return cell.f; const v = cell.v; if (v == null) return ""; if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
        if (typeof v === "number") { const nf = wb.numFmt(cell, v); if (isDateNf(nf)) return C.Fmt.format(v, /[ymd]/i.test(nf.replace(/"[^"]*"/g, "")) && /[hs]/i.test(nf.replace(/"[^"]*"/g, "").replace(/mmm?m?/gi, "")) ? "dd-mm-yyyy h:mm" : /[ymd]/i.test(nf) ? "dd-mm-yyyy" : "h:mm:ss").text; if (/%/.test(nf)) return +(v * 100).toPrecision(12) + "%"; return String(+v.toPrecision(15)); }
        const s = String(v); return /^=|^'/.test(s) || (C.parseInput(s).v !== s) ? "'" + s : s;
      };
      S.rawText = rawText;

      /* ---------- drawing ---------- */
      const styleCache = new Map();
      function styleCss(sid) {
        const k = sid + "|" + Zm; let v = styleCache.get(k); if (v) return v; const s = wb.style(sid); let t = "";
        t += `font-size:${((s.fs || 11) * 1.3333 * Zm).toFixed(2)}px;`; if (s.ff) t += `font-family:'${s.ff}',Calibri,Arial,sans-serif;`; if (s.b) t += "font-weight:700;"; if (s.i) t += "font-style:italic;"; if (s.u || s.st) t += `text-decoration:${s.u ? "underline" : ""} ${s.st ? "line-through" : ""};`;
        if (s.fc) t += `color:${s.fc};`; if (s.bg) t += `background:${s.bg};`;
        if (s.bd) for (const side of ["l", "r", "t", "b"]) if (s.bd[side]) { const [stl, col] = s.bd[side]; t += `border-${{ l: "left", r: "right", t: "top", b: "bottom" }[side]}:${BORD[stl] || "1px solid"} ${col || "#000"};`; }
        if (s.va) t += `align-items:${s.va === "top" ? "flex-start" : s.va === "middle" ? "center" : "flex-end"};`; if (s.ind) t += `padding-left:${3 + s.ind * 9 * Zm}px;`;
        styleCache.set(k, t); return t;
      }
      const textWidthEst = (t, fs, b) => t.length * (fs * 1.3333 * 0.5 + (b ? 0.6 : 0)) * Zm;
      function cellHtml(sh, r, c, cell, x, y, w, h, nextEmptyW) {
        const v = wb.value(sh, r, c), st = wb.style(cell && cell.s); let f = showF && cell && cell.f ? { text: cell.f } : wb.text(sh, r, c); let text = f.text, cls = "sc", style = "";
        const isNum = typeof v === "number", isErr = C.isE(v), isB = typeof v === "boolean"; let ha = st.ha; if (!ha || ha === "general") ha = isNum ? "right" : isErr || isB ? "center" : "left";
        const cf = S.x.cfEval ? S.x.cfEval(sh, r, c, v) : null; let extra = "";
        if (isNum && !showF && text && textWidthEst(text, st.fs || 11, st.b) > w - 4 && !st.wr) text = "#".repeat(Math.max(1, Math.floor((w - 6) / (6.5 * Zm))));
        let ww = w; if (!st.wr && !isNum && !isErr && !isB && ha === "left" && text && nextEmptyW) { const need = textWidthEst(text, st.fs || 11, st.b) + 8; if (need > w) ww = Math.min(need, w + nextEmptyW); }
        if (st.wr) cls += " wr"; if (cell && cell.n) cls += " nt"; if (cell && cell.l) cls += " lk";
        style = styleCss(cell && cell.s || 0) + `left:${x}px;top:${y}px;width:${ww}px;height:${h}px;justify-content:${ha === "right" ? "flex-end" : ha === "center" ? "center" : "flex-start"};text-align:${ha};`;
        if (f.color) style += `color:${f.color};`;
        if (cf) { if (cf.bg) style += `background:${cf.bg};`; if (cf.fc) style += `color:${cf.fc};`; if (cf.b) style += "font-weight:700;"; if (cf.i) style += "font-style:italic;"; if (cf.html) extra += cf.html; if (cf.bar) extra += `<i class="db" style="width:${Math.max(2, Math.round((ww - 2) * cf.bar.pct))}px;background:${cf.bar.color}"></i>`; }
        const fbx = S.x.filterBtn ? S.x.filterBtn(sh, r, c) : null; if (fbx) extra += `<b class="fb${fbx.on ? " on" : ""}" data-fb="${c}" data-fr="${r}">▾</b>`;
        return `<div class="${cls}" style="${style}" data-r="${r}" data-c="${c}" ${cell && cell.n ? `title="${esc(cell.n)}"` : ""}><span>${esc(text)}</span>${extra}</div>`;
      }
      function quad(sh, o) {
        // o: x,y,w,h, rs,re,cs,ce, bx,by, z
        if (o.w <= 0 || o.h <= 0 || o.re < o.rs || o.ce < o.cs) return "";
        let h = `<div class="qd" style="left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px;z-index:${o.z}">`;
        if (showGrid && sh.grid !== false) { for (let c = o.cs; c <= o.ce; c++) h += `<i class="gv" style="left:${CX[c + 1] - o.bx - 1}px;height:${o.h}px"></i>`; for (let r = o.rs; r <= o.re; r++) h += `<i class="gh" style="top:${RY[r + 1] - o.by - 1}px;width:${o.w}px"></i>`; }
        const mg = merges(), drawn = new Set(), cells = [];
        const area = (o.re - o.rs + 1) * (o.ce - o.cs + 1);
        if (area > sh.m.size * 1.5) sh.m.forEach((cell, k) => { const [r, c] = C.unkey(k); if (r >= o.rs && r <= o.re && c >= o.cs && c <= o.ce) cells.push([r, c, cell]); });
        else for (let r = o.rs; r <= o.re; r++) for (let c = o.cs; c <= o.ce; c++) { const cell = sh.get(r, c); if (cell) cells.push([r, c, cell]); }
        if (sh.sp && sh.sp.size) sh.sp.forEach((z) => { const r1 = Math.max(o.rs, z.r), r2 = Math.min(o.re, z.r + z.h - 1), c1 = Math.max(o.cs, z.c), c2 = Math.min(o.ce, z.c + z.w - 1); for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (!(r === z.r && c === z.c) && !sh.m.has(C.key(r, c))) cells.push([r, c, null]); });
        const cf0 = S.x.cfAny && S.x.cfAny(sh);
        if (cf0) { const have = new Set(cells.map((a) => C.key(a[0], a[1]))); for (let r = o.rs; r <= o.re; r++) for (let c = o.cs; c <= o.ce; c++) if (!have.has(C.key(r, c)) && S.x.cfEval(sh, r, c, null)) cells.push([r, c, null]); }
        const fb = S.x.filterBtn;
        cells.forEach(([r, c, cell]) => {
          const k = C.key(r, c); if (mg.covered.has(k)) return; if (!cell && !sh.so.has(k) && !(S.x.cfEval && S.x.cfEval(sh, r, c, null))) return; const hh = rh(sh, r), ww = cw(sh, c); if (!hh || !ww) return; const m = mg.anchors.get(k); let w = ww, hgt = hh;
          if (m) { w = CX[m.c2 + 1] - CX[m.c1]; hgt = RY[m.r2 + 1] - RY[m.r1]; drawn.add(k); } let nx = 0; if (!m) { for (let cc = c + 1; cc <= Math.min(o.ce + 6, c + 12); cc++) { const n2 = sh.get(r, cc); if ((n2 && (n2.v != null || n2.f)) || mg.covered.has(C.key(r, cc))) break; nx += cw(sh, cc); } }
          h += cellHtml(sh, r, c, cell, CX[c] - o.bx, RY[r] - o.by, w, hgt, nx);
        });
        mg.list.forEach((m) => { const k = C.key(m.r1, m.c1); if (drawn.has(k) || m.r2 < o.rs || m.r1 > o.re || m.c2 < o.cs || m.c1 > o.ce) return; const cell = sh.get(m.r1, m.c1); if (!cell) { h += `<div class="sc" style="left:${CX[m.c1] - o.bx}px;top:${RY[m.r1] - o.by}px;width:${CX[m.c2 + 1] - CX[m.c1]}px;height:${RY[m.r2 + 1] - RY[m.r1]}px"></div>`; return; } h += cellHtml(sh, m.r1, m.c1, cell, CX[m.c1] - o.bx, RY[m.r1] - o.by, CX[m.c2 + 1] - CX[m.c1], RY[m.r2 + 1] - RY[m.r1], 0); });
        return h + "</div>";
      }
      function headers(sh, vw, vh, cS, cE, rS, rE, fr, fc) {
        let h = "";
        const colsOn = (c) => c >= sel.c1 && c <= sel.c2, rowsOn = (r) => r >= sel.r1 && r <= sel.r2;
        const hq = (x, y, w, hgt, bx, by, items) => `<div class="qd hd" style="left:${x}px;top:${y}px;width:${Math.max(0, w)}px;height:${Math.max(0, hgt)}px;z-index:6">${items}</div>`;
        let a = "", b = "";
        for (let c = 1; c <= fc; c++) { const w = cw(sh, c); if (w) a += `<div class="hc${colsOn(c) ? (whole === "col" ? " al" : " on") : ""}" style="left:${CX[c]}px;top:0;width:${w}px;height:${HH}px">${C.nCol(c)}</div>`; }
        for (let c = cS; c <= cE; c++) { const w = cw(sh, c); if (w) b += `<div class="hc${colsOn(c) ? (whole === "col" ? " al" : " on") : ""}" style="left:${CX[c] - FW - sl - 0}px;top:0;width:${w}px;height:${HH}px">${C.nCol(c)}</div>`; }
        h += hq(HW, 0, FW, HH, 0, 0, a) + hq(HW + FW, 0, vw - HW - FW, HH, 0, 0, b.replace(/left:(-?[\d.]+)px/g, (m, x) => m));
        a = ""; b = "";
        for (let r = 1; r <= fr; r++) { const hh = rh(sh, r); if (hh) a += `<div class="hc${rowsOn(r) ? (whole === "row" ? " al" : " on") : ""}" style="left:0;top:${RY[r]}px;width:${HW}px;height:${hh}px">${r}</div>`; }
        for (let r = rS; r <= rE; r++) { const hh = rh(sh, r); if (hh) b += `<div class="hc${rowsOn(r) ? (whole === "row" ? " al" : " on") : ""}" style="left:0;top:${RY[r] - FH - st}px;width:${HW}px;height:${hh}px">${r}</div>`; }
        h += hq(0, HH, HW, FH, 0, 0, a) + hq(0, HH + FH, HW, vh - HH - FH, 0, 0, b);
        return h + `<div class="corner" title="Select all"></div>`;
      }
      function render() {
        raf = 0; wb.ensureSpills(); if (!CX) layout(); sgv.scrollLeft = 0; sgv.scrollTop = 0; const sh = cs(); sl = sgs.scrollLeft; st = sgs.scrollTop; const vw = sgv.clientWidth, vh = sgv.clientHeight; if (!vw || !vh) return;
        const fr = sh.freeze.r || 0, fc = sh.freeze.c || 0, qw = vw - HW - FW, qh = vh - HH - FH;
        if (st + vh > RY[NR + 1] - 300 && NR < MAXROW) { view(sh).vr = Math.min(MAXROW, NR + 200); layout(); }
        const cS = Math.max(fc + 1, cAt(FW + sl)), cE = Math.min(NC, cAt(FW + sl + qw) + 1), rS = Math.max(fr + 1, rAt(FH + st)), rE = Math.min(NR, rAt(FH + st + qh) + 1);
        let h = "";
        h += quad(sh, { x: HW + FW, y: HH + FH, w: qw, h: qh, rs: rS, re: rE, cs: cS, ce: cE, bx: FW + sl, by: FH + st, z: 1 });
        if (fr) h += quad(sh, { x: HW + FW, y: HH, w: qw, h: FH, rs: 1, re: fr, cs: cS, ce: cE, bx: FW + sl, by: 0, z: 2 });
        if (fc) h += quad(sh, { x: HW, y: HH + FH, w: FW, h: qh, rs: rS, re: rE, cs: 1, ce: fc, bx: 0, by: FH + st, z: 2 });
        if (fr && fc) h += quad(sh, { x: HW, y: HH, w: FW, h: FH, rs: 1, re: fr, cs: 1, ce: fc, bx: 0, by: 0, z: 3 });
        h += headers(sh, vw, vh, cS, cE, rS, rE, fr, fc);
        if (fr) h += `<i class="frz" style="left:${HW}px;top:${HH + FH - 1}px;width:${vw - HW}px;height:2px"></i>`; if (fc) h += `<i class="frz" style="left:${HW + FW - 1}px;top:${HH}px;width:2px;height:${vh - HH}px"></i>`;
        sgl.innerHTML = h; S.x.renderCharts && S.x.renderCharts(); drawOverlay(); placeEditor();
      }
      const sched = () => { if (!raf) raf = requestAnimationFrame(render); };
      function rectOf(r1, c1, r2, c2) { const x1 = sxOf(c1) - HW, y1 = syOf(r1) - HH, x2 = (c2 + 1 <= (cs().freeze.c || 0) ? CX[c2 + 1] : CX[c2 + 1] - sl), y2 = (r2 + 1 <= (cs().freeze.r || 0) ? RY[r2 + 1] : RY[r2 + 1] - st); return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }; }
      S.rectOf = rectOf;
      function drawOverlay() {
        if (!CX) return; const sh = cs(); let h = "";
        if (clip && clip.sheet === sh.name && clip.cut !== undefined) { const q = rectOf(clip.r1, clip.c1, clip.r2, clip.c2); h += `<div class="cp" style="left:${q.x}px;top:${q.y}px;width:${q.w}px;height:${q.h}px"></div>`; }
        const q = rectOf(sel.r1, sel.c1, sel.r2, sel.c2); const a = anchorOf(cur.r, cur.c), ma = mergeOf(cur.r, cur.c), ac = rectOf(ma ? ma.r1 : a.r, ma ? ma.c1 : a.c, ma ? ma.r2 : a.r, ma ? ma.c2 : a.c);
        const single = sel.r1 === sel.r2 && sel.c1 === sel.c2 || (ma && sel.r1 === ma.r1 && sel.r2 === ma.r2 && sel.c1 === ma.c1 && sel.c2 === ma.c2);
        if (!single) { h += `<div class="sl" style="left:${q.x}px;top:${q.y}px;width:${q.w}px;height:${q.h}px"></div><div class="sa" style="left:${ac.x}px;top:${ac.y}px;width:${ac.w}px;height:${ac.h}px;border-width:2px;background:#fff0;outline:1px solid #fff;"></div>`; }
        else h += `<div class="sa" style="left:${q.x}px;top:${q.y}px;width:${q.w}px;height:${q.h}px"></div>`;
        if (!ro) h += `<div class="fh" data-fh="1" style="left:${q.x + q.w - 5}px;top:${q.y + q.h - 5}px"></div>`;
        const dv = S.x.dvAt && S.x.dvAt(sh, a.r, a.c); if (dv && dv.type === "list" && !ro) h += `<div class="dd" data-dd="1" style="left:${ac.x + ac.w - 19}px;top:${ac.y + ac.h - 1}px">▾</div>`;
        if (fill) { const f = rectOf(fill.r1, fill.c1, fill.r2, fill.c2); h += `<div class="fp" style="left:${f.x}px;top:${f.y}px;width:${f.w}px;height:${f.h}px"></div>`; }
        if (S.x.overlayExtra) h += S.x.overlayExtra(sh, rectOf) || "";
        sgx.innerHTML = h; sgx.style.pointerEvents = "none";
      }
      S.drawOverlay = drawOverlay;
      let fill = null;
      sgs.addEventListener("scroll", () => { sched(); });
      new ResizeObserver(() => { sched(); }).observe(sgs);

      /* ---------- undo journal ---------- */
      function tx(fn, label) {
        if (ro) { say("This file is open for viewing only."); return false; } const j = { ops: [], b: { cur: { ...cur }, ext: { ...ext }, sheet: wb.active }, label }; J = j; let ok = true;
        try { fn(); } catch (e) { ok = false; J = null; console.error(e); say("Could not do that: " + e.message); } J = null;
        if (j.ops.length) { j.a = { cur: { ...cur }, ext: { ...ext }, sheet: wb.active }; undo.push(j); if (undo.length > 120) undo.shift(); redo.length = 0; S.bump(); mergeCache = null; changed(); layout(); sched(); rb && rb.refresh(); }
        return ok;
      }
      function putCell(sh, r, c, n) { const o = sh.get(r, c); if (sh.ext.protect && !(S.x.unprotecting) && !wb.style(o && o.s).unl) throw new Error("This cell is locked because the sheet is protected. Use Review ▸ Unprotect sheet to change it."); if (J) J.ops.push({ t: "cell", sh, r, c, o: clone(o), n: clone(n) }); if (n && (n.v != null || n.f || n.s || n.n || n.l)) sh.set(r, c, n); else sh.del(r, c); }
      function setMeta(sh, p, v) { if (J) J.ops.push({ t: "meta", sh, p, o: jc(sh[p]), n: jc(v) }); sh[p] = v; }
      const stateOf = (sh) => { const m = new Map(); sh.m.forEach((c, k) => m.set(k, clone(c))); return { sh, m, cols: jc(sh.cols), rows: jc(sh.rows), merges: jc(sh.merges), cf: jc(sh.cf), charts: jc(sh.charts), dv: jc(sh.dv), filter: jc(sh.filter), hiddenRows: jc(sh.hiddenRows), hiddenCols: jc(sh.hiddenCols), freeze: jc(sh.freeze), ext: jc(sh.ext), name: sh.name }; };
      const restore = (s) => { const sh = s.sh; sh.m = new Map(); s.m.forEach((c, k) => sh.m.set(k, clone(c))); ["cols", "rows", "merges", "cf", "charts", "dv", "filter", "hiddenRows", "hiddenCols", "freeze", "ext", "name"].forEach((p) => (sh[p] = jc(s[p]))); if (!sh.ext) sh.ext = {}; sh.cache = new Map(); };
      function structOp(fn) { // snapshot every sheet before and after (insert/delete/sort/etc.)
        if (!J) return; if (cs().ext.protect && !S.x.unprotecting) throw new Error("This sheet is protected. Use Review ▸ Unprotect sheet first."); const before = wb.sheets.map(stateOf); const names = jc(wb.names); fn(); const after = wb.sheets.map(stateOf); J.ops.push({ t: "state", o: before, n: after, no: names, nn: jc(wb.names) });
      }
      function sheetsOp(fn) { if (!J) return; const o = wb.sheets.slice(), oa = wb.active; fn(); J.ops.push({ t: "sheets", o, oa, n: wb.sheets.slice(), na: wb.active }); }
      mix({ tx, putCell, setMeta, structOp, sheetsOp });
      function apply(op, fwd) {
        if (op.t === "cell") { const v = fwd ? op.n : op.o; if (v) op.sh.set(op.r, op.c, clone(v)); else op.sh.del(op.r, op.c); }
        else if (op.t === "meta") op.sh[op.p] = jc(fwd ? op.n : op.o);
        else if (op.t === "state") { (fwd ? op.n : op.o).forEach(restore); wb.names = jc(fwd ? op.nn : op.no) || {}; }
        else if (op.t === "sheets") { wb.sheets = (fwd ? op.n : op.o).slice(); wb.active = fwd ? op.na : op.oa; }
      }
      function doUndo(isRedo) {
        if (ed) cancelEdit(); const from = isRedo ? redo : undo, to = isRedo ? undo : redo, j = from.pop(); if (!j) { say(isRedo ? "Nothing to redo." : "Nothing to undo."); return; }
        const ops = isRedo ? j.ops : j.ops.slice().reverse(); ops.forEach((op) => apply(op, isRedo)); to.push(j); S.bump(); mergeCache = null; const t = isRedo ? j.a : j.b; if (t.sheet < wb.sheets.length) wb.active = t.sheet; layout(); setSel(t.cur.r, t.cur.c, t.ext.r, t.ext.c); changed(); sched(); drawTabs();
      }
      S.undo = () => doUndo(false); S.redo = () => doUndo(true);

      /* ---------- cell values ---------- */
      function setInput(sh, r, c, text) {
        const old = sh.get(r, c) || {}, p = C.parseInput(text), n = {}; if (old.s) n.s = old.s; if (old.l) n.l = old.l; if (old.n) n.n = old.n; if (old.nf) n.nf = old.nf;
        if (p.f) n.f = p.f; else if (p.v != null) n.v = p.v; if (p.nf && !old.nf && !(old.s && wb.style(old.s).nf)) n.s = wb.styleId(Object.assign({}, wb.style(old.s), { nf: p.nf }));
        putCell(sh, r, c, n);
        if (n.v != null && typeof n.v === "string" && wb.style(n.s).wr) autoRow(sh, r);
      }
      S.setInput = setInput;
      function autoRow(sh, r) {
        if (sh.rows[r]) return; let need = DH; sh.m.forEach((cell, k) => { const [rr, cc] = C.unkey(k); if (rr !== r) return; const st = wb.style(cell.s); if (!st.wr) return; const t = wb.text(sh, rr, cc).text; const w = (sh.cols[cc] || DW) - 8, fs = (st.fs || 11) * 1.3333, per = Math.max(1, Math.floor(w / (fs * 0.5))); let lines = 0; String(t).split("\n").forEach((ln) => (lines += Math.max(1, Math.ceil(ln.length / per)))); need = Math.max(need, Math.ceil(lines * fs * 1.25 + 4)); });
        if (need > DH) setMeta(sh, "rows", Object.assign({}, sh.rows, { [r]: need }));
      }
      S.autoRow = autoRow;
      function eachSel(create, fn, s) {
        s = s || sel; const sh = cs(), [ur, uc] = sh.dims(); const r2 = whole === "col" || s.r2 >= 1048576 ? Math.min(s.r2, Math.max(ur + 30, 300)) : s.r2, c2 = whole === "row" ? Math.min(s.c2, Math.max(uc + 5, 52)) : s.c2;
        for (let r = s.r1; r <= r2; r++) for (let c = s.c1; c <= c2; c++) fn(r, c, sh.get(r, c));
      }
      S.eachSel = eachSel;
      function styleSel(patch) {
        tx(() => { const sh = cs(); eachSel(true, (r, c, cell) => { const st = Object.assign({}, wb.style(cell && cell.s)); const ns = typeof patch === "function" ? patch(st, r, c) : Object.assign(st, patch); const sid = wb.styleId(ns); if ((cell ? cell.s || 0 : 0) === sid) return; const n = cell ? clone(cell) : {}; if (sid) n.s = sid; else delete n.s; putCell(sh, r, c, n); }); });
      }
      S.styleSel = styleSel;
      const curStyle = () => { const a = anchorOf(cur.r, cur.c), cell = cs().get(a.r, a.c); return Object.assign({}, wb.style(cell && cell.s)); };
      S.curStyle = curStyle;
      const toggle = (k) => styleSel({ [k]: curStyle()[k] ? null : 1 });
      const curNf = () => { const a = anchorOf(cur.r, cur.c), cell = cs().get(a.r, a.c); return (cell && wb.numFmt(cell, null)) || "General"; };
      function bumpDec(d) {
        let nf = curNf(); if (nf === "General" || nf === "@") { if (d < 0) return; nf = "0.0"; styleSel({ nf }); return; }
        const m = /([0#?])(\.([0#?]+))?/.exec(nf.replace(/"[^"]*"/g, (x) => "\u0001".repeat(x.length))); if (!m) return; const dec = m[3] ? m[3].length : 0, nd = Math.max(0, Math.min(15, dec + d)); const rep = m[1] + (nd ? "." + "0".repeat(nd) : "");
        const start = m.index, len = m[0].length; styleSel({ nf: nf.slice(0, start) + rep + nf.slice(start + len) });
      }

      /* ---------- editing ---------- */
      function placeEditor() {
        if (!ed) return; const m = mergeOf(ed.r, ed.c), q = rectOf(m ? m.r1 : ed.r, m ? m.c1 : ed.c, m ? m.r2 : ed.r, m ? m.c2 : ed.c); const sh = cs(), st0 = wb.style((sh.get(ed.r, ed.c) || {}).s);
        const lines = ta.value.split("\n"); const wantW = Math.max(q.w, Math.min(sgv.clientWidth - HW - q.x - 10, Math.max(...lines.map((l) => textWidthEst(l, st0.fs || 11, st0.b))) + 24)); ta.style.left = HW + q.x + "px"; ta.style.top = HH + q.y + "px"; ta.style.width = wantW + "px";
        ta.style.fontSize = ((st0.fs || 11) * 1.3333 * Zm).toFixed(2) + "px"; ta.style.fontFamily = st0.ff ? `'${st0.ff}',Calibri,Arial,sans-serif` : ""; ta.style.fontWeight = st0.b ? "700" : ""; ta.style.fontStyle = st0.i ? "italic" : ""; ta.style.height = Math.max(q.h, lines.length * (st0.fs || 11) * 1.6 * Zm + 6) + "px";
      }
      function startEdit(text, keepSel) {
        if (ro) { say("This file is open for viewing only."); return; } const a = anchorOf(cur.r, cur.c); const sh = cs(); if (sh.ext.protect && !wb.style((sh.get(a.r, a.c) || {}).s).unl) { say("This cell is locked because the sheet is protected. Use Review ▸ Unprotect sheet to change it."); return; } if (text == null) text = rawText(sh, a.r, a.c);
        ed = { r: a.r, c: a.c, ptr: null, sheet: sh.name }; ta.hidden = false; ta.value = text; fi.value = text; placeEditor(); ta.focus({ preventScroll: true }); const e = ta.value.length; ta.setSelectionRange(keepSel ? 0 : e, e); S.x.acShow && S.x.acShow(ta, true);
      }
      S.startEdit = startEdit;
      function insertAtCaret(t) { if (!ed) startEdit("="); const src = ed.src === "bar" ? fi : ta; const s = src.selectionStart, e = src.selectionEnd, v = src.value; src.value = v.slice(0, s) + t + v.slice(e); src.selectionStart = src.selectionEnd = s + t.length; src.focus({ preventScroll: true }); ta.value = src.value; fi.value = src.value; placeEditor(); }
      S.insertAtCaret = insertAtCaret;
      function cancelEdit() { if (!ed) return; ed = null; ta.hidden = true; S.x.acHide && S.x.acHide(); sgv.focus({ preventScroll: true }); syncBar(); drawOverlay(); sched(); }
      function commit(dr, dc) {
        if (!ed) return true; const text = (ed.src === "bar" ? fi : ta).value, { r, c } = ed, sh = cs(); const old = rawText(sh, r, c); let ok = true;
        if (text !== old || !sh.get(r, c)) { const err = S.x.dvCheck ? S.x.dvCheck(sh, r, c, text) : null; if (err) { say(err); ta.focus(); return false; } }
        ed = null; ta.hidden = true; S.x.acHide && S.x.acHide(); if (text !== old) tx(() => { setInput(sh, r, c, text); if (S.x.onEdit) S.x.onEdit(sh, r, c, text); }, "edit");
        sgv.focus({ preventScroll: true }); if (dr || dc) moveSel(dr, dc, false); else { syncBar(); drawOverlay(); } sched(); return ok;
      }
      S.commit = commit; S.cancelEdit = cancelEdit;
      const canPoint = (el) => { if (!ed || !/^=/.test(el.value)) return false; if (ed.ptr) return true; const s = el.selectionStart; if (s !== el.selectionEnd && false) return false; const b = el.value.slice(0, s).replace(/\s+$/, ""); return !b.length ? false : /[=(,+\-*/^&<>;:]$/.test(b); };
      function point(r, c, r2, c2, extend) {
        const el = ed.src === "bar" ? fi : ta; let txt = (r === r2 && c === c2 ? C.addr(r, c) : C.addr(Math.min(r, r2), Math.min(c, c2)) + ":" + C.addr(Math.max(r, r2), Math.max(c, c2)));
        if (cs().name !== ed.sheet) txt = (/[^A-Za-z0-9_]/.test(cs().name) ? "'" + cs().name.replace(/'/g, "''") + "'" : cs().name) + "!" + txt;
        if (!ed.ptr) { const s = el.selectionStart; ed.ptr = { s, e: s + txt.length, r, c, r2, c2 }; el.value = el.value.slice(0, s) + txt + el.value.slice(el.selectionEnd); } else { el.value = el.value.slice(0, ed.ptr.s) + txt + el.value.slice(ed.ptr.e); ed.ptr.e = ed.ptr.s + txt.length; ed.ptr.r = r; ed.ptr.c = c; ed.ptr.r2 = r2; ed.ptr.c2 = c2; }
        el.setSelectionRange(ed.ptr.e, ed.ptr.e); ta.value = el.value; fi.value = el.value; placeEditor(); const q = rectOf(Math.min(r, r2), Math.min(c, c2), Math.max(r, r2), Math.max(c, c2)); fill = { r1: Math.min(r, r2), c1: Math.min(c, c2), r2: Math.max(r, r2), c2: Math.max(c, c2) }; drawOverlay();
      }
      const onEditKey = (e, el) => {
        const k = e.key; if (S.x.acKey && S.x.acKey(e, el)) return;
        if (k === "Enter" && !e.altKey) { e.preventDefault(); if (e.ctrlKey && sel.r2 > sel.r1 || e.ctrlKey && sel.c2 > sel.c1) { const t = el.value; if (!ed) return; commitAll(t); return; } if (el.dataset.noenter) return; commit(e.shiftKey ? -1 : 1, 0); }
        else if (k === "Enter" && e.altKey) { const s = el.selectionStart; el.value = el.value.slice(0, s) + "\n" + el.value.slice(el.selectionEnd); el.selectionStart = el.selectionEnd = s + 1; ta.value = el.value; fi.value = el.value; placeEditor(); e.preventDefault(); }
        else if (k === "Tab") { e.preventDefault(); commit(0, e.shiftKey ? -1 : 1); } else if (k === "Escape") { e.preventDefault(); fill = null; cancelEdit(); }
        else if (/^Arrow/.test(k) && !e.shiftKey && !e.ctrlKey && canPoint(el)) { e.preventDefault(); const base = ed.ptr ? { r: ed.ptr.r, c: ed.ptr.c } : anchorOf(cur.r, cur.c); const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k]; const nr = Math.max(1, base.r + d[0]), nc = Math.max(1, base.c + d[1]); point(nr, nc, nr, nc); }
        else if (/^Arrow/.test(k) && e.shiftKey && ed.ptr) { e.preventDefault(); const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k]; if (!d) return; point(ed.ptr.r, ed.ptr.c, Math.max(1, ed.ptr.r2 + d[0]), Math.max(1, ed.ptr.c2 + d[1])); }
        else if (k === "F4" && /^=/.test(el.value)) { e.preventDefault(); cycleAbs(el); }
        else if (!/^(Shift|Control|Alt|Meta|Arrow|Home|End)/.test(k)) { if (ed) ed.ptr = null; fill = null; }
      };
      function cycleAbs(el) { const v = el.value, s = el.selectionStart; const m = /\$?[A-Za-z]{1,3}\$?\d+/g; let x; while ((x = m.exec(v))) { if (s >= x.index && s <= x.index + x[0].length) { const mm = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(x[0]); const st = (mm[1] ? 1 : 0) + (mm[3] ? 2 : 0); const nx = (st + 1) % 4; const t = (nx & 1 ? "$" : "") + mm[2] + (nx & 2 ? "$" : "") + mm[4]; el.value = v.slice(0, x.index) + t + v.slice(x.index + x[0].length); el.setSelectionRange(x.index + t.length, x.index + t.length); ta.value = el.value; fi.value = el.value; return; } } }
      function commitAll(text) { const sh = cs(), r0 = sel.r1, c0 = sel.c1; ed = null; ta.hidden = true; tx(() => eachSel(false, (r, c) => { const cell = sh.get(r, c); if (!mergeOf(r, c) || (mergeOf(r, c).r1 === r && mergeOf(r, c).c1 === c)) setInput(sh, r, c, /^=/.test(text) ? C.shift(text, r - cur.r, c - cur.c) : text); })); sgv.focus({ preventScroll: true }); syncBar(); sched(); }
      ta.addEventListener("keydown", (e) => { ed && (ed.src = "cell"); onEditKey(e, ta); e.stopPropagation(); });
      ta.addEventListener("input", () => { if (!ed) return; ed.src = "cell"; fi.value = ta.value; ed.ptr = null; fill = null; placeEditor(); S.x.acShow && S.x.acShow(ta); });
      ta.addEventListener("blur", () => { /* committing on blur is done by explicit clicks elsewhere */ });
      fi.addEventListener("focus", () => { if (ro || ed) return; const a = anchorOf(cur.r, cur.c); ed = { r: a.r, c: a.c, ptr: null, sheet: cs().name, src: "bar" }; });
      fi.addEventListener("input", () => { if (!ed) return; ed.src = "bar"; ta.hidden = false; ta.value = fi.value; ed.ptr = null; placeEditor(); S.x.acShow && S.x.acShow(fi); });
      fi.addEventListener("keydown", (e) => { if (ed) ed.src = "bar"; onEditKey(e, fi); e.stopPropagation(); });
      fi.addEventListener("blur", () => { setTimeout(() => { if (ed && ed.src === "bar" && document.activeElement !== ta && document.activeElement !== fi && !(document.activeElement && document.activeElement.closest && document.activeElement.closest(".rbm"))) commit(0, 0); }, 120); });
      nb.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { goTo(nb.value); sgv.focus(); } else if (e.key === "Escape") { syncBar(); sgv.focus(); } });
      nb.addEventListener("focus", () => nb.select());
      function goTo(t) {
        t = String(t || "").trim().replace(/\$/g, ""); if (!t) return; let m = /^([A-Za-z]{1,3})(\d+)(?::([A-Za-z]{1,3})(\d+))?$/.exec(t);
        if (m) { const a = C.parseAddr(m[1] + m[2]), b = m[3] ? C.parseAddr(m[3] + m[4]) : a; setSel(a.r, a.c, b.r, b.c); return; }
        m = /^([A-Za-z]{1,3}):([A-Za-z]{1,3})$/.exec(t); if (m) { setSel(1, C.colN(m[1]), 1, C.colN(m[2]), "col"); sel.r1 = 1; sel.r2 = MAXROW; syncBar(); drawOverlay(); return; }
        const nm = wb.names[t.toLowerCase()]; if (nm) { const mm = /^=?(?:'?([^'!]+)'?!)?\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/i.exec(nm); if (mm) { if (mm[1] && wb.sheet(mm[1])) { wb.active = wb.sheets.indexOf(wb.sheet(mm[1])); layout(); drawTabs(); } const a = C.parseAddr(mm[2] + mm[3]), b = mm[4] ? C.parseAddr(mm[4] + mm[5]) : a; setSel(a.r, a.c, b.r, b.c); return; } }
        say("“" + t + "” is not a cell address or a name. Examples: B7, A1:D20 or a name you defined."); syncBar();
      }
      S.goTo = goTo;

      /* ---------- navigation ---------- */
      function step(r, c, dr, dc) {
        const sh = cs(), m = mergeOf(r, c); if (m) { if (dr > 0) r = m.r2; if (dr < 0) r = m.r1; if (dc > 0) c = m.c2; if (dc < 0) c = m.c1; }
        let guard = 0; do { r += dr; c += dc; guard++; } while (((sh.hiddenRows && sh.hiddenRows[r]) || (sh.hiddenCols && sh.hiddenCols[c])) && guard < 5000 && r > 0 && c > 0 && r < MAXROW && c < MAXCOL);
        return { r: Math.max(1, Math.min(MAXROW, r)), c: Math.max(1, Math.min(MAXCOL, c)) };
      }
      function moveSel(dr, dc, extend) {
        if (extend) { const n = step(ext.r, ext.c, dr, dc); setSel(cur.r, cur.c, n.r, n.c); return; }
        // inside a multi-cell selection Enter/Tab move within it
        if ((sel.r2 > sel.r1 || sel.c2 > sel.c1) && !mergeOf(cur.r, cur.c)) { let r = cur.r + dr, c = cur.c + dc; if (dc && !dr) { if (c > sel.c2) { c = sel.c1; r = cur.r + 1; } else if (c < sel.c1) { c = sel.c2; r = cur.r - 1; } if (r > sel.r2) r = sel.r1; if (r < sel.r1) r = sel.r2; } else if (dr && !dc) { if (r > sel.r2) { r = sel.r1; c = cur.c + 1; } else if (r < sel.r1) { r = sel.r2; c = cur.c - 1; } if (c > sel.c2) c = sel.c1; if (c < sel.c1) c = sel.c2; } const keep = { ...sel }; cur = { r, c }; ext = { r, c }; syncBar(); sel = keep; drawOverlay(); scrollInto(r, c); rb && rb.refresh(); return; }
        const n = step(cur.r, cur.c, dr, dc); setSel(n.r, n.c);
      }
      function jump(dr, dc, extend) {
        const sh = cs(), has = (r, c) => { const x = sh.get(r, c); return x && (x.v != null || x.f); }; let r = extend ? ext.r : cur.r, c = extend ? ext.c : cur.c; const [ur, uc] = sh.dims();
        const inb = (r, c) => r >= 1 && c >= 1 && r <= Math.min(MAXROW, Math.max(ur, 1) + (dr > 0 ? 0 : 0)) + 0 && c <= Math.max(uc, 1) + 0;
        const next = (r, c) => ({ r: r + dr, c: c + dc }); let p = next(r, c);
        if (p.r < 1 || p.c < 1) { p = { r: Math.max(1, r), c: Math.max(1, c) }; } else if (has(r, c) && has(p.r, p.c)) { while (p.r + dr >= 1 && p.c + dc >= 1 && has(p.r + dr, p.c + dc) && p.r < MAXROW && p.c < MAXCOL) p = next(p.r, p.c); } else { let g = 0; while (!has(p.r, p.c) && p.r >= 1 && p.c >= 1 && p.r <= Math.max(ur, 1) + 1 && p.c <= Math.max(uc, 1) + 1 && g++ < 1e6) { const q = next(p.r, p.c); if (q.r < 1 || q.c < 1 || q.r > ur + 0 && dr > 0 || q.c > uc && dc > 0) { p = dr > 0 ? { r: Math.max(ur, p.r), c: p.c } : dc > 0 ? { r: p.r, c: Math.max(uc, p.c) } : { r: Math.max(1, q.r), c: Math.max(1, q.c) }; break; } p = q; } }
        p.r = Math.max(1, Math.min(MAXROW, p.r)); p.c = Math.max(1, Math.min(MAXCOL, p.c)); if (extend) setSel(cur.r, cur.c, p.r, p.c); else setSel(p.r, p.c);
      }

      /* ---------- mouse ---------- */
      const rectV = () => sgv.getBoundingClientRect();
      function hit(e) {
        const q = rectV(), x = e.clientX - q.left, y = e.clientY - q.top, sh = cs(), fr = sh.freeze.r || 0, fc = sh.freeze.c || 0;
        const lx = x - HW, ly = y - HH; const cc = x < HW ? 0 : Math.max(1, cAt(lx < FW ? lx : lx + sl)), rr = y < HH ? 0 : Math.max(1, rAt(ly < FH ? ly : ly + st));
        return { x, y, r: rr, c: cc, area: x < HW && y < HH ? "corner" : y < HH ? "ch" : x < HW ? "rh" : "cell" };
      }
      function borderAt(h) { // near a column/row header boundary?
        const sh = cs(); if (h.area === "ch") { const c = h.c; const xr = sxOf(c) + cw(sh, c); if (Math.abs(h.x - xr) <= 4) return { axis: "c", i: c }; const p = c - 1; if (p >= 1 && Math.abs(h.x - sxOf(c)) <= 4) return { axis: "c", i: p }; }
        if (h.area === "rh") { const r = h.r; const yb = syOf(r) + rh(sh, r); if (Math.abs(h.y - yb) <= 4) return { axis: "r", i: r }; const p = r - 1; if (p >= 1 && Math.abs(h.y - syOf(r)) <= 4) return { axis: "r", i: p }; }
        return null;
      }
      let drag = null;
      sgv.addEventListener("mousedown", (e) => {
        if (e.button === 2) { const h = hit(e); if (h.area === "cell" && !(h.r >= sel.r1 && h.r <= sel.r2 && h.c >= sel.c1 && h.c <= sel.c2)) setSel(h.r, h.c); else if (h.area === "ch" && !(h.c >= sel.c1 && h.c <= sel.c2 && whole === "col")) { setSel(1, h.c, 1, h.c, "col"); sel.r2 = MAXROW; syncBar(); drawOverlay(); } else if (h.area === "rh" && !(h.r >= sel.r1 && h.r <= sel.r2 && whole === "row")) { setSel(h.r, 1, h.r, 1, "row"); sel.c2 = MAXCOL; syncBar(); drawOverlay(); } return; }
        if (e.button !== 0) return; if (e.target === ta) return; if (e.target.closest && e.target.closest(".chart")) return;
        const fbEl = e.target.closest && e.target.closest(".fb"); if (fbEl) { e.preventDefault(); S.x.filterMenu && S.x.filterMenu(+fbEl.dataset.fb, fbEl, +fbEl.dataset.fr); return; }
        if (e.target.dataset && e.target.dataset.dd) { e.preventDefault(); S.x.dvMenu && S.x.dvMenu(e.target); return; }
        const h = hit(e);
        if (ed) { if (ed.ptr !== undefined && /^=/.test((ed.src === "bar" ? fi : ta).value) && h.area === "cell" && canPoint(ed.src === "bar" ? fi : ta)) { e.preventDefault(); point(h.r, h.c, h.r, h.c); drag = { t: "ptr", r: h.r, c: h.c }; return; } if (!commit(0, 0)) { e.preventDefault(); return; } }
        sgv.focus({ preventScroll: true });
        if (e.target.dataset && e.target.dataset.fh) { e.preventDefault(); drag = { t: "fill" }; fill = { ...sel }; return; }
        if (h.area === "corner") { setSel(1, 1, MAXROW, MAXCOL); sel = { r1: 1, c1: 1, r2: MAXROW, c2: MAXCOL }; whole = "all"; cur = { r: 1, c: 1 }; drawOverlay(); statusStats(); return; }
        const bd = borderAt(h); if (bd) { e.preventDefault(); const sh = cs(); drag = { t: "size", axis: bd.axis, i: bd.i, p0: bd.axis === "c" ? e.clientX : e.clientY, s0: bd.axis === "c" ? (sh.cols[bd.i] || DW) : (sh.rows[bd.i] || DH), sh }; return; }
        if (h.area === "ch") { e.preventDefault(); const anchor = e.shiftKey ? cur.c : h.c; setSel(1, anchor, 1, h.c, "col"); sel.r1 = 1; sel.r2 = MAXROW; sel.c1 = Math.min(anchor, h.c); sel.c2 = Math.max(anchor, h.c); whole = "col"; syncBar(); drawOverlay(); drag = { t: "col", a: anchor }; return; }
        if (h.area === "rh") { e.preventDefault(); const anchor = e.shiftKey ? cur.r : h.r; setSel(anchor, 1, h.r, 1, "row"); sel.c1 = 1; sel.c2 = MAXCOL; sel.r1 = Math.min(anchor, h.r); sel.r2 = Math.max(anchor, h.r); whole = "row"; syncBar(); drawOverlay(); drag = { t: "row", a: anchor }; return; }
        e.preventDefault(); if (e.shiftKey) setSel(cur.r, cur.c, h.r, h.c); else setSel(h.r, h.c); drag = { t: "sel" };
        if (e.ctrlKey && cs().m.get(C.key(h.r, h.c)) && cs().m.get(C.key(h.r, h.c)).l && !e.shiftKey) { const l = cs().m.get(C.key(h.r, h.c)).l; if (/^https?:\/\//i.test(l)) window.open(l, "_blank", "noopener"); }
      });
      window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
      let scrollTimer = 0;
      function onMove(e) {
        if (!drag) return; const sh = cs();
        if (drag.t === "size") { const d = (drag.axis === "c" ? e.clientX : e.clientY) - drag.p0, v = Math.max(drag.axis === "c" ? 12 : 8, Math.round(drag.s0 + d / Zm)); if (drag.axis === "c") sh.cols[drag.i] = v; else sh.rows[drag.i] = v; layout(); sched(); return; }
        const h = hit(e), q = rectV(); autoScroll(e);
        if (drag.t === "sel") { if (h.area === "cell" || h.area === "ch" || h.area === "rh") { const r = h.r || ext.r, c = h.c || ext.c; setSel(cur.r, cur.c, r, c); } }
        else if (drag.t === "ptr") { if (h.area === "cell") point(drag.r, drag.c, h.r, h.c); }
        else if (drag.t === "col") { setSel(1, drag.a, 1, h.c || ext.c, "col"); sel.r1 = 1; sel.r2 = MAXROW; sel.c1 = Math.min(drag.a, h.c || drag.a); sel.c2 = Math.max(drag.a, h.c || drag.a); whole = "col"; syncBar(); drawOverlay(); }
        else if (drag.t === "row") { setSel(drag.a, 1, h.r || ext.r, 1, "row"); sel.c1 = 1; sel.c2 = MAXCOL; sel.r1 = Math.min(drag.a, h.r || drag.a); sel.r2 = Math.max(drag.a, h.r || drag.a); whole = "row"; syncBar(); drawOverlay(); }
        else if (drag.t === "fill" && h.area === "cell") { const dr = h.r > sel.r2 ? h.r - sel.r2 : h.r < sel.r1 ? h.r - sel.r1 : 0, dc = h.c > sel.c2 ? h.c - sel.c2 : h.c < sel.c1 ? h.c - sel.c1 : 0; if (Math.abs(dr) >= Math.abs(dc) && dr) fill = { r1: Math.min(sel.r1, h.r), r2: Math.max(sel.r2, h.r), c1: sel.c1, c2: sel.c2 }; else if (dc) fill = { r1: sel.r1, r2: sel.r2, c1: Math.min(sel.c1, h.c), c2: Math.max(sel.c2, h.c) }; else fill = { ...sel }; drawOverlay(); }
      }
      function autoScroll(e) { const q = rectV(); let dx = 0, dy = 0; if (e.clientX > q.right - 16) dx = 24; else if (e.clientX < q.left + HW + 16 && sl > 0) dx = -24; if (e.clientY > q.bottom - 16) dy = 28; else if (e.clientY < q.top + HH + 16 && st > 0) dy = -28; if (dx || dy) { sgs.scrollLeft += dx; sgs.scrollTop += dy; } }
      function onUp(e) {
        if (!drag) return; const d = drag; drag = null;
        if (d.t === "size") { const sh = d.sh; const nv = d.axis === "c" ? sh.cols[d.i] : sh.rows[d.i]; if (d.axis === "c") sh.cols[d.i] = d.s0; else sh.rows[d.i] = d.s0; const mult = (d.axis === "c" ? (whole === "col" && d.i >= sel.c1 && d.i <= sel.c2) : (whole === "row" && d.i >= sel.r1 && d.i <= sel.r2)); tx(() => { const o = Object.assign({}, d.axis === "c" ? sh.cols : sh.rows); const n = Object.assign({}, o); if (mult) { for (let i = d.axis === "c" ? sel.c1 : sel.r1; i <= (d.axis === "c" ? sel.c2 : sel.r2); i++) n[i] = nv; } else n[d.i] = nv; setMeta(sh, d.axis === "c" ? "cols" : "rows", n); }); return; }
        if (d.t === "fill") { const f = fill; fill = null; if (f && (f.r1 !== sel.r1 || f.r2 !== sel.r2 || f.c1 !== sel.c1 || f.c2 !== sel.c2)) { const src = { ...sel }; tx(() => autoFill(src, f, false), "fill"); setSel(Math.min(src.r1, f.r1), Math.min(src.c1, f.c1), Math.max(src.r2, f.r2), Math.max(src.c2, f.c2)); } else drawOverlay(); return; }
        if (d.t === "ptr") { return; }
      }
      sgv.addEventListener("dblclick", (e) => {
        if (e.target.closest && (e.target.closest(".chart") || e.target.closest(".fb"))) return; if (e.target.dataset && e.target.dataset.fh) { fillDownAuto(); return; } const h = hit(e);
        const bd = borderAt(h); if (bd) { autoFit(bd.axis, bd.i); return; } if (h.area !== "cell") return; if (ed) return; startEdit(null, false);
      });
      sgv.addEventListener("contextmenu", (e) => { e.preventDefault(); const h = hit(e); if (h.area === "corner") return; S.x.contextMenu ? S.x.contextMenu(e, h) : null; });
      sgv.addEventListener("wheel", (e) => { if (e.ctrlKey) { e.preventDefault(); setZoom(Math.round(Zm * 100 + (e.deltaY < 0 ? 10 : -10))); } }, { passive: false });
      S.hit = hit;

      /* ---------- fill ---------- */
      function seriesOf(vals, src) {
        // vals: array of cells (clones) ; returns f(k) -> new cell for k-th generated item (k=1.. forward or -1.. backwards)
        const n = vals.length; const raw = vals.map((c) => (c ? c.v : null)); const allNum = raw.every((v) => typeof v === "number") && vals.every((c) => c && !c.f);
        if (allNum) {
          let step = 0; if (n >= 2) { if (n === 2) step = raw[1] - raw[0]; else { const mx = (n - 1) / 2, my = raw.reduce((a, b) => a + b, 0) / n; let nu = 0, de = 0; raw.forEach((y, i) => { nu += (i - mx) * (y - my); de += (i - mx) * (i - mx); }); step = de ? nu / de : 0; } }
          else { const nf = wb.numFmt(vals[0], raw[0]); step = isDateNf(nf) ? 1 : 0; }
          return (k) => ({ v: +(raw[k > 0 ? n - 1 : 0] + step * (k > 0 ? k : k)).toPrecision(14) });
        }
        if (n === 1 && vals[0] && !vals[0].f && typeof raw[0] === "string") {
          const s = raw[0], low = s.toLowerCase(); for (const L of LISTS) { const i = L.indexOf(low); if (i >= 0) return (k) => { const t = L[(((i + k) % L.length) + L.length) % L.length]; return { v: s === s.toUpperCase() ? t.toUpperCase() : s[0] === s[0].toUpperCase() ? t[0].toUpperCase() + t.slice(1) : t }; }; }
          const m = /^(.*?)(\d+)(\D*)$/.exec(s); if (m) { const w = m[2].length, z = m[2][0] === "0"; return (k) => { const nv = +m[2] + k; return { v: m[1] + (z ? String(Math.max(0, nv)).padStart(w, "0") : String(nv)) + m[3] }; }; }
        }
        if (n >= 2 && vals.every((c) => c && !c.f && typeof c.v === "string")) { const ms = vals.map((c) => /^(.*?)(\d+)(\D*)$/.exec(c.v)); if (ms.every(Boolean) && ms.every((m) => m[1] === ms[0][1] && m[3] === ms[0][3])) { const nums = ms.map((m) => +m[2]), stp = nums[1] - nums[0]; return (k) => ({ v: ms[0][1] + String((k > 0 ? nums[n - 1] : nums[0]) + stp * k) + ms[0][3] }); } }
        return null;
      }
      function autoFill(src, dst, copyOnly) {
        const sh = cs(); const down = dst.r2 > src.r2, up = dst.r1 < src.r1, right = dst.c2 > src.c2, left = dst.c1 < src.c1;
        const vert = down || up; const base = (r, c) => { const x = sh.get(r, c); return x ? clone(x) : null; };
        if (vert) { for (let c = src.c1; c <= src.c2; c++) { const vals = []; for (let r = src.r1; r <= src.r2; r++) vals.push(base(r, c)); const ser = copyOnly ? null : seriesOf(vals, src); const n = vals.length;
          const gen = (r, k) => { const si = (((k - 1) % n) + n) % n; const sc = vals[k > 0 ? si : (n - 1 - ((((-k) - 1) % n))) ]; const cell = sc ? clone(sc) : null; const i = k > 0 ? ((k - 1) % n) : (n - 1 - ((-k - 1) % n)); const srcCell = vals[i]; const rowOff = r - (src.r1 + i); let o = srcCell ? clone(srcCell) : {}; if (srcCell && srcCell.f) o.f = C.shift(srcCell.f, rowOff, 0); else if (ser && k) { const nv = ser(k); Object.assign(o, nv); delete o.f; } return o; };
          if (down) for (let r = src.r2 + 1; r <= dst.r2; r++) { const o = gen(r, r - src.r2); putCell(sh, r, c, o && (o.v != null || o.f || o.s) ? o : null); }
          if (up) for (let r = src.r1 - 1; r >= dst.r1; r--) { const o = gen(r, r - src.r1); putCell(sh, r, c, o && (o.v != null || o.f || o.s) ? o : null); } } }
        else { for (let r = src.r1; r <= src.r2; r++) { const vals = []; for (let c = src.c1; c <= src.c2; c++) vals.push(base(r, c)); const ser = copyOnly ? null : seriesOf(vals, src); const n = vals.length;
          const gen = (c, k) => { const i = k > 0 ? ((k - 1) % n) : (n - 1 - ((-k - 1) % n)); const srcCell = vals[i]; const off = c - (src.c1 + i); let o = srcCell ? clone(srcCell) : {}; if (srcCell && srcCell.f) o.f = C.shift(srcCell.f, 0, off); else if (ser && k) { Object.assign(o, ser(k)); delete o.f; } return o; };
          if (right) for (let c = src.c2 + 1; c <= dst.c2; c++) { const o = gen(c, c - src.c2); putCell(sh, r, c, o && (o.v != null || o.f || o.s) ? o : null); }
          if (left) for (let c = src.c1 - 1; c >= dst.c1; c--) { const o = gen(c, c - src.c1); putCell(sh, r, c, o && (o.v != null || o.f || o.s) ? o : null); } } }
      }
      function fillDownAuto() {
        const sh = cs(); const c = sel.c1 > 1 ? sel.c1 - 1 : sel.c2 + 1; let r = sel.r2; const has = (rr, cc) => { const x = sh.get(rr, cc); return x && (x.v != null || x.f); }; let end = sel.r2; for (let rr = sel.r2 + 1; rr < sel.r2 + 100000 && has(rr, c); rr++) end = rr;
        if (end > sel.r2) { const src = { ...sel }; tx(() => autoFill(src, { r1: src.r1, c1: src.c1, c2: src.c2, r2: end }, false)); setSel(src.r1, src.c1, end, src.c2); } else say("Nothing to fill: the column next to it is empty.");
      }
      S.fillDirection = (dir) => { const src = dir === "down" || dir === "up" ? { r1: dir === "down" ? sel.r1 : sel.r2, r2: dir === "down" ? sel.r1 : sel.r2, c1: sel.c1, c2: sel.c2 } : { r1: sel.r1, r2: sel.r2, c1: dir === "right" ? sel.c1 : sel.c2, c2: dir === "right" ? sel.c1 : sel.c2 }; const dst = dir === "down" ? { ...src, r2: sel.r2 } : dir === "up" ? { ...src, r1: sel.r1 } : dir === "right" ? { ...src, c2: sel.c2 } : { ...src, c1: sel.c1 }; if (dir === "down" && sel.r2 === sel.r1 || dir === "right" && sel.c2 === sel.c1) { say("Select the cell to copy and the cells below/right of it first."); return; } tx(() => autoFill(src, dst, true)); };
      S.autoFill = autoFill;

      /* ---------- clipboard ---------- */
      function tsvOf(s) { const sh = cs(); const rows = []; for (let r = s.r1; r <= s.r2; r++) { const row = []; for (let c = s.c1; c <= s.c2; c++) { let t = wb.text(sh, r, c).text; if (/[\t\n"]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"'; row.push(t); } rows.push(row.join("\t")); } return rows.join("\r\n"); }
      function htmlOf(s) { const sh = cs(); let h = "<table>"; for (let r = s.r1; r <= s.r2; r++) { h += "<tr>"; for (let c = s.c1; c <= s.c2; c++) { const cell = sh.get(r, c), st = wb.style(cell && cell.s); h += `<td style="${st.b ? "font-weight:bold;" : ""}${st.i ? "font-style:italic;" : ""}${st.bg ? "background:" + st.bg + ";" : ""}${st.fc ? "color:" + st.fc + ";" : ""}border:1px solid #ccc">${esc(wb.text(sh, r, c).text)}</td>`; } h += "</tr>"; } return h + "</table>"; }
      function doCopy(e, cut) {
        if (ed) return; const s = { ...sel }; if (whole) { const [ur, uc] = cs().dims(); if (whole === "col" || whole === "all") s.r2 = Math.min(s.r2, Math.max(ur, 1)); if (whole === "row" || whole === "all") s.c2 = Math.min(s.c2, Math.max(uc, 1)); }
        const sh = cs(), cells = []; for (let r = s.r1; r <= s.r2; r++) { const row = []; for (let c = s.c1; c <= s.c2; c++) row.push(clone(sh.get(r, c))); cells.push(row); }
        const ms = merges().list.filter((m) => m.r1 >= s.r1 && m.r2 <= s.r2 && m.c1 >= s.c1 && m.c2 <= s.c2).map((m) => ({ r1: m.r1 - s.r1, c1: m.c1 - s.c1, r2: m.r2 - s.r1, c2: m.c2 - s.c1 }));
        const tsv = tsvOf(s); clip = { sheet: sh.name, r1: s.r1, c1: s.c1, r2: s.r2, c2: s.c2, cells, ms, tsv, cut: cut ? true : false }; if (!cut) clip.cut = false;
        if (e && e.clipboardData) { e.clipboardData.setData("text/plain", tsv); e.clipboardData.setData("text/html", htmlOf(s)); e.preventDefault(); } else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tsv).catch(() => {});
        drawOverlay(); say(cut ? "Cut. Pick the place and paste." : "Copied.", true);
      }
      const norm = (t) => String(t || "").replace(/\r\n/g, "\n").replace(/\n$/, "");
      function pasteClip(mode, tr) {
        if (!clip) return; const sh = cs(), dst0 = { r: sel.r1, c: sel.c1 }; const h = clip.r2 - clip.r1 + 1, w = clip.c2 - clip.c1 + 1; let reps = { r: 1, c: 1 };
        if (!tr && (sel.r2 - sel.r1 + 1) % h === 0 && (sel.c2 - sel.c1 + 1) % w === 0 && (sel.r2 > sel.r1 || sel.c2 > sel.c1)) reps = { r: (sel.r2 - sel.r1 + 1) / h, c: (sel.c2 - sel.c1 + 1) / w };
        const src = wb.sheet(clip.sheet) || sh; const th = tr ? w : h, tw = tr ? h : w; const cut = clip.cut === true && mode === "all";
        tx(() => {
          const moved = []; for (let a = 0; a < reps.r; a++) for (let b = 0; b < reps.c; b++) for (let i = 0; i < th; i++) for (let j = 0; j < tw; j++) {
            const sc = tr ? clip.cells[j][i] : clip.cells[i][j], r = dst0.r + a * th + i, c = dst0.c + b * tw + j; if (r > MAXROW || c > MAXCOL) continue; const old = sh.get(r, c) || {};
            let n = sc ? clone(sc) : null;
            if (mode === "values") { const o = clone(old) || {}; delete o.f; if (sc) { const v = wb.value(src, (tr ? clip.r1 + j : clip.r1 + i), (tr ? clip.c1 + i : clip.c1 + j)); o.v = C.isE(v) ? v.code : v; } else delete o.v; n = o; }
            else if (mode === "formats") { const o = clone(old) || {}; if (sc && sc.s) o.s = sc.s; else delete o.s; n = o; }
            else if (mode === "formulas") { const o = clone(old) || {}; if (sc) { if (sc.f) { o.f = cut ? sc.f : C.shift(sc.f, r - (tr ? clip.r1 + j : clip.r1 + i), c - (tr ? clip.c1 + i : clip.c1 + j)); delete o.v; } else { o.v = sc.v; delete o.f; } } else { delete o.v; delete o.f; } n = o; }
            else if (n && n.f && !cut) n.f = C.shift(n.f, r - (tr ? clip.r1 + j : clip.r1 + i), c - (tr ? clip.c1 + i : clip.c1 + j));
            putCell(sh, r, c, n && (n.v != null || n.f || n.s || n.n || n.l) ? n : null);
          }
          if (mode === "all" && !tr && clip.ms && clip.ms.length) { const ms = sh.merges.slice(); for (let a = 0; a < reps.r; a++) for (let b = 0; b < reps.c; b++) clip.ms.forEach((m) => ms.push(C.addr(dst0.r + a * h + m.r1, dst0.c + b * w + m.c1) + ":" + C.addr(dst0.r + a * h + m.r2, dst0.c + b * w + m.c2))); setMeta(sh, "merges", ms); }
          if (cut) { const dr = dst0.r - clip.r1, dc = dst0.c - clip.c1; for (let r = clip.r1; r <= clip.r2; r++) for (let c = clip.c1; c <= clip.c2; c++) { const inDst = src === sh && r + dr >= 0 && false; const t = sh === src && r >= dst0.r && r < dst0.r + h && c >= dst0.c && c < dst0.c + w; if (!t) putCell(src, r, c, null); } moveRefs(src, clip, sh, dr, dc); clip = null; }
        });
        const nr = dst0.r + Math.max(th * reps.r, 1) - 1, nc = dst0.c + Math.max(tw * reps.c, 1) - 1; setSel(dst0.r, dst0.c, nr, nc);
      }
      function moveRefs(srcSh, k, dstSh, dr, dc) { // after Cut & Paste, formulas that pointed at the moved cells follow them
        wb.sheets.forEach((s2) => s2.m.forEach((cell, key) => { if (!cell.f) return; const [r, c] = C.unkey(key); const nf = C.rewrite(cell.f, (t) => {
          if (t.sheet ? !(wb.sheet(t.sheet) === srcSh) : s2 !== srcSh) return undefined; const inR = (a) => a.r >= k.r1 && a.r <= k.r2 && a.c >= k.c1 && a.c <= k.c2; const mv = (s) => { const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(s); return m[1] + C.nCol(C.colN(m[2]) + dc) + m[3] + (+m[4] + dr); };
          if (t.type === "ref") { const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(t.text); return inR({ r: +m[4], c: C.colN(m[2]) }) ? mv(t.text) : undefined; }
          if (t.type === "range") { const a = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(t.a), b = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(t.b); return inR({ r: +a[4], c: C.colN(a[2]) }) && inR({ r: +b[4], c: C.colN(b[2]) }) ? mv(t.a) + ":" + mv(t.b) : undefined; } return undefined; });
          if (nf !== cell.f) { const n = clone(cell); n.f = nf; putCell(s2, r, c, n); } })); }
      sgv.addEventListener("copy", (e) => doCopy(e, false)); sgv.addEventListener("cut", (e) => { if (ro) return; doCopy(e, true); });
      sgv.addEventListener("paste", (e) => {
        if (ed || ro) return; e.preventDefault(); const t = e.clipboardData ? e.clipboardData.getData("text/plain") : ""; if (clip && norm(t) === norm(clip.tsv)) { pasteClip("all"); return; } if (!t) { if (clip) pasteClip("all"); return; }
        const sh = cs(); const single = !/[\t\n]/.test(t.replace(/\r?\n$/, "")); const rows = single ? [[t.replace(/\r?\n$/, "")]] : X.parseCsv(t.replace(/\r?\n$/, ""), "\t"); const r0 = sel.r1, c0 = sel.c1;
        tx(() => { rows.forEach((row, i) => row.forEach((x, j) => { const r = r0 + i, c = c0 + j; if (r > MAXROW || c > MAXCOL) return; if (x === "" && !sh.get(r, c)) return; setInput(sh, r, c, x); })); }, "paste"); setSel(r0, c0, r0 + rows.length - 1, c0 + Math.max(...rows.map((r) => r.length)) - 1); clip = null; drawOverlay();
      });
      S.pasteClip = pasteClip; S.doCopy = doCopy; S.hasClip = () => !!clip;
      S.copyBtn = () => { document.execCommand("copy") || doCopy(null, false); }; S.cutBtn = () => { doCopy(null, true); };

      /* ---------- keyboard ---------- */
      sgv.addEventListener("keydown", (e) => {
        if (e.target === ta) return; const k = e.key, mod = e.ctrlKey || e.metaKey;
        if (mod && !e.altKey) {
          const lk = k.toLowerCase();
          if (lk === "z") { e.preventDefault(); S.undo(); return; } if (lk === "y") { e.preventDefault(); S.redo(); return; } if (lk === "s") { e.preventDefault(); api.save(); return; }
          if (lk === "b") { e.preventDefault(); toggle("b"); return; } if (lk === "i") { e.preventDefault(); toggle("i"); return; } if (lk === "u") { e.preventDefault(); toggle("u"); return; }
          if (lk === "a") { e.preventDefault(); setSel(1, 1, MAXROW, MAXCOL); whole = "all"; sel = { r1: 1, c1: 1, r2: MAXROW, c2: MAXCOL }; cur = { r: 1, c: 1 }; drawOverlay(); statusStats(); return; }
          if (lk === "d") { e.preventDefault(); S.fillDirection("down"); return; } if (lk === "r") { e.preventDefault(); S.fillDirection("right"); return; }
          if (lk === "f" || lk === "h") { e.preventDefault(); S.x.findOpen && S.x.findOpen(lk === "h"); return; }
          if (lk === "k") { e.preventDefault(); S.x.linkForm && S.x.linkForm(); return; } if (lk === "p") { e.preventDefault(); ctrl.print(); return; }
          if (k === ";") { e.preventDefault(); startEdit(C.Fmt.format(Math.floor(C.toSerial ? C.toSerial(new Date()) : 0), "dd-mm-yyyy").text); return; }
          if (k === " ") { e.preventDefault(); setSel(1, cur.c, 1, ext.c, "col"); sel.r1 = 1; sel.r2 = MAXROW; whole = "col"; syncBar(); drawOverlay(); return; }
          if (/^Arrow/.test(k)) { e.preventDefault(); jump(...{ ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k], e.shiftKey); return; }
          if (k === "Home") { e.preventDefault(); setSel(1, 1); return; }
          if (k === "End") { e.preventDefault(); const [ur, uc] = cs().dims(); setSel(Math.max(1, ur), Math.max(1, uc)); return; }
          if (k === "Enter") { return; } if (k === "1") { e.preventDefault(); S.x.formatCells && S.x.formatCells(); return; }
          return;
        }
        if (k === " " && e.shiftKey) { e.preventDefault(); setSel(cur.r, 1, ext.r, 1, "row"); sel.c1 = 1; sel.c2 = MAXCOL; whole = "row"; syncBar(); drawOverlay(); return; }
        if (e.altKey && k === "=") { e.preventDefault(); S.x.autoSum && S.x.autoSum("SUM"); return; }
        if (/^Arrow/.test(k)) { e.preventDefault(); const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k]; moveSel(d[0], d[1], e.shiftKey); return; }
        if (k === "Tab") { e.preventDefault(); moveSel(0, e.shiftKey ? -1 : 1, false); return; }
        if (k === "Enter") { e.preventDefault(); if (ro) { moveSel(e.shiftKey ? -1 : 1, 0); return; } moveSel(e.shiftKey ? -1 : 1, 0); return; }
        if (k === "F2") { e.preventDefault(); startEdit(); return; } if (k === "F4") { return; }
        if (k === "Home") { e.preventDefault(); if (e.shiftKey) setSel(cur.r, cur.c, ext.r, 1); else setSel(cur.r, 1); return; }
        if (k === "PageDown" || k === "PageUp") { e.preventDefault(); const n = Math.max(1, Math.floor((sgv.clientHeight - HH) / (DH * Zm)) - 1) * (k === "PageUp" ? -1 : 1); if (e.shiftKey) setSel(cur.r, cur.c, Math.max(1, ext.r + n), ext.c); else setSel(Math.max(1, cur.r + n), cur.c); return; }
        if (k === "Delete" || k === "Backspace") { e.preventDefault(); if (S.x.chartSel && S.x.chartSel()) { S.x.chartDelete(); return; } clearSel("contents"); return; }
        if (k === "Escape") { if (clip) { clip = null; drawOverlay(); } return; }
        if (k.length === 1 && !e.altKey && !ro) { e.preventDefault(); startEdit(k); return; }
        if (k.length === 1 && ro) say("This file is open for viewing only.");
      });
      function clearSel(what) {
        const sh = cs(); tx(() => eachSel(false, (r, c, cell) => { if (!cell) return; const n = clone(cell); if (what === "contents" || what === "all") { delete n.v; delete n.f; if (what === "all") { delete n.s; delete n.n; delete n.l; delete n.nf; } } else if (what === "formats") { delete n.s; delete n.nf; } else if (what === "notes") delete n.n; else if (what === "links") delete n.l; putCell(sh, r, c, (n.v != null || n.f || n.s || n.n || n.l) ? n : null); }), "clear");
      }
      S.clearSel = clearSel;

      /* ---------- rows, columns, sheets ---------- */
      function insertCore(axis, at, n) {
          const all = wb.sheets, target = cs(); const a = Math.abs(n);
          all.forEach((sh) => { const nm = new Map(); sh.m.forEach((cell, key) => { const [r, c] = C.unkey(key); const v = axis === "r" ? r : c; let nv = v; if (n > 0) { if (v >= at) nv = v + a; } else { if (sh !== target) nv = v; else if (v >= at && v < at + a) return; else if (v >= at + a) nv = v - a; } const o = clone(cell); if (o.f) { const f2 = C.adjust(o.f, sh.name, target.name, axis, at, n); o.f = f2; } if (sh === target) nm.set(axis === "r" ? C.key(nv, c) : C.key(r, nv), o); else nm.set(key, o); }); sh.m = nm; sh.cache = new Map(); });
          Object.keys(wb.names).forEach((k) => { wb.names[k] = C.adjust(wb.names[k], target.name, target.name, axis, at, n); });
          const adjStr = (s) => { const r = C.adjust("=" + s, target.name, target.name, axis, at, n); return /#REF/.test(r) ? null : r.slice(1); };
          const mapKey = (obj, hid) => { const o = {}; Object.keys(obj || {}).forEach((k) => { const i = +k; let ni = i; if (n > 0) { if (i >= at) ni = i + a; } else { if (i >= at && i < at + a) return; if (i >= at + a) ni = i - a; } o[ni] = obj[k]; }); return o; };
          if (axis === "r") { target.rows = mapKey(target.rows); target.hiddenRows = mapKey(target.hiddenRows); } else { target.cols = mapKey(target.cols); target.hiddenCols = mapKey(target.hiddenCols); }
          target.merges = target.merges.map(adjStr).filter(Boolean); target.cf = target.cf.map((r) => { const rg = adjStr(r.range); return rg ? Object.assign({}, r, { range: rg }) : null; }).filter(Boolean); target.dv = (target.dv || []).map((r) => { const rg = adjStr(r.range); return rg ? Object.assign({}, r, { range: rg }) : null; }).filter(Boolean);
          if (target.filter && target.filter.range) { const rg = adjStr(target.filter.range); target.filter = rg ? Object.assign({}, target.filter, { range: rg }) : null; }
          target.charts.forEach((ch) => { const rg = adjStr(ch.range); if (rg) ch.range = rg; });
          if (S.x.structExt) S.x.structExt(target, axis, at, n, adjStr, mapKey);
          const fz = target.freeze; if (axis === "r" && n > 0 && at <= fz.r) fz.r += a; if (axis === "c" && n > 0 && at <= fz.c) fz.c += a;
      }
      function insertRC(axis, at, n) { // n>0 insert, n<0 delete (|n| items)
        tx(() => structOp(() => insertCore(axis, at, n)), n > 0 ? "insert" : "delete");
        mergeCache = null; layout(); setSel(cur.r, cur.c, ext.r, ext.c); sched();
      }
      S.insertRC = insertRC; S.insertCore = insertCore;
      function hideRC(axis, hide) { const sh = cs(); const lo = axis === "r" ? sel.r1 : sel.c1, hi = axis === "r" ? sel.r2 : sel.c2; tx(() => { const p = axis === "r" ? "hiddenRows" : "hiddenCols"; const o = Object.assign({}, sh[p]); for (let i = lo; i <= Math.min(hi, 20000); i++) { if (hide) o[i] = 1; else delete o[i]; } if (!hide) { const u = Object.assign({}, o); for (let i = Math.max(1, lo - 1); i <= hi + 1; i++) delete u[i]; setMeta(sh, p, u); } else setMeta(sh, p, o); }); }
      S.hideRC = hideRC;
      function autoFit(axis, i) {
        const sh = cs(), cv = document.createElement("canvas").getContext("2d"); let best = 0;
        if (axis === "c") { sh.m.forEach((cell, key) => { const [r, c] = C.unkey(key); if (c !== i || r > 5000) return; const st = wb.style(cell.s), t = wb.text(sh, r, c).text; if (!t) return; cv.font = `${st.i ? "italic " : ""}${st.b ? "bold " : ""}${(st.fs || 11) * 1.3333}px ${st.ff || "Calibri"}, Arial, sans-serif`; String(t).split("\n").forEach((ln) => (best = Math.max(best, cv.measureText(ln).width + (st.ind || 0) * 9 + 14))); }); const v = best ? Math.max(24, Math.ceil(best)) : DW; tx(() => { const n = Object.assign({}, sh.cols); (whole === "col" && i >= sel.c1 && i <= sel.c2 ? Array.from({ length: sel.c2 - sel.c1 + 1 }, (_, k) => sel.c1 + k) : [i]).forEach((x) => (n[x] = v)); setMeta(sh, "cols", n); }); }
        else { let mx = DH; sh.m.forEach((cell, key) => { const [r, c] = C.unkey(key); if (r !== i) return; const st = wb.style(cell.s); const fs = (st.fs || 11) * 1.3333; let lines = 1; if (st.wr) { const t = wb.text(sh, r, c).text, w = (sh.cols[c] || DW) - 8; lines = 0; String(t).split("\n").forEach((ln) => (lines += Math.max(1, Math.ceil(ln.length * fs * 0.5 / w)))); } mx = Math.max(mx, Math.ceil(lines * fs * 1.25 + 4)); }); tx(() => { const n = Object.assign({}, sh.rows); delete n[i]; if (mx > DH) n[i] = mx; setMeta(sh, "rows", n); }); }
      }
      S.autoFit = autoFit;
      function drawTabs() {
        stb.innerHTML = wb.sheets.map((s, i) => `<button data-i="${i}" class="${i === wb.active ? "on" : ""}${s.hidden ? " hid" : ""}" ${s.hidden ? 'title="Hidden sheet"' : ""} style="${s.tab ? `border-bottom:3px solid ${s.tab}` : ""}">${esc(s.name)}</button>`).join("") + (ro ? "" : `<button class="add" title="Add a sheet" data-add="1">+</button>`);
        stb.querySelectorAll("button").forEach((b) => { b.onclick = () => { if (b.dataset.add) { addSheet(); return; } activate(+b.dataset.i); }; b.oncontextmenu = (e) => { e.preventDefault(); if (!b.dataset.add) S.x.tabMenu && S.x.tabMenu(b, +b.dataset.i); }; b.ondblclick = () => { if (!b.dataset.add && !ro) S.x.renameSheet && S.x.renameSheet(b, +b.dataset.i); }; });
      }
      S.drawTabs = drawTabs;
      function activate(i) { if (ed) commit(0, 0); if (i === wb.active) return; wb.active = i; sgs.scrollLeft = 0; sgs.scrollTop = 0; mergeCache = null; layout(); const sh = cs(); cur = { r: 1, c: 1 }; ext = cur; sel = { r1: 1, c1: 1, r2: 1, c2: 1 }; whole = null; drawTabs(); setSel(1, 1); S.x.chartDeselect && S.x.chartDeselect(); sched(); api.changed(); rb && rb.redraw(); }
      S.activate = activate;
      function addSheet(name) { let n = wb.sheets.length + 1, nm = name; if (!nm) { nm = "Sheet" + n; while (wb.sheet(nm)) nm = "Sheet" + ++n; } tx(() => sheetsOp(() => { wb.sheets.push(new C.Sheet(nm)); wb.active = wb.sheets.length - 1; })); layout(); drawTabs(); setSel(1, 1); }
      S.addSheet = addSheet;
      function setZoom(z) { z = Math.max(50, Math.min(200, Math.round(z))); Zm = z / 100; styleCache.clear(); layout(); sched(); const r = api.st.querySelector("#szr"); if (r) r.value = z; const l = api.st.querySelector("#szl"); if (l) l.textContent = z + "%"; S.x.chartsMoved && S.x.chartsMoved(); }
      S.setZoom = setZoom;
      function statusStats() {
        const el = api.st.querySelector(".sst"); if (!el) return; if (sel.r1 === sel.r2 && sel.c1 === sel.c2) { el.textContent = ed ? "Edit" : "Ready"; return; }
        const sh = cs(); let n = 0, sum = 0, mn = Infinity, mx = -Infinity, cnt = 0; const inside = (r, c) => r >= sel.r1 && r <= sel.r2 && c >= sel.c1 && c <= sel.c2; const area = (sel.r2 - sel.r1 + 1) * (sel.c2 - sel.c1 + 1);
        const add = (r, c) => { const v = wb.value(sh, r, c); if (v == null || v === "") return; cnt++; if (typeof v === "number") { n++; sum += v; if (v < mn) mn = v; if (v > mx) mx = v; } };
        if (area > sh.m.size) sh.m.forEach((cell, k) => { const [r, c] = C.unkey(k); if (inside(r, c)) add(r, c); }); else for (let r = sel.r1; r <= sel.r2; r++) for (let c = sel.c1; c <= sel.c2; c++) add(r, c);
        const f = (v) => C.Fmt.format(v, "#,##,##0.##").text; el.innerHTML = `Count: <b>${cnt}</b>` + (n ? ` &nbsp;·&nbsp; Sum: <b>${f(sum)}</b> &nbsp;·&nbsp; Average: <b>${f(sum / n)}</b> &nbsp;·&nbsp; Min: <b>${f(mn)}</b> &nbsp;·&nbsp; Max: <b>${f(mx)}</b>` : "");
      }
      S.statusStats = statusStats;
      api.st.innerHTML = `<span class="sst">Ready</span><span class="gr"></span><label style="display:flex;gap:6px;align-items:center">Zoom <input type="range" id="szr" min="50" max="200" value="${Math.round(Zm * 100)}"> <span id="szl">${Math.round(Zm * 100)}%</span></label>`;
      api.st.querySelector("#szr").oninput = (e) => setZoom(+e.target.value);

      /* ---------- features module ---------- */
      mix({ clearSel, clone, jc, isDateNf, NF, FONTS, SIZES, curNf, curStyle, bumpDec, toggle, hideRC, goTo, lowerBound, wbSheetActive: () => wb.active, redrawRibbon: () => rb && rb.redraw(), refreshRibbon: () => rb && rb.refresh(), setPrint: (o) => Object.assign(print, o), get zoom() { return Zm; }, sched, get whole() { return whole; }, set whole(v) { whole = v; }, setWhole(v) { whole = v; } });
      if (window.OffSheetX) OffSheetX(S);

      /* ---------- ribbon ---------- */
      const B = (i, t, on, extra) => Object.assign({ i, t, on }, extra || {});
      const bd = (mode) => S.x.borders && S.x.borders(mode);
      const tabs = [
        { id: "home", label: "Home", groups: [
          { label: "Clipboard", items: [{ i: "paste", label: "Paste", big: true, k: "menu", items: () => [{ label: "Paste", i: "paste", run: () => pasteOrSay("all") }, { label: "Values only", run: () => pasteOrSay("values") }, { label: "Formulas only", run: () => pasteOrSay("formulas") }, { label: "Formatting only", run: () => pasteOrSay("formats") }, { label: "Transpose (rows ↔ columns)", run: () => pasteOrSay("all", true) }] }, B("cut", "Cut (Ctrl+X)", () => S.cutBtn()), B("copy", "Copy (Ctrl+C)", () => S.copyBtn()), B("brush", "Copy formatting to other cells", () => S.x.paintFormat && S.x.paintFormat())] },
          { label: "Font", items: [{ k: "sel", t: "Font", w: 120, opts: FONTS, get: () => curStyle().ff || "Calibri", on: (v) => styleSel({ ff: v === "Calibri" ? null : v }) }, { k: "sel", t: "Size (pt)", w: 58, opts: SIZES.map(String), get: () => String(curStyle().fs || 11), on: (v) => styleSel({ fs: +v === 11 ? null : +v }) },
            { i: "", t: "Bold (Ctrl+B)", html: "<b>B</b>", tx: true, on: () => toggle("b"), act: () => !!curStyle().b }, { i: "", t: "Italic (Ctrl+I)", html: "<i>I</i>", tx: true, on: () => toggle("i"), act: () => !!curStyle().i }, { i: "", t: "Underline (Ctrl+U)", html: "<u>U</u>", tx: true, on: () => toggle("u"), act: () => !!curStyle().u }, { i: "", t: "Strikethrough", html: "<s>S</s>", tx: true, on: () => toggle("st"), act: () => !!curStyle().st },
            { k: "menu", i: "border", t: "Borders", items: () => [{ label: "All borders", run: () => bd("all") }, { label: "Outside borders", run: () => bd("outside") }, { label: "Thick outside border", run: () => bd("thick") }, { label: "Inside borders", run: () => bd("inside") }, { label: "Bottom border", run: () => bd("b") }, { label: "Double bottom border", run: () => bd("dbl") }, { label: "Top border", run: () => bd("t") }, { label: "Left border", run: () => bd("l") }, { label: "Right border", run: () => bd("r") }, "-", { label: "No border", run: () => bd("none") }] },
            { k: "col", i: "fill", t: "Fill colour", none: "No fill", get: () => curStyle().bg || "#ffff00", on: (c) => styleSel({ bg: c || null }) }, { k: "col", i: "tcolor", t: "Text colour", none: "Automatic", get: () => curStyle().fc || "#000000", on: (c) => styleSel({ fc: c || null }) }] },
          { label: "Alignment", items: [B("alignT", "Align top", () => styleSel({ va: "top" }), { act: () => curStyle().va === "top" }), B("alignM", "Align middle", () => styleSel({ va: "middle" }), { act: () => curStyle().va === "middle" }), B("alignB", "Align bottom", () => styleSel({ va: null }), { act: () => !curStyle().va || curStyle().va === "bottom" }), B("alignL", "Align left", () => styleSel({ ha: "left" }), { act: () => curStyle().ha === "left" }), B("alignC", "Centre", () => styleSel({ ha: "center" }), { act: () => curStyle().ha === "center" }), B("alignR", "Align right", () => styleSel({ ha: "right" }), { act: () => curStyle().ha === "right" }), B("outdent", "Decrease indent", () => styleSel((s) => Object.assign(s, { ind: Math.max(0, (s.ind || 0) - 1) }))), B("indent", "Increase indent", () => styleSel((s) => Object.assign(s, { ind: Math.min(15, (s.ind || 0) + 1), ha: s.ha || "left" }))), B("wrap", "Wrap text in the cell", () => { const on = !curStyle().wr; styleSel({ wr: on ? 1 : null }); if (on) { const sh = cs(); tx(() => { for (let r = sel.r1; r <= Math.min(sel.r2, sel.r1 + 500); r++) autoRow(sh, r); }); } }, { act: () => !!curStyle().wr }),
            { k: "menu", i: "merge", t: "Merge cells", label: "Merge", items: () => [{ label: "Merge and centre", run: () => S.x.merge && S.x.merge("center") }, { label: "Merge cells", run: () => S.x.merge && S.x.merge("all") }, { label: "Merge across (each row)", run: () => S.x.merge && S.x.merge("across") }, { label: "Unmerge cells", run: () => S.x.merge && S.x.merge("none") }] }] },
          { label: "Number", items: [{ k: "menu", t: "Number format", label: "Format", i: "param", items: () => NF.map((n) => ({ label: n[0], on: curNf() === n[1], run: () => styleSel({ nf: n[1] === "General" ? null : n[1] }) })).concat(["-", { label: "More formats…", run: () => S.x.formatCells && S.x.formatCells() }]) }, B("", "Rupee currency", () => styleSel({ nf: '"₹"#,##,##0.00' }), { html: "<b>₹</b>", tx: true }), B("", "Percent", () => styleSel({ nf: "0%" }), { html: "<b>%</b>", tx: true }), B("", "Thousands separator", () => styleSel({ nf: "#,##,##0" }), { html: "<b>,</b>", tx: true }), B("", "More decimals", () => bumpDec(1), { html: "<b>.0→</b>", tx: true }), B("", "Fewer decimals", () => bumpDec(-1), { html: "<b>←.0</b>", tx: true })] },
          { label: "Styles", items: [{ k: "menu", i: "layout", label: "Conditional", t: "Conditional formatting", items: () => S.x.cfMenu ? S.x.cfMenu() : [] }, { k: "menu", i: "fill", label: "Cell styles", t: "Cell styles", items: () => S.x.cellStyles ? S.x.cellStyles() : [] }] },
          { label: "Cells", items: [{ k: "menu", i: "rowAdd", label: "Insert", t: "Insert", items: () => [{ label: "Insert row above", run: () => insertRC("r", sel.r1, sel.r2 - sel.r1 + 1) }, { label: "Insert column left", run: () => insertRC("c", sel.c1, sel.c2 - sel.c1 + 1) }, { label: "Insert sheet", run: () => addSheet() }] }, { k: "menu", i: "rowDel", label: "Delete", t: "Delete", items: () => [{ label: "Delete rows", run: () => insertRC("r", sel.r1, -(sel.r2 - sel.r1 + 1)) }, { label: "Delete columns", run: () => insertRC("c", sel.c1, -(sel.c2 - sel.c1 + 1)) }, { label: "Delete this sheet", run: () => S.x.deleteSheet && S.x.deleteSheet(wb.active) }] }, { k: "menu", i: "size", label: "Format", t: "Format", items: () => S.x.formatMenu ? S.x.formatMenu() : [] }] },
          { label: "Editing", items: [{ k: "menu", i: "sum", label: "AutoSum", t: "AutoSum (Alt+=)", items: () => [["Sum", "SUM"], ["Average", "AVERAGE"], ["Count numbers", "COUNT"], ["Max", "MAX"], ["Min", "MIN"]].map((a) => ({ label: a[0], run: () => S.x.autoSum && S.x.autoSum(a[1]) })) }, { k: "menu", i: "down", label: "Fill", t: "Fill", items: () => [{ label: "Down (Ctrl+D)", run: () => S.fillDirection("down") }, { label: "Right (Ctrl+R)", run: () => S.fillDirection("right") }, { label: "Series…", run: () => S.x.seriesForm && S.x.seriesForm() }] }, { k: "menu", i: "clear", label: "Clear", t: "Clear", items: () => [{ label: "Clear all", run: () => clearSel("all") }, { label: "Clear formats", run: () => clearSel("formats") }, { label: "Clear contents (Delete)", run: () => clearSel("contents") }, { label: "Clear notes", run: () => clearSel("notes") }, { label: "Remove links", run: () => clearSel("links") }] },
            { k: "menu", i: "sortA", label: "Sort", t: "Sort and filter", items: () => S.x.sortMenu ? S.x.sortMenu() : [] }, { i: "find", label: "Find", t: "Find and replace (Ctrl+F)", on: () => S.x.findOpen && S.x.findOpen(false) }] }
        ] },
        { id: "insert", label: "Insert", groups: [
          { label: "Charts", items: [{ k: "menu", i: "cBar", label: "Column", big: true, t: "Insert column or bar chart", items: () => [{ label: "Clustered column", run: () => S.x.addChart && S.x.addChart("col") }, { label: "Stacked column", run: () => S.x.addChart && S.x.addChart("col", true) }, { label: "Clustered bar", run: () => S.x.addChart && S.x.addChart("bar") }, { label: "Stacked bar", run: () => S.x.addChart && S.x.addChart("bar", true) }] }, { i: "cLine", label: "Line", big: true, on: () => S.x.addChart && S.x.addChart("line") }, { i: "cPie", label: "Pie", big: true, on: () => S.x.addChart && S.x.addChart("pie") }, { k: "menu", i: "cArea", label: "Other", big: true, t: "More chart types", items: () => [{ label: "Doughnut", run: () => S.x.addChart && S.x.addChart("doughnut") }, { label: "Area", run: () => S.x.addChart && S.x.addChart("area") }, { label: "Stacked area", run: () => S.x.addChart && S.x.addChart("area", true) }, { label: "Scatter (X Y)", run: () => S.x.addChart && S.x.addChart("scatter") }] }] },
          { label: "Cells", items: [{ i: "rowAdd", label: "Row", on: () => insertRC("r", sel.r1, sel.r2 - sel.r1 + 1) }, { i: "colAdd", label: "Column", on: () => insertRC("c", sel.c1, sel.c2 - sel.c1 + 1) }, { i: "plus", label: "Sheet", on: () => addSheet() }] },
          { label: "Links and notes", items: [{ i: "link", label: "Link", on: () => S.x.linkForm && S.x.linkForm() }, { i: "comment", label: "Note", on: () => S.x.noteForm && S.x.noteForm() }, { i: "calendar", label: "Today", on: () => { startEdit("=TODAY()"); } }] }
        ] },
        { id: "formulas", label: "Formulas", groups: [
          { label: "Function library", items: [{ i: "sum", label: "Insert function", big: true, on: () => S.x.fnDialog && S.x.fnDialog() }, { k: "menu", i: "sum", label: "AutoSum", on: () => 0, items: () => [["Sum", "SUM"], ["Average", "AVERAGE"], ["Count numbers", "COUNT"], ["Max", "MAX"], ["Min", "MIN"]].map((a) => ({ label: a[0], run: () => S.x.autoSum && S.x.autoSum(a[1]) })) }, ...["Maths", "Logical", "Text", "Date & time", "Lookup", "Statistics", "Financial"].map((cat) => ({ k: "menu", label: cat, t: cat + " functions", items: () => S.x.fnMenu ? S.x.fnMenu(cat) : [] }))] },
          { label: "Names", items: [{ i: "link", label: "Define name", on: () => S.x.nameForm && S.x.nameForm() }, { i: "param", label: "Name manager", on: () => S.x.nameManager && S.x.nameManager() }] },
          { label: "Auditing", items: [{ i: "eye", label: "Show formulas", t: "Show formulas instead of results", on: () => { showF = !showF; sched(); }, act: () => showF }] }
        ] },
        { id: "data", label: "Data", groups: [
          { label: "Sort and filter", items: [{ i: "sortA", label: "Sort A→Z", on: () => S.x.sortBy && S.x.sortBy(true) }, { i: "sortZ", label: "Sort Z→A", on: () => S.x.sortBy && S.x.sortBy(false) }, { i: "param", label: "Custom sort", on: () => S.x.sortForm && S.x.sortForm() }, { i: "filter", label: "Filter", big: true, on: () => S.x.toggleFilter && S.x.toggleFilter(), act: () => !!cs().filter }, { i: "clear", label: "Clear filter", on: () => S.x.clearFilter && S.x.clearFilter() }] },
          { label: "Data tools", items: [{ i: "check", label: "Data validation", on: () => S.x.dvForm && S.x.dvForm() }, { i: "trash", label: "Remove duplicates", on: () => S.x.dedupe && S.x.dedupe() }, { i: "cols", label: "Text to columns", on: () => S.x.textToCols && S.x.textToCols() }] }
        ] },
        { id: "view", label: "View", groups: [
          { label: "Window", items: [{ k: "menu", i: "freeze", label: "Freeze panes", t: "Freeze panes", items: () => [{ label: "Freeze top row", run: () => S.x.freeze && S.x.freeze("row") }, { label: "Freeze first column", run: () => S.x.freeze && S.x.freeze("col") }, { label: "Freeze panes at the selected cell", run: () => S.x.freeze && S.x.freeze("at") }, "-", { label: "Unfreeze panes", run: () => S.x.freeze && S.x.freeze("none") }] }, { i: "layout", label: "Gridlines", t: "Show or hide gridlines", on: () => { const sh = cs(); tx(() => setMeta(sh, "grid", sh.grid === false ? true : false)); }, act: () => cs().grid !== false }, { i: "eye", label: "Show formulas", on: () => { showF = !showF; sched(); }, act: () => showF }, { i: "full", label: "Full screen", on: () => { if (document.fullscreenElement) document.exitFullscreen(); else api.root.requestFullscreen && api.root.requestFullscreen(); } }] },
          { label: "Zoom", items: [{ i: "zoomin", label: "Zoom in", on: () => setZoom(Zm * 100 + 10) }, { i: "zoomout", label: "Zoom out", on: () => setZoom(Zm * 100 - 10) }, { label: "100%", on: () => setZoom(100) }] }
        ] },
        { id: "layout", label: "Page layout", groups: [
          { label: "Page setup", items: [{ k: "menu", i: "orient", label: "Orientation", items: () => [{ label: "Portrait", on: print.orient === "portrait", run: () => { print.orient = "portrait"; api.changed(); } }, { label: "Landscape", on: print.orient === "landscape", run: () => { print.orient = "landscape"; api.changed(); } }] }, { k: "menu", i: "size", label: "Paper size", items: () => ["A4", "A3", "A5", "Letter", "Legal"].map((s) => ({ label: s, on: print.size === s, run: () => { print.size = s; api.changed(); } })) }, { i: "layout", label: "Print gridlines", on: () => { print.grid = !print.grid; api.changed(); }, act: () => !!print.grid }, { i: "freeze", label: "Fit to page width", on: () => { print.fit = !print.fit; api.changed(); }, act: () => !!print.fit }, { i: "alignT", label: "Repeat first row", on: () => { print.title = print.title ? 0 : 1; api.changed(); }, act: () => !!print.title }, { i: "print", label: "Print", big: true, on: () => ctrl.print() }] }
        ] },
        { id: "chart", label: "Chart", ctx: true, when: () => !!(S.x.chartSel && S.x.chartSel()), groups: [{ label: "Chart", items: S.x.chartTabItems ? S.x.chartTabItems() : [] }] }
      ];
      (window.OffSheetP || []).forEach((f) => f(S, tabs, B));
      function pasteOrSay(mode, tr) { if (!clip) { say("Copy some cells first, then paste."); return; } pasteClip(mode, tr); }
      rb = make(api.rib, tabs, { first: "home", nofocus: false });
      const bumpRb = () => rb.refresh();
      /* ---------- body / export / print ---------- */
      const ctrl = {
        body() { const j = wb.toJSON(); j.zoom = Math.round(Zm * 100); j.print = print; return j; },
        async exportXlsx() { const blob = await X.write(wb, { title: file.name }); Z.download(blob, Z.safeName(file.name) + ".xlsx"); },
        exportCsv() { Z.download(new Blob([X.toCsv(wb, cs())], { type: "text/csv" }), Z.safeName(file.name) + ".csv"); },
        exportHtml() { const h = S.x.printHtml ? S.x.printHtml(true) : ""; Z.download(new Blob([`<!doctype html><html><head><meta charset="utf-8"><title>${esc(file.name)}</title><style>body{font-family:Calibri,Arial,sans-serif}table{border-collapse:collapse}td{padding:2px 6px}</style></head><body>${h}</body></html>`], { type: "text/html" }), Z.safeName(file.name) + ".html"); },
        print() { if (ed) commit(0, 0); if (!S.x.printHtml) return; spr.innerHTML = S.x.printHtml(false); let st2 = document.getElementById("off-page-style"); if (!st2) { st2 = document.createElement("style"); st2.id = "off-page-style"; st2.media = "print"; document.head.append(st2); } st2.textContent = `@page{size:${print.size === "Letter" ? "letter" : print.size === "Legal" ? "legal" : print.size} ${print.orient};margin:10mm}`; if (window.KMRReport) KMRReport.set({ title: file.name || "Spreadsheet", doc: file.no || "", key: "sheet", land: print.orient === "landscape" }); const t0 = document.title; document.title = file.name || "Spreadsheet"; document.body.classList.add("opv"); setTimeout(() => { window.print(); document.title = t0; document.body.classList.remove("opv"); spr.innerHTML = ""; }, 80); },
        focus() { sgv.focus(); }, setReadOnly() { ro = true; sgw.classList.add("sro"); drawTabs(); },
        destroy() { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); S.x.destroy && S.x.destroy(); }
      };
      S.ctrl = ctrl; window.__sheet = S; // handy for debugging in the browser
      layout(); drawTabs(); setSel(1, 1); render(); setTimeout(() => { layout(); render(); sgv.focus({ preventScroll: true }); }, 60);
      return ctrl;
    }
  };
  window.Office = window.Office || { editors: {} }; Office.editors.sheet = SHEET; window.OffSheet = SHEET;
})();
