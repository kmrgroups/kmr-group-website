/* KMR CAD Draft — stage drawings for the SOP, with Process Documents.
   STAGEDWG   pick a Process Documents project whose dimensions are frozen per operation and the drawing to draw
              on: the ballooned drawing from Balloon Inspector (DXF / DWG as lines, PDF / image as a picture),
              a drawing in this register, the drawing open now, or a file. One A3 stage sheet is drawn per
              operation: this operation's dimensions and balloons in red, earlier operations' dimensions in grey,
              later operations' dimensions left out, a table of this operation's characteristics and a title
              block. The sheets open here to check or edit, and are sent to the SOP.
   STAGESEND  render the sheets and send them to the SOP (again after editing).
   STAGESOP   open the SOP of that project in Process Documents (new tab). */
(function (K) {
  "use strict";
  const G = K.geom, cmd = K.cmd, esc = K.esc;
  const PW = 420, PH = 297;                                   // A3 landscape, mm
  const RED = "#e11d48", GREY = "#9aa3ad", INK = "#111111";
  const OUT_W = 2000;                                         // pixels across an A3 sheet sent to the SOP (≈120 dpi)
  const SKIP = new Set(["Material", "Note"]);
  const A = { DA: { x0: 14, y0: 46, x1: 296, y1: 283 }, TB: { x0: 300, y0: 46, x1: 406, y1: 283 } };  // drawing area, table panel (paper mm)

  /* ================= data: Process Documents through the database functions (sample: cad-demo.js) ================= */
  const nice = (m) => (/kmr_cad_pd|Could not find the function|does not exist|schema cache/i.test(String(m)) ? "The database update for stage drawings (0070) has not been run yet. Ask KMR to run it, then try again." : String(m));
  const api = {
    list: async () => { try { return (await QP.call("kmr_cad_pd_list")) || []; } catch (e) { throw new Error(nice(e.message)); } },
    get: async (id) => { try { return await QP.call("kmr_cad_pd_get", { p_id: id }); } catch (e) { throw new Error(nice(e.message)); } },
    put: async (id, st) => { try { return await QP.call("kmr_cad_pd_stages", { p_id: id, p_stages: st }); } catch (e) { throw new Error(nice(e.message)); } },
  };
  const sopHref = (id) => QP.appHref("pd", { project: id, hash: "go=sop&prj=" + id });
  const dmy = (t) => { if (!t) return ""; const d = new Date(t); return isNaN(d) ? String(t) : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); };

  /* the frozen map against the plan as it is now (same rule as Process Documents) */
  const mapNow = (P) => { const m = {}; for (const o of P.ops || []) if (o.chars && o.chars.length) m[String(o.opNo)] = o.chars.map(Number).sort((a, b) => a - b); return m; };
  const specNow = (P) => { const s = {}; for (const c of P.chars || []) s[String(c.no)] = [c.type || "", c.spec || "", c.cls || ""].join(" | "); return s; };
  const sameObj = (a, b) => { const ka = Object.keys(a || {}).sort(), kb = Object.keys(b || {}).sort(); return ka.join() === kb.join() && ka.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k])); };
  const freezeState = (P) => (!P.freeze ? "none" : sameObj(P.freeze.map, mapNow(P)) && sameObj(P.freeze.spec, specNow(P)) ? "frozen" : "changed");

  /* ================= text and numbers on drawings ================= */
  const norm = (s) => String(s == null ? "" : s).replace(/\\P/g, " ").replace(/\\[A-Za-z][^;\\]*;/g, "").replace(/[{}]/g, "").replace(/%%[cC]/g, "Ø").replace(/%%[dD]/g, "°").replace(/%%[pP]/g, "±")
    .replace(/[⌀∅Φφ]/g, "Ø").replace(/[×✕]/g, "X").replace(/[−–]/g, "-").toUpperCase().replace(/\s+/g, "");
  const firstNum = (s) => { const m = String(s).replace(/,/g, ".").match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };
  const near = (a, b) => a != null && b != null && Math.abs(a - b) <= 1e-3 + 1e-6 * Math.abs(b);
  // characters the drawing font may not have: GD&T symbols as words
  const SYMW = { "⌖": "POS", "⊥": "PERP", "↗": "RUNOUT", "⌰": "T.RUNOUT", "∥": "PARL", "⏥": "FLAT", "○": "ROUND", "⌭": "CYL", "◎": "CONC", "⌒": "PROF", "⌓": "PROF", "∠": "ANG", "⌯": "SYM", "⏤": "STRT", "◆": "CC", "▼": "SC", "◇": "KC" };
  const plain = (s) => String(s == null ? "" : s).replace(/[⌖⊥↗⌰∥⏥○⌭◎⌒⌓∠⌯⏤◆▼◇]/g, (c) => SYMW[c] + " ").replace(/[⌀∅]/g, "Ø").replace(/[–—−]/g, "-").replace(/[^\x20-\x7E -ÿͰ-Ͽ°±Ø]/g, "").replace(/\s+/g, " ").trim();
  const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  // trimmed to fit a width at a text height (measured with the font the sheets are drawn in)
  let mctx = null; const wOf = (s, h) => { if (!mctx) { mctx = document.createElement("canvas").getContext("2d"); mctx.font = "100px Arial, Helvetica, sans-serif"; } return (mctx.measureText(s).width / 100) * (h / 0.716); };
  const fit = (s, h, w) => { s = String(s == null ? "" : s); if (wOf(s, h) <= w) return s; while (s.length > 1 && wOf(s + "…", h) > w) s = s.slice(0, -1); return s.trimEnd() + "…"; };

  /** what on the drawing can stand for a characteristic: dimensions (also DXF dimension blocks), texts, leaders, tolerance frames */
  const polyB = (pts) => { let b = null; for (const p of pts) b = G.mergeBounds(b, { x0: p[0], y0: p[1], x1: p[0], y1: p[1] }); return b; };
  /** the box around the words of these pieces (text, mtext, mtext lines) */
  const wordsBox = (list) => { let b = null; for (const g of list) { if (!g || !g.s || !g.p) continue; if (g.t === "mtext") { for (const l of K.mtextLines(g)) b = G.mergeBounds(b, polyB(K.textBox(l))); } else b = G.mergeBounds(b, polyB(K.textBox(Object.assign({ h: 2.5 }, g)))); } return b; };
  const mid = (b) => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
  function candidates(doc) {
    const out = [];
    const dimKind = (s) => (/^Ø|^\d+XØ/.test(s) ? "dia" : /^R\d/.test(s) ? "rad" : /°/.test(s) ? "ang" : "lin");
    const num = (s) => firstNum(s.replace(/^\d+X/, ""));
    for (const e of doc.ents) {
      try {
        if (e.t === "dim") {
          const s = norm(K.dimText(e, doc)), box = wordsBox(K.dimGeom(e, doc).filter((g) => g.t === "text"));
          out.push({ e, kind: "dim", dk: e.kind, s, v: e.kind === "ang" ? firstNum(s) : num(s), box, pos: box ? mid(box) : e.tp || e.loc || e.p2 || e.c });
        } else if (e.t === "insert" && e.dimblock) {
          const kids = K.expand(e, doc).filter((g) => (g.t === "text" || g.t === "mtext") && g.s); if (!kids.length) continue;
          const s = norm(kids.map((g) => g.s).join(" ")), box = wordsBox(kids); out.push({ e, kind: "dim", dk: dimKind(s), s, v: num(s), box, pos: box ? mid(box) : kids[0].p, fp: e.dxtp });
        } else if ((e.t === "text" || e.t === "mtext") && e.s) { const box = wordsBox([e]), s = norm(e.s); out.push({ e, kind: e.dimtext ? "dim" : "text", dk: e.dimtext ? dimKind(s) : undefined, s, v: num(s), box, pos: box ? mid(box) : e.p, fp: e.p }); }
        else if (e.t === "leader" && e.s) { const box = wordsBox(K.leaderGeom(e, doc)); out.push({ e, kind: "text", s: norm(e.s), v: num(norm(e.s)), box, pos: box ? mid(box) : e.pts[e.pts.length - 1] }); }
        else if (e.t === "fcf") { const r = (e.rows || [])[0] || {}, box = K.bbox(e, doc); out.push({ e, kind: "fcf", sym: r.sym, v: parseFloat(r.tol), s: norm((r.dia ? "Ø" : "") + (r.tol || "") + (r.datums || []).map((d) => d.d).join("")), box, pos: box ? mid(box) : e.p }); }
      } catch (er) { /* an object that cannot be read is simply not a candidate */ }
    }
    return out;
  }
  /** where the leader from a balloon at b to a point a inside box (grown by g) meets the box edge */
  const toEdge = (b, a, box, g) => {
    if (!box) return a; const x0 = box.x0 - g, y0 = box.y0 - g, x1 = box.x1 + g, y1 = box.y1 + g;
    if (b[0] > x0 && b[0] < x1 && b[1] > y0 && b[1] < y1) return a;
    const d = G.sub(a, b); let t0 = 0, t1 = 1;
    for (const [p, q] of [[-d[0], b[0] - x0], [d[0], x1 - b[0]], [-d[1], b[1] - y0], [d[1], y1 - b[1]]]) { if (Math.abs(p) < 1e-12) { if (q < 0) return a; continue; } const r = q / p; if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r); }
    return t0 <= t1 ? G.add(b, G.mul(d, t0)) : a;
  };
  const hitsBox = (q, r, B) => q[0] + r > B.x0 && q[0] - r < B.x1 && q[1] + r > B.y0 && q[1] - r < B.y1;
  const gdtKey = (name) => { const n = String(name || "").toLowerCase(); if (!n) return ""; for (const [k, v] of Object.entries(K.GDT || {})) { const vn = v.n.toLowerCase(); if (vn === n || vn.startsWith(n) || n.startsWith(vn.split(" ")[0])) return k; } return /run/.test(n) ? (/total/.test(n) ? "total_runout" : "runout") : ""; };
  /** how well a candidate on the drawing fits a characteristic (≥ 7 = good, from the text and value alone) */
  function content(c, k) {
    const ct = norm(c.text), nom = c.nominal == null || c.nominal === "" ? null : +c.nominal;
    if (c.type === "GD&T") { if (k.kind !== "fcf") return ct.length > 2 && k.s.includes(ct) ? 8 : -9; let s = 0; if (near(k.v, c.upper != null ? +c.upper : null)) s += 6; if (gdtKey(c.gdt) && gdtKey(c.gdt) === k.sym) s += 3; return s || -9; }
    if (k.kind === "fcf") return -9;
    let s = 0;
    if (ct.length >= 2 && k.s === ct) s += 10; else if (ct.length >= 3 && k.s.includes(ct)) s += 9;
    if (nom != null && near(k.v, nom)) {
      s += 7;
      if (k.kind === "dim") { const want = c.type === "Diameter" ? "dia" : c.type === "Radius" ? "rad" : c.type === "Angle" ? "ang" : c.type === "Linear" || c.type === "Chamfer" ? "lin" : "";
        const has = /^(\d+X)?Ø/.test(k.s) ? "dia" : k.dk === "ali" || k.dk === "ord" ? "lin" : k.dk;
        if (want && has === want) s += 3; else if (want === "dia" && has !== "dia") s -= 4; else if (want && want !== "dia" && has === "dia") s -= 4; }
    }
    return s;
  }
  /** one drawing object per characteristic, best fits first; pos(c) = the balloon's anchor on this drawing (anchored mode) */
  function assign(chars, cands, pos, diag) {
    const pairs = [], Rmax = diag * 0.06;
    for (const c of chars) {
      const a = pos ? pos(c) : null;
      for (const k of cands) {
        let s = content(c, k);
        if (a) { const d = G.dist(a, k.pos); if (d > Rmax * 1.6 || s < 0 || (s < 7 && d > Rmax * 0.5)) continue; s += 8 * Math.max(0, 1 - d / Rmax); if (s < 6) continue; }
        else if (s < 7) continue;
        pairs.push([s, c, k]);
      }
    }
    pairs.sort((x, y) => y[0] - x[0]);
    const byChar = new Map(), used = new Set(), best = new Map();
    for (const [s, c, k] of pairs) { if (byChar.has(c.no) || used.has(k.e.id)) continue; byChar.set(c.no, k); used.add(k.e.id); best.set(c.no, s); }
    // the same value found twice with the same score: say which balloons to check
    byChar.unsure = [...byChar.keys()].filter((no) => pairs.filter(([s, c, k]) => c.no === no && s === best.get(no) && k !== byChar.get(no)).length);
    return byChar;
  }

  /* ================= placing Balloon Inspector's balloons on the drawing ================= */
  // sheet pixels (y down) → drawing units, exactly (snapshot of a newer Balloon Inspector) …
  const fromCadT = (t) => ({ a: 1 / t.k, bx: t.x0 - t.pad / t.k, by: t.y0 + (t.H - t.pad) / t.k });
  const apT = (T, px, py) => [T.a * px + T.bx, -T.a * py + T.by];
  // … or fitted from the dimensions whose value is found only once on both sides
  function fitT(items, chars, cands, diag) {
    const pairs = [];
    for (const c of chars) {
      const it = items.get(+c.no); if (!it || it.ax == null) continue;
      const good = cands.filter((k) => content(c, k) >= 7); if (good.length !== 1) continue;
      if (chars.filter((x) => x !== c && content(x, good[0]) >= 7).length) continue;
      pairs.push({ p: [it.ax, it.ay], q: good[0].fp || good[0].pos });   // fp: the point Balloon Inspector anchors to (DXF text point)
    }
    if (pairs.length < 2) return null;
    const solve = (L) => { const n = L.length; let px = 0, py = 0, qx = 0, qy = 0; for (const r of L) { px += r.p[0]; py += r.p[1]; qx += r.q[0]; qy += r.q[1]; } px /= n; py /= n; qx /= n; qy /= n;
      let num = 0, den = 0; for (const r of L) { const dx = r.p[0] - px, dy = r.p[1] - py; num += dx * (r.q[0] - qx) - dy * (r.q[1] - qy); den += dx * dx + dy * dy; }
      if (den < 1e-9) return null; const a = num / den; if (!(a > 0)) return null; return { a, bx: qx - a * px, by: qy + a * py }; };
    const tol = diag * 0.025; let best = null, bestIn = [];
    for (let i = 0; i < pairs.length; i++) for (let j = i + 1; j < pairs.length; j++) {
      const T = solve([pairs[i], pairs[j]]); if (!T) continue;
      const inl = pairs.filter((r) => G.dist(apT(T, r.p[0], r.p[1]), r.q) < tol);
      if (inl.length > bestIn.length) { best = T; bestIn = inl; }
    }
    if (!best || bestIn.length < Math.min(3, pairs.length)) return null;
    return solve(bestIn) || best;
  }

  /* ================= reading the drawing ================= */
  const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Could not load " + src)); document.head.append(s); });
  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  const pdfLib = async () => { if (!window.pdfjsLib) await loadScript(PDFJS + "pdf.min.js"); window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; return window.pdfjsLib; };
  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); return c; };
  // the same turn Balloon Inspector gives a crooked scan
  const rotate = (src, deg) => { const c = canvas(src.width, src.height), g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.translate(c.width / 2, c.height / 2); g.rotate((deg * Math.PI) / 180); g.drawImage(src, -src.width / 2, -src.height / 2); return c; };
  // a sheet picture kept in the drawing: at most 2400 px, JPEG
  const keep = (c) => { const k = Math.min(1, 2400 / Math.max(c.width, c.height)); const d = k < 1 ? canvas(Math.round(c.width * k), Math.round(c.height * k)) : c; if (k < 1) d.getContext("2d").drawImage(c, 0, 0, d.width, d.height); return { src: d.toDataURL("image/jpeg", 0.9), w: c.width, h: c.height }; };
  async function rasterPages(file, kind, desk, say) {
    const out = [];
    if (kind === "pdf") {
      const lib = await pdfLib(), pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise, n = Math.min(pdf.numPages, 20);
      for (let p = 1; p <= n; p++) {
        say(`Reading sheet ${p} of ${n} of the PDF…`);
        const page = await pdf.getPage(p), v1 = page.getViewport({ scale: 1 }), sc = 3200 / Math.max(v1.width, v1.height), vp = page.getViewport({ scale: sc });
        let c = canvas(Math.round(vp.width), Math.round(vp.height)); await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        if (desk && desk[p - 1]) c = rotate(c, desk[p - 1]); out.push(keep(c));
      }
    } else {
      const url = URL.createObjectURL(file), im = new Image(); im.src = url; await im.decode(); URL.revokeObjectURL(url);
      const k = Math.min(1, 3200 / Math.max(im.naturalWidth, im.naturalHeight)); let c = canvas(Math.round(im.naturalWidth * k), Math.round(im.naturalHeight * k)); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      if (desk && desk[0]) c = rotate(c, desk[0]); out.push(keep(c));
    }
    return out;
  }
  /** a PDF / picture sheet cropped to the part views: the box around the balloons' anchor points, so the drawing is shown as large as the stage sheet allows */
  async function cropPages(pages, items, info) {
    for (let pi = 0; pi < pages.length; pi++) {
      const pg = pages[pi], inf = info[pi], kx = inf && inf.w ? pg.w / inf.w : 1; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, n = 0;
      for (const it of items.values()) { if ((it.sheet || 0) !== pi || it.ax == null) continue; for (const [x, y] of [[it.ax, it.ay], [it.bx, it.by]]) { if (x == null || y == null) continue; const X = x * kx, Y = y * kx; x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y); n++; } }
      if (n < 2) continue;
      const mx = Math.max(60, (x1 - x0) * 0.1), my = Math.max(60, (y1 - y0) * 0.1);
      const cx0 = Math.max(0, x0 - mx), cy0 = Math.max(0, y0 - my), cx1 = Math.min(pg.w, x1 + mx), cy1 = Math.min(pg.h, y1 + my);
      if (cx1 - cx0 > pg.w * 0.92 && cy1 - cy0 > pg.h * 0.92) continue;
      const im = new Image(); im.src = pg.src; await im.decode(); const sc = im.naturalWidth / pg.w, cw = cx1 - cx0, ch = cy1 - cy0, c = canvas(Math.round(cw * sc), Math.round(ch * sc));
      c.getContext("2d").drawImage(im, cx0 * sc, cy0 * sc, cw * sc, ch * sc, 0, 0, c.width, c.height);
      pages[pi] = { src: c.toDataURL("image/jpeg", 0.9), w: cw, h: ch, fw: pg.w, x0: cx0, y0: cy0 };
    }
    return pages;
  }
  const kindOf = (name) => { const x = String(name || "").split(".").pop().toLowerCase(); return x === "dxf" || x === "dwg" ? "vector" : x === "pdf" ? "pdf" : /^(png|jpe?g|webp|bmp|gif)$/.test(x) ? "image" : x === "json" ? "json" : x === "step" || x === "stp" ? "step" : ""; };
  async function biFile(P) {
    const path = P.bi && P.bi.file_path, name = (P.bi && P.bi.file_name) || (path ? path.split("/").pop() : "drawing");
    if (!path) throw new Error("This project's ballooning report has no drawing file stored.");
    let blob;
    if (path.startsWith("static:")) { const r = await fetch(path.slice(7)); if (!r.ok) throw new Error("The sample drawing is not available."); blob = await r.blob(); }
    else { const sb = QP.sb; if (!sb) throw new Error("Not signed in."); const { data, error } = await sb.storage.from("bi-drawings").download(path); if (error) throw new Error("Could not read the ballooned drawing (" + (error.message || "no access") + "). You need access to Balloon Inspector, or choose the drawing file yourself."); blob = data; }
    return new File([blob], name, { type: blob.type || "" });
  }
  /** the drawing to draw the stage sheets on: {kind: vector|raster, doc | pages, anchored, name, T} */
  async function loadSource(E, P, how, file, say) {
    const items = new Map(); ((P.source && P.source.items) || []).forEach((it, i) => items.set(it.no != null ? +it.no : i + 1, it));
    const info = (P.source && P.source.sheets) || (P.bi && P.bi.sheets) || [], desk = (P.source && P.source.desk) || (P.bi && P.bi.desk) || [];
    const hasPos = [...items.values()].some((it) => it.ax != null);
    let doc = null, name = "", anchoredOk = false, fromPdf = false;
    if (how === "open") { doc = JSON.parse(JSON.stringify(E.data())); name = (E.info && (E.info.number || E.info.title)) || "drawing open in CAD"; }
    else if (/^reg:/.test(how)) { const d = await QP.call("kmr_cad_get", { p_id: how.slice(4) }); doc = Object.assign(K.newDoc(false), d.data || {}); name = d.number + " rev " + d.rev; }
    else {
      const f = how === "bi" ? await biFile(P) : file; if (!f) throw K.CANCEL; name = f.name; anchoredOk = hasPos && (how === "bi" || (P.source && P.source.fileName && f.name.replace(/\.[^.]+$/, "") === String(P.source.fileName).replace(/\.[^.]+$/, "")) || how === "file-same");
      const kd = kindOf(f.name);
      if (kd === "step") throw new Error("A STEP model has no drawing dimensions. Use the 2D drawing (DXF, DWG or PDF).");
      // a PDF made from CAD holds real lines and text: read them, so the part keeps its exact shape and dimension text
      if (kd === "pdf" && K.vec && !(info.length > 1 || [...items.values()].some((it) => (it.sheet || 0) > 0))) {
        try {
          say("Reading the lines and text of the PDF…"); const r = await K.vec.convert(f, { ocr: false, keep: false, page: 1 }, say);
          if (r.kind === "vector" && r.pages === 1 && r.cnt.text >= 8) { doc = Object.assign(K.newDoc(false), {}); K.vec.intoDoc(doc, r, 0, 0, 1); doc.units = "mm"; doc.ents = doc.ents.filter((e) => !((e.t === "text" || e.t === "mtext") && (e.h || 0) > 20)); fromPdf = true; }   // very large text is a watermark ("Draft copy")
        } catch (er) { doc = null; fromPdf = false; }
      }
      if (!doc && (kd === "pdf" || kd === "image")) { say("Reading the drawing…"); const pages = await rasterPages(f, kd, desk, say); if (anchoredOk) await cropPages(pages, items, info); return { kind: "raster", pages, anchored: anchoredOk, items, info, name, file: f }; }
      if (!doc) { if (kd === "vector" || kd === "json") { say("Reading the drawing…"); const r = await K.readDrawingFile(f, say); doc = Object.assign(K.newDoc(false), r.doc); }
        else throw new Error("Use a DXF, DWG, PDF or picture of the drawing."); }
    }
    doc.ents = (doc.ents || []).filter((e) => e.t !== "xline"); for (const e of doc.ents) if (!e.id) e.id = K.uid();
    if (!doc.ents.length) throw new Error("The drawing is empty.");
    let T = null; const b = K.extents(doc), diag = Math.hypot(b.x1 - b.x0, b.y1 - b.y0);
    if (anchoredOk) { const ci = info[0] && info[0].cad; T = ci && ci.k ? fromCadT(ci) : fitT(items, P.chars || [], candidates(doc), diag); }
    return { kind: "vector", doc, anchored: !!T, T, items, info, name, fromPdf, fitted: !!T && !(info[0] && info[0].cad) };
  }

  /* ================= the stage sheets ================= */
  const U = (o) => Object.assign({ id: K.uid(), color: null, lt: null, lw: null }, o);
  function buildSet(P, SRC, opt) {
    const vec = SRC.kind === "vector", src = vec ? SRC.doc : null;
    const doc = K.newDoc(!vec);
    if (vec) { doc.layers = JSON.parse(JSON.stringify(src.layers || doc.layers)); doc.blocks = src.blocks || {}; doc.dim = Object.assign({}, doc.dim, src.dim || {}); doc.dimstyles = src.dimstyles; doc.text = src.text || doc.text; doc.ltscale = src.ltscale || 1; doc.units = src.units || "mm"; doc.pdmode = src.pdmode; doc.pdsize = src.pdsize; }
    for (const [n, c, lw] of [["STG-FRAME", "#ffffff", 0.5], ["STG-TABLE", "#ffffff", 0.25], ["STG-BALLOON", RED, 0.35]]) if (!doc.layers.find((l) => l.name === n)) doc.layers.push({ name: n, color: c, lt: "CONTINUOUS", lw, on: true, frozen: false, lock: false });
    doc.images = {};
    const chars = new Map((P.chars || []).map((c) => [+c.no, c])), map = P.freeze.map || {};
    // operations that make a ballooned dimension (an operation that only checks the material or a note has no stage drawing)
    const route = (P.ops || []).filter((o) => (map[String(o.opNo)] || []).some((n) => { const c = chars.get(+n); return c && !SKIP.has(c.type); }));
    const opOf = new Map(); route.forEach((o, i) => (map[String(o.opNo)] || []).forEach((n) => opOf.set(+n, i)));
    const sopSec = new Map(((P.sop && P.sop.sections) || []).map((s) => [String(s.opNo), s]));
    const gName = new Map((P.gauges || []).map((g) => [g.id, [g.name, g.range].filter(Boolean).join(" ")]));
    const H = P.header || {}, co = (QP.ctx && QP.ctx.company) || H.supplier || "";
    const report = { linked: 0, ballooned: 0, missing: [] };

    // drawing objects ↔ characteristics, once for the whole set
    let assigned = new Map(), anchor = () => null, pageOf = () => 0, cands = [];
    let crop = null;
    const frozenChars = [...opOf.keys()].map((n) => chars.get(n)).filter(Boolean);
    if (vec) {
      const b = K.extents(src), diag = Math.hypot(b.x1 - b.x0, b.y1 - b.y0); cands = candidates(src);
      const pos = SRC.anchored ? (c) => { const it = SRC.items.get(+c.no); return it && it.ax != null ? apT(SRC.T, it.ax, it.ay) : null; } : null;
      assigned = assign([...chars.values()].filter((c) => !SKIP.has(c.type) || opOf.has(+c.no)), cands, pos, diag);
      anchor = (c) => { const k = assigned.get(+c.no), box = k ? k.box : null;
        if (pos) { const a = pos(c); if (a) { const it = SRC.items.get(+c.no); return { a: k && box ? k.pos : a, box, b: it && it.bx != null ? apT(SRC.T, it.bx, it.by) : null }; } }
        return k ? { a: k.pos, box, b: null } : null; };
    } else if (SRC.anchored) {
      // Balloon Inspector draws a PDF / picture at most 3200 px across, exactly as rasterPages does, so pixels match (kx = 1); a stored sheet width corrects any difference
      anchor = (c) => { const it = SRC.items.get(+c.no); if (!it || it.ax == null || !SRC.pages[it.sheet || 0]) return null; const pg = SRC.pages[it.sheet || 0], inf = SRC.info[it.sheet || 0], kx = inf && inf.w ? (pg.fw || pg.w) / inf.w : 1, ox0 = pg.x0 || 0, oy0 = pg.y0 || 0;
        return { a: [it.ax * kx - ox0, pg.h - (it.ay * kx - oy0)], b: it.bx != null ? [it.bx * kx - ox0, pg.h - (it.by * kx - oy0)] : null }; };
      pageOf = (c) => { const it = SRC.items.get(+c.no); return it && SRC.pages[it.sheet || 0] ? it.sheet || 0 : 0; };
    }
    // a drawing read from a PDF still has its border and title block: keep the part views, the box around the dimensions and balloons
    if (vec && SRC.fromPdf && SRC.anchored) { let bb = null; const mg = (p) => { if (p) bb = G.mergeBounds(bb, { x0: p[0], y0: p[1], x1: p[0], y1: p[1] }); };
      for (const c of chars.values()) { const it0 = SRC.items.get(+c.no); if (!it0 || it0.ax == null) continue; const an = anchor(c); if (!an) continue; mg(an.a); mg(an.b); if (an.box) { mg([an.box.x0, an.box.y0]); mg([an.box.x1, an.box.y1]); } }
      if (bb) { const m = Math.max(12, 0.12 * Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0)); crop = { x0: bb.x0 - m, y0: bb.y0 - m, x1: bb.x1 + m, y1: bb.y1 + m }; } }
    const roleOf = new Map(); for (const [no, k] of assigned) roleOf.set(k.e.id, no);

    const sheets = []; let ox = 0;
    route.forEach((o, oi) => {
      const mine = (map[String(o.opNo)] || []).map(Number), mineSet = new Set(mine);
      const pages = vec ? [0] : [...new Set(mine.map((n) => (chars.get(n) ? pageOf(chars.get(n)) : 0)))].sort((a, b) => a - b);
      pages.forEach((pi, k) => {
        const cb = vec ? (crop || K.extents(src)) : { x0: 0, y0: 0, x1: SRC.pages[pi].w, y1: SRC.pages[pi].h };
        const bw = Math.max(cb.x1 - cb.x0, 1e-6), bh = Math.max(cb.y1 - cb.y0, 1e-6), aw = A.DA.x1 - A.DA.x0, ah = A.DA.y1 - A.DA.y0;
        const s = Math.min(aw / bw, ah / bh) * 0.96, f = 1 / s, P0 = (x, y) => [ox + x * f, y * f];
        const dx = P0((A.DA.x0 + A.DA.x1) / 2, 0)[0] - (cb.x0 + cb.x1) / 2, dy = ((A.DA.y0 + A.DA.y1) / 2) * f - (cb.y0 + cb.y1) / 2, mv = K.M.move(dx, dy);
        const E2 = []; const add = (e) => { E2.push(U(e)); return e; };
        // 1. the drawing
        if (vec) {
          for (const e of src.ents) {
            if (crop) { const bb = K.bbox(e, src); if (!bb || bb.x0 < crop.x0 || bb.x1 > crop.x1 || bb.y0 < crop.y0 || bb.y1 > crop.y1) continue; }
            const no = roleOf.get(e.id), oo = no != null ? opOf.get(no) : undefined;
            let role = no == null ? "geom" : mineSet.has(no) ? "this" : oo != null && oo < oi ? "done" : oo != null ? "later" : "loose";
            if (no == null && (["dim", "fcf"].includes(e.t) || (e.t === "insert" && e.dimblock) || (e.t === "text" && e.dimtext))) role = "loose";
            if (role === "later" && SRC.fromPdf) role = "done";   // a PDF has no dimension objects to take out: other operations' dimensions are grey
            if (role === "later" || (role === "done" && opt.earlier === "hide") || (role === "loose" && opt.loose === "hide")) continue;
            const n = K.xform(e, mv); n.id = K.uid(); delete n.stg;
            if (role === "this") { n.color = RED; n.lw = 0.5; n.stg = "this"; } else if (role === "done") { n.color = GREY; n.stg = "done"; }
            E2.push(n);
          }
        } else {
          const key = "p" + pi; doc.images[key] = SRC.pages[pi].src;
          add({ t: "image", layer: "0", p: [cb.x0 + dx, cb.y0 + dy], w: bw, h: bh, rot: 0, src: "img:" + key });
        }
        // 2. balloons for the characteristics made here, clear of the words on the sheet and of each other
        const R = 3.6 * f, cc = [(cb.x0 + cb.x1) / 2 + dx, (cb.y0 + cb.y1) / 2 + dy], mvB = (B) => ({ x0: B.x0 + dx, y0: B.y0 + dy, x1: B.x1 + dx, y1: B.y1 + dy });
        const occ = []; if (vec) for (const k of cands) { if (!k.box) continue; const no = roleOf.get(k.e.id), oo = no != null ? opOf.get(no) : undefined; if (no != null && !mineSet.has(no) && oo != null && oo > oi) continue; occ.push(mvB(k.box)); }
        const inArea = (p) => p[0] > ox + (A.DA.x0 + 4) * f && p[0] < ox + (A.DA.x1 - 4) * f && p[1] > (A.DA.y0 + 4) * f && p[1] < (A.DA.y1 - 4) * f;
        const drawn = E2.slice(), placedB = [];
        const segsNear = (a, rad) => { const out = []; for (const e of drawn) { const bb = K.bbox(e, doc); if (!bb || bb.x1 < a[0] - rad || bb.x0 > a[0] + rad || bb.y1 < a[1] - rad || bb.y0 > a[1] + rad) continue; try { for (const sg of K.segs(e, doc)) out.push(sg); } catch (er) { /* skip */ } } return out; };
        const free = (q, tall, segs) => inArea(q) && occ.every((B) => !hitsBox([q[0], q[1] + (tall ? R * 0.5 : 0)], R * (tall ? 1.5 : 1.1), B)) && (!segs || segs.every((sg) => G.distTo(q, sg) > R * 1.12 && (!tall || G.distTo([q[0], q[1] + R * 1.5], sg) > R * 0.7)));
        for (const no of mine.slice().sort((a, b) => a - b)) {
          const c = chars.get(no); if (!c || (!vec && pageOf(c) !== pi)) continue;
          const an = anchor(c); if (!an) { if (!SKIP.has(c.type)) report.missing.push(no); continue; }
          const a = G.add(an.a, [dx, dy]), box = an.box ? mvB(an.box) : null; let b = an.b ? G.add(an.b, [dx, dy]) : null;
          if (b && (G.dist(a, b) > 40 * f || !inArea(b) || placedB.some((p) => G.dist(p, b) < R * 2.3))) b = null;
          if (!b) { const a0 = Math.atan2(a[1] - cc[1], a[0] - cc[0]), from = box ? Math.max(box.x1 - box.x0, box.y1 - box.y0) / 2 : 0; let best = null;
            const segs = segsNear(a, R * 9 + from);
            for (const pass of [2, 1, 0]) { for (const r of [2.4, 3.2, 4.2, 5.4, 7]) { for (let i = 0; i < 16 && !best; i++) { const ang = a0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 8), q = G.add(a, [Math.cos(ang) * (R * r + from), Math.sin(ang) * (R * r + from)]); if (pass === 2 ? free(q, !!c.cls, segs) : pass === 1 ? free(q, !!c.cls) : inArea(q)) best = q; } if (best) break; } if (best) break; }
            b = best || G.add(a, [R * 3, R * 3]); }
          occ.push({ x0: b[0] - R, y0: b[1] - R, x1: b[0] + R, y1: b[1] + R + (c.cls ? 3.2 * f : 0) }); placedB.push(b);
          add({ t: "circle", layer: "STG-BALLOON", c: b, r: R, stg: "balloon", no });
          add({ t: "text", layer: "STG-BALLOON", p: b, h: (no >= 100 ? 2.5 : 3) * f, s: String(no), rot: 0, ha: 1, va: 2, stg: "balloon", no });
          const end = toEdge(b, a, box, 0.6 * f), d = G.dist(end, b);
          if (d > R * 1.15) { const u = G.unit(G.sub(end, b)); add({ t: "line", layer: "STG-BALLOON", a: G.add(b, G.mul(u, R)), b: end, stg: "balloon", no }); if (!box) add({ t: "circle", layer: "STG-BALLOON", c: end, r: 0.55 * f, stg: "balloon", no }); }
          if (c.cls) add({ t: "text", layer: "STG-BALLOON", p: G.add(b, [0, R + 0.9 * f]), h: 2.2 * f, s: String(c.cls), rot: 0, ha: 1, va: 0, stg: "balloon", no });
          report.ballooned++;
        }
        // 3. frame and title block
        const L = (x0, y0, x1, y1, layer = "STG-FRAME") => add({ t: "line", layer, a: P0(x0, y0), b: P0(x1, y1) });
        const T = (x, y, h, s, ha = 0, layer = "STG-FRAME", va = 0) => add({ t: "text", layer, p: P0(x, y), h: h * f, s: String(s == null ? "" : s), rot: 0, ha, va });
        add({ t: "pline", layer: "STG-FRAME", closed: true, lw: 0.7, pts: [P0(10, 10), P0(410, 10), P0(410, 287), P0(10, 287)].map((p) => [p[0], p[1], 0]) });
        L(10, 42, 410, 42); L(298, 42, 298, 287); L(100, 10, 100, 42); L(100, 26, 410, 26);
        for (let i = 1; i < 4; i++) L(100 + i * 77.5, 10, 100 + i * 77.5, 42);
        T(14, 33, 5.2, "STAGE DRAWING"); T(14, 24.5, 3.4, fit(plain(`OP ${o.opNo} · ${String(o.name || "").toUpperCase()}`), 3.4, 83)); T(14, 15, 2.4, fit(plain(co), 2.4, 83));
        const st = sopSec.get(String(o.opNo)), stgNo = `${(st && st.docNo) || ("STG-" + (P.part_no || ""))}${st && st.docNo ? "-STG" : "-" + o.opNo}`;
        const cells = [["Part no.", P.part_no || H.partNo], ["Part name", P.part_name || H.partName], ["Drawing no. / rev", [H.drawingNo || P.drawing_no, H.drawingRev || P.rev].filter(Boolean).join(" / rev ")], ["Customer", P.customer || H.customer],
          ["Machine", o.machine || "—"], ["Stage drawing no.", stgNo], ["Dimensions frozen", `rev ${P.freeze.rev} · ${dmy(P.freeze.at)}`], ["Sheet", `${k + 1} of ${pages.length} · Op ${o.opNo}`]];
        cells.forEach(([lab, val], i) => { const cx = 100 + (i % 4) * 77.5, cy = i < 4 ? 26 : 10; T(cx + 2, cy + 12, 1.9, lab); T(cx + 2, cy + 3.6, 3, fit(plain(val || "—"), 3, 73)); });
        // 4. the characteristics made at this operation
        const rows = [["MADE AT THIS OPERATION — CHECK AS PER THE SOP"], ["No.", "Specification", "LSL", "USL", "Class", "Gauge"]], max = 34;
        const list = mine.slice().sort((a, b) => a - b).map((n) => chars.get(n)).filter(Boolean);
        for (const c of list.slice(0, max)) { const ck = st && (st.checks || []).find((x) => String(x.charNo) === String(c.no)); rows.push([String(c.no), fit(plain(c.spec || c.text || c.label || ""), 2.2, 34 - 2.4), c.lsl == null || c.lsl === "" ? "" : String(c.lsl), c.usl == null || c.usl === "" ? "" : String(c.usl), c.cls || "", fit(plain((ck && ck.gauge) || gName.get(c.gauge) || c.gauge || ""), 2.2, 30 - 2.4)]); }
        if (list.length > max) rows.push(["", `… ${list.length - max} more — see the SOP`, "", "", "", ""]);
        add({ t: "table", layer: "STG-TABLE", p: P0(A.TB.x0, A.TB.y1), h: 2.2 * f, rh: 5.6 * f, cw: [8, 34, 12.5, 12.5, 9, 30].map((w) => w * f), rows, title: true, hdr: true, al: ["c", "l", "r", "r", "c", "l"], rot: 0 });
        // legend
        const ly = 64; add({ t: "line", layer: "0", color: RED, lw: 0.5, a: P0(302, ly), b: P0(312, ly), stg: "this" }); T(314, ly - 0.9, 2.2, "Made at this operation (red balloon)", 0, "STG-TABLE");
        if (vec && opt.earlier !== "hide") { add({ t: "line", layer: "0", color: GREY, a: P0(302, ly - 6), b: P0(312, ly - 6), stg: "done" }); T(314, ly - 6.9, 2.2, "Made at earlier operations", 0, "STG-TABLE"); }
        const loose = vec && opt.loose !== "hide" ? E2.filter((e) => !e.stg && (e.t === "dim" || e.t === "fcf" || (e.t === "insert" && e.dimblock) || (e.t === "text" && e.dimtext))).length : 0;
        T(302, ly - 13, 2.2, vec ? (SRC.fromPdf ? "Dimensions of other operations are grey." : "Dimensions made at later operations are left out.") : "Drawing shown as ballooned.", 0, "STG-TABLE");
        T(302, ly - 18, 2.2, loose ? `Black dimensions (${loose}) are not linked to a characteristic.` : "Geometry is shown finished.", 0, "STG-TABLE");
        if (loose) T(302, ly - 23, 2.2, "Geometry is shown finished.", 0, "STG-TABLE");
        doc.ents.push(...E2);
        sheets.push({ opNo: o.opNo, opName: o.name, sheet: k + 1, of: pages.length, box: { x0: ox, y0: 0, x1: ox + PW * f, y1: PH * f } });
        ox += PW * f * 1.08;
      });
    });
    report.linked = assigned.size; report.unsure = (assigned.unsure || []).filter((no) => opOf.has(+no));
    doc.info = { stage: { pd: P.id, part: P.part_no || "", partName: P.part_name || "", freezeRev: P.freeze.rev, frozenAt: P.freeze.at, source: { kind: SRC.kind === "vector" ? "lines" : "picture", name: SRC.name || "", anchored: !!SRC.anchored }, raster: !vec, sheets, made: new Date().toISOString() } };
    return { doc, sheets, report, total: frozenChars.length };
  }

  /* ================= sheets → pictures for the SOP ================= */
  async function renderSheet(doc, sh, W, jpeg) {
    const b = sh.box, w = b.x1 - b.x0, h = b.y1 - b.y0, Hp = Math.round((W * h) / w), c = canvas(W, Hp), x = c.getContext("2d");
    const view = { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, s: W / w, W, H: Hp };
    const P = (col, wd) => K.canvasPainter(x, view, { fg: INK, light: true, lwt: true, ltscale: doc.ltscale, override: col, width: wd });
    const PP = { geom: P(INK), this: P(RED, 2), done: P(GREY), balloon: P(RED, 2), frame: P(INK), model: P(INK), stock: P(INK), tool: P("#0369a1", 1.4), clamp: P("#b45309", 1.4) };
    const ents = doc.ents.filter((e) => { const bb = K.bbox(e, doc); return bb && !(bb.x1 < b.x0 || bb.x0 > b.x1 || bb.y1 < b.y0 || bb.y0 > b.y1); });
    await K.imgReady(doc, ents);
    for (const e of ents) { if (K.noPlot(doc, e)) continue; const role = e.stg || (/^STG-BALLOON$/.test(e.layer) ? "balloon" : /^STG-/.test(e.layer) ? "frame" : "geom"); K.paint(PP[role] || PP.geom, e, doc); }
    return c.toDataURL(jpeg ? "image/jpeg" : "image/png", 0.86);
  }
  async function send(E) {
    const st = E.doc.info && E.doc.info.stage; if (!st) return E.err("This is not a set of stage drawings. Use STAGEDWG to make one.");
    E.msg("Drawing the stage sheets for the SOP…", "mu"); await new Promise((r) => setTimeout(r, 20));
    const ops = {}; let n = 0; const doc = E.data();   // model space, also when a layout tab is open
    for (const sh of st.sheets) { const img = await renderSheet(doc, sh, OUT_W, st.raster); (ops[String(sh.opNo)] = ops[String(sh.opNo)] || []).push({ img, sheet: sh.sheet, of: sh.of }); n++; }
    const r = await api.put(st.pd, { v: 1, freezeRev: st.freezeRev, freezeAt: st.frozenAt, part_no: st.part, source: st.source, ops });
    st.sentAt = (r && r.at) || new Date().toISOString();
    E.msg(`Sent ${n} stage drawing${n > 1 ? "s" : ""} for ${Object.keys(ops).length} operation${Object.keys(ops).length > 1 ? "s" : ""} to the SOP of ${st.part} (dimensions frozen as rev ${st.freezeRev}).`, "ok");
    if (K.stageBar && E._stage) K.stageBar(E);
    return n;
  }

  /* ================= dialogs ================= */
  async function pickProject(E) {
    E.msg("Reading Process Documents projects…", "mu");
    const L = await api.list();
    if (!L.length) { await E.dialog("Stage drawings for the SOP", `<p class="cx-note">No Process Documents project was found for your company. Make the process plan in Process Documents first (from the Balloon Inspector report), freeze the dimensions, then come back.</p><p class="cx-note"><a href="${esc(QP.appHref("pd"))}" target="_blank" rel="noopener">Open Process Documents ↗</a></p>`, null); return null; }
    return E.dialog("Stage drawings for the SOP — choose the part", `<p class="cx-note">Only parts whose dimensions are <b>frozen per operation</b> in Process Documents can have stage drawings (Process plan › Freeze dimensions).</p>
      <div style="max-height:52vh;overflow:auto"><table class="cx-tbl"><thead><tr><th></th><th>Part</th><th>Customer</th><th>Dimensions</th><th>Stage drawings</th></tr></thead><tbody>${L.map((p, i) => { const f = p.freeze;
        return `<tr><td><input type="radio" name="pp" value="${esc(p.id)}"${f ? "" : " disabled"}${f && !L.slice(0, i).some((x) => x.freeze) ? " checked" : ""}></td><td><b>${esc(p.part_no || "—")}</b> ${esc(p.part_name || "")}${p.rev ? " · rev " + esc(p.rev) : ""}</td><td>${esc(p.customer || "")}</td><td>${f ? `🔒 rev ${esc(String(f.rev))} · ${esc(dmy(f.at))}` : '<span class="cx-mu">not frozen</span>'}</td><td>${p.stages_at ? `${esc(dmy(p.stages_at))} (rev ${esc(String(p.stages_rev))})${f && String(p.stages_rev) !== String(f.rev) ? " ⚠ out of date" : ""}` : '<span class="cx-mu">none yet</span>'}</td></tr>`; }).join("")}</tbody></table></div>`,
      (b) => { const r = b.querySelector("input[name=pp]:checked"); if (!r) throw new Error(L.some((p) => p.freeze) ? "Choose a part." : "No part has frozen dimensions yet. Freeze them in Process Documents first."); return r.value; }, { width: "min(860px,96vw)", ok: "Next" });
  }
  async function pickSource(E, P) {
    const reg = (await QP.call("kmr_cad_list").catch(() => [])).filter((d) => d.status !== "superseded");
    const same = reg.filter((d) => P.part_no && d.part_no && String(d.part_no).toLowerCase() === String(P.part_no).toLowerCase());
    const others = reg.filter((d) => !same.includes(d)).slice(0, 200);
    const bi = P.bi && P.bi.file_path, openOk = E.doc.ents.length && !(E.doc.info && E.doc.info.stage);
    const hasBal = !!bi || !!(P.source && (P.source.items || []).some((i) => i.ax != null));
    const dflt = bi ? "bi" : same.length ? "reg:" + same[0].id : openOk ? "open" : "file";
    const opt = (v, label, note, dis) => `<label class="cx-chk" style="align-items:flex-start;margin:6px 0"><input type="radio" name="src" value="${esc(v)}"${v === dflt ? " checked" : ""}${dis ? " disabled" : ""}><span><b>${label}</b>${note ? `<br><span class="cx-mu">${note}</span>` : ""}</span></label>`;
    const regSel = (list) => list.map((d) => `<option value="reg:${esc(d.id)}">${esc(d.number)} rev ${esc(d.rev)} · ${esc(d.title || "")}${d.part_no ? " · " + esc(d.part_no) : ""}</option>`).join("");
    return E.dialog(`Stage drawings — ${P.part_no || ""} ${P.part_name || ""}`, `<p class="cx-note">Dimensions frozen as <b>rev ${esc(String(P.freeze.rev))}</b> on ${esc(dmy(P.freeze.at))} by ${esc(P.freeze.by || "")}: ${Object.keys(P.freeze.map || {}).length} operations make ${Object.values(P.freeze.map || {}).reduce((t, a) => t + a.length, 0)} characteristics.</p>
      <h4>What to draw</h4>
      <label class="cx-chk" style="align-items:flex-start;margin:6px 0"><input type="radio" name="sty" value="fin"${hasBal ? " checked" : ""}><span><b>The customer's ballooned drawing for each operation</b>${hasBal ? " (recommended)" : ""}<br><span class="cx-mu">The real shape of the part from the drawing, with every dimension made at the operation marked by its red balloon, and the table of those dimensions beside it. Earlier operations' dimensions are grey (when the drawing is DXF / DWG).</span></span></label>
      <label class="cx-chk" style="align-items:flex-start;margin:6px 0"><input type="radio" name="sty" value="flow"${hasBal ? "" : " checked"}><span><b>A sketch of the part at each process stage</b><br><span class="cx-mu">Raw material → sawing → CNC turning with clamping area, datum and tool path. The shape is a simple sketch you check and correct, so it may not match the drawing exactly.</span></span></label>
      <h4>Take the drawing from</h4>
      ${opt("bi", "The ballooned drawing from Balloon Inspector", bi ? esc(P.bi.file_name || "") + " — balloons go exactly where they were placed. DXF / DWG are drawn as lines (later operations' dimensions are left out); PDF and pictures as a picture." : "This project has no ballooned drawing stored.", !bi)}
      ${opt(same.length ? "reg:" + same[0].id : "reg", "A drawing in this register", (same.length ? "Same part number: " : "") + `<select id="regs" style="max-width:100%">${same.length ? regSel(same) : ""}${others.length ? `<optgroup label="Other drawings">${regSel(others)}</optgroup>` : ""}</select><br>Characteristics are found by their value and text.`, !reg.length)}
      ${opt("open", "The drawing open now", "Characteristics are found by their value and text.", !openOk)}
      ${opt("file", "A file from this computer (DXF, DWG, PDF, picture)", `<label class="cx-chk" style="margin-top:4px"><input type="checkbox" id="same"${P.source && (P.source.items || []).some((i) => i.ax != null) ? " checked" : " disabled"}> It is the same file that was ballooned (balloons go where they were placed)</label>`)}
      <h4>Show</h4><div class="cx-frm"><label>Earlier operations' dimensions<select id="early"><option value="grey">Grey</option><option value="hide">Hidden</option></select></label><label>Dimensions not linked to a characteristic<select id="loose"><option value="show">Shown (black)</option><option value="hide">Hidden</option></select></label></div>
      <label class="cx-chk"><input type="checkbox" id="sendNow" checked> Send them to the SOP straight away (you can edit and send again)</label>`,
      (b) => { const r = b.querySelector("input[name=src]:checked"); if (!r) throw new Error("Choose the drawing."); let how = r.value; if (/^reg/.test(how)) { const v = b.querySelector("#regs").value; if (!v) throw new Error("Choose a drawing from the register."); how = v; }
        if (how === "file" && b.querySelector("#same").checked) how = "file-same";
        return { how, style: b.querySelector("input[name=sty]:checked").value, earlier: b.querySelector("#early").value, loose: b.querySelector("#loose").value, send: b.querySelector("#sendNow").checked }; },
      { width: "min(760px,96vw)", ok: "Make stage drawings", init: (b) => { const s = b.querySelector("#regs"); if (s) s.onchange = () => { const r = b.querySelector('input[name=src][value^="reg"]'); if (r) { r.value = s.value; r.checked = true; } }; } });
  }

  /** a part read from a picture or PDF has no scale: scale it so the diameters of the table match the steps (and snap them to the table values) */
  function calibrate(prof, P) {
    const dia = [...new Set((P.chars || []).filter((c) => c.type === "Diameter" && !/PCD|THRU|^\d+\s*X/i.test(c.text || c.spec || "")).map((c) => firstNum(c.nominal != null && c.nominal !== "" ? c.nominal : c.spec)).filter((v) => v > 0))];
    if (!dia.length) return { prof, note: "" };
    const hit = (d, v) => Math.abs(d - v) <= Math.max(0.011, v * 0.02), score = (s) => dia.filter((v) => prof.steps.some((st) => hit(st.d * s, v))).length, r2 = (v) => Math.round(v * 100) / 100;
    let best = { s: 1, n: score(1) };
    for (const st of prof.steps) for (const v of dia) { const s = v / st.d, n = score(s); if (n > best.n || (n === best.n && best.s !== 1 && s > best.s)) best = { s, n }; }
    if (best.s === 1 && best.n === 0) { const mx = Math.max(...prof.steps.map((x) => x.d)), md = Math.max(...dia); if (Math.abs(mx - md) > md * 0.05) best = { s: md / mx, n: 0 }; }
    const snap = (d) => { const v = dia.find((x) => hit(d, x)); return v != null ? v : r2(d); };
    const k = best.s;
    if (Math.abs(k - 1) < 1e-6 && best.n === 0) return { prof, note: "" };
    const steps = prof.steps.map((x) => ({ d: snap(x.d * k), l: r2(x.l * k) })), bore = prof.bore ? { d: snap(prof.bore.d * k), depth: r2(prof.bore.depth * k), end: prof.bore.end } : null;
    return { prof: Object.assign({}, prof, { steps, bore, L: r2(steps.reduce((t, x) => t + x.l, 0)) }), note: Math.abs(k - 1) > 1e-6 ? ` The drawing has no scale, so it was scaled ×${r2(k)} to make its diameters match the diameters in the table.` : "" };
  }

  /** process-stage drawings (cad-stage-flow.js): the part's shape from the drawing, checked by the user */
  async function flowBuild(E, P, SRC, say) {
    const F = K.stageFlow; if (!F) throw new Error("The stage-flow module did not load. Reload the page.");
    let prof = null, how = "", scaleNote = "";
    try {
      let doc = SRC.kind === "vector" ? SRC.doc : null;
      if (!doc && SRC.file && K.vec) { say("Converting the picture of the drawing to CAD to find the shape of the part…"); const r = await K.vec.convert(SRC.file, { ocr: false, keep: false, page: 1 }, say); doc = K.newDoc(false); K.vec.intoDoc(doc, r, 0, 0, 1); }
      if (doc) { say("Finding the shape of the part…"); prof = F.silhouette(doc); }
      if (prof) { const cal = calibrate(prof, P); prof = cal.prof; scaleNote = cal.note; }
    } catch (e) { prof = null; how = " (" + e.message + ")"; }
    const fromDrawing = !!prof; if (!prof) prof = F.fromPlan(P);
    const model = Object.assign({}, prof, F.defaults(P, prof));
    const note = fromDrawing ? `The shape was read from <b>${esc(SRC.name || "the drawing")}</b> (${prof.steps.length} step${prof.steps.length > 1 ? "s" : ""}, length ${prof.L} mm${prof.bore ? ", bore Ø" + prof.bore.d : ""}). Check it against the drawing — correct any number that is wrong.${scaleNote}` : `The shape could not be read from the drawing${how}, so a plain bar of the largest diameter is shown. <b>Type the steps of your part</b> (diameter and length from the left end).`;
    const m = await F.dialog(E, P, model, note); if (!m) return null;
    Object.assign(m, F.defaults(P, { steps: m.steps, bore: m.bore }), { steps: m.steps, bore: m.bore, D0: m.D0, fa: m.fa, clamp: m.clamp, first: m.first, bar: m.bar, L: m.steps.reduce((t, s) => t + s.l, 0), maxD: Math.max(...m.steps.map((x) => x.d)) });
    // the first turned end is drawn at the left
    if (m.first === "R") { m.steps = m.steps.slice().reverse(); if (m.bore) m.bore = Object.assign({}, m.bore, { end: m.bore.end === "L" ? "R" : "L" }); }
    say("Drawing the stages…"); await new Promise((r) => setTimeout(r, 20));
    const R = F.build(P, m, {});
    const used = new Set(); for (const o of P.ops || []) for (const n of (P.freeze.map || {})[String(o.opNo)] || []) used.add(+n);
    R.report.unsure = []; R.total = used.size;
    R.doc.info = { stage: { pd: P.id, part: P.part_no || "", partName: P.part_name || "", freezeRev: P.freeze.rev, frozenAt: P.freeze.at, source: { kind: "stages", name: SRC.name || "", anchored: false }, raster: false, flow: true, shape: { steps: m.steps, bore: m.bore, D0: m.D0 }, sheets: R.sheets, made: new Date().toISOString() } };
    return R;
  }

  /* ================= commands ================= */
  async function make(E, args) {
    if (!QP.canEdit) return E.err("You have view-only access to CAD Draft, so you cannot make stage drawings. Ask your administrator for editor access.");
    if (E.space && E.space.lay && !E.space.ms) return E.err("Stage drawings are made in model space (Model tab).");
    let id = args && args.pd; if (!id) { id = await pickProject(E); if (!id) return; }
    E.msg("Reading the frozen process plan…", "mu");
    const P = await api.get(id);
    const fs = freezeState(P);
    if (fs === "none") return E.dialog("Dimensions not frozen", `<p class="cx-note">Freeze the dimensions per operation in Process Documents first (Process plan › <b>Freeze dimensions</b>), then make the stage drawings.</p><p class="cx-note"><a href="${esc(QP.appHref("pd", { project: id, hash: "go=plan&prj=" + id }))}" target="_blank" rel="noopener">Open the process plan ↗</a></p>`, null);
    if (fs === "changed") return E.dialog("Changed after freeze", `<p class="cx-note">The process plan of ${esc(P.part_no || "")} changed after the dimensions were frozen as rev ${esc(String(P.freeze.rev))}. Freeze them again in Process Documents so the stage drawings and the SOP match.</p><p class="cx-note"><a href="${esc(QP.appHref("pd", { project: id, hash: "go=plan&prj=" + id }))}" target="_blank" rel="noopener">Open the process plan ↗</a></p>`, null);
    const o = await pickSource(E, P); if (!o) return;
    if (E.dirty && !E.readOnly && !confirm("The drawing open now has changes that are not saved. Make the stage drawings anyway? They open in place of it (save the drawing first if you need the changes).")) return;
    let file = null; if (o.how === "file" || o.how === "file-same") { file = await K.pickFile(".dxf,.dwg,.pdf,.png,.jpg,.jpeg,.json"); if (!file) return; }
    const say = (m) => E.msg(m, "mu");
    const SRC = await loadSource(E, P, o.how, file, say);
    if (o.how === "file-same" && !SRC.anchored && SRC.kind === "vector") E.msg("The balloons could not be lined up with this file, so characteristics are found by their value and text instead.", "mu");
    say("Drawing the stage sheets…"); await new Promise((r) => setTimeout(r, 20));
    const R = o.style === "flow" ? await flowBuild(E, P, SRC, say) : buildSet(P, SRC, o);
    if (!R) return;
    if (!R.sheets.length) return E.err("No operation makes a ballooned characteristic, so there is nothing to draw.");
    // the set opens here as a new, unsaved drawing
    if (window.KCADShell) window.KCADShell.cur = null;
    E._scratch = true; E._stage = { pd: P.id, part: P.part_no, name: P.part_name };
    E.load(R.doc, { title: `Stage drawings ${P.part_no || ""} (freeze rev ${P.freeze.rev})`, part: P.part_no, company: QP.ctx && QP.ctx.company });
    E.readOnly = null;
    try { history.replaceState(null, "", location.pathname + location.search + "#go=ed"); } catch (e) { /* ignore */ }
    if (K.stageBar) K.stageBar(E);
    const rep = R.report, miss = [...new Set(rep.missing)];
    if (rep.unsure && rep.unsure.length) E.msg(`Check balloons #${rep.unsure.join(", #")}: the same value is on the drawing more than once, so the first one was used. Move the balloon if it is on the wrong dimension, then Send to SOP.`, "er");
    if (SRC.kind === "raster" && SRC.pages.length > 1 && !SRC.anchored) E.msg(`Only sheet 1 of ${SRC.pages.length} is used, because the file has no balloon positions.`, "mu");
    E.msg(`Made ${R.sheets.length} stage sheet${R.sheets.length > 1 ? "s" : ""} for ${new Set(R.sheets.map((s) => s.opNo)).size} operations from ${SRC.name}. ${rep.ballooned != null ? rep.ballooned : rep.balloons} balloons placed${SRC.kind === "vector" ? `, ${rep.linked} dimensions linked` : ""}${SRC.fitted ? " (balloons lined up from matching dimensions)" : ""}.`, "ok");
    if (SRC.kind === "raster" && !SRC.anchored) E.msg("A PDF or picture that was not ballooned has no balloon positions, so the sheets show the drawing and the table only. Choose the ballooned drawing to get the balloons.", "mu");
    else if (miss.length) E.msg(`Not found on the drawing — listed in the table only: #${miss.join(", #")}. Add the balloons by hand if needed, then Send to SOP.`, "er");
    if (o.send) await send(E);
    else E.msg("Check the sheets, then use Send to SOP (STAGESEND).", "mu");
  }
  cmd("STAGEDWG", { a: ["STAGE", "STAGES", "STG"], d: "Stage drawings for the SOP: one sheet per operation from the dimensions frozen in Process Documents", norepeat: true, fn: async (E, args) => {
    try { await make(E, args); } catch (e) { if (e === K.CANCEL) throw e; E.err(e.message || String(e)); }
  } });
  cmd("STAGESEND", { a: ["STGSEND"], d: "Send the stage drawings to the SOP in Process Documents", norepeat: true, fn: async (E) => { try { await send(E); } catch (e) { E.err(e.message || String(e)); } } });
  cmd("STAGESOP", { a: [], d: "Open the SOP of the part in Process Documents (new tab)", norepeat: true, fn: async (E) => { const st = E.doc.info && E.doc.info.stage; if (!st) return E.err("Open a set of stage drawings first (STAGEDWG)."); window.open(sopHref(st.pd), "_blank", "noopener"); } });

  /* ================= editor bar while a set is open ================= */
  K.stageBar = (E, el) => {
    el = el || document.getElementById("edbar"); const st = E.doc.info && E.doc.info.stage; if (!el || !st) return;
    el.className = "edbar"; el.classList.remove("hide");
    el.innerHTML = `<b>Stage drawings · ${esc(st.part)}</b> <span>freeze rev ${esc(String(st.freezeRev))} · ${st.sheets.length} sheet${st.sheets.length > 1 ? "s" : ""} · ${esc(st.source.name || "")}</span><span style="flex:1"></span>${st.sentAt ? `<span class="mut">Sent to the SOP ${esc(new Date(st.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}</span>` : '<span class="mut">Not sent to the SOP yet</span>'}<button class="btn s" data-st="send">Send to SOP</button><button class="btn s o" data-st="save" title="Keep this set in the drawing register">Save as drawing</button>${/^pd-sample/.test(st.pd) ? '<span class="mut">(sample part — in your workspace the SOP opens in Process Documents)</span>' : `<a class="btn s o" href="${esc(sopHref(st.pd))}" target="_blank" rel="noopener">Open the SOP ↗</a>`}`;
    el.querySelector('[data-st="send"]').onclick = () => E.run("STAGESEND");
    el.querySelector('[data-st="save"]').onclick = () => E.run("SAVEAS");
  };
  K.editorHooks = K.editorHooks || [];
  K.editorHooks.push((E) => { K.imgListeners.push(() => E.redraw()); });

  /* ================= ribbon ================= */
  K.RIBBON.push({ t: "Process", g: [
    { n: "Stage drawings for the SOP", b: [["STAGEDWG", "Make stage drawings", "title"], ["STAGESEND", "Send to SOP", "exportI"], ["STAGESOP", "Open the SOP", "open"]] },
  ] });

  K.stageBuild = buildSet; K.stageRender = renderSheet; K.stageLoad = loadSource; K.stageCalibrate = calibrate; K.stageCrop = cropPages;
})((window.KCAD = window.KCAD || {}));
