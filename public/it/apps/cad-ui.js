/* KMR CAD Draft — ribbon, side panels (properties, layers, blocks, commands), view / inquiry / layer / settings /
   file / print / title-block commands. */
(function (K) {
  "use strict";
  const G = K.geom, D2R = Math.PI / 180, cmd = K.cmd, esc = K.esc, isP = Array.isArray;
  const need = (v) => { if (v == null) throw K.CANCEL; return v; };
  const f = (v, E, d) => K.fmt(v, d == null ? E.doc.dim.dec : d);

  /* =============================== ribbon =============================== */
  K.RIBBON = [
    { t: "Home", g: [
      { n: "Draw", b: [["LINE", "Line", "line"], ["PLINE", "Polyline", "pline"], ["CIRCLE", "Circle", "circle"], ["ARC", "Arc", "arc"], ["RECTANG", "Rectangle", "rect"], ["POLYGON", "Polygon", "polygon"], ["ELLIPSE", "Ellipse", "ellipse"], ["SPLINE", "Spline", "spline"], ["HATCH", "Hatch", "hatch"], ["XLINE", "Constr. line", "xline"], ["POINT", "Point", "point"]] },
      { n: "Modify", b: [["MOVE", "Move", "move"], ["COPY", "Copy", "copy"], ["ROTATE", "Rotate", "rotate"], ["SCALE", "Scale", "scale"], ["MIRROR", "Mirror", "mirror"], ["OFFSET", "Offset", "offset"], ["TRIM", "Trim", "trim"], ["EXTEND", "Extend", "extend"], ["FILLET", "Fillet", "fillet"], ["CHAMFER", "Chamfer", "chamfer"], ["ARRAY", "Array", "array"], ["STRETCH", "Stretch", "stretch"], ["BREAK", "Break", "brk"], ["JOIN", "Join", "join"], ["EXPLODE", "Explode", "explode"], ["ERASE", "Erase", "erase"]] },
      { n: "Annotation", b: [["TEXT", "Text", "text"], ["MTEXT", "Mtext", "mtext"], ["DIMLINEAR", "Linear", "dimlin"], ["DIMALIGNED", "Aligned", "dimali"], ["DIMRADIUS", "Radius", "dimrad"], ["DIMDIAMETER", "Diameter", "dimdia"], ["DIMANGULAR", "Angular", "dimang"], ["QLEADER", "Leader", "leader"]] },
      { n: "Layers & properties", b: ["|LAYERBOX", ["LAYER", "Layers", "layer"], ["MATCHPROP", "Match", "match"], ["PROPERTIES", "Properties", "props"]] },
      { n: "Utilities", b: [["DIST", "Measure", "measure"], ["AREA", "Area", "area"], ["LIST", "List", "list"], ["SELECTSIMILAR", "Similar", "sel"]] },
    ] },
    { t: "Annotate", g: [
      { n: "Text", b: [["TEXT", "Single line", "text"], ["MTEXT", "Multiline", "mtext"], ["TEXTEDIT", "Edit text", "text"], ["STYLE", "Text height", "units"]] },
      { n: "Dimensions", b: [["DIMLINEAR", "Linear", "dimlin"], ["DIMALIGNED", "Aligned", "dimali"], ["DIMANGULAR", "Angular", "dimang"], ["DIMRADIUS", "Radius", "dimrad"], ["DIMDIAMETER", "Diameter", "dimdia"], ["DIMORDINATE", "Ordinate", "dimlin"], ["DIMCONTINUE", "Continue", "dimlin"], ["DIMBASELINE", "Baseline", "dimlin"], ["DIMSTYLE", "Dim style", "dimstyle"]] },
      { n: "Leaders & hatch", b: [["QLEADER", "Leader", "leader"], ["HATCH", "Hatch", "hatch"], ["BOUNDARY", "Boundary", "area"]] },
      { n: "Points", b: [["DIVIDE", "Divide", "divide"], ["MEASURE", "Measure", "divide"], ["PTYPE", "Point style", "point"]] },
    ] },
    { t: "Insert", g: [
      { n: "Block", b: [["BLOCK", "Create", "block"], ["INSERT", "Insert", "insert"], ["EXPLODE", "Explode", "explode"]] },
      { n: "Sheet", b: [["TITLEBLOCK", "Title block", "title"]] },
      { n: "Import", b: [["IMPORT", "Import DXF", "open"], ["OPEN", "Open file", "open"]] },
    ] },
    { t: "View", g: [
      { n: "Navigate", b: [["ZOOMEXT", "Extents", "zoomE"], ["ZOOMWIN", "Window", "zoomW"], ["ZOOMPREV", "Previous", "zoomE"], ["ZOOMIN", "Zoom in", "zoomE"], ["ZOOMOUT", "Zoom out", "zoomE"], ["PAN", "Pan", "pan"], ["REGEN", "Regen", "rotate"]] },
      { n: "Display", b: [["GRID", "Grid", "array"], ["ORTHO", "Ortho", "xline"], ["OSNAP", "Snaps", "gear"], ["LWDISPLAY", "Lineweight", "pline"], ["PAPER", "Paper colour", "rect"]] },
    ] },
    { t: "Manage", g: [
      { n: "Settings", b: [["UNITS", "Units", "units"], ["DIMSTYLE", "Dim style", "dimstyle"], ["LTSCALE", "Linetype scale", "xline"], ["PTYPE", "Point style", "point"], ["DSETTINGS", "Drafting", "gear"]] },
      { n: "Layer tools", b: [["LAYISO", "Isolate", "iso"], ["LAYUNISO", "Unisolate", "layer"], ["LAYOFF", "Layer off", "layer"], ["LAYON", "All on", "layer"], ["LAYLCK", "Lock", "layer"], ["LAYULK", "Unlock", "layer"], ["LAYMCUR", "Make current", "layer"]] },
      { n: "Clean up", b: [["PURGE", "Purge", "erase"], ["OVERKILL", "Overkill", "erase"]] },
    ] },
    { t: "Output", g: [
      { n: "Print", b: [["PLOT", "Print / PDF", "print"]] },
      { n: "Export", b: [["DXFOUT", "DXF", "exportI"], ["SVGOUT", "SVG", "exportI"], ["PNGOUT", "PNG image", "exportI"], ["JSONOUT", "KMR CAD file", "save"]] },
    ] },
  ];

  /* =============================== side panels =============================== */
  const COLS = [["ByLayer", ""], ["ByBlock", "byblock"], ["Red", "#ff0000"], ["Yellow", "#ffff00"], ["Green", "#00ff00"], ["Cyan", "#00ffff"], ["Blue", "#0000ff"], ["Magenta", "#ff00ff"], ["White", "#ffffff"], ["Grey", "#808080"], ["Light grey", "#c0c0c0"], ["Orange", "#ff7f00"]];
  const colorSel = (v, id) => `<select data-k="${id}">${COLS.map(([n, c]) => `<option value="${c}"${(v || "") === c ? " selected" : ""}>${n}</option>`).join("")}${v && !COLS.some((c) => c[1] === v) ? `<option value="${v}" selected>${v}</option>` : ""}<option value="__more">More…</option></select>`;
  const ltSel = (v, id, by = true) => `<select data-k="${id}">${by ? `<option value=""${!v ? " selected" : ""}>ByLayer</option>` : ""}${Object.keys(K.LT).map((n) => `<option${n === v ? " selected" : ""}>${n}</option>`).join("")}</select>`;
  const lwSel = (v, id, by = true) => `<select data-k="${id}">${by ? `<option value=""${v == null ? " selected" : ""}>ByLayer</option>` : ""}${K.LW.map((w) => `<option value="${w}"${w === v ? " selected" : ""}>${w.toFixed(2)} mm</option>`).join("")}</select>`;
  const TN = { image: "Raster image", array: "Associative array", vport: "Viewport", fcf: "Geometric tolerance", table: "Table", attdef: "Attribute definition", line: "Line", pline: "Polyline", circle: "Circle", arc: "Arc", ellipse: "Ellipse", spline: "Spline", text: "Text", mtext: "Mtext", dim: "Dimension", leader: "Leader", hatch: "Hatch", insert: "Block reference", point: "Point", xline: "Construction line" };
  K.typeName = (e) => (e.t === "dim" ? { lin: "Linear dimension", ali: "Aligned dimension", rad: "Radius dimension", dia: "Diameter dimension", ang: "Angular dimension", ord: "Ordinate dimension" }[e.kind] : TN[e.t]) || e.t;
  K.measures = (e, doc) => {
    const out = [], d = doc.dim.dec, F = (v) => K.fmt(v, d);
    if (e.t === "line") { out.push(["Length", F(G.dist(e.a, e.b))], ["Angle", K.fmt(G.norm(G.ang(e.a, e.b)) / D2R, 2) + "°"], ["Delta X", F(e.b[0] - e.a[0])], ["Delta Y", F(e.b[1] - e.a[1])]); }
    if (e.t === "circle") out.push(["Diameter", F(2 * e.r)], ["Circumference", F(2 * Math.PI * e.r)], ["Area", F(Math.PI * e.r * e.r)]);
    if (e.t === "arc") out.push(["Arc length", F(e.r * G.sweep(e.a0, e.a1))], ["Total angle", K.fmt(G.sweep(e.a0, e.a1) / D2R, 2) + "°"], ["Chord", F(G.dist(G.polar(e.c, e.a0, e.r), G.polar(e.c, e.a1, e.r)))]);
    if (e.t === "pline") { const P = K.path(e); out.push(["Length", F(K.pathLen(P))], ["Vertices", e.pts.length]); const o = G.outline(Object.assign({}, e, { closed: true }), 0.01); if (e.closed && o) out.push(["Area", F(Math.abs(G.area(o)))]); }
    if (e.t === "ellipse") out.push(["Area", F(Math.PI * e.rx * e.ry)], ["Radius ratio", K.fmt(e.ry / e.rx, 4)]);
    if (e.t === "hatch") { let a = 0; e.loops.forEach((l, i) => (a += Math.abs(G.area(l)) * (i ? -1 : 1))); out.push(["Area", F(Math.abs(a))]); }
    if (e.t === "dim") out.push(["Measurement", K.dimText(Object.assign({}, e, { txt: null }), doc)]);
    if (e.t === "spline") out.push(["Fit points", e.pts.length]);
    return out;
  };
  K.panels = {
    props(E, el) {
      const ids = E.sel.filter((id) => E.byId(id)), ents = ids.map((id) => E.byId(id));
      if (!ents.length && E.sel3d && E.sel3d.length) { el.innerHTML = ""; for (const ph of K.propsHooks || []) ph(E, el, ents); if (el.innerHTML) return; }
      if (!ents.length) {
        el.innerHTML = `<h4>No selection — new objects use</h4><div class="cx-pg"><label>Layer<select data-cur="layer">${E.doc.layers.map((l) => `<option${l.name === E.cur.layer ? " selected" : ""}>${esc(l.name)}</option>`).join("")}</select></label><label>Colour${colorSel(E.cur.color, "cur:color")}</label><label>Linetype${ltSel(E.cur.lt, "cur:lt")}</label><label>Lineweight${lwSel(E.cur.lw, "cur:lw")}</label><label>Text height<input data-doc="text.h" type="number" step="any" value="${E.doc.text.h}"></label><label>Linetype scale<input data-doc="ltscale" type="number" step="any" value="${E.doc.ltscale}"></label></div>
          <h4>Drawing</h4><div class="cx-kv"><span>Units</span><b>${E.doc.units}</b><span>Objects</span><b>${E.doc.ents.length}</b><span>Layers</span><b>${E.doc.layers.length}</b><span>Blocks</span><b>${Object.keys(E.doc.blocks).length}</b>${(() => { const b = K.extents(E.doc); return b ? `<span>Extents</span><b>${f(b.x1 - b.x0, E)} × ${f(b.y1 - b.y0, E)}</b>` : ""; })()}</div>
          <p class="cx-note">Tip: click objects to select them (drag left→right = window, right→left = crossing). Then edit them here, use the grips, or start a command.</p>`;
        bind(E, el, []); return;
      }
      const types = {}; ents.forEach((e) => (types[K.typeName(e)] = (types[K.typeName(e)] || 0) + 1));
      const same = (k) => { const v = ents[0][k]; return ents.every((e) => (e[k] ?? null) === (v ?? null)) ? v ?? null : undefined; };
      const one = ents.length === 1 ? ents[0] : null, d = E.doc.dim.dec;
      let h = `<h4>${ents.length === 1 ? esc(K.typeName(one)) : ents.length + " objects"}</h4>${ents.length > 1 ? `<div class="cx-types">${Object.entries(types).map(([t, n]) => `<span>${n} × ${esc(t)}</span>`).join("")}</div>` : ""}
        <div class="cx-pg"><label>Layer<select data-k="layer">${same("layer") === undefined ? "<option value='' selected>*varies*</option>" : ""}${E.doc.layers.map((l) => `<option${l.name === same("layer") ? " selected" : ""}>${esc(l.name)}</option>`).join("")}</select></label>
        <label>Colour${same("color") === undefined ? `<select data-k="color"><option selected>*varies*</option>${COLS.map(([n, c]) => `<option value="${c}">${n}</option>`).join("")}</select>` : colorSel(same("color"), "color")}</label><label>Linetype${ltSel(same("lt"), "lt")}</label><label>Lineweight${lwSel(same("lw"), "lw")}</label></div>`;
      if (one) {
        const N = (label, path, v) => `<label>${label}<input data-g="${path}" type="number" step="any" value="${K.fmt(v, Math.max(d, 4))}"></label>`, A = (label, path, v) => `<label>${label} (°)<input data-ga="${path}" type="number" step="any" value="${K.fmt(G.norm(v) / D2R, 4)}"></label>`;
        let g = "";
        switch (one.t) {
          case "line": g = N("Start X", "a.0", one.a[0]) + N("Start Y", "a.1", one.a[1]) + N("End X", "b.0", one.b[0]) + N("End Y", "b.1", one.b[1]); break;
          case "circle": g = N("Centre X", "c.0", one.c[0]) + N("Centre Y", "c.1", one.c[1]) + N("Radius", "r", one.r) + `<label>Diameter<input data-dia="1" type="number" step="any" value="${K.fmt(one.r * 2, Math.max(d, 4))}"></label>`; break;
          case "arc": g = N("Centre X", "c.0", one.c[0]) + N("Centre Y", "c.1", one.c[1]) + N("Radius", "r", one.r) + A("Start angle", "a0", one.a0) + A("End angle", "a1", one.a1); break;
          case "ellipse": g = N("Centre X", "c.0", one.c[0]) + N("Centre Y", "c.1", one.c[1]) + N("Major radius", "rx", one.rx) + N("Minor radius", "ry", one.ry) + A("Rotation", "rot", one.rot || 0); break;
          case "pline": g = `<label class="cx-chk"><input data-b="closed" type="checkbox"${one.closed ? " checked" : ""}> Closed</label>` + N("Global width", "w", one.w || 0) + `<label>Vertex<select data-vx>${one.pts.map((p, i) => `<option value="${i}">${i + 1}: ${K.fmt(p[0], d)}, ${K.fmt(p[1], d)}</option>`).join("")}</select></label>`; break;
          case "text": g = `<label class="cx-w">Contents<input data-s="s" value="${esc(one.s)}"></label>` + N("Height", "h", one.h) + A("Rotation", "rot", one.rot || 0) + `<label>Justify<select data-just>${["Left", "Center", "Right"].map((n, i) => `<option value="${i}"${(one.ha || 0) === i ? " selected" : ""}>${n}</option>`).join("")}</select></label>` + N("Position X", "p.0", one.p[0]) + N("Position Y", "p.1", one.p[1]); break;
          case "mtext": g = `<label class="cx-w">Contents<textarea data-s="s" rows="4">${esc(one.s)}</textarea></label>` + N("Height", "h", one.h) + N("Width", "w", one.w || 0) + A("Rotation", "rot", one.rot || 0); break;
          case "leader": g = `<label class="cx-w">Text<textarea data-s="s" rows="3">${esc(one.s || "")}</textarea></label>` + N("Text height", "h", one.h || E.doc.dim.th); break;
          case "dim": g = `<label>Style<select data-s="sty"><option value="">Standard</option>${Object.keys(E.doc.dimstyles || {}).map((n) => `<option${one.sty === n ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label><label>Tolerance<button class="cx-b o" data-run="DIMTOL">${esc(one.tol && one.tol.type && one.tol.type !== "none" ? ({ sym: "± ", dev: "+/− ", lim: "Limits ", basic: "Basic" })[one.tol.type] + (one.tol.type === "basic" ? "" : one.tol.up + (one.tol.type === "sym" ? "" : " / " + one.tol.lo)) : "Add / change")}</button></label><label class="cx-w">Text override (&lt;&gt; = measured)<input data-s="txt" value="${esc(one.txt || "")}" placeholder="${esc(K.dimText(Object.assign({}, one, { txt: null }), E.doc))}"></label><label>Text height<input data-st="th" type="number" step="any" value="${(one.st && one.st.th) || E.doc.dim.th}"></label><label>Arrow size<input data-st="as" type="number" step="any" value="${(one.st && one.st.as) || E.doc.dim.as}"></label><label>Decimals<input data-st="dec" type="number" min="0" max="8" value="${one.st && one.st.dec != null ? one.st.dec : E.doc.dim.dec}"></label>`; break;
          case "hatch": g = `<label>Pattern<select data-s="pat">${Object.keys(K.PAT).map((n) => `<option${n === one.pat ? " selected" : ""}>${n}</option>`).join("")}</select></label>` + N("Scale", "sc", one.sc || 1) + A("Angle", "ang", one.ang || 0); break;
          case "insert": g = `<label>Block<b class="cx-ro">${esc(one.name)}</b></label>` + Object.entries(one.attrs || {}).map(([k, v]) => `<label>${esc(k)}<input data-at="${esc(k)}" value="${esc(v)}"></label>`).join("") + N("Position X", "p.0", one.p[0]) + N("Position Y", "p.1", one.p[1]) + N("Scale X", "sx", one.sx || 1) + N("Scale Y", "sy", one.sy || 1) + A("Rotation", "rot", one.rot || 0); break;
          case "point": g = N("X", "p.0", one.p[0]) + N("Y", "p.1", one.p[1]); break;
          case "table": g = N("Position X", "p.0", one.p[0]) + N("Position Y", "p.1", one.p[1]) + N("Text height", "h", one.h) + `<label class="cx-w"><button class="cx-b" data-run="TABLEDIT">Edit cells…</button></label>`; break;
          case "fcf": g = N("Position X", "p.0", one.p[0]) + N("Position Y", "p.1", one.p[1]) + N("Text height", "h", one.h) + `<label class="cx-w"><button class="cx-b" data-run="TOLEDIT">Edit tolerance…</button></label>`; break;
          case "attdef": g = `<label>Tag<input data-s="tag" value="${esc(one.tag)}"></label><label>Prompt<input data-s="prompt" value="${esc(one.prompt || "")}"></label><label>Default<input data-s="def" value="${esc(one.def || "")}"></label>` + N("Height", "h", one.h); break;
        }
        const ms = K.measures(one, E.doc);
        h += `<h4>Geometry</h4><div class="cx-pg">${g}</div>${ms.length ? `<div class="cx-kv">${ms.map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v)}</b>`).join("")}</div>` : ""}`;
      }
      h += `<div class="cx-pa"><button class="cx-b o" data-run="SELECTSIMILAR">Select similar</button><button class="cx-b o" data-run="ERASE">Erase</button><button class="cx-b o" data-desel>Deselect</button></div>`;
      el.innerHTML = h; bind(E, el, ids); if (K.propsHook) K.propsHook(E, el, ents); for (const ph of K.propsHooks || []) ph(E, el, ents);
    },
    layers(E, el) {
      const cnt = {}; E.doc.ents.forEach((e) => (cnt[e.layer] = (cnt[e.layer] || 0) + 1)); const q = (E._lq || "").toLowerCase();
      el.innerHTML = `<div class="cx-la"><button class="cx-b" data-lnew>Add layer</button><input data-lq placeholder="Filter" value="${esc(E._lq || "")}"></div>
        <div class="cx-lt"><div class="cx-lh"><span></span><span>Name</span><span title="On / off">On</span><span title="Freeze">Frz</span><span title="Lock">Lock</span><span title="Plot">Plot</span><span>Colour</span><span>Linetype</span><span>Weight</span><span></span></div>
        ${E.doc.layers.filter((l) => !q || l.name.toLowerCase().includes(q)).map((l) => { const i = E.doc.layers.indexOf(l); return `<div class="cx-lr${l.name === E.cur.layer ? " cur" : ""}" data-li="${i}"><button data-lcur title="Make current">${l.name === E.cur.layer ? "✔" : "○"}</button><input data-lname value="${esc(l.name)}"${l.name === "0" ? " disabled" : ""} title="${cnt[l.name] || 0} object(s)"><button data-lon title="On / off">${l.on === false ? "◌" : "💡"}</button><button data-lfrz title="Freeze / thaw">${l.frozen ? "❄" : "☀"}</button><button data-llock title="Lock / unlock">${l.lock ? "🔒" : "🔓"}</button><button data-lplot title="Plot / do not plot">${l.plot === false ? "⊘" : "🖨"}</button><button data-lcol style="background:${l.color}" title="${l.color}"></button>${ltSel(l.lt, "llt", false)}${lwSel(l.lw, "llw", false)}<button data-ldel title="Remove layer"${l.name === "0" ? " disabled" : ""}>✕</button></div>`; }).join("")}</div>
        <p class="cx-note">Layer “0” cannot be renamed or deleted. A layer with objects is deleted together with them only after you confirm. Locked layers can be seen and snapped to but not edited.</p>`;
      const L = (b) => E.doc.layers[+b.closest("[data-li]").dataset.li];
      const edit = (label, fn) => E.tx(label, () => { E.doc.layers = E.doc.layers.map((l) => Object.assign({}, l)); fn(); });
      el.querySelector("[data-lnew]").onclick = () => { let n = 1; while (E.doc.layers.some((l) => l.name === "Layer" + n)) n++; edit("new layer", () => E.doc.layers.push({ name: "Layer" + n, color: "#ffffff", lt: "CONTINUOUS", lw: 0.25, on: true, frozen: false, lock: false })); K.panels.layers(E, el); };
      el.querySelector("[data-lq]").oninput = (ev) => { E._lq = ev.target.value; K.panels.layers(E, el); const i = el.querySelector("[data-lq]"); i.focus(); i.selectionStart = i.value.length; };
      el.querySelectorAll("[data-li]").forEach((row) => {
        const i = +row.dataset.li;
        row.querySelector("[data-lcur]").onclick = () => { const l = E.doc.layers[i]; if (l.frozen) return E.err("A frozen layer cannot be current."); E.cur.layer = l.name; E.refreshLayerBox(); K.panels.layers(E, el); };
        row.querySelector("[data-lon]").onclick = () => edit("layer on/off", () => { E.doc.layers[i].on = E.doc.layers[i].on === false; });
        row.querySelector("[data-lfrz]").onclick = () => { if (E.doc.layers[i].name === E.cur.layer) return E.err("The current layer cannot be frozen."); edit("freeze", () => { E.doc.layers[i].frozen = !E.doc.layers[i].frozen; }); };
        row.querySelector("[data-llock]").onclick = () => edit("lock", () => { E.doc.layers[i].lock = !E.doc.layers[i].lock; });
        row.querySelector("[data-lplot]").onclick = () => edit("plot flag", () => { E.doc.layers[i].plot = E.doc.layers[i].plot === false ? undefined : false; });
        row.querySelector("[data-lcol]").onclick = () => E.pickColor(E.doc.layers[i].color, (c) => edit("layer colour", () => { E.doc.layers[i].color = c; }));
        row.querySelector("[data-k=llt]").onchange = (ev) => edit("layer linetype", () => { E.doc.layers[i].lt = ev.target.value; });
        row.querySelector("[data-k=llw]").onchange = (ev) => edit("layer lineweight", () => { E.doc.layers[i].lw = +ev.target.value; });
        const nm = row.querySelector("[data-lname]");
        nm.onchange = () => { const old = E.doc.layers[i].name, nn = nm.value.trim(); if (!nn || E.doc.layers.some((l, k) => k !== i && l.name === nn)) { E.err("That layer name is empty or already used."); nm.value = old; return; } edit("rename layer", () => { E.doc.layers[i].name = nn; E.doc.ents = E.doc.ents.map((e) => (e.layer === old ? Object.assign({}, e, { layer: nn }) : e)); if (E.cur.layer === old) E.cur.layer = nn; }); };
        row.querySelector("[data-ldel]").onclick = async () => {
          const l = E.doc.layers[i], n = cnt[l.name] || 0; if (l.name === "0") return;
          if (n) { const ok = await E.dialog("Remove layer", `<p>Layer <b>${esc(l.name)}</b> has <b>${n}</b> object(s). Remove the layer and these objects?</p>`, () => true, { ok: "Remove" }); if (!ok) return; }
          edit("delete layer", () => { E.doc.ents = E.doc.ents.filter((e) => e.layer !== l.name); E.doc.layers = E.doc.layers.filter((x) => x.name !== l.name); if (E.cur.layer === l.name) E.cur.layer = "0"; });
        };
      });
    },
    blocks(E, el) {
      const names = Object.keys(E.doc.blocks).filter((n) => !n.startsWith("*")), cnt = {}; E.doc.ents.forEach((e) => { if (e.t === "insert") cnt[e.name] = (cnt[e.name] || 0) + 1; });
      el.innerHTML = `<div class="cx-pa"><button class="cx-b" data-run="BLOCK">+ Create block</button><button class="cx-b o" data-run="INSERT">Library…</button></div>${names.length ? `<div class="cx-blist">${names.map((n) => `<button type="button" data-ins="${esc(n)}" title="Insert ${esc(n)}">${K.blockThumb(E.doc, n)}<span>${esc(n)}<i>${cnt[n] || 0} in use</i></span></button>`).join("")}</div>` : `<p class="cx-note">No blocks in this drawing yet. A block is a group of objects saved under a name and placed many times (bolts, symbols, title blocks). Use Create block, or insert one from the standard library.</p>`}`;
      el.querySelectorAll("[data-ins]").forEach((b) => (b.onclick = () => E.run("INSERT", { name: b.dataset.ins })));
      el.querySelectorAll("[data-run]").forEach((b) => (b.onclick = () => E.run(b.dataset.run)));
    },
    cmds(E, el) {
      const q = (E._cq || "").toUpperCase(), all = Object.values(K.CMDS).filter((c) => !c.hidden && (!q || c.name.includes(q) || c.a.some((a) => a.includes(q)) || c.d.toUpperCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));
      el.innerHTML = `<input data-cq placeholder="Search commands (e.g. trim, circle, dimension)" value="${esc(E._cq || "")}"><div class="cx-clist">${all.map((c) => `<button data-run="${c.name}"><b>${c.name}</b>${c.a.length ? `<i>${esc(c.a.slice(0, 3).join(" · "))}</i>` : ""}<span>${esc(c.d)}</span></button>`).join("")}</div>
        <h4>Keys</h4><div class="cx-kv"><span>Enter / Space</span><b>finish · repeat last</b><span>Esc</span><b>cancel · deselect</b><span>F3 / F8 / F10</span><b>snaps · ortho · polar</b><span>F7 / F9 / F12</span><b>grid · snap · dynamic input</b><span>Ctrl+Z / Y</span><b>undo · redo</b><span>Ctrl+C / V</span><b>copy · paste</b><span>Wheel / middle drag</span><b>zoom · pan</b><span>Double middle click</span><b>zoom extents</b></div>
        <h4>Typing points</h4><div class="cx-kv"><span>100,50</span><b>absolute X,Y</b><span>@30,10</span><b>relative to last point</b><span>@50&lt;30</span><b>50 long at 30°</b><span>75</span><b>75 along the cursor direction</b></div>`;
      const i = el.querySelector("[data-cq]"); i.oninput = () => { E._cq = i.value; K.panels.cmds(E, el); const j = el.querySelector("[data-cq]"); j.focus(); j.selectionStart = j.value.length; };
      el.querySelectorAll("[data-run]").forEach((b) => (b.onclick = () => { E.msg("Command: " + b.dataset.run, "cm"); E.run(b.dataset.run); }));
    },
  };
  const setPath = (o, path, v) => { const k = path.split("."); if (k.length === 1) o[k[0]] = v; else { o[k[0]] = o[k[0]].slice(); o[k[0]][+k[1]] = v; } };
  const bind = (E, el, ids) => {
    const each = (fn, label) => E.tx(label || "properties", () => { for (const id of ids) { const e = E.byId(id); if (!e || E.layerOf(e).lock) continue; const n = JSON.parse(JSON.stringify(e)); fn(n, e); E.replace(id, n); } });
    el.querySelectorAll("[data-cur]").forEach((s) => (s.onchange = () => { E.cur.layer = s.value; E.refreshLayerBox(); }));
    el.querySelectorAll("[data-doc]").forEach((i) => (i.onchange = () => { const v = +i.value; if (!(v > 0)) return; E.tx("drawing settings", () => { if (i.dataset.doc === "text.h") E.doc.text = Object.assign({}, E.doc.text, { h: v }); else E.doc.ltscale = v; }); }));
    el.querySelectorAll("select[data-k]").forEach((s) => (s.onchange = () => {
      const [scope, key] = s.dataset.k.includes(":") ? s.dataset.k.split(":") : ["sel", s.dataset.k];
      let v = s.value; if (key === "lw") v = v === "" ? null : +v; else if (v === "") v = null;
      const apply = (val) => { if (scope === "cur") { E.cur[key] = val; E.refreshLayerBox(); E.refreshSide(); } else if (key !== "layer" || val) each((n) => { n[key] = val; }, "change " + key); };
      if (v === "__more") return E.pickColor("#ffffff", apply);
      if (key === "color" && v === "*varies*") return; apply(v);
    }));
    el.querySelectorAll("[data-g]").forEach((i) => (i.onchange = () => { const v = +i.value; if (!isFinite(v)) return; if ((i.dataset.g === "r" || i.dataset.g === "h" || i.dataset.g === "rx" || i.dataset.g === "ry") && v <= 0) return E.err("The value must be more than zero."); each((n) => setPath(n, i.dataset.g, v)); }));
    el.querySelectorAll("[data-ga]").forEach((i) => (i.onchange = () => { const v = +i.value; if (isFinite(v)) each((n) => setPath(n, i.dataset.ga, v * D2R)); }));
    el.querySelectorAll("[data-dia]").forEach((i) => (i.onchange = () => { const v = +i.value; if (v > 0) each((n) => { n.r = v / 2; }); }));
    el.querySelectorAll("[data-s]").forEach((i) => (i.onchange = () => each((n) => { if (i.dataset.s === "sty") { if (i.value) n.sty = i.value; else delete n.sty; return; } if (["tag", "prompt", "def"].includes(i.dataset.s)) { n[i.dataset.s] = i.dataset.s === "tag" ? i.value.trim().toUpperCase() : i.value; return; } n[i.dataset.s] = i.dataset.s === "s" || i.dataset.s === "txt" ? K.sym(i.value) || (i.dataset.s === "txt" ? null : n.s) : i.value; if (i.dataset.s === "pat") n.solid = i.value === "SOLID"; })));
    el.querySelectorAll("[data-st]").forEach((i) => (i.onchange = () => { const v = +i.value; if (!(v >= 0)) return; each((n) => { n.st = Object.assign({}, n.st || {}, { [i.dataset.st]: i.dataset.st === "dec" ? Math.round(v) : v }); }); }));
    el.querySelectorAll("[data-at]").forEach((i) => (i.onchange = () => each((n) => { n.attrs = Object.assign({}, n.attrs, { [i.dataset.at]: i.value }); })));
    el.querySelectorAll("[data-b]").forEach((i) => (i.onchange = () => each((n) => { n[i.dataset.b] = i.checked; })));
    el.querySelectorAll("[data-just]").forEach((i) => (i.onchange = () => each((n) => { n.ha = +i.value; n.va = 0; })));
    el.querySelectorAll("[data-vx]").forEach((s) => (s.onchange = () => { const e = E.byId(ids[0]); const p = e.pts[+s.value]; E.zoomBox({ x0: p[0] - 5, y0: p[1] - 5, x1: p[0] + 5, y1: p[1] + 5 }, 0.3); }));
    el.querySelectorAll("[data-run]").forEach((b) => (b.onclick = () => E.run(b.dataset.run)));
    el.querySelectorAll("[data-desel]").forEach((b) => (b.onclick = () => { E.sel = []; E.drawOverlay(); E.refreshSide(); }));
  };

  /* =============================== view =============================== */
  cmd("ZOOM", { a: ["Z"], d: "Zoom: Extents / Window / Previous / Scale / Object", transparent: false, fn: async (E) => {
    const v = await E.getPoint("Specify corner of window, enter a scale factor (nX) or [All/Extents/Previous/Window/Object] <Extents>:", { kws: ["All", "Extents", "Previous", "Window", "Object"] });
    if (v == null || v.kw === "Extents" || v.kw === "All") return E.zoomExt();
    if (v.kw === "Previous") return E.zoomPrev();
    if (v.kw === "Object") { const ids = await E.getSel("Select objects:"); const b = ids.map((id) => K.bbox(E.byId(id), E.doc)).reduce((a, c) => G.mergeBounds(a, c), null); if (b) E.zoomBox(b, 0.15); return; }
    const a = v.kw === "Window" ? need(await E.getPoint("Specify first corner:")) : v;
    const b = need(await E.getPoint("Specify opposite corner:", { base: a, noRubber: true, preview: (q) => [{ t: "pline", closed: true, color: "#0a84ff", pts: [[a[0], a[1]], [q[0], a[1]], [q[0], q[1]], [a[0], q[1]]] }] }));
    E.zoomBox({ x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) }, 0.01);
  } });
  cmd("ZOOMEXT", { a: ["ZE"], d: "Zoom to show the whole drawing", norepeat: true, keepSel: true, fn: async (E) => E.zoomExt() });
  cmd("ZOOMWIN", { a: ["ZW"], d: "Zoom to a window", fn: async (E) => { const a = need(await E.getPoint("Specify first corner:")); const b = need(await E.getPoint("Specify opposite corner:", { base: a, noRubber: true, preview: (q) => [{ t: "pline", closed: true, color: "#0a84ff", pts: [[a[0], a[1]], [q[0], a[1]], [q[0], q[1]], [a[0], q[1]]] }] })); E.zoomBox({ x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) }, 0.01); } });
  cmd("ZOOMPREV", { a: ["ZP"], d: "Zoom back to the previous view", norepeat: true, keepSel: true, fn: async (E) => E.zoomPrev() });
  cmd("ZOOMIN", { a: [], d: "Zoom in 2×", norepeat: true, keepSel: true, fn: async (E) => { E.pushView(); E.zoomAt([E.view.W / 2, E.view.H / 2], 2); } });
  cmd("ZOOMOUT", { a: [], d: "Zoom out 2×", norepeat: true, keepSel: true, fn: async (E) => { E.pushView(); E.zoomAt([E.view.W / 2, E.view.H / 2], 0.5); } });
  cmd("PAN", { a: ["P"], d: "Pan the view (drag with the mouse; Esc or Enter to finish)", fn: async (E) => { E.panMode = true; try { await E.getKw("Drag to pan. Press Esc or Enter to exit.", []); } finally { E.panMode = false; } } });
  cmd("REGEN", { a: ["RE", "REDRAW", "R", "REGENALL", "REA"], d: "Redraw the screen", norepeat: true, keepSel: true, fn: async (E) => E.redraw() });
  for (const [n, k, l] of [["GRID", "grid", "Grid"], ["ORTHO", "ortho", "Ortho"], ["SNAP", "snap", "Snap"], ["POLAR", "polar", "Polar"], ["LWDISPLAY", "lwt", "Lineweight display"], ["PAPER", "light", "Light paper"]]) cmd(n, { a: n === "LWDISPLAY" ? ["LWT"] : [], d: "Turn " + l + " on or off", norepeat: true, keepSel: true, fn: async (E) => E.toggle(k, l) });
  cmd("U", { a: [], d: "Undo the last operation (Ctrl+Z)", norepeat: true, fn: async (E) => E.undo() });
  cmd("UNDO", { a: [], d: "Undo several operations", fn: async (E) => { const n = await E.getNum("Enter the number of operations to undo <1>:", { dflt: 1, int: true, min: 1 }); for (let i = 0; i < (n || 1); i++) E.undo(); } });
  cmd("REDO", { a: ["MREDO"], d: "Redo what was undone (Ctrl+Y)", norepeat: true, fn: async (E) => E.redo() });
  cmd("PROPERTIES", { a: ["PR", "MO", "CH", "PROPS"], d: "Show the properties of the selection", keepSel: true, norepeat: true, fn: async (E) => E.showSide("props") });
  cmd("LAYER", { a: ["LA", "LAYERS"], d: "Layer manager: new, current, on/off, freeze, lock, colour, linetype", keepSel: true, norepeat: true, fn: async (E) => E.showSide("layers") });
  cmd("BLOCKSPALETTE", { a: ["BLOCKS"], d: "Blocks in this drawing", keepSel: true, norepeat: true, fn: async (E) => E.showSide("blocks") });
  cmd("HELP", { a: ["?", "COMMANDS"], d: "List of all commands with aliases", keepSel: true, norepeat: true, fn: async (E) => E.showSide("cmds") });

  /* =============================== inquiry =============================== */
  cmd("DIST", { a: ["DI", "MEASUREGEOM", "MEA"], d: "Measure the distance and angle between two points", fn: async (E) => {
    const a = need(await E.getPoint("Specify first point:")); const b = need(await E.getPoint("Specify second point:", { base: a })); if (!isP(b)) return;
    const msg = `Distance = ${f(G.dist(a, b), E, Math.max(E.doc.dim.dec, 4))},  Angle in XY plane = ${K.fmt(G.norm(G.ang(a, b)) / D2R, 2)}°,  Delta X = ${f(b[0] - a[0], E, 4)},  Delta Y = ${f(b[1] - a[1], E, 4)}`;
    E.msg(msg, "ok"); E.dialog("Measure distance", `<div class="cx-big">${f(G.dist(a, b), E, Math.max(E.doc.dim.dec, 4))} <small>${E.doc.units}</small></div><div class="cx-kv"><span>Angle</span><b>${K.fmt(G.norm(G.ang(a, b)) / D2R, 3)}°</b><span>Delta X</span><b>${f(b[0] - a[0], E, 4)}</b><span>Delta Y</span><b>${f(b[1] - a[1], E, 4)}</b></div>`, () => true, { noCancel: true });
  } });
  cmd("AREA", { a: ["AA"], d: "Area and perimeter of points or of a closed object", fn: async (E) => {
    const v = await E.getPoint("Specify first corner point or [Object] <Object>:", { kws: ["Object"] }); let pts, per;
    if (v == null || v.kw) { const s = need(await E.getEnt("Select objects:")); const o = G.outline(s.e, 0.005) || (s.e.t === "hatch" ? s.e.loops[0] : null); if (!o) return E.err("That object is not closed."); pts = o; per = s.e.t === "circle" ? 2 * Math.PI * s.e.r : (() => { let L = 0; for (let i = 0; i < o.length; i++) L += G.dist(o[i], o[(i + 1) % o.length]); return L; })(); }
    else { pts = [v]; for (;;) { const q = await E.getPoint("Specify next point or press Enter for total:", { base: pts[pts.length - 1], preview: (p) => [{ t: "hatch", solid: true, color: "#30d15855", loops: [pts.concat([p])] }, { t: "pline", closed: true, color: "#30d158", pts: pts.concat([p]).map((x) => [x[0], x[1], 0]) }] }); if (!isP(q)) break; pts.push(q); } if (pts.length < 3) return; per = 0; for (let i = 0; i < pts.length; i++) per += G.dist(pts[i], pts[(i + 1) % pts.length]); }
    const A = Math.abs(G.area(pts)); E.msg(`Area = ${f(A, E, 4)}, Perimeter = ${f(per, E, 4)}`, "ok");
    E.dialog("Area", `<div class="cx-big">${f(A, E, 4)} <small>${E.doc.units}²</small></div><div class="cx-kv"><span>Perimeter</span><b>${f(per, E, 4)} ${E.doc.units}</b></div>`, () => true, { noCancel: true });
  } });
  cmd("ID", { a: [], d: "Show the coordinates of a point", fn: async (E) => { const p = need(await E.getPoint("Specify point:")); if (isP(p)) E.msg(`X = ${f(p[0], E, 4)}   Y = ${f(p[1], E, 4)}`, "ok"); } });
  cmd("LIST", { a: ["LI", "LS"], d: "Details of selected objects", fn: async (E) => {
    const ids = await E.getSel(); if (!ids.length) return;
    const rows = ids.slice(0, 40).map((id) => { const e = E.byId(id), ms = K.measures(e, E.doc), g = K.grips(e).slice(0, 4).map((p) => `(${f(p[0], E)}, ${f(p[1], E)})`).join(" "); return `<div class="cx-card"><b>${esc(K.typeName(e))}</b> · layer ${esc(e.layer)} · colour ${esc(e.color || "ByLayer")} · linetype ${esc(e.lt || "ByLayer")}<div class="cx-note">${esc(g)}</div>${ms.length ? `<div class="cx-kv">${ms.map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v)}</b>`).join("")}</div>` : ""}</div>`; }).join("");
    E.dialog(`List — ${ids.length} object(s)`, rows + (ids.length > 40 ? `<p class="cx-note">First 40 shown.</p>` : ""), () => true, { noCancel: true, width: "min(640px,96vw)" });
  } });

  /* =============================== layer tools =============================== */
  const layEdit = (E, label, fn) => E.tx(label, () => { E.doc.layers = E.doc.layers.map((l) => Object.assign({}, l)); fn(); });
  const pickLayers = async (E, msg) => { const ids = await E.getSel(msg, { anyLayer: true }); return Array.from(new Set(ids.map((id) => E.byId(id).layer))); };
  cmd("LAYOFF", { a: [], d: "Turn off the layer of picked objects", fn: async (E) => { for (;;) { const v = await E.getEnt("Select an object on the layer to be turned off:", { anyLayer: true }); if (!v) return; if (v.e.layer === E.cur.layer) { E.err("The current layer cannot be turned off here."); continue; } layEdit(E, "layer off", () => { K.layer(E.doc, v.e.layer).on = false; }); E.msg(`Layer "${v.e.layer}" turned off.`); } } });
  cmd("LAYON", { a: [], d: "Turn all layers on (and thaw them)", fn: async (E) => layEdit(E, "layers on", () => E.doc.layers.forEach((l) => { l.on = true; l.frozen = false; })) });
  cmd("LAYISO", { a: [], d: "Isolate the layers of the selected objects (others turned off)", fn: async (E) => { const L = await pickLayers(E, "Select objects on the layer(s) to be isolated:"); if (!L.length) return; E.isoSave = E.doc.layers.map((l) => [l.name, l.on]); layEdit(E, "layer isolate", () => { E.doc.layers.forEach((l) => (l.on = L.includes(l.name))); if (!L.includes(E.cur.layer)) E.cur.layer = L[0]; }); E.msg(`${L.length} layer(s) isolated. LAYUNISO restores the others.`); } });
  cmd("LAYUNISO", { a: [], d: "Restore layers turned off by LAYISO", fn: async (E) => { if (!E.isoSave) return E.msg("No isolated layers to restore."); const m = new Map(E.isoSave); layEdit(E, "layer unisolate", () => E.doc.layers.forEach((l) => { if (m.has(l.name)) l.on = m.get(l.name); })); E.isoSave = null; } });
  cmd("LAYFRZ", { a: [], d: "Freeze the layer of picked objects", fn: async (E) => { const v = need(await E.getEnt("Select an object on the layer to be frozen:", { anyLayer: true })); if (v.e.layer === E.cur.layer) return E.err("The current layer cannot be frozen."); layEdit(E, "freeze", () => { K.layer(E.doc, v.e.layer).frozen = true; }); } });
  cmd("LAYTHW", { a: [], d: "Thaw all layers", fn: async (E) => layEdit(E, "thaw", () => E.doc.layers.forEach((l) => (l.frozen = false))) });
  cmd("LAYLCK", { a: [], d: "Lock the layer of a picked object", fn: async (E) => { const v = need(await E.getEnt("Select an object on the layer to be locked:", { anyLayer: true })); layEdit(E, "lock", () => { K.layer(E.doc, v.e.layer).lock = true; }); E.msg(`Layer "${v.e.layer}" locked.`); } });
  cmd("LAYULK", { a: [], d: "Unlock the layer of a picked object", fn: async (E) => { const v = need(await E.getEnt("Select an object on the layer to be unlocked:", { anyLayer: true })); layEdit(E, "unlock", () => { K.layer(E.doc, v.e.layer).lock = false; }); } });
  cmd("LAYMCUR", { a: [], d: "Make the layer of a picked object current", fn: async (E) => { const v = need(await E.getEnt("Select object whose layer will become current:", { anyLayer: true })); E.cur.layer = v.e.layer; E.refreshLayerBox(); E.msg(`"${v.e.layer}" is now the current layer.`); } });
  cmd("LAYCUR", { a: [], d: "Move selected objects to the current layer", fn: async (E) => { const ids = await E.getSel(); if (!ids.length) return; E.tx("to current layer", () => ids.forEach((id) => E.replace(id, Object.assign({}, E.byId(id), { layer: E.cur.layer })))); } });
  cmd("PURGE", { a: ["PU"], d: "Remove unused blocks and empty layers", fn: async (E) => {
    const used = new Set(), walk = (list) => list.forEach((e) => { if (e.t === "insert" && !used.has(e.name)) { used.add(e.name); if (E.doc.blocks[e.name]) walk(E.doc.blocks[e.name].ents); } }); walk(E.doc.ents);
    const blocks = Object.keys(E.doc.blocks).filter((n) => !used.has(n)), layUsed = new Set(E.doc.ents.map((e) => e.layer)); Object.values(E.doc.blocks).forEach((b) => b.ents.forEach((e) => layUsed.add(e.layer)));
    const layers = E.doc.layers.filter((l) => l.name !== "0" && l.name !== E.cur.layer && !layUsed.has(l.name)).map((l) => l.name);
    if (!blocks.length && !layers.length) return E.msg("Nothing to purge.");
    const ok = await E.dialog("Purge", `<p>Remove <b>${blocks.length}</b> unused block(s)${blocks.length ? ": " + esc(blocks.join(", ")) : ""} and <b>${layers.length}</b> empty layer(s)${layers.length ? ": " + esc(layers.join(", ")) : ""}?</p>`, () => true, { ok: "Purge" }); if (!ok) return;
    E.tx("purge", () => { const nb = Object.assign({}, E.doc.blocks); blocks.forEach((n) => delete nb[n]); E.doc.blocks = nb; E.doc.layers = E.doc.layers.filter((l) => !layers.includes(l.name)); });
    E.msg(`${blocks.length} block(s) and ${layers.length} layer(s) purged.`);
  } });
  cmd("OVERKILL", { a: ["OV"], d: "Delete duplicate overlapping objects", fn: async (E) => {
    const ids = await E.getSel("Select objects (All for the whole drawing):"); if (!ids.length) return;
    const seen = new Map(), dup = [], key = (e) => { const c = JSON.parse(JSON.stringify(e)); delete c.id; const r = (v) => (typeof v === "number" ? Math.round(v * 1e6) / 1e6 : Array.isArray(v) ? v.map(r) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, r(x)])) : v); let k = JSON.stringify(r(c)); if (e.t === "line") { const a = JSON.stringify(r(e.a)), b = JSON.stringify(r(e.b)); k = "line|" + e.layer + "|" + [a, b].sort().join("|"); } return k; };
    for (const id of ids) { const e = E.byId(id), k = key(e); if (seen.has(k)) dup.push(id); else seen.set(k, id); }
    if (!dup.length) return E.msg("No duplicate objects found.");
    E.tx("overkill", () => E.remove(dup)); E.msg(dup.length + " duplicate(s) deleted.");
  } });

  /* =============================== settings =============================== */
  cmd("DSETTINGS", { a: ["DS", "OSNAP", "OS", "SE", "DDOSNAP"], d: "Drafting settings: object snaps, polar, grid and snap spacing", keepSel: true, fn: async (E) => {
    const S = E.set, SN = [["end", "Endpoint"], ["mid", "Midpoint"], ["cen", "Centre"], ["qua", "Quadrant"], ["int", "Intersection"], ["per", "Perpendicular"], ["tan", "Tangent"], ["nea", "Nearest"], ["node", "Node"], ["ins", "Insertion"]];
    const r = await E.dialog("Drafting settings", `<h4>Object snaps <label class="cx-chk"><input id="os" type="checkbox"${S.osnap ? " checked" : ""}> on (F3)</label></h4><div class="cx-snaps">${SN.map(([k, n]) => `<label class="cx-chk"><input data-sn="${k}" type="checkbox"${S.snaps[k] ? " checked" : ""}> ${n}</label>`).join("")}</div>
      <h4>Polar tracking <label class="cx-chk"><input id="po" type="checkbox"${S.polar ? " checked" : ""}> on (F10)</label></h4><div class="cx-frm"><label>Increment angle<select id="pi">${[5, 10, 15, 18, 22.5, 30, 45, 90].map((a) => `<option${a === S.polarInc ? " selected" : ""}>${a}</option>`).join("")}</select></label></div>
      <h4>Grid and snap</h4><div class="cx-frm"><label>Grid spacing<input id="gu" type="number" step="any" value="${S.gridUnit}"></label><label>Snap spacing<input id="su" type="number" step="any" value="${S.snapUnit}"></label><label>Crosshair size %<input id="cs" type="number" min="5" max="100" value="${S.cross}"></label><label>Pick box (px)<input id="pb" type="number" min="2" max="15" value="${S.pick}"></label></div>`,
      (b) => { const o = { osnap: b.querySelector("#os").checked, polar: b.querySelector("#po").checked, polarInc: +b.querySelector("#pi").value, gridUnit: Math.max(1e-6, +b.querySelector("#gu").value || 10), snapUnit: Math.max(1e-6, +b.querySelector("#su").value || 10), cross: Math.min(100, Math.max(5, +b.querySelector("#cs").value || 100)), pick: Math.min(15, Math.max(2, +b.querySelector("#pb").value || 5)), snaps: {} }; b.querySelectorAll("[data-sn]").forEach((c) => (o.snaps[c.dataset.sn] = c.checked ? 1 : 0)); return o; });
    if (!r) return; Object.assign(E.set, r); if (r.polar) E.set.ortho = false; try { localStorage.setItem("kcad-prefs", JSON.stringify(E.set)); } catch (e) { /* ignore */ } E.drawStatus(); E.redraw();
  } });
  cmd("UNITS", { a: ["UN"], d: "Drawing units and precision", fn: async (E) => {
    const r = await E.dialog("Drawing units", `<div class="cx-frm"><label>Insertion units<select id="uu">${[["mm", "Millimetres"], ["cm", "Centimetres"], ["m", "Metres"], ["in", "Inches"], ["ft", "Feet"]].map(([k, n]) => `<option value="${k}"${k === E.doc.units ? " selected" : ""}>${n}</option>`).join("")}</select></label><label>Length precision (decimals)<input id="ud" type="number" min="0" max="8" value="${E.doc.dim.dec}"></label><label>Angle precision (decimals)<input id="ua" type="number" min="0" max="6" value="${E.doc.dim.adec}"></label></div><p class="cx-note">Changing units does not scale existing objects (same as AutoCAD). Use SCALE if you need to convert.</p>`, (b) => ({ u: b.querySelector("#uu").value, d: Math.max(0, Math.min(8, +b.querySelector("#ud").value | 0)), a: Math.max(0, Math.min(6, +b.querySelector("#ua").value | 0)) }));
    if (r) E.tx("units", () => { E.doc.units = r.u; E.doc.dim = Object.assign({}, E.doc.dim, { dec: r.d, adec: r.a }); });
  } });
  cmd("DIMSTYLE", { a: ["D", "DST", "DDIM"], d: "Dimension style: text height, arrows, extension lines, precision, scale", fn: async (E) => {
    const D = E.doc.dim, F = (id, label, v, step = "any") => `<label>${label}<input id="${id}" type="number" step="${step}" value="${v}"></label>`;
    const r = await E.dialog("Dimension style", `<div class="cx-frm">${F("th", "Text height", D.th)}${F("as", "Arrow size", D.as)}${F("exo", "Extension line offset", D.exo)}${F("exe", "Extend beyond dim line", D.exe)}${F("gap", "Text gap", D.gap)}${F("dec", "Decimals", D.dec, 1)}${F("adec", "Angle decimals", D.adec, 1)}${F("dli", "Baseline spacing", D.dli)}${F("scale", "Overall scale (DIMSCALE)", D.scale)}<label>Prefix<input id="pre" value="${esc(D.pre || "")}"></label><label>Suffix<input id="sfx" value="${esc(D.sfx || "")}" placeholder="e.g. mm"></label></div><p class="cx-note">Applies to every dimension that does not have its own override (set those in Properties). For a drawing printed at 1:N, set the overall scale to N.</p>`,
      (b) => { const o = {}; for (const k of ["th", "as", "exo", "exe", "gap", "dec", "adec", "dli", "scale"]) { const v = +b.querySelector("#" + k).value; if (!(v >= 0)) throw new Error("Values cannot be negative."); o[k] = k === "dec" || k === "adec" ? Math.round(v) : v; } if (!(o.scale > 0)) throw new Error("The overall scale must be above zero."); o.pre = b.querySelector("#pre").value; o.sfx = b.querySelector("#sfx").value; return o; });
    if (r) E.tx("dimension style", () => { E.doc.dim = Object.assign({}, E.doc.dim, r); });
  } });
  cmd("STYLE", { a: ["ST", "TEXTSIZE"], d: "Default text height", fn: async (E) => { const h = await E.getDist("Specify default text height", { dflt: f(E.doc.text.h, E) }); if (typeof h === "number" && h > 0) E.tx("text height", () => { E.doc.text = Object.assign({}, E.doc.text, { h }); }); } });
  cmd("LTSCALE", { a: ["LTS"], d: "Global linetype scale (dash length)", fn: async (E) => { const v = await E.getNum("Enter new linetype scale factor", { dflt: E.doc.ltscale, positive: true }); if (typeof v === "number" && v > 0) E.tx("ltscale", () => { E.doc.ltscale = v; }); } });
  cmd("PTYPE", { a: ["DDPTYPE", "PDMODE"], d: "Point style and size", fn: async (E) => {
    const modes = [[0, "·"], [2, "+"], [3, "×"], [34, "⊕"], [35, "⊗"], [66, "⊞"], [32, "○"]];
    const r = await E.dialog("Point style", `<div class="cx-seg">${modes.map(([m, s]) => `<label class="cx-pt"><input type="radio" name="pm" value="${m}"${m === E.doc.pdmode ? " checked" : ""}><span>${s}</span></label>`).join("")}</div><label>Size (0 = 5% of screen, in drawing units if above 0)<input id="ps" type="number" step="any" value="${E.doc.pdsize || 0}"></label>`, (b) => ({ m: +b.querySelector("input[name=pm]:checked").value, s: +b.querySelector("#ps").value || 0 }));
    if (r) E.tx("point style", () => { E.doc.pdmode = r.m; E.doc.pdsize = r.s; });
  } });

  /* =============================== files =============================== */
  K.download = (name, data, type) => { const b = data instanceof Blob ? data : new Blob([data], { type: type || "application/octet-stream" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); };
  const fname = (E, ext) => String((E.info && (E.info.number || E.info.title)) || "drawing").replace(/[^\w\-. ]+/g, "_").trim() + (E.info && E.info.rev ? "_rev" + E.info.rev : "") + "." + ext;
  K.pickFile = (accept) => new Promise((res) => { const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.style.display = "none"; document.body.append(i); i.onchange = () => { const fl = i.files[0]; i.remove(); res(fl || null); }; i.click(); });
  K.readDrawingFile = async (file) => {
    const txt = await file.text(), name = file.name.replace(/\.[^.]+$/, "");
    if (/\.dxf$/i.test(file.name) || /^\s*0\s*[\r\n]+\s*SECTION/.test(txt)) { const r = K.readDXF(txt); return { doc: r.doc, warn: r.warn, name }; }
    let j; try { j = JSON.parse(txt); } catch (e) { throw new Error("This is not a DXF (ASCII) or KMR CAD file. Binary DXF and DWG files are not supported — in AutoCAD use Save As → DXF (ASCII)."); }
    const doc = j.kcad ? j.doc : j.ents ? j : null; if (!doc) throw new Error("This JSON file is not a KMR CAD drawing."); return { doc, name: (j.info && j.info.title) || name, info: j.info };
  };
  const warnText = (w) => { const k = Object.keys(w || {}); return k.length ? "Skipped (not supported): " + k.map((x) => `${x} × ${w[x]}`).join(", ") + "." : ""; };
  cmd("NEW", { a: ["QNEW"], d: "Start a new drawing", norepeat: true, fn: async (E) => {
    if (E.opts.onNew) return E.opts.onNew(E);
    if (E.dirty) { const ok = await E.dialog("New drawing", "<p>The current drawing has changes that are not saved. Start a new drawing anyway?</p>", () => true, { ok: "Discard and start new" }); if (!ok) return; }
    E.load(K.newDoc(), { title: "Untitled" });
  } });
  cmd("OPEN", { a: [], d: "Open a DXF or KMR CAD (.json) file", norepeat: true, fn: async (E) => {
    if (E.opts.onOpen && (await E.opts.onOpen(E)) !== false) return;
    const file = await K.pickFile(".dxf,.json,.kcad"); if (!file) return;
    try { const r = await K.readDrawingFile(file); if (E.opts.onOpenFile) return E.opts.onOpenFile(E, r); E.load(r.doc, Object.assign({ title: r.name }, r.info || {})); E.msg(`Opened ${file.name}: ${E.doc.ents.length} objects. ${warnText(r.warn)}`); }
    catch (e) { E.err(e.message); }
  } });
  cmd("IMPORT", { a: ["IMP", "DXFIN"], d: "Import a DXF into the current drawing", fn: async (E) => {
    const file = await K.pickFile(".dxf,.json"); if (!file) return; let r; try { r = await K.readDrawingFile(file); } catch (e) { return E.err(e.message); }
    E.tx("import", () => { for (const l of r.doc.layers) if (!E.doc.layers.find((x) => x.name === l.name)) E.doc.layers = E.doc.layers.concat([l]); E.doc.blocks = Object.assign({}, r.doc.blocks, E.doc.blocks); for (const e of r.doc.ents) E.add(Object.assign({}, e, { id: undefined }), true); });
    E.zoomExt(); E.msg(`Imported ${r.doc.ents.length} objects from ${file.name}. ${warnText(r.warn)}`);
  } });
  cmd("QSAVE", { a: ["SAVE"], d: "Save the drawing (Ctrl+S)", norepeat: true, fn: async (E) => { if (E.opts.onSave) return E.opts.onSave(E, false); K.download(fname(E, "json"), JSON.stringify({ kcad: 1, info: E.info, doc: E.data() })); E.markSaved(); } });
  cmd("SAVEAS", { a: [], d: "Save as a new drawing / copy", norepeat: true, fn: async (E) => { if (E.opts.onSave) return E.opts.onSave(E, true); K.download(fname(E, "json"), JSON.stringify({ kcad: 1, info: E.info, doc: E.data() })); } });
  cmd("DXFOUT", { a: ["EXPORT", "DXF"], d: "Export as DXF (opens in AutoCAD, LibreCAD, DraftSight)", norepeat: true, fn: async (E) => { K.download(fname(E, "dxf"), K.writeDXF(E.doc), "application/dxf"); E.msg("DXF exported (R12 ASCII). Dimensions, leaders, hatches and multiline text are exported as plain lines, solids and text."); } });
  cmd("SVGOUT", { a: ["SVG"], d: "Export as SVG vector image", norepeat: true, fn: async (E) => K.download(fname(E, "svg"), K.toSVG(E.doc, { bg: "#ffffff" }), "image/svg+xml") });
  cmd("JSONOUT", { a: [], d: "Download a KMR CAD file (full copy of this drawing)", norepeat: true, fn: async (E) => K.download(fname(E, "json"), JSON.stringify({ kcad: 1, info: E.info, doc: E.data() }), "application/json") });
  cmd("PNGOUT", { a: ["PNG", "JPGOUT"], d: "Export as a PNG image", norepeat: true, fn: async (E) => {
    const r = await E.dialog("Export image", `<div class="cx-frm"><label>Width (px)<input id="pw" type="number" value="3000"></label><label>Background<select id="pb"><option value="#ffffff">White</option><option value="#1e2833">Dark</option></select></label><label>Area<select id="pa"><option value="ext">Whole drawing</option><option value="view">Current view</option></select></label></div>`, (b) => ({ w: Math.min(12000, Math.max(200, +b.querySelector("#pw").value || 3000)), bg: b.querySelector("#pb").value, area: b.querySelector("#pa").value }));
    if (!r) return; const box = r.area === "view" ? (() => { const a = E.s2w([0, E.view.H]), b = E.s2w([E.view.W, 0]); return { x0: a[0], y0: a[1], x1: b[0], y1: b[1] }; })() : K.extents(E.doc); if (!box) return;
    const m = (box.x1 - box.x0) * 0.03, bx = { x0: box.x0 - m, y0: box.y0 - m, x1: box.x1 + m, y1: box.y1 + m }, W = r.w, H = Math.round((W * (bx.y1 - bx.y0)) / Math.max(1e-9, bx.x1 - bx.x0));
    if (H > 12000) return E.err("The image would be too tall; use a smaller width.");
    const c = document.createElement("canvas"); c.width = W; c.height = H; const ctx = c.getContext("2d"); ctx.fillStyle = r.bg; ctx.fillRect(0, 0, W, H);
    const view = { cx: (bx.x0 + bx.x1) / 2, cy: (bx.y0 + bx.y1) / 2, s: W / (bx.x1 - bx.x0), W, H }, light = r.bg === "#ffffff";
    const P = K.canvasPainter(ctx, view, { fg: light ? "#000" : "#fff", light, lwt: true, ltscale: E.doc.ltscale }); for (const e of E.doc.ents) K.paint(P, e, E.doc);
    c.toBlob((b) => K.download(fname(E, "png"), b), "image/png");
  } });

  /* =============================== print / PDF =============================== */
  const PAPER = { A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594], A0: [1189, 841], Letter: [279.4, 215.9], Tabloid: [431.8, 279.4] };
  const UNITMM = { mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8 };
  K.PAPER = PAPER; K.UNITMM = UNITMM;
  cmd("PLOT", { a: ["PRINT"], d: "Print or save as PDF at a set scale on a paper size", norepeat: true, fn: async (E) => {
    if (E.space && E.space.lay && K.plotLayout) return K.plotLayout(E);
    const M = (E.mem = E.mem || {}), st = Object.assign({ paper: "A3", orient: "landscape", area: "ext", scale: "fit", mono: true, margin: 7 }, M.plot || {});
    let win = null;
    const build = (o) => {
      const sz = PAPER[o.paper], W = o.orient === "landscape" ? Math.max(...sz) : Math.min(...sz), H = o.orient === "landscape" ? Math.min(...sz) : Math.max(...sz), mg = o.margin;
      const box = o.area === "view" ? (() => { const a = E.s2w([0, E.view.H]), b = E.s2w([E.view.W, 0]); return { x0: a[0], y0: a[1], x1: b[0], y1: b[1] }; })() : o.area === "win" && win ? win : K.extents(E.doc);
      if (!box) throw new Error("The drawing is empty.");
      const umm = UNITMM[E.doc.units] || 1, k = o.scale === "fit" ? Math.min((W - 2 * mg) / Math.max(1e-9, box.x1 - box.x0), (H - 2 * mg) / Math.max(1e-9, box.y1 - box.y0)) : umm * (() => { const [a, b] = String(o.scale).split(":").map(Number); return a / b; })();
      const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2, vb = { x0: cx - W / 2 / k, x1: cx + W / 2 / k, y0: cy - H / 2 / k, y1: cy + H / 2 / k };
      return { svg: K.toSVG(E.doc, { box: vb, widthMm: W, heightMm: H, k, mono: o.mono }), W, H, k, umm };
    };
    const scales = ["fit", "1:1", "1:2", "1:5", "1:10", "1:20", "1:50", "1:100", "1:200", "1:500", "2:1", "5:1", "10:1"];
    const html = `<div class="cx-plot"><div class="cx-frm"><label>Paper<select id="pp">${Object.keys(PAPER).map((p) => `<option${p === st.paper ? " selected" : ""}>${p}</option>`).join("")}</select></label><label>Orientation<select id="po"><option value="landscape"${st.orient === "landscape" ? " selected" : ""}>Landscape</option><option value="portrait"${st.orient === "portrait" ? " selected" : ""}>Portrait</option></select></label>
      <label>What to print<select id="pa"><option value="ext"${st.area === "ext" ? " selected" : ""}>Extents (whole drawing)</option><option value="view"${st.area === "view" ? " selected" : ""}>Current view</option><option value="win">Window… (pick on screen)</option></select></label><label>Scale<select id="ps">${scales.map((s) => `<option value="${s}"${s === st.scale ? " selected" : ""}>${s === "fit" ? "Fit to paper" : s}</option>`).join("")}</select></label>
      <label>Margin (mm)<input id="pm" type="number" min="0" max="30" value="${st.margin}"></label><label class="cx-chk"><input id="pk" type="checkbox"${st.mono ? " checked" : ""}> Monochrome (black lines)</label></div><div class="cx-pv" id="pv"></div><p class="cx-note" id="pinfo"></p><p class="cx-note">“Print / Save as PDF” opens your browser’s print dialog — choose your printer or <b>Save as PDF</b>. Line weights print at their real thickness.</p></div>`;
    const read = (b) => ({ paper: b.querySelector("#pp").value, orient: b.querySelector("#po").value, area: b.querySelector("#pa").value, scale: b.querySelector("#ps").value, mono: b.querySelector("#pk").checked, margin: Math.max(0, +b.querySelector("#pm").value || 0) });
    const refresh = (b) => { try { const o = read(b), r = build(o); b.querySelector("#pv").innerHTML = r.svg.replace(/width="[\d.]+mm" height="[\d.]+mm"/, `width="100%" style="aspect-ratio:${r.W}/${r.H};background:#fff;box-shadow:0 2px 10px #0003"`); b.querySelector("#pinfo").textContent = `${o.paper} ${o.orient} ${r.W}×${r.H} mm · scale ${o.scale === "fit" ? "1:" + K.fmt(r.umm / r.k, 3) + " (fit)" : o.scale}`; } catch (e) { b.querySelector("#pv").textContent = e.message; } };
    for (;;) {
      const o = await E.dialog("Print / PDF", html, (b) => read(b), { ok: "Print / Save as PDF", width: "min(820px,96vw)", init: (b) => { if (st.area === "win" && win) b.querySelector("#pa").value = "win"; b.querySelectorAll("select,input").forEach((x) => (x.onchange = () => { if (x.id === "pa" && x.value === "win") { E.closeDlg({ pickWin: true, o: read(b) }); return; } refresh(b); })); refresh(b); } });
      if (!o) return;
      if (o.pickWin) { Object.assign(st, o.o, { area: "win" }); const a = need(await E.getPoint("Specify first corner of the print window:")); const c = need(await E.getPoint("Specify opposite corner:", { base: a, noRubber: true, preview: (q) => [{ t: "pline", closed: true, color: "#0a84ff", pts: [[a[0], a[1]], [q[0], a[1]], [q[0], q[1]], [a[0], q[1]]] }] })); win = { x0: Math.min(a[0], c[0]), y0: Math.min(a[1], c[1]), x1: Math.max(a[0], c[0]), y1: Math.max(a[1], c[1]) }; continue; }
      M.plot = o; const r = build(o);
      const fr = document.createElement("iframe"); fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"; document.body.append(fr);
      const d = fr.contentDocument; d.open(); d.write(`<!doctype html><html><head><title>${esc(fname(E, "pdf").replace(/\.pdf$/, ""))}</title><style>@page{size:${r.W}mm ${r.H}mm;margin:0}html,body{margin:0;padding:0}svg{display:block}</style></head><body>${r.svg}</body></html>`); d.close();
      setTimeout(() => { fr.contentWindow.focus(); fr.contentWindow.print(); setTimeout(() => fr.remove(), 60000); }, 250);
      return;
    }
  } });

  /* =============================== title block (ISO 7200 style) =============================== */
  cmd("TITLEBLOCK", { a: ["TB", "FRAME", "SHEET"], d: "Drawing sheet with border and title block (A4–A0), at the drawing scale", fn: async (E, args) => {
    args = args || {}; const I = E.info || {}, M = (E.mem = E.mem || {}), last = Object.assign({}, M.tb || {}, args.sheet ? { sheet: args.sheet, orient: args.orient, k: 1 } : {});
    const F = (id, label, v) => `<label>${label}<input id="${id}" value="${esc(v || "")}"></label>`;
    const r = await E.dialog("Title block", `<div class="cx-frm"><label>Sheet<select id="ts">${Object.keys(PAPER).filter((p) => p[0] === "A").map((p) => `<option${p === (last.sheet || "A3") ? " selected" : ""}>${p}</option>`).join("")}</select></label><label>Orientation<select id="to"><option value="landscape">Landscape</option><option value="portrait"${last.orient === "portrait" ? " selected" : ""}>Portrait</option></select></label><label>Scale 1 :<input id="tk" type="number" step="any" min="0" value="${last.k || 1}"></label><label>Projection<select id="tp"><option value="1">First angle (ISO E)</option><option value="3"${last.proj === "3" ? " selected" : ""}>Third angle (ISO A)</option></select></label></div>
      <div class="cx-frm">${F("t1", "Company", last.co || I.company || "")}${F("t2", "Title", I.title || "")}${F("t3", "Drawing number", I.number || "")}${F("t4", "Revision", I.rev || "A")}${F("t5", "Material", last.mat || "")}${F("t6", "General tolerance", last.tol || "ISO 2768-m")}${F("t7", "Drawn by", last.dr || I.drawn || "")}${F("t8", "Checked by", last.ck || "")}${F("t9", "Approved by", last.ap || "")}${F("t10", "Date", new Date().toISOString().slice(0, 10))}${F("t11", "Customer / part number", last.cust || I.part || "")}${F("t12", "Sheet", "1 of 1")}</div><p class="cx-note">The border is drawn in model space at the scale you enter (for 1:2 it is twice the paper size). The values are separate text objects, so you can double-click to change them later.</p>`,
      (b) => { const v = (id) => b.querySelector("#" + id).value.trim(); const k = +v("tk"); if (!(k > 0)) throw new Error("Enter the scale, e.g. 1 for 1:1 or 2 for 1:2."); return { sheet: v("ts"), orient: v("to"), k, proj: v("tp"), co: v("t1"), title: v("t2"), num: v("t3"), rev: v("t4"), mat: v("t5"), tol: v("t6"), dr: v("t7"), ck: v("t8"), ap: v("t9"), date: v("t10"), cust: v("t11"), sh: v("t12") }; }, { width: "min(760px,96vw)" });
    if (!r) return; M.tb = Object.assign({}, r);
    const sz = PAPER[r.sheet], W = r.orient === "landscape" ? Math.max(...sz) : Math.min(...sz), H = r.orient === "landscape" ? Math.min(...sz) : Math.max(...sz);
    const s = args.paper ? 1 : r.k / (UNITMM[E.doc.units] || 1);
    const base = args.base ? args.base : need(await E.getPoint("Specify lower-left corner of the sheet <0,0>:", { dflt: [0, 0], preview: (q) => [{ t: "pline", closed: true, pts: [[q[0], q[1]], [q[0] + W * s, q[1]], [q[0] + W * s, q[1] + H * s], [q[0], q[1] + H * s]] }] }));
    const lay = "Title block";
    const B = [], T = [], ln = (a, b, lw = 0.35) => B.push({ t: "line", layer: "0", lw, a, b }), rect = (x0, y0, x1, y1, lw = 0.7) => B.push({ t: "pline", layer: "0", lw, closed: true, pts: [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]] });
    const lab = (x, y, s2) => B.push({ t: "text", layer: "0", p: [x, y], h: 1.8, s: s2, rot: 0, ha: 0, va: 0 }), val = (x, y, s2, h = 3.5, ha = 0) => s2 && T.push({ t: "text", layer: lay, p: [base[0] + x * s, base[1] + y * s], h: h * s, s: s2, rot: 0, ha, va: 0 });
    rect(0, 0, W, H, 0.25); rect(20, 10, W - 10, H - 10, 0.7);
    // centring marks
    ln([W / 2, H - 10], [W / 2, H - 5], 0.7); ln([W / 2, 10], [W / 2, 5], 0.7); ln([20, H / 2], [15, H / 2], 0.7); ln([W - 10, H / 2], [W - 5, H / 2], 0.7);
    const x0 = W - 10 - 180, y0 = 10, X = (v) => x0 + v;
    rect(x0, y0, W - 10, y0 + 56, 0.7);
    for (const y of [8, 16, 24, 32, 40]) ln([X(0), y0 + y], [X(180), y0 + y]);
    ln([X(0), y0 + 48], [X(110), y0 + 48]); ln([X(110), y0 + 40], [X(110), y0 + 56]);
    ln([X(60), y0], [X(60), y0 + 40]); ln([X(110), y0], [X(110), y0 + 24]); ln([X(140), y0], [X(140), y0 + 24]); ln([X(30), y0 + 24], [X(30), y0 + 40]);
    lab(X(1.5), y0 + 53.5, "COMPANY"); lab(X(111.5), y0 + 53.5, "PROJECTION"); lab(X(1.5), y0 + 45.5, "TITLE"); lab(X(1.5), y0 + 37.5, "DRAWN"); lab(X(31.5), y0 + 37.5, "DATE"); lab(X(61.5), y0 + 37.5, "MATERIAL");
    lab(X(1.5), y0 + 29.5, "CHECKED"); lab(X(31.5), y0 + 29.5, "APPROVED"); lab(X(61.5), y0 + 29.5, "GENERAL TOLERANCE"); lab(X(1.5), y0 + 21.5, "DRAWING NUMBER"); lab(X(61.5), y0 + 21.5, "CUSTOMER / PART NO.");
    lab(X(111.5), y0 + 21.5, "REV"); lab(X(141.5), y0 + 21.5, "SCALE"); lab(X(1.5), y0 + 13.5, "SHEET SIZE"); lab(X(61.5), y0 + 13.5, "SHEET"); lab(X(111.5), y0 + 13.5, "UNITS"); lab(X(141.5), y0 + 13.5, "STATUS");
    lab(X(1.5), y0 + 2.2, "Drawn with KMR CAD Draft · Powered By : KMR Group of Companies · www.kmr-groups.com");
    // projection symbol
    const px = X(145), py = y0 + 47.5, cone = (cx) => { B.push({ t: "pline", layer: "0", lw: 0.35, closed: true, pts: [[cx - 7, py - 2.5, 0], [cx + 7, py - 5, 0], [cx + 7, py + 5, 0], [cx - 7, py + 2.5, 0]] }); ln([cx - 9, py], [cx + 9, py], 0.18); }, circ = (cx) => { B.push({ t: "circle", layer: "0", lw: 0.35, c: [cx, py], r: 5 }, { t: "circle", layer: "0", lw: 0.35, c: [cx, py], r: 2.5 }); ln([cx - 7, py], [cx + 7, py], 0.18); ln([cx, py - 7], [cx, py + 7], 0.18); };
    if (r.proj === "3") { circ(px - 6); cone(px + 18); } else { cone(px - 6); circ(px + 18); }
    const name = `SHEET-${r.sheet}-${r.orient === "landscape" ? "L" : "P"}`;
    val(1.5 + x0, y0 + 49.5, r.co, 4.5); val(1.5 + x0, y0 + 41.5, r.title, 4); val(1.5 + x0, y0 + 33.5, r.dr, 2.8); val(31.5 + x0, y0 + 33.5, r.date, 2.8); val(61.5 + x0, y0 + 33.5, r.mat, 2.8); val(1.5 + x0, y0 + 25.5, r.ck, 2.8); val(31.5 + x0, y0 + 25.5, r.ap, 2.8); val(61.5 + x0, y0 + 25.5, r.tol, 2.8);
    val(1.5 + x0, y0 + 17.5, r.num, 4); val(61.5 + x0, y0 + 17.5, r.cust, 2.8); val(111.5 + x0, y0 + 17.5, r.rev, 4); val(141.5 + x0, y0 + 17.5, r.k === 1 ? "1:1" : r.k < 1 ? K.fmt(1 / r.k, 3) + ":1" : "1:" + K.fmt(r.k, 3), 3.5);
    val(1.5 + x0, y0 + 9.5, r.sheet + " " + (r.orient === "landscape" ? "landscape" : "portrait"), 2.8); val(61.5 + x0, y0 + 9.5, r.sh, 2.8); val(111.5 + x0, y0 + 9.5, E.doc.units, 2.8); val(141.5 + x0, y0 + 9.5, "DRAFT", 2.8);
    E.tx("title block", () => {
      if (!E.doc.layers.find((l) => l.name === lay)) E.doc.layers = E.doc.layers.concat([{ name: lay, color: "#ffffff", lt: "CONTINUOUS", lw: 0.35, on: true, frozen: false, lock: false }]);
      E.doc.blocks = Object.assign({}, E.doc.blocks, { [name]: { base: [0, 0], ents: B } });
      E.add({ t: "insert", name, p: base, sx: s, sy: s, rot: 0, layer: lay, color: null, lt: null, lw: null }, true);
      for (const t of T) E.add(Object.assign({ color: null, lt: null, lw: null }, t), true);
    });
    if (E.opts.onInfo) E.opts.onInfo(E, { title: r.title, number: r.num, rev: r.rev });
    if (!args.base) E.zoomExt();
  } });
})((window.KCAD = window.KCAD || {}));
