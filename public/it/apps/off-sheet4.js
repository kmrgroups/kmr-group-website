/* KMR Office Suite - Spreadsheets, part 4: PivotTables (field panel, grouping of dates, totals, show-values-as, filters, refresh, pivot chart). */
(function () {
  "use strict";
  const { form, esc } = OffUI, C = window.Calc, U = window.OffSheetUtil;
  const AGG = { sum: "Sum", count: "Count", counta: "Count (non-empty)", avg: "Average", min: "Min", max: "Max", distinct: "Distinct count", prod: "Product" };
  const GRP = { year: "Year", quarter: "Quarter", month: "Month" };
  const css = `
.pvp{position:absolute;right:8px;top:8px;bottom:34px;width:300px;z-index:30;background:var(--card,#fff);color:var(--ink,#111);border:1px solid var(--line,#ddd);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.22);display:flex;flex-direction:column;font:13px Calibri,Arial,sans-serif}
.pvp h4{margin:0;padding:10px 12px;font-size:14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--line,#ddd)}.pvp h4 button{margin-left:auto;border:0;background:none;font-size:18px;cursor:pointer;color:inherit}
.pvp .pvb{overflow:auto;padding:8px 12px;flex:1}.pvp .pvr{display:flex;align-items:center;gap:6px;margin:4px 0}.pvp .pvr b{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pvp select,.pvp input[type=text]{border:1px solid var(--line,#ccc);border-radius:7px;padding:4px 6px;background:var(--card,#fff);color:inherit;font:inherit;max-width:150px}
.pvp .pvs{margin:10px 0 4px;font-size:11.5px;color:var(--mut,#667);font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.pvp .pvm{border:1px solid var(--line,#ddd);border-radius:7px;background:var(--card,#fff);cursor:pointer;padding:0 5px;line-height:18px;font-size:11px}
.pvp .pvx{display:flex;gap:6px;padding:8px 12px;border-top:1px solid var(--line,#ddd)}.pvp .pvx button{flex:1;border:1px solid var(--line,#ccc);background:var(--card,#fff);color:inherit;border-radius:8px;padding:7px;cursor:pointer;font-weight:600}
.pvp .pvx button.p{background:#4f46e5;color:#fff;border-color:#4f46e5}.pvp select[multiple]{max-width:none;width:100%}`;
  if (!document.getElementById("pv-css")) { const st = document.createElement("style"); st.id = "pv-css"; st.textContent = css; document.head.append(st); }

  (window.OffSheetP = window.OffSheetP || []).push(function (S, tabs) {
    const X_ = S.x, wb = S.wb, cs = S.cs, say = S.say;
    const an = () => S.W.querySelector(".sfx");
    const pivots = (sh) => sh.ext.pivots || [];
    const setPivots = (sh, l) => S.setMeta(sh, "ext", Object.assign({}, sh.ext, { pivots: l }));
    const inOut = (p, r, c) => { const g = U.parseR(p.out || "A1"); return g && r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2; };
    const pivotAt = (sh, r, c) => pivots(sh).find((p) => p.out && inOut(p, r, c)) || null;
    const isDateCol = (sh, g, c) => { let n = 0, d = 0; for (let r = g.r1 + 1; r <= Math.min(g.r2, g.r1 + 60); r++) { const cell = sh.get(r, c); if (!cell) continue; const v = wb.value(sh, r, c); if (v == null || v === "") continue; n++; if (typeof v === "number" && v > 20000 && v < 80000 && S.isDateNf(wb.numFmt(cell, v))) d++; } return n > 0 && d / n > 0.8; };

    /* ---- data ---- */
    function source(p) {
      let sh, g;
      if (p.srcTable) { const T = X_.tables.list ? (() => { for (const s of wb.sheets) for (const t of X_.tables.list(s)) if (t.name === p.srcTable) return { s, t }; return null; })() : null; if (!T) return { err: "The table " + p.srcTable + " no longer exists." }; sh = T.s; g = U.parseR(T.t.range); }
      else { sh = wb.sheet(p.srcSheet); g = U.parseR(p.src); if (!sh || !g) return { err: "The source range can't be found." }; }
      if (g.r2 - g.r1 < 1) return { err: "The source needs a heading row and at least one row of data." };
      const heads = []; for (let c = g.c1; c <= g.c2; c++) { let t = String(wb.text(sh, g.r1, c).text || "").trim() || "Column" + (c - g.c1 + 1); let u = t, k = 2; while (heads.includes(u)) u = t + " " + k++; heads.push(u); }
      const recs = []; for (let r = g.r1 + 1; r <= g.r2; r++) { const vals = [], txt = []; let any = false; for (let c = g.c1; c <= g.c2; c++) { const v = wb.value(sh, r, c); vals.push(v); txt.push(v == null ? "" : String(wb.text(sh, r, c).text)); if (v != null && v !== "") any = true; } if (any) recs.push({ vals, txt }); }
      const dates = heads.map((_, j) => isDateCol(sh, g, g.c1 + j)); const nfs = heads.map((_, j) => { for (let r = g.r1 + 1; r <= g.r2; r++) { const cell = sh.get(r, g.c1 + j); if (cell && typeof wb.value(sh, r, g.c1 + j) === "number") return wb.numFmt(cell, 1); } return "General"; });
      return { sh, g, heads, recs, dates, nfs };
    }
    const keyOf = (src, rec, field, grp) => {
      const j = src.heads.indexOf(field); if (j < 0) return { k: "", l: "(blank)" }; const v = rec.vals[j];
      if (grp && typeof v === "number") { const [y, m] = C.ymd(v); if (grp === "year") return { k: y, l: String(y) }; if (grp === "quarter") { const q = Math.ceil(m / 3); return { k: y * 10 + q, l: y + " Q" + q }; } return { k: y * 100 + m, l: C.MON[m - 1] + " " + y }; }
      if (v == null || v === "") return { k: "", l: "(blank)" }; if (typeof v === "number") return { k: v, l: rec.txt[j] }; return { k: String(v).toLowerCase(), l: String(v) };
    };
    const cmpK = (a, b) => (typeof a === "number" && typeof b === "number" ? a - b : a === "" ? (b === "" ? 0 : 1) : b === "" ? -1 : typeof a === "number" ? -1 : typeof b === "number" ? 1 : String(a).localeCompare(String(b)));
    const newAcc = () => ({ s: 0, n: 0, na: 0, mn: Infinity, mx: -Infinity, p: 1, set: new Set() });
    const addAcc = (a, v, txt) => { if (v != null && v !== "") { a.na++; a.set.add(typeof v + ":" + String(v).toLowerCase()); } if (typeof v === "number") { a.s += v; a.n++; if (v < a.mn) a.mn = v; if (v > a.mx) a.mx = v; a.p *= v; } void txt; };
    const fin = (a, agg) => { if (!a) return null; switch (agg) { case "sum": return a.s; case "count": return a.n; case "counta": return a.na; case "avg": return a.n ? a.s / a.n : null; case "min": return a.n ? a.mn : null; case "max": return a.n ? a.mx : null; case "distinct": return a.set.size; case "prod": return a.n ? a.p : null; } return null; };

    /* ---- layout ---- */
    function compute(p) {
      const src = source(p); if (src.err) return { err: src.err };
      const rowsF = (p.rows || []).filter((f) => src.heads.includes(f)), colsF = (p.cols || []).filter((f) => src.heads.includes(f)), vals = (p.vals || []).filter((v) => src.heads.includes(v.f));
      let recs = src.recs; (p.filters || []).forEach((f) => { if (!f.sel || !f.sel.length || !src.heads.includes(f.f)) return; const set = new Set(f.sel); recs = recs.filter((rec) => set.has(keyOf(src, rec, f.f, (p.group || {})[f.f]).l)); });
      const L = rowsF.length, V = Math.max(1, vals.length), ALL = "\u0002";
      const racc = new Map(), labels = new Map(); // key -> accs per val ; rowprefix keys
      const colKeys = new Map(), rowTree = new Map();
      const ck = (rec) => { if (!colsF.length) return { k: "", l: "" }; const parts = colsF.map((f) => keyOf(src, rec, f, (p.group || {})[f])); return { k: parts.map((x) => x.k).join("\u0001"), l: parts.map((x) => x.l).join(" | "), ks: parts.map((x) => x.k) }; };
      const get = (rk, c) => { const key = rk + "\u0003" + c; let a = racc.get(key); if (!a) { a = vals.length ? vals.map(newAcc) : [newAcc()]; racc.set(key, a); } return a; };
      recs.forEach((rec) => {
        const parts = rowsF.map((f) => keyOf(src, rec, f, (p.group || {})[f])), col = ck(rec); if (colsF.length && !colKeys.has(col.k)) colKeys.set(col.k, col);
        let node = rowTree, pk = "";
        for (let l = 0; l <= L; l++) { if (l > 0) { pk += (l > 1 ? "\u0001" : "") + parts[l - 1].k; let n = node.get(parts[l - 1].k); if (!n) { n = { k: parts[l - 1].k, l: parts[l - 1].l, kids: new Map(), key: pk }; node.set(parts[l - 1].k, n); } node = n.kids; }
          const rk = l === 0 ? "" : pk; [col.k, ALL].forEach((cc) => { const accs = get(rk, cc); (vals.length ? vals : [{ f: null }]).forEach((v, i) => { if (!v.f) { accs[i].n++; accs[i].na++; return; } const j = src.heads.indexOf(v.f); addAcc(accs[i], rec.vals[j], rec.txt[j]); }); }); }
      });
      const cols = [...colKeys.values()].sort((a, b) => { for (let i = 0; i < colsF.length; i++) { const d = cmpK(a.ks[i], b.ks[i]); if (d) return p.sort === "desc" ? -d : d; } return 0; });
      const spec = vals.length ? vals : [{ f: null, agg: "count", label: "Count of rows" }];
      const vLabel = (v) => v.label || (AGG[v.agg] + " of " + (v.f || "rows")); const nfOf = (v) => (v.show && v.show !== "value" ? "0.0%" : p.nf && p.nf !== "auto" ? p.nf : v.agg === "count" || v.agg === "counta" || v.agg === "distinct" ? "#,##,##0" : (() => { const j = v.f ? src.heads.indexOf(v.f) : -1; const nf = j >= 0 ? src.nfs[j] : "General"; return nf && nf !== "General" ? nf : "#,##,##0.##"; })());
      const val = (rk, ck2, i) => { const a = racc.get(rk + "\u0003" + ck2); return a ? fin(a[i], spec[i].agg) : null; };
      const show = (rk, ck2, i) => { const v = val(rk, ck2, i), m = spec[i].show || "value"; if (v == null || m === "value") return v; const d = m === "pct_total" ? val("", ALL, i) : m === "pct_row" ? val(rk, ALL, i) : val("", ck2, i); return d ? v / d : null; };
      /* order rows */
      const order = (nodes, depth) => { let a = [...nodes.values()]; if (p.sort === "valdesc" && spec[0]) a.sort((x, y) => (val(y.key, ALL, 0) || 0) - (val(x.key, ALL, 0) || 0)); else { a.sort((x, y) => cmpK(x.k, y.k)); if (p.sort === "desc") a.reverse(); } return a; };
      const out = []; // rows of cells: {v, k:'h'|'l'|'v'|'s'|'t', nf}
      const nCols = L + (cols.length ? cols.length * spec.length : spec.length) + (cols.length && p.gtc !== false ? spec.length : 0);
      const pad = (row) => { while (row.length < nCols) row.push({ v: null, k: "e" }); return row; };
      // header
      let hdrRows = 0;
      if (colsF.length) { const r1 = pad([]); r1[L] = { v: colsF.join(" / "), k: "h" }; for (let i = L + 1; i < nCols; i++) r1[i] = { v: null, k: "h" }; out.push(r1); hdrRows++; const r2 = pad([]); for (let i = 0; i < L; i++) r2[i] = { v: null, k: "h" }; let ci = L; cols.forEach((c) => { r2[ci] = { v: c.l, k: "h" }; for (let q = 1; q < spec.length; q++) r2[ci + q] = { v: null, k: "h" }; ci += spec.length; }); if (p.gtc !== false) { r2[ci] = { v: "Grand Total", k: "h" }; for (let q = 1; q < spec.length; q++) r2[ci + q] = { v: null, k: "h" }; } out.push(r2); hdrRows++; }
      if (!colsF.length || spec.length > 1 || true) { const r3 = pad([]); rowsF.forEach((f, i) => (r3[i] = { v: f, k: "h" })); let ci = L; const labelOf = (i) => vLabel(spec[i]); if (colsF.length) cols.forEach(() => spec.forEach((_, i) => { r3[ci++] = { v: labelOf(i), k: "h" }; })); else spec.forEach((_, i) => { r3[ci++] = { v: labelOf(i), k: "h" }; }); if (colsF.length && p.gtc !== false) spec.forEach((_, i) => { r3[ci++] = { v: labelOf(i), k: "h" }; }); out.push(r3); hdrRows++; }
      const dataRow = (rk, labelsArr, kind) => { const row = pad([]); labelsArr.forEach((l, i) => (row[i] = { v: l, k: kind === "d" ? "l" : kind })); for (let i = labelsArr.length; i < L; i++) row[i] = { v: null, k: kind === "d" ? "l" : kind }; let ci = L; const cell = (c, i) => ({ v: show(rk, c, i), k: kind === "d" ? "v" : kind, nf: nfOf(spec[i]) }); if (colsF.length) cols.forEach((c) => spec.forEach((_, i) => { row[ci++] = cell(c.k, i); })); else spec.forEach((_, i) => { row[ci++] = cell("", i); }); if (colsF.length && p.gtc !== false) spec.forEach((_, i) => { row[ci++] = cell(ALL, i); }); return row; };
      let prevLeaf = null;
      const walk = (nodes, depth, trail) => { order(nodes, depth).forEach((n) => { const lab = trail.slice(); lab.push(n.l); if (depth === L) { const shown = lab.map((x, i) => (prevLeaf && prevLeaf.slice(0, i + 1).every((y, j) => y === lab[j]) ? null : x)); prevLeaf = lab; out.push(dataRow(n.key, shown, "d")); } else { walk(n.kids, depth + 1, lab); if (p.sub !== false && L > 1) out.push(dataRow(n.key, new Array(depth - 1).fill(null).concat([n.l + " Total"]), "s")); } }); };
      if (L === 0) out.push(dataRow("", ["Total"], "d").map((c, i) => (i === 0 ? c : c))); else walk(rowTree, 1, []);
      if (p.gt !== false && L > 0) out.push(dataRow("", ["Grand Total"], "t"));
      return { rows: out, hdrRows, nCols, heads: src.heads, src, L, spec, cols };
    }
    function describeFilters(p, src) { return (p.filters || []).filter((f) => src.heads.includes(f.f)).map((f) => [f.f, f.sel && f.sel.length ? (f.sel.length > 3 ? f.sel.slice(0, 3).join(", ") + " …(" + f.sel.length + ")" : f.sel.join(", ")) : "(All)"]); }

    /* ---- write ---- */
    const STY = { h: { b: 1, bg: "#4472c4", fc: "#ffffff", va: "middle" }, l: { b: 0 }, v: {}, s: { b: 1, bg: "#d9e1f2" }, t: { b: 1, bg: "#b4c6e7", bd: { t: ["thin", "#4472c4"], b: ["double", "#4472c4"] } }, e: {} };
    function writePivot(sh, p) {
      const old = p.out && U.parseR(p.out); if (old) for (let r = old.r1; r <= old.r2; r++) for (let c = old.c1; c <= old.c2; c++) { if (sh.get(r, c)) S.putCell(sh, r, c, null); }
      const res = compute(p); const at = U.parseR(p.at); let r0 = at.r1, c0 = at.c1;
      if (res.err) { S.putCell(sh, r0, c0, { v: res.err, s: wb.styleId({ fc: "#b91c1c" }) }); p.out = C.addr(r0, c0) + ":" + C.addr(r0, c0); return res; }
      const fl = describeFilters(p, res.src); fl.forEach((f, i) => { S.putCell(sh, r0 + i, c0, { v: f[0], s: wb.styleId({ b: 1 }) }); S.putCell(sh, r0 + i, c0 + 1, { v: f[1], s: wb.styleId({ bg: "#fff2cc" }) }); });
      const top = r0 + fl.length + (fl.length ? 1 : 0);
      res.rows.forEach((row, ri) => row.forEach((cell, ci) => { if (cell.v == null && cell.k === "e") return; const st = Object.assign({}, STY[cell.k] || {}); if (cell.nf && cell.k !== "h" && cell.k !== "l") st.nf = cell.nf; if (cell.k === "h" && ci >= res.L) st.ha = "center"; if (typeof cell.v === "number" && cell.k !== "h") st.ha = "right"; if (cell.k === "l") st.b = 1; const o = { s: wb.styleId(st) }; if (cell.v != null) o.v = cell.v; S.putCell(sh, top + ri, c0 + ci, o); }));
      p.out = C.addr(r0, c0) + ":" + C.addr(top + res.rows.length - 1, c0 + Math.max(res.nCols, 2) - 1); p.hdr = top; p.nCols = res.nCols; p.L = res.L; p.nRows = res.rows.length;
      for (let c = 0; c < res.nCols; c++) { const cur = sh.cols[c0 + c]; if (!cur || cur < 90) { const cols = Object.assign({}, sh.cols); cols[c0 + c] = Math.max(cur || 0, c < res.L ? 130 : 105); sh.cols = cols; } }
      return res;
    }
    function savePivot(sh, p, label) { S.tx(() => { writePivot(sh, p); setPivots(sh, pivots(sh).filter((x) => x.id !== p.id).concat([p])); }, label || "pivot"); S.bump(); S.render(); }
    const refreshOne = (sh, p) => { const np = JSON.parse(JSON.stringify(p)); savePivot(sh, np, "refresh pivot"); return np; };

    /* ---- creation ---- */
    X_.pivotNew = (tbl) => {
      const sh = cs(); let srcSheet = sh, g, tname = null;
      if (tbl) { g = U.parseR(tbl.range); tname = tbl.name; } else { g = S.whole || (S.sel.r1 === S.sel.r2 && S.sel.c1 === S.sel.c2) ? S.region(S.cur.r, S.cur.c) : S.sel; }
      if (!g || g.r2 - g.r1 < 1) { say("Select the cells that hold your data (with a heading row) first, then choose PivotTable."); return; }
      form(an(), "Create PivotTable", [{ k: "src", label: "Data to analyse", value: tname ? tname : U.rstr(g) }, { k: "where", label: "Where to put it", type: "select", opts: [["new", "On a new sheet"], ["here", "On this sheet, at the selected cell"]], value: "new" }], "Create", (v) => {
        let sname = srcSheet.name, range = v.src.trim(), table = null; const tm = (() => { for (const s of wb.sheets) for (const t of X_.tables.list(s)) if (t.name.toLowerCase() === range.toLowerCase()) return { s, t }; return null; })();
        if (tm) { table = tm.t.name; sname = tm.s.name; range = tm.t.range; } else { const m = /^(?:'?([^'!]+)'?!)?(.+)$/.exec(range); if (m && m[1]) { sname = m[1]; range = m[2]; } if (!U.parseR(range)) { say("The data range should look like A1:F200 or a table name."); return; } range = U.rstr(U.parseR(range)); }
        const p = { id: "pv" + Math.random().toString(36).slice(2, 7), name: "PivotTable" + (pivots(sh).length + 1), srcSheet: sname, src: range, srcTable: table, rows: [], cols: [], vals: [], filters: [], gt: true, gtc: true, sub: true, group: {}, sort: "asc", nf: "auto", at: "A3" };
        const src = source(p); if (src.err) { say(src.err); return; }
        let target = sh;
        if (v.where === "new") { let n = 1; while (wb.sheet("Pivot" + n)) n++; S.tx(() => S.sheetsOp(() => { wb.sheets.push(new C.Sheet("Pivot" + n)); wb.active = wb.sheets.length - 1; })); S.layout(); S.drawTabs(); target = cs(); } else p.at = C.addr(S.cur.r, S.cur.c);
        // helpful starting point: first text column as rows, first numeric column as a sum
        const ti = src.heads.findIndex((_, j) => !src.dates[j] && src.recs.slice(0, 20).some((r) => typeof r.vals[j] === "string")), ni = src.heads.findIndex((_, j) => !src.dates[j] && j !== ti && src.recs.slice(0, 20).some((r) => typeof r.vals[j] === "number"));
        if (ti >= 0) p.rows = [src.heads[ti]]; if (ni >= 0) p.vals = [{ f: src.heads[ni], agg: "sum" }]; else p.vals = [{ f: null, agg: "count" }];
        S.tx(() => { S.putCell(target, 1, 1, { v: "PivotTable: " + p.name, s: wb.styleId({ b: 1, fs: 14 }) }); }); savePivot(target, p, "create pivot"); S.setSel(3, 1); openPanel(p.id); say("PivotTable created. Use the Fields panel on the right to choose what goes in rows, columns and values.", true);
      });
    };

    /* ---- panel ---- */
    let panelEl = null, panelId = null;
    const curPivot = () => { const sh = cs(); return pivots(sh).find((x) => x.id === panelId) || pivotAt(sh, S.cur.r, S.cur.c); };
    function closePanel() { if (panelEl) { panelEl.remove(); panelEl = null; } panelId = null; }
    function mutate(fn) { const sh = cs(), p = pivots(sh).find((x) => x.id === panelId); if (!p) return; const np = JSON.parse(JSON.stringify(p)); fn(np); savePivot(sh, np, "pivot"); drawPanel(); S.redrawRibbon(); }
    function openPanel(id) { const sh = cs(); const p = id ? pivots(sh).find((x) => x.id === id) : curPivot(); if (!p) { say("Click a cell inside a PivotTable first."); return; } panelId = p.id; if (getComputedStyle(S.W).position === "static") S.W.style.position = "relative"; if (!panelEl) { panelEl = document.createElement("div"); panelEl.className = "pvp"; S.W.append(panelEl); } drawPanel(); }
    function role(p, f) { if ((p.rows || []).includes(f)) return "rows"; if ((p.cols || []).includes(f)) return "cols"; const v = (p.vals || []).find((x) => x.f === f); if (v) return "val:" + v.agg; if ((p.filters || []).some((x) => x.f === f)) return "filter"; return ""; }
    function drawPanel() {
      if (!panelEl) return; const sh = cs(), p = pivots(sh).find((x) => x.id === panelId); if (!p) { closePanel(); return; } const src = source(p); if (src.err) { panelEl.innerHTML = `<h4>PivotTable fields<button data-x>×</button></h4><div class="pvb">${esc(src.err)}</div>`; panelEl.querySelector("[data-x]").onclick = closePanel; return; }
      const opt = (v, l, cur) => `<option value="${esc(v)}"${String(cur) === String(v) ? " selected" : ""}>${esc(l)}</option>`;
      const roles = (j, f) => { const d = src.dates[j]; let h = opt("", "—", role(p, f)) + opt("rows", "Rows", role(p, f)) + opt("cols", "Columns", role(p, f)); if (d) ["year", "quarter", "month"].forEach((g) => { h += opt("rows:" + g, "Rows by " + GRP[g], role(p, f) === "rows" && (p.group || {})[f] === g ? "rows:" + g : role(p, f)); h += opt("cols:" + g, "Columns by " + GRP[g], role(p, f) === "cols" && (p.group || {})[f] === g ? "cols:" + g : role(p, f)); }); Object.keys(AGG).forEach((a) => (h += opt("val:" + a, "Values: " + AGG[a], role(p, f)))); h += opt("filter", "Filter", role(p, f)); return h; };
      const order = (arr, kind) => arr.map((f, i) => `<div class="pvr"><b>${esc(f.f || f)}</b><button class="pvm" data-mv="${kind}:${i}:-1" title="Move up">▲</button><button class="pvm" data-mv="${kind}:${i}:1" title="Move down">▼</button></div>`).join("");
      const filt = (p.filters || []).map((f, i) => { const j = src.heads.indexOf(f.f); if (j < 0) return ""; const uniq = [...new Set(src.recs.map((r) => keyOf(src, r, f.f, (p.group || {})[f.f]).l))].sort((a, b) => a.localeCompare(b)); return `<div class="pvs">${esc(f.f)}</div><select multiple size="${Math.min(5, uniq.length + 1)}" data-fs="${i}">${uniq.map((u) => `<option${f.sel && f.sel.includes(u) ? " selected" : ""}>${esc(u)}</option>`).join("")}</select><div style="font-size:11px;color:var(--mut,#667)">Nothing selected = show everything. Hold Ctrl to pick several.</div>`; }).join("");
      panelEl.innerHTML = `<h4>PivotTable fields<button data-x title="Close">×</button></h4><div class="pvb">
        <div style="color:var(--mut,#667);font-size:12px">${esc(p.name)} — data from <b>${esc(p.srcTable || p.srcSheet + "!" + p.src)}</b></div><div class="pvs">Pick a role for each field</div>
        ${src.heads.map((f, j) => `<div class="pvr"><b title="${esc(f)}">${esc(f)}</b><select data-f="${esc(f)}">${roles(j, f)}</select></div>`).join("")}
        ${(p.rows || []).length > 1 ? `<div class="pvs">Row order</div>${order(p.rows, "rows")}` : ""}${(p.cols || []).length > 1 ? `<div class="pvs">Column order</div>${order(p.cols, "cols")}` : ""}${(p.vals || []).length > 1 ? `<div class="pvs">Value order</div>${order(p.vals, "vals")}` : ""}
        ${filt}
        <div class="pvs">Options</div>
        <label class="pvr"><input type="checkbox" data-o="gt"${p.gt !== false ? " checked" : ""}> <span>Grand total row</span></label><label class="pvr"><input type="checkbox" data-o="gtc"${p.gtc !== false ? " checked" : ""}> <span>Grand total column</span></label><label class="pvr"><input type="checkbox" data-o="sub"${p.sub !== false ? " checked" : ""}> <span>Subtotals (when there are 2+ row fields)</span></label>
        <div class="pvr"><b>Show values as</b><select data-o="show">${opt("value", "Value", (p.vals[0] || {}).show || "value")}${opt("pct_total", "% of grand total", (p.vals[0] || {}).show)}${opt("pct_row", "% of row total", (p.vals[0] || {}).show)}${opt("pct_col", "% of column total", (p.vals[0] || {}).show)}</select></div>
        <div class="pvr"><b>Sort labels</b><select data-o="sort">${opt("asc", "A → Z", p.sort)}${opt("desc", "Z → A", p.sort)}${opt("valdesc", "Largest first", p.sort)}</select></div>
        <div class="pvr"><b>Number format</b><select data-o="nf">${opt("auto", "Automatic", p.nf)}${opt("#,##,##0", "1,23,456", p.nf)}${opt("#,##,##0.00", "1,23,456.00", p.nf)}${opt('"₹"#,##,##0', "₹ 1,23,456", p.nf)}${opt("0.0%", "Percentage", p.nf)}</select></div>
        </div><div class="pvx"><button class="p" data-act="refresh" title="Read the source data again">Refresh</button><button data-act="chart" title="Draw a chart of this PivotTable">Chart</button></div>`;
      panelEl.querySelector("[data-x]").onclick = closePanel;
      panelEl.querySelectorAll("select[data-f]").forEach((el) => (el.onchange = () => { const f = el.dataset.f, v = el.value; mutate((np) => { np.rows = (np.rows || []).filter((x) => x !== f); np.cols = (np.cols || []).filter((x) => x !== f); np.vals = (np.vals || []).filter((x) => x.f !== f); np.filters = (np.filters || []).filter((x) => x.f !== f); np.group = Object.assign({}, np.group); delete np.group[f]; if (!v) return; const [k, g] = v.split(":"); if (k === "rows") { np.rows.push(f); if (g) np.group[f] = g; } else if (k === "cols") { np.cols.push(f); if (g) np.group[f] = g; } else if (k === "val") np.vals.push({ f, agg: g, show: (np.vals[0] || {}).show }); else if (k === "filter") np.filters.push({ f, sel: [] }); }); }));
      panelEl.querySelectorAll("[data-mv]").forEach((b) => (b.onclick = () => { const [kind, i, d] = b.dataset.mv.split(":"); mutate((np) => { const a = np[kind], x = +i, y = x + +d; if (y < 0 || y >= a.length) return; [a[x], a[y]] = [a[y], a[x]]; }); }));
      panelEl.querySelectorAll("select[data-fs]").forEach((el) => (el.onchange = () => { const i = +el.dataset.fs, sel = [...el.selectedOptions].map((o) => o.value); mutate((np) => { np.filters[i].sel = sel; }); }));
      panelEl.querySelectorAll("[data-o]").forEach((el) => (el.onchange = () => { const k = el.dataset.o; mutate((np) => { if (el.type === "checkbox") np[k] = el.checked; else if (k === "show") np.vals.forEach((v) => (v.show = el.value)); else np[k] = el.value; }); }));
      panelEl.querySelector('[data-act="refresh"]').onclick = () => { refreshOne(cs(), p); drawPanel(); say("PivotTable refreshed."); };
      panelEl.querySelector('[data-act="chart"]').onclick = () => pivotChart();
    }
    function pivotChart() {
      const sh = cs(), p = curPivot(); if (!p) { say("Click a cell inside a PivotTable first."); return; } if ((p.rows || []).length !== 1) { say("For a chart, put exactly one field in Rows (columns can be used for a second dimension)."); return; }
      const c0 = U.parseR(p.at).c1, h = p.hdr, nVals = Math.max(1, (p.vals || []).length), nCols = p.nCols; const hdrRows = p.cols && p.cols.length ? (p.vals || []).length > 1 || true ? 3 : 2 : 1; const dataTop = h + hdrRows - 1; const last = h + p.nRows - 1 - (p.gt !== false ? 1 : 0); let lastC = c0 + nCols - 1; if (p.cols && p.cols.length && p.gtc !== false) lastC -= nVals; if (last < dataTop + 1) { say("There is nothing to chart yet."); return; }
      const hr = hdrRows === 3 && !(p.vals || []).length ? h + 1 : h + hdrRows - 1; void hr; const range = C.addr(h + hdrRows - 1, c0) + ":" + C.addr(last, lastC);
      const ch = { id: "ch" + Math.random().toString(36).slice(2, 8), type: "col", title: p.name, range, byRow: false, header: true, stacked: false, legend: "bottom", x: Math.round(S.x.colX ? S.x.colX(sh, lastC + 2) : 700), y: 40, w: 520, h: 320 };
      S.tx(() => S.setMeta(sh, "charts", sh.charts.concat([ch]))); S.x.renderCharts && S.x.renderCharts(); say("Chart added next to the PivotTable. Refresh the PivotTable and re-check the chart's data range if you change the layout.", true);
    }
    X_.pivotChart = pivotChart;

    /* ---- ribbon ---- */
    let lastP = null;
    const prev = X_.onSelect; X_.onSelect = () => { if (prev) prev(); const p = pivotAt(cs(), S.cur.r, S.cur.c), id = p ? p.id : null; if (id !== lastP) { lastP = id; S.redrawRibbon(); } if (p && panelEl && panelId !== p.id) { panelId = p.id; drawPanel(); } };
    const tabsIdx = tabs.findIndex((t) => t.id === "table");
    const pvTab = { id: "pivot", label: "PivotTable analyze", ctx: true, when: () => !!pivotAt(cs(), S.cur.r, S.cur.c), groups: [
      { label: "PivotTable", items: [{ i: "table", label: "Fields", big: true, t: "Show or hide the field panel", on: () => (panelEl ? closePanel() : openPanel()), act: () => !!panelEl }, { i: "dup", label: "Refresh", t: "Read the source data again", on: () => { const p = curPivot(); if (p) { refreshOne(cs(), p); say("PivotTable refreshed."); } } }, { i: "dup", label: "Refresh all", on: () => { const sh = cs(); pivots(sh).forEach((p) => refreshOne(sh, p)); wb.sheets.forEach((s2) => { if (s2 !== sh) { const keep = wb.active; wb.active = wb.sheets.indexOf(s2); pivots(s2).forEach((p) => refreshOne(s2, p)); wb.active = keep; } }); say("All PivotTables refreshed."); } }] },
      { label: "Show", items: [{ k: "menu", i: "param", label: "Values as", items: () => [["Value", "value"], ["% of grand total", "pct_total"], ["% of row total", "pct_row"], ["% of column total", "pct_col"]].map((a) => ({ label: a[0], on: ((curPivot() || {}).vals || [{}])[0] && ((curPivot().vals[0] || {}).show || "value") === a[1], run: () => { const p = curPivot(); if (!p) return; panelId = p.id; mutate((np) => np.vals.forEach((v) => (v.show = a[1]))); } })) }, { k: "menu", i: "sortA", label: "Sort", items: () => [["Labels A → Z", "asc"], ["Labels Z → A", "desc"], ["Largest first", "valdesc"]].map((a) => ({ label: a[0], on: (curPivot() || {}).sort === a[1], run: () => { const p = curPivot(); if (!p) return; panelId = p.id; mutate((np) => (np.sort = a[1])); } })) }, { i: "sum", label: "Grand totals", on: () => { const p = curPivot(); if (!p) return; panelId = p.id; mutate((np) => { const on = np.gt !== false; np.gt = !on; np.gtc = !on; }); }, act: () => (curPivot() || {}).gt !== false }, { i: "layout", label: "Subtotals", on: () => { const p = curPivot(); if (!p) return; panelId = p.id; mutate((np) => (np.sub = np.sub === false)); }, act: () => (curPivot() || {}).sub !== false }] },
      { label: "Tools", items: [{ i: "chart", label: "PivotChart", t: "Draw a chart of this PivotTable", on: pivotChart }, { i: "param", label: "Change source", on: () => { const p = curPivot(); if (!p) return; form(an(), "Change data source", [{ k: "s", label: "Range (Sheet!A1:F200) or table name", value: p.srcTable || p.srcSheet + "!" + p.src }], "Change", (v) => { const t = v.s.trim(); const np = JSON.parse(JSON.stringify(p)); const tm = (() => { for (const s of wb.sheets) for (const x of X_.tables.list(s)) if (x.name.toLowerCase() === t.toLowerCase()) return x; return null; })(); if (tm) { np.srcTable = tm.name; } else { const m = /^(?:'?([^'!]+)'?!)?(.+)$/.exec(t); if (!m || !U.parseR(m[2])) { say("That doesn't look like a range."); return; } np.srcTable = null; np.srcSheet = m[1] || np.srcSheet; np.src = U.rstr(U.parseR(m[2])); } savePivot(cs(), np, "pivot"); drawPanel(); }); } }, { i: "trash", label: "Delete", t: "Remove this PivotTable", on: () => { const sh = cs(), p = curPivot(); if (!p) return; S.tx(() => { const g = U.parseR(p.out); if (g) for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) if (sh.get(r, c)) S.putCell(sh, r, c, null); setPivots(sh, pivots(sh).filter((x) => x.id !== p.id)); }); closePanel(); S.bump(); S.render(); S.redrawRibbon(); } }] }
    ] };
    tabs.splice(tabsIdx < 0 ? tabs.length : tabsIdx, 0, pvTab);
    const ins = tabs.find((t) => t.id === "insert"); if (ins) { const g = ins.groups.find((x) => x.label === "Tables"); if (g) g.items.unshift({ i: "table", label: "PivotTable", big: true, t: "Summarise your data: totals by category, month, region…", on: () => X_.pivotNew() }); }
    const data = tabs.find((t) => t.id === "data"); if (data) data.groups.push({ label: "Analyse", items: [{ i: "table", label: "PivotTable", big: true, on: () => X_.pivotNew() }, { i: "dup", label: "Refresh all", on: () => { const sh = cs(); pivots(sh).forEach((p) => refreshOne(sh, p)); say(pivots(sh).length ? "PivotTables on this sheet refreshed." : "There are no PivotTables on this sheet."); } }] });
    X_.pivots = { compute, source, list: pivots };
    const dest = X_.destroy; X_.destroy = () => { closePanel(); if (dest) dest(); };
  });
})();
