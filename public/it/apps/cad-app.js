/* KMR CAD Draft — the drawing editor: canvas view, command line, object snaps, ortho / polar, selection,
   grips, undo / redo, ribbon, properties / layers / blocks panels, dialogs. Commands live in cad-cmds.js. */
(function (K) {
  "use strict";
  const G = K.geom, D2R = Math.PI / 180, CANCEL = { cancel: true };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (s) => /^\s*[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?\s*$/i.test(s) ? parseFloat(s) : NaN;
  const evalNum = (s) => { s = String(s).trim(); const n = num(s); if (!isNaN(n)) return n; if (/^[\d\s.+\-*/()]+$/.test(s)) { try { const v = Function('"use strict";return (' + s + ")")(); if (isFinite(v)) return v; } catch (e) { /* not a number */ } } return NaN; };
  K.CANCEL = CANCEL; K.esc = esc; K.evalNum = evalNum;
  K.CMDS = K.CMDS || {};
  /** register a command: name, {a: aliases, d: description, fn: async (E, args) => {}} */
  K.cmd = (name, o) => { K.CMDS[name] = Object.assign({ a: [], d: "" }, o, { name }); };

  const ICON = {
    line: "M4 20 20 4", pline: "M3 19 9 9l5 6 7-11", circle: "M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18M12 12h.1", arc: "M4 18A10 10 0 0 1 20 18", rect: "M4 6h16v12H4z", polygon: "M12 3l8.5 6-3.2 10H6.7L3.5 9z",
    ellipse: "M12 6c5 0 9 2.7 9 6s-4 6-9 6-9-2.7-9-6 4-6 9-6z", spline: "M3 17c4-12 7 6 10-3s5-7 8-6", hatch: "M4 4h16v16H4zM4 12 12 4M4 20 20 4M12 20l8-8", point: "M12 12m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M7 7l10 10M17 7 7 17", xline: "M2 18 22 6M12 12h.1",
    move: "M12 3v18M3 12h18M12 3l-3 3m3-3 3 3M12 21l-3-3m3 3 3-3M3 12l3-3m-3 3 3 3M21 12l-3-3m3 3-3 3", copy: "M8 8h12v12H8zM4 16V4h12", rotate: "M20 12a8 8 0 1 1-3-6.2M20 4v5h-5", scale: "M4 20h7v-7H4zM10 14 20 4M14 4h6v6",
    mirror: "M12 2v20M9 6 3 18h6zM15 6l6 12h-6z", offset: "M4 18 18 4M8 20l12-12", trim: "M6 4l12 16M4 12h7M15 12h5", extend: "M3 12h13M19 4v16M13 9l3 3-3 3", fillet: "M4 20V11a7 7 0 0 1 7-7h9", chamfer: "M4 20V10l6-6h10",
    array: "M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z", stretch: "M3 16h12l3-8h3M3 8h6M12 4v4m0 8v4", brk: "M3 12h7M14 12h7M10 9l4 6", join: "M3 15h7l4-6h7", explode: "M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3", erase: "M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13",
    text: "M5 5h14M12 5v14M9 19h6", mtext: "M4 5h16M4 10h16M4 15h10M4 20h12", dimlin: "M4 6v12M20 6v12M4 12h16M4 12l3-2m-3 2 3 2M20 12l-3-2m3 2-3 2", dimali: "M4 16 16 4M7 19 19 7M6 18l12-12", dimrad: "M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M12 12l6-6", dimdia: "M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M6 18 18 6", dimang: "M4 20h16M4 20 16 6M12 20a8 8 0 0 0-2.5-6", leader: "M4 20l8-8h8M4 20l1-4m-1 4 4-1",
    layer: "M12 3 2 8l10 5 10-5zM2 13l10 5 10-5M2 17l10 5 10-5", props: "M4 6h16M4 12h10M4 18h13", match: "M14 4l6 6-9 9H5v-6zM3 21h7", measure: "M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2", area: "M4 4h10l6 6v10H4z",
    block: "M4 4h7v7H4zM13 13h7v7h-7zM13 4h7v7h-7z", insert: "M12 3v12M8 11l4 4 4-4M4 21h16", title: "M3 3h18v18H3zM12 15h9M12 18h9M12 15v6", zoomE: "M10 10m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M14.5 14.5 20 20M7 10h6M10 7v6", zoomW: "M3 3h8v8H3zM10 10m-0 0M14 14l7 7", pan: "M12 3v18M3 12h18",
    undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3", redo: "M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3", open: "M3 7h6l2 2h10v10H3z", save: "M5 3h11l3 3v15H5zM8 3v6h7V3M8 21v-7h8v7", print: "M6 9V3h12v6M6 18H3v-8h18v8h-3M7 14h10v7H7z", exportI: "M12 15V3M8 7l4-4 4 4M4 15v6h16v-6",
    newf: "M6 3h9l4 4v14H6zM14 3v5h5", help: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17h.1", units: "M4 20h16M4 20V8M8 20v-4M12 20v-6M16 20v-4M20 20V8", dimstyle: "M4 6v12M20 6v12M4 12h16M9 4h6", sel: "M4 4h6M14 4h6M4 20h6M14 20h6M4 4v6M4 14v6M20 4v6M20 14v6",
    gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
    side: "M3 4h18v16H3zM15 4v16", divide: "M3 12h18M7 9v6M12 9v6M17 9v6", list: "M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1", iso: "M12 3 2 8l10 5 10-5zM12 13v8", donut: "M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0",
  };
  const svgI = (k) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${ICON[k] || ICON.help}"/></svg>`;
  K.icon = svgI;

  const COLORS = [["ByLayer", null], ["ByBlock", "byblock"], ["Red", "#ff0000"], ["Yellow", "#ffff00"], ["Green", "#00ff00"], ["Cyan", "#00ffff"], ["Blue", "#0000ff"], ["Magenta", "#ff00ff"], ["White / black", "#ffffff"], ["Grey", "#808080"], ["Light grey", "#c0c0c0"], ["Orange", "#ff7f00"], ["Brown", "#a5522a"]];
  const SNAPS = [["end", "Endpoint"], ["mid", "Midpoint"], ["cen", "Centre"], ["qua", "Quadrant"], ["int", "Intersection"], ["per", "Perpendicular"], ["tan", "Tangent"], ["nea", "Nearest"], ["node", "Node"], ["ins", "Insertion"]];

  K.Editor = function (root, opts) {
    opts = opts || {};
    const E = { root, opts, doc: K.newDoc(), sel: [], CANCEL, lastPt: [0, 0], lastCmd: "", dirty: false };
    let prefs = {}; try { prefs = JSON.parse(localStorage.getItem("kcad-prefs") || "{}"); } catch (e) { prefs = {}; }
    E.set = Object.assign({ osnap: true, snaps: { end: 1, mid: 1, cen: 1, qua: 0, int: 1, per: 1, tan: 0, nea: 0, node: 1, ins: 1 }, ortho: false, polar: true, otrack: true, pickgroup: true, polarInc: 15, grid: true, snap: false, snapUnit: 10, gridUnit: 10, dyn: true, lwt: false, light: false, cross: 100, pick: 5 }, prefs);
    const savePrefs = () => { try { localStorage.setItem("kcad-prefs", JSON.stringify(E.set)); } catch (e) { /* private mode */ } };
    E.cur = { layer: "0", color: null, lt: null, lw: null };
    E.view = { cx: 0, cy: 0, s: 3, W: 800, H: 600 };
    const undoS = [], redoS = [], viewStack = [];
    let R = null; // the pending input request
    let mouse = { sp: [0, 0], wp: [0, 0], snap: null, inside: false, track: null }, win = null, hoverId = null, hoverGrip = null, ptrs = new Map(), pinch = null, panDrag = null, downAt = null;

    /* ---------------- DOM ---------------- */
    root.classList.add("cx");
    root.innerHTML = `
<div class="cx-qa"><button data-c="NEW" title="New drawing (Ctrl+N)">${svgI("newf")}</button><button data-c="OPEN" title="Open a DXF or KMR CAD file (Ctrl+O)">${svgI("open")}</button><button data-c="QSAVE" title="Save (Ctrl+S)">${svgI("save")}</button><button data-c="PLOT" title="Print / PDF (Ctrl+P)">${svgI("print")}</button><span class="cx-sep"></span><button data-c="U" title="Undo (Ctrl+Z)">${svgI("undo")}</button><button data-c="REDO" title="Redo (Ctrl+Y)">${svgI("redo")}</button><span class="cx-sep"></span><b class="cx-title"></b><span class="cx-saved"></span><span style="flex:1"></span><button class="cx-help" data-c="HELP" title="All commands">${svgI("help")}<span>Commands</span></button><button class="cx-sidebtn" data-act="side" title="Show / hide the side panel">${svgI("side")}</button></div>
<div class="cx-rtabs"></div><div class="cx-ribbon"></div>
<div class="cx-main"><div class="cx-cw"><canvas class="cx-c0"></canvas><canvas class="cx-c1" tabindex="-1"></canvas><div class="cx-dyn"></div><div class="cx-menu"></div><div class="cx-hint"></div></div>
<aside class="cx-side"><div class="cx-stabs"><button data-p="props" class="on">Properties</button><button data-p="layers">Layers</button><button data-p="blocks">Blocks</button><button data-p="cmds">Commands</button></div><div class="cx-panel"></div></aside></div>
<div class="cx-cmd"><div class="cx-hist"></div><div class="cx-line"><span class="cx-pr">Command:</span><span class="cx-kws"></span><input class="cx-in" data-nospell autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type a command or pick a tool"></div><div class="cx-ac"></div></div>
<div class="cx-status"><span class="cx-spaces"></span><span class="cx-xy">0.00, 0.00</span><span class="cx-tg"></span><span class="cx-info"></span></div>
<div class="cx-modal"><div class="cx-dlg"></div></div>`;
    const $ = (s) => root.querySelector(s);
    const c0 = $(".cx-c0"), c1 = $(".cx-c1"), x0 = c0.getContext("2d"), x1 = c1.getContext("2d"), inp = $(".cx-in"), hist = $(".cx-hist"), ac = $(".cx-ac"), dyn = $(".cx-dyn"), menu = $(".cx-menu"), hint = $(".cx-hint");
    E.$ = $;

    /* ---------------- view ---------------- */
    const w2s = (p) => [(p[0] - E.view.cx) * E.view.s + E.view.W / 2, E.view.H / 2 - (p[1] - E.view.cy) * E.view.s];
    const s2w = (p) => [(p[0] - E.view.W / 2) / E.view.s + E.view.cx, (E.view.H / 2 - p[1]) / E.view.s + E.view.cy];
    E.w2s = w2s; E.s2w = s2w;
    let dpr = 1;
    const resize = () => {
      const r = c0.parentElement.getBoundingClientRect(); dpr = window.devicePixelRatio || 1;
      E.view.W = Math.max(50, r.width); E.view.H = Math.max(50, r.height);
      for (const c of [c0, c1]) { c.width = Math.round(E.view.W * dpr); c.height = Math.round(E.view.H * dpr); c.style.width = E.view.W + "px"; c.style.height = E.view.H + "px"; }
      redraw();
    };
    new ResizeObserver(resize).observe(c0.parentElement);
    E.pushView = () => { viewStack.push({ cx: E.view.cx, cy: E.view.cy, s: E.view.s }); if (viewStack.length > 30) viewStack.shift(); };
    E.zoomBox = (b, margin = 0.06) => { if (!b) return; E.pushView(); const w = Math.max(b.x1 - b.x0, 1e-6), h = Math.max(b.y1 - b.y0, 1e-6); E.view.s = Math.min(E.view.W / w, E.view.H / h) * (1 - 2 * margin); if (!isFinite(E.view.s) || E.view.s <= 0) E.view.s = 1; E.view.cx = (b.x0 + b.x1) / 2; E.view.cy = (b.y0 + b.y1) / 2; redraw(); };
    E.zoomExt = () => {
      if (E.space && E.space.lay && !E.space.ms && K.paperWH) { const [W, H] = K.paperWH(E.layoutOf(E.space.lay)); return E.zoomBox({ x0: 0, y0: 0, x1: W, y1: H }, 0.04); }
      if (E.space && E.space.ms && E.fitVp) return E.fitVp(); const b = K.extents(E.doc); if (b) { if (b.x1 - b.x0 < 1e-9 && b.y1 - b.y0 < 1e-9) { b.x0 -= 50; b.x1 += 50; b.y0 -= 50; b.y1 += 50; } E.zoomBox(b); } else E.zoomBox({ x0: 0, y0: 0, x1: 297, y1: 210 }); };
    E.zoomPrev = () => { const v = viewStack.pop(); if (v) { Object.assign(E.view, v); redraw(); } };
    E.zoomAt = (sp, f) => { const w = s2w(sp); E.view.s = Math.min(1e6, Math.max(1e-6, E.view.s * f)); const w2 = s2w(sp); E.view.cx += w[0] - w2[0]; E.view.cy += w[1] - w2[1]; redraw(); };

    /* ---------------- document + undo ---------------- */
    const snapshot = () => ({ _active: E.doc._active, modelEnts: E.doc.modelEnts, layouts: (E.doc.layouts || []).map((l) => Object.assign({}, l, { ents: (l.ents || []).slice() })), dimstyles: E.doc.dimstyles, dimcur: E.doc.dimcur, annoScale: E.doc.annoScale, ents: E.doc.ents.slice(), layers: JSON.parse(JSON.stringify(E.doc.layers)), blocks: Object.assign({}, E.doc.blocks), dim: Object.assign({}, E.doc.dim), text: Object.assign({}, E.doc.text), units: E.doc.units, ltscale: E.doc.ltscale, pdmode: E.doc.pdmode, pdsize: E.doc.pdsize, cur: Object.assign({}, E.cur) });
    const restore = (s) => { if (s._active !== E.doc._active && E.onSpaceRestore) E.onSpaceRestore(s._active); Object.assign(E.doc, { _active: s._active, modelEnts: s.modelEnts, layouts: s.layouts, dimstyles: s.dimstyles, dimcur: s.dimcur, annoScale: s.annoScale, ents: s.ents, layers: s.layers, blocks: s.blocks, dim: s.dim, text: s.text, units: s.units, ltscale: s.ltscale, pdmode: s.pdmode, pdsize: s.pdsize }); E.cur = s.cur; if (!E.doc.layers.find((l) => l.name === E.cur.layer)) E.cur.layer = E.doc.layers[0].name; };
    let inTx = 0, txSnap = null, txLabel = "";
    E.begin = (label) => { if (E.readOnly && !inTx) throw new Error(E.readOnly); if (!inTx++) { txSnap = snapshot(); txLabel = label || E.lastCmd || "edit"; } };
    E.end = () => { if (--inTx === 0) { undoS.push(Object.assign(txSnap, { label: txLabel })); if (undoS.length > 200) undoS.shift(); redoS.length = 0; txSnap = null; changed(); } };
    E.tx = (label, fn) => { E.begin(label); try { return fn(); } finally { E.end(); } };
    E.undo = () => { if (!undoS.length) return E.msg("Nothing to undo."); const s = undoS.pop(); redoS.push(Object.assign(snapshot(), { label: s.label })); restore(s); E.sel = E.sel.filter((id) => E.byId(id)); E.msg("Undo: " + s.label); changed(); };
    E.redo = () => { if (!redoS.length) return E.msg("Nothing to redo."); const s = redoS.pop(); undoS.push(Object.assign(snapshot(), { label: s.label })); restore(s); E.sel = E.sel.filter((id) => E.byId(id)); E.msg("Redo: " + s.label); changed(); };
    const changed = () => { E.dirty = true; idx = null; redraw(); refreshSide(); refreshLayerBox(); setSaved(); if (opts.onChange) opts.onChange(E); };
    E.changed = changed;
    let idx = null; // id → entity
    E.reindex = () => { idx = null; };
    E.byId = (id) => { if (!idx) { idx = new Map(); for (const e of E.doc.ents) idx.set(e.id, e); } return idx.get(id); };
    E.layerOf = (e) => K.layer(E.doc, e.layer);
    E.editable = (e) => { const L = E.layerOf(e); return L.on !== false && !L.frozen && !L.lock; };
    E.visible = (e) => { const L = E.layerOf(e); return L.on !== false && !L.frozen; };
    E.add = (e, keepProps) => {
      if (!inTx) return E.tx("add", () => E.add(e, keepProps));
      const n = Object.assign({}, e);
      for (const k of ["layer", "color", "lt", "lw"]) if (n[k] === undefined || (k === "layer" && !n.layer)) n[k] = E.cur[k];
      n.id = e.id && !E.byId(e.id) ? e.id : K.uid();
      for (const h of K.onAdd || []) h(E, n);
      E.doc.ents = E.doc.ents.concat([n]); idx = null; E.lastEnt = n.id; redraw(); return n;
    };
    E.replace = (id, n) => { if (!inTx) return E.tx("edit", () => E.replace(id, n)); n = Object.assign({}, n, { id }); E.doc.ents = E.doc.ents.map((e) => (e.id === id ? n : e)); idx = null; redraw(); return n; };
    E.remove = (ids) => { if (!inTx) return E.tx("erase", () => E.remove(ids)); const s = new Set(ids); E.doc.ents = E.doc.ents.filter((e) => !s.has(e.id)); E.sel = E.sel.filter((i) => !s.has(i)); idx = null; redraw(); };
    E.load = (doc, info) => {
      E.doc = Object.assign(K.newDoc(false), doc); E.doc.dim = Object.assign(K.newDoc().dim, doc.dim || {}); E.doc.text = Object.assign({ h: 2.5 }, doc.text || {});
      if (!E.doc.layers || !E.doc.layers.length) E.doc.layers = K.newDoc().layers;
      E.doc.ents = (E.doc.ents || []).map((e) => (e.id ? e : Object.assign(e, { id: K.uid() })));
      E.doc.layouts = (E.doc.layouts || []).map((l) => Object.assign({}, l, { ents: (l.ents || []).map((e) => (e.id ? e : Object.assign(e, { id: K.uid() }))) })); E.doc._active = "model"; delete E.doc.modelEnts; if (E.onLoad) E.onLoad();
      E.info = info || E.info || {}; E.sel = []; undoS.length = 0; redoS.length = 0; idx = null; E.cur = { layer: E.doc.layers[0].name, color: null, lt: null, lw: null };
      if (E.doc.cur && E.doc.layers.find((l) => l.name === E.doc.cur)) E.cur.layer = E.doc.cur;
      E.dirty = false; resize(); E.zoomExt(); viewStack.length = 0; refreshSide(); refreshLayerBox(); setTitle(); setSaved();
    };
    E.data = () => {
      const d = Object.assign({}, E.doc, { cur: E.cur.layer }), act = E.doc._active || "model";
      d.ents = act === "model" ? E.doc.ents : E.doc.modelEnts || [];
      d.layouts = (E.doc.layouts || []).map((l) => Object.assign({}, l, { ents: act === l.id ? E.doc.ents : l.ents || [] }));
      delete d._active; delete d.modelEnts; return d;
    };
    E.setTitle = (t) => { E.info = Object.assign(E.info || {}, { title: t }); setTitle(); };
    const setTitle = () => { $(".cx-title").textContent = (E.info && (E.info.number ? E.info.number + " · " : "") + (E.info.title || "Untitled")) || "Untitled"; };
    const setSaved = () => { $(".cx-saved").textContent = E.dirty ? "● not saved" : E.savedAt ? "saved " + E.savedAt : ""; $(".cx-saved").classList.toggle("dirty", !!E.dirty); };
    E.markSaved = () => { E.dirty = false; E.savedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); setSaved(); };

    /* ---------------- messages + command line ---------------- */
    const lines = [];
    E.msg = (t, cls) => { lines.push([String(t), cls || ""]); if (lines.length > 400) lines.shift(); hist.innerHTML = lines.slice(-60).map((l) => `<div class="${l[1].split(" ").filter(Boolean).map((c) => "h-" + c).join(" ")}">${esc(l[0])}</div>`).join(""); hist.scrollTop = hist.scrollHeight; };
    E.err = (t) => E.msg(t, "er");
    const setPrompt = (text, kws, dflt) => {
      $(".cx-pr").textContent = text || "Command:";
      $(".cx-kws").innerHTML = (kws || []).map((k) => `<button data-kw="${esc(k)}">${esc(k)}</button>`).join("") ;
    };
    $(".cx-kws").addEventListener("click", (e) => { const b = e.target.closest("button[data-kw]"); if (b) { submit(b.dataset.kw); inp.focus(); } });

    /* ---------------- input requests ---------------- */
    const ask = (kind, msg, o) => new Promise((resolve, reject) => {
      o = o || {};
      const auto = !o.kws && /\[([^\]]+)\]/.exec(String(msg).replace(/<[^>]*>/g, "")); if (!o.kws) o.kws = auto ? auto[1].split("/").map((k) => k.trim()).filter(Boolean) : [];
      R = Object.assign({ kind, msg, resolve, reject }, o);
      setPrompt(msg, R.kws, o.dflt);
      E.msg(msg, "pr");
      drawOverlay();
    });
    let acq = [], hoverSnap = {}, acqT = 0;
    const done = (v) => { if (Array.isArray(v)) acq = []; const r = R; R = null; setPrompt(cmdRunning ? "" : "Command:"); r.resolve(v); drawOverlay(); };
    E.getPoint = (msg, o) => ask("point", msg, o).then((v) => { if (Array.isArray(v)) E.lastPt = v; return v; });
    E.getDist = async (msg, o) => { o = o || {}; const v = await ask("dist", msg, o); if (Array.isArray(v)) { if (o.base) return G.dist(o.base, v); const q = await E.getPoint("Specify second point:", { base: v }); if (q == null || q.kw) return null; return G.dist(v, q); } return v; };
    E.getAngle = async (msg, o) => { o = o || {}; const v = await ask("angle", msg, o); if (Array.isArray(v)) { if (o.base) return G.ang(o.base, v); const q = await E.getPoint("Specify second point:", { base: v }); if (q == null || q.kw) return null; return G.ang(v, q); } return typeof v === "number" ? v * D2R : v; };
    E.getNum = (msg, o) => ask("num", msg, o);
    E.getText = (msg, o) => ask("text", msg, o);
    E.getKw = (msg, kws, dflt) => ask("kw", msg, { kws, dflt });
    E.getEnt = (msg, o) => ask("ent", msg, o);
    E.getSel = async (msg, o) => {
      o = o || {};
      if (o.pre !== false && E.sel.length && !o.fresh) { const s = E.sel.filter((id) => { const e = E.byId(id); return e && E.editable(e) && (!o.filter || o.filter(e)); }); E.msg(s.length + " found"); E.sel = []; drawOverlay(); return s; }
      E.sel = []; selMode = "add";
      const v = await ask("sel", msg || "Select objects:", Object.assign({ kws: ["All", "Last", "Previous", "Remove", "Add"] }, o));
      const out = E.sel.slice(); E.sel = []; drawOverlay(); if (out.length) E.prevSel = out; return v && v.kw === "Cancel" ? [] : out;
    };
    let selMode = "add";
    E.preview = (fn) => { if (R) { R.preview = fn; drawOverlay(); } };

    /* parse what was typed for the current request */
    const parsePoint = (t, base) => {
      t = t.trim();
      let m, rel = false;
      if (t[0] === "@") { rel = true; t = t.slice(1).trim(); } else if (t[0] === "#") t = t.slice(1).trim();
      const ref = base || E.lastPt;
      if ((m = t.match(/^([-+]?[\d.]+(?:e[-+]?\d+)?)\s*[,\s]\s*([-+]?[\d.]+(?:e[-+]?\d+)?)$/i))) { const p = [parseFloat(m[1]), parseFloat(m[2])]; return rel ? G.add(E.lastPt || ref, p) : p; }
      if ((m = t.match(/^([-+]?[\d.]+)\s*<\s*([-+]?[\d.]+)$/))) { const d = parseFloat(m[1]), a = parseFloat(m[2]) * D2R; return G.polar(rel ? E.lastPt || ref || [0, 0] : [0, 0], a, d); }
      if (rel && t === "") return E.lastPt;
      const d = evalNum(t);
      if (!isNaN(d) && base) { let dir = G.sub(cursorPoint(), base); if (G.len(dir) < 1e-12) dir = [1, 0]; return G.add(base, G.mul(G.unit(dir), d)); }
      return null;
    };
    const matchKw = (t) => { if (!R || !R.kws) return null; const u = t.trim().toUpperCase(); if (!u) return null; for (const k of R.kws) { const cap = (k.match(/[A-Z]/g) || [k[0].toUpperCase()]).join(""); if (k.toUpperCase() === u || cap === u || (u.length >= 1 && k.toUpperCase().startsWith(u))) return k; } return null; };
    const submit = (raw) => {
      const t = String(raw == null ? inp.value : raw); inp.value = ""; hideAC();
      if (grip && !R) { /* handled by request */ }
      if (!R) { // a new command
        const s = t.trim(); if (!s) { if (E.lastCmd) E.run(E.lastCmd); return; }
        E.msg("Command: " + s, "cm"); E.run(s); return;
      }
      if (R.kind === "text") { if (t.trim() === "" && R.dflt == null) { E.msg("", "in"); return done(null); } E.msg(t, "in"); return done(t === "" ? R.dflt : t); }
      if (t.trim() !== "") E.msg(t, "in");
      const kw = matchKw(t);
      if (kw && !(R.kind === "num" && !isNaN(evalNum(t)))) { if (R.kind === "sel" && kwAct(kw)) return; return done({ kw }); }
      if (t.trim() === "") { let d = R.dflt; if ((R.kind === "dist" || R.kind === "num" || R.kind === "angle") && typeof d === "string" && !isNaN(evalNum(d))) d = evalNum(d); return done(d != null ? d : null); }
      switch (R.kind) {
        case "point": { const p = parsePoint(t, R.base); if (p) return done(p); break; }
        case "dist": case "angle": case "num": { const v = evalNum(t); if (!isNaN(v)) { if (R.int && (!Number.isInteger(v) || v < (R.min || 1))) { E.err("Enter a whole number" + (R.min ? " ≥ " + R.min : "") + "."); return; } if (R.positive && v <= 0) { E.err("The value must be more than zero."); return; } return done(v); } if (R.kind !== "num") { const p = parsePoint(t, R.base); if (p) return done(p); } break; }
        case "kw": break;
        case "sel": {
          const u = t.trim().toUpperCase();
          if (u === "ALL") { E.sel = E.doc.ents.filter((e) => E.editable(e) && (!R.filter || R.filter(e))).map((e) => e.id); E.msg(E.sel.length + " found"); drawOverlay(); return; }
          break;
        }
        case "ent": break;
      }
      E.err("Invalid input — " + (R.kind === "point" ? "click a point or type x,y · @dx,dy · @distance<angle" : R.kind === "kw" ? "choose one of the options" : "enter a value") + (R.kws.length ? " or an option: " + R.kws.join(", ") : "") + ".");
      setPrompt(R.msg, R.kws, R.dflt);
    };
    E.submit = submit;
    const kwAct = (k) => {
      if (!R) return false;
      if (R.kind === "sel") {
        if (k === "All") { E.sel = E.doc.ents.filter((e) => E.editable(e) && (!R.filter || R.filter(e))).map((e) => e.id); E.msg(E.sel.length + " found"); drawOverlay(); return true; }
        if (k === "Last") { const last = E.doc.ents[E.doc.ents.length - 1]; if (last && E.editable(last)) E.sel = Array.from(new Set(E.sel.concat(last.id))); E.msg("1 found"); drawOverlay(); return true; }
        if (k === "Previous") { E.sel = (E.prevSel || []).filter((id) => E.byId(id)); E.msg(E.sel.length + " found"); drawOverlay(); return true; }
        if (k === "Remove") { selMode = "remove"; setPrompt("Remove objects:", R.kws); return true; }
        if (k === "Add") { selMode = "add"; setPrompt(R.msg, R.kws); return true; }
      }
      return false;
    };
    /* ---------------- running commands ---------------- */
    let cmdRunning = null, cmdQueue = null;
    const resolveName = (s) => {
      const u = String(s).trim().toUpperCase().replace(/^[_.'-]+/, "");
      if (K.CMDS[u]) return u;
      for (const [n, c] of Object.entries(K.CMDS)) if (c.a.includes(u)) return n;
      return null;
    };
    E.resolve = resolveName;
    E.cancel = () => { if (R) { const r = R; R = null; r.reject(CANCEL); } grip = null; win = null; setPrompt("Command:"); drawOverlay(); };
    E.run = async (s, args) => {
      const name = resolveName(String(s).split(/\s+/)[0]);
      if (!name) { E.err(`Unknown command "${String(s).trim().toUpperCase()}". Press F1 or click Commands for the list.`); return; }
      const C = K.CMDS[name];
      if (cmdRunning) { if (C.transparent) { await C.fn(E, args); return; } cmdQueue = [name, args]; E.cancel(); return; }
      cmdRunning = name; if (!C.norepeat) E.lastCmd = name; hideMenu();
      if (!C.keepSel && !C.usesSel) { /* keep pre-selection for noun-verb commands */ }
      $(".cx-ribbon").querySelectorAll("button[data-c]").forEach((b) => b.classList.toggle("on", b.dataset.c === name));
      setPrompt(name.toLowerCase() + ":");
      try { await C.fn(E, args || {}); }
      catch (e) { if (e !== CANCEL) { E.err(e && e.message ? e.message : String(e)); console.error(e); } else E.msg("*Cancel*", "mu"); }
      finally {
        while (inTx) E.end();
        acq = []; cmdRunning = null; R = null; grip = null; setPrompt("Command:"); $(".cx-ribbon").querySelectorAll("button.on").forEach((b) => b.classList.remove("on")); drawOverlay(); refreshSide();
        if (cmdQueue) { const q = cmdQueue; cmdQueue = null; setTimeout(() => E.run(q[0], q[1]), 0); }
      }
    };
    E.busy = () => !!cmdRunning;

    /* ---------------- picking ---------------- */
    const tolW = () => (E.set.pick + 1) / E.view.s;
    E.pick = (wp, filter) => {
      const t = tolW(); let best = null, bd = Infinity;
      for (let i = E.doc.ents.length - 1; i >= 0; i--) {
        const e = E.doc.ents[i]; if (!E.visible(e) || (filter && !filter(e))) continue;
        const b = K.bbox(e, E.doc); if (b && (wp[0] < b.x0 - t || wp[0] > b.x1 + t || wp[1] < b.y0 - t || wp[1] > b.y1 + t)) continue;
        const d = K.hitDist(e, wp, E.doc); if (d <= t && d < bd - 1e-12) { bd = d; best = e; if (d === 0 && e.t !== "hatch") break; }
      }
      return best;
    };
    const winSelect = (a, b) => {
      const r = { x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) }, crossing = b[0] < a[0];
      return E.doc.ents.filter((e) => E.visible(e) && (!R || !R.filter || R.filter(e)) && (crossing ? K.crosses(e, r, E.doc) : K.inside(e, r, E.doc))).map((e) => e.id);
    };
    E.winSelect = winSelect;
    E.groupExpand = (ids) => { if (E.set.pickgroup === false) return ids; const g = new Set(ids.map((id) => { const e = E.byId(id); return e && e.grp; }).filter(Boolean)); return g.size ? Array.from(new Set(ids.concat(E.doc.ents.filter((e) => g.has(e.grp)).map((e) => e.id)))) : ids; };
    const applySel = (ids, remove) => {
      ids = E.groupExpand(ids);
      const lockedSkip = ids.filter((id) => { const e = E.byId(id); return e && E.layerOf(e).lock; }).length;
      ids = ids.filter((id) => { const e = E.byId(id); return e && !E.layerOf(e).lock; });
      if (remove || selMode === "remove") E.sel = E.sel.filter((id) => !ids.includes(id)); else E.sel = Array.from(new Set(E.sel.concat(ids)));
      if (R && R.kind === "sel") E.msg(`${ids.length} found${lockedSkip ? `, ${lockedSkip} on a locked layer` : ""}, ${E.sel.length} total`);
      drawOverlay(); refreshSide();
    };

    /* ---------------- snapping ---------------- */
    const cursorPoint = () => mouse.cp || mouse.wp;
    const snapAt = (wp, base) => {
      if (!E.set.osnap) return null;
      const S = E.set.snaps, ap = 12 / E.view.s, cands = [], nearPrims = [];
      const add = (p, type, pen = 0) => { if (!p) return; const d = G.dist(p, wp) * E.view.s; if (d <= 12) cands.push({ p, type, d: d + pen }); };
      let n = 0;
      const visit = (e, depth) => {
        if (e.t === "insert") { if (S.ins) add(e.p, "ins"); if (depth < 3) for (const w of K.expand(e, E.doc)) visit(w, depth + 1); return; }
        if (e.t === "text" || e.t === "mtext") { if (S.ins) add(e.p, "ins"); return; }
        if (e.t === "point") { if (S.node) add(e.p, "node"); return; }
        if (e.t === "dim") { if (S.node) for (const k of ["p1", "p2", "c", "loc"]) if (e[k]) add(e[k], "node"); return; }
        if (e.t === "hatch") return;
        if (e.t === "xline") { const pr = K.segs(e)[0]; nearPrims.push(pr); if (S.nea) add(G.closest(wp, pr), "nea", 4); if (S.per && base) add(G.closestSeg(base, pr.a, pr.b), "per", 1); return; }
        const sampled = e.t === "ellipse" || e.t === "spline", prims = e.t === "leader" ? G.polySegs(e.pts, false) : G.prims(e);
        if (sampled) {
          const g = K.grips(e); if (e.t === "ellipse") { if (S.cen) add(e.c, "cen"); if (S.qua) for (let i = 1; i < 5; i++) add(g[i], "qua"); }
          else if (S.end) { add(e.pts[0], "end"); add(e.pts[e.pts.length - 1], "end"); }
        }
        for (const pr of prims) {
          const dd = G.distTo(wp, pr); if (dd > ap && !(pr.k === "a" && G.dist(pr.c, wp) < ap)) continue;
          nearPrims.push(pr);
          if (!sampled) {
            if (S.end) for (const q of G.primEnds(pr)) add(q, "end");
            if (S.mid) add(G.primMid(pr), "mid");
            if (pr.k === "a") {
              if (S.cen) add(pr.c, "cen");
              if (S.qua) for (const a of [0, Math.PI / 2, Math.PI, 1.5 * Math.PI]) if (pr.full || G.inSweep(a, pr.a0, pr.a1)) add(G.polar(pr.c, a, pr.r), "qua");
              if (S.tan && base) { const d0 = G.dist(base, pr.c); if (d0 > pr.r) { const b0 = G.ang(pr.c, base), t = Math.acos(pr.r / d0); for (const a of [b0 + t, b0 - t]) if (pr.full || G.inSweep(a, pr.a0, pr.a1)) add(G.polar(pr.c, a, pr.r), "tan", 1); } }
            }
          }
          if (S.per && base) { if (pr.k === "s") { const d = G.sub(pr.b, pr.a), l2 = G.dot(d, d); if (l2 > 1e-12) { const t = G.dot(G.sub(base, pr.a), d) / l2; if (t >= -1e-9 && t <= 1 + 1e-9) add(G.add(pr.a, G.mul(d, t)), "per", 1); } } else if (G.dist(base, pr.c) > 1e-9) { const a = G.ang(pr.c, base); for (const aa of [a, a + Math.PI]) if (pr.full || G.inSweep(aa, pr.a0, pr.a1)) add(G.polar(pr.c, aa, pr.r), "per", 1); } }
          if (S.nea) add(G.closest(wp, pr), "nea", 4);
        }
      };
      for (let i = E.doc.ents.length - 1; i >= 0 && n < 400; i--) {
        const e = E.doc.ents[i]; if (!E.visible(e)) continue;
        if (e.t !== "xline") { const b = K.bbox(e, E.doc); if (!b || wp[0] < b.x0 - ap || wp[0] > b.x1 + ap || wp[1] < b.y0 - ap || wp[1] > b.y1 + ap) continue; }
        n++; visit(e, 0);
      }
      if (S.int && nearPrims.length > 1 && nearPrims.length < 80) for (let i = 0; i < nearPrims.length; i++) for (let j = i + 1; j < nearPrims.length; j++) for (const x of G.ix(nearPrims[i], nearPrims[j], false, false)) add(x, "int", -0.5);
      if (R && R.extra) for (const [p, t] of R.extra) add(p, t);
      if (!cands.length) return null;
      cands.sort((a, b) => a.d - b.d);
      return cands[0];
    };
    /** ortho / polar / grid snap of a raw point */
    const constrain = (wp, base) => {
      mouse.track = null;
      if (base && E.set.ortho) { const d = G.sub(wp, base); return Math.abs(d[0]) >= Math.abs(d[1]) ? [wp[0], base[1]] : [base[0], wp[1]]; }
      if (base && E.set.polar) {
        const inc = (E.set.polarInc || 15) * D2R, a = G.ang(base, wp), k = Math.round(a / inc) * inc, d = G.dist(base, wp);
        if (d * E.view.s > 8 && Math.abs(Math.sin(a - k)) * d * E.view.s < 7) { const p = G.polar(base, k, d * Math.cos(a - k)); if (E.set.snap) { const u = E.set.snapUnit; const dd = Math.round(G.dist(base, p) / u) * u; mouse.track = { base, a: k }; return G.polar(base, k, dd); } mouse.track = { base, a: k }; return p; }
      }
      if (E.set.snap) { const u = E.set.snapUnit || 10; return [Math.round(wp[0] / u) * u, Math.round(wp[1] / u) * u]; }
      return wp;
    };
    const updateCursor = () => {
      const wantSnap = R && (R.kind === "point" || R.kind === "dist" || R.kind === "angle") || grip;
      const base = R && R.base ? R.base : grip ? grip.from : null;
      mouse.snap = wantSnap ? snapAt(mouse.wp, base) : null;
      mouse.cp = mouse.snap ? mouse.snap.p : wantSnap ? constrain(mouse.wp, base) : mouse.wp;
      if (!wantSnap) mouse.track = null;
      mouse.ot = null;
      if (wantSnap && E.set.otrack && E.set.osnap) {
        const now = Date.now();
        if (mouse.snap) { const key = mouse.snap.p.map((v) => v.toFixed(6)).join(","); if (hoverSnap.key !== key) hoverSnap = { key, t: now }; else if (now - hoverSnap.t > 420 && !acq.some((a) => a.key === key)) { acq.push({ key, p: mouse.snap.p.slice(), type: mouse.snap.type }); if (acq.length > 7) acq.shift(); clearTimeout(acqT); } else if (!acq.some((a) => a.key === key)) { clearTimeout(acqT); acqT = setTimeout(() => { updateCursor(); drawOverlay(); }, 450); } }
        else if (acq.length) {
          const tol = 7 / E.view.s, angs = E.set.polar ? Array.from({ length: Math.round(180 / (E.set.polarInc || 15)) }, (_, i) => (i * (E.set.polarInc || 15)) * D2R) : [0, Math.PI / 2], cands = [];
          for (const a of acq) for (const g of angs) { const u = [Math.cos(g), Math.sin(g)], t = G.dot(G.sub(mouse.wp, a.p), u), q = G.add(a.p, G.mul(u, t)), d = G.dist(q, mouse.wp); if (d < tol && Math.abs(t) * E.view.s > 4) cands.push({ q, d, a, g }); }
          if (cands.length) {
            cands.sort((x, y) => x.d - y.d); let best = { q: cands[0].q, lines: [cands[0]] };
            for (const c2 of cands.slice(1)) { if (c2.a === cands[0].a) continue; const L1 = { k: "s", a: cands[0].a.p, b: G.add(cands[0].a.p, [Math.cos(cands[0].g), Math.sin(cands[0].g)]) }, L2 = { k: "s", a: c2.a.p, b: G.add(c2.a.p, [Math.cos(c2.g), Math.sin(c2.g)]) }; const x = G.ixSS(L1, L2, true, true)[0]; if (x && G.dist(x, mouse.wp) < tol * 1.6) { best = { q: x, lines: [cands[0], c2] }; break; } }
            mouse.cp = best.q; mouse.ot = best.lines; mouse.track = null;
          }
        }
      }
      const p = mouse.cp; $(".cx-xy").textContent = K.fmt(p[0], 4) + ", " + K.fmt(p[1], 4);
    };

    /* ---------------- drawing ---------------- */
    let raf0 = 0, raf1 = 0;
    const redraw = () => { if (!raf0) raf0 = requestAnimationFrame(() => { raf0 = 0; drawBase(); drawOverlayNow(); }); };
    E.redraw = redraw;
    const drawOverlay = () => { if (!raf1) raf1 = requestAnimationFrame(() => { raf1 = 0; drawOverlayNow(); }); };
    E.drawOverlay = drawOverlay;
    const bg = () => (E.set.light ? "#ffffff" : "#1e2833"), fg = () => (E.set.light ? "#111111" : "#ffffff");
    E.fg = fg; E.bg = bg; E.drawGrid = (ctx) => drawGrid(ctx);
    const drawBase = () => {
      const ctx = x0, V = E.view; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = bg(); ctx.fillRect(0, 0, V.W, V.H);
      if (E.baseHook && E.baseHook(ctx)) { ctx.setLineDash([]); drawUCS(ctx); return; }
      if (E.set.grid) drawGrid(ctx);
      const w0 = s2w([0, V.H]), w1 = s2w([V.W, 0]), m = 2 / V.s;
      const P = K.canvasPainter(ctx, V, { fg: fg(), light: E.set.light, lwt: E.set.lwt, ltscale: E.doc.ltscale });
      for (const e of E.doc.ents) {
        if (e.t !== "xline") { const b = K.bbox(e, E.doc); if (b && (b.x1 < w0[0] - m || b.x0 > w1[0] + m || b.y1 < w0[1] - m || b.y0 > w1[1] + m)) continue; }
        K.paint(P, e, E.doc);
      }
      ctx.setLineDash([]);
      drawUCS(ctx);
    };
    const drawGrid = (ctx) => {
      const V = E.view; let u = E.set.gridUnit || 10; while (u * V.s < 12) u *= u * V.s < 2.4 ? 10 : 5; const major = u * 5;
      const w0 = s2w([0, V.H]), w1 = s2w([V.W, 0]);
      ctx.lineWidth = 1; const minor = E.set.light ? "#eef1f5" : "#263342", maj = E.set.light ? "#dde3ea" : "#2f3e50";
      for (const [step, col] of [[u, minor], [major, maj]]) {
        ctx.strokeStyle = col; ctx.beginPath();
        for (let x = Math.ceil(w0[0] / step) * step; x <= w1[0]; x += step) { const sx = Math.round(w2s([x, 0])[0]) + 0.5; ctx.moveTo(sx, 0); ctx.lineTo(sx, V.H); }
        for (let y = Math.ceil(w0[1] / step) * step; y <= w1[1]; y += step) { const sy = Math.round(w2s([0, y])[1]) + 0.5; ctx.moveTo(0, sy); ctx.lineTo(V.W, sy); }
        ctx.stroke();
      }
      const o = w2s([0, 0]); ctx.strokeStyle = E.set.light ? "#c9d2dc" : "#3a4c61"; ctx.beginPath(); ctx.moveTo(o[0] + 0.5, 0); ctx.lineTo(o[0] + 0.5, V.H); ctx.moveTo(0, o[1] + 0.5); ctx.lineTo(V.W, o[1] + 0.5); ctx.stroke();
    };
    const drawUCS = (ctx) => {
      const x = 22, y = E.view.H - 22; ctx.lineWidth = 2; ctx.font = "bold 11px Arial";
      ctx.strokeStyle = ctx.fillStyle = "#e5484d"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 40, y); ctx.lineTo(x + 34, y - 4); ctx.moveTo(x + 40, y); ctx.lineTo(x + 34, y + 4); ctx.stroke(); ctx.fillText("X", x + 44, y + 4);
      ctx.strokeStyle = ctx.fillStyle = "#30a46c"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 40); ctx.lineTo(x - 4, y - 34); ctx.moveTo(x, y - 40); ctx.lineTo(x + 4, y - 34); ctx.stroke(); ctx.fillText("Y", x - 4, y - 46);
    };
    const SN = { end: "Endpoint", mid: "Midpoint", cen: "Centre", qua: "Quadrant", int: "Intersection", per: "Perpendicular", tan: "Tangent", nea: "Nearest", node: "Node", ins: "Insertion" };
    const drawSnap = (ctx, s) => {
      const [x, y] = w2s(s.p), r = 6; ctx.setLineDash([]); ctx.lineWidth = 2; ctx.strokeStyle = "#ffcc00"; ctx.beginPath();
      switch (s.type) {
        case "end": ctx.rect(x - r, y - r, 2 * r, 2 * r); break;
        case "mid": ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.8); ctx.lineTo(x - r, y + r * 0.8); ctx.closePath(); break;
        case "cen": ctx.arc(x, y, r, 0, 7); break;
        case "qua": ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); break;
        case "int": ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); break;
        case "per": ctx.moveTo(x - r, y + r); ctx.lineTo(x + r, y + r); ctx.moveTo(x - r, y + r); ctx.lineTo(x - r, y - r); ctx.moveTo(x - r, y); ctx.lineTo(x, y); ctx.lineTo(x, y + r); break;
        case "tan": ctx.arc(x, y, r * 0.8, 0, 7); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y - r); break;
        case "nea": ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.lineTo(x + r, y + r); ctx.closePath(); break;
        case "node": ctx.arc(x, y, r, 0, 7); ctx.moveTo(x - r * 0.7, y - r * 0.7); ctx.lineTo(x + r * 0.7, y + r * 0.7); ctx.moveTo(x + r * 0.7, y - r * 0.7); ctx.lineTo(x - r * 0.7, y + r * 0.7); break;
        case "ins": ctx.rect(x - r, y - r, r, r); ctx.rect(x, y, r, r); break;
      }
      ctx.stroke();
      ctx.font = "12px system-ui, Arial"; const lab = SN[s.type] || s.type, tw = ctx.measureText(lab).width;
      ctx.fillStyle = "rgba(20,24,32,.92)"; ctx.fillRect(x + 12, y + 10, tw + 10, 18); ctx.fillStyle = "#ffcc00"; ctx.fillText(lab, x + 17, y + 23);
    };
    const drawOverlayNow = () => {
      const ctx = x1, V = E.view; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, V.W, V.H);
      const P = (o) => K.canvasPainter(ctx, V, Object.assign({ fg: fg(), light: E.set.light, ltscale: E.doc.ltscale }, o));
      // selection highlight
      const selIds = E.sel.length ? E.sel : [];
      if (selIds.length) { const hp = P({ dash: [6, 4], width: 2, override: E.set.light ? "#0b63ce" : "#7cc4ff" }); let k = 0; for (const id of selIds) { const e = E.byId(id); if (e && ++k < 3000) K.paint(hp, e, E.doc); } }
      if (hoverId && (!R || R.kind === "sel" || R.kind === "ent")) { const e = E.byId(hoverId); if (e) K.paint(P({ width: 3, override: E.set.light ? "#2563eb" : "#a5d8ff" }), e, E.doc); }
      // grips
      if (!R && E.sel.length && E.sel.length <= 120) {
        for (const id of E.sel) { const e = E.byId(id); if (!e || E.layerOf(e).lock) continue; K.grips(e).forEach((g, i) => { const [x, y] = w2s(g), hot = grip && grip.id === id && grip.i === i, hov = hoverGrip && hoverGrip.id === id && hoverGrip.i === i; ctx.fillStyle = hot ? "#ff3b30" : hov ? "#ff7eb6" : "#2f7cf6"; ctx.fillRect(x - 4.5, y - 4.5, 9, 9); ctx.strokeStyle = "#0b1a33"; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.strokeRect(x - 4.5, y - 4.5, 9, 9); }); }
      }
      // preview geometry
      const cp = cursorPoint();
      if (R && R.preview && mouse.inside) {
        let tmp = []; try { tmp = R.preview(cp) || []; } catch (e) { tmp = []; }
        const pp = P({ lwt: false }); for (const e of tmp.slice(0, 1500)) { const t = Object.assign({ layer: E.cur.layer, color: E.cur.color, lt: E.cur.lt }, e); K.paint(pp, t, E.doc); }
      }
      if (grip && grip.preview && mouse.inside) { const pp = P({}); for (const e of grip.preview(cp) || []) K.paint(pp, e, E.doc); }
      const base = R && R.base ? R.base : grip ? grip.from : null;
      if (base && mouse.inside && !R?.noRubber) { const a = w2s(base), b = w2s(cp); ctx.setLineDash([4, 4]); ctx.strokeStyle = E.set.light ? "#555" : "#c9d1d9"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      if (mouse.track && !mouse.snap && mouse.inside) { const a = w2s(mouse.track.base), L = V.W + V.H; ctx.setLineDash([2, 5]); ctx.strokeStyle = "#30d158"; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + Math.cos(mouse.track.a) * L, a[1] - Math.sin(mouse.track.a) * L); ctx.stroke(); }
      // selection window
      if (win) { const a = w2s(win.a), b = w2s(cp), cr = cp[0] < win.a[0]; ctx.setLineDash(cr ? [5, 4] : []); ctx.fillStyle = cr ? "rgba(48,209,88,.15)" : "rgba(10,132,255,.15)"; ctx.strokeStyle = cr ? "#30d158" : "#0a84ff"; ctx.lineWidth = 1; ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); ctx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); }
      if (mouse.snap && mouse.inside) drawSnap(ctx, mouse.snap);
      if (E.set.otrack && (R || grip)) {
        ctx.setLineDash([]); ctx.strokeStyle = "#30d158"; ctx.lineWidth = 1.5; for (const a of acq) { const [x, y] = w2s(a.p); ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke(); }
        if (mouse.ot && mouse.inside) {
          ctx.setLineDash([3, 4]); const Lw = V.W + V.H; for (const l of mouse.ot) { const [x, y] = w2s(l.a.p); ctx.beginPath(); ctx.moveTo(x - Math.cos(l.g) * Lw, y + Math.sin(l.g) * Lw); ctx.lineTo(x + Math.cos(l.g) * Lw, y - Math.sin(l.g) * Lw); ctx.stroke(); }
          const [x, y] = w2s(mouse.cp), l0 = mouse.ot[0], lab = mouse.ot.length > 1 ? "Intersection of tracking lines" : `${({ end: "Endpoint", mid: "Midpoint", cen: "Centre", int: "Intersection", qua: "Quadrant" })[l0.a.type] || "Point"}: ${K.fmt(G.dist(l0.a.p, mouse.cp), E.doc.dim.dec)} < ${K.fmt(G.norm(G.ang(l0.a.p, mouse.cp)) / D2R, 0)}°`;
          ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke();
          ctx.font = "12px system-ui, Arial"; const tw = ctx.measureText(lab).width; ctx.fillStyle = "rgba(20,24,32,.92)"; ctx.fillRect(x + 12, y + 10, tw + 10, 18); ctx.fillStyle = "#30d158"; ctx.fillText(lab, x + 17, y + 23);
        }
      }
      // crosshair + pickbox
      if (mouse.inside && !panDrag) {
        const [x, y] = w2s(cp), sz = E.set.cross >= 100 ? V.W + V.H : (Math.max(V.W, V.H) * E.set.cross) / 200, pb = E.set.pick;
        ctx.setLineDash([]); ctx.lineWidth = 1; ctx.strokeStyle = E.set.light ? "#222" : "#e6edf3"; ctx.beginPath();
        const pointMode = R && (R.kind === "point" || R.kind === "dist" || R.kind === "angle");
        if (!(R && R.kind === "sel" || R && R.kind === "ent") || true) { ctx.moveTo(x - sz, y + 0.5); ctx.lineTo(x - (pointMode ? 0 : pb), y + 0.5); ctx.moveTo(x + (pointMode ? 0 : pb), y + 0.5); ctx.lineTo(x + sz, y + 0.5); ctx.moveTo(x + 0.5, y - sz); ctx.lineTo(x + 0.5, y - (pointMode ? 0 : pb)); ctx.moveTo(x + 0.5, y + (pointMode ? 0 : pb)); ctx.lineTo(x + 0.5, y + sz); }
        if (!pointMode) ctx.rect(x - pb + 0.5, y - pb + 0.5, pb * 2, pb * 2);
        ctx.stroke();
      }
      updateDyn();
    };
    const updateDyn = () => {
      if (!E.set.dyn || !mouse.inside || !(R || grip)) { dyn.style.display = "none"; return; }
      const cp = cursorPoint(), base = R && R.base ? R.base : grip ? grip.from : null, [x, y] = w2s(cp), d = E.doc.dim.dec;
      let h = `<div class="cx-dp">${esc((R ? R.msg : grip.msg) || "")}</div>`;
      if (base) { const L = G.dist(base, cp), a = G.norm(G.ang(base, cp)) / D2R; h += `<div><span>${esc(R && R.kind === "angle" ? "Angle" : "Length")}</span><b>${R && R.kind === "angle" ? K.fmt(a, 2) + "°" : K.fmt(L, d)}</b>${R && R.kind === "angle" ? "" : `<span>∠</span><b>${K.fmt(a, 1)}°</b>`}</div>`; }
      else if (R && (R.kind === "point")) h += `<div><span>X</span><b>${K.fmt(cp[0], d)}</b><span>Y</span><b>${K.fmt(cp[1], d)}</b></div>`;
      if (inp.value) h += `<div class="cx-dt">${esc(inp.value)}<i>▏</i></div>`;
      dyn.innerHTML = h; dyn.style.display = "block";
      const W = E.view.W; dyn.style.left = Math.min(x + 22, W - dyn.offsetWidth - 6) + "px"; dyn.style.top = Math.max(4, y + 20) + "px";
    };

    /* ---------------- grips (hot grip editing: Space cycles STRETCH → MOVE → ROTATE → SCALE → MIRROR) ---------------- */
    let grip = null;
    const startGrip = async (id, i) => {
      const e0 = E.byId(id); if (!e0) return;
      const from = K.grips(e0)[i], ids = E.sel.slice(), modes = ["STRETCH", "MOVE", "ROTATE", "SCALE", "MIRROR"]; let mi = 0, copy = false;
      const xf = (mode, q) => {
        if (mode === "MOVE") return K.M.move(q[0] - from[0], q[1] - from[1]);
        if (mode === "ROTATE") return K.M.rot(from, G.ang(from, q));
        if (mode === "SCALE") return K.M.scale(from, Math.max(1e-6, G.dist(from, q)));
        if (mode === "MIRROR") return G.dist(from, q) > 1e-9 ? K.M.mirror(from, q) : K.M.id();
      };
      cmdRunning = "GRIP";
      try {
        for (;;) {
          const mode = modes[mi];
          grip = { id, i, from, msg: `** ${mode} ** Specify ${mode === "STRETCH" ? "stretch" : mode === "MOVE" ? "move" : mode === "ROTATE" ? "rotation" : mode === "SCALE" ? "scale" : "second"} point`, preview: (q) => mode === "STRETCH" ? ids.map((sid) => { const e = E.byId(sid); if (!e) return null; const gi = sid === id ? i : K.grips(e).findIndex((g) => G.eq(g, from, 1e-7)); return gi >= 0 ? K.gripMove(e, gi, q) : null; }).filter(Boolean) : ids.map((sid) => E.byId(sid)).filter(Boolean).map((e) => K.xform(e, xf(mode, q))) };
          const v = await E.getPoint(`** ${mode} ** Specify point or [Copy/Undo/eXit] (Space = next mode):`, { base: from, kws: ["Copy", "Undo", "eXit"], gripMode: true, noRubber: mode === "STRETCH" ? false : false });
          if (v == null) { mi = (mi + 1) % modes.length; continue; }
          if (v.kw === "eXit") break;
          if (v.kw === "Copy") { copy = true; E.msg("Copy mode: every point makes a copy."); continue; }
          if (v.kw === "Undo") { E.undo(); continue; }
          E.tx("grip " + mode.toLowerCase(), () => {
            for (const sid of ids) {
              const e = E.byId(sid); if (!e || !E.editable(e)) continue;
              let n;
              if (mode === "STRETCH") { const gi = sid === id ? i : K.grips(e).findIndex((g) => G.eq(g, from, 1e-7)); if (gi < 0) continue; n = K.gripMove(e, gi, v); }
              else n = K.xform(e, xf(mode, v));
              if (copy) E.add(Object.assign(n, { id: undefined }), true); else E.replace(sid, n);
            }
          });
          if (!copy) break;
        }
      } catch (e) { if (e !== CANCEL) E.err(e.message || String(e)); }
      finally { grip = null; cmdRunning = null; R = null; setPrompt("Command:"); drawOverlay(); refreshSide(); }
    };
    const gripAt = (sp) => {
      if (R || !E.sel.length || E.sel.length > 120) return null;
      for (const id of E.sel) { const e = E.byId(id); if (!e || E.layerOf(e).lock) continue; const gs = K.grips(e); for (let i = 0; i < gs.length; i++) { const s = w2s(gs[i]); if (Math.abs(s[0] - sp[0]) <= 6 && Math.abs(s[1] - sp[1]) <= 6) return { id, i }; } }
      return null;
    };

    /* ---------------- pointer input ---------------- */
    const spOf = (ev) => { const r = c1.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
    c1.addEventListener("contextmenu", (ev) => ev.preventDefault());
    c1.addEventListener("pointerdown", (ev) => {
      c1.setPointerCapture(ev.pointerId); ptrs.set(ev.pointerId, spOf(ev)); hideMenu(); hideAC();
      if (ptrs.size === 2) { const [a, b] = Array.from(ptrs.values()); pinch = { d: G.dist(a, b), m: G.mid(a, b) }; win = null; downAt = null; return; }
      const sp = spOf(ev); mouse.sp = sp; mouse.wp = s2w(sp); mouse.inside = true; updateCursor();
      if (ev.button === 1 || (ev.button === 0 && (ev.altKey || E.panMode))) { panDrag = { sp, cx: E.view.cx, cy: E.view.cy }; ev.preventDefault(); return; }
      if (ev.button === 2) { downAt = null; return; }
      downAt = { sp, wp: cursorPoint(), t: Date.now(), touch: ev.pointerType === "touch", shift: ev.shiftKey };
      if (!R && !grip && !cmdRunning) { const g = gripAt(sp); if (g) { downAt = null; startGrip(g.id, g.i); return; } }
    });
    c1.addEventListener("pointermove", (ev) => {
      if (ptrs.has(ev.pointerId)) ptrs.set(ev.pointerId, spOf(ev));
      if (pinch && ptrs.size === 2) { const [a, b] = Array.from(ptrs.values()), d = G.dist(a, b), m = G.mid(a, b); E.view.cx -= (m[0] - pinch.m[0]) / E.view.s; E.view.cy += (m[1] - pinch.m[1]) / E.view.s; if (pinch.d > 0) E.zoomAt(m, d / pinch.d); pinch = { d, m }; redraw(); return; }
      const sp = spOf(ev); mouse.sp = sp; mouse.wp = s2w(sp); mouse.inside = true;
      if (panDrag) { E.view.cx = panDrag.cx - (sp[0] - panDrag.sp[0]) / E.view.s; E.view.cy = panDrag.cy + (sp[1] - panDrag.sp[1]) / E.view.s; redraw(); return; }
      updateCursor();
      if (downAt && !win && G.dist(downAt.sp, sp) > 6 && (!R || R.kind === "sel")) {
        if (downAt.touch && !R && !cmdRunning && E.set.touchPan) { panDrag = { sp: downAt.sp, cx: E.view.cx, cy: E.view.cy }; downAt = null; return; }
        win = { a: downAt.wp, drag: true };
      }
      if (!R || R.kind === "sel" || R.kind === "ent") { const e = E.pick(mouse.wp, R && R.filter); hoverId = e ? e.id : null; } else hoverId = null;
      hoverGrip = !R && !grip ? gripAt(sp) : null;
      c1.style.cursor = "none";
      drawOverlay();
    });
    const endPtr = (ev) => {
      ptrs.delete(ev.pointerId); if (ptrs.size < 2) pinch = null;
      if (panDrag) { panDrag = null; drawOverlay(); return; }
      const sp = spOf(ev);
      if (ev.button === 2) { showMenu(sp); return; }
      if (!downAt) return; const d0 = downAt; downAt = null;
      clickAt(sp, d0, ev);
    };
    c1.addEventListener("pointerup", endPtr);
    c1.addEventListener("pointercancel", (ev) => { ptrs.delete(ev.pointerId); pinch = null; panDrag = null; downAt = null; });
    c1.addEventListener("pointerleave", () => { mouse.inside = false; hoverId = null; drawOverlay(); });
    c1.addEventListener("pointerenter", () => { mouse.inside = true; });
    c1.addEventListener("dblclick", (ev) => {
      if (ev.button === 1) { E.zoomExt(); return; }
      if (R || cmdRunning) return; win = null; drawOverlay(); if (E.dblHook && E.dblHook(s2w(spOf(ev)))) return; const e = E.pick(s2w(spOf(ev))); if (!e) return;
      if (["text", "mtext", "dim", "leader"].includes(e.t)) E.run("TEXTEDIT", { id: e.id });
      else if (e.t === "table") E.run("TABLEDIT", { id: e.id }); else if (e.t === "fcf") E.run("TOLEDIT", { id: e.id });
      else if (e.t === "insert" && ((E.doc.blocks[e.name] || {}).ents || []).some((s) => s.t === "attdef")) E.run("ATTEDIT", { id: e.id }); else { E.sel = [e.id]; showSide("props"); drawOverlay(); refreshSide(); }
    });
    c1.addEventListener("auxclick", (ev) => { if (ev.button === 1 && ev.detail === 2) E.zoomExt(); });
    c1.addEventListener("wheel", (ev) => { ev.preventDefault(); const sp = spOf(ev); E.zoomAt(sp, Math.pow(1.0018, -ev.deltaY * (ev.deltaMode === 1 ? 30 : 1))); mouse.sp = sp; mouse.wp = s2w(sp); updateCursor(); }, { passive: false });
    const clickAt = (sp, d0, ev) => {
      const wp = cursorPoint();
      if (R && (R.kind === "point" || R.kind === "dist" || R.kind === "angle")) { E.msg(K.fmt(wp[0], 4) + "," + K.fmt(wp[1], 4), "in mu"); return done(wp.slice()); }
      if (R && R.kind === "ent") { const e = E.pick(mouse.wp, R.filter); if (e) { if (!E.editable(e) && !R.anyLayer) { E.err("That object is on a locked layer."); return; } E.lastShift = !!(d0.shift || ev.shiftKey); return done({ e, p: mouse.wp.slice() }); } E.msg("Nothing found there — click on an object.", "mu"); return; }
      if (R && R.kind === "kw") return;
      // selection (inside a command or idle)
      if (win) { if (win.drag || G.dist(w2s(win.a), sp) > 3) { const ids = winSelect(win.a, mouse.wp); win = null; applySel(ids, d0.shift || ev.shiftKey); } return; }
      const e = E.pick(mouse.wp, R && R.filter);
      if (e) { const rem = d0.shift || ev.shiftKey; if (!R && !rem && !ev.ctrlKey && E.sel.includes(e.id)) { refreshSide(); return; } applySel([e.id], rem || (!R && E.sel.includes(e.id) && ev.ctrlKey)); return; }
      win = { a: mouse.wp.slice(), drag: false }; drawOverlay();
    };

    /* ---------------- context menu ---------------- */
    const showMenu = (sp) => {
      const items = [];
      if (R) { items.push(["Enter", () => submit("")], ["Cancel", () => E.cancel()]); for (const k of R.kws || []) items.push([k, () => submit(k)]); items.push(["—"], ["Zoom extents", () => E.zoomExt()]); }
      else {
        if (E.lastCmd) items.push(["Repeat " + E.lastCmd, () => E.run(E.lastCmd)]);
        if (E.sel.length) items.push(["—"], ["Move", () => E.run("MOVE")], ["Copy", () => E.run("COPY")], ["Rotate", () => E.run("ROTATE")], ["Scale", () => E.run("SCALE")], ["Mirror", () => E.run("MIRROR")], ["Erase", () => E.run("ERASE")], ["Explode", () => E.run("EXPLODE")], ["Select similar", () => E.run("SELECTSIMILAR")], ["Properties", () => showSide("props")], ["Copy to clipboard  Ctrl+C", () => E.run("COPYCLIP")], ["Deselect all", () => { E.sel = []; drawOverlay(); refreshSide(); }]);
        items.push(["—"], ["Paste  Ctrl+V", () => E.run("PASTECLIP")], ["Select all  Ctrl+A", () => E.run("SELECTALL")], ["Zoom extents", () => E.zoomExt()], ["Zoom previous", () => E.zoomPrev()], ["Undo  Ctrl+Z", () => E.undo()]);
      }
      menu.innerHTML = items.map((it, k) => (it[0] === "—" ? "<hr>" : `<button data-k="${k}">${esc(it[0])}</button>`)).join("");
      menu.style.display = "block"; menu.style.left = Math.min(sp[0], E.view.W - 200) + "px"; menu.style.top = Math.min(sp[1], E.view.H - menu.offsetHeight - 4) + "px";
      menu.onclick = (ev) => { const b = ev.target.closest("button[data-k]"); if (!b) return; hideMenu(); items[+b.dataset.k][1](); };
    };
    const hideMenu = () => { menu.style.display = "none"; };

    /* ---------------- keyboard ---------------- */
    let histIdx = -1; const typed = [];
    const toggle = (k, label) => { E.set[k] = !E.set[k]; if (k === "ortho" && E.set.ortho) E.set.polar = false; if (k === "polar" && E.set.polar) E.set.ortho = false; savePrefs(); E.msg(`<${label} ${E.set[k] ? "on" : "off"}>`, "mu"); drawStatus(); redraw(); };
    E.toggle = toggle;
    const onKey = (ev) => {
      if (!root.isConnected || root.offsetParent === null) return;
      const t = ev.target, inField = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") && t !== inp;
      if ($(".cx-modal").classList.contains("on")) { if (ev.key === "Escape") closeDlg(null); return; }
      if (inField) return;
      const k = ev.key, ctrl = ev.ctrlKey || ev.metaKey;
      const F = { F1: () => E.run("HELP"), F2: () => root.classList.toggle("cx-bighist"), F3: () => toggle("osnap", "Osnap"), F7: () => toggle("grid", "Grid"), F8: () => toggle("ortho", "Ortho"), F9: () => toggle("snap", "Snap"), F10: () => toggle("polar", "Polar"), F11: () => toggle("otrack", "Object snap tracking"), F12: () => toggle("dyn", "Dynamic input") };
      if (F[k]) { ev.preventDefault(); F[k](); return; }
      if (ctrl) {
        const map = { z: "U", y: "REDO", c: "COPYCLIP", v: "PASTECLIP", x: "CUTCLIP", a: "SELECTALL", s: "QSAVE", o: "OPEN", n: "NEW", p: "PLOT", 1: "PROPERTIES" };
        const c = map[k.toLowerCase()]; if (c) { if (k.toLowerCase() === "c" && t === inp && inp.selectionStart !== inp.selectionEnd) return; ev.preventDefault(); if (c === "U") { if (!cmdRunning) E.undo(); } else if (c === "REDO") { if (!cmdRunning) E.redo(); } else E.run(c); }
        return;
      }
      if (k === "Escape") { ev.preventDefault(); hideAC(); hideMenu(); if (R || grip || cmdRunning) E.cancel(); else { E.sel = []; win = null; inp.value = ""; drawOverlay(); refreshSide(); } return; }
      if (k === "Delete" && !R && !cmdRunning && t !== inp) { if (E.sel.length) E.run("ERASE"); return; }
      if (t === inp) return; // the input handles its own keys
      if (k === "Enter" || (k === " " && !(R && R.kind === "text"))) { ev.preventDefault(); if (R && R.gripMode && k === " ") return submit(""); submit(""); return; }
      if (k.length === 1 && !ev.altKey) { inp.focus(); /* the character lands in the box */ }
    };
    document.addEventListener("keydown", onKey);
    inp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || (ev.key === " " && !(R && R.kind === "text"))) {
        ev.preventDefault();
        if (!R && acItems.length && acPick >= 0 && inp.value.trim()) { const v = inp.value.trim().toUpperCase(); const exact = resolveName(v); inp.value = ""; hideAC(); E.msg("Command: " + (exact ? v : acItems[acPick]), "cm"); E.run(exact ? v : acItems[acPick]); return; }
        if (inp.value) { typed.unshift(inp.value); if (typed.length > 50) typed.pop(); } histIdx = -1; submit(); return;
      }
      if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
        ev.preventDefault();
        if (acItems.length && !R) { acPick = (acPick + (ev.key === "ArrowUp" ? -1 : 1) + acItems.length) % acItems.length; drawAC(); return; }
        histIdx = Math.max(-1, Math.min(typed.length - 1, histIdx + (ev.key === "ArrowUp" ? 1 : -1))); inp.value = histIdx >= 0 ? typed[histIdx] : ""; return;
      }
      if (ev.key === "Tab" && acItems.length) { ev.preventDefault(); inp.value = acItems[Math.max(0, acPick)]; hideAC(); return; }
      if (ev.key === "Escape") { inp.value = ""; hideAC(); }
    });
    let acItems = [], acPick = -1;
    inp.addEventListener("input", () => {
      drawOverlay();
      if (R) { hideAC(); return; }
      const v = inp.value.trim().toUpperCase(); if (!v || /[\d,@<]/.test(v[0])) { hideAC(); return; }
      const all = Object.values(K.CMDS).filter((c) => !c.hidden);
      const hit = all.filter((c) => c.name.startsWith(v) || c.a.some((a) => a.startsWith(v)) ).sort((a, b) => (b.a.includes(v) || b.name === v) - (a.a.includes(v) || a.name === v) || a.name.length - b.name.length).slice(0, 8);
      const word = all.filter((c) => !hit.includes(c) && c.d.toUpperCase().includes(v)).slice(0, 8 - hit.length);
      acItems = hit.concat(word).map((c) => c.name); acPick = acItems.length ? 0 : -1; drawAC();
    });
    const drawAC = () => { if (!acItems.length) return hideAC(); ac.innerHTML = acItems.map((n, i) => { const c = K.CMDS[n]; return `<button data-n="${n}" class="${i === acPick ? "on" : ""}"><b>${n}</b>${c.a.length ? `<i>${esc(c.a.join(", "))}</i>` : ""}<span>${esc(c.d)}</span></button>`; }).join(""); ac.style.display = "block"; };
    const hideAC = () => { ac.style.display = "none"; acItems = []; acPick = -1; };
    ac.addEventListener("click", (ev) => { const b = ev.target.closest("button[data-n]"); if (!b) return; inp.value = ""; hideAC(); E.msg("Command: " + b.dataset.n, "cm"); E.run(b.dataset.n); });

    /* ---------------- ribbon ---------------- */
    const RIB = opts.ribbon || K.RIBBON;
    let rtab = 0;
    const drawRibbon = () => {
      $(".cx-rtabs").innerHTML = RIB.map((t, i) => `<button data-i="${i}" class="${i === rtab ? "on" : ""}">${esc(t.t)}</button>`).join("");
      $(".cx-ribbon").innerHTML = RIB[rtab].g.map((g) => `<div class="cx-g"><div class="cx-gb">${g.b.map((b) => {
        if (b === "|LAYERBOX") return `<div class="cx-lbox"><select class="cx-layer" title="Current layer (or the layer of the selected objects)"></select><div class="cx-row"><select class="cx-color" title="Colour"></select><select class="cx-lt" title="Linetype"></select><select class="cx-lw" title="Lineweight"></select></div></div>`;
        const c = K.CMDS[b[0]]; const title = c ? `${c.d}${c.a.length ? " (" + c.a[0] + ")" : ""}` : b[1];
        return `<button data-c="${b[0]}" title="${esc(title)}">${svgI(b[2])}<span>${esc(b[1])}</span></button>`;
      }).join("")}</div><div class="cx-gt">${esc(g.n)}</div></div>`).join("");
      refreshLayerBox();
    };
    $(".cx-rtabs").addEventListener("click", (ev) => { const b = ev.target.closest("button[data-i]"); if (b) { rtab = +b.dataset.i; drawRibbon(); } });
    root.addEventListener("click", (ev) => {
      const b = ev.target.closest("button[data-c]"); if (b && root.contains(b) && !b.closest(".cx-panel") && !b.closest(".cx-dlg")) { E.msg("Command: " + b.dataset.c, "cm"); E.run(b.dataset.c); c1.focus(); return; }
      const a = ev.target.closest("[data-act]"); if (a && a.dataset.act === "side") { if (window.innerWidth <= 820) root.classList.toggle("cx-sideopen"); else root.classList.toggle("cx-noside"); setTimeout(resize, 0); }
    });
    const lwName = (v) => (v == null ? "ByLayer" : v === 0 ? "0.00 mm (thin)" : (+v).toFixed(2) + " mm");
    const refreshLayerBox = () => {
      const ls = $(".cx-layer"); if (!ls) return;
      ls.innerHTML = E.doc.layers.map((l) => `<option value="${esc(l.name)}"${l.name === E.cur.layer ? " selected" : ""}>${l.on === false ? "◌ " : "● "}${esc(l.name)}${l.lock ? " 🔒" : ""}</option>`).join("");
      const curL = K.layer(E.doc, E.cur.layer); ls.style.borderLeft = "6px solid " + (curL ? curL.color : "#fff");
      $(".cx-color").innerHTML = COLORS.map(([n, v]) => `<option value="${v || ""}"${(v || "") === (E.cur.color || "") ? " selected" : ""}>${n}</option>`).join("") + (E.cur.color && !COLORS.some((c) => c[1] === E.cur.color) ? `<option value="${E.cur.color}" selected>${E.cur.color}</option>` : "") + `<option value="__more">More colours…</option>`;
      $(".cx-lt").innerHTML = `<option value="">ByLayer</option>` + Object.keys(K.LT).map((n) => `<option${n === E.cur.lt ? " selected" : ""}>${n}</option>`).join("");
      $(".cx-lw").innerHTML = `<option value="">ByLayer</option>` + K.LW.map((v) => `<option value="${v}"${v === E.cur.lw ? " selected" : ""}>${lwName(v)}</option>`).join("");
    };
    E.refreshLayerBox = refreshLayerBox;
    root.addEventListener("change", (ev) => {
      const t = ev.target;
      if (t.classList.contains("cx-layer")) { if (E.sel.length && !cmdRunning) { const L = t.value; E.tx("change layer", () => { for (const id of E.sel) { const e = E.byId(id); if (e && !E.layerOf(e).lock) E.replace(id, Object.assign({}, e, { layer: L })); } }); E.msg(`Moved ${E.sel.length} object(s) to layer ${L}.`); } else { E.cur.layer = t.value; E.msg(`Current layer: ${t.value}`, "mu"); } refreshLayerBox(); c1.focus(); }
      else if (t.classList.contains("cx-color")) { let v = t.value; if (v === "__more") { pickColor(E.cur.color || "#ffffff", (c) => applyProp("color", c)); return; } applyProp("color", v || null); }
      else if (t.classList.contains("cx-lt")) applyProp("lt", t.value || null);
      else if (t.classList.contains("cx-lw")) applyProp("lw", t.value === "" ? null : +t.value);
    });
    const applyProp = (k, v) => {
      if (E.sel.length && !cmdRunning) { E.tx("change " + k, () => { for (const id of E.sel) { const e = E.byId(id); if (e && !E.layerOf(e).lock) E.replace(id, Object.assign({}, e, { [k]: v })); } }); }
      else { E.cur[k] = v; }
      refreshLayerBox(); c1.focus();
    };
    const pickColor = (cur, cb) => { const i = document.createElement("input"); i.type = "color"; i.value = cur && cur.startsWith("#") ? cur : "#ffffff"; i.style.position = "fixed"; i.style.left = "-100px"; document.body.append(i); i.addEventListener("change", () => { cb(i.value); i.remove(); }); i.addEventListener("blur", () => setTimeout(() => i.remove(), 300)); i.click(); };
    E.pickColor = pickColor;

    /* ---------------- status bar ---------------- */
    const TG = [["grid", "Grid", "F7"], ["snap", "Snap", "F9"], ["ortho", "Ortho", "F8"], ["polar", "Polar", "F10"], ["osnap", "Osnap", "F3"], ["otrack", "Otrack", "F11"], ["dyn", "Dyn", "F12"], ["lwt", "Lwt", ""], ["pickgroup", "Groups", ""], ["light", "Paper", ""]];
    const drawStatus = () => {
      $(".cx-tg").innerHTML = TG.map(([k, n, f]) => `<button data-t="${k}" class="${E.set[k] ? "on" : ""}" title="${n}${f ? " (" + f + ")" : ""}${k === "osnap" || k === "polar" || k === "snap" ? " — right-click for settings" : ""}">${n}</button>`).join("") + `<button data-t="__set" title="Drafting settings">⚙</button>`;
      $(".cx-info").textContent = `${E.doc.units} · ${E.sel.length ? E.sel.length + " selected · " : ""}${E.doc.ents.length} objects`;
    };
    E.drawStatus = drawStatus;
    $(".cx-tg").addEventListener("click", (ev) => { const b = ev.target.closest("button[data-t]"); if (!b) return; if (b.dataset.t === "__set") return E.run("DSETTINGS"); toggle(b.dataset.t, b.textContent); });
    $(".cx-tg").addEventListener("contextmenu", (ev) => { ev.preventDefault(); E.run("DSETTINGS"); });

    /* ---------------- side panel ---------------- */
    let side = "props";
    const showSide = (p) => { side = p; root.classList.remove("cx-noside"); if (window.innerWidth <= 820) root.classList.add("cx-sideopen"); root.querySelectorAll(".cx-stabs button").forEach((b) => b.classList.toggle("on", b.dataset.p === p)); refreshSide(); setTimeout(resize, 0); };
    E.showSide = showSide;
    $(".cx-stabs").addEventListener("click", (ev) => { const b = ev.target.closest("button[data-p]"); if (b) showSide(b.dataset.p); });
    let sideT = 0;
    const refreshSide = () => { drawStatus(); clearTimeout(sideT); sideT = setTimeout(() => { if (K.panels && K.panels[side]) K.panels[side](E, $(".cx-panel")); }, 30); };
    E.refreshSide = refreshSide;

    /* ---------------- dialogs ---------------- */
    let dlgOk = null, dlgRes = null;
    E.dialog = (title, html, onOk, o) => new Promise((res) => {
      if (dlgRes) { const r0 = dlgRes; dlgRes = null; r0(null); }
      dlgRes = res;
      o = o || {};
      $(".cx-dlg").innerHTML = `<div class="cx-dh"><b>${esc(title)}</b><button data-x>✕</button></div><div class="cx-db">${html}</div><div class="cx-df">${o.noCancel ? "" : '<button class="cx-b o" data-x>Cancel</button>'}${onOk ? `<button class="cx-b" data-ok>${esc(o.ok || "OK")}</button>` : ""}</div>`;
      $(".cx-modal").classList.add("on"); $(".cx-dlg").style.width = o.width || "";
      const box = $(".cx-dlg"); dlgOk = async () => { try { const r = onOk ? await onOk(box) : true; if (r === false) return; closeDlg(r); } catch (e) { const m = box.querySelector(".cx-dmsg") || box.querySelector(".cx-db").appendChild(Object.assign(document.createElement("div"), { className: "cx-dmsg" })); m.textContent = e.message || String(e); } };
      box.querySelectorAll("[data-x]").forEach((b) => (b.onclick = () => closeDlg(null)));
      const okb = box.querySelector("[data-ok]"); if (okb) okb.onclick = dlgOk;
      box.querySelectorAll("input").forEach((i) => i.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && i.type !== "textarea") { ev.preventDefault(); dlgOk(); } }));
      if (o.init) o.init(box);
      const f = box.querySelector("input:not([type=checkbox]),textarea,select"); if (f) setTimeout(() => f.focus(), 30);
    });
    const closeDlg = (v) => { $(".cx-modal").classList.remove("on"); const r = dlgRes; dlgRes = null; if (r) r(v === undefined ? null : v); c1.focus(); };
    E.closeDlg = closeDlg;

    drawRibbon(); drawStatus(); setPrompt("Command:");
    E.msg("KMR CAD Draft ready. Type a command (L = line, C = circle, TR = trim, DLI = dimension …) or pick a tool. F1 lists every command.", "mu");
    setTimeout(resize, 0);
    E.focus = () => c1.focus();
    E.destroy = () => document.removeEventListener("keydown", onKey);
    for (const h of K.editorHooks || []) h(E);
    return E;
  };
})((window.KCAD = window.KCAD || {}));
