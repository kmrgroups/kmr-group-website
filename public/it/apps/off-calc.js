/* KMR Office Suite - calculation engine for Spreadsheets: workbook model, formula parser and evaluator, about 190 functions, number formats.
   Dates are serial numbers (1900 system). Values: number, string, boolean, null (empty) or an error (Calc.ERR.*). */
(function () {
  "use strict";
  class E { constructor(c) { this.code = c; } toString() { return this.code; } }
  const ERR = { DIV0: new E("#DIV/0!"), VALUE: new E("#VALUE!"), REF: new E("#REF!"), NAME: new E("#NAME?"), NA: new E("#N/A"), NUM: new E("#NUM!"), NULL: new E("#NULL!"), CIRC: new E("#CIRC!"), SPILL: new E("#SPILL!"), CALC: new E("#CALC!") };
  const isE = (v) => v instanceof E;
  const MAXR = 1048576, MAXC = 16384;
  const colN = (s) => { let n = 0; for (const ch of s.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n; };
  const nCol = (n) => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const addr = (r, c) => nCol(c) + r;
  const parseAddr = (a) => { const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(a); return m ? { r: +m[2], c: colN(m[1]) } : null; };
  const key = (r, c) => r * 16385 + c;
  const unkey = (k) => { const c = k % 16385; return [(k - c) / 16385, c]; };

  /* ---------- dates ---------- */
  const EPOCH = Date.UTC(1899, 11, 30);
  const toSerial = (d) => (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()) - EPOCH) / 864e5;
  const fromSerial = (n) => { const ms = Math.round(n * 864e5) + EPOCH, d = new Date(ms); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()); };
  const dser = (y, m, d) => (Date.UTC(y, m - 1, d) - EPOCH) / 864e5;
  const ymd = (n) => { const d = new Date(Math.floor(n) * 864e5 + EPOCH); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; };
  const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  /* ---------- number formats ---------- */
  const Fmt = (() => {
    const cache = {};
    const group = (s, indian) => { if (!indian) return s.replace(/\B(?=(\d{3})+(?!\d))/g, ","); if (s.length <= 3) return s; return s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + s.slice(-3); };
    function split(code) { const out = []; let cur = "", q = false; for (let i = 0; i < code.length; i++) { const ch = code[i]; if (ch === '"') q = !q; if (ch === ";" && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; }
    function parse(code) {
      if (cache[code]) return cache[code]; const secs = split(code).map((sec) => {
        let color = null, cond = null, s = sec; let m;
        while ((m = /^\[([^\]]+)\]/.exec(s))) { const t = m[1]; if (/^(red|blue|green|black|white|yellow|magenta|cyan)$/i.test(t)) color = t.toLowerCase(); else if (/^[<>=]/.test(t)) cond = t; s = s.slice(m[0].length); }
        const isDate = /[ymdhs]/i.test(s.replace(/"[^"]*"|\\.|\[[^\]]*\]|_.|\*./g, "").replace(/E[+-]/gi, "")) && !/[0#?]/.test(s.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, "").replace(/\.0+/g, "").replace(/0{1,}(?=\s*(am|pm))/gi, ""));
        return { s, color, cond, isDate };
      });
      return (cache[code] = secs);
    }
    function num(abs, s) {
      const lit = [];
      let body = s.replace(/"([^"]*)"|\\(.)|_(.)|\*(.)|\[\$([^\]\-]*)(?:-[^\]]*)?\]/g, (m, a, b, c, d, e) => { if (d) return ""; if (c) { lit.push(" "); return "\u0004"; } lit.push(a != null ? a : b != null ? b : e); return "\u0004"; });
      const pct = /%/.test(body), v = pct ? abs * 100 : abs;
      const back = (t) => { let i = 0; return t.replace(/\u0004/g, () => lit[i++] || ""); };
      const sci = /([0#?]+\.?[0#?]*)E([+-])([0#]+)/i.exec(body);
      if (sci) {
        const dec = (sci[1].split(".")[1] || "").length; const e = v === 0 ? 0 : Math.floor(Math.log10(v)); const m = v / Math.pow(10, e);
        const exp = Math.abs(e).toString().padStart(sci[3].length, "0");
        return back(body.replace(sci[0], m.toFixed(dec) + "E" + (e < 0 ? "-" : sci[2] === "+" ? "+" : "") + exp));
      }
      const mm = /[0#?][0#?,.]*/.exec(body); if (!mm) return back(body);
      let part = mm[0], scale = 0; const tc = /(,+)$/.exec(part); if (tc) { scale = tc[1].length; part = part.slice(0, -scale); }
      const [ip, fp] = part.split("."); const decs = fp ? fp.replace(/,/g, "").length : 0, minDec = fp ? (fp.match(/0/g) || []).length : 0;
      const indian = /#,##,##0|##,##,##0/.test(part), useGroup = /,/.test(ip || "");
      const x = v / Math.pow(1000, scale); let str = x.toFixed(decs);
      if (decs > minDec) { str = str.replace(/0+$/, (z) => z.slice(0, Math.max(0, z.length - (decs - minDec)))); if (/\.$/.test(str)) str = str.slice(0, -1); const dot = str.indexOf("."); const have = dot < 0 ? 0 : str.length - dot - 1; if (have < minDec) str = (dot < 0 ? str + "." : str) + "0".repeat(minDec - have); }
      let [i2, f2 = ""] = str.split("."); const minInt = ((ip || "").replace(/,/g, "").match(/0/g) || []).length; i2 = i2.replace(/^0+(?=\d)/, ""); if (i2 === "0" && minInt === 0) i2 = ""; if (i2.length < minInt) i2 = i2.padStart(minInt, "0"); if (useGroup) i2 = group(i2, indian);
      const out = i2 + (f2 || (decs && minDec) ? "." + f2 : "");
      return back(body.slice(0, mm.index) + out + body.slice(mm.index + mm[0].length));
    }
    function date(n, s) {
      const d = fromSerial(n); const ap = /am\/pm|a\/p/i.test(s); let h = d.getHours(), out = "", i = 0; const lower = s.replace(/"[^"]*"|\\./g, (m) => m); const tokens = [];
      const re = /"([^"]*)"|\\(.)|\[(h+|m+|s+)\]|(yyyy|yy|mmmmm|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|am\/pm|a\/p|\.0+)|(.)/gi; let m, prev = "";
      const parts = []; while ((m = re.exec(s))) parts.push(m);
      // decide minute vs month: m after h or before s is minutes
      parts.forEach((p, k) => {
        if (p[1] != null) { out += p[1]; return; } if (p[2] != null) { out += p[2]; return; }
        if (p[3]) { const t = p[3][0].toLowerCase(); const tot = Math.floor(n * 24); if (t === "h") out += String(Math.floor(n * 24)).padStart(p[3].length, "0"); else if (t === "m") out += String(Math.floor(n * 1440)).padStart(p[3].length, "0"); else out += String(Math.floor(n * 86400)).padStart(p[3].length, "0"); return; }
        const t = p[4]; if (!t) { out += p[5]; return; } const tl = t.toLowerCase();
        const isMin = (tl === "m" || tl === "mm") && (() => { for (let j = k - 1; j >= 0; j--) { const q = parts[j][4]; if (q && /^(h|hh)$/i.test(q)) return true; if (q && /^(d|dd|ddd|dddd|yy|yyyy|m|mm|mmm|mmmm)$/i.test(q)) return false; } for (let j = k + 1; j < parts.length; j++) { const q = parts[j][4]; if (q && /^(s|ss)$/i.test(q)) return true; if (q && /^(d|dd|ddd|dddd|yy|yyyy|mmm|mmmm)$/i.test(q)) return false; } return false; })();
        if (isMin) out += tl === "mm" ? String(d.getMinutes()).padStart(2, "0") : d.getMinutes();
        else if (tl === "yyyy") out += d.getFullYear(); else if (tl === "yy") out += String(d.getFullYear() % 100).padStart(2, "0");
        else if (tl === "mmmmm") out += MON[d.getMonth()][0]; else if (tl === "mmmm") out += MON[d.getMonth()]; else if (tl === "mmm") out += MON[d.getMonth()].slice(0, 3); else if (tl === "mm") out += String(d.getMonth() + 1).padStart(2, "0"); else if (tl === "m") out += d.getMonth() + 1;
        else if (tl === "dddd") out += DAY[d.getDay()]; else if (tl === "ddd") out += DAY[d.getDay()].slice(0, 3); else if (tl === "dd") out += String(d.getDate()).padStart(2, "0"); else if (tl === "d") out += d.getDate();
        else if (tl === "hh" || tl === "h") { const hh = ap ? h % 12 || 12 : h; out += tl === "hh" ? String(hh).padStart(2, "0") : hh; }
        else if (tl === "ss") out += String(d.getSeconds()).padStart(2, "0"); else if (tl === "s") out += d.getSeconds(); else if (tl === "am/pm") out += h < 12 ? "AM" : "PM"; else if (tl === "a/p") out += h < 12 ? "A" : "P"; else if (/^\.0+$/.test(t)) out += "." + String(Math.floor((n * 86400 % 1) * Math.pow(10, t.length - 1))).padStart(t.length - 1, "0");
      });
      return out;
    }
    const BUILT = { 0: "General", 1: "0", 2: "0.00", 3: "#,##0", 4: "#,##0.00", 9: "0%", 10: "0.00%", 11: "0.00E+00", 14: "dd-mm-yyyy", 15: "d-mmm-yy", 16: "d-mmm", 17: "mmm-yy", 18: "h:mm AM/PM", 19: "h:mm:ss AM/PM", 20: "h:mm", 21: "h:mm:ss", 22: "dd-mm-yyyy h:mm", 37: "#,##0;(#,##0)", 38: "#,##0;[Red](#,##0)", 39: "#,##0.00;(#,##0.00)", 40: "#,##0.00;[Red](#,##0.00)", 45: "mm:ss", 46: "[h]:mm:ss", 49: "@" };
    function general(v) {
      if (!isFinite(v)) return String(v); if (Number.isInteger(v) && Math.abs(v) < 1e11) return String(v);
      let s = Math.abs(v) >= 1e11 || (Math.abs(v) < 1e-9 && v !== 0) ? v.toExponential(5).replace(/\.?0+e/, "E").replace("e", "E").replace(/E\+?(-?)(\d)$/, "E$10$2").replace("E+", "E+") : String(parseFloat(v.toPrecision(11)));
      if (/e/.test(s)) s = Number(s).toExponential(5).replace(/\.?0+e/, "E").replace("e+", "E+").replace("e-", "E-").replace(/E([+-])(\d)$/, "E$10$2"); return s;
    }
    /* format(value, code) -> { text, color } */
    function format(v, code) {
      code = code || "General";
      if (v == null || v === "") return { text: "" }; if (isE(v)) return { text: v.code }; if (typeof v === "boolean") return { text: v ? "TRUE" : "FALSE" };
      if (typeof v === "string") { if (code === "@" || code === "General" || !/@/.test(code)) return { text: v }; const secs = parse(code), s = secs[3] || secs[0]; return { text: s.s.replace(/@/g, v).replace(/"/g, "") }; }
      if (code === "General" || code === "") return { text: general(v) };
      const secs = parse(code); let sec = secs[0], n = v;
      if (secs.length > 1) { const conds = secs.filter((s) => s.cond); if (conds.length) { for (const s of secs) { if (s.cond) { const mm = /^([<>=]+)(-?[\d.]+)/.exec(s.cond), x = +mm[2]; if (mm[1] === ">" && v > x || mm[1] === "<" && v < x || mm[1] === ">=" && v >= x || mm[1] === "<=" && v <= x || mm[1] === "=" && v === x || mm[1] === "<>" && v !== x) { sec = s; break; } } } } else if (v < 0 && secs[1]) { sec = secs[1]; n = -v; } else if (v === 0 && secs[2]) sec = secs[2]; else if (v < 0) n = -v; }
      else if (v < 0 && !sec.isDate) { /* single section: minus sign */ }
      if (sec.isDate) { if (v < 0) return { text: "########" }; return { text: date(v, sec.s), color: sec.color }; }
      const neg = n < 0 && !(secs.length > 1 && secs[1] === sec), abs = Math.abs(n);
      let t = num(abs, sec.s); if (neg) t = "-" + t; return { text: t, color: sec.color };
    }
    const isDateCode = (code) => { if (!code || code === "General") return false; const s = parse(code)[0]; return s.isDate; };
    return { format, parse, BUILT, general, isDateCode };
  })();

  /* ---------- tokenizer ---------- */
  const OPS = ["<>", "<=", ">=", "+", "-", "*", "/", "^", "&", "=", "<", ">", "%", "(", ")", ",", ";", ":", "{", "}", "!"];
  function tokenize(f) {
    const t = []; let i = 0; const n = f.length;
    while (i < n) {
      const ch = f[i];
      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") { i++; continue; }
      if (ch === '"') { let j = i + 1, s = ""; while (j < n) { if (f[j] === '"') { if (f[j + 1] === '"') { s += '"'; j += 2; continue; } break; } s += f[j++]; } t.push({ t: "str", v: s, i, j: j + 1 }); i = j + 1; continue; }
      if (ch === "'") { let j = i + 1, s = ""; while (j < n) { if (f[j] === "'") { if (f[j + 1] === "'") { s += "'"; j += 2; continue; } break; } s += f[j++]; } if (f[j + 1] === "!") { t.push({ t: "sheet", v: s, i, j: j + 2 }); i = j + 2; continue; } throw new Error("quote"); }
      if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(f[i + 1] || ""))) { const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(f.slice(i)); t.push({ t: "num", v: parseFloat(m[0]), i, j: i + m[0].length }); i += m[0].length; continue; }
      if (ch === "#") { const m = /^#(DIV\/0!|VALUE!|REF!|NAME\?|N\/A|NUM!|NULL!)/i.exec(f.slice(i)); if (m) { t.push({ t: "err", v: m[0].toUpperCase(), i, j: i + m[0].length }); i += m[0].length; continue; } }
      if (ch === "[") { let d = 0, j = i; for (; j < n; j++) { if (f[j] === "[") d++; else if (f[j] === "]") { d--; if (!d) break; } } if (d === 0) { t.push({ t: "name", v: f.slice(i, j + 1), i, j: j + 1 }); i = j + 1; continue; } }
      if (/[A-Za-z_$]/.test(ch)) {
        const m = /^(\$?[A-Za-z]{1,3}\$?\d+(?![A-Za-z_.])|\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}(?![A-Za-z0-9_(])|\$?\d+:\$?\d+(?![\d(])|[A-Za-z_\\][A-Za-z0-9_.]*)/.exec(f.slice(i)); if (!m) { throw new Error("char " + ch); }
        let w = m[0], k = i + w.length;
        if (f[k] === "[" && /^[A-Za-z_][A-Za-z0-9_.]*$/.test(w)) { let d = 0, j = k; for (; j < n; j++) { if (f[j] === "[") d++; else if (f[j] === "]") { d--; if (!d) break; } } if (d === 0) { t.push({ t: "name", v: f.slice(i, j + 1), i, j: j + 1 }); i = j + 1; continue; } }
        if (f[k] === "!" && /^[A-Za-z_][A-Za-z0-9_.]*$/.test(w)) { t.push({ t: "sheet", v: w, i, j: k + 1 }); i = k + 1; continue; }
        if (/^\$?[A-Za-z]{1,3}\$?\d+$/.test(w) && !(/^[A-Za-z]/.test(w) && f[k] === "(")) { t.push({ t: "ref", v: w, i, j: k }); i = k; continue; }
        if (/^\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}$/.test(w)) { t.push({ t: "colrange", v: w, i, j: k }); i = k; continue; }
        if (/^\$?\d+:\$?\d+$/.test(w)) { t.push({ t: "rowrange", v: w, i, j: k }); i = k; continue; }
        if (/^(TRUE|FALSE)$/i.test(w) && f[k] !== "(") { t.push({ t: "bool", v: w.toUpperCase() === "TRUE", i, j: k }); i = k; continue; }
        t.push({ t: "name", v: w, i, j: k }); i = k; continue;
      }
      let op = f.slice(i, i + 2); if (OPS.includes(op)) { t.push({ t: "op", v: op, i, j: i + 2 }); i += 2; continue; }
      op = ch; if (OPS.includes(op)) { t.push({ t: "op", v: op, i, j: i + 1 }); i++; continue; }
      throw new Error("char " + ch);
    }
    return t;
  }
  const K_ = {};
  /* ---------- parser (precedence climbing) ---------- */
  function parse(src, row, shn) {
    if (src.indexOf("[") >= 0 && K_.structRef) src = K_.structRef(src, row, shn);
    const toks = tokenize(src); let p = 0; const peek = () => toks[p], next = () => toks[p++];
    const isOp = (v) => toks[p] && toks[p].t === "op" && toks[p].v === v;
    function expr(minPrec) {
      let left = unary();
      for (;;) {
        const tk = peek(); if (!tk || tk.t !== "op") break; const info = BIN[tk.v]; if (!info || info[0] < minPrec) break; next(); const right = expr(info[1] ? info[0] : info[0] + 1); left = { k: "bin", op: tk.v, a: left, b: right };
      }
      return left;
    }
    const BIN = { "=": [1, 0], "<>": [1, 0], "<": [1, 0], ">": [1, 0], "<=": [1, 0], ">=": [1, 0], "&": [2, 0], "+": [3, 0], "-": [3, 0], "*": [4, 0], "/": [4, 0], "^": [5, 0] };
    function unary() {
      if (isOp("-")) { next(); return { k: "un", op: "-", a: unary() }; } if (isOp("+")) { next(); return unary(); }
      let a = primary(); while (isOp("%")) { next(); a = { k: "pct", a }; } return a;
    }
    function refOf(v, sheet) { const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(v); return { k: "ref", sheet, r: +m[4], c: colN(m[2]), ar: !!m[3], ac: !!m[1] }; }
    function primary() {
      const tk = next(); if (!tk) throw new Error("end");
      if (tk.t === "num") return { k: "num", v: tk.v }; if (tk.t === "str") return { k: "str", v: tk.v }; if (tk.t === "bool") return { k: "bool", v: tk.v }; if (tk.t === "err") return { k: "err", v: tk.v };
      if (tk.t === "sheet") {
        const nx = next(); if (!nx) throw new Error("ref");
        if (nx.t === "ref") return rangeTail(refOf(nx.v, tk.v)); if (nx.t === "colrange") return colRange(nx.v, tk.v); if (nx.t === "rowrange") return rowRange(nx.v, tk.v); throw new Error("sheetref");
      }
      if (tk.t === "ref") return rangeTail(refOf(tk.v));
      if (tk.t === "colrange") return colRange(tk.v); if (tk.t === "rowrange") return rowRange(tk.v);
      if (tk.t === "name") {
        if (isOp("(")) { next(); const args = []; if (isOp(")")) { next(); return { k: "fn", name: tk.v.toUpperCase(), args }; } for (;;) { if (isOp(",") || isOp(";")) { args.push({ k: "empty" }); next(); continue; } args.push(expr(0)); if (isOp(",") || isOp(";")) { next(); if (isOp(")")) { args.push({ k: "empty" }); next(); break; } continue; } if (isOp(")")) { next(); break; } throw new Error("args"); } return { k: "fn", name: tk.v.toUpperCase(), args }; }
        return { k: "name", name: tk.v };
      }
      if (tk.t === "op" && tk.v === "(") { const e = expr(0); if (!isOp(")")) throw new Error("paren"); next(); return { k: "paren", a: e }; }
      if (tk.t === "op" && tk.v === "{") { const rows = [[]]; for (;;) { const e = expr(0); rows[rows.length - 1].push(e); if (isOp(",")) { next(); continue; } if (isOp(";")) { next(); rows.push([]); continue; } if (isOp("}")) { next(); break; } throw new Error("array"); } return { k: "arr", rows }; }
      throw new Error("unexpected " + (tk.v || tk.t));
    }
    function rangeTail(a) {
      if (isOp(":")) { next(); const t2 = next(); if (!t2 || t2.t !== "ref") throw new Error("range"); const b = refOf(t2.v, a.sheet); return { k: "range", sheet: a.sheet, r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c), a1: a, a2: b }; }
      return a;
    }
    function colRange(v, sheet) { const m = /^(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})$/.exec(v); const c1 = colN(m[2]), c2 = colN(m[4]); return { k: "range", sheet, r1: 1, c1: Math.min(c1, c2), r2: MAXR, c2: Math.max(c1, c2), whole: "col", a1: { ac: !!m[1] }, a2: { ac: !!m[3] } }; }
    function rowRange(v, sheet) { const m = /^(\$?)(\d+):(\$?)(\d+)$/.exec(v); const r1 = +m[2], r2 = +m[4]; return { k: "range", sheet, r1: Math.min(r1, r2), c1: 1, r2: Math.max(r1, r2), c2: MAXC, whole: "row", a1: { ar: !!m[1] }, a2: { ar: !!m[3] } }; }
    const e = expr(0); if (p < toks.length) throw new Error("extra"); return e;
  }

  /* ---------- workbook model ---------- */
  class Sheet {
    constructor(name, data) {
      this.name = name; this.m = new Map(); this.cols = {}; this.rows = {}; this.merges = []; this.freeze = { r: 0, c: 0 }; this.charts = []; this.cf = []; this.hidden = false; this.filter = null; this.dv = []; this.tab = null; this.grid = true; this.hiddenRows = {}; this.hiddenCols = {}; this.ext = {};
      if (data) {
        if (data.ext) this.ext = JSON.parse(JSON.stringify(data.ext));
        Object.keys(data.cells || {}).forEach((a) => { const p = parseAddr(a); if (p) this.m.set(key(p.r, p.c), Object.assign({}, data.cells[a])); });
        this.cols = Object.assign({}, data.cols); this.rows = Object.assign({}, data.rows); this.merges = (data.merges || []).slice(); this.freeze = Object.assign({ r: 0, c: 0 }, data.freeze); this.charts = JSON.parse(JSON.stringify(data.charts || [])); this.cf = JSON.parse(JSON.stringify(data.cf || [])); this.hidden = !!data.hidden; this.filter = data.filter ? JSON.parse(JSON.stringify(data.filter)) : null; this.dv = JSON.parse(JSON.stringify(data.dv || [])); this.tab = data.tab || null; this.grid = data.grid !== false; this.hiddenRows = Object.assign({}, data.hiddenRows); this.hiddenCols = Object.assign({}, data.hiddenCols);
      }
      this.cache = new Map(); this.sv = new Map(); this.so = new Map(); this.sp = new Map();
    }
    get(r, c) { return this.m.get(key(r, c)); }
    set(r, c, cell) { if (cell && (cell.v != null || cell.f || cell.s)) this.m.set(key(r, c), cell); else this.m.delete(key(r, c)); }
    del(r, c) { this.m.delete(key(r, c)); }
    each(fn) { this.m.forEach((cell, k) => { const [r, c] = unkey(k); fn(r, c, cell); }); }
    dims() { let mr = 0, mc = 0; this.m.forEach((cell, k) => { const [r, c] = unkey(k); if (cell.v != null || cell.f) { if (r > mr) mr = r; if (c > mc) mc = c; } }); return [mr, mc]; }
    toJSON() {
      const cells = {}; const keys = [...this.m.keys()].sort((a, b) => a - b); keys.forEach((k) => { const [r, c] = unkey(k), cell = this.m.get(k), o = {}; if (cell.v != null) o.v = cell.v; if (cell.f) o.f = cell.f; if (cell.s) o.s = cell.s; if (cell.nf) o.nf = cell.nf; if (cell.l) o.l = cell.l; if (cell.n) o.n = cell.n; if (Object.keys(o).length) cells[addr(r, c)] = o; });
      return { ext: Object.keys(this.ext).length ? this.ext : undefined, name: this.name, cells, cols: this.cols, rows: this.rows, merges: this.merges, freeze: this.freeze, charts: this.charts, cf: this.cf, hidden: this.hidden || undefined, filter: this.filter || undefined, dv: this.dv.length ? this.dv : undefined, tab: this.tab || undefined, grid: this.grid === false ? false : undefined, hiddenRows: Object.keys(this.hiddenRows).length ? this.hiddenRows : undefined, hiddenCols: Object.keys(this.hiddenCols).length ? this.hiddenCols : undefined };
    }
  }
  class Workbook {
    constructor(data) {
      data = data || {}; this.styles = (data.styles && data.styles.length ? data.styles : [{}]).map((s) => Object.assign({}, s)); this.sheets = (data.sheets && data.sheets.length ? data.sheets : [{ name: "Sheet1" }]).map((s) => new Sheet(s.name, s)); this.names = Object.assign({}, data.names); this.active = data.active || 0; this.calcIter = !!data.calcIter; this.styleIdx = new Map(); this.styles.forEach((s, i) => this.styleIdx.set(JSON.stringify(s), i)); this.depth = 0; this.rand = new Map();
    }
    toJSON() { return { styles: this.styles, sheets: this.sheets.map((s) => s.toJSON()), names: this.names, active: this.active }; }
    style(i) { return this.styles[i || 0] || this.styles[0]; }
    styleId(o) { const keys = Object.keys(o).filter((k) => o[k] != null && o[k] !== "" && o[k] !== false).sort(), c = {}; keys.forEach((k) => (c[k] = o[k])); const j = JSON.stringify(c); let i = this.styleIdx.get(j); if (i == null) { i = this.styles.push(c) - 1; this.styleIdx.set(j, i); } return i; }
    sheet(n) { if (typeof n === "number") return this.sheets[n]; const l = String(n).toLowerCase(); return this.sheets.find((s) => s.name.toLowerCase() === l); }
    invalidate() { this.sheets.forEach((s) => { s.cache.clear(); s.sv.clear(); s.so.clear(); s.sp.clear(); }); this.rand.clear(); this.spillDone = false; }
    /* dynamic arrays: a formula whose result is several cells "spills" into the empty cells below / to the right of it */
    isDyn(cell, cr, shn) {
      if (!cell.f) return false; if (cell.ast && cell.ast.ma !== undefined) return cell.ast.ma;
      if (!/[:{]/.test(cell.f) && !arrRe().test(cell.f)) return false;
      if (!cell.ast) { try { cell.ast = parse(cell.f.slice(1), cr, shn); } catch (e) { cell.ast = { k: "err", v: "#NAME?" }; } }
      return (cell.ast.ma = mayArr(cell.ast));
    }
    ensureSpills() {
      if (this.spillDone) return; this.spillDone = true;
      const dyn = []; this.sheets.forEach((sh) => sh.m.forEach((cell, k) => { if (cell.f && this.isDyn(cell, unkey(k)[0], sh)) dyn.push([sh, k]); }));
      if (!dyn.length) return;
      for (let pass = 0; pass < 2; pass++) {
        dyn.forEach(([sh, k]) => { const [r, c] = unkey(k); this.value(sh, r, c); });
        if (pass === 0) { let any = false; this.sheets.forEach((s) => { if (s.sp.size) any = true; }); if (!any) break; this.sheets.forEach((s) => s.cache.clear()); }
      }
    }
    unspill(sh, ak) { const s = sh.sp.get(ak); if (!s) return; for (let i = 0; i < s.h; i++) for (let j = 0; j < s.w; j++) { if (!i && !j) continue; const k = key(s.r + i, s.c + j); if (sh.so.get(k) === ak) { sh.so.delete(k); sh.sv.delete(k); } } sh.sp.delete(ak); }
    spill(sh, r, c, g) {
      const ak = key(r, c), h = g.length, w = g[0].length; this.unspill(sh, ak);
      if (r + h - 1 > MAXR || c + w - 1 > MAXC) return ERR.SPILL;
      for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) { if (!i && !j) continue; const k = key(r + i, c + j); if (sh.m.has(k)) return ERR.SPILL; const o = sh.so.get(k); if (o !== undefined && o !== ak) return ERR.SPILL; }
      for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) { if (!i && !j) continue; const k = key(r + i, c + j), x = g[i][j]; sh.sv.set(k, x === undefined ? null : x); sh.so.set(k, ak); }
      sh.sp.set(ak, { r, c, h, w }); const x0 = g[0][0]; return x0 === undefined ? null : x0;
    }
    /* the value of a cell (formula evaluated, cached) */
    value(sh, r, c) {
      const cell = sh.get(r, c); if (!cell) { if (!this.spillDone) this.ensureSpills(); const x = sh.sv.get(key(r, c)); return x === undefined ? null : x; } if (!cell.f) return cell.v == null ? null : cell.v;
      const k = key(r, c), ch = sh.cache.get(k); if (ch !== undefined) return ch;
      if (cell.busy) return ERR.CIRC; cell.busy = true;
      try {
        if (!cell.ast) { try { cell.ast = parse(cell.f.slice(1), r, sh); } catch (e) { cell.ast = { k: "err", v: "#NAME?" }; } }
        let v;
        if (this.depth > 250) { v = this.deep(sh, r, c, cell); } else { this.depth++; try { v = ev(cell.ast, { wb: this, sh, r, c }); } finally { this.depth--; } }
        if (v instanceof Rng || Array.isArray(v)) { const dy = this.isDyn(cell, r, sh) ? asGrid(v) : null; if (dy && (dy.length > 1 || dy[0].length > 1)) v = this.spill(sh, r, c, dy); }
        if (v instanceof Rng) v = v.first(); if (Array.isArray(v)) v = v.length ? (Array.isArray(v[0]) ? v[0][0] : v[0]) : null; if (v === undefined) v = null;
        sh.cache.set(k, v); return v;
      } finally { cell.busy = false; }
    }
    /* very long chains (for example a running total down 5000 rows): work out the precedents first, in order, so the stack stays shallow */
    deep(sh, r, c, cell) {
      const order = [], seen = new Set(), stack = [[sh, r, c, cell, false]];
      while (stack.length) {
        const [s2, r2, c2, cl, done] = stack.pop(); const kk = s2.name + "|" + key(r2, c2); if (done) { order.push([s2, r2, c2]); continue; } if (seen.has(kk)) continue; seen.add(kk); stack.push([s2, r2, c2, cl, true]);
        if (!cl.ast) { try { cl.ast = parse(cl.f.slice(1), r2, s2); } catch (e) { cl.ast = { k: "err", v: "#NAME?" }; } }
        precedents(cl.ast, s2, this, (ps, a1, b1, a2, b2) => { const n = (a2 - a1 + 1) * (b2 - b1 + 1); if (n > ps.m.size) { ps.m.forEach((x, k2) => { const [rr, cc] = unkey(k2); if (rr >= a1 && rr <= a2 && cc >= b1 && cc <= b2 && x.f && !ps.cache.has(k2)) stack.push([ps, rr, cc, x, false]); }); } else for (let i = a1; i <= a2; i++) for (let j = b1; j <= b2; j++) { const x = ps.get(i, j); if (x && x.f && !ps.cache.has(key(i, j))) stack.push([ps, i, j, x, false]); } });
      }
      const save = this.depth; this.depth = 0; try { for (const [s2, r2, c2] of order) { if (!(s2 === sh && r2 === r && c2 === c)) { const x = s2.get(r2, c2); if (x && !x.busy) this.value(s2, r2, c2); } } return ev(cell.ast, { wb: this, sh, r, c }); } finally { this.depth = save; }
    }
    text(sh, r, c) { const cell = sh.get(r, c); const v = this.value(sh, r, c); const nf = this.numFmt(cell, v); return Fmt.format(v, nf); }
    numFmt(cell, v) { if (!cell) return "General"; if (cell.nf) return cell.nf; const st = this.style(cell.s); return st.nf || "General"; }
  }
  function precedents(ast, sh, wb, add) {
    const walk = (n) => {
      if (!n) return; switch (n.k) {
        case "ref": { const s2 = n.sheet ? wb.sheet(n.sheet) : sh; if (s2) add(s2, n.r, n.c, n.r, n.c); break; }
        case "range": { const s2 = n.sheet ? wb.sheet(n.sheet) : sh; if (s2) add(s2, n.r1, n.c1, n.r2, n.c2); break; }
        case "bin": walk(n.a); walk(n.b); break; case "un": case "pct": case "paren": walk(n.a); break; case "fn": n.args.forEach(walk); break; case "arr": n.rows.forEach((r) => r.forEach(walk)); break;
      }
    };
    walk(ast);
  }
  /* a lazy range */
  class Rng {
    constructor(wb, sh, r1, c1, r2, c2) { this.wb = wb; this.sh = sh; this.r1 = r1; this.c1 = c1; this.r2 = Math.min(r2, MAXR); this.c2 = Math.min(c2, MAXC); }
    get rows() { return this.r2 - this.r1 + 1; } get cols() { return this.c2 - this.c1 + 1; }
    at(i, j) { return this.wb.value(this.sh, this.r1 + i, this.c1 + j); }
    first() { return this.at(0, 0); }
    /* iterate only cells that exist (fast for whole-column ranges); cb(value, r, c) */
    each(cb, all) {
      const area = this.rows * this.cols;
      if (!all && area > this.sh.m.size * 2) { const keys = [...this.sh.m.keys()].sort((a, b) => a - b); for (const k of keys) { const [r, c] = unkey(k); if (r >= this.r1 && r <= this.r2 && c >= this.c1 && c <= this.c2) { const v = this.wb.value(this.sh, r, c); if (v !== null || all) cb(v, r, c); } } }
      else for (let i = this.r1; i <= this.r2; i++) for (let j = this.c1; j <= this.c2; j++) { const v = this.wb.value(this.sh, i, j); if (v !== null || all) cb(v, i, j); }
    }
    grid() { const g = []; const rr = Math.min(this.rows, 100000); for (let i = 0; i < rr; i++) { const row = []; for (let j = 0; j < this.cols; j++) row.push(this.at(i, j)); g.push(row); } return g; }
    flat() { const o = []; this.each((v) => o.push(v)); return o; }
  }

  /* ---------- evaluation helpers ---------- */
  const toNum = (v) => { if (isE(v)) return v; if (v == null || v === "") return 0; if (typeof v === "number") return v; if (typeof v === "boolean") return v ? 1 : 0; const s = String(v).trim(); if (s === "") return ERR.VALUE; const x = Number(s.replace(/,/g, "")); if (!isNaN(x) && /^[-+]?[\d.,]*\d?(e[-+]?\d+)?%?$/i.test(s.replace(/%$/, ""))) return /%$/.test(s) ? Number(s.slice(0, -1).replace(/,/g, "")) / 100 : x; const d = parseDate(s); if (d != null) return d; return ERR.VALUE; };
  const toStr = (v) => { if (isE(v)) return v; if (v == null) return ""; if (typeof v === "boolean") return v ? "TRUE" : "FALSE"; if (typeof v === "number") return Fmt.general(v); return String(v); };
  const toBool = (v) => { if (isE(v)) return v; if (typeof v === "boolean") return v; if (v == null || v === "") return false; if (typeof v === "number") return v !== 0; const s = String(v).toUpperCase(); if (s === "TRUE") return true; if (s === "FALSE") return false; return ERR.VALUE; };
  const scalar = (v) => { if (v instanceof Rng) return v.first(); if (Array.isArray(v)) return Array.isArray(v[0]) ? v[0][0] : v[0]; return v; };
  function parseDate(s) {
    let m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/.exec(s); if (m) { let y = +m[3]; if (y < 100) y += y < 50 ? 2000 : 1900; const d = +m[1], mo = +m[2]; if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return dser(y, mo, d); }
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s); if (m) return dser(+m[1], +m[2], +m[3]) + (m[4] ? (+m[4] * 3600 + +m[5] * 60 + +(m[6] || 0)) / 86400 : 0);
    m = /^(\d{1,2})[- ]([A-Za-z]{3,9})[- ,]+(\d{2,4})$/.exec(s); if (m) { const mi = MON.findIndex((x) => x.toLowerCase().startsWith(m[2].toLowerCase().slice(0, 3))); if (mi >= 0) { let y = +m[3]; if (y < 100) y += y < 50 ? 2000 : 1900; return dser(y, mi + 1, +m[1]); } }
    m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(s); if (m) { let h = +m[1]; if (m[4]) { h = h % 12 + (/pm/i.test(m[4]) ? 12 : 0); } return (h * 3600 + +m[2] * 60 + +(m[3] || 0)) / 86400; }
    return null;
  }
  const cmp = (a, b) => {
    // Excel ordering: numbers < text < booleans; text compare is case-insensitive
    const t = (v) => (typeof v === "number" ? 0 : typeof v === "string" ? 1 : typeof v === "boolean" ? 2 : -1);
    if (a == null) a = typeof b === "string" ? "" : typeof b === "boolean" ? false : 0; if (b == null) b = typeof a === "string" ? "" : typeof a === "boolean" ? false : 0;
    const ta = t(a), tb = t(b); if (ta !== tb) return ta < tb ? -1 : 1; if (ta === 1) { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; } return a < b ? -1 : a > b ? 1 : 0;
  };
  /* array helpers: broadcasting, spill detection */
  const isArr = (v) => (v instanceof Rng && (v.rows > 1 || v.cols > 1)) || (Array.isArray(v) && (v.length > 1 || (v[0] && v[0].length > 1)));
  const trimR = (v) => { if (v.r2 - v.r1 < 3000) return v; const d = v.sh.dims(); return new Rng(v.wb, v.sh, v.r1, v.c1, Math.max(v.r1, Math.min(v.r2, d[0])), Math.min(v.c2, Math.max(v.c1, d[1]))); };
  const asGrid = (v) => (v instanceof Rng ? trimR(v).grid() : Array.isArray(v) ? (Array.isArray(v[0]) ? v : [v]) : null);
  const gridOf = (v) => (v instanceof Rng ? trimR(v).grid() : Array.isArray(v) ? (Array.isArray(v[0]) ? v : [v]) : [[v]]);
  function bc(vals, fn) {
    const gs = vals.map(gridOf), R = Math.max(...gs.map((g) => g.length)), W = Math.max(...gs.map((g) => g[0].length)), out = [];
    for (let i = 0; i < R; i++) { const row = []; for (let j = 0; j < W; j++) { let bad = false; const xs = gs.map((g) => { const ri = g.length === 1 ? 0 : i, ci = g[0].length === 1 ? 0 : j; if (ri >= g.length || ci >= g[0].length) { bad = true; return null; } return g[ri][ci]; }); row.push(bad ? ERR.NA : fn(xs)); } out.push(row); }
    return out;
  }
  const ARRFN = new Set("TRANSPOSE XLOOKUP INDEX OFFSET INDIRECT CHOOSE ARRAYFORMULA".split(" ")), LIFT = new Set("IF IFERROR IFNA ABS SQRT EXP LN LOG10 SIN COS TAN INT SIGN ROUND ROUNDUP ROUNDDOWN TRUNC MOD POWER CEILING FLOOR LEN UPPER LOWER PROPER TRIM LEFT RIGHT MID SUBSTITUTE VALUE TEXT ISNUMBER ISTEXT ISBLANK ISERROR ISNA ISEVEN ISODD NOT YEAR MONTH DAY WEEKDAY DATEVALUE CODE CHAR REPT FIND SEARCH EXACT N DATE HOUR MINUTE SECOND EDATE EOMONTH".split(" "));
  let arrReC = null, arrReN = -1; function arrRe() { if (arrReN !== ARRFN.size) { arrReN = ARRFN.size; arrReC = new RegExp("(^|[^A-Z0-9_.])(" + [...ARRFN].map((x) => x.replace(/\./g, "\\.")).join("|") + ")\\(", "i"); } return arrReC; }
  function mayArr(n) {
    if (!n) return false; switch (n.k) {
      case "range": return n.r2 > n.r1 || n.c2 > n.c1; case "arr": return n.rows.length > 1 || (n.rows[0] && n.rows[0].length > 1);
      case "bin": return mayArr(n.a) || mayArr(n.b); case "un": case "pct": case "paren": return mayArr(n.a);
      case "fn": { const nm = n.name.replace(/^_XLFN\./, ""); if (ARRFN.has(nm)) return true; if (LIFT.has(nm)) return n.args.some(mayArr); return false; }
    } return false;
  }
  function ev(n, ctx) {
    switch (n.k) {
      case "num": return n.v; case "str": return n.v; case "bool": return n.v; case "empty": return null;
      case "err": return Object.values(ERR).find((e) => e.code === n.v) || ERR.VALUE;
      case "paren": return ev(n.a, ctx);
      case "val": return n.v;
      case "ref": { const sh = n.sheet ? ctx.wb.sheet(n.sheet) : ctx.sh; if (!sh) return ERR.REF; if (n.r < 1 || n.c < 1) return ERR.REF; return new Rng(ctx.wb, sh, n.r, n.c, n.r, n.c); }
      case "range": { const sh = n.sheet ? ctx.wb.sheet(n.sheet) : ctx.sh; if (!sh) return ERR.REF; return new Rng(ctx.wb, sh, n.r1, n.c1, n.r2, n.c2); }
      case "name": { if (ctx.locals) { const lv = ctx.locals[n.name.toLowerCase()]; if (lv !== undefined) return lv; } const nm = ctx.wb.names[n.name.toLowerCase()] || ctx.wb.names[n.name]; if (!nm) return ERR.NAME; try { return ev(parse(nm.replace(/^=/, "")), ctx); } catch (e) { return ERR.NAME; } }
      case "arr": return n.rows.map((r) => r.map((x) => scalar(ev(x, ctx))));
      case "un": { const a = ev(n.a, ctx); if (isArr(a)) return bc([a], (x) => { const v = toNum(x[0]); return isE(v) ? v : -v; }); const v = toNum(scalar(a)); return isE(v) ? v : -v; }
      case "pct": { const a = ev(n.a, ctx); if (isArr(a)) return bc([a], (x) => { const v = toNum(x[0]); return isE(v) ? v : v / 100; }); const v = toNum(scalar(a)); return isE(v) ? v : v / 100; }
      case "bin": return binop(n, ctx);
      case "fn": return call(n, ctx);
    }
    return ERR.VALUE;
  }
  function binop(n, ctx) {
    const av = ev(n.a, ctx), bv = ev(n.b, ctx);
    if (isArr(av) || isArr(bv)) return bc([av, bv], (x) => binS(n.op, x[0], x[1]));
    return binS(n.op, scalar(av), scalar(bv));
  }
  function binS(op, a, b) {
    if (isE(a)) return a; if (isE(b)) return b;
    if (op === "&") return toStr(a) + toStr(b);
    if (op === "=" || op === "<>" || op === "<" || op === ">" || op === "<=" || op === ">=") { const c = cmp(a, b); return op === "=" ? c === 0 : op === "<>" ? c !== 0 : op === "<" ? c < 0 : op === ">" ? c > 0 : op === "<=" ? c <= 0 : c >= 0; }
    const x = toNum(a), y = toNum(b); if (isE(x)) return x; if (isE(y)) return y;
    switch (op) { case "+": return x + y; case "-": return x - y; case "*": return x * y; case "/": return y === 0 ? ERR.DIV0 : x / y; case "^": { const r = Math.pow(x, y); return isNaN(r) ? ERR.NUM : r; } }
    return ERR.VALUE;
  }
  /* arguments: ranges are kept lazy; scalars are collapsed */
  function nums(args, ctx, o) {
    // collect numbers like SUM: numbers in ranges (text ignored), direct text args converted
    o = o || {}; const out = []; let err = null;
    for (const a of args) {
      const v = ev(a, ctx);
      if (v instanceof Rng) { v.each((x) => { if (isE(x)) { if (!err) err = x; } else if (typeof x === "number") out.push(x); else if (o.bool && typeof x === "boolean") out.push(x ? 1 : 0); }); }
      else if (Array.isArray(v)) v.flat().forEach((x) => { if (isE(x)) { if (!err) err = x; } else if (typeof x === "number") out.push(x); });
      else { if (isE(v)) { if (!err) err = v; continue; } if (v == null && a.k === "empty") { out.push(0); continue; } const x = toNum(v); if (isE(x)) { if (!err) err = x; } else out.push(x); }
    }
    return err ? err : out;
  }
  const arr2 = (v) => (v instanceof Rng ? v.grid() : Array.isArray(v) ? v : [[v]]);
  function crit(c) {
    if (c instanceof Rng) c = c.first(); if (typeof c === "number" || typeof c === "boolean") return (v) => (typeof v === typeof c && v === c) || (typeof c === "number" && typeof v === "string" && toNum(v) === c);
    c = toStr(c); const m = /^(<=|>=|<>|<|>|=)?(.*)$/s.exec(c); const op = m[1] || "=", rest = m[2];
    const numv = rest !== "" && !isNaN(Number(rest)) ? Number(rest) : null;
    if (/[*?~]/.test(rest) && (op === "=" || op === "<>")) { const re = new RegExp("^" + rest.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/~?\*/g, (x) => (x[0] === "~" ? "\\*" : ".*")).replace(/~?\?/g, (x) => (x[0] === "~" ? "\\?" : ".")) + "$", "i"); return (v) => (typeof v === "string" || typeof v === "number") && (op === "=") === re.test(String(v)); }
    return (v) => {
      if (numv != null) { if (typeof v !== "number") { if (op === "<>") return true; return false; } return op === "=" ? v === numv : op === "<>" ? v !== numv : op === "<" ? v < numv : op === ">" ? v > numv : op === "<=" ? v <= numv : v >= numv; }
      if (rest === "" && op === "=") return v == null || v === ""; if (rest === "" && op === "<>") return !(v == null || v === "");
      const sv = v == null ? "" : String(typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : v).toLowerCase(), t = rest.toLowerCase(); if (typeof v === "number" && op !== "=" && op !== "<>") return false;
      return op === "=" ? sv === t : op === "<>" ? sv !== t : op === "<" ? sv < t : op === ">" ? sv > t : op === "<=" ? sv <= t : sv >= t;
    };
  }
  function ifs(args, ctx, from) {
    // args pairs (range, criteria) from index `from`; returns list of [i,j] matches over the first range shape
    const pairs = []; for (let i = from; i < args.length; i += 2) { const r = ev(args[i], ctx), c = scalar(ev(args[i + 1], ctx)); if (!(r instanceof Rng)) return ERR.VALUE; if (isE(c)) return c; pairs.push([r, crit(c)]); }
    const shape = pairs[0][0]; for (const p of pairs) if (p[0].rows !== shape.rows || p[0].cols !== shape.cols) return ERR.VALUE;
    const hits = []; for (let i = 0; i < shape.rows; i++) for (let j = 0; j < shape.cols; j++) { if (pairs.every(([r, f]) => f(r.at(i, j)))) hits.push([i, j]); }
    return hits;
  }
  const F = {};
  const def = (names, fn) => names.split(" ").forEach((n) => (F[n] = fn));
  const sc = (a, ctx) => scalar(ev(a, ctx));
  const N = (a, ctx) => toNum(sc(a, ctx));
  def("SUM", (a, c) => { const x = nums(a, c); return isE(x) ? x : x.reduce((s, v) => s + v, 0); });
  def("PRODUCT", (a, c) => { const x = nums(a, c); return isE(x) ? x : x.length ? x.reduce((s, v) => s * v, 1) : 0; });
  def("AVERAGE", (a, c) => { const x = nums(a, c); return isE(x) ? x : x.length ? x.reduce((s, v) => s + v, 0) / x.length : ERR.DIV0; });
  def("MIN", (a, c) => { const x = nums(a, c); return isE(x) ? x : x.length ? Math.min(...x) : 0; });
  def("MAX", (a, c) => { const x = nums(a, c); return isE(x) ? x : x.length ? Math.max(...x) : 0; });
  def("COUNT", (a, c) => { let n = 0; a.forEach((x) => { const v = ev(x, c); if (v instanceof Rng) v.each((y) => { if (typeof y === "number") n++; }); else if (Array.isArray(v)) v.flat().forEach((y) => { if (typeof y === "number") n++; }); else if (!isE(toNum(v)) && v != null) n++; }); return n; });
  def("COUNTA", (a, c) => { let n = 0; a.forEach((x) => { const v = ev(x, c); if (v instanceof Rng) v.each((y) => { if (y !== "" ) n++; }); else n++; }); return n; });
  def("COUNTBLANK", (a, c) => { const r = ev(a[0], c); if (!(r instanceof Rng)) return 0; let n = 0, tot = r.rows * r.cols, f = 0; r.each((v) => { if (v !== "") f++; }); return tot - f; });
  def("SUMSQ", (a, c) => { const x = nums(a, c); return isE(x) ? x : x.reduce((s, v) => s + v * v, 0); });
  def("MEDIAN", (a, c) => { const x = nums(a, c); if (isE(x)) return x; if (!x.length) return ERR.NUM; x.sort((p, q) => p - q); const m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; });
  def("MODE MODE.SNGL", (a, c) => { const x = nums(a, c); if (isE(x)) return x; const cnt = new Map(); let best = null, bc = 1; x.forEach((v) => { const n = (cnt.get(v) || 0) + 1; cnt.set(v, n); if (n > bc) { bc = n; best = v; } }); return best == null ? ERR.NA : best; });
  const variance = (x, pop) => { if (x.length - (pop ? 0 : 1) <= 0) return ERR.DIV0; const m = x.reduce((s, v) => s + v, 0) / x.length; return x.reduce((s, v) => s + (v - m) * (v - m), 0) / (x.length - (pop ? 0 : 1)); };
  def("VAR VAR.S", (a, c) => { const x = nums(a, c); return isE(x) ? x : variance(x, false); }); def("VARP VAR.P", (a, c) => { const x = nums(a, c); return isE(x) ? x : variance(x, true); });
  def("STDEV STDEV.S", (a, c) => { const x = nums(a, c); if (isE(x)) return x; const v = variance(x, false); return isE(v) ? v : Math.sqrt(v); }); def("STDEVP STDEV.P", (a, c) => { const x = nums(a, c); if (isE(x)) return x; const v = variance(x, true); return isE(v) ? v : Math.sqrt(v); });
  def("LARGE", (a, c) => { const x = nums([a[0]], c), k = N(a[1], c); if (isE(x)) return x; if (isE(k)) return k; x.sort((p, q) => q - p); return k >= 1 && k <= x.length ? x[Math.floor(k) - 1] : ERR.NUM; });
  def("SMALL", (a, c) => { const x = nums([a[0]], c), k = N(a[1], c); if (isE(x)) return x; if (isE(k)) return k; x.sort((p, q) => p - q); return k >= 1 && k <= x.length ? x[Math.floor(k) - 1] : ERR.NUM; });
  def("RANK RANK.EQ", (a, c) => { const v = N(a[0], c), x = nums([a[1]], c), asc = a[2] ? N(a[2], c) : 0; if (isE(x) || isE(v)) return isE(v) ? v : x; if (!x.includes(v)) return ERR.NA; return 1 + x.filter((y) => (asc ? y < v : y > v)).length; });
  const pctl = (x, p) => { x.sort((a, b) => a - b); if (!x.length || p < 0 || p > 1) return ERR.NUM; const k = (x.length - 1) * p, f = Math.floor(k), cc = Math.ceil(k); return x[f] + (x[cc] - x[f]) * (k - f); };
  def("PERCENTILE PERCENTILE.INC", (a, c) => { const x = nums([a[0]], c), p = N(a[1], c); return isE(x) ? x : isE(p) ? p : pctl(x, p); }); def("QUARTILE QUARTILE.INC", (a, c) => { const x = nums([a[0]], c), q = N(a[1], c); return isE(x) ? x : isE(q) ? q : pctl(x, q / 4); });
  const pairs = (a, c) => { const X = ev(a[0], c), Y = ev(a[1], c); const xs = [], ys = []; const gx = arr2(X).flat(), gy = arr2(Y).flat(); if (gx.length !== gy.length) return ERR.NA; gx.forEach((v, i) => { if (typeof v === "number" && typeof gy[i] === "number") { xs.push(v); ys.push(gy[i]); } }); return [ys, xs]; };
  const stats = (ys, xs) => { const n = xs.length, mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; } return { n, mx, my, sxy, sxx, syy }; };
  def("CORREL PEARSON", (a, c) => { const p = pairs(a, c); if (isE(p)) return p; const s = stats(...p); return s.n < 2 || !s.sxx || !s.syy ? ERR.DIV0 : s.sxy / Math.sqrt(s.sxx * s.syy); });
  def("SLOPE", (a, c) => { const p = pairs(a, c); if (isE(p)) return p; const s = stats(...p); return s.sxx ? s.sxy / s.sxx : ERR.DIV0; });
  def("INTERCEPT", (a, c) => { const p = pairs(a, c); if (isE(p)) return p; const s = stats(...p); return s.sxx ? s.my - (s.sxy / s.sxx) * s.mx : ERR.DIV0; });
  def("RSQ", (a, c) => { const p = pairs(a, c); if (isE(p)) return p; const s = stats(...p); return s.sxx && s.syy ? (s.sxy * s.sxy) / (s.sxx * s.syy) : ERR.DIV0; });
  def("FORECAST FORECAST.LINEAR", (a, c) => { const x0 = N(a[0], c), p = pairs(a.slice(1), c); if (isE(p) || isE(x0)) return isE(x0) ? x0 : p; const s = stats(...p); if (!s.sxx) return ERR.DIV0; const m = s.sxy / s.sxx; return s.my - m * s.mx + m * x0; });
  def("SUMIF", (a, c) => { const r = ev(a[0], c), f = crit(sc(a[1], c)), sr = a[2] ? ev(a[2], c) : r; if (!(r instanceof Rng)) return ERR.VALUE; let t = 0; for (let i = 0; i < r.rows; i++) for (let j = 0; j < r.cols; j++) { if (f(r.at(i, j))) { const v = sr instanceof Rng ? sr.at(i, j) : sr; if (typeof v === "number") t += v; else if (isE(v)) return v; } } return t; });
  def("COUNTIF", (a, c) => { const r = ev(a[0], c), f = crit(sc(a[1], c)); if (!(r instanceof Rng)) return f(r) ? 1 : 0; let n = 0; r.each((v) => { if (f(v)) n++; }, f(null)); return n; });
  def("AVERAGEIF", (a, c) => { const r = ev(a[0], c), f = crit(sc(a[1], c)), sr = a[2] ? ev(a[2], c) : r; let t = 0, n = 0; for (let i = 0; i < r.rows; i++) for (let j = 0; j < r.cols; j++) { if (f(r.at(i, j))) { const v = sr.at(i, j); if (typeof v === "number") { t += v; n++; } } } return n ? t / n : ERR.DIV0; });
  def("SUMIFS", (a, c) => { const sr = ev(a[0], c), h = ifs(a, c, 1); if (isE(h)) return h; let t = 0; h.forEach(([i, j]) => { const v = sr.at(i, j); if (typeof v === "number") t += v; }); return t; });
  def("COUNTIFS", (a, c) => { const h = ifs(a, c, 0); return isE(h) ? h : h.length; });
  def("AVERAGEIFS", (a, c) => { const sr = ev(a[0], c), h = ifs(a, c, 1); if (isE(h)) return h; let t = 0, n = 0; h.forEach(([i, j]) => { const v = sr.at(i, j); if (typeof v === "number") { t += v; n++; } }); return n ? t / n : ERR.DIV0; });
  def("MAXIFS", (a, c) => { const sr = ev(a[0], c), h = ifs(a, c, 1); if (isE(h)) return h; const x = h.map(([i, j]) => sr.at(i, j)).filter((v) => typeof v === "number"); return x.length ? Math.max(...x) : 0; });
  def("MINIFS", (a, c) => { const sr = ev(a[0], c), h = ifs(a, c, 1); if (isE(h)) return h; const x = h.map(([i, j]) => sr.at(i, j)).filter((v) => typeof v === "number"); return x.length ? Math.min(...x) : 0; });
  def("SUMPRODUCT", (a, c) => { const gs = a.map((x) => arr2(ev(x, c))); const R = gs[0].length, C = gs[0][0].length; let t = 0; for (const g of gs) if (g.length !== R || g[0].length !== C) return ERR.VALUE; for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) { let p = 1; for (const g of gs) { const v = g[i][j]; if (isE(v)) return v; p *= typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : 0; } t += p; } return t; });
  const m1 = (fn) => (a, c) => { const v = N(a[0], c); if (isE(v)) return v; const r = fn(v); return typeof r === "number" && !isFinite(r) ? ERR.NUM : r; };
  def("ABS", m1(Math.abs)); def("SQRT", m1((v) => (v < 0 ? ERR.NUM : Math.sqrt(v)))); def("EXP", m1(Math.exp)); def("LN", m1((v) => (v <= 0 ? ERR.NUM : Math.log(v)))); def("LOG10", m1((v) => (v <= 0 ? ERR.NUM : Math.log10(v)))); def("SIN", m1(Math.sin)); def("COS", m1(Math.cos)); def("TAN", m1(Math.tan)); def("ASIN", m1((v) => (Math.abs(v) > 1 ? ERR.NUM : Math.asin(v)))); def("ACOS", m1((v) => (Math.abs(v) > 1 ? ERR.NUM : Math.acos(v)))); def("ATAN", m1(Math.atan)); def("SINH", m1(Math.sinh)); def("COSH", m1(Math.cosh)); def("TANH", m1(Math.tanh));
  def("DEGREES", m1((v) => (v * 180) / Math.PI)); def("RADIANS", m1((v) => (v * Math.PI) / 180)); def("INT", m1(Math.floor)); def("SIGN", m1(Math.sign)); def("FACT", m1((v) => { if (v < 0 || v > 170) return ERR.NUM; let r = 1; for (let i = 2; i <= Math.floor(v); i++) r *= i; return r; }));
  def("EVEN", m1((v) => { const s = Math.sign(v) || 1, x = Math.ceil(Math.abs(v)); return s * (x % 2 ? x + 1 : x); })); def("ODD", m1((v) => { const s = Math.sign(v) || 1, x = Math.ceil(Math.abs(v)); return s * (x % 2 ? x : x + 1); }));
  def("PI", () => Math.PI); def("RAND", (a, c) => Math.random()); def("RANDBETWEEN", (a, c) => { const lo = N(a[0], c), hi = N(a[1], c); return isE(lo) ? lo : isE(hi) ? hi : Math.floor(Math.random() * (hi - lo + 1)) + lo; });
  def("LOG", (a, c) => { const v = N(a[0], c), b = a[1] ? N(a[1], c) : 10; return isE(v) ? v : v <= 0 || b <= 0 || b === 1 ? ERR.NUM : Math.log(v) / Math.log(b); });
  def("ATAN2", (a, c) => { const x = N(a[0], c), y = N(a[1], c); return isE(x) ? x : isE(y) ? y : Math.atan2(y, x); });
  def("POWER", (a, c) => binop({ op: "^", a: a[0], b: a[1] }, c));
  def("MOD", (a, c) => { const x = N(a[0], c), y = N(a[1], c); if (isE(x)) return x; if (isE(y)) return y; return y === 0 ? ERR.DIV0 : x - y * Math.floor(x / y); });
  def("QUOTIENT", (a, c) => { const x = N(a[0], c), y = N(a[1], c); return isE(x) ? x : isE(y) ? y : y === 0 ? ERR.DIV0 : Math.trunc(x / y); });
  const rnd = (mode) => (a, c) => { const v = N(a[0], c), d = a[1] ? N(a[1], c) : 0; if (isE(v)) return v; if (isE(d)) return d; const f = Math.pow(10, Math.trunc(d)); const x = v * f; const e = 1e-9 * Math.abs(x); let r; if (mode === 0) r = Math.sign(x) * Math.round(Math.abs(x) + e); else if (mode === 1) r = Math.sign(x) * Math.ceil(Math.abs(x) - e); else r = Math.sign(x) * Math.floor(Math.abs(x) + e); return r / f; };
  def("ROUND", rnd(0)); def("ROUNDUP", rnd(1)); def("ROUNDDOWN TRUNC", rnd(2));
  def("CEILING CEILING.MATH", (a, c) => { const v = N(a[0], c), s = a[1] ? N(a[1], c) : 1; return isE(v) ? v : isE(s) ? s : s === 0 ? 0 : Math.ceil(v / s - 1e-12) * s; }); def("FLOOR FLOOR.MATH", (a, c) => { const v = N(a[0], c), s = a[1] ? N(a[1], c) : 1; return isE(v) ? v : isE(s) ? s : s === 0 ? ERR.DIV0 : Math.floor(v / s + 1e-12) * s; });
  def("MROUND", (a, c) => { const v = N(a[0], c), s = N(a[1], c); return isE(v) ? v : isE(s) ? s : s === 0 ? 0 : Math.round(v / s) * s; });
  def("GCD", (a, c) => { const x = nums(a, c); if (isE(x)) return x; const g = (p, q) => (q ? g(q, p % q) : p); return x.reduce((s, v) => g(s, Math.abs(Math.trunc(v))), 0); }); def("LCM", (a, c) => { const x = nums(a, c); if (isE(x)) return x; const g = (p, q) => (q ? g(q, p % q) : p); return x.reduce((s, v) => (s * Math.abs(v)) / g(s, Math.abs(v)) || 0, 1); });
  /* logic */
  def("IF", (a, c) => { const t = toBool(sc(a[0], c)); if (isE(t)) return t; return t ? (a[1] ? ev(a[1], c) : true) : a[2] ? ev(a[2], c) : false; });
  def("IFS", (a, c) => { for (let i = 0; i + 1 < a.length; i += 2) { const t = toBool(sc(a[i], c)); if (isE(t)) return t; if (t) return ev(a[i + 1], c); } return ERR.NA; });
  def("IFERROR", (a, c) => { const v = sc(a[0], c); return isE(v) ? ev(a[1], c) : v; }); def("IFNA", (a, c) => { const v = sc(a[0], c); return v === ERR.NA ? ev(a[1], c) : v; });
  def("AND", (a, c) => { let r = true, any = false; for (const x of a) { const v = ev(x, c); const list = v instanceof Rng ? v.flat() : Array.isArray(v) ? v.flat() : [v]; for (const y of list) { if (y == null || y === "") continue; const b = toBool(y); if (isE(b)) return b; any = true; if (!b) r = false; } } return any ? r : ERR.VALUE; });
  def("OR", (a, c) => { let r = false, any = false; for (const x of a) { const v = ev(x, c); const list = v instanceof Rng ? v.flat() : Array.isArray(v) ? v.flat() : [v]; for (const y of list) { if (y == null || y === "") continue; const b = toBool(y); if (isE(b)) return b; any = true; if (b) r = true; } } return any ? r : ERR.VALUE; });
  def("XOR", (a, c) => { let n = 0; for (const x of a) { const v = ev(x, c); const list = v instanceof Rng ? v.flat() : [v]; for (const y of list) { const b = toBool(y); if (isE(b)) return b; if (b) n++; } } return n % 2 === 1; });
  def("NOT", (a, c) => { const b = toBool(sc(a[0], c)); return isE(b) ? b : !b; }); def("TRUE", () => true); def("FALSE", () => false);
  def("SWITCH", (a, c) => { const v = sc(a[0], c); for (let i = 1; i + 1 < a.length; i += 2) { if (cmp(v, sc(a[i], c)) === 0) return ev(a[i + 1], c); } return a.length % 2 === 0 ? ev(a[a.length - 1], c) : ERR.NA; });
  def("CHOOSE", (a, c) => { const i = N(a[0], c); if (isE(i)) return i; return i >= 1 && i < a.length ? ev(a[Math.floor(i)], c) : ERR.VALUE; });
  /* info */
  def("ISNUMBER", (a, c) => typeof sc(a[0], c) === "number"); def("ISTEXT", (a, c) => typeof sc(a[0], c) === "string"); def("ISLOGICAL", (a, c) => typeof sc(a[0], c) === "boolean"); def("ISBLANK", (a, c) => { const v = ev(a[0], c); return (v instanceof Rng ? v.first() : v) == null; }); def("ISERROR", (a, c) => isE(sc(a[0], c))); def("ISERR", (a, c) => { const v = sc(a[0], c); return isE(v) && v !== ERR.NA; }); def("ISNA", (a, c) => sc(a[0], c) === ERR.NA); def("NA", () => ERR.NA);
  def("ISEVEN", (a, c) => { const v = N(a[0], c); return isE(v) ? v : Math.floor(Math.abs(v)) % 2 === 0; }); def("ISODD", (a, c) => { const v = N(a[0], c); return isE(v) ? v : Math.floor(Math.abs(v)) % 2 === 1; });
  def("N", (a, c) => { const v = sc(a[0], c); return typeof v === "number" ? v : typeof v === "boolean" ? +v : isE(v) ? v : 0; }); def("T", (a, c) => { const v = sc(a[0], c); return typeof v === "string" ? v : ""; });
  /* text */
  const S = (a, c) => toStr(sc(a, c));
  def("LEN", (a, c) => { const s = S(a[0], c); return isE(s) ? s : s.length; }); def("UPPER", (a, c) => { const s = S(a[0], c); return isE(s) ? s : s.toUpperCase(); }); def("LOWER", (a, c) => { const s = S(a[0], c); return isE(s) ? s : s.toLowerCase(); });
  def("PROPER", (a, c) => { const s = S(a[0], c); return isE(s) ? s : s.toLowerCase().replace(/(^|[^a-z0-9])([a-z])/g, (m, p, q) => p + q.toUpperCase()); }); def("TRIM", (a, c) => { const s = S(a[0], c); return isE(s) ? s : s.trim().replace(/ +/g, " "); }); def("CLEAN", (a, c) => { const s = S(a[0], c); return isE(s) ? s : s.replace(/[\u0000-\u001f]/g, ""); });
  def("LEFT", (a, c) => { const s = S(a[0], c), n = a[1] ? N(a[1], c) : 1; return isE(s) ? s : isE(n) ? n : n < 0 ? ERR.VALUE : s.slice(0, n); }); def("RIGHT", (a, c) => { const s = S(a[0], c), n = a[1] ? N(a[1], c) : 1; return isE(s) ? s : isE(n) ? n : n < 0 ? ERR.VALUE : n === 0 ? "" : s.slice(-n); });
  def("MID", (a, c) => { const s = S(a[0], c), st = N(a[1], c), n = N(a[2], c); return isE(s) ? s : isE(st) ? st : isE(n) ? n : st < 1 || n < 0 ? ERR.VALUE : s.substr(st - 1, n); });
  def("CONCAT CONCATENATE", (a, c) => { let o = ""; for (const x of a) { const v = ev(x, c); const l = v instanceof Rng ? v.flat() : Array.isArray(v) ? v.flat() : [v]; for (const y of l) { if (isE(y)) return y; o += toStr(y); } } return o; });
  def("TEXTJOIN", (a, c) => { const d = S(a[0], c), ig = toBool(sc(a[1], c)); const o = []; for (const x of a.slice(2)) { const v = ev(x, c); const l = v instanceof Rng ? v.flat() : Array.isArray(v) ? v.flat() : [v]; for (const y of l) { if (isE(y)) return y; const s = toStr(y); if (ig && s === "") continue; o.push(s); } } return o.join(d); });
  def("SUBSTITUTE", (a, c) => { const s = S(a[0], c), o = S(a[1], c), n = S(a[2], c); if (isE(s)) return s; if (o === "") return s; if (a[3]) { const k = N(a[3], c); let i = -1, cnt = 0, p = 0; while ((p = s.indexOf(o, p)) >= 0) { cnt++; if (cnt === k) { i = p; break; } p += o.length; } return i < 0 ? s : s.slice(0, i) + n + s.slice(i + o.length); } return s.split(o).join(n); });
  def("REPLACE", (a, c) => { const s = S(a[0], c), st = N(a[1], c), n = N(a[2], c), t = S(a[3], c); return isE(s) ? s : s.slice(0, st - 1) + t + s.slice(st - 1 + n); });
  def("FIND", (a, c) => { const f = S(a[0], c), s = S(a[1], c), st = a[2] ? N(a[2], c) : 1; const i = s.indexOf(f, st - 1); return i < 0 ? ERR.VALUE : i + 1; });
  def("SEARCH", (a, c) => { const f = S(a[0], c), s = S(a[1], c), st = a[2] ? N(a[2], c) : 1; const re = new RegExp(f.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/~?\*/g, (x) => (x[0] === "~" ? "\\*" : ".*")).replace(/~?\?/g, (x) => (x[0] === "~" ? "\\?" : ".")), "i"); const m = re.exec(s.slice(st - 1)); return m ? m.index + st : ERR.VALUE; });
  def("REPT", (a, c) => { const s = S(a[0], c), n = N(a[1], c); return isE(n) ? n : n < 0 ? ERR.VALUE : s.repeat(Math.min(n, 32767)); });
  def("EXACT", (a, c) => S(a[0], c) === S(a[1], c)); def("CHAR", (a, c) => { const n = N(a[0], c); return isE(n) ? n : String.fromCharCode(n); }); def("CODE", (a, c) => { const s = S(a[0], c); return isE(s) ? s : s.length ? s.charCodeAt(0) : ERR.VALUE; });
  def("VALUE", (a, c) => { const v = sc(a[0], c); const x = typeof v === "string" ? toNum(v.trim()) : toNum(v); return x; });
  def("NUMBERVALUE", (a, c) => { const s = S(a[0], c).replace(/\s/g, "").replace(/,/g, ""); const x = Number(s); return isNaN(x) ? ERR.VALUE : x; });
  def("TEXT", (a, c) => { const v = sc(a[0], c), f = S(a[1], c); if (isE(v)) return v; let n = v; if (typeof v === "string") { const x = toNum(v); if (!isE(x)) n = x; } return Fmt.format(n, f).text; });
  def("FIXED", (a, c) => { const v = N(a[0], c), d = a[1] ? N(a[1], c) : 2, nc = a[2] ? toBool(sc(a[2], c)) : false; if (isE(v)) return v; let s = v.toFixed(Math.max(0, d)); if (!nc) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ","); return s; });
  def("DOLLAR", (a, c) => { const v = N(a[0], c); return isE(v) ? v : "$" + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); });
  def("TEXTBEFORE", (a, c) => { const s = S(a[0], c), d = S(a[1], c), i = s.indexOf(d); return i < 0 ? ERR.NA : s.slice(0, i); }); def("TEXTAFTER", (a, c) => { const s = S(a[0], c), d = S(a[1], c), i = s.indexOf(d); return i < 0 ? ERR.NA : s.slice(i + d.length); });
  /* lookup */
  const eqv = (a, b) => cmp(a, b) === 0;
  def("VLOOKUP", (a, c) => {
    const v = sc(a[0], c), t = ev(a[1], c), ci = N(a[2], c), approx = a[3] ? toBool(sc(a[3], c)) : true; if (isE(v)) return v; if (!(t instanceof Rng)) return ERR.VALUE; if (isE(ci)) return ci; if (ci < 1 || ci > t.cols) return ERR.REF;
    let hit = -1; if (approx === false || approx === 0) { for (let i = 0; i < t.rows; i++) { const x = t.at(i, 0); if (x != null && eqv(typeof v === "string" && /[*?]/.test(v) ? v : v, x)) { hit = i; break; } if (typeof v === "string" && /[*?]/.test(v) && typeof x === "string" && crit("=" + v)(x)) { hit = i; break; } } }
    else { for (let i = 0; i < t.rows; i++) { const x = t.at(i, 0); if (x == null) continue; if (cmp(x, v) <= 0) hit = i; else break; } }
    return hit < 0 ? ERR.NA : t.at(hit, ci - 1);
  });
  def("HLOOKUP", (a, c) => {
    const v = sc(a[0], c), t = ev(a[1], c), ri = N(a[2], c), approx = a[3] ? toBool(sc(a[3], c)) : true; if (!(t instanceof Rng)) return ERR.VALUE; if (ri < 1 || ri > t.rows) return ERR.REF; let hit = -1;
    if (approx === false) { for (let j = 0; j < t.cols; j++) if (eqv(v, t.at(0, j))) { hit = j; break; } } else { for (let j = 0; j < t.cols; j++) { const x = t.at(0, j); if (x == null) continue; if (cmp(x, v) <= 0) hit = j; else break; } }
    return hit < 0 ? ERR.NA : t.at(ri - 1, hit);
  });
  const matchIdx = (v, r, type) => { const g = r instanceof Rng ? r.flat() : arr2(r).flat(); const lst = r instanceof Rng ? (() => { const o = []; for (let i = 0; i < r.rows; i++) for (let j = 0; j < r.cols; j++) o.push(r.at(i, j)); return o; })() : g; if (type === 0) { if (typeof v === "string" && /[*?]/.test(v)) { const f = crit("=" + v); for (let i = 0; i < lst.length; i++) if (typeof lst[i] === "string" && f(lst[i])) return i; return -1; } for (let i = 0; i < lst.length; i++) if (lst[i] != null && eqv(v, lst[i])) return i; return -1; } let h = -1; if (type > 0) { for (let i = 0; i < lst.length; i++) { if (lst[i] == null) continue; if (cmp(lst[i], v) <= 0) h = i; else break; } } else { for (let i = 0; i < lst.length; i++) { if (lst[i] == null) continue; if (cmp(lst[i], v) >= 0) h = i; else break; } } return h; };
  def("MATCH", (a, c) => { const v = sc(a[0], c), r = ev(a[1], c), t = a[2] ? N(a[2], c) : 1; if (isE(v)) return v; const i = matchIdx(v, r, t); return i < 0 ? ERR.NA : i + 1; });
  def("XMATCH", (a, c) => { const v = sc(a[0], c), r = ev(a[1], c), t = a[2] ? N(a[2], c) : 0; const i = matchIdx(v, r, t); return i < 0 ? ERR.NA : i + 1; });
  def("INDEX", (a, c) => { const r = ev(a[0], c), ri = a[1] ? N(a[1], c) : 0, ci = a[2] ? N(a[2], c) : 0; if (isE(ri)) return ri; if (isE(ci)) return ci; if (r instanceof Rng) { let i = ri, j = ci; if (r.rows === 1 && !a[2] && ri) { j = ri; i = 1; } else if (r.cols === 1 && !a[2]) { i = ri; j = 1; } if (!i && !j) return r; if (i > r.rows || j > r.cols || i < 0 || j < 0) return ERR.REF; if (!i) return new Rng(r.wb, r.sh, r.r1, r.c1 + j - 1, r.r2, r.c1 + j - 1); if (!j) return new Rng(r.wb, r.sh, r.r1 + i - 1, r.c1, r.r1 + i - 1, r.c2); return r.at(i - 1, j - 1); } const g = arr2(r); return (g[(ri || 1) - 1] || [])[(ci || 1) - 1] ?? ERR.REF; });
  def("XLOOKUP", (a, c) => { const v = sc(a[0], c), look = ev(a[1], c), ret = ev(a[2], c), mode = a[4] ? N(a[4], c) : 0; if (!(look instanceof Rng) || !(ret instanceof Rng)) return ERR.VALUE; let i = matchIdx(v, look, mode === 0 ? 0 : mode); if (mode === 2) i = matchIdx("=" + toStr(v), look, 0); if (i < 0) return a[3] ? ev(a[3], c) : ERR.NA; if (look.rows === 1) return ret.at(0, i); return ret.at(i, 0); });
  def("LOOKUP", (a, c) => { const v = sc(a[0], c), look = ev(a[1], c), res = a[2] ? ev(a[2], c) : look; const i = matchIdx(v, look, 1); if (i < 0) return ERR.NA; const lst = []; for (let x = 0; x < res.rows; x++) for (let y = 0; y < res.cols; y++) lst.push(res.at(x, y)); return lst[i]; });
  def("ROW", (a, c) => { if (!a.length) return c.r; const v = ev(a[0], c); return v instanceof Rng ? v.r1 : ERR.VALUE; }); def("COLUMN", (a, c) => { if (!a.length) return c.c; const v = ev(a[0], c); return v instanceof Rng ? v.c1 : ERR.VALUE; });
  def("ROWS", (a, c) => { const v = ev(a[0], c); return v instanceof Rng ? v.rows : arr2(v).length; }); def("COLUMNS", (a, c) => { const v = ev(a[0], c); return v instanceof Rng ? v.cols : arr2(v)[0].length; });
  def("OFFSET", (a, c) => { const r = ev(a[0], c), dr = N(a[1], c), dc = N(a[2], c); if (!(r instanceof Rng)) return ERR.VALUE; const h = a[3] ? N(a[3], c) : r.rows, w = a[4] ? N(a[4], c) : r.cols; const r1 = r.r1 + dr, c1 = r.c1 + dc; if (r1 < 1 || c1 < 1) return ERR.REF; return new Rng(r.wb, r.sh, r1, c1, r1 + h - 1, c1 + w - 1); });
  def("INDIRECT", (a, c) => { const s = S(a[0], c); try { const t = tokenize(s); const ast = parse(s); if (ast.k === "ref" || ast.k === "range") return ev(ast, c); } catch (e) { /* ignore */ } return ERR.REF; });
  def("ADDRESS", (a, c) => { const r = N(a[0], c), cc = N(a[1], c), ab = a[2] ? N(a[2], c) : 1; return (ab === 2 || ab === 4 ? "" : "$") + "" + nCol(cc).replace(/^/, ab === 3 || ab === 4 ? "" : "$") + (ab === 1 || ab === 2 ? "$" : "") + r; });
  def("TRANSPOSE", (a, c) => { const g = arr2(ev(a[0], c)); return g[0].map((_, j) => g.map((row) => row[j])); });
  /* dates */
  def("TODAY", () => Math.floor(toSerial(new Date()))); def("NOW", () => toSerial(new Date()));
  def("DATE", (a, c) => { let y = N(a[0], c), m = N(a[1], c), d = N(a[2], c); if (isE(y)) return y; if (isE(m)) return m; if (isE(d)) return d; if (y < 1900) y += 1900; return dser(y, 1, 1) + 0 && (Date.UTC(y, m - 1, d) - EPOCH) / 864e5; });
  def("YEAR", (a, c) => { const v = N(a[0], c); return isE(v) ? v : ymd(v)[0]; }); def("MONTH", (a, c) => { const v = N(a[0], c); return isE(v) ? v : ymd(v)[1]; }); def("DAY", (a, c) => { const v = N(a[0], c); return isE(v) ? v : ymd(v)[2]; });
  def("HOUR", (a, c) => { const v = N(a[0], c); return isE(v) ? v : Math.floor(((v % 1) + 1) % 1 * 24 + 1e-9); }); def("MINUTE", (a, c) => { const v = N(a[0], c); return isE(v) ? v : Math.floor((((v % 1) + 1) % 1 * 1440 + 1e-7) % 60); }); def("SECOND", (a, c) => { const v = N(a[0], c); return isE(v) ? v : Math.round((((v % 1) + 1) % 1 * 86400) % 60); });
  def("TIME", (a, c) => { const h = N(a[0], c), m = N(a[1], c), s = N(a[2], c); return (h * 3600 + m * 60 + s) / 86400 % 1; });
  def("WEEKDAY", (a, c) => { const v = N(a[0], c), t = a[1] ? N(a[1], c) : 1; if (isE(v)) return v; const d = new Date(Math.floor(v) * 864e5 + EPOCH).getUTCDay(); return t === 1 ? d + 1 : t === 2 ? ((d + 6) % 7) + 1 : (d + 6) % 7; });
  def("WEEKNUM", (a, c) => { const v = N(a[0], c); if (isE(v)) return v; const [y] = ymd(v), j1 = dser(y, 1, 1), wd = new Date(j1 * 864e5 + EPOCH).getUTCDay(); return Math.floor((Math.floor(v) - j1 + wd) / 7) + 1; });
  def("DATEVALUE", (a, c) => { const s = S(a[0], c); const d = parseDate(s); return d == null ? ERR.VALUE : Math.floor(d); }); def("TIMEVALUE", (a, c) => { const s = S(a[0], c); const d = parseDate(s); return d == null ? ERR.VALUE : d % 1; });
  def("EDATE", (a, c) => { const v = N(a[0], c), m = N(a[1], c); if (isE(v)) return v; const [y, mo, d] = ymd(v); const t = mo - 1 + m, yy = y + Math.floor(t / 12), mm = ((t % 12) + 12) % 12; const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate(); return dser(yy, mm + 1, Math.min(d, last)); });
  def("EOMONTH", (a, c) => { const v = N(a[0], c), m = N(a[1], c); if (isE(v)) return v; const [y, mo] = ymd(v); const t = mo - 1 + m, yy = y + Math.floor(t / 12), mm = ((t % 12) + 12) % 12; return dser(yy, mm + 2, 0); });
  def("DAYS", (a, c) => { const e = N(a[0], c), s = N(a[1], c); return isE(e) ? e : isE(s) ? s : Math.floor(e) - Math.floor(s); });
  def("DATEDIF", (a, c) => { const s = N(a[0], c), e = N(a[1], c), u = S(a[2], c).toUpperCase(); if (isE(s)) return s; if (isE(e)) return e; if (e < s) return ERR.NUM; const [y1, m1, d1] = ymd(s), [y2, m2, d2] = ymd(e); if (u === "D") return Math.floor(e) - Math.floor(s); let mo = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0); if (u === "M") return mo; if (u === "Y") return Math.floor(mo / 12); if (u === "YM") return mo % 12; if (u === "MD") { return d2 >= d1 ? d2 - d1 : new Date(Date.UTC(y2, m2 - 1, 0)).getUTCDate() - d1 + d2; } return ERR.NUM; });
  const hol = (a, c, i) => { const s = new Set(); if (a[i]) { const v = ev(a[i], c); (v instanceof Rng ? v.flat() : arr2(v).flat()).forEach((x) => typeof x === "number" && s.add(Math.floor(x))); } return s; };
  def("NETWORKDAYS", (a, c) => { let s = Math.floor(N(a[0], c)), e = Math.floor(N(a[1], c)); const h = hol(a, c, 2); let sg = 1; if (e < s) { [s, e] = [e, s]; sg = -1; } let n = 0; for (let d = s; d <= e; d++) { const w = new Date(d * 864e5 + EPOCH).getUTCDay(); if (w !== 0 && w !== 6 && !h.has(d)) n++; } return n * sg; });
  def("WORKDAY", (a, c) => { let d = Math.floor(N(a[0], c)); const n = N(a[1], c), h = hol(a, c, 2), st = n < 0 ? -1 : 1; let k = Math.abs(n); while (k > 0) { d += st; const w = new Date(d * 864e5 + EPOCH).getUTCDay(); if (w !== 0 && w !== 6 && !h.has(d)) k--; } return d; });
  /* finance */
  def("PMT", (a, c) => { const r = N(a[0], c), n = N(a[1], c), pv = N(a[2], c), fv = a[3] ? N(a[3], c) : 0, ty = a[4] ? N(a[4], c) : 0; if (r === 0) return -(pv + fv) / n; const p = Math.pow(1 + r, n); return (-(pv * p + fv) * r) / ((p - 1) * (1 + r * ty)); });
  def("FV", (a, c) => { const r = N(a[0], c), n = N(a[1], c), pm = N(a[2], c), pv = a[3] ? N(a[3], c) : 0, ty = a[4] ? N(a[4], c) : 0; if (r === 0) return -(pv + pm * n); const p = Math.pow(1 + r, n); return -(pv * p + pm * (1 + r * ty) * (p - 1) / r); });
  def("PV", (a, c) => { const r = N(a[0], c), n = N(a[1], c), pm = N(a[2], c), fv = a[3] ? N(a[3], c) : 0, ty = a[4] ? N(a[4], c) : 0; if (r === 0) return -(fv + pm * n); const p = Math.pow(1 + r, n); return -(fv + pm * (1 + r * ty) * (p - 1) / r) / p; });
  def("NPV", (a, c) => { const r = N(a[0], c); const x = nums(a.slice(1), c); return isE(x) ? x : x.reduce((s, v, i) => s + v / Math.pow(1 + r, i + 1), 0); });
  def("IRR", (a, c) => { const x = nums([a[0]], c); if (isE(x)) return x; const f = (r) => x.reduce((s, v, i) => s + v / Math.pow(1 + r, i), 0); let lo = -0.99, hi = 10; if (f(lo) * f(hi) > 0) return ERR.NUM; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (f(lo) * f(m) <= 0) hi = m; else lo = m; } return (lo + hi) / 2; });
  def("SQRTPI", m1((v) => Math.sqrt(v * Math.PI))); def("COMBIN", (a, c) => { const n = N(a[0], c), k = N(a[1], c); if (k > n || k < 0) return ERR.NUM; let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); }); def("PERMUT", (a, c) => { const n = N(a[0], c), k = N(a[1], c); let r = 1; for (let i = 0; i < k; i++) r *= n - i; return r; });
  def("NORM.S.DIST NORMSDIST", (a, c) => { const z = N(a[0], c), cum = a[1] ? toBool(sc(a[1], c)) : true; if (!cum) return Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI); const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; });
  def("NORM.DIST NORMDIST", (a, c) => { const x = N(a[0], c), m = N(a[1], c), s = N(a[2], c), cum = toBool(sc(a[3], c)); return F["NORM.S.DIST"]([{ k: "num", v: (x - m) / s }, { k: "bool", v: cum }], c) / (cum ? 1 : s); });
  def("COUNTUNIQUE", (a, c) => { const s = new Set(); a.forEach((x) => { const v = ev(x, c); (v instanceof Rng ? v.flat() : arr2(v).flat()).forEach((y) => s.add(typeof y + ":" + y)); }); return s.size; });
  def("SUBTOTAL", (a, c) => { const f = N(a[0], c) % 100; const m = { 1: "AVERAGE", 2: "COUNT", 3: "COUNTA", 4: "MAX", 5: "MIN", 6: "PRODUCT", 7: "STDEV", 8: "STDEVP", 9: "SUM", 10: "VAR", 11: "VARP" }[f]; return m ? F[m](a.slice(1), c) : ERR.VALUE; });
  def("AGGREGATE", (a, c) => F.SUBTOTAL(a.slice(0, 1).concat(a.slice(2)), c));
  def("ARRAYFORMULA", (a, c) => ev(a[0], c));
  def("ERROR.TYPE", (a, c) => { const v = sc(a[0], c); return isE(v) ? { "#NULL!": 1, "#DIV/0!": 2, "#VALUE!": 3, "#REF!": 4, "#NAME?": 5, "#NUM!": 6, "#N/A": 7 }[v.code] || ERR.NA : ERR.NA; });
  function call(n, ctx) {
    if (LIFT.has(n.name) && n.args.some((x) => mayArr(x))) { const vals = n.args.map((x) => ev(x, ctx)), f0 = F[n.name]; if (vals.some(isArr)) return bc(vals, (xs) => { try { return f0(xs.map((x) => ({ k: "val", v: x })), ctx); } catch (e) { return ERR.VALUE; } }); return f0(vals.map((x) => ({ k: "val", v: x })), ctx); }
    const f = F[n.name]; if (!f) { const u = F[n.name.replace(/^_XLFN\./, "")]; if (u) return u(n.args, ctx); return ERR.NAME; }
    try { return f(n.args, ctx); } catch (e) { if (e instanceof RangeError) throw e; return ERR.VALUE; }
  }
  /* ---------- user input -> value ---------- */
  function parseInput(text) {
    if (text == null) return { v: null }; const t = String(text);
    if (t === "") return { v: null }; if (t[0] === "=" && t.length > 1) return { f: t };
    if (t[0] === "'") return { v: t.slice(1) }; const s = t.trim();
    if (/^(TRUE|FALSE)$/i.test(s)) return { v: s.toUpperCase() === "TRUE" };
    let m = /^([-+]?)(₹|Rs\.?\s?|\$|€|£)?\s?([\d,]*\.?\d+(?:[eE][-+]?\d+)?)(%)?$/.exec(s);
    if (m && (m[3].indexOf(",") < 0 || /^\d{1,3}(,\d{2,3})*(\.\d+)?$/.test(m[3]))) { const x = parseFloat(m[3].replace(/,/g, "")) * (m[1] === "-" ? -1 : 1); if (m[4]) return { v: x / 100, nf: /\./.test(m[3]) ? "0.00%" : "0%" }; if (m[2]) return { v: x, nf: m[2][0] === "₹" || /Rs/.test(m[2]) ? '"₹"#,##0.00' : m[2] === "$" ? '"$"#,##0.00' : m[2] === "€" ? '"€"#,##0.00' : '"£"#,##0.00' }; if (m[3].indexOf(",") >= 0) return { v: x, nf: "#,##0" + (/\./.test(m[3]) ? "." + "0".repeat(m[3].split(".")[1].length) : "") }; return { v: x }; }
    m = /^\((\d[\d,]*\.?\d*)\)$/.exec(s); if (m) return { v: -parseFloat(m[1].replace(/,/g, "")) };
    const d = /[\d]/.test(s) ? parseDate(s) : null; if (d != null && /[-\/.:]|[A-Za-z]{3}/.test(s) && !/^\d+\.?\d*$/.test(s)) { return /^\d{1,2}:\d{2}/.test(s) && !/[-\/.]/.test(s) ? { v: d, nf: /AM|PM/i.test(s) ? "h:mm AM/PM" : /:\d\d:\d\d/.test(s) ? "h:mm:ss" : "h:mm" } : { v: d, nf: /^\d{4}-/.test(s) ? "yyyy-mm-dd" : /[A-Za-z]/.test(s) ? "dd-mmm-yyyy" : "dd-mm-yyyy" }; }
    return { v: t };
  }
  /* ---------- formula text rewriting (copy/paste, insert/delete rows and columns) ---------- */
  function rewrite(f, fn) {
    // fn(token) -> new text or undefined. token: {type:'ref'|'colrange'|'rowrange'|'range', text, a, b, sheet}
    let toks; try { toks = tokenize(f.slice(1)); } catch (e) { return f; } let out = "=", pos = 0; const src = f.slice(1);
    for (let k = 0; k < toks.length; k++) {
      let tk = toks[k], sheet = null, startI = tk.i;
      if (tk.t === "sheet") { const nx = toks[k + 1]; if (nx && (nx.t === "ref" || nx.t === "colrange" || nx.t === "rowrange")) { sheet = tk.v; out += src.slice(pos, tk.i) + src.slice(tk.i, tk.j); pos = tk.j; k++; tk = nx; } else { out += src.slice(pos, tk.i) + src.slice(tk.i, tk.j); pos = tk.j; continue; } }
      if (tk.t === "ref") {
        const c1 = toks[k + 1], c2 = toks[k + 2];
        if (c1 && c1.t === "op" && c1.v === ":" && c2 && c2.t === "ref") { const r = fn({ type: "range", a: tk.v, b: c2.v, text: tk.v + ":" + c2.v, sheet }); out += src.slice(pos, tk.i) + (r === undefined ? src.slice(tk.i, c2.j) : r); pos = c2.j; k += 2; continue; }
        const r = fn({ type: "ref", text: tk.v, sheet }); out += src.slice(pos, tk.i) + (r === undefined ? src.slice(tk.i, tk.j) : r); pos = tk.j; continue;
      }
      if (tk.t === "colrange" || tk.t === "rowrange") { const r = fn({ type: tk.t, text: tk.v, sheet }); out += src.slice(pos, tk.i) + (r === undefined ? src.slice(tk.i, tk.j) : r); pos = tk.j; continue; }
      out += src.slice(pos, tk.i) + src.slice(tk.i, tk.j); pos = tk.j;
    }
    return out + src.slice(pos);
  }
  /* shift relative references by (dr, dc) when a formula is copied */
  function shift(f, dr, dc) {
    const one = (s) => { const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(s); if (!m) return s; const c = m[1] ? colN(m[2]) : colN(m[2]) + dc, r = m[3] ? +m[4] : +m[4] + dr; if (c < 1 || r < 1 || c > MAXC || r > MAXR) return "#REF!"; return m[1] + nCol(c) + m[3] + r; };
    return rewrite(f, (t) => {
      if (t.type === "ref") return one(t.text);
      if (t.type === "range") { const x = one(t.a), y = one(t.b); return x === "#REF!" || y === "#REF!" ? "#REF!" : x + ":" + y; }
      if (t.type === "colrange") { return t.text.split(":").map((x) => { const m = /^(\$?)([A-Za-z]{1,3})$/.exec(x); if (m[1]) return x; const c = colN(m[2]) + dc; return c < 1 ? "#REF!" : nCol(c); }).join(":"); }
      if (t.type === "rowrange") { return t.text.split(":").map((x) => { const m = /^(\$?)(\d+)$/.exec(x); if (m[1]) return x; const r = +m[2] + dr; return r < 1 ? "#REF!" : String(r); }).join(":"); }
    });
  }
  /* insert (n>0) or delete (n<0) rows/cols at index `at` on sheet `target`; the formula lives on sheet `ownerName` */
  function adjust(f, ownerName, targetName, axis, at, n) {
    const same = (sh) => (sh == null ? ownerName : sh).toLowerCase() === targetName.toLowerCase();
    const span = (a, b) => { // new [a,b] or null
      if (n > 0) return [a >= at ? a + n : a, b >= at ? b + n : b]; const d = -n;
      const na = a >= at + d ? a - d : a >= at ? at : a, nb = b >= at + d ? b - d : b >= at ? at - 1 : b; return nb < na ? null : [na, nb];
    };
    const pr = (s) => { const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(s); return { ac: m[1], c: colN(m[2]), ar: m[3], r: +m[4] }; };
    const fm = (o) => o.ac + nCol(o.c) + o.ar + o.r;
    return rewrite(f, (t) => {
      if (!same(t.sheet)) return undefined;
      if (t.type === "ref") { const o = pr(t.text); const sp = span(axis === "r" ? o.r : o.c, axis === "r" ? o.r : o.c); if (!sp) return "#REF!"; if (axis === "r") o.r = sp[0]; else o.c = sp[0]; return fm(o); }
      if (t.type === "range") { const a = pr(t.a), b = pr(t.b); const lo = axis === "r" ? Math.min(a.r, b.r) : Math.min(a.c, b.c), hi = axis === "r" ? Math.max(a.r, b.r) : Math.max(a.c, b.c); const sp = span(lo, hi); if (!sp) return "#REF!"; if (axis === "r") { if (a.r <= b.r) { a.r = sp[0]; b.r = sp[1]; } else { b.r = sp[0]; a.r = sp[1]; } } else { if (a.c <= b.c) { a.c = sp[0]; b.c = sp[1]; } else { b.c = sp[0]; a.c = sp[1]; } } return fm(a) + ":" + fm(b); }
      if (t.type === "colrange" && axis === "c") { const p = t.text.split(":").map((x) => /^(\$?)([A-Za-z]{1,3})$/.exec(x)); const sp = span(colN(p[0][2]), colN(p[1][2])); if (!sp) return "#REF!"; return p[0][1] + nCol(sp[0]) + ":" + p[1][1] + nCol(sp[1]); }
      if (t.type === "rowrange" && axis === "r") { const p = t.text.split(":").map((x) => /^(\$?)(\d+)$/.exec(x)); const sp = span(+p[0][2], +p[1][2]); if (!sp) return "#REF!"; return p[0][1] + sp[0] + ":" + p[1][1] + sp[1]; }
      return undefined;
    });
  }
  /* a range inside a formula that spans two refs needs both ends adjusted separately: handled because ":" is not a token of its own here (ref : ref) */
  window.Calc = Object.assign(K_, { precedents, ARRFN, LIFT, def, ev, sc, N, nums, arr2, crit, ifs, scalar, isArr, bc, gridOf, asGrid, mayArr, Workbook, Sheet, Rng, ERR, isE, Fmt, parse, tokenize, parseInput, shift, adjust, rewrite, colN, nCol, addr, parseAddr, key, unkey, toSerial, fromSerial, dser, ymd, MAXR, MAXC, F, toNum, toStr, cmp, MON, DAY, parseDate });
})();
