/* KMR Office Suite - Spreadsheets, part 5: what-if analysis (Goal Seek, Scenarios, Data Table), Flash Fill, Subtotals and outline groups,
   formula auditing (trace precedents / dependents), Go To Special, print options (area, margins, scale, breaks, repeated rows). */
(function () {
  "use strict";
  const { form, esc } = OffUI, C = window.Calc, U = window.OffSheetUtil;

  (window.OffSheetP = window.OffSheetP || []).push(function (S, tabs) {
    const X_ = S.x, wb = S.wb, cs = S.cs, say = S.say;
    const an = () => S.W.querySelector(".sfx");
    const setExt = (sh, k, v) => S.setMeta(sh, "ext", Object.assign({}, sh.ext, { [k]: v }));
    const addrOf = (r, c) => C.addr(r, c);
    const cellRef = (t, sh) => { const m = /^(?:'?([^'!]+)'?!)?\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(String(t).trim()); if (!m) return null; const s2 = m[1] ? wb.sheet(m[1]) : sh; if (!s2) return null; const p = C.parseAddr(m[2] + m[3]); return p ? { sh: s2, r: p.r, c: p.c } : null; };
    const recalc = () => { wb.invalidate(); };

    /* ========== What-if: Goal Seek ========== */
    function goalSeek() {
      const sh = cs(); form(an(), "Goal Seek", [{ k: "set", label: "Set this cell (it holds a formula)", value: addrOf(S.cur.r, S.cur.c) }, { k: "to", label: "To this value", value: "" }, { k: "by", label: "By changing this cell (a typed number, not a formula)", value: "" }], "Find answer", (v) => {
        const a = cellRef(v.set, sh), b = cellRef(v.by, sh), goal = parseFloat(String(v.to).replace(/,/g, ""));
        if (!a || !b || !isFinite(goal)) { say("Fill the three boxes: a cell with a formula, the value you want, and a cell to change."); return; }
        const orig = b.sh.get(b.r, b.c), saved = orig ? S.clone(orig) : null; if (orig && orig.f) { say("The cell to change must hold a plain number, not a formula."); return; }
        const f = (x) => { b.sh.set(b.r, b.c, Object.assign({}, saved || {}, { v: x })); recalc(); const y = wb.value(a.sh, a.r, a.c); return typeof y === "number" ? y - goal : NaN; };
        let x0 = saved && typeof saved.v === "number" ? saved.v : 1, sol = null;
        try {
          let f0 = f(x0); if (Math.abs(f0) < 1e-9) sol = x0;
          if (sol == null) { // secant, then bracket + bisection
            let x1 = x0 === 0 ? 1 : x0 * 1.1, f1 = f(x1);
            for (let i = 0; i < 60 && sol == null; i++) { if (!isFinite(f1) || f1 === f0) break; const x2 = x1 - f1 * (x1 - x0) / (f1 - f0); const f2 = f(x2); x0 = x1; f0 = f1; x1 = x2; f1 = f2; if (Math.abs(f1) < 1e-7) sol = x1; }
          }
          if (sol == null) { let lo = -1e6, hi = 1e6, flo = f(lo), fhi = f(hi); if (isFinite(flo) && isFinite(fhi) && flo * fhi < 0) { for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2, fm = f(m); if (Math.abs(fm) < 1e-8) { sol = m; break; } if (flo * fm < 0) { hi = m; fhi = fm; } else { lo = m; flo = fm; } } if (sol == null) sol = (lo + hi) / 2; } }
        } finally { if (saved) b.sh.set(b.r, b.c, saved); else b.sh.del(b.r, b.c); recalc(); }
        if (sol == null || !isFinite(sol)) { S.bump(); S.render(); say("Goal Seek could not find an answer. Try a different starting number in the cell to change."); return; }
        sol = Math.abs(sol) < 1e-9 ? 0 : +sol.toPrecision(12);
        S.tx(() => S.putCell(b.sh, b.r, b.c, Object.assign({}, saved || {}, { v: sol })), "goal seek"); S.render();
        say("Found it: " + addrOf(b.r, b.c) + " = " + sol + " makes " + addrOf(a.r, a.c) + " equal " + goal + ". (Ctrl+Z puts the old number back.)", true);
      });
    }

    /* ========== What-if: Scenarios ========== */
    function scenarios() {
      const sh = cs(), list = sh.ext.scen || [];
      form(an(), "Scenarios", [
        { k: "act", label: "What do you want to do?", type: "select", opts: [["show", "Show a saved scenario"], ["add", "Save the current numbers as a scenario"], ["del", "Delete a scenario"], ["sum", "Compare all scenarios on a new sheet"]], value: list.length ? "show" : "add" },
        { k: "pick", label: "Scenario (for show / delete)", type: "select", opts: list.length ? list.map((s) => s.name) : ["(none saved yet)"], value: list.length ? list[0].name : "" },
        { k: "name", label: "Name for a new scenario", value: "" }, { k: "cells", label: "Cells that change in a scenario (for save), e.g. B2:B5", value: U.rstr(S.sel) }, { k: "res", label: "Result cell to compare (for the comparison)", value: "" }
      ], "Go", (v) => {
        if (v.act === "add") { const g = U.parseR(v.cells), name = String(v.name).trim(); if (!g || !name) { say("Give the scenario a name and the cells that change."); return; } const vals = []; for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) { const x = sh.get(r, c); vals.push(x ? (x.f ? x.f : x.v == null ? null : x.v) : null); } S.tx(() => setExt(sh, "scen", list.filter((s) => s.name !== name).concat([{ name, cells: U.rstr(g), vals }]))); say("Scenario “" + name + "” saved."); return; }
        const s0 = list.find((s) => s.name === v.pick);
        if (v.act === "del") { if (!s0) return; S.tx(() => setExt(sh, "scen", list.filter((s) => s !== s0))); say("Scenario deleted."); return; }
        if (v.act === "show") { if (!s0) { say("There is no saved scenario yet."); return; } const g = U.parseR(s0.cells); S.tx(() => { let i = 0; for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) { const x = s0.vals[i++], old = sh.get(r, c); const n = Object.assign({}, old ? S.clone(old) : {}); delete n.v; delete n.f; if (typeof x === "string" && x[0] === "=") n.f = x; else if (x != null) n.v = x; S.putCell(sh, r, c, n.v != null || n.f || n.s ? n : null); } }, "scenario"); S.render(); say("Showing scenario “" + s0.name + "”."); return; }
        if (v.act === "sum") {
          if (!list.length) { say("Save at least one scenario first."); return; } const rc = v.res ? cellRef(v.res, sh) : null; const keep = { vals: [] }; const first = U.parseR(list[0].cells);
          const snap = []; for (let r = first.r1; r <= first.r2; r++) for (let c = first.c1; c <= first.c2; c++) { const x = sh.get(r, c); snap.push(x ? S.clone(x) : null); }
          const rows = [["Scenario summary", ...list.map((s) => s.name)]]; const cellsList = []; for (let r = first.r1; r <= first.r2; r++) for (let c = first.c1; c <= first.c2; c++) cellsList.push([r, c]);
          cellsList.forEach(([r, c], i) => rows.push(["Changing cell " + addrOf(r, c), ...list.map((s) => { const x = s.vals[i]; return x == null ? "" : x; })]));
          if (rc) { const resRow = ["Result " + addrOf(rc.r, rc.c)]; try { list.forEach((s) => { const g = U.parseR(s.cells); let i = 0; for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) { const x = s.vals[i++], n = {}; if (typeof x === "string" && x[0] === "=") n.f = x; else if (x != null) n.v = x; const old = sh.get(r, c); sh.set(r, c, Object.assign({}, old ? S.clone(old) : {}, { v: undefined, f: undefined }, n)); } recalc(); resRow.push(wb.value(rc.sh, rc.r, rc.c)); }); } finally { let i = 0; for (let r = first.r1; r <= first.r2; r++) for (let c = first.c1; c <= first.c2; c++) { const x = snap[i++]; if (x) sh.set(r, c, x); else sh.del(r, c); } recalc(); } rows.push(resRow); }
          let n = 1; while (wb.sheet("Scenarios" + n)) n++; const name = "Scenarios" + n; S.tx(() => { S.sheetsOp(() => { wb.sheets.push(new C.Sheet(name)); wb.active = wb.sheets.length - 1; }); const t = cs(); rows.forEach((row, i) => row.forEach((val, j) => { if (val === "" || val == null) return; S.putCell(t, i + 1, j + 1, { v: val, s: wb.styleId(i === 0 || j === 0 ? { b: 1, bg: i === 0 ? "#4472c4" : "#d9e1f2", fc: i === 0 ? "#ffffff" : undefined } : {}) }); })); const cols = { 1: 200 }; for (let j = 2; j <= list.length + 1; j++) cols[j] = 120; t.cols = cols; }); S.layout(); S.drawTabs(); S.setSel(1, 1); S.render(); say("Comparison written to the new sheet " + name + ".");
        }
      });
      void esc;
    }

    /* ========== What-if: Data Table (values) ========== */
    function dataTable() {
      const sh = cs(), g = S.sel; if (g.r2 - g.r1 < 1 || g.c2 - g.c1 < 1) { say("Select the whole block first: the formula in the top-left corner, input values across the top row and/or down the left column."); return; }
      form(an(), "Data table", [{ k: "row", label: "Row input cell (the cell that takes the values across the top row)", value: "" }, { k: "col", label: "Column input cell (takes the values down the left column)", value: "" }], "Fill table", (v) => {
        const rin = v.row ? cellRef(v.row, sh) : null, cin = v.col ? cellRef(v.col, sh) : null; if (!rin && !cin) { say("Enter at least one input cell."); return; }
        const corner = sh.get(g.r1, g.c1); if (!corner || !corner.f) { say("The top-left cell of the selection must contain the formula you want to test."); return; }
        const saveR = rin ? (rin.sh.get(rin.r, rin.c) ? S.clone(rin.sh.get(rin.r, rin.c)) : null) : null, saveC = cin ? (cin.sh.get(cin.r, cin.c) ? S.clone(cin.sh.get(cin.r, cin.c)) : null) : null; const out = [];
        try {
          for (let r = g.r1 + 1; r <= g.r2; r++) for (let c = g.c1 + 1; c <= g.c2; c++) {
            if (rin) rin.sh.set(rin.r, rin.c, Object.assign({}, saveR || {}, { v: wb.value(sh, g.r1, c), f: undefined })); if (cin) cin.sh.set(cin.r, cin.c, Object.assign({}, saveC || {}, { v: wb.value(sh, r, g.c1), f: undefined })); recalc(); out.push([r, c, wb.value(sh, g.r1, g.c1)]);
          }
        } finally { if (rin) { if (saveR) rin.sh.set(rin.r, rin.c, saveR); else rin.sh.del(rin.r, rin.c); } if (cin) { if (saveC) cin.sh.set(cin.r, cin.c, saveC); else cin.sh.del(cin.r, cin.c); } recalc(); }
        S.tx(() => out.forEach(([r, c, x]) => { const old = sh.get(r, c); S.putCell(sh, r, c, Object.assign({}, old ? S.clone(old) : {}, { v: typeof x === "number" || typeof x === "string" || typeof x === "boolean" ? x : null, f: undefined })); }), "data table"); S.render(); say("Data table filled with values. It does not update by itself - run it again after changing your numbers.", true);
      });
    }

    /* ========== Flash Fill ========== */
    const words = (s) => String(s).split(/\s+/).filter(Boolean), up1 = (w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w);
    const DELIMS = [" ", ",", "-", "/", "@", ".", "_", "(", ")", ":", ";", "|", "#", "&", "+"];
    function* transforms(ncols) {
      yield ["same", (a) => a[0]]; yield ["upper", (a) => a[0].toUpperCase()]; yield ["lower", (a) => a[0].toLowerCase()]; yield ["proper", (a) => words(a[0]).map(up1).join(" ")]; yield ["trim", (a) => a[0].trim()];
      yield ["word0", (a) => words(a[0])[0] || ""]; yield ["lastword", (a) => words(a[0]).slice(-1)[0] || ""]; yield ["lastwordP", (a) => up1(words(a[0]).slice(-1)[0] || "")];
      for (let n = 0; n < 8; n++) { if (n) yield ["word" + n, (a) => words(a[0])[n] || ""]; yield ["wordU" + n, (a) => (words(a[0])[n] || "").toUpperCase()]; yield ["wordP" + n, (a) => up1(words(a[0])[n] || "")]; } yield ["allbutlast", (a) => words(a[0]).slice(0, -1).join(" ")]; yield ["allbutfirst", (a) => words(a[0]).slice(1).join(" ")];
      yield ["initials", (a) => words(a[0]).map((w) => w[0].toUpperCase()).join("")]; yield ["initialsdot", (a) => words(a[0]).map((w) => w[0].toUpperCase() + ".").join("")]; yield ["firstinit", (a) => (words(a[0])[0] || "")[0] || ""];
      yield ["digits", (a) => a[0].replace(/\D+/g, "")]; yield ["letters", (a) => a[0].replace(/[^A-Za-z]+/g, "")]; yield ["alnum", (a) => a[0].replace(/[^A-Za-z0-9]+/g, "")]; yield ["nospace", (a) => a[0].replace(/\s+/g, "")];
      for (let k = 1; k <= 12; k++) { yield ["left" + k, (a) => a[0].slice(0, k)]; yield ["right" + k, (a) => a[0].slice(-k)]; yield ["dropleft" + k, (a) => a[0].slice(k)]; yield ["dropright" + k, (a) => a[0].slice(0, -k)]; }
      DELIMS.forEach((d) => { yield_([`before${d}`, (a) => { const i = a[0].indexOf(d); return i < 0 ? "" : a[0].slice(0, i); }], [`after${d}`, (a) => { const i = a[0].indexOf(d); return i < 0 ? "" : a[0].slice(i + d.length); }], [`beforeL${d}`, (a) => { const i = a[0].lastIndexOf(d); return i < 0 ? "" : a[0].slice(0, i); }], [`afterL${d}`, (a) => { const i = a[0].lastIndexOf(d); return i < 0 ? "" : a[0].slice(i + d.length); }]); });
      function yield_() { /* collected below */ }
      if (ncols >= 2) ["", " ", ", ", "-", "_", "/", ".", " - ", "@"].forEach((sep) => { /* joined later */ void sep; });
    }
    function candidateList(ncols) {
      const list = []; for (const t of transforms(ncols)) list.push(t);
      DELIMS.forEach((d) => { list.push([`before${d}`, (a) => { const i = a[0].indexOf(d); return i < 0 ? "" : a[0].slice(0, i); }], [`after${d}`, (a) => { const i = a[0].indexOf(d); return i < 0 ? "" : a[0].slice(i + d.length); }], [`beforeL${d}`, (a) => { const i = a[0].lastIndexOf(d); return i < 0 ? "" : a[0].slice(0, i); }], [`afterL${d}`, (a) => { const i = a[0].lastIndexOf(d); return i < 0 ? "" : a[0].slice(i + d.length); }]); });
      DELIMS.forEach((d) => DELIMS.forEach((e) => { if (d !== e) list.push([`between${d}${e}`, (a) => { const i = a[0].indexOf(d); if (i < 0) return ""; const j = a[0].indexOf(e, i + d.length); return j < 0 ? "" : a[0].slice(i + d.length, j); }]); }));
      if (ncols >= 2) { const seps = ["", " ", ", ", ",", "-", "_", "/", ".", " - ", "@", ":"], fx = [["", (x) => x], ["U", (x) => x.toUpperCase()], ["L", (x) => x.toLowerCase()], ["P", (x) => words(x).map(up1).join(" ")]]; for (const sep of seps) for (const [fn, f] of fx) { list.push([`join${sep}${fn}`, (a) => f(a[0]) + sep + f(a[1])]); list.push([`rjoin${sep}${fn}`, (a) => f(a[1]) + sep + f(a[0])]); } list.push(["firstword+2", (a) => (words(a[0])[0] || "") + " " + a[1]]); list.push(["init+2", (a) => (a[0][0] || "").toUpperCase() + ". " + a[1]]); list.push(["init+2n", (a) => (a[0][0] || "").toUpperCase() + a[1]]); list.push(["init+2l", (a) => ((a[0][0] || "") + a[1]).toLowerCase()]); }
      return list;
    }
    X_.flashFill = () => {
      const sh = cs(), c = S.cur.c; if (c < 2 && !(sh.get(S.cur.r, c + 1))) { say("Flash Fill needs your data in the column to the left. Type the result you want for the first row or two, then press Ctrl+E."); return; }
      // find the source columns (nearest columns left holding data) and the row span
      const srcCols = []; for (let cc = c - 1; cc >= 1 && srcCols.length < 2; cc--) { let n = 0; for (let r = 1; r <= 60; r++) if (sh.get(r, cc) && sh.get(r, cc).v != null) n++; if (n) srcCols.unshift(cc); else if (srcCols.length) break; }
      if (!srcCols.length) { say("I can't see data to the left of this column to learn from."); return; }
      const ref = srcCols[srcCols.length - 1]; let top = S.cur.r, bot = S.cur.r; const has = (r) => { const x = sh.get(r, ref); return !!x && (x.v != null || !!x.f); };
      if (!has(top)) { say("Click a cell next to your data, type an example result, then use Flash Fill."); return; } while (top > 1 && has(top - 1)) top--; while (has(bot + 1)) bot++;
      const text = (r, cc) => String(wb.text(sh, r, cc).text || "");
      const ex = []; for (let r = top; r <= bot; r++) { const x = sh.get(r, c); if (x && x.v != null && !x.f && String(x.v) !== "") ex.push(r); }
      if (!ex.length) { say("Type an example in this column first (for example the first name from the first row), then press Ctrl+E."); return; }
      const targets = []; for (let r = top; r <= bot; r++) { const x = sh.get(r, c); if (!x || (x.v == null && !x.f)) targets.push(r); }
      if (!targets.length) { say("Every row already has a value."); return; }
      const inp = (r) => srcCols.map((cc) => text(r, cc)); let found = null;
      for (const nc of srcCols.length >= 2 ? [1, 2] : [1]) {
        const cols = nc === 1 ? [srcCols[srcCols.length - 1]] : srcCols; const get = (r) => cols.map((cc) => text(r, cc));
        for (const [name, fn] of candidateList(nc)) {
          const out = (r) => { try { return fn(get(r)); } catch (e) { return ""; } }; const r1 = ex[0], o1 = String(sh.get(r1, c).v), t1 = out(r1); let P = "", Q = "";
          if (t1 === "" && o1 !== "") { continue; } const idx = t1 === "" ? 0 : o1.indexOf(t1); if (idx < 0) continue; P = o1.slice(0, idx); Q = o1.slice(idx + t1.length);
          if (ex.every((r) => P + out(r) + Q === String(sh.get(r, c).v))) { found = { name, fn, P, Q, get }; break; }
        }
        if (found) break;
      }
      void inp;
      if (!found) { say("Flash Fill couldn't see a pattern yet. Type one or two more examples (different-looking rows help) and press Ctrl+E again."); return; }
      S.tx(() => { targets.forEach((r) => { let v = ""; try { v = found.P + found.fn(found.get(r)) + found.Q; } catch (e) { v = ""; } const num = /^-?\d+(\.\d+)?$/.test(v) && !/^0\d/.test(v) && v.length < 15; const old = sh.get(r, c); S.putCell(sh, r, c, Object.assign({}, old ? S.clone(old) : {}, { v: num ? +v : v })); }); }, "flash fill"); S.render();
      say("Flash Fill completed " + targets.length + " cell" + (targets.length > 1 ? "s" : "") + ". (Ctrl+Z undoes it.)", true);
    };

    /* ========== Subtotals and outline groups ========== */
    const grp = (sh) => sh.ext.grp || { rows: [], cols: [] };
    function setGrp(sh, g) { setExt(sh, "grp", g); }
    function groupSel(axis) {
      const sh = cs(), g = grp(sh), a = axis === "r" ? S.sel.r1 : S.sel.c1, b = axis === "r" ? S.sel.r2 : S.sel.c2; if (a === b && !S.whole) { /* single row/col is fine */ }
      S.tx(() => setGrp(sh, { rows: g.rows.concat(axis === "r" ? [{ a, b, c: false }] : []), cols: g.cols.concat(axis === "c" ? [{ a, b, c: false }] : []) })); say((axis === "r" ? "Rows " : "Columns ") + (axis === "r" ? a + "–" + b : C.nCol(a) + "–" + C.nCol(b)) + " grouped. Use Hide detail / Show detail to collapse or expand.");
    }
    function ungroupSel(axis) { const sh = cs(), g = grp(sh), a = axis === "r" ? S.sel.r1 : S.sel.c1, b = axis === "r" ? S.sel.r2 : S.sel.c2; const keep = (arr) => arr.filter((o) => !(o.a <= b && o.b >= a)); showDetail(axis, true); S.tx(() => setGrp(sh, { rows: axis === "r" ? keep(g.rows) : g.rows, cols: axis === "c" ? keep(g.cols) : g.cols })); }
    function showDetail(axis, show, all) {
      const sh = cs(), g = grp(sh), arr = axis === "r" ? g.rows : g.cols, a = axis === "r" ? S.sel.r1 : S.sel.c1, b = axis === "r" ? S.sel.r2 : S.sel.c2, key = axis === "r" ? "hiddenRows" : "hiddenCols";
      const hit = arr.filter((o) => all || (o.a <= b + 1 && o.b >= a - 1)); if (!hit.length) { if (!all) say("Click inside or next to a grouped " + (axis === "r" ? "row" : "column") + " block first."); return; }
      const hid = Object.assign({}, sh[key]); hit.forEach((o) => { for (let i = o.a; i <= o.b; i++) { if (show) delete hid[i]; else hid[i] = 1; } });
      S.tx(() => { S.setMeta(sh, key, hid); setGrp(sh, { rows: axis === "r" ? g.rows.map((o) => (hit.includes(o) ? Object.assign({}, o, { c: !show }) : o)) : g.rows, cols: axis === "c" ? g.cols.map((o) => (hit.includes(o) ? Object.assign({}, o, { c: !show }) : o)) : g.cols }); });
    }
    function subtotalForm() {
      const sh = cs(); let g = S.whole || (S.sel.r1 === S.sel.r2 && S.sel.c1 === S.sel.c2) ? S.region(S.cur.r, S.cur.c) : S.sel; if (g.r2 - g.r1 < 2) { say("Select your data (with its heading row) first."); return; }
      const heads = []; for (let c = g.c1; c <= g.c2; c++) heads.push([c, String(wb.text(sh, g.r1, c).text || "Column " + C.nCol(c))]);
      const numeric = heads.filter(([c]) => { let n = 0, t = 0; for (let r = g.r1 + 1; r <= Math.min(g.r2, g.r1 + 40); r++) { const v = wb.value(sh, r, c); if (v != null && v !== "") { t++; if (typeof v === "number") n++; } } return t && n / t > 0.6; });
      form(an(), "Subtotals", [{ k: "at", label: "At each change in", type: "select", opts: heads.map(([c, t]) => [c, t]), value: heads[0][0] }, { k: "fn", label: "Use function", type: "select", opts: [["9", "Sum"], ["2", "Count"], ["1", "Average"], ["4", "Max"], ["5", "Min"]], value: "9" }].concat(numeric.map(([c, t], i) => ({ k: "c" + c, label: i ? " " : "Add subtotal to", type: "check", value: i < 3, ph: t })), [{ k: "grand", label: "Also", type: "check", value: true, ph: "Add a grand total at the bottom" }]), "Add subtotals", (v) => {
        const keyC = +v.at, fnN = +v.fn, cols = numeric.map(([c]) => c).filter((c) => v["c" + c]); if (!cols.length) { say("Tick at least one column to add a subtotal to."); return; }
        const groups = []; let start = g.r1 + 1; const kt = (r) => String(wb.text(sh, r, keyC).text); const seen = new Set();
        for (let r = g.r1 + 1; r <= g.r2 + 1; r++) { if (r > g.r2 || kt(r) !== kt(start)) { const k = kt(start); if (seen.has(k)) { say("The same value appears in separate places in that column. Sort the data by it first (Data ▸ Sort A→Z), then add subtotals."); return; } seen.add(k); groups.push({ a: start, b: r - 1, label: k }); start = r; } }
        const fnName = { 9: "Total", 2: "Count", 1: "Average", 4: "Max", 5: "Min" }[fnN];
        S.tx(() => {
          S.structOp(() => { for (let i = groups.length - 1; i >= 0; i--) S.insertCore("r", groups[i].b + 1, 1); });
          groups.forEach((gr, k) => { const row = gr.b + 1 + k, a = gr.a + k, b = gr.b + k; S.putCell(sh, row, keyC, { v: (gr.label || "(blank)") + " " + fnName, s: wb.styleId({ b: 1 }) }); cols.forEach((c) => { const proto = sh.get(gr.b + k, c); S.putCell(sh, row, c, { f: "=SUBTOTAL(" + fnN + "," + C.addr(a, c) + ":" + C.addr(b, c) + ")", s: wb.styleId(Object.assign({}, proto && proto.s ? wb.style(proto.s) : {}, { b: 1 })) }); }); gr.fa = a; gr.fb = b; });
          if (v.grand) { const last = g.r2 + groups.length, row = last + 1; S.putCell(sh, row, keyC, { v: "Grand " + fnName.toLowerCase(), s: wb.styleId({ b: 1 }) }); cols.forEach((c) => S.putCell(sh, row, c, { f: "=SUBTOTAL(" + fnN + "," + C.addr(g.r1 + 1, c) + ":" + C.addr(last, c) + ")", s: wb.styleId({ b: 1, bd: { t: ["thin", "#000000"] } }) })); }
          const gg = grp(sh); setGrp(sh, { rows: gg.rows.concat(groups.map((x) => ({ a: x.fa, b: x.fb, c: false }))), cols: gg.cols });
        }, "subtotals"); S.bump(); S.render(); say("Subtotals added. Use the Hide detail button to show only the totals.", true);
      });
    }
    function removeSubtotals() {
      const sh = cs(); const g = S.whole || (S.sel.r1 === S.sel.r2 && S.sel.c1 === S.sel.c2) ? S.region(S.cur.r, S.cur.c) : S.sel; const rows = [];
      for (let r = g.r2; r >= g.r1; r--) { let st = false; for (let c = g.c1; c <= g.c2; c++) { const x = sh.get(r, c); if (x && x.f && /^=SUBTOTAL\(/i.test(x.f)) st = true; } if (st) rows.push(r); }
      if (!rows.length) { say("There are no subtotal rows here."); return; }
      S.tx(() => { S.structOp(() => rows.forEach((r) => S.insertCore("r", r, -1))); setGrp(sh, { rows: [], cols: grp(sh).cols }); }, "remove subtotals"); S.bump(); S.render(); say("Subtotals removed.");
    }

    /* ========== Formula auditing ========== */
    let trace = null;
    function precOf(sh, r, c) { const cell = sh.get(r, c); if (!cell || !cell.f) return []; if (!cell.ast) { try { cell.ast = C.parse(cell.f.slice(1), r, sh.name); } catch (e) { return []; } } const out = []; C.precedents(cell.ast, sh, wb, (ps, r1, c1, r2, c2) => out.push({ sh: ps, r1, c1, r2, c2 })); return out; }
    function depsOf(sh, r, c) { const out = []; wb.sheets.forEach((s2) => s2.m.forEach((cell, k) => { if (!cell.f) return; const [rr, cc] = C.unkey(k); precOf(s2, rr, cc).forEach((p) => { if (p.sh === sh && r >= p.r1 && r <= p.r2 && c >= p.c1 && c <= p.c2) out.push({ sh: s2, r1: rr, c1: cc, r2: rr, c2: cc }); }); })); return out; }
    function traceBy(mode) {
      const sh = cs(), r = S.cur.r, c = S.cur.c; const list = mode === "prec" ? precOf(sh, r, c) : depsOf(sh, r, c);
      if (!list.length) { say(mode === "prec" ? "This cell has no formula, or its formula does not refer to other cells." : "No other cell uses this cell."); return; }
      trace = { sh, r, c, mode, list }; const other = list.filter((x) => x.sh !== sh).length; S.drawOverlay(); if (other) say(other + " of the linked cells are on other sheets (not drawn).");
    }
    X_.overlayExtra = (sh, rectOf) => {
      let h = "";
      if (hl && hl.sh === sh) { const vw = S.sgv.clientWidth, vh = S.sgv.clientHeight; let n = 0; hl.cells.forEach(([r, c]) => { if (n > 1500) return; const q = rectOf(r, c, r, c); if (q.x + q.w < 0 || q.y + q.h < 0 || q.x > vw || q.y > vh) return; n++; h += `<div style="position:absolute;left:${q.x}px;top:${q.y}px;width:${q.w}px;height:${q.h}px;background:rgba(250,204,21,.38);border:1px solid #ca8a04;box-sizing:border-box"></div>`; }); }
      if (trace && trace.sh === sh) {
        const me = rectOf(trace.r, trace.c, trace.r, trace.c); const mx = me.x + me.w / 2, my = me.y + me.h / 2; let svg = "";
        trace.list.filter((x) => x.sh === sh).forEach((p) => { const q = rectOf(p.r1, p.c1, p.r2, p.c2); const qx = q.x + q.w / 2, qy = q.y + q.h / 2, col = trace.mode === "prec" ? "#2563eb" : "#dc2626"; const from = trace.mode === "prec" ? [qx, qy] : [mx, my], to = trace.mode === "prec" ? [mx, my] : [qx, qy]; const ang = Math.atan2(to[1] - from[1], to[0] - from[0]), ax = to[0] - 4 * Math.cos(ang), ay = to[1] - 4 * Math.sin(ang);
          svg += `<rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" fill="none" stroke="${col}" stroke-width="1.4" stroke-dasharray="4 3"/><circle cx="${from[0]}" cy="${from[1]}" r="3" fill="${col}"/><line x1="${from[0]}" y1="${from[1]}" x2="${ax}" y2="${ay}" stroke="${col}" stroke-width="1.5"/><polygon points="${to[0]},${to[1]} ${to[0] - 9 * Math.cos(ang - 0.4)},${to[1] - 9 * Math.sin(ang - 0.4)} ${to[0] - 9 * Math.cos(ang + 0.4)},${to[1] - 9 * Math.sin(ang + 0.4)}" fill="${col}"/>`; });
        h += `<svg style="position:absolute;left:0;top:0;width:4000px;height:3000px;overflow:visible;pointer-events:none" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
      }
      return h;
    };
    const clearTrace = () => { if (trace || hl) { trace = null; hl = null; S.drawOverlay(); } };

    /* ========== Go To Special ========== */
    let hl = null;
    X_.goSpecial = (kind) => {
      const sh = cs(), cells = []; const [ur, uc] = sh.dims(); const g = S.sel.r1 === S.sel.r2 && S.sel.c1 === S.sel.c2 ? { r1: 1, c1: 1, r2: ur, c2: uc } : S.sel;
      const dvAt = X_.dvAt, cfAny = sh.cf.length;
      const hit = (r, c, x) => { const v = wb.value(sh, r, c); switch (kind) { case "formulas": return !!(x && x.f); case "constants": return !!(x && !x.f && x.v != null && x.v !== ""); case "numbers": return !!(x && !x.f && typeof x.v === "number"); case "text": return !!(x && !x.f && typeof x.v === "string" && x.v !== ""); case "errors": return C.isE(v); case "blanks": return !x || (x.v == null && !x.f); case "notes": return !!(x && x.n); case "validation": return !!(dvAt && dvAt(sh, r, c)); case "cf": return !!(cfAny && X_.cfEval && X_.cfEval(sh, r, c, v)); case "links": return !!(x && x.l); } return false; };
      if (kind === "blanks") { for (let r = g.r1; r <= Math.min(g.r2, g.r1 + 5000); r++) for (let c = g.c1; c <= Math.min(g.c2, g.c1 + 200); c++) if (hit(r, c, sh.get(r, c))) cells.push([r, c]); }
      else { const lim = (g.r2 - g.r1 + 1) * (g.c2 - g.c1 + 1) > sh.m.size * 2 ? "map" : "scan"; if (lim === "map") sh.m.forEach((x, k) => { const [r, c] = C.unkey(k); if (r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2 && hit(r, c, x)) cells.push([r, c]); }); else for (let r = g.r1; r <= g.r2; r++) for (let c = g.c1; c <= g.c2; c++) { const x = sh.get(r, c); if ((x || kind === "validation" || kind === "cf" || kind === "errors") && hit(r, c, x)) cells.push([r, c]); } }
      if (!cells.length) { hl = null; S.drawOverlay(); say("No matching cells found."); return; }
      cells.sort((a, b) => a[0] - b[0] || a[1] - b[1]); hl = { sh, cells }; S.setSel(cells[0][0], cells[0][1]); S.drawOverlay(); say(cells.length + " cell" + (cells.length > 1 ? "s" : "") + " highlighted in yellow (press Esc to clear).", true);
    };
    S.sgv.addEventListener("keydown", (e) => { if (e.key === "Escape" && (hl || trace) && !S.edit) clearTrace(); if ((e.ctrlKey || e.metaKey) && (e.key === "e" || e.key === "E") && !S.edit && !S.ro) { e.preventDefault(); e.stopPropagation(); X_.flashFill(); } }, true);
    const origSel = X_.onSelect; X_.onSelect = () => { if (origSel) origSel(); };
    function gotoSpecialForm() { form(an(), "Select special cells", [{ k: "k", label: "Find all cells that are…", type: "select", opts: [["formulas", "Formulas"], ["constants", "Typed values (not formulas)"], ["numbers", "Numbers you typed"], ["text", "Text you typed"], ["errors", "Showing an error"], ["blanks", "Blank"], ["notes", "Cells with a note"], ["validation", "With data validation"], ["cf", "With conditional formatting showing"], ["links", "Links"]], value: "formulas" }], "Highlight", (v) => X_.goSpecial(v.k)); }

    /* ========== print options ========== */
    const pr = () => S.print;
    const setPr = (o) => { Object.assign(S.print, o); S.api.changed(); S.refreshRibbon(); };
    const pg = tabs.find((t) => t.id === "layout");
    if (pg) {
      pg.groups.push({ label: "Print setup", items: [
        { k: "menu", i: "margins", label: "Margins", items: () => [["Normal (10 mm)", 10], ["Narrow (5 mm)", 5], ["Wide (20 mm)", 20]].map((a) => ({ label: a[0], on: (pr().margin || 10) === a[1], run: () => setPr({ margin: a[1] }) })) },
        { k: "menu", i: "size", label: "Scale", items: () => [["Fit to page width", 0], ["50%", 50], ["75%", 75], ["90%", 90], ["100%", 100], ["125%", 125]].map((a) => ({ label: a[0], on: (a[1] === 0 ? pr().fit && !pr().scale : pr().scale === a[1]), run: () => (a[1] === 0 ? setPr({ fit: true, scale: 0 }) : setPr({ fit: false, scale: a[1] })) })) },
        { k: "menu", i: "print", label: "Print area", items: () => [{ label: "Set print area to the selected cells", run: () => setPr({ area: U.rstr(S.sel) + "@" + cs().name }) }, { label: "Clear print area", run: () => setPr({ area: null }) }] },
        { k: "menu", i: "alignT", label: "Repeat rows", t: "Rows repeated at the top of every printed page", items: () => [0, 1, 2, 3, 4].map((n) => ({ label: n ? "First " + n + " row" + (n > 1 ? "s" : "") : "None", on: (pr().title || 0) === n, run: () => setPr({ title: n }) })) },
        { k: "menu", i: "rowAdd", label: "Breaks", items: () => [{ label: "Page break above the selected row", run: () => { const sh = cs(), b = (sh.ext.breaks || []).filter((x) => x !== S.sel.r1).concat([S.sel.r1]); S.tx(() => setExt(sh, "breaks", b.sort((x, y) => x - y))); say("A page break will print above row " + S.sel.r1 + "."); } }, { label: "Remove all page breaks", run: () => S.tx(() => setExt(cs(), "breaks", [])) }] },
        { i: "alignC", label: "Centre on page", on: () => setPr({ center: !pr().center }), act: () => !!pr().center },
        { i: "comment", label: "Footnote", t: "A line of text printed under the sheet", on: () => form(an(), "Text printed under the sheet", [{ k: "t", label: "Footnote", value: pr().note || "" }], "Save", (v) => setPr({ note: v.t })) }] });
    }
    const fml = tabs.find((t) => t.id === "formulas");
    if (fml) {
      fml.groups = fml.groups.filter((g) => g.label !== "Auditing");
      fml.groups.push({ label: "Formula auditing", items: [{ i: "link", label: "Trace precedents", t: "Show which cells this formula uses", on: () => traceBy("prec") }, { i: "link", label: "Trace dependents", t: "Show which cells use this cell", on: () => traceBy("dep") }, { i: "clear", label: "Remove arrows", on: clearTrace }, { i: "eye", label: "Show formulas", t: "Show formulas instead of results", on: () => { S.x.toggleShowFormulas ? S.x.toggleShowFormulas() : 0; } }, { i: "find", label: "Find errors", on: () => X_.goSpecial("errors") }] });
    }
    const dt = tabs.find((t) => t.id === "data");
    if (dt) {
      dt.groups.push({ label: "Forecast", items: [{ k: "menu", i: "param", label: "What-if", big: true, t: "Try different numbers", items: () => [{ label: "Goal Seek…  (find the input that gives a result)", run: goalSeek }, { label: "Scenarios…  (save and compare sets of inputs)", run: scenarios }, { label: "Data table…  (many results at once)", run: dataTable }] }] });
      dt.groups.push({ label: "Outline", items: [{ k: "menu", i: "group", label: "Group", items: () => [{ label: "Group the selected rows", run: () => groupSel("r") }, { label: "Group the selected columns", run: () => groupSel("c") }] }, { k: "menu", i: "group", label: "Ungroup", items: () => [{ label: "Ungroup rows", run: () => ungroupSel("r") }, { label: "Ungroup columns", run: () => ungroupSel("c") }] }, { i: "eye", label: "Hide detail", on: () => { showDetail("r", false); showDetail("c", false); } }, { i: "eye", label: "Show detail", on: () => { showDetail("r", true); showDetail("c", true); } }, { i: "sum", label: "Subtotal", t: "Insert subtotal rows under each group", on: subtotalForm }, { i: "trash", label: "Remove subtotals", on: removeSubtotals }, { k: "menu", i: "layout", label: "Levels", items: () => [{ label: "Collapse all groups", run: () => { showDetail("r", false, true); showDetail("c", false, true); } }, { label: "Expand all groups", run: () => { showDetail("r", true, true); showDetail("c", true, true); } }] }] });
      dt.groups.push({ label: "Tools", items: [{ i: "find", label: "Flash fill", t: "Type an example next to your data, then fill the rest the same way (Ctrl+E)", on: () => X_.flashFill() }, { i: "find", label: "Go to special", t: "Highlight all formulas, blanks, errors, notes…", on: gotoSpecialForm }] });
    }
    X_.goalSeek = goalSeek; X_.scenarios = scenarios; X_.dataTable = dataTable; X_.subtotal = subtotalForm;
  });
})();
