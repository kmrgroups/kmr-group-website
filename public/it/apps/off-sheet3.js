/* KMR Office Suite - Spreadsheets, part 3: tables (with structured references), icon sets, sparklines, sheet protection, Review tab,
   the full chart toolbar, function library menus. Loaded after off-sheet.js; hooks in through window.OffSheetP. */
(function () {
  "use strict";
  const { form, menu, esc } = OffUI, C = window.Calc, Z = window.OffZip;
  const parseR = (t) => { const m = /^\$?([A-Za-z]{1,3})\$?(\d+)(?::\$?([A-Za-z]{1,3})\$?(\d+))?$/.exec(String(t).trim()); if (!m) return null; const a = C.parseAddr(m[1] + m[2]), b = m[3] ? C.parseAddr(m[3] + m[4]) : a; return { r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) }; };
  const rstr = (g) => C.addr(g.r1, g.c1) + ":" + C.addr(g.r2, g.c2);
  const abs = (r, c) => "$" + C.nCol(c) + "$" + r;
  const sq = (n) => (/[^A-Za-z0-9_]/.test(n) ? "'" + n.replace(/'/g, "''") + "'" : n);
  const hash = (s) => { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); };
  const merge = (a, b) => { const o = Object.assign({}, a); if (b) Object.keys(b).forEach((k) => { if (b[k] !== undefined) o[k] = b[k]; }); return o; };
  window.OffSheetUtil = { parseR, rstr, abs, sq, hash, merge };

  const STY = {
    blue: { h: "#4472c4", hf: "#ffffff", b1: "#d9e1f2", nm: "Blue" }, orange: { h: "#ed7d31", hf: "#ffffff", b1: "#fce4d6", nm: "Orange" }, green: { h: "#70ad47", hf: "#ffffff", b1: "#e2efda", nm: "Green" },
    gray: { h: "#7f7f7f", hf: "#ffffff", b1: "#ededed", nm: "Grey" }, gold: { h: "#ffc000", hf: "#000000", b1: "#fff2cc", nm: "Gold" }, red: { h: "#c0504d", hf: "#ffffff", b1: "#f2dcdb", nm: "Red" },
    purple: { h: "#7030a0", hf: "#ffffff", b1: "#e4d5f0", nm: "Purple" }, dark: { h: "#262626", hf: "#ffffff", b1: "#d9d9d9", nm: "Dark" }, light: { h: "#ffffff", hf: "#000000", b1: "#f2f2f2", nm: "Light (no header fill)" }
  };
  const ISETS = { "3 arrows": { n: 3, k: "arrow" }, "4 arrows": { n: 4, k: "arrow" }, "5 arrows": { n: 5, k: "arrow" }, "3 traffic lights": { n: 3, k: "light" }, "3 signs": { n: 3, k: "sign" }, "3 symbols": { n: 3, k: "sym" }, "3 flags": { n: 3, k: "flag" }, "3 stars": { n: 3, k: "star" }, "4 ratings": { n: 4, k: "bars" }, "5 ratings": { n: 5, k: "bars" }, "5 quarters": { n: 5, k: "quarter" } };
  const LCOL = { 3: ["#e15759", "#f0b323", "#2fa04b"], 4: ["#e15759", "#f28e2b", "#e5c317", "#2fa04b"], 5: ["#e15759", "#f28e2b", "#e5c317", "#8cc63f", "#2fa04b"] };
  function iconSvg(kind, level, n) {
    const col = LCOL[n][level], wrap = (inner) => `<svg class="ico" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" style="position:absolute;left:3px;top:50%;transform:translateY(-50%);pointer-events:none">${inner}</svg>`;
    if (kind === "arrow") { const ang = { 3: [180, 90, 0], 4: [180, 135, 45, 0], 5: [180, 135, 90, 45, 0] }[n][level]; return wrap(`<polygon points="6,1 11,10 1,10" fill="${col}" transform="rotate(${ang} 6 6)"/>`); }
    if (kind === "light") return wrap(`<circle cx="6" cy="6" r="5" fill="${col}"/>`);
    if (kind === "sign") return wrap(level === 0 ? `<polygon points="6,1 11,6 6,11 1,6" fill="${col}"/>` : level === 1 ? `<polygon points="6,1 11,11 1,11" fill="${col}"/>` : `<circle cx="6" cy="6" r="5" fill="${col}"/>`);
    if (kind === "sym") return wrap(`<circle cx="6" cy="6" r="5.5" fill="${col}"/>` + (level === 0 ? '<path d="M4 4l4 4M8 4l-4 4" stroke="#fff" stroke-width="1.6"/>' : level === 1 ? '<rect x="5.2" y="2.5" width="1.6" height="4.2" fill="#fff"/><rect x="5.2" y="8" width="1.6" height="1.6" fill="#fff"/>' : '<path d="M3.2 6.2l2 2 3.6-4" fill="none" stroke="#fff" stroke-width="1.6"/>'));
    if (kind === "flag") return wrap(`<path d="M2.5 1v10" stroke="#555" stroke-width="1"/><path d="M3 1.5h7l-2 2.5 2 2.5H3z" fill="${col}"/>`);
    if (kind === "star") return wrap(`<polygon points="6,0.8 7.5,4.3 11.2,4.6 8.4,7 9.3,10.7 6,8.7 2.7,10.7 3.6,7 0.8,4.6 4.5,4.3" fill="${level === 0 ? "none" : col}" stroke="${col}" stroke-width="0.8"/>${level === 1 ? '<polygon points="6,0.8 6,8.7 2.7,10.7 3.6,7 0.8,4.6 4.5,4.3" fill="' + col + '"/>' : ""}`);
    if (kind === "bars") { let b = ""; for (let i = 0; i < n; i++) { const w = 12 / n - 1, hh = 3 + (i * 9) / (n - 1 || 1); b += `<rect x="${(i * 12) / n}" y="${12 - hh}" width="${w}" height="${hh}" fill="${i <= level ? "#3b6fb6" : "#c9ced6"}"/>`; } return wrap(b); }
    if (kind === "quarter") { const f = level / (n - 1); const a = f * Math.PI * 2, x = 6 + 5 * Math.sin(a), y = 6 - 5 * Math.cos(a); return wrap(`<circle cx="6" cy="6" r="5" fill="#fff" stroke="#555" stroke-width="1"/>` + (f >= 0.999 ? '<circle cx="6" cy="6" r="5" fill="#555"/>' : f > 0 ? `<path d="M6 6V1A5 5 0 ${f > 0.5 ? 1 : 0} 1 ${x} ${y}Z" fill="#555"/>` : "")); }
    return "";
  }

  (window.OffSheetP = window.OffSheetP || []).push(function (S, tabs, B) {
    const X_ = S.x, wb = S.wb, cs = S.cs, say = S.say, jc = S.jc;
    const an = () => S.W.querySelector(".sfx");
    const setExt = (sh, k, v) => S.setMeta(sh, "ext", Object.assign({}, sh.ext, { [k]: v }));
    const tablesOf = (sh) => sh.ext.tables || [];
    const tg = (t) => parseR(t.range);
    const tblAt = (sh, r, c) => { for (const t of tablesOf(sh)) { const g = tg(t); if (g && r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2) return t; } return null; };
    const clearAst = () => { wb.sheets.forEach((s) => s.m.forEach((cell) => { if (cell.f && cell.f.indexOf("[") >= 0) delete cell.ast; })); };
    X_.tables = { at: tblAt, list: tablesOf, STY };

    /* ============ structured references: Table1[Column], Table1[[#This Row],[Column]], [@Column] ============ */
    const findTbl = (name) => { const l = String(name).toLowerCase(); for (const sh of wb.sheets) for (const t of tablesOf(sh)) if (t.name.toLowerCase() === l) return { t, sh }; return null; };
    const headerText = (sh, t, c, g) => (t.hdr === false ? "Column" + (c - g.c1 + 1) : String(wb.text(sh, g.r1, c).text || "Column" + (c - g.c1 + 1)));
    function resolveRef(name, inner, row, shn) {
      let T;
      if (name) T = findTbl(name); else { const sh0 = wb.sheet(shn); if (!sh0) return null; const t0 = tablesOf(sh0).find((t) => { const g = tg(t); return g && row >= g.r1 && row <= g.r2; }); T = t0 ? { t: t0, sh: sh0 } : null; }
      if (!T) return null; const { t, sh } = T, g = tg(t); if (!g) return null;
      const parts = []; { let d = 0, cur = ""; for (const ch of inner) { if (ch === "[") d++; if (ch === "]") d--; if (ch === "," && d === 0) { parts.push(cur); cur = ""; } else cur += ch; } parts.push(cur); }
      const items = [], cols = []; let span = null;
      for (let p of parts) {
        p = p.trim(); if (!p) continue;
        if (p[0] === "@") { items.push("#this row"); const rest = p.slice(1).replace(/^\[|\]$/g, "").trim(); if (rest) cols.push(rest); continue; }
        let m = /^\[(.+?)\]:\[(.+?)\]$/.exec(p); if (m) { span = [m[1], m[2]]; continue; }
        const q = p.replace(/^\[|\]$/g, "").trim(); if (q[0] === "#") items.push(q.toLowerCase()); else cols.push(q);
      }
      const hasHdr = t.hdr !== false, hdrRow = hasHdr ? g.r1 : null, totRow = t.total ? g.r2 : null, d1 = hasHdr ? g.r1 + 1 : g.r1, d2 = t.total ? g.r2 - 1 : g.r2;
      let r1 = d1, r2 = d2;
      if (items.length) { const rs = []; items.forEach((it) => { if (it === "#all") rs.push(g.r1, g.r2); else if (it === "#headers") { if (hdrRow) rs.push(hdrRow, hdrRow); } else if (it === "#totals") { if (totRow) rs.push(totRow, totRow); } else if (it === "#data") rs.push(d1, d2); else if (it === "#this row") rs.push(row, row); }); if (rs.length) { r1 = Math.min(...rs); r2 = Math.max(...rs); } }
      const idxOf = (nm) => { const l = nm.toLowerCase(); for (let c = g.c1; c <= g.c2; c++) if (headerText(sh, t, c, g).toLowerCase() === l) return c; return -1; };
      let c1 = g.c1, c2 = g.c2;
      if (span) { const a = idxOf(span[0]), b = idxOf(span[1]); if (a < 0 || b < 0) return null; c1 = Math.min(a, b); c2 = Math.max(a, b); }
      else if (cols.length) { const ix = cols.map(idxOf); if (ix.some((x) => x < 0)) return null; c1 = Math.min(...ix); c2 = Math.max(...ix); }
      return sq(sh.name) + "!" + abs(r1, c1) + (r1 === r2 && c1 === c2 ? "" : ":" + abs(r2, c2));
    }
    C.structRef = function (src, row, shn) {
      let out = "", i = 0; const n = src.length, isId = (ch) => !!ch && /[A-Za-z0-9_.]/.test(ch);
      while (i < n) {
        const ch = src[i];
        if (ch === '"' || ch === "'") { let j = i + 1; while (j < n) { if (src[j] === ch) { if (src[j + 1] === ch) { j += 2; continue; } break; } j++; } out += src.slice(i, j + 1); i = j + 1; continue; }
        let name = "";
        if (/[A-Za-z_]/.test(ch) && !isId(src[i - 1]) && src[i - 1] !== "!" && src[i - 1] !== "$") { let j = i; while (j < n && isId(src[j])) j++; name = src.slice(i, j); if (src[j] !== "[") { out += name; i = j; continue; } i = j; }
        else if (ch === "[" && !isId(src[i - 1])) { /* bare reference */ }
        else { out += ch; i++; continue; }
        let d = 0, j = i; for (; j < n; j++) { if (src[j] === "[") d++; else if (src[j] === "]") { d--; if (!d) break; } }
        if (d !== 0) { out += name + src.slice(i); break; }
        const r = resolveRef(name, src.slice(i + 1, j), row, shn); out += r == null ? name + src.slice(i, j + 1) : r; i = j + 1;
      }
      return out;
    };

    /* ============ tables ============ */
    const uniqueName = () => { let n = 1; while (findTbl("Table" + n) || wb.names["table" + n]) n++; return "Table" + n; };
    function dedupeHeaders(sh, g, hdr) {
      if (!hdr) return; const seen = new Set();
      for (let c = g.c1; c <= g.c2; c++) {
        let t = String(wb.text(sh, g.r1, c).text || "").trim(); const cell = sh.get(g.r1, c); if (!t) t = "Column" + (c - g.c1 + 1); let u = t, k = 2; while (seen.has(u.toLowerCase())) u = t + k++; seen.add(u.toLowerCase());
        if (!cell || cell.f || cell.v !== u) S.putCell(sh, g.r1, c, Object.assign({}, cell ? S.clone(cell) : {}, { v: u, f: undefined, ast: undefined }));
      }
    }
    X_.createTable = (style, hdrOpt) => {
      const sh = cs(); let g = S.sel; if (S.whole || (g.r1 === g.r2 && g.c1 === g.c2)) g = S.region(S.cur.r, S.cur.c); g = { r1: g.r1, c1: g.c1, r2: g.r2, c2: g.c2 };
      if (g.r1 === g.r2 && g.c1 === g.c2 && !(sh.get(g.r1, g.c1) && (sh.get(g.r1, g.c1).v != null || sh.get(g.r1, g.c1).f))) { say("Select the cells with your data first, then choose Format as Table."); return; }
      if (g.r2 - g.r1 < 1 && hdrOpt !== false) { say("A table needs a heading row and at least one row of data."); return; }
      if (tblAt(sh, g.r1, g.c1) || tblAt(sh, g.r2, g.c2)) { say("These cells are already in a table."); return; }
      const hdr = hdrOpt !== false; let t = null;
      S.tx(() => { dedupeHeaders(sh, g, hdr); t = { id: "t" + Math.random().toString(36).slice(2, 7), name: uniqueName(), range: rstr(g), style: style || "blue", hdr, total: false, band: true, filt: true }; setExt(sh, "tables", tablesOf(sh).concat([t])); if (!sh.filter) S.setMeta(sh, "filter", { range: rstr(g), cols: {}, hidden: [] }); }, "table");
      if (t) { clearAst(); S.bump(); S.render(); S.redrawRibbon(); say("Table " + t.name + " created. In formulas you can use its column names, for example =SUM(" + t.name + "[" + String(wb.text(sh, g.r1, g.c1).text) + "]).", true); }
    };
    const patchTbl = (t, patch) => { const sh = cs(); S.tx(() => setExt(sh, "tables", tablesOf(sh).map((x) => (x.id === t.id ? Object.assign({}, x, patch) : x)))); S.render(); S.redrawRibbon(); };
    const curTbl = () => tblAt(cs(), S.cur.r, S.cur.c);
    function toggleTotal(t) {
      const sh = cs(), g = tg(t);
      if (t.total) { S.tx(() => { for (let c = g.c1; c <= g.c2; c++) S.putCell(sh, g.r2, c, null); setExt(sh, "tables", tablesOf(sh).map((x) => (x.id === t.id ? Object.assign({}, x, { total: false, range: rstr({ r1: g.r1, c1: g.c1, r2: g.r2 - 1, c2: g.c2 }) }) : x))); }); clearAst(); S.bump(); S.render(); S.redrawRibbon(); return; }
      let busy = false; for (let c = g.c1; c <= g.c2; c++) { const x = sh.get(g.r2 + 1, c); if (x && (x.v != null || x.f)) busy = true; }
      if (busy) S.insertRC("r", g.r2 + 1, 1);
      const g2 = tg(tablesOf(cs()).find((x) => x.id === t.id) || t), nr = g2.r2 + 1;
      S.tx(() => {
        for (let c = g2.c1; c <= g2.c2; c++) {
          let numeric = 0, tot = 0; for (let r = g2.r1 + (t.hdr === false ? 0 : 1); r <= g2.r2; r++) { const v = wb.value(sh, r, c); if (v != null && v !== "") { tot++; if (typeof v === "number") numeric++; } }
          if (c === g2.c1) S.putCell(sh, nr, c, { v: "Total" }); else if (tot && numeric / tot > 0.6) S.putCell(sh, nr, c, { f: "=SUBTOTAL(109," + t.name + "[" + headerText(sh, t, c, g2) + "])", s: (sh.get(g2.r2, c) || {}).s });
        }
        setExt(sh, "tables", tablesOf(sh).map((x) => (x.id === t.id ? Object.assign({}, x, { total: true, range: rstr({ r1: g2.r1, c1: g2.c1, r2: nr, c2: g2.c2 }) }) : x)));
      }); clearAst(); S.bump(); S.render(); S.redrawRibbon();
    }
    function resizeForm(t) { form(an(), "Resize table " + t.name, [{ k: "r", label: "New range (must keep the heading row)", value: t.range }], "Resize", (v) => { const g = parseR(v.r); const old = tg(t); if (!g || g.r1 !== old.r1) { say("Keep the same first row, for example " + t.range + "."); return; } patchTbl(t, { range: rstr(g) }); clearAst(); S.bump(); S.render(); }); }
    function renameForm(t) { form(an(), "Table name", [{ k: "n", label: "Name (letters, numbers, underscore)", value: t.name }], "Rename", (v) => { const n = String(v.n).trim(); if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(n)) { say("Use letters, numbers and underscores, starting with a letter."); return; } const o = findTbl(n); if (o && o.t.id !== t.id) { say("Another table already has that name."); return; } const sh = cs(); S.tx(() => { const re = new RegExp("(^|[^A-Za-z0-9_.])" + t.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=\\[)", "gi"); wb.sheets.forEach((s2) => s2.m.forEach((cell, k) => { if (cell.f && re.test(cell.f)) { re.lastIndex = 0; const [r, c] = C.unkey(k); S.putCell(s2, r, c, Object.assign({}, S.clone(cell), { f: cell.f.replace(re, "$1" + n) })); } re.lastIndex = 0; })); setExt(sh, "tables", tablesOf(sh).map((x) => (x.id === t.id ? Object.assign({}, x, { name: n }) : x))); }); clearAst(); S.bump(); S.render(); S.redrawRibbon(); }); }
    function toRange(t) { const sh = cs(); S.tx(() => { setExt(sh, "tables", tablesOf(sh).filter((x) => x.id !== t.id)); }); clearAst(); S.bump(); S.render(); S.redrawRibbon(); say("The table is now an ordinary range. Formulas that used its column names keep working."); }
    X_.onEdit = (sh, r, c, text) => { // typing right below / beside a table grows it
      if (!text) return; for (const t of tablesOf(sh)) { const g = tg(t); if (!g) continue;
        if (!t.total && r === g.r2 + 1 && c >= g.c1 && c <= g.c2) { const ng = Object.assign({}, g, { r2: r }); for (let cc = g.c1; cc <= g.c2; cc++) { const above = sh.get(g.r2, cc), here = sh.get(r, cc); if (above && above.s && !(here && here.s)) S.putCell(sh, r, cc, Object.assign({}, here ? S.clone(here) : {}, { s: above.s })); } setExt(sh, "tables", tablesOf(sh).map((x) => (x.id === t.id ? Object.assign({}, x, { range: rstr(ng) }) : x))); if (sh.filter && sh.filter.range === t.range) S.setMeta(sh, "filter", Object.assign({}, sh.filter, { range: rstr(ng) })); break; }
        if (r === g.r1 && c === g.c2 + 1 && t.hdr !== false) { const ng = Object.assign({}, g, { c2: c }); setExt(sh, "tables", tablesOf(sh).map((x) => (x.id === t.id ? Object.assign({}, x, { range: rstr(ng) }) : x))); break; }
      }
    };
    X_.structExt = (sh, axis, at, n, adjStr) => {
      const e = sh.ext; const fixR = (arr, key) => (arr || []).map((o) => { const rg = adjStr(o[key]); return rg ? Object.assign({}, o, { [key]: rg }) : null; }).filter(Boolean);
      const ne = Object.assign({}, e);
      if (e.tables) { ne.tables = e.tables.map((t) => { let rg = adjStr(t.range); if (rg && n > 0 && axis === "r") { /* inserting inside keeps it */ } return rg ? Object.assign({}, t, { range: rg }) : null; }).filter(Boolean); }
      if (e.spark) { ne.spark = (e.spark || []).map((o) => { const a = adjStr(o.loc), b = adjStr(o.src); return a && b ? Object.assign({}, o, { loc: a, src: b }) : null; }).filter(Boolean); }
      if (e.pivots) ne.pivots = e.pivots.map((p) => Object.assign({}, p, { out: p.out && adjStr(p.out) || null })).filter((p) => p.out);
      if (e.grp) { const shiftIdx = (a, b) => { let x = a, y = b; if (n > 0) { if (a >= at) x += n; if (b >= at) y += n; } else { const d = -n; x = a >= at + d ? a - d : a >= at ? at : a; y = b >= at + d ? b - d : b >= at ? at - 1 : b; if (y < x) return null; } return [x, y]; }; ne.grp = { rows: axis === "r" ? (e.grp.rows || []).map((o) => { const s = shiftIdx(o.a, o.b); return s ? Object.assign({}, o, { a: s[0], b: s[1] }) : null; }).filter(Boolean) : e.grp.rows, cols: axis === "c" ? (e.grp.cols || []).map((o) => { const s = shiftIdx(o.a, o.b); return s ? Object.assign({}, o, { a: s[0], b: s[1] }) : null; }).filter(Boolean) : e.grp.cols }; }
      void fixR; sh.ext = ne; clearAst();
    };

    /* ============ cell styling hook: tables, icon sets, sparklines ============ */
    const cfEval0 = X_.cfEval, cfAny0 = X_.cfAny, cfMenu0 = X_.cfMenu;
    const iconStats = new Map();
    function iconStat(sh, rule, g) {
      const k = S.ver + "|" + sh.name + "|" + rule.range; let s = iconStats.get(k); if (s) return s; if (iconStats.size > 200) iconStats.clear(); let lo = Infinity, hi = -Infinity;
      for (let r = g.r1; r <= Math.min(g.r2, g.r1 + 20000); r++) for (let c = g.c1; c <= g.c2; c++) { if (!sh.get(r, c) && !sh.so.has(C.key(r, c))) continue; const v = wb.value(sh, r, c); if (typeof v === "number") { if (v < lo) lo = v; if (v > hi) hi = v; } }
      s = { lo, hi }; iconStats.set(k, s); return s;
    }
    const sparkData = (sh, o, r, c) => {
      const L = parseR(o.loc), Sg = parseR(o.src); if (!L || !Sg || r < L.r1 || r > L.r2 || c < L.c1 || c > L.c2) return null; const vals = [];
      const push = (rr, cc) => { const v = wb.value(sh, rr, cc); vals.push(typeof v === "number" ? v : null); };
      if (L.r1 === L.r2 && L.c1 === L.c2) { for (let rr = Sg.r1; rr <= Sg.r2; rr++) for (let cc = Sg.c1; cc <= Sg.c2; cc++) push(rr, cc); }
      else if (L.c1 === L.c2) { const rr = Sg.r1 + (r - L.r1); if (rr > Sg.r2) return null; for (let cc = Sg.c1; cc <= Sg.c2; cc++) push(rr, cc); }
      else { const cc = Sg.c1 + (c - L.c1); if (cc > Sg.c2) return null; for (let rr = Sg.r1; rr <= Sg.r2; rr++) push(rr, cc); }
      return vals;
    };
    function sparkSvg(o, vals, W, H) {
      const nums = vals.filter((v) => v != null); if (!nums.length) return ""; const n = vals.length, col = o.color || "#4472c4", neg = o.neg || "#e15759";
      let lo = Math.min(...nums), hi = Math.max(...nums); if (o.type === "col" || o.type === "wl") { lo = Math.min(lo, 0); hi = Math.max(hi, 0); } if (hi === lo) { hi = lo + 1; }
      const p = 3, w = W - 2 * p, h = H - 2 * p, y = (v) => p + h - ((v - lo) / (hi - lo)) * h, x = (i) => p + (n === 1 ? w / 2 : (w * i) / (n - 1)); let g = "";
      if (o.type === "col" || o.type === "wl") {
        const bw = w / n, z = y(0);
        vals.forEach((v, i) => { if (v == null) return; const wl = o.type === "wl"; const top = wl ? (v >= 0 ? p + h * 0.12 : z + 0.5) : Math.min(y(v), z), ht = wl ? h * 0.38 : Math.max(1, Math.abs(y(v) - z)); const hot = (o.high && v === hi) || (o.low && v === lo) ? "#d03030" : v < 0 ? neg : col; g += `<rect x="${p + bw * i + bw * 0.12}" y="${wl ? (v >= 0 ? p + h * 0.1 : p + h * 0.52) : top}" width="${bw * 0.76}" height="${ht}" fill="${hot}"/>`; });
        if (o.type === "col" && lo < 0) g += `<line x1="${p}" x2="${p + w}" y1="${z}" y2="${z}" stroke="#999" stroke-width="0.6"/>`;
      } else {
        const pts = []; vals.forEach((v, i) => { if (v != null) pts.push([x(i), y(v), i, v]); }); g += `<polyline fill="none" stroke="${col}" stroke-width="1.6" stroke-linejoin="round" points="${pts.map((q) => q[0] + "," + q[1]).join(" ")}"/>`;
        if (o.markers) pts.forEach((q) => (g += `<circle cx="${q[0]}" cy="${q[1]}" r="2" fill="${col}"/>`));
        pts.forEach((q) => { if (o.high && q[3] === hi) g += `<circle cx="${q[0]}" cy="${q[1]}" r="2.6" fill="#d03030"/>`; if (o.low && q[3] === lo) g += `<circle cx="${q[0]}" cy="${q[1]}" r="2.6" fill="#d03030"/>`; });
        if (o.last && pts.length) { const q = pts[pts.length - 1]; g += `<circle cx="${q[0]}" cy="${q[1]}" r="2.6" fill="#e5a000"/>`; }
      }
      return `<svg class="spk" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none">${g}</svg>`;
    }
    X_.cfAny = (sh) => cfAny0(sh) || (sh.ext.tables && sh.ext.tables.length > 0) || (sh.ext.spark && sh.ext.spark.length > 0);
    const rowsOf = (sh) => sh.ext.spark || [];
    X_.cfEval = (sh, r, c, v) => {
      let out = sh.cf.length ? cfEval0(sh, r, c, v) : null;
      const t = sh.ext.tables && sh.ext.tables.length ? tblAt(sh, r, c) : null;
      if (t) { const g = tg(t), s = STY[t.style] || STY.blue, cell = sh.get(r, c), st = wb.style(cell && cell.s), o = {}; const hdrRow = t.hdr !== false ? g.r1 : -1, totRow = t.total ? g.r2 : -1;
        if (r === hdrRow) { if (!st.bg) o.bg = s.h; if (!st.fc) o.fc = s.hf; o.b = 1; } else if (r === totRow) { if (!st.bg) o.bg = s.b1; o.b = 1; }
        else { const di = r - (hdrRow > 0 ? hdrRow + 1 : g.r1); if (t.band !== false && di % 2 === 0 && !st.bg) o.bg = s.b1; if ((t.firstCol && c === g.c1) || (t.lastCol && c === g.c2)) o.b = 1; }
        out = merge(o, out); }
      for (const rule of sh.cf) { if (rule.type !== "icons") continue; const g = parseR(rule.range); if (!g || r < g.r1 || r > g.r2 || c < g.c1 || c > g.c2 || typeof v !== "number") continue; const set = ISETS[rule.set] || ISETS["3 traffic lights"], st = iconStat(sh, rule, g); const pct = st.hi === st.lo ? 0.5 : (v - st.lo) / (st.hi - st.lo); let lvl;
        if (rule.thr && rule.thr.length === set.n - 1) { lvl = 0; rule.thr.forEach((x) => { if (v >= x) lvl++; }); } else lvl = Math.min(set.n - 1, Math.floor(pct * set.n + 1e-9));
        if (rule.rev) lvl = set.n - 1 - lvl; out = Object.assign(out || {}, { html: (out && out.html || "") + iconSvg(set.k, lvl, set.n) }); if (rule.only) out.fc = "transparent"; }
      const sp = rowsOf(sh); if (sp.length) for (const o of sp) { const L = parseR(o.loc); if (!L || r < L.r1 || r > L.r2 || c < L.c1 || c > L.c2) continue; const vals = sparkData(sh, o, r, c); if (!vals) continue; const W = sh.cols[c] || OffXlsx.DEFCOL, H = sh.rows[r] || OffXlsx.DEFROW; out = Object.assign(out || {}, { html: (out && out.html || "") + sparkSvg(o, vals, W, H) }); }
      return out;
    };
    const addIcon = (set, extra) => { const sh = cs(); S.tx(() => S.setMeta(sh, "cf", sh.cf.concat([Object.assign({ range: rstr(S.whole ? S.region(S.cur.r, S.cur.c) : S.sel), type: "icons", set }, extra || {})]))); };
    X_.cfMenu = () => { const items = cfMenu0 ? cfMenu0() : []; const i = items.findIndex((x) => x && x.label && /^Clear rules from/.test(x.label)); const add = [{ hd: "Icon sets" }].concat(Object.keys(ISETS).map((k) => ({ label: k, run: () => addIcon(k) })), [{ label: "Icon set, reversed order…", run: () => form(an(), "Icon set options", [{ k: "s", label: "Icons", type: "select", opts: Object.keys(ISETS), value: "3 arrows" }, { k: "rev", label: "Order", type: "check", value: true, ph: "Reverse the icon order (low values get the best icon)" }, { k: "only", label: "Display", type: "check", value: false, ph: "Show the icon only (hide the number)" }], "Apply", (v) => addIcon(v.s, { rev: !!v.rev, only: !!v.only })) }, "-"]); if (i < 0) return items.concat(add); const o = items.slice(); o.splice(i - (items[i - 1] === "-" ? 1 : 0), 0, ...add); return o; };

    /* ============ sparklines ============ */
    function sparkForm(type) {
      const sh = cs(); const g = S.whole ? S.region(S.cur.r, S.cur.c) : S.sel; const src = rstr(g); const locG = g.r1 === g.r2 && g.c1 === g.c2 ? g : (g.c2 > g.c1 || true ? { r1: g.r1, c1: g.c2 + 1, r2: g.r2, c2: g.c2 + 1 } : g);
      const names = { line: "Line sparklines", col: "Column sparklines", wl: "Win/Loss sparklines" };
      form(an(), names[type], [{ k: "src", label: "Data range (the numbers)", value: src }, { k: "loc", label: "Where to put them (one cell per row)", value: rstr(locG) }, { k: "m", label: "Show", type: "check", value: type === "line", ph: "Markers on every point" }, { k: "hi", label: " ", type: "check", value: false, ph: "Highlight highest and lowest" }, { k: "la", label: " ", type: "check", value: false, ph: "Highlight last point" }], "Create", (v) => {
        const a = parseR(v.src), b = parseR(v.loc); if (!a || !b) { say("Ranges should look like B2:E10 and F2:F10."); return; }
        S.tx(() => { const keep = (sh.ext.spark || []).filter((o) => o.loc !== rstr(b)); setExt(sh, "spark", keep.concat([{ id: "sp" + Math.random().toString(36).slice(2, 6), type, src: rstr(a), loc: rstr(b), color: "#4472c4", markers: !!v.m, high: !!v.hi, low: !!v.hi, last: !!v.la }])); });
        S.render(); say("Sparklines added. Make the rows taller or the column wider to see them better.", true);
      });
    }
    function sparkClear() { const sh = cs(), s = S.sel; S.tx(() => setExt(sh, "spark", (sh.ext.spark || []).filter((o) => { const L = parseR(o.loc); return !(L && L.r1 <= s.r2 && L.r2 >= s.r1 && L.c1 <= s.c2 && L.c2 >= s.c1); }))); S.render(); }

    /* ============ protection ============ */
    const isProt = () => !!cs().ext.protect;
    function protectForm() {
      const sh = cs(); if (sh.ext.protect) { unprotectForm(); return; }
      form(an(), "Protect this sheet", [{ k: "pw", label: "Password (optional - leave empty for none)", type: "password", value: "" }], "Protect", (v) => { S.tx(() => { S.x.unprotecting = true; try { setExt(sh, "protect", { pw: v.pw ? hash(v.pw) : null, xh: v.pw ? window.OffPwHash(v.pw) : null }); } finally { S.x.unprotecting = false; } }); S.render(); S.redrawRibbon(); say("Sheet protected. Locked cells can't be changed - cells you unlocked (Review ▸ Unlock cells) still can. This stops accidental edits; it is not strong security.", true); });
    }
    function unprotectForm() {
      const sh = cs(), p = sh.ext.protect; const done = () => { S.tx(() => { const e = Object.assign({}, sh.ext); delete e.protect; S.setMeta(sh, "ext", e); }); S.render(); S.redrawRibbon(); say("Sheet unprotected."); };
      if (!p.pw && !p.xh) { done(); return; } form(an(), "Unprotect this sheet", [{ k: "pw", label: "Password", type: "password", value: "" }], "Unprotect", (v) => { if (p.pw ? hash(v.pw || "") !== p.pw : window.OffPwHash(v.pw || "") !== p.xh) { say("That password is not right."); return; } done(); });
    }
    const lockSel = (unl) => { if (isProt()) { say("Unprotect the sheet first, then change which cells are locked."); return; } S.styleSel({ unl: unl ? 1 : null }); say(unl ? "These cells are unlocked: they stay editable after you protect the sheet." : "These cells are locked again."); };

    /* ============ chart toolbar ============ */
    const PALS = { "Office": null, "Blues": ["#1f4e79", "#2e75b6", "#5b9bd5", "#9dc3e6", "#bdd7ee", "#deebf7"], "Greens": ["#375623", "#548235", "#70ad47", "#a9d18e", "#c5e0b4", "#e2efda"], "Warm": ["#c00000", "#ed7d31", "#ffc000", "#f4b183", "#ffd966", "#a5a5a5"], "Pastel": ["#8fb8de", "#f4b183", "#b7d7a8", "#ffe599", "#d5a6bd", "#b4a7d6"], "Greys": ["#262626", "#595959", "#7f7f7f", "#a6a6a6", "#bfbfbf", "#d9d9d9"] };
    const chSel = () => X_.chartSel && X_.chartSel();
    const setChart = (patch) => { const sh = cs(), ch = chSel(); if (!ch) return; S.tx(() => S.setMeta(sh, "charts", sh.charts.map((c) => (c.id === ch.id ? Object.assign({}, c, patch) : c)))); X_.renderCharts(); S.refreshRibbon(); };
    const on = (k, v) => (chSel() || {})[k] === v;
    function seriesList() { const ch = chSel(); if (!ch) return []; try { return OffXlsx.Charts.data(wb, cs(), ch).series; } catch (e) { return []; } }
    function downloadChart(png) {
      const ch = chSel(); if (!ch) return; const svg = OffChart.svg(ch, OffXlsx.Charts.data(wb, cs(), ch), ch.w, ch.h), name = Z.safeName(S.api.file.name || "chart") + "-chart";
      if (!png) { Z.download(new Blob([svg], { type: "image/svg+xml" }), name + ".svg"); return; }
      const img = new Image(); img.onload = () => { const cv = document.createElement("canvas"); cv.width = ch.w * 2; cv.height = ch.h * 2; const x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0, cv.width, cv.height); cv.toBlob((b) => Z.download(b, name + ".png")); }; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }
    const typeItems = () => OffChart.TYPES.map((a) => ({ label: a[0], on: on("type", a[1]), run: () => setChart({ type: a[1] }) }));
    const orig = X_.chartTabItems ? X_.chartTabItems() : []; const pick = (l) => orig.find((x) => x.label === l);
    const chartGroups = () => [
      { label: "Type", items: [{ k: "menu", i: "cBar", label: "Chart type", big: true, items: typeItems }, { i: "freeze", label: "Stacked", t: "Stack the series", on: () => setChart({ stacked: !(chSel() || {}).stacked, pct: false }), act: () => !!(chSel() || {}).stacked && !(chSel() || {}).pct }, { i: "freeze", label: "100%", t: "100% stacked", on: () => setChart({ pct: !(chSel() || {}).pct, stacked: !(chSel() || {}).pct }), act: () => !!(chSel() || {}).pct }] },
      { label: "Data", items: [pick("Title and data"), pick("Switch rows/columns")].filter(Boolean) },
      { label: "Add elements", items: [
        { i: "param", label: "Axis titles", on: () => { const ch = chSel(); form(an(), "Axis titles", [{ k: "x", label: "Bottom (category) axis", value: ch.xTitle || "" }, { k: "y", label: "Left (value) axis", value: ch.yTitle || "" }], "Apply", (v) => setChart({ xTitle: v.x, yTitle: v.y })); } },
        { i: "dup", label: "Data labels", on: () => setChart({ labels: !(chSel() || {}).labels }), act: () => !!(chSel() || {}).labels },
        { i: "layout", label: "Gridlines", on: () => setChart({ grid: (chSel() || {}).grid === false }), act: () => (chSel() || {}).grid !== false },
        { k: "menu", i: "layout", label: "Legend", items: () => [["Bottom", "bottom"], ["Right", "right"], ["Top", "top"], ["Left", "left"], ["None", "none"]].map((a) => ({ label: a[0], on: on("legend", a[1]), run: () => setChart({ legend: a[1] }) })) },
        { k: "menu", i: "chart", label: "Trendline", items: () => [["None", ""], ["Linear", "linear"], ["Exponential", "exp"], ["Polynomial (curve)", "poly"], ["Moving average", "avg"]].map((a) => ({ label: a[0], on: (chSel() || {}).trend === a[1] || (!a[1] && !(chSel() || {}).trend), run: () => setChart({ trend: a[1] || null }) })).concat(["-", { label: "On every series", on: !!(chSel() || {}).trendAll, run: () => setChart({ trendAll: !(chSel() || {}).trendAll }) }]) }] },
      { label: "Lines", items: [{ i: "alignC", label: "Smooth", t: "Smooth the lines", on: () => setChart({ smooth: !(chSel() || {}).smooth }), act: () => !!(chSel() || {}).smooth }, { i: "dup", label: "Markers", on: () => setChart({ marker: (chSel() || {}).marker === false }), act: () => (chSel() || {}).marker !== false }] },
      { label: "Axes and series", items: [
        { i: "param", label: "Axis range", on: () => { const ch = chSel(); form(an(), "Value axis", [{ k: "min", label: "Lowest value (empty = automatic)", value: ch.ymin == null ? "" : ch.ymin }, { k: "max", label: "Highest value (empty = automatic)", value: ch.ymax == null ? "" : ch.ymax }, { k: "log", label: "Scale", type: "check", value: !!ch.log, ph: "Logarithmic scale" }, { k: "min2", label: "Right-hand axis: lowest", value: ch.y2min == null ? "" : ch.y2min }, { k: "max2", label: "Right-hand axis: highest", value: ch.y2max == null ? "" : ch.y2max }], "Apply", (v) => { const n = (x) => (x === "" || isNaN(+x) ? null : +x); setChart({ ymin: n(v.min), ymax: n(v.max), log: !!v.log, y2min: n(v.min2), y2max: n(v.max2) }); }); } },
        { i: "sum", label: "Series types", t: "Combo: choose a type and axis for each series", on: () => { const ch = chSel(), ser = seriesList().slice(0, 8); if (!ser.length) return; form(an(), "Each series", ser.flatMap((s, i) => [{ k: "t" + i, label: s.name + " - shown as", type: "select", opts: [["col", "Columns"], ["line", "Line"], ["area", "Area"]], value: (ch.stypes || [])[i] || (i === 0 ? "col" : "line") }, { k: "s" + i, label: " ", type: "check", value: (ch.sec || []).includes(i), ph: "Use the right-hand axis" }]), "Apply", (v) => { setChart({ type: "combo", stypes: ser.map((_, i) => v["t" + i]), sec: ser.map((_, i) => i).filter((i) => v["s" + i]) }); }); } },
        { k: "menu", i: "size", label: "Gap width", items: () => [0, 10, 25, 50, 100, 150].map((n) => ({ label: n + "%", on: (chSel() || {}).gap === n, run: () => setChart({ gap: n }) })) },
        { k: "menu", i: "size", label: "Histogram bins", items: () => [["Automatic", null], ["5", 5], ["8", 8], ["10", 10], ["15", 15], ["20", 20]].map((a) => ({ label: a[0], on: (chSel() || {}).bins === a[1] || (!a[1] && !(chSel() || {}).bins), run: () => setChart({ bins: a[1], type: "histogram" }) })) }] },
      { label: "Style", items: [{ k: "menu", i: "fill", label: "Colours", items: () => Object.keys(PALS).map((k) => ({ label: k, run: () => setChart({ colors: PALS[k] }) })) }, { k: "menu", i: "print", label: "Save picture", items: () => [{ label: "As PNG picture", run: () => downloadChart(true) }, { label: "As SVG (sharp, scalable)", run: () => downloadChart(false) }] }, pick("Delete") || { i: "trash", label: "Delete", on: X_.chartDelete }] }
    ];
    const chTab = tabs.find((t) => t.id === "chart"); if (chTab) chTab.groups = chartGroups();

    /* ============ ribbon additions ============ */
    const tab = (id) => tabs.find((t) => t.id === id);
    const home = tab("home"), ins = tab("insert"), fml = tab("formulas");
    const styleMenu = (fn) => () => Object.keys(STY).map((k) => ({ label: STY[k].nm, run: () => fn(k) }));
    if (home) { const g = home.groups.find((x) => x.label === "Styles"); if (g) g.items.push({ k: "menu", i: "table", label: "Format as table", t: "Format as table", items: styleMenu((k) => X_.createTable(k)) }); }
    if (ins) {
      const ch = ins.groups.find((x) => x.label === "Charts");
      if (ch) { const add = (t, st, ex) => () => X_.addChart && X_.addChart(t, st, ex); ch.items = [
        { k: "menu", i: "cBar", label: "Column", big: true, t: "Column and bar charts", items: () => [{ label: "Clustered column", run: add("col") }, { label: "Stacked column", run: add("col", true) }, { label: "100% stacked column", run: add("col", true, { pct: true }) }, { label: "Clustered bar", run: add("bar") }, { label: "Stacked bar", run: add("bar", true) }, { label: "100% stacked bar", run: add("bar", true, { pct: true }) }] },
        { k: "menu", i: "cLine", label: "Line", big: true, t: "Line and area charts", items: () => [{ label: "Line", run: add("line") }, { label: "Stacked line", run: add("line", true) }, { label: "Smooth line", run: add("line", false, { smooth: true }) }, { label: "Area", run: add("area") }, { label: "Stacked area", run: add("area", true) }, { label: "100% stacked area", run: add("area", true, { pct: true }) }] },
        { k: "menu", i: "cPie", label: "Pie", big: true, t: "Pie and doughnut charts", items: () => [{ label: "Pie", run: add("pie") }, { label: "Doughnut", run: add("doughnut") }] },
        { k: "menu", i: "cScat", label: "Scatter", big: true, t: "Scatter and bubble charts", items: () => [{ label: "Scatter (X Y)", run: add("scatter") }, { label: "Scatter with smooth line", run: add("scatter", false, { smooth: true }) }, { label: "Bubble", run: add("bubble") }] },
        { k: "menu", i: "cArea", label: "More", big: true, t: "More chart types", items: () => [{ label: "Combo (columns + line)", run: add("combo") }, { label: "Radar", run: add("radar") }, { label: "Waterfall", run: add("waterfall") }, { label: "Histogram", run: add("histogram", false, { legend: "none" }) }, { label: "Pareto", run: add("pareto") }, { label: "Funnel", run: add("funnel", false, { legend: "none" }) }, { label: "Treemap", run: add("treemap") }, { label: "Box and whisker", run: add("box") }] }]; }
      const cells = ins.groups.find((x) => x.label === "Cells"); const tblG = { label: "Tables", items: [{ k: "menu", i: "table", label: "Table", big: true, t: "Turn the selected cells into a table", items: styleMenu((k) => X_.createTable(k)) }] };
      const spG = { label: "Sparklines", items: [{ i: "cLine", label: "Line", t: "Line sparklines (tiny charts inside cells)", on: () => sparkForm("line") }, { i: "cBar", label: "Column", on: () => sparkForm("col") }, { i: "alignM", label: "Win/Loss", on: () => sparkForm("wl") }, { i: "clear", label: "Clear", t: "Remove sparklines from the selected cells", on: sparkClear }] };
      ins.groups.splice(ins.groups.indexOf(cells), 0, tblG); ins.groups.push(spG);
    }
    if (fml) { const lib = fml.groups.find((x) => x.label === "Function library"); if (lib) ["Dynamic arrays", "Engineering & info", "Database"].forEach((cat) => lib.items.push({ k: "menu", label: cat, t: cat + " functions", items: () => (S.x.fnMenu ? S.x.fnMenu(cat) : []) })); }
    /* Table design (contextual) */
    let lastTbl = null;
    const prevSel = X_.onSelect; X_.onSelect = () => { if (prevSel) prevSel(); const t = curTbl(), id = t ? t.id : null; if (id !== lastTbl) { lastTbl = id; S.redrawRibbon(); } };
    const tflag = (k, d) => ({ on: () => { const t = curTbl(); if (t) patchTbl(t, { [k]: (t[k] === undefined ? d : t[k]) ? false : true }); }, act: () => { const t = curTbl(); return !!t && (t[k] === undefined ? d : t[k]); } });
    const dsgn = { id: "table", label: "Table design", ctx: true, when: () => !!curTbl(), groups: [
      { label: "Properties", items: [{ i: "param", label: "Name", t: "Rename the table", big: true, on: () => curTbl() && renameForm(curTbl()) }, { i: "size", label: "Resize", on: () => curTbl() && resizeForm(curTbl()) }] },
      { label: "Style options", items: [Object.assign({ i: "alignT", label: "Header row" }, tflag("hdr", true)), { i: "sum", label: "Total row", t: "Add a row of totals under the table", on: () => curTbl() && toggleTotal(curTbl()), act: () => !!(curTbl() || {}).total }, Object.assign({ i: "layout", label: "Banded rows" }, tflag("band", true)), Object.assign({ i: "alignL", label: "First column" }, tflag("firstCol", false)), Object.assign({ i: "alignR", label: "Last column" }, tflag("lastCol", false)), { i: "filter", label: "Filter buttons", on: () => { X_.toggleFilter && X_.toggleFilter(); }, act: () => !!cs().filter }] },
      { label: "Table styles", items: [{ k: "menu", i: "fill", label: "Style", big: true, items: () => Object.keys(STY).map((k) => ({ label: STY[k].nm, on: (curTbl() || {}).style === k, run: () => curTbl() && patchTbl(curTbl(), { style: k }) })) }] },
      { label: "Tools", items: [{ i: "trash", label: "Remove duplicates", on: () => X_.dedupe && X_.dedupe() }, { i: "table", label: "Convert to range", on: () => curTbl() && toRange(curTbl()) }, { i: "chart", label: "Summarize with PivotTable", on: () => X_.pivotNew && X_.pivotNew(curTbl()) }] }
    ] };
    tabs.splice(tabs.findIndex((t) => t.id === "chart"), 0, dsgn);
    /* Review tab */
    const review = { id: "review", label: "Review", groups: [
      { label: "Notes", items: [{ i: "comment", label: "New note", big: true, on: () => X_.noteForm && X_.noteForm() }, { i: "eye", label: "Show all notes", t: "List every note on this sheet", on: () => { const sh = cs(); const l = []; sh.m.forEach((c, k) => { if (c.n) { const [r, cc] = C.unkey(k); l.push(C.addr(r, cc) + ": " + c.n); } }); say(l.length ? l.slice(0, 6).join("  |  ") + (l.length > 6 ? "  … (" + l.length + " notes)" : "") : "There are no notes on this sheet."); } }, { i: "clear", label: "Delete notes", on: () => S.clearSel && S.clearSel("notes") }] },
      { label: "Protect", items: [{ i: "lock", label: "Protect sheet", big: true, t: "Protect or unprotect this sheet", on: protectForm, act: isProt }, { i: "lock", label: "Unlock cells", t: "Cells that stay editable after the sheet is protected", on: () => lockSel(true) }, { i: "lock", label: "Lock cells", on: () => lockSel(false) }] },
      { label: "Check", items: [{ i: "find", label: "Find errors", t: "Highlight every cell showing an error", on: () => X_.goSpecial && X_.goSpecial("errors") }, { i: "check", label: "Data validation", on: () => X_.dvForm && X_.dvForm() }] }
    ] };
    tabs.splice(tabs.findIndex((t) => t.id === "view"), 0, review);
    S.clearSel = S.clearSel || null;
    S.x.isProtected = isProt;
    S.x.sparkForm = sparkForm;
  });
})();
